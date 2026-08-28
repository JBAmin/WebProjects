const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');

function checkAuth() {
  const token = localStorage.getItem('admin_token');
  loginView.style.display = token ? 'none' : 'block';
  dashboardView.style.display = token ? 'block' : 'none';
  if (token) { loadProducts(); loadOrders(); }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  try {
    const { token } = await apiFetch('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('admin-email').value,
        password: document.getElementById('admin-password').value,
      }),
    });
    localStorage.setItem('admin_token', token);
    checkAuth();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    ['import', 'products', 'orders'].forEach((tab) => {
      document.getElementById(`tab-${tab}`).style.display = tab === btn.dataset.tab ? 'block' : 'none';
    });
  });
});

// ---------- Manual product add ----------
document.getElementById('manual-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await apiFetch('/api/products', {
      method: 'POST',
      body: JSON.stringify({
        title: document.getElementById('m-title').value,
        description: document.getElementById('m-description').value,
        category: document.getElementById('m-category').value,
        cost_price: parseFloat(document.getElementById('m-cost').value) || 0,
        sale_price: parseFloat(document.getElementById('m-price').value),
        image_url: document.getElementById('m-image').value,
        stock: parseInt(document.getElementById('m-stock').value) || 0,
      }),
    });
    e.target.reset();
    loadProducts();
    alert('Product added.');
  } catch (err) {
    alert(err.message);
  }
});

// ---------- AliExpress import ----------
document.getElementById('ali-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const resultEl = document.getElementById('import-result');
  resultEl.textContent = 'Importing…';
  try {
    const { product } = await apiFetch('/api/products/import-aliexpress', {
      method: 'POST',
      body: JSON.stringify({
        url: document.getElementById('a-url').value,
        sale_price: parseFloat(document.getElementById('a-price').value),
        category: document.getElementById('a-category').value,
      }),
    });
    resultEl.textContent = `Imported: ${product.title}`;
    e.target.reset();
    loadProducts();
  } catch (err) {
    resultEl.textContent = `Failed: ${err.message}`;
  }
});

// ---------- Products table ----------
async function loadProducts() {
  const tbody = document.querySelector('#products-table tbody');
  try {
    const { products } = await apiFetch('/api/products?limit=100');
    tbody.innerHTML = products.map((p) => `
      <tr>
        <td>${p.id}</td>
        <td>${p.title}</td>
        <td>${p.source || '-'}</td>
        <td>$${parseFloat(p.sale_price).toFixed(2)}</td>
        <td>${p.stock}</td>
        <td>
          <button class="btn btn-secondary" data-toggle="${p.id}" data-active="${p.is_active !== false}">
            ${p.is_active !== false ? 'Deactivate' : 'Reactivate'}
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.toggle;
        const isActive = btn.dataset.active === 'true';
        if (isActive) await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
        else await apiFetch(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify({ is_active: true }) });
        loadProducts();
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">${err.message}</td></tr>`;
  }
}

// ---------- Orders table ----------
async function loadOrders() {
  const tbody = document.querySelector('#orders-table tbody');
  try {
    const { orders } = await apiFetch('/api/admin/orders');
    tbody.innerHTML = orders.map((o) => `
      <tr>
        <td>#${o.id}</td>
        <td>${o.customer_name}</td>
        <td>$${parseFloat(o.total).toFixed(2)}</td>
        <td><span class="status-pill ${o.status}">${o.status.replace('_', ' ')}</span></td>
        <td>
          ${o.status === 'paid' ? `<button class="btn btn-primary" data-fulfill="${o.id}">Fulfill via AliExpress</button>` : '—'}
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-fulfill]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.textContent = 'Placing order…';
        try {
          const { results } = await apiFetch(`/api/admin/orders/${btn.dataset.fulfill}/fulfill`, { method: 'POST' });
          alert(`Fulfillment attempted: ${JSON.stringify(results)}`);
          loadOrders();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">${err.message}</td></tr>`;
  }
}

checkAuth();
