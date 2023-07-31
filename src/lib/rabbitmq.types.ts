import { Replies } from 'amqplib';

export type ConfigOptions = {
  host: string;
  username: string;
  password: string;
  retry: number;
  prefetch: number;
  queues: ConfigQueue[];
};

export type ConfigQueue = {
  name: string;
  exchange: string;
  exchangeType: 'TOPIC' | 'DIRECT' | 'FANOUT';
  routingKey: string;
  ttl: number;
};

export type AMQP_Parallel = Replies.AssertExchange | Replies.AssertQueue | Replies.Empty;
