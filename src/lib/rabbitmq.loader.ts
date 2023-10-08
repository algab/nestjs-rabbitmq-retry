import { Injectable, Inject, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { DiscoveryService } from '@golevelup/nestjs-discovery';
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
  ) {}

  async onModuleInit() {
    if (this.config.channels.filter((channel) => channel.primary).length === 0) {
      throw new Error('One of the channels to be created needs to be the primary channel.');
    } else {
      await this.createChannels();
      const channels = await this.getChannel();
      await this.createQueues(channels[0]);
      await this.registerListeners();
    }
  }

  onModuleDestroy() {
    Promise.all([this.closeChannels(), this.connection.close()]);
  }

  private async getConnection(): Promise<Connection> {
    try {
      const amqp = this.config.isAMQPS ? 'amqps' : 'amqp';
      const user = this.config.username;
      const password = this.config.password;
      const host = this.config.host;
      this.connection = await connect(`${amqp}://${user}:${password}@${host}`);
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

  private async registerListeners(): Promise<void> {
    const methods = await this.discoveryService.providerMethodsWithMetaAtKey<{ queue: string; channelName: string }>(
      LISTENER_QUEUE,
    );
    methods.forEach((method) => {
      const meta = method.meta;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (...args: any) =>
        method.discoveredMethod.handler.apply(method.discoveredMethod.parentClass.instance, args);
      this.listener(meta.queue, meta.channelName, handler);
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
