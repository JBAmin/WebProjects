const container = document.getElementById('product-detail');
const productId = new URLSearchParams(window.location.search).get('id');

async function loadProduct() {
  if (!productId) {
    container.innerHTML = '<p class="error-text">No product specified.</p>';
    return;
  }
  try {
    const { product } = await apiFetch(`/api/products/${productId}`);
    render(product);
  } catch (err) {
    container.innerHTML = `<p class="error-text">${err.message}</p>`;
  }
}

function render(p) {
  const shipping = p.shipping_info || {};
  container.innerHTML = `
    <img src="${p.image_url || 'https://placehold.co/500x500?text=No+Image'}" alt="${p.title}">
    <div>
      <p class="eyebrow">Item No. ${String(p.id).padStart(4, '0')} · ${p.category || 'Uncategorized'}</p>
      <h1>${p.title}</h1>
      <div class="price">$${parseFloat(p.sale_price).toFixed(2)}</div>
      <p>${p.description || 'No description provided for this item yet.'}</p>
      <div style="display:flex; align-items:center; gap:0.8rem; margin: 1rem 0;">
        <label for="qty" style="font-size:0.85rem;">Qty</label>
        <input type="number" id="qty" value="1" min="1" style="width:60px; padding:0.5rem; border:1px solid var(--line); border-radius:4px;">
      </div>
      <button class="btn btn-primary btn-block" id="add-to-cart-btn">Add to cart</button>
      <p class="shipping-note">
        ${shipping.days ? `Estimated delivery: ${shipping.days} days.` : 'Shipping estimate provided at checkout.'}
        ${p.source === 'aliexpress' ? ' Ships directly from our supplier network.' : ''}
      </p>
    </div>
  `;

  document.getElementById('add-to-cart-btn').addEventListener('click', () => {
    const qty = parseInt(document.getElementById('qty').value) || 1;
    addToCart(p.id, qty);
    window.location.href = '/cart.html';
  });
}

loadProduct();
