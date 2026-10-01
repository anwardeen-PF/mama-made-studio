async function loadOrder() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');
  const heading = document.getElementById('status-heading');
  const copy = document.getElementById('status-copy');
  const downloadsEl = document.getElementById('downloads');

  if (!sessionId) {
    heading.textContent = "We couldn't find that order.";
    copy.textContent = 'If you just paid, check your email receipt for a link, or contact us.';
    return;
  }

  try {
    const res = await fetch(`/api/order-status?session_id=${encodeURIComponent(sessionId)}`);
    const data = await res.json();
    if (!data.paid) {
      heading.textContent = 'Payment not confirmed yet.';
      copy.textContent = 'If you just completed checkout, refresh this page in a few seconds.';
      return;
    }
    heading.textContent = 'Thank you! Your downloads are ready.';
    copy.textContent = 'Click each file below to save it. Links work for this device and session.';
    downloadsEl.innerHTML = data.items
      .map(
        (item) => `
        <article class="product-card">
          <div class="product-body">
            <h3>${item.name}</h3>
            <p>Quantity: ${item.qty}</p>
            <a class="add-btn download-link" href="${item.download_url}">Download</a>
          </div>
        </article>`
      )
      .join('');
  } catch (err) {
    heading.textContent = 'Something went wrong loading your order.';
    copy.textContent = 'Please refresh, or contact us with your receipt email.';
  }
}

document.addEventListener('DOMContentLoaded', loadOrder);
