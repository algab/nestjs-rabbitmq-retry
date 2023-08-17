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
    queues: ConfigQueue[] = [],
    channels: ConfigChannel[] = [{ name: 'master', prefetch: 50, concurrency: 2, primary: true }],
  ): DynamicModule {
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
