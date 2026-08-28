const linesEl = document.getElementById('cart-lines');
const summaryWrap = document.getElementById('cart-summary-wrap');

async function loadCart() {
  const cart = getCart();
  if (!cart.length) {
    linesEl.innerHTML = '<p class="eyebrow">Your cart is empty. <a href="/">Browse the manifest →</a></p>';
    summaryWrap.innerHTML = '';
    return;
  }

  const products = await Promise.all(
    cart.map((item) => apiFetch(`/api/products/${item.product_id}`).then((r) => r.product).catch(() => null))
  );

  let subtotal = 0;
  linesEl.innerHTML = cart.map((item, i) => {
    const p = products[i];
    if (!p) return '';
    const lineTotal = p.sale_price * item.quantity;
    subtotal += lineTotal;
    return `
      <div class="cart-line">
        <img src="${p.image_url || 'https://placehold.co/64x64'}" alt="${p.title}">
        <div class="grow">
          <div>${p.title}</div>
          <div class="eyebrow">$${parseFloat(p.sale_price).toFixed(2)} each</div>
        </div>
        <input type="number" min="0" value="${item.quantity}" data-id="${p.id}" class="qty-input">
        <div style="width:70px; text-align:right; font-family: var(--font-mono);">$${lineTotal.toFixed(2)}</div>
      </div>
    `;
  }).join('');

  summaryWrap.innerHTML = `
    <div class="cart-summary">
      <div class="row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
      <div class="row"><span>Shipping</span><span>Calculated at checkout</span></div>
      <div class="row total"><span>Total</span><span>$${subtotal.toFixed(2)}</span></div>
      <a href="/checkout.html" class="btn btn-primary btn-block" style="margin-top:1rem;">Proceed to checkout</a>
    </div>
  `;

  document.querySelectorAll('.qty-input').forEach((input) => {
    input.addEventListener('change', (e) => {
      updateCartQuantity(parseInt(e.target.dataset.id), parseInt(e.target.value) || 0);
      loadCart();
    });
  });
}

loadCart();
