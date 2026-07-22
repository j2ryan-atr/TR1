const toggle = document.querySelector('.mobile-toggle');
const nav = document.querySelector('.nav');
if (toggle && nav) toggle.addEventListener('click', () => {
  nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', nav.classList.contains('open'));
});
document.querySelectorAll('[data-year]').forEach((element) => { element.textContent = new Date().getFullYear(); });
const form = document.querySelector('#consultation-form');
if (form) {
  const honeypot = form.querySelector('.honeypot');
  if (honeypot) honeypot.hidden = true;
  const status = document.querySelector('#form-status');
  const submitButton = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!form.action || form.action.includes('REPLACE')) {
      status.textContent = 'Online requests are not configured yet. Please call 702-800-9999.';
      status.className = 'form-status error';
      return;
    }
    if (!form.querySelector('[name="cf-turnstile-response"]')?.value) {
      status.textContent = 'Please complete the security check.';
      status.className = 'form-status error';
      return;
    }
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    status.textContent = 'Sending your request…';
    status.className = 'form-status';
    try {
      const response = await fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'We could not send your request.');
      form.reset();
      window.turnstile?.reset();
      status.textContent = 'Thank you. Your request was sent. The firm will contact you after an initial review.';
      status.className = 'form-status success';
    } catch (error) {
      status.textContent = `${error.message} Please call 702-800-9999 if the problem continues.`;
      status.className = 'form-status error';
      window.turnstile?.reset();
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
    }
  });
}
