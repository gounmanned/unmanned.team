// Adds a Copy button to each block the reader pastes back into the app (pre.paste).
document.querySelectorAll('pre.paste').forEach((pre) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy';
  button.textContent = 'Copy';
  button.setAttribute('aria-live', 'polite');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pre.querySelector('code').textContent);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Select and copy';
    }
    clearTimeout(button.reset);
    button.reset = setTimeout(() => { button.textContent = 'Copy'; }, 2000);
  });
  pre.appendChild(button);
});
