const API_BASE = ''; // same-origin, since Express serves both API and frontend

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('admin_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token && path.startsWith('/api/admin')) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------- Cart helpers (persisted in localStorage) ----------
function getCart() {
  return JSON.parse(localStorage.getItem('cart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(productId, quantity = 1) {
  const cart = getCart();
  const existing = cart.find((i) => i.product_id === productId);
  if (existing) existing.quantity += quantity;
  else cart.push({ product_id: productId, quantity });
  saveCart(cart);
}

function updateCartQuantity(productId, quantity) {
  let cart = getCart();
  if (quantity <= 0) cart = cart.filter((i) => i.product_id !== productId);
  else cart.forEach((i) => { if (i.product_id === productId) i.quantity = quantity; });
  saveCart(cart);
}

function clearCart() {
  localStorage.removeItem('cart');
  updateCartBadge();
}

function updateCartBadge() {
  const el = document.getElementById('cart-count');
  if (!el) return;
  const count = getCart().reduce((sum, i) => sum + i.quantity, 0);
  el.textContent = count;
  el.style.display = count > 0 ? 'inline-block' : 'none';
}

document.addEventListener('DOMContentLoaded', updateCartBadge);
