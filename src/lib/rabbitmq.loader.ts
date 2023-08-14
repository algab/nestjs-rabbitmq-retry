import { Injectable, Inject, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { Channel, Connection, MessageProperties, connect } from 'amqplib';

import { CONFIG_OPTIONS, LISTENER_QUEUE } from './rabbitmq.constants';
import { ConfigOptions, Replies } from './rabbitmq.types';

@Injectable()
export class RabbitMQLoader implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQLoader.name);

  private connection: Connection;
  private channels: Map<string, Channel> = new Map();

  constructor(
    @Inject(CONFIG_OPTIONS) private config: ConfigOptions,
    private discoveryService: DiscoveryService,
    private metadataScanner: MetadataScanner,
    private reflector: Reflector,
  ) {}

  async onModuleInit() {
    await this.createChannel();
    const channel = await this.getChannel();
    await Promise.all(this.createQueues(channel));
    this.registerListeners();
  }

  onModuleDestroy() {
    Promise.all([this.closeChannel(), this.connection.close()]);
  }

  private async getConnection(): Promise<Connection> {
    try {
      const user = this.config.username;
      const password = this.config.password;
      const host = this.config.host;
      this.connection = await connect(`amqp://${user}:${password}@${host}`);
      this.logger.log('Connection with RabbitMQ successfully established');
      return this.connection;
    } catch (error) {
      this.logger.error('Connection with RabbitMQ cannot be established successfully');
      throw error;
    }
  }

  private async createChannel(): Promise<void> {
    const connection = await this.getConnection();
    for (const item of this.config.channels) {
      const channel = await connection.createChannel();
      await channel.prefetch(item.prefetch);
      this.channels.set(item.name, channel);
    }
    this.logger.log('Channels created successfully');
  }

  private async closeChannel(): Promise<void> {
    this.channels.forEach(async (channel) => {
      await channel.close();
    });
  }

  public async getChannel(name?: string): Promise<Channel> {
    const channel = this.channels.get(name);
    if (channel === undefined) {
      const name = this.config.channels.find((channel) => channel.primary).name;
      return this.channels.get(name);
    }
    return channel;
  }

  private createQueues(channel: Channel): Replies[] {
    const queues: Replies[] = [];
    for (const queue of this.config.queues) {
      queues.concat([
        channel.assertExchange(queue.exchange, queue.exchangeType),
        channel.assertQueue(queue.name, {
          deadLetterExchange: queue.exchange,
          deadLetterRoutingKey: `${queue.name}.retry`,
        }),
        channel.assertQueue(`${queue.name}.retry`, {
          deadLetterExchange: queue.exchange,
          deadLetterRoutingKey: queue.name,
          messageTtl: queue.ttl,
        }),
        channel.assertQueue(`${queue.name}.dlq`),
        channel.bindQueue(queue.name, queue.exchange, queue.routingKey),
        channel.bindQueue(queue.name, queue.exchange, queue.name),
        channel.bindQueue(`${queue.name}.retry`, queue.exchange, `${queue.name}.retry`),
        channel.bindQueue(`${queue.name}.dlq`, queue.exchange, `${queue.name}.dlq`),
      ]);
    }
    this.logger.log('Queues created successfully');
    return queues;
  }

  private registerListeners(): void {
    this.discoveryService
      .getProviders()
      .filter((wrapper) => wrapper.instance && !wrapper.isAlias)
      .forEach((wrapper: InstanceWrapper) => {
        const { instance } = wrapper;
        const prototype = Object.getPrototypeOf(instance) || {};
        const methods = this.metadataScanner.getAllMethodNames(prototype);
        methods.forEach((name: string) => {
          const value = this.reflector.get(LISTENER_QUEUE, instance[name]);
          if (value !== undefined) {
            this.listener(value.queue, value.channelName, instance[name]);
          }
        });
      });
  }

  private async listener(
    queue: string,
    channelName: string,
    callback: (properties: MessageProperties, body: string) => void,
  ): Promise<void> {
    const channel = await this.getChannel(channelName);
    channel.consume(queue, (message) => {
      try {
        callback(message.properties, message.content.toString('utf8'));
        channel.ack(message);
      } catch (error) {
        if (
          message.properties.headers['x-death'] !== undefined &&
          message.properties.headers['x-death'][0].count + 1 >= this.config.retry
        ) {
          channel.sendToQueue(`${queue}.dlq`, Buffer.from(JSON.stringify(message)));
          channel.reject(message);
        } else {
          channel.nack(message, false, false);
        }
      }
    });
  }
}
