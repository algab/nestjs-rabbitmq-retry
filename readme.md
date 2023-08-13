# NestJS RabbitMQ Retry

It is a library for the NestJS framework that allows easy communication with RabbitMQ and also provides an already implemented retry mechanism.

## Install

```
npm install amqplib nestjs-rabbitmq-retry
```

## How to use

After installing **nestjs-rabbitmq-retry** you need to import it globally preferably in **app.module**.

```
@Module({
  imports: [
    RabbitMQModule.forRoot({
      host: '0.0.0.0:5672',
      username: 'guest',
      password: 'guest',
      retry: 3,
      prefetch: 100,
      queues: [
        { queue: 'save', exchange: 'exchange-save', exchangeType: 'topic', routingKey: 'routing-key-save', ttl: 10000 },
        { queue: 'update', exchange: 'exchange-update', exchangeType: 'topic', routingKey: 'routing-key-update', ttl: 20000 },
      ],
    })
  ],
})
export class AppModule {}
```

The configuration attributes are:

- host: The host where RabbitMQ is running. (Mandatory).

- username: The username to access RabbitMQ. (Mandatory).

- password: The password to access RabbitMQ. (Mandatory).

- retry: The number of times the message will be processed. (The default value is 3).

- prefetch: The amount of messages a channel will fetch at once. (The default value is 50).

- queues: It is an array that indicates which queues must be created, the necessary exchanges and the routing key to carry out the calls. (The default value is an empty array).

The attributes of the queues parameter are as follows:

| Name         | Explanation                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| name         | The name of the queue to be created. (Mandatory).                                                               |
| exchange     | The name of the exchange to be created. (Mandatory).                                                            |
| exchangeType | The type of exchange that will be created. Possible values are: topic, direct, fanout and headers. (Mandatory). |
| routingKey   | The name of the routing key to bind. (Mandatory).                                                               |
| ttl          | The time in milliseconds that the message will wait to be reprocessed. (Mandatory).                             |

## Listener

To configure a queue listener is very simple, just put the **Listener** annotation in the method you want to process the message. In this annotation you put the name of the queue that you want to receive messages.

```
@Injectable()
export class SavedMediaListener {
  @Listener('save')
  listener(properties: MessageProperties, body: string) {
    console.log(properties);
    console.log(body);
  }
}
```

## Producer

To send a message you need to use the **RabbitMQService** class. The required attributes are the **exchange name**, **the routingKey** and the **message** you want to send. You can send a message of any type.

**Attention:** To use this class you need to have imported the RabbitMQModule.

```
@Injectable()
export class MediaService {
  constructor(private rabbitmqService: RabbitMQService<string>);
  async sendMedia(): Promise<void> {
    await this.rabbitmqService.publish('exchange-save', 'routing-key-save', 'message');
  }
}
```
