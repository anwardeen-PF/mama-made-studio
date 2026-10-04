document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-signup]').forEach((form) => {
    const msg = form.querySelector('.signup-msg');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.textContent = 'Subscribing…';
      try {
        const res = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email.value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'failed');
        msg.textContent = "You're on the list. Thank you!";
        form.email.value = '';
      } catch (err) {
        msg.textContent = err.message || 'Something went wrong, please try again.';
      }
    });
  });
});
