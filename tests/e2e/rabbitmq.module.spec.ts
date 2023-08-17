import { createMock } from '@golevelup/ts-jest';
import { Injectable } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as amqplib from 'amqplib';

import { RabbitMQModule, Listener } from '../../src';
import { rejects } from 'assert';

const mockConnect = jest.fn();
const mockAssertExchange = jest.fn();
const mockAssertQueue = jest.fn();
const mockPrefetch = jest.fn();
const mockBindQueue = jest.fn();
const mockAck = jest.fn();
const mockSendToQueue = jest.fn();

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
  @Listener('queue', 'master')
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
        RabbitMQModule.forRoot('0.0.0.0', 'test', 'test', 5, [
          {
            name: 'test',
            routingKey: 'routing',
            exchange: {
              name: 'exchange',
              type: 'topic',
            },
            ttl: 1000,
          },
        ]),
      ],
      providers: [ListenerSuccess, ListenerError],
    }).compile();
    moduleRef.init();
  });

  afterAll(() => moduleRef.close());
  afterEach(() => jest.clearAllMocks());

  it('when initializing the module it must trigger all the actions of creating and linking queues', () => {
    expect(mockPrefetch).toBeCalledTimes(2);
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
        RabbitMQModule.forRoot(
          '0.0.0.0',
          'test',
          'test',
          3,
          [
            {
              name: 'test',
              routingKey: 'routing',
              exchange: {
                name: 'exchange',
                type: 'topic',
              },
              ttl: 1000,
            },
          ],
          [{ name: 'master', prefetch: 10, concurrency: 1, primary: true }],
        ),
      ],
      providers: [ListenerError],
    }).compile();
    moduleRef.init();
  });

  afterAll(() => moduleRef.close());
  afterEach(() => jest.clearAllMocks());

  it('when a message has already been sent more than three times it must go to the dlq', () => {
    expect(mockSendToQueue).toBeCalledTimes(1);
    expect(mockAck).toBeCalledTimes(1);
  });
});

describe('Testing e2e RabbitMQModule init', () => {
  mockConnect.mockRejectedValueOnce(new Error('test'));

  afterEach(() => jest.clearAllMocks());

  it('test', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        RabbitMQModule.forRoot(
          '0.0.0.0',
          'test',
          'test',
          3,
          [],
          [{ name: 'master', prefetch: 10, concurrency: 1, primary: false }],
        ),
      ],
      providers: [ListenerError],
    }).compile();
    await expect(() => moduleRef.init()).rejects.toThrowError(
      'One of the channels to be created needs to be the primary channel.',
    );
  });

  it('test 2', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RabbitMQModule.forRoot('0.0.0.0', 'test', 'test')],
      providers: [ListenerError],
    }).compile();
    await expect(() => moduleRef.init()).rejects.toThrowError();
  });
});
