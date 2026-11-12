import { api, formatPrice } from '../api.js';
import { initLayout, refreshCartCount, requireLogin, showMessage } from '../layout.js';

const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
const id = new URLSearchParams(window.location.search).get('id');

async function load() {
  try {
    const product = await api(`/products/${encodeURIComponent(id ?? '')}`);
    document.title = `${product.name} | ShopLite`;
    $('product-name').textContent = product.name;
    $('product-category').textContent = product.category;
    $('product-description').textContent = product.description;
    $('product-price').textContent = formatPrice(product.priceCents);
    $('product-stock').textContent = product.inStock ? `${product.stock} in stock` : 'Out of stock';
    $('product-image').src = product.image;
    $('product-image').alt = product.name;
    $('quantity-input').max = String(Math.max(product.stock, 1));
    $('add-to-cart').disabled = !product.inStock;
    $('product-detail').classList.remove('hidden');
  } catch (err) {
    showMessage(err.status === 404 || err.status === 400 ? 'Product not found.' : `Error: ${err.message}`);
  }
}

$('add-to-cart-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!requireLogin()) return;
  try {
    await api('/cart/items', { method: 'POST', body: { productId: Number(id), quantity: Number($('quantity-input').value) } });
    showMessage('Added to cart.', 'success');
    await refreshCartCount();
  } catch (err) {
    showMessage(err.message);
  }
});

initLayout();
load();
