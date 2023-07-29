import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { Channel, Connection, Message, connect } from 'amqplib';

import { CONFIG_OPTIONS, LISTENER_QUEUE } from './rabbitmq.constants';
import { ConfigOptions } from './rabbitmq.types';

@Injectable()
export class RabbitMQLoader implements OnModuleInit, OnModuleDestroy {
  private connection: Connection;
  private channel: Channel;

  constructor(
    @Inject(CONFIG_OPTIONS) private config: ConfigOptions,
    private discoveryService: DiscoveryService,
    private metadataScanner: MetadataScanner,
    private reflector: Reflector,
  ) {}

  async onModuleInit() {
    const channel = await this.getChannel();
    await Promise.all(this.createQueues(channel));
    this.discoveryService
      .getProviders()
      .filter((wrapper) => wrapper.instance && !wrapper.isAlias)
      .forEach((wrapper: InstanceWrapper) => {
        const { instance } = wrapper;
        const prototype = Object.getPrototypeOf(instance) || {};
        const methodNames = this.metadataScanner.getAllMethodNames(prototype);
        methodNames.forEach((name: string) => {
          const value = this.reflector.get(LISTENER_QUEUE, instance[name]);
          if (value !== undefined) {
            this.consume(value[0].queue, instance[name]);
          }
        });
      });
  }

  onModuleDestroy() {
    Promise.all([this.channel.close(), this.connection.close()]);
  }

  public async getChannel(): Promise<Channel> {
    if (this.channel === undefined) {
      const connection = await this.getConnection();
      this.channel = await connection.createChannel();
      return this.channel;
    }
    return this.channel;
  }

  private createQueues(channel: Channel) {
    const queues = [];
    for (const queue of this.config.queues) {
      queues.concat([
        channel.assertExchange(queue.exchange, queue.exchangeType),
        channel.assertQueue(queue.name, {
          deadLetterExchange: queue.exchange,
          deadLetterRoutingKey: `${queue.name}.retry`,
        }),
        channel.assertQueue(`${queue.name}.retry`, {
          deadLetterExchange: queue.exchange,
          deadLetterRoutingKey: queue.routingKey,
          messageTtl: queue.ttl,
        }),
        channel.assertQueue(`${queue.name}.dlq`),
        channel.bindQueue(queue.name, queue.exchange, queue.routingKey),
        channel.bindQueue(`${queue.name}.retry`, queue.exchange, `${queue.name}.retry`),
        channel.bindQueue(`${queue.name}.dlq`, queue.exchange, `${queue.name}.dlq`),
      ]);
    }
    return queues;
  }

  private async getConnection(): Promise<Connection> {
    if (this.connection === undefined) {
      const user = this.config.username;
      const password = this.config.password;
      const host = this.config.host;
      this.connection = await connect(`amqp://${user}:${password}@${host}`);
      return this.connection;
    }
    return this.connection;
  }

  private async consume(queue: string, callback: (message: Message) => void): Promise<void> {
    const channel = await this.getChannel();
    channel.consume(queue, (message) => {
      try {
        callback(message);
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
