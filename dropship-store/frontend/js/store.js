const grid = document.getElementById('product-grid');
const searchInput = document.getElementById('search-input');
const categorySelect = document.getElementById('category-select');

let debounceTimer;

async function loadProducts() {
  grid.innerHTML = '<p class="eyebrow">Loading manifest…</p>';
  const params = new URLSearchParams();
  if (searchInput.value) params.set('search', searchInput.value);
  if (categorySelect.value) params.set('category', categorySelect.value);

  try {
    const { products } = await apiFetch(`/api/products?${params.toString()}`);
    renderProducts(products);
    populateCategories(products);
  } catch (err) {
    grid.innerHTML = `<p class="error-text">Couldn't load products: ${err.message}</p>`;
  }
}

function renderProducts(products) {
  if (!products.length) {
    grid.innerHTML = '<p class="eyebrow">No items match — try a different search.</p>';
    return;
  }
  grid.innerHTML = products.map((p, i) => `
    <a class="product-card" href="/product.html?id=${p.id}">
      <span class="manifest-tag">No. ${String(p.id).padStart(4, '0')}</span>
      <img src="${p.image_url || 'https://placehold.co/400x400?text=No+Image'}" alt="${escapeHtml(p.title)}">
      <div class="card-body">
        <div class="card-title">${escapeHtml(p.title)}</div>
        <div class="card-price">$${parseFloat(p.sale_price).toFixed(2)}</div>
      </div>
    </a>
  `).join('');
}

function populateCategories(products) {
  const current = categorySelect.value;
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
  categorySelect.innerHTML = '<option value="">All categories</option>' +
    categories.map((c) => `<option value="${c}" ${c === current ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
}

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadProducts, 300);
});
categorySelect.addEventListener('change', loadProducts);

loadProducts();
