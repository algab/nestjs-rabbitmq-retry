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
  concurrency: number;
  primary: boolean;
};

export type ConfigQueue = {
  name: string;
  exchange: QueueExchange;
  routingKey: string;
  ttl: number;
  options?: QueueOptions;
};

export type OptionsPublish = {
  priority?: number | undefined;
};

type QueueExchange = {
  name: string;
  type: 'topic' | 'direct' | 'fanout' | 'headers';
};

type QueueOptions = {
  exclusive?: boolean | undefined;
  durable?: boolean | undefined;
  autoDelete?: boolean | undefined;
  expires?: number | undefined;
  maxLength?: number | undefined;
  maxPriority?: number | undefined;
  arguments?: any;
};
