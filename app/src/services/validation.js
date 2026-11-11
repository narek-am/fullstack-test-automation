class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.field = field;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireEmail(value) {
  if (typeof value !== 'string' || !EMAIL_RE.test(value) || value.length > 254) {
    throw new ValidationError('A valid email is required', 'email');
  }
  return value.trim().toLowerCase();
}

function requireString(value, field, { min = 1, max = 200 } = {}) {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    throw new ValidationError(`${field} must be a string of ${min}-${max} characters`, field);
  }
  return value;
}

function requirePositiveInt(value, field, { max = 99 } = {}) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(n) || n <= 0 || n > max) {
    throw new ValidationError(`${field} must be an integer between 1 and ${max}`, field);
  }
  return n;
}

module.exports = { ValidationError, requireEmail, requireString, requirePositiveInt };
