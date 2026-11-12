import { api, formatPrice } from '../api.js';
import { initLayout, refreshCartCount, requireLogin, showMessage } from '../layout.js';

const $ = (id) => document.querySelector(`[data-testid="${id}"]`);

function row(item) {
  const tr = document.createElement('tr');
  tr.dataset.testid = 'cart-item';
  tr.dataset.productId = item.productId;

  const name = document.createElement('td');
  const link = document.createElement('a');
  link.href = `/product?id=${item.productId}`;
  link.textContent = item.name;
  name.append(link);

  const price = document.createElement('td');
  price.textContent = formatPrice(item.unitPriceCents);

  const qty = document.createElement('td');
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '1';
  input.max = String(item.stock);
  input.value = String(item.quantity);
  input.dataset.testid = 'cart-item-quantity';
  input.setAttribute('aria-label', `Quantity of ${item.name}`);
  input.addEventListener('change', () => update(item.productId, Number(input.value)));
  qty.append(input);

  const line = document.createElement('td');
  line.dataset.testid = 'cart-item-total';
  line.textContent = formatPrice(item.unitPriceCents * item.quantity);

  const actions = document.createElement('td');
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'button secondary';
  remove.textContent = 'Remove';
  remove.dataset.testid = 'cart-item-remove';
  remove.setAttribute('aria-label', `Remove ${item.name}`);
  remove.addEventListener('click', () => removeItem(item.productId));
  actions.append(remove);

  tr.append(name, price, qty, line, actions);
  return tr;
}

function render(cart) {
  const empty = cart.items.length === 0;
  $('cart-empty').classList.toggle('hidden', !empty);
  $('cart-contents').classList.toggle('hidden', empty);
  $('cart-items').replaceChildren(...cart.items.map(row));
  $('cart-subtotal').textContent = formatPrice(cart.subtotalCents);
  $('cart-shipping').textContent = cart.shippingCents === 0 ? 'Free' : formatPrice(cart.shippingCents);
  $('cart-total').textContent = formatPrice(cart.totalCents);
  refreshCartCount();
}

async function load() {
  try { render(await api('/cart')); } catch (err) { showMessage(err.message); }
}

async function update(productId, quantity) {
  try {
    render(await api(`/cart/items/${productId}`, { method: 'PUT', body: { quantity } }));
  } catch (err) {
    showMessage(err.message);
    load();
  }
}

async function removeItem(productId) {
  try { render(await api(`/cart/items/${productId}`, { method: 'DELETE' })); } catch (err) { showMessage(err.message); }
}

$('checkout-button').addEventListener('click', async () => {
  try {
    const order = await api('/orders', { method: 'POST' });
    window.location.href = `/orders?placed=${order.id}`;
  } catch (err) {
    showMessage(err.message);
  }
});

initLayout();
if (requireLogin()) load();
