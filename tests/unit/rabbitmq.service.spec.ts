import { createMock } from '@golevelup/ts-jest';

import { RabbitMQService } from '../../src';
import { RabbitMQLoader } from '../../src/lib/rabbitmq.loader';

describe('Testing RabbitMQService', () => {
  let rabbitService: RabbitMQService<string>;
  let rabbitLoader: RabbitMQLoader;

  const mockPublish = jest.fn();

  beforeAll(() => {
    rabbitLoader = createMock<RabbitMQLoader>({
      getChannel: jest.fn().mockResolvedValue([{ publish: mockPublish }]),
    });
    rabbitService = new RabbitMQService<string>(rabbitLoader);
  });

  it('when activating the publish method must also activate the RabbitMQLoader class', async () => {
    await rabbitService.publish('exchange', 'routing', 'test');

    expect(mockPublish).toBeCalledTimes(1);
  });
});
