import { Injectable, Inject, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { Channel, Connection, MessageFields, MessageProperties, connect } from 'amqplib';

import { CONFIG_OPTIONS, LISTENER_QUEUE } from './rabbitmq.constants';
import { ConfigOptions } from './rabbitmq.types';

@Injectable()
export class RabbitMQLoader implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQLoader.name);

  private connection: Connection;
  private channels: Map<string, Channel[]> = new Map();

  constructor(
    @Inject(CONFIG_OPTIONS) private config: ConfigOptions,
    private discoveryService: DiscoveryService,
    private metadataScanner: MetadataScanner,
    private reflector: Reflector,
  ) {}

  async onModuleInit() {
    if (this.config.channels.filter((channel) => channel.primary).length === 0) {
      throw new Error('One of the channels to be created needs to be the primary channel.');
    } else {
      await this.createChannels();
      const channels = await this.getChannel();
      await this.createQueues(channels[0]);
      this.registerListeners();
    }
  }

  onModuleDestroy() {
    Promise.all([this.closeChannels(), this.connection.close()]);
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

  private async createChannels(): Promise<void> {
    const connection = await this.getConnection();
    for (const item of this.config.channels) {
      const channels = [];
      for (let index = 0; index < item.concurrency; index++) {
        const channel = await connection.createChannel();
        await channel.prefetch(item.prefetch);
        channels.push(channel);
      }
      this.channels.set(item.name, channels);
    }
    this.logger.log('Channels created successfully');
  }

  private async closeChannels(): Promise<void> {
    this.channels.forEach((channels) => {
      channels.forEach(async (channel) => await channel.close());
    });
  }

  public async getChannel(name?: string): Promise<Channel[]> {
    const channels = this.channels.get(name);
    if (channels === undefined) {
      const name = this.config.channels.find((channel) => channel.primary).name;
      return this.channels.get(name);
    }
    return channels;
  }

  private async createQueues(channel: Channel): Promise<void> {
    for (const queue of this.config.queues) {
      await Promise.all([
        channel.assertExchange(queue.exchange.name, queue.exchange.type),
        channel.assertQueue(queue.name, {
          ...queue.options,
          deadLetterExchange: queue.exchange.name,
          deadLetterRoutingKey: `${queue.name}.retry`,
        }),
        channel.assertQueue(`${queue.name}.retry`, {
          messageTtl: queue.ttl,
          deadLetterExchange: queue.exchange.name,
          deadLetterRoutingKey: queue.name,
        }),
        channel.assertQueue(`${queue.name}.dlq`),
        channel.bindQueue(queue.name, queue.exchange.name, queue.routingKey),
        channel.bindQueue(queue.name, queue.exchange.name, queue.name),
        channel.bindQueue(`${queue.name}.retry`, queue.exchange.name, `${queue.name}.retry`),
        channel.bindQueue(`${queue.name}.dlq`, queue.exchange.name, `${queue.name}.dlq`),
      ]);
    }
    this.logger.log('Queues created successfully');
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
    callback: (body: string, fields: MessageFields, properties: MessageProperties) => void,
  ): Promise<void> {
    const channels = await this.getChannel(channelName);
    for (const channel of channels) {
      channel.consume(queue, (message) => {
        try {
          callback(message.content.toString('utf8'), message.fields, message.properties);
          channel.ack(message);
        } catch (error) {
          if (
            message.properties.headers['x-death'] !== undefined &&
            message.properties.headers['x-death'][0].count + 1 >= this.config.retry
          ) {
            channel.sendToQueue(`${queue}.dlq`, Buffer.from(JSON.stringify(message)));
            channel.ack(message, false);
          } else {
            channel.nack(message, false, false);
          }
        }
      });
    }
  }
}
