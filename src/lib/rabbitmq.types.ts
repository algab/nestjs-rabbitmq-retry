export type ConfigOptions = {
  host: string;
  username: string;
  password: string;
  isAMQPS: boolean;
  retry?: number;
  queues?: ConfigQueue[];
  channels?: ConfigChannel[];
};

export type ConfigQueue = {
  name: string;
  exchange: QueueExchange;
  routingKey: string;
  ttl: number;
  options?: QueueOptions;
};

export type ConfigChannel = {
  name: string;
  prefetch: number;
  concurrency: number;
  primary: boolean;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arguments?: any;
};
