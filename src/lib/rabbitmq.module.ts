import { DynamicModule, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { CONFIG_OPTIONS } from './rabbitmq.constants';
import { RabbitMQLoader } from './rabbitmq.loader';
import { RabbitMQService } from './rabbitmq.service';
import { ConfigOptions } from './rabbitmq.types';

@Module({})
export class RabbitMQModule {
  static forRoot(
    config: ConfigOptions = { host: '', username: '', password: '', retry: 3, prefetch: 50, queues: [] },
  ): DynamicModule {
    return {
      global: true,
      module: RabbitMQModule,
      imports: [DiscoveryModule],
      providers: [
        {
          provide: CONFIG_OPTIONS,
          useValue: config,
        },
        RabbitMQLoader,
        RabbitMQService,
      ],
      exports: [RabbitMQService],
    };
  }
}
