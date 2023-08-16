import { DynamicModule, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { CONFIG_OPTIONS } from './rabbitmq.constants';
import { RabbitMQLoader } from './rabbitmq.loader';
import { RabbitMQService } from './rabbitmq.service';
import { ConfigChannel, ConfigQueue } from './rabbitmq.types';

@Module({})
export class RabbitMQModule {
  static forRoot(
    host: string,
    username: string,
    password: string,
    retry = 3,
    channels: ConfigChannel[] = [{ name: 'master', prefetch: 50, concurrency: 2, primary: true }],
    queues: ConfigQueue[] = [],
  ): DynamicModule {
    if (channels.filter((channel) => channel.primary).length === 0) {
      throw new Error('One of the channels to be created needs to be the primary channel.');
    }
    return {
      global: true,
      module: RabbitMQModule,
      imports: [DiscoveryModule],
      providers: [
        {
          provide: CONFIG_OPTIONS,
          useValue: { host, username, password, retry, channels, queues },
        },
        RabbitMQLoader,
        RabbitMQService,
      ],
      exports: [RabbitMQService],
    };
  }
}
