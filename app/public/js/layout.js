import { api, session } from './api.js';

// Shared header behaviour: login/logout links and the cart badge.
export async function initLayout() {
  const loginLink = document.querySelector('[data-testid="nav-login"]');
  const logoutButton = document.querySelector('[data-testid="nav-logout"]');
  const ordersLink = document.querySelector('[data-testid="nav-orders"]');
  const greeting = document.querySelector('[data-testid="nav-greeting"]');
  const user = session.user;

  loginLink.parentElement.classList.toggle('hidden', Boolean(user));
  logoutButton.parentElement.classList.toggle('hidden', !user);
  ordersLink.parentElement.classList.toggle('hidden', !user);
  greeting.textContent = user ? `Hi, ${user.name.split(' ')[0]}` : '';

  logoutButton.addEventListener('click', async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* token may already be gone */ }
    session.clear();
    window.location.href = '/';
  });

  await refreshCartCount();
}

export async function refreshCartCount() {
  const badge = document.querySelector('[data-testid="cart-count"]');
  if (!session.token) {
    badge.textContent = '0';
    return;
  }
  try {
    const cart = await api('/cart');
    badge.textContent = String(cart.items.reduce((n, item) => n + item.quantity, 0));
  } catch {
    badge.textContent = '0';
  }
}

export function showMessage(text, type = 'error') {
  const el = document.querySelector('[data-testid="message"]');
  el.className = `alert ${type}`;
  el.textContent = text;
}

export function requireLogin() {
  if (!session.token) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?next=${next}`;
    return false;
  }
  return true;
}
