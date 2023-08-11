import { createMock } from '@golevelup/ts-jest';

import { RabbitMQLoader } from '../../src/lib/rabbitmq.loader';
import { RabbitMQService } from '../../src/lib/rabbitmq.service';

describe('Testing RabbitMQService', () => {
  let rabbitService: RabbitMQService<string>;
  let rabbitLoader: RabbitMQLoader;

  const mockPublish = jest.fn();

  beforeAll(() => {
    rabbitLoader = createMock<RabbitMQLoader>({ publish: mockPublish });
    rabbitService = new RabbitMQService<string>(rabbitLoader);
  });

  it('when activating the publish method must also activate the RabbitMQLoader class', async () => {
    await rabbitService.publish('exchange', 'routing', 'test');

    expect(mockPublish).toBeCalled();
  });
});
