const stripe = Stripe(window.STRIPE_PUBLISHABLE_KEY);
const elements = stripe.elements();
const cardElement = elements.create('card');
cardElement.mount('#card-element');

const form = document.getElementById('checkout-form');
const payBtn = document.getElementById('pay-btn');
const errorEl = document.getElementById('payment-error');
const summaryEl = document.getElementById('order-summary');

let cartItems = getCart();

async function renderSummary() {
  if (!cartItems.length) {
    summaryEl.innerHTML = '<p class="eyebrow">Your cart is empty.</p>';
    payBtn.disabled = true;
    return;
  }
  const products = await Promise.all(
    cartItems.map((i) => apiFetch(`/api/products/${i.product_id}`).then((r) => r.product))
  );
  let subtotal = 0;
  const rows = cartItems.map((item, i) => {
    const p = products[i];
    const lineTotal = p.sale_price * item.quantity;
    subtotal += lineTotal;
    return `<div class="row"><span>${p.title} × ${item.quantity}</span><span>$${lineTotal.toFixed(2)}</span></div>`;
  }).join('');

  summaryEl.innerHTML = `${rows}<div class="row total"><span>Total</span><span>$${subtotal.toFixed(2)}</span></div>`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  payBtn.disabled = true;
  payBtn.textContent = 'Processing…';

  try {
    const { clientSecret, orderId } = await apiFetch('/api/checkout/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({
        items: cartItems,
        customer: { name: document.getElementById('name').value, email: document.getElementById('email').value },
        shipping_address: {
          line1: document.getElementById('line1').value,
          city: document.getElementById('city').value,
          state: document.getElementById('state').value,
          postal_code: document.getElementById('postal_code').value,
          country: document.getElementById('country').value.toUpperCase(),
        },
      }),
    });

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: { name: document.getElementById('name').value, email: document.getElementById('email').value },
      },
    });

    if (error) throw new Error(error.message);

    if (paymentIntent.status === 'succeeded') {
      clearCart();
      document.querySelector('.checkout-grid').style.display = 'none';
      const confirmation = document.getElementById('confirmation');
      confirmation.style.display = 'block';
      confirmation.innerHTML = `
        <div class="success-box">
          Payment received — order #${orderId} is confirmed. A confirmation has been sent to your email.
        </div>`;
    }
  } catch (err) {
    errorEl.textContent = err.message;
    payBtn.disabled = false;
    payBtn.textContent = 'Pay & place order';
  }
});

renderSummary();
