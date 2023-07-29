import { extendArrayMetadata } from "@nestjs/common/utils/extend-metadata.util";

import { LISTENER_QUEUE } from "./constant";

export const Listener = (queue: string) => {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    extendArrayMetadata(LISTENER_QUEUE, [{ queue }], descriptor.value);
  };
};
