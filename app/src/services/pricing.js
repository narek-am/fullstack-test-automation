// Pure functions, covered by unit tests.

const FREE_SHIPPING_THRESHOLD_CENTS = 5000;
const SHIPPING_CENTS = 499;

function subtotal(lines) {
  return lines.reduce((sum, line) => {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new RangeError(`Invalid quantity: ${line.quantity}`);
    }
    if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents <= 0) {
      throw new RangeError(`Invalid price: ${line.unitPriceCents}`);
    }
    return sum + line.quantity * line.unitPriceCents;
  }, 0);
}

function shipping(subtotalCents) {
  if (subtotalCents === 0) return 0;
  return subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_CENTS;
}

function total(lines) {
  const sub = subtotal(lines);
  return { subtotalCents: sub, shippingCents: shipping(sub), totalCents: sub + shipping(sub) };
}

function formatPrice(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

module.exports = { subtotal, shipping, total, formatPrice, FREE_SHIPPING_THRESHOLD_CENTS, SHIPPING_CENTS };
