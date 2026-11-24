// Adds a copy icon button to everything the reader pastes somewhere else (.paste): beside a block, or after an inline value.
const status = document.createElement('span');
status.className = 'visually-hidden';
status.setAttribute('role', 'status');
document.body.append(status);

document.querySelectorAll('.paste').forEach((el) => {
  const block = el.tagName === 'PRE';
  let body = block ? el.querySelector('code') : el;
  if (!body) {                       // a block without <code>: wrap its text so it can sit beside the button
    body = document.createElement('span');
    body.append(...el.childNodes);
    el.append(body);
  }
  const text = body.textContent.trim();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = block ? 'copy' : 'copy copy--inline';
  button.setAttribute('aria-label', 'Copy to clipboard');
  button.dataset.tip = 'Copy';
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      button.dataset.tip = 'Copied';
      status.textContent = 'Copied to clipboard';
    } catch {
      button.dataset.tip = 'Select and copy';
    }
    button.classList.add('is-copied');
    clearTimeout(button.reset);
    button.reset = setTimeout(() => {
      button.classList.remove('is-copied');
      button.dataset.tip = 'Copy';
      status.textContent = '';
    }, 1600);
  });
  if (block) el.append(button);
  else el.after(button);
});
