import { extendArrayMetadata } from '@nestjs/common/utils/extend-metadata.util';

import { LISTENER_QUEUE } from './rabbitmq.constants';

export const Listener = (queue: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    extendArrayMetadata(LISTENER_QUEUE, [{ queue }], descriptor.value);
  };
};
