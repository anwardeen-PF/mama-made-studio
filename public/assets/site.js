async function loadProducts() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  try {
    const res = await fetch('/data/products.json');
    const data = await res.json();
    grid.innerHTML = data.products
      .map(
        (p) => `
      <article class="product-card">
        <div class="product-thumb"><img src="${p.image}" alt="${p.name}"></div>
        <div class="product-body">
          <h3>${p.name}</h3>
          <p>${p.tagline}</p>
          <div class="product-footer">
            <span class="price">$${(p.price_cents / 100).toFixed(2)}</span>
            <button class="add-btn" data-add="${p.id}">Add to cart</button>
          </div>
        </div>
      </article>`
      )
      .join('');

    grid.querySelectorAll('[data-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const product = data.products.find((p) => p.id === btn.getAttribute('data-add'));
        if (product) addToCart(product);
        openCart();
      });
    });
  } catch (err) {
    grid.innerHTML = '<p class="cart-empty">Products are taking a quick nap — refresh in a moment.</p>';
  }
}

document.addEventListener('DOMContentLoaded', loadProducts);
