// Deterministic seed data. Test suites rely on these values, so change them with care.
module.exports = {
  users: [
    { email: 'alice@shoplite.test', name: 'Alice Customer', password: 'Passw0rd!', role: 'customer' },
    { email: 'bob@shoplite.test', name: 'Bob Customer', password: 'Passw0rd!', role: 'customer' },
    { email: 'admin@shoplite.test', name: 'Ada Admin', password: 'Adm1nPass!', role: 'admin' },
  ],
  products: [
    { sku: 'BK-001', name: 'Testing Handbook', description: 'A practical guide to software testing.', category: 'books', priceCents: 2999, stock: 25, image: '/img/book.svg' },
    { sku: 'BK-002', name: 'Clean Pipelines', description: 'Continuous delivery patterns explained.', category: 'books', priceCents: 3499, stock: 10, image: '/img/book.svg' },
    { sku: 'MG-001', name: 'Bug Hunter Mug', description: 'Ceramic mug, 350 ml.', category: 'merch', priceCents: 1299, stock: 50, image: '/img/mug.svg' },
    { sku: 'TS-001', name: 'Green Build T-Shirt', description: '100% cotton, unisex fit.', category: 'merch', priceCents: 1999, stock: 5, image: '/img/shirt.svg' },
    { sku: 'KB-001', name: 'Mechanical Keyboard', description: 'Tactile switches, USB-C.', category: 'hardware', priceCents: 8999, stock: 3, image: '/img/keyboard.svg' },
    { sku: 'HD-001', name: 'Noise-Cancelling Headphones', description: 'Focus mode for long test runs.', category: 'hardware', priceCents: 14999, stock: 0, image: '/img/headphones.svg' },
  ],
};
