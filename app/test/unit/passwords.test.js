const { hashPassword, verifyPassword } = require('../../src/services/passwords');

describe('password hashing', () => {
  it('never stores the plain text password', () => {
    const hash = hashPassword('Passw0rd!');
    expect(hash).not.toContain('Passw0rd!');
    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);
  });

  it('uses a random salt, so equal passwords get different hashes', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });

  it('verifies the right password and rejects a wrong one', () => {
    const hash = hashPassword('correct horse');
    expect(verifyPassword('correct horse', hash)).toBe(true);
    expect(verifyPassword('Correct horse', hash)).toBe(false);
  });

  it.each(['', 'nocolon', ':', 'zz:zz'])('handles a malformed stored hash %p safely', (stored) => {
    expect(verifyPassword('anything', stored)).toBe(false);
  });
});
