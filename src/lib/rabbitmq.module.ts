import { DynamicModule, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { RabbitMQLoader } from "./rabbitmq.loader";
import { RabbitMQService } from "./rabbitmq.service";
import { ConfigOptions } from "./rabbitmq.types";
import { CONFIG_OPTIONS } from "./constant";

@Module({})
export class RabbitMQModule {
  static forRoot(configOptions: ConfigOptions): DynamicModule {
    return {
      module: RabbitMQModule,
      imports: [DiscoveryModule],
      providers: [
        {
          provide: CONFIG_OPTIONS,
          useValue: configOptions,
        },
        RabbitMQLoader,
        RabbitMQService,
      ],
      exports: [RabbitMQService],
    };
  }
}
