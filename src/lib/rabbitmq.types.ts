export type ConfigOptions = {
  host: string;
  username: string;
  password: string;
  retry: number;
  queues: ConfigQueue[];
};

export type ConfigQueue = {
  name: string;
  exchange: string;
  exchangeType: 'TOPIC' | 'DIRECT' | 'FANOUT';
  routingKey: string;
  ttl: number;
};
