// Adds a Copy button to everything the reader pastes somewhere else (.paste): inside a block, or after an inline value.
document.querySelectorAll('.paste').forEach((el) => {
  const text = (el.querySelector('code') || el).textContent.trim();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = el.tagName === 'PRE' ? 'copy' : 'copy copy--inline';
  button.textContent = 'Copy';
  button.setAttribute('aria-live', 'polite');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Select and copy';
    }
    clearTimeout(button.reset);
    button.reset = setTimeout(() => { button.textContent = 'Copy'; }, 2000);
  });
  if (el.tagName === 'PRE') el.appendChild(button);
  else el.after(button);
});
