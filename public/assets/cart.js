const CART_KEY = 'mms_cart_v1';

function readCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function writeCart(items) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable (private window, blocked) — cart just won't persist */
  }
  renderCart();
}

function addToCart(product) {
  const items = readCart();
  const existing = items.find((i) => i.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    items.push({
      id: product.id,
      name: product.name,
      price_cents: product.price_cents,
      image: product.image,
      qty: 1,
    });
  }
  writeCart(items);
}

function removeFromCart(id) {
  writeCart(readCart().filter((i) => i.id !== id));
}

function cartTotalCents(items) {
  return items.reduce((sum, i) => sum + i.price_cents * i.qty, 0);
}

function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function renderCart() {
  const items = readCart();
  const countEl = document.getElementById('cart-count');
  const listEl = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  const checkoutBtn = document.getElementById('checkout-btn');
  if (!countEl || !listEl || !totalEl || !checkoutBtn) return;

  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
  countEl.textContent = String(totalQty);

  if (items.length === 0) {
    listEl.innerHTML = '<p class="cart-empty">Your cart is empty — add something cute!</p>';
  } else {
    listEl.innerHTML = items
      .map(
        (i) => `
      <div class="cart-item">
        <img src="${i.image}" alt="">
        <div class="cart-item-info">
          <h4>${i.name}</h4>
          <span>${i.qty} × ${formatCents(i.price_cents)}</span>
        </div>
        <button class="remove-btn" data-remove="${i.id}">Remove</button>
      </div>`
      )
      .join('');
  }

  totalEl.textContent = formatCents(cartTotalCents(items));
  checkoutBtn.disabled = items.length === 0;

  listEl.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => removeFromCart(btn.getAttribute('data-remove')));
  });
}

function openCart() {
  document.getElementById('cart-drawer')?.classList.add('open');
  document.getElementById('scrim')?.classList.add('open');
}

function closeCart() {
  document.getElementById('cart-drawer')?.classList.remove('open');
  document.getElementById('scrim')?.classList.remove('open');
}

async function startCheckout() {
  const items = readCart();
  if (items.length === 0) return;
  const checkoutBtn = document.getElementById('checkout-btn');
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = 'Redirecting…';
  try {
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map((i) => ({ id: i.id, qty: i.qty })),
      }),
    });
    if (!res.ok) throw new Error('checkout session failed');
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error('no checkout url returned');
    }
  } catch (err) {
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = 'Checkout';
    alert('Something went wrong starting checkout. Please try again in a moment.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderCart();
  document.getElementById('cart-open')?.addEventListener('click', openCart);
  document.getElementById('cart-close')?.addEventListener('click', closeCart);
  document.getElementById('scrim')?.addEventListener('click', closeCart);
  document.getElementById('checkout-btn')?.addEventListener('click', startCheckout);
});
