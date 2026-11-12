const pricing = require('../../src/services/pricing');

describe('pricing', () => {
  describe('subtotal', () => {
    it('returns 0 for an empty cart', () => {
      expect(pricing.subtotal([])).toBe(0);
    });

    it('multiplies quantity by unit price and sums the lines', () => {
      const lines = [
        { quantity: 2, unitPriceCents: 1299 },
        { quantity: 1, unitPriceCents: 2999 },
      ];
      expect(pricing.subtotal(lines)).toBe(5597);
    });

    it.each([0, -1, 1.5, '2', null])('rejects invalid quantity %p', (quantity) => {
      expect(() => pricing.subtotal([{ quantity, unitPriceCents: 100 }])).toThrow(RangeError);
    });

    it.each([0, -100, 9.99])('rejects invalid price %p', (unitPriceCents) => {
      expect(() => pricing.subtotal([{ quantity: 1, unitPriceCents }])).toThrow(/Invalid price/);
    });
  });

  describe('shipping (boundary values around the free-shipping threshold)', () => {
    const threshold = pricing.FREE_SHIPPING_THRESHOLD_CENTS;

    it.each([
      [0, 0],
      [1, pricing.SHIPPING_CENTS],
      [threshold - 1, pricing.SHIPPING_CENTS],
      [threshold, 0],
      [threshold + 1, 0],
    ])('subtotal %i -> shipping %i', (subtotal, expected) => {
      expect(pricing.shipping(subtotal)).toBe(expected);
    });
  });

  describe('total', () => {
    it('adds shipping below the threshold', () => {
      expect(pricing.total([{ quantity: 1, unitPriceCents: 1299 }])).toEqual({
        subtotalCents: 1299,
        shippingCents: 499,
        totalCents: 1798,
      });
    });

    it('gives free shipping at or above the threshold', () => {
      expect(pricing.total([{ quantity: 2, unitPriceCents: 2500 }]).totalCents).toBe(5000);
    });
  });

  it('formats cents as US dollars', () => {
    expect(pricing.formatPrice(123456)).toBe('$1,234.56');
    expect(pricing.formatPrice(5)).toBe('$0.05');
  });
});
