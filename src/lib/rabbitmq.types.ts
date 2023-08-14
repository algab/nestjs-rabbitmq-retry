import { Replies } from 'amqplib';

export type ConfigOptions = {
  host: string;
  username: string;
  password: string;
  retry?: number;
  channels?: ConfigChannel[];
  queues?: ConfigQueue[];
};

export type ConfigChannel = {
  name: string;
  prefetch: number;
  primary: boolean;
};

export type ConfigQueue = {
  name: string;
  exchange: string;
  exchangeType: 'topic' | 'direct' | 'fanout' | 'headers';
  routingKey: string;
  ttl: number;
};

export type Replies = Replies.AssertExchange | Replies.AssertQueue | Replies.Empty;
