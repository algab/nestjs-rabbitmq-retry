import { Injectable } from '@nestjs/common';

import { RabbitMQLoader } from './rabbitmq.loader';
import { OptionsPublish } from './rabbitmq.types';

@Injectable()
export class RabbitMQService<T> {
  constructor(private rabbitmqLoader: RabbitMQLoader) {}

  async publish(exchange: string, routingKey: string, message: T, options?: OptionsPublish): Promise<void> {
    const channel = await this.rabbitmqLoader.getChannel();
    channel[0].publish(exchange, routingKey, Buffer.from(JSON.stringify(message)), options);
  }
}
