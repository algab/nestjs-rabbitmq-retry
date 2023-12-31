import { LISTENER_QUEUE } from './rabbitmq.constants';

export const Listener = (queue: string, channelName?: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(LISTENER_QUEUE, { queue, channelName }, descriptor.value);
  };
};
