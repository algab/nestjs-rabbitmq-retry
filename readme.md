# NestJS RabbitMQ Retry

[![NestJS RabbitMQ Retry](https://github.com/algab/nestjs-rabbitmq-retry/actions/workflows/master.yml/badge.svg)](https://github.com/algab/nestjs-rabbitmq-retry/actions)
[![codecov](https://codecov.io/gh/algab/nestjs-rabbitmq-retry/branch/master/graph/badge.svg?token=O1U411GOIY)](https://codecov.io/gh/algab/nestjs-rabbitmq-retry)
[![npm package](https://img.shields.io/npm/v/nestjs-rabbitmq-retry?style=flat)](https://www.npmjs.com/package/nestjs-rabbitmq-retry)

It is a library for the NestJS framework that allows easy communication with RabbitMQ and also provides an already implemented repeating mechanism.

For each queue created using this library, two additional queues will be created, one for retentatives and one for DLQ.

In addition to this automatic retentative management approach, you can manage and customize multiple channels in one connection.

## Install

```
npm install amqplib nestjs-rabbitmq-retry
```

## How to use

After installing **nestjs-rabbitmq-retry** you need to import it globally preferably in **app.module**.

```
@Module({
  imports: [
    RabbitMQModule.forRoot(
      '0.0.0.0:5672',
      'guest',
      'guest',
      false,
      3,
      [
        { queue: 'save', exchange: { name: 'exchange-save', type: 'topic' }, routingKey: 'routing-key-save', ttl: 10000 },
        { queue: 'update', exchange: { name: 'exchange-update', type: 'direct' }, routingKey: 'routing-key-update', ttl: 20000 },
      ],
      [
        { name: 'master', prefetch: 100, concurrency: 4, primary: true }
      ]
    })
  ],
})
export class AppModule {}
```

The configuration attributes are:

- host: The host where RabbitMQ is running. (Required)

- username: The username to access RabbitMQ. (Required)

- password: The password to access RabbitMQ. (Required)

- isAMQPS: The connection used will be amqps. (The default value is false)

- retry: The number of times the message will be processed. (The default value is 3)

- queues: It is an array that indicates which queues must be created, the necessary exchanges and the routing key to carry out the calls. (The default value is an empty array)

The queues parameter attributes are as follows:

| Name         | Explanation                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| name         | The name of the queue to be created. (Required)                                                                |
| exchange     | The exchange is an object that contains two attributes name and type. The exchange type has the following valid values: topic, direct, fanout and headers.(Required)                              |
| routingKey   | The name of the routing key to bind. (Required)                                                                |
| ttl          | The time in milliseconds that the message will wait to be reprocessed. (Required)                              |
| options      | Options is an object that contains the following attributes: exclusive, durable, autoDelete, expires, maxLength, maxPriority and arguments. None of these attributes are required. The arguments attribute is an object that can take additional arguments, usually parameters for some type of broker-specific extension.                                          |

- channels: It is an array that indicates how many channels should be created and what their settings will be like. (The default value is { name: 'master', prefetch: 50, concurrency: 2, primary: true })

The channel parameter attributes are as follows:

| Name         | Explanation                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| name         | The name of the channel to be created. (Required)                                                                       |
| prefetch     | Number of messages to be searched. (Required)                                                                           |
| concurrency  | Number of channels that will be created with the same settings to increase the number of consumed messages. (Required)  |
| primary      | It is a boolean that indicates whether this channel will be used to perform other operations in addition to being the default channel for consuming messages, if no other is indicated.  (Required)                                                                |

## Listener

To set up a queue listener is very simple, just put the annotation **Listener** in the method you want to process the message. In this annotation, you put the name of the queue you want to receive the messages and also optionally the channel name if you have specific settings to consume messages in a certain way.

#### Queue name only

```
import { MessageFields, MessageProperties } from 'amqplib';
import { Listener } from 'nestjs-rabbitmq-retry';

@Injectable()
export class MessageListener {
  @Listener('save')
  listener(body: string, fields: MessageFields, properties: MessageProperties) {
    console.log(properties);
    console.log(body);
  }
}
```

#### With queue name and channel name

```
import { MessageFields, MessageProperties } from 'amqplib';
import { Listener } from 'nestjs-rabbitmq-retry';

@Injectable()
export class MessageListener {
  @Listener('save', 'master')
  listener(body: string, fields: MessageFields, properties: MessageProperties) {
    console.log(properties);
    console.log(body);
  }
}
```

## Producer

To send a message, you need to use the **RabbitMQService** class. The required attributes are the name of the **exchange**, the name of the **routing key**, and the **message** you want to send. You can send a message of any kind. There is also the **options** attribute that contains the **priority** field where the priority of this message is indicated for RabbitMQ.

**Warning 1:** To use the RabbitMQService class you need to have imported RabbitMQModule into AppModule.

**Warning 2:** To consume messages with priority, this respective configuration must be indicated when creating the queue.

#### No options field

```
import { RabbitMQService } from 'nestjs-rabbitmq-retry';

@Injectable()
export class MessageService {
  constructor(private rabbitmqService: RabbitMQService<string>);
  async sendMessage(): Promise<void> {
    await this.rabbitmqService.publish('exchange-save', 'routing-key-save', 'message');
  }
}
```

#### With options field

```
import { RabbitMQService } from 'nestjs-rabbitmq-retry';

@Injectable()
export class MessageService {
  constructor(private rabbitmqService: RabbitMQService<string>);
  async sendMessage(): Promise<void> {
    await this.rabbitmqService.publish('exchange-save', 'routing-key-save', 'message', { priority: 10 });
  }
}
```
