import { api, formatPrice } from '../api.js';
import { initLayout, showMessage } from '../layout.js';

const form = document.querySelector('[data-testid="filters"]');
const list = document.querySelector('[data-testid="product-list"]');
const count = document.querySelector('[data-testid="result-count"]');
const categorySelect = document.querySelector('[data-testid="category-select"]');

function productCard(product) {
  const li = document.createElement('li');
  li.className = 'card';
  li.dataset.testid = 'product-card';
  li.dataset.sku = product.sku;

  const img = document.createElement('img');
  img.src = product.image;
  img.alt = '';
  img.width = 200;
  img.height = 140;

  const title = document.createElement('h2');
  const link = document.createElement('a');
  link.href = `/product?id=${product.id}`;
  link.textContent = product.name; // textContent, never innerHTML, for anything from the API
  link.dataset.testid = 'product-link';
  title.append(link);

  const price = document.createElement('p');
  price.className = 'price';
  price.dataset.testid = 'product-price';
  price.textContent = formatPrice(product.priceCents);

  const stock = document.createElement('p');
  stock.dataset.testid = 'product-stock';
  stock.textContent = product.inStock ? `${product.stock} in stock` : 'Out of stock';
  if (!product.inStock) stock.className = 'stock-out';

  li.append(img, title, price, stock);
  return li;
}

async function loadProducts() {
  const params = new URLSearchParams(new FormData(form));
  try {
    const { items, total } = await api(`/products?${params}`);
    list.replaceChildren(...items.map(productCard));
    count.textContent = total === 1 ? '1 product found' : `${total} products found`;
  } catch (err) {
    showMessage(`Could not load products: ${err.message}`);
  }
}

async function loadCategories() {
  try {
    const categories = await api('/products/categories');
    for (const c of categories) {
      const option = document.createElement('option');
      option.value = c;
      option.textContent = c.charAt(0).toUpperCase() + c.slice(1);
      categorySelect.append(option);
    }
  } catch {
    // Filters still work without the category list.
  }
}

// Restore filters from the URL so search results are linkable.
const initial = new URLSearchParams(window.location.search);
for (const [key, value] of initial) {
  if (form.elements[key]) form.elements[key].value = value;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const params = new URLSearchParams(new FormData(form));
  window.history.replaceState(null, '', `?${params}`);
  loadProducts();
});

initLayout();
await loadCategories();
if (initial.get('category')) categorySelect.value = initial.get('category');
await loadProducts();
