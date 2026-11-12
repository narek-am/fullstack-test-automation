import { api, formatPrice } from '../api.js';
import { initLayout, requireLogin, showMessage } from '../layout.js';

const $ = (id) => document.querySelector(`[data-testid="${id}"]`);

async function load() {
  const placed = new URLSearchParams(window.location.search).get('placed');
  if (placed) showMessage(`Thank you! Order #${Number(placed)} has been placed.`, 'success');
  try {
    const orders = await api('/orders');
    $('orders-empty').classList.toggle('hidden', orders.length > 0);
    $('orders-table').classList.toggle('hidden', orders.length === 0);
    $('orders-list').replaceChildren(...orders.map((order) => {
      const tr = document.createElement('tr');
      tr.dataset.testid = 'order-row';
      const cells = [
        `#${order.id}`,
        order.status,
        order.items.map((i) => `${i.quantity} × ${i.name}`).join(', '),
        formatPrice(order.totalCents),
      ];
      for (const text of cells) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.append(td);
      }
      return tr;
    }));
  } catch (err) {
    showMessage(err.message);
  }
}

initLayout();
if (requireLogin()) load();
