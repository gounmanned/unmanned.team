/* Footer feedback: "What do you think?" with thumbs up and down (Figma 2675:63257).

   The vote is sent the moment a thumb is clicked. The popup (a bottom sheet on phones) is optional extra detail,
   sent with the same id so the two can be matched up. A page opts in with one script tag after its footer; this
   file adds everything else, so without JavaScript there are no dead buttons. Styles are in site.css. */
(function () {
  const footer = document.querySelector('footer');
  const links = footer && footer.querySelector('.flinks');
  if (!links) return;

  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzgLpFT1hnP1ArPuZgm8tZ_go-ZCxO9_sUHy3eX6nJ7G1uOTrN4xfmm4uJV7qhZ20Qs/exec';   // the Apps Script behind the feedback sheet; failures stay silent so a visitor never sees them
  const MAX = 500;
  const STORE = 'feedback:' + location.pathname;
  const STATIC = document.currentScript.src.replace(/[^/]*$/, '');
  const TITLES = {
    up: 'Thank you! What do you like? (optional)',
    down: 'Thank you. What didn’t you like? (optional)',
  };
  /* The chips, by the first part of the page's path. A page not listed here gets main. */
  const CHIPS = {
    main: {
      up: ['Easy to understand', 'Helpful', 'Trustworthy', 'Design', 'Other'],
      down: ['Hard to understand', 'Missing information', 'Incorrect', 'Not working', 'Design', 'Other'],
    },
    'how-it-works': {
      up: ['Easy to understand', 'Right amount of detail', 'Helpful', 'Trustworthy', 'Design', 'Other'],
      down: ['Not enough detail', 'Too much detail', 'Too technical', 'Not technical enough', 'Incorrect', 'Not working', 'Design', 'Other'],
    },
    api: {
      up: ['Easy to follow', 'Good examples', 'Complete', 'Design', 'Other'],
      down: ['Hard to follow', 'Missing information', 'Not enough examples', 'Incorrect', 'Not working', 'Other'],
    },
    detections: {
      up: ['Easy to search', 'Found what I needed', 'Trustworthy', 'Design', 'Other'],
      down: ['Hard to search', 'Didn’t find what I needed', 'Incorrect', 'Not working', 'Design', 'Other'],
    },
    exp: {   // the campaign pages
      up: ['Funny', 'Easy to understand', 'Made me want one', 'Design', 'Other'],
      down: ['Not funny', 'Hard to understand', 'Not for me', 'Design', 'Not working', 'Other'],
    },
  };
  const COPY = CHIPS[location.pathname.split('/')[1]] || CHIPS.main;

  /* ---------- Saved vote: only a convenience, so it must work when storage is blocked ---------- */
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ id: state.id, vote: state.vote })); } catch (e) { /* not kept */ }
  }
  const saved = load();
  const state = { id: saved.id || Math.random().toString(36).slice(2, 10), vote: COPY[saved.vote] ? saved.vote : null, anchor: null };

  function send(extra) {
    const data = Object.assign({ id: state.id, page: location.pathname, vote: state.vote }, extra);
    fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data), keepalive: true }).catch(() => {});
  }

  /* ---------- Markup ---------- */
  const thumb = (vote, label) => `<button type="button" class="fb-btn" data-vote="${vote}" aria-label="${label}" aria-haspopup="dialog" aria-pressed="${state.vote === vote}"><img src="${STATIC}icon-thumbs-${vote}.svg" width="16" height="16" alt=""></button>`;
  const bar = document.createElement('div');
  bar.className = 'fb';
  bar.innerHTML = `<span class="fb-label" role="status">What do you think?</span><span class="fb-btns">${thumb('up', 'I like this page')}${thumb('down', 'I don’t like this page')}</span>`;
  footer.appendChild(bar);   // after the links, so tab order is copyright, links, feedback; site.css places it
  footer.classList.add('has-fb');

  const scrim = document.createElement('div');
  scrim.className = 'fb-scrim';
  const panel = document.createElement('form');
  panel.className = 'fb-panel';
  panel.tabIndex = -1;
  panel.noValidate = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'fb-title');
  panel.innerHTML = `
    <div class="fb-head"><div class="fb-grab"></div><p class="fb-title" id="fb-title"></p></div>
    <button type="button" class="fb-close" aria-label="Close"><img src="${STATIC}icon-close.svg" width="16" height="16" alt=""></button>
    <div class="fb-body">
      <div class="fb-chips" role="group" aria-labelledby="fb-title"></div>
      <div class="fb-field">
        <textarea class="fb-text" maxlength="${MAX}" placeholder="Share some details..." aria-label="Share some details"></textarea>
        <span class="fb-count">0 / ${MAX}</span>
      </div>
    </div>
    <div class="fb-actions"><button type="submit" class="fb-submit">Submit</button></div>
    <span class="fb-caret" aria-hidden="true"></span>`;
  document.body.append(scrim, panel);

  const $ = (s, root) => (root || panel).querySelector(s);
  const label = $('.fb-label', bar);
  const text = $('.fb-text');
  const count = $('.fb-count');
  const thumbs = [...bar.querySelectorAll('.fb-btn')];
  const sheetQuery = matchMedia('(max-width:700px),(max-height:520px)');
  const isOpen = () => panel.classList.contains('is-open');

  /* ---------- Popup ---------- */
  function fill() {
    $('.fb-title').textContent = TITLES[state.vote];
    $('.fb-chips').innerHTML = COPY[state.vote].map((c) => `<button type="button" class="fb-chip" aria-pressed="false">${c}</button>`).join('');
  }
  function resizeText() {
    text.style.height = 'auto';
    text.style.height = Math.min(text.scrollHeight + 2, 240) + 'px';
    count.textContent = `${text.value.length} / ${MAX}`;
  }
  function place() {
    const sheet = sheetQuery.matches;
    document.documentElement.classList.toggle('fb-lock', sheet && isOpen());
    scrim.classList.toggle('is-open', sheet && isOpen());
    if (sheet || !state.anchor) return;
    const box = state.anchor.getBoundingClientRect();
    const middle = box.left + box.width / 2 + scrollX;
    const pageWidth = document.documentElement.clientWidth;
    const left = Math.min(Math.max(middle - panel.offsetWidth / 2, 16), pageWidth - panel.offsetWidth - 16);
    panel.style.left = left + 'px';
    panel.style.top = box.top + scrollY - panel.offsetHeight - 11 + 'px';
    panel.style.setProperty('--fb-caret', middle - left + 'px');
  }
  function open(btn) {
    state.anchor = btn;
    panel.classList.add('is-open');
    place();
    panel.focus({ preventScroll: true });
  }
  function close(returnFocus) {
    if (!isOpen()) return;
    panel.classList.remove('is-open');
    panel.style.removeProperty('--fb-drag');
    place();
    if (returnFocus && state.anchor) state.anchor.focus({ preventScroll: true });
  }

  /* The phone keyboard covers the page without resizing it, so the sheet rides on top of the keyboard. */
  function fitKeyboard() {
    const view = window.visualViewport;
    if (!view) return;
    panel.style.setProperty('--fb-kb', Math.max(0, innerHeight - view.height - view.offsetTop) + 'px');
    panel.style.setProperty('--fb-vh', view.height + 'px');
  }

  /* ---------- Clicks ---------- */
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('.fb-btn');
    if (!btn) return;
    const vote = btn.dataset.vote;
    if (vote !== state.vote) {
      state.vote = vote;
      save();
      send();
      thumbs.forEach((t) => t.setAttribute('aria-pressed', t === btn));
      label.textContent = 'What do you think?';
      fill();
      open(btn);
    } else if (isOpen()) {
      close(true);
    } else {
      fill();
      open(btn);
    }
  });
  panel.addEventListener('click', (e) => {
    const chip = e.target.closest('.fb-chip');
    if (chip) chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') !== 'true');
    if (e.target.closest('.fb-close')) close(true);
  });
  panel.addEventListener('submit', (e) => {
    e.preventDefault();
    const chips = [...panel.querySelectorAll('.fb-chip[aria-pressed="true"]')].map((c) => c.textContent);
    const comment = text.value.trim();
    if (chips.length || comment) {
      send({ chips, comment });
      text.value = '';
      resizeText();
      label.textContent = 'Thanks for your feedback';
    }
    close(true);
  });
  text.addEventListener('input', resizeText);
  scrim.addEventListener('click', () => close(true));
  document.addEventListener('pointerdown', (e) => {
    if (isOpen() && !sheetQuery.matches && !panel.contains(e.target) && !bar.contains(e.target)) close(false);
  });
  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') close(true);
    if (e.key !== 'Tab' || !sheetQuery.matches) return;
    const items = [...panel.querySelectorAll('button,textarea')];   // the sheet covers the page, so Tab stays inside it
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- Swipe the sheet down to close ---------- */
  const head = $('.fb-head');
  let dragStart = null;
  head.addEventListener('pointerdown', (e) => {
    if (!sheetQuery.matches) return;
    dragStart = e.clientY;
    head.setPointerCapture(e.pointerId);
    panel.classList.add('is-dragging');
  });
  head.addEventListener('pointermove', (e) => {
    if (dragStart !== null) panel.style.setProperty('--fb-drag', Math.max(0, e.clientY - dragStart) + 'px');
  });
  function endDrag(e) {
    if (dragStart === null) return;
    const moved = e.clientY - dragStart;
    dragStart = null;
    panel.classList.remove('is-dragging');
    if (moved > 80) close(true);
    else panel.style.removeProperty('--fb-drag');
  }
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);

  addEventListener('resize', place);
  sheetQuery.addEventListener('change', place);
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', fitKeyboard);
    visualViewport.addEventListener('scroll', fitKeyboard);
  }
  fitKeyboard();
})();
