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
  exchangeType: string;
  routingKey: string;
  ttl: number;
};
