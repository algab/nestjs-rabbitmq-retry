import { Injectable } from '@nestjs/common';

import { RabbitMQLoader } from './rabbitmq.loader';

@Injectable()
export class RabbitMQService<T> {
  constructor(private rabbitmqLoader: RabbitMQLoader) {}

  async publish(exchange: string, routingKey: string, message: T): Promise<void> {
    await this.rabbitmqLoader.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)));
  }
}
