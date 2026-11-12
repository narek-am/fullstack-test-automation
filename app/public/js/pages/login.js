import { api, session } from '../api.js';
import { initLayout, showMessage } from '../layout.js';

const form = document.querySelector('[data-testid="login-form"]');

function safeNext() {
  // Only allow same-site relative redirects (prevents open-redirect via ?next=).
  const next = new URLSearchParams(window.location.search).get('next') || '/';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  if (!email || !password) {
    showMessage('Please enter your email and password.');
    return;
  }
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  try {
    const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
    session.save(token, user);
    window.location.href = safeNext();
  } catch (err) {
    showMessage(err.status === 429 ? 'Too many attempts. Please wait a minute.' : err.message);
    button.disabled = false;
  }
});

if (new URLSearchParams(window.location.search).get('expired') === '1') {
  showMessage('Your session has expired. Please log in again.');
}

initLayout();
