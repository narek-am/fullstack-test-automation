const { requireEmail, requireString, requirePositiveInt, ValidationError } = require('../../src/services/validation');

describe('validation', () => {
  describe('requireEmail', () => {
    it('normalises case and whitespace', () => {
      expect(requireEmail('Alice@ShopLite.Test')).toBe('alice@shoplite.test');
    });

    it.each(['', 'alice', 'alice@', '@shoplite.test', 'a b@c.d', 42, null, undefined, `${'a'.repeat(250)}@x.io`])(
      'rejects %p',
      (value) => {
        expect(() => requireEmail(value)).toThrow(ValidationError);
      },
    );
  });

  describe('requireString', () => {
    it('accepts strings inside the length range', () => {
      expect(requireString('abc', 'name', { min: 1, max: 3 })).toBe('abc');
    });

    it('reports the offending field', () => {
      try {
        requireString('', 'password');
        throw new Error('expected a ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.field).toBe('password');
        expect(err.status).toBe(400);
      }
    });

    it('rejects values that are too long or not strings', () => {
      expect(() => requireString('abcd', 'x', { max: 3 })).toThrow(ValidationError);
      expect(() => requireString(['a'], 'x')).toThrow(ValidationError);
    });
  });

  describe('requirePositiveInt', () => {
    it('parses numeric strings such as route params', () => {
      expect(requirePositiveInt('7', 'id')).toBe(7);
    });

    it.each([0, -3, 1.2, '1e2', 'abc', '', ' ', 100, NaN, Infinity])('rejects %p (max 99)', (value) => {
      expect(() => requirePositiveInt(value, 'quantity')).toThrow(ValidationError);
    });

    // Found by the security tests: Number() accepted these, so /api/products/0x01 returned product 1.
    it.each(['0x01', '0b1', '0o7', '1e1', ' 7', '7 ', '+7', '7.0'])('rejects the non-decimal string %p', (value) => {
      expect(() => requirePositiveInt(value, 'id', { max: 1000 })).toThrow(ValidationError);
    });
  });
});
