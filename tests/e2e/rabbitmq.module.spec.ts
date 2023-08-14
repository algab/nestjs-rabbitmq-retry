import { createMock } from '@golevelup/ts-jest';
import { Injectable } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as amqplib from 'amqplib';

import { RabbitMQModule, Listener } from '../../src';

const mockConnect = jest.fn();
const mockAssertExchange = jest.fn();
const mockAssertQueue = jest.fn();
const mockPrefetch = jest.fn();
const mockBindQueue = jest.fn();
const mockAck = jest.fn();
const mockSendToQueue = jest.fn();
const mockReject = jest.fn();

jest.mock('amqplib', () => ({
  ...jest.requireActual('amqplib'),
  connect: () => mockConnect(),
}));

@Injectable()
class ListenerSuccess {
  @Listener('queue')
  test() {}
}

@Injectable()
class ListenerError {
  @Listener('queue')
  test() {
    throw new Error('error');
  }
}

describe('Testing e2e RabbitMQModule', () => {
  let moduleRef: TestingModule;

  mockConnect.mockResolvedValueOnce({
    createChannel: () => ({
      close: jest.fn(),
      prefetch: mockPrefetch,
      assertExchange: mockAssertExchange,
      assertQueue: mockAssertQueue,
      bindQueue: mockBindQueue,
      ack: mockAck,
      nack: jest.fn(),
      consume: (_, onMessage: (msg: amqplib.Message) => void) =>
        onMessage(createMock<amqplib.Message>({ content: Buffer.from('test'), properties: { headers: {} } })),
    }),
    close: jest.fn(),
  });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        RabbitMQModule.forRoot({
          host: '0.0.0.0',
          username: 'test',
          password: 'test',
          retry: 3,
          queues: [
            {
              name: 'test',
              exchange: 'exchange',
              exchangeType: 'topic',
              routingKey: 'routing',
              ttl: 1000,
            },
          ],
        }),
      ],
      providers: [ListenerSuccess, ListenerError],
    }).compile();
    moduleRef.init();
  });

  afterAll(() => moduleRef.close());
  afterEach(() => jest.clearAllMocks());

  it('when initializing the module it must trigger all the actions of creating and linking queues', () => {
    expect(mockPrefetch).toBeCalledTimes(1);
    expect(mockAssertExchange).toBeCalledTimes(1);
    expect(mockAssertQueue).toBeCalledTimes(3);
    expect(mockBindQueue).toBeCalledTimes(4);
  });
});

describe('Testing e2e RabbitMQModule dlq', () => {
  let moduleRef: TestingModule;

  mockConnect.mockResolvedValueOnce({
    createChannel: () => ({
      close: jest.fn(),
      prefetch: jest.fn(),
      assertExchange: jest.fn(),
      assertQueue: jest.fn(),
      bindQueue: jest.fn(),
      ack: mockAck,
      sendToQueue: mockSendToQueue,
      reject: mockReject,
      consume: (_, onMessage: (msg: amqplib.Message) => void) =>
        onMessage(
          createMock<amqplib.Message>({
            content: Buffer.from('test'),
            properties: {
              headers: {
                'x-death': [
                  {
                    count: 3,
                    reason: 'rejected',
                    queue: 'test',
                    'routing-keys': ['routing'],
                    exchange: 'exchange',
                    time: { '!': 'timestamp', value: 100 },
                  },
                ],
              },
            },
          }),
        ),
    }),
    close: jest.fn(),
  });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        RabbitMQModule.forRoot({
          host: '0.0.0.0',
          username: 'test',
          password: 'test',
          retry: 3,
          queues: [
            {
              name: 'test',
              exchange: 'exchange',
              exchangeType: 'topic',
              routingKey: 'routing',
              ttl: 1000,
            },
          ],
        }),
      ],
      providers: [ListenerError],
    }).compile();
    moduleRef.init();
  });

  afterAll(() => moduleRef.close());
  afterEach(() => jest.clearAllMocks());

  it('when a message has already been sent more than three times it must go to the dlq', () => {
    expect(mockSendToQueue).toBeCalledTimes(1);
    expect(mockReject).toBeCalledTimes(1);
    expect(mockAck).not.toBeCalled();
  });
});
