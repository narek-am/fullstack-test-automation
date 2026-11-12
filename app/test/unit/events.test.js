const { EventBus } = require('../../src/services/events');

describe('EventBus', () => {
  it('records history, notifies listeners and forwards to publishers', async () => {
    const bus = new EventBus();
    const listener = jest.fn();
    const publisher = { publish: jest.fn().mockResolvedValue() };
    bus.on('order.created', listener);
    bus.addPublisher(publisher);

    const event = await bus.publish('order.created', { orderId: 7 });

    expect(event).toMatchObject({ type: 'order.created', payload: { orderId: 7 } });
    expect(new Date(event.occurredAt).toString()).not.toBe('Invalid Date');
    expect(bus.history).toEqual([event]);
    expect(listener).toHaveBeenCalledWith(event);
    expect(publisher.publish).toHaveBeenCalledWith(event);
  });

  it('propagates publisher failures to the caller', async () => {
    const bus = new EventBus();
    bus.addPublisher({ publish: () => Promise.reject(new Error('broker down')) });
    await expect(bus.publish('order.created', {})).rejects.toThrow('broker down');
  });
});
