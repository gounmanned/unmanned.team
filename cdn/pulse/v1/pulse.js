/* Pulse behaviors. Plain JavaScript, no dependencies, no build step.
   Every behavior stays idle until the page uses its attribute, so loading this file changes nothing on its own.

   Popover
     <button popovertarget="tip" aria-controls="tip" aria-expanded="false">…</button>
     <div id="tip" popover class="pulse-popover pulse-popover--bottom pulse-popover--start" role="dialog" aria-labelledby="tip-t">…</div>
   The browser's Popover API opens and closes it (click the trigger, Esc, click outside, focus returns to the trigger).
   This file places it next to the trigger, points the caret at the trigger, flips it to the other side when there is no
   room, and keeps aria-expanded in step. Browsers without the Popover API get a small fallback that does the same.
   Content inside a shadow root: call Pulse.popover.attach(shadowRoot) once for that root.

   Tooltip
     <button class="pulse-btn … pulse-tooltip-host" aria-label="Copy"><i class="pulse-icon pulse-icon--copy"></i>
       <span class="pulse-tooltip pulse-tooltip--bottom" aria-hidden="true">Copy to clipboard</span></button>
   CSS shows it on hover and keyboard focus. This file only adds Esc: it hides the tooltip until the pointer or focus leaves.

   Drawer (and any native <dialog>)
     <button data-pulse-open="prices">…</button>
     <dialog id="prices" class="pulse-drawer" aria-labelledby="prices-t">… <button data-pulse-close aria-label="Close">…</button> …</dialog>
   The opener can be an <a href>, so it still goes somewhere without JS; with JS the link is cancelled.
   data-pulse-open opens the dialog with that id as a modal (or beside the page, still usable, when the dialog has data-modal="false").
   data-pulse-close inside it closes it; so does a click on the dimmed page. Esc and returning focus are the browser's.

   Copy
     <button class="pulse-btn … pulse-tooltip-host" data-pulse-copy aria-label="Copy">… <span class="pulse-tooltip" aria-hidden="true">Copy to clipboard</span></button>
   data-pulse-copy copies the code of the pulse-code panel the button sits in. data-pulse-copy="some-id" copies the text of that
   element instead (an input's value). The tooltip says "Copied" for a moment (data-pulse-copied="…" to change the word) and a
   screen reader hears it too.

   Slider
     <input class="pulse-slider__input" type="range" …>   keeps the fill in step with the thumb. An <output for="its-id"
     data-pulse-mirror="%"> shows the value with that suffix (data-pulse-mirror="" for none). Other formats are the page's job. */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  var GAP = 4;        // space between the caret tip (or the card, with no caret) and the trigger
  var CARET = 6;      // how far the caret sticks out of the card
  var INSET = 22;     // caret centre from the card's corner for Start / End alignment (matches the CSS)
  var MIN_ALONG = 14; // keep the caret off the rounded corners
  var EDGE = 8;       // closest the card may get to the edge of the window
  var OPP = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
  var SIDES = ['top', 'right', 'bottom', 'left'];
  var native = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;
  var triggers = {};  // popover id -> the button that opened it
  var openList = [];  // popovers that are open now

  function isPop(el) { return el && el.classList && el.classList.contains('pulse-popover') && el.hasAttribute('popover'); }

  function readPref(pop) {
    var side = pop.getAttribute('data-placement'), align = pop.getAttribute('data-align');
    SIDES.forEach(function (s) { if (!side && pop.classList.contains('pulse-popover--' + s)) side = s; });
    if (!align) align = pop.classList.contains('pulse-popover--start') ? 'start' : (pop.classList.contains('pulse-popover--end') ? 'end' : 'center');
    return { side: side || 'bottom', align: align };
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function place(pop, trigger) {
    if (!trigger) return;
    var pref = pop._pulsePref || (pop._pulsePref = readPref(pop));
    var noCaret = pop.classList.contains('pulse-popover--no-caret');
    var off = GAP + (noCaret ? 0 : CARET);
    pop.style.top = '0px'; pop.style.left = '0px';
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var t = trigger.getBoundingClientRect();
    var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    var space = { top: t.top, bottom: vh - t.bottom, left: t.left, right: vw - t.right };
    var need = { top: h + off, bottom: h + off, left: w + off, right: w + off };
    var side = pref.side;
    if (space[side] < need[side] && space[OPP[side]] > space[side]) side = OPP[side];
    var cx = t.left + t.width / 2, cy = t.top + t.height / 2, left, top, along;
    if (side === 'top' || side === 'bottom') {
      // With a caret, Start/End put the caret over the trigger's centre; without one they line the card's edge up with the trigger's edge.
      left = pref.align === 'start' ? (noCaret ? t.left : cx - INSET) : (pref.align === 'end' ? (noCaret ? t.right - w : cx - (w - INSET)) : cx - w / 2);
      left = clamp(left, EDGE, Math.max(EDGE, vw - w - EDGE));
      top = side === 'bottom' ? t.bottom + off : t.top - off - h;
      along = clamp(cx - left - 1, MIN_ALONG, w - MIN_ALONG);
    } else {
      top = pref.align === 'start' ? (noCaret ? t.top : cy - INSET) : (pref.align === 'end' ? (noCaret ? t.bottom - h : cy - (h - INSET)) : cy - h / 2);
      top = clamp(top, EDGE, Math.max(EDGE, vh - h - EDGE));
      left = side === 'right' ? t.right + off : t.left - off - w;
      along = clamp(cy - top - 1, MIN_ALONG, h - MIN_ALONG);
    }
    SIDES.forEach(function (s) { pop.classList.toggle('pulse-popover--' + s, s === side); });
    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(top) + 'px';
    pop.style.setProperty('--along', Math.round(along) + 'px');
  }

  function triggerFor(pop, ev) {
    var root = pop.getRootNode && pop.getRootNode();
    return (ev && ev.source) || triggers[pop.id] || (pop.id && root && root.querySelector && root.querySelector('[popovertarget="' + pop.id + '"]'));
  }

  function setOpen(pop, isOpen, ev) {
    // On open the invoker is the button that was clicked; on close it is still that same button (not the Close or Cancel that hid it).
    var tr = isOpen ? triggerFor(pop, ev) : (pop._pulseTrigger || triggerFor(pop, null));
    if (tr && tr.setAttribute) tr.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) {
      pop._pulseTrigger = tr;
      place(pop, tr);
      pop.style.opacity = '';
      if (openList.indexOf(pop) < 0) openList.push(pop);
    } else {
      var i = openList.indexOf(pop); if (i >= 0) openList.splice(i, 1);
    }
  }

  var queued = false;
  function reposition() {
    if (queued) return; queued = true;
    requestAnimationFrame(function () { queued = false; openList.forEach(function (p) { place(p, p._pulseTrigger); }); });
  }
  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition, true);

  function rememberTrigger(e) {
    var path = e.composedPath ? e.composedPath() : [e.target];
    for (var i = 0; i < path.length; i++) {
      var el = path[i];
      if (el && el.hasAttribute && el.hasAttribute('popovertarget')) {
        // A Close or Cancel button (popovertargetaction="hide") is not the trigger; keep the button that opened it.
        if (el.getAttribute('popovertargetaction') !== 'hide') triggers[el.getAttribute('popovertarget')] = el;
        return el;
      }
    }
    return null;
  }

  function dialogClick(e) {
    var t = e.target; if (!t || !t.closest) return;
    var opener = t.closest('[data-pulse-open]');
    if (opener) {
      var rn = opener.getRootNode(), dlg = rn.getElementById ? rn.getElementById(opener.getAttribute('data-pulse-open')) : null;
      if (!dlg || !dlg.showModal) return;
      // An <a href> opener still works without JS (it goes to its link); with JS it opens the dialog instead.
      e.preventDefault();
      if (dlg.open) return;
      dlg._pulseOpener = opener;
      if (dlg.getAttribute('data-modal') === 'false') dlg.show(); else dlg.showModal();
      return;
    }
    var dlgIn = t.closest('dialog');
    if (!dlgIn) return;
    var isBackdrop = t === dlgIn && dlgIn.matches(':modal') && dlgIn.classList.contains('pulse-drawer');
    if (t.closest('[data-pulse-close]') || isBackdrop) {
      dlgIn.close();
      // show() (not modal) doesn't hand focus back by itself
      if (dlgIn._pulseOpener && dlgIn.getAttribute('data-modal') === 'false' && dlgIn._pulseOpener.focus) dlgIn._pulseOpener.focus();
    }
  }

  function attach(root) {
    root.addEventListener('click', rememberTrigger, true);
    root.addEventListener('click', dialogClick);
    if (native) {
      // Hidden until placed. Opacity, not visibility, so autofocus inside the popover still works.
      root.addEventListener('beforetoggle', function (e) { if (isPop(e.target) && e.newState === 'open') e.target.style.opacity = '0'; }, true);
      root.addEventListener('toggle', function (e) { if (isPop(e.target)) setOpen(e.target, e.newState === 'open', e); }, true);
    }
  }
  attach(document);

  // Tooltip: Esc hides the ones showing; each comes back after the pointer and focus have left its host.
  function tipHosts(root) { return root.querySelectorAll ? root.querySelectorAll('.pulse-tooltip-host:hover, .pulse-tooltip-host:focus-within') : []; }
  function dismissTip(host) {
    if (host.classList.contains('is-dismissed')) return;
    host.classList.add('is-dismissed');
    var check = function () {
      setTimeout(function () {
        if (host.matches(':hover') || host.matches(':focus-within')) return;
        host.classList.remove('is-dismissed');
        host.removeEventListener('mouseleave', check); host.removeEventListener('focusout', check);
      }, 0);
    };
    host.addEventListener('mouseleave', check); host.addEventListener('focusout', check);
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var seen = [];
    (e.composedPath ? e.composedPath() : []).forEach(function (n) { if (n && n.host && seen.indexOf(n) < 0) seen.push(n); });  // shadow roots on the way up
    seen.push(document);
    seen.forEach(function (root) { [].forEach.call(tipHosts(root), dismissTip); });
  });

  // Fallback for browsers without the Popover API: same markup, opened with a class.
  if (!native) {
    var closeAll = function (except) { openList.slice().forEach(function (p) { if (p !== except) { p.classList.remove('is-open'); setOpen(p, false); } }); };
    document.addEventListener('click', function (e) {
      var tr = rememberTrigger(e);
      if (tr) {
        var rootNode = tr.getRootNode(), id = tr.getAttribute('popovertarget');
        var pop = rootNode.getElementById ? rootNode.getElementById(id) : document.getElementById(id);
        if (!pop) return;
        var willOpen = tr.getAttribute('popovertargetaction') === 'hide' ? false : (tr.getAttribute('popovertargetaction') === 'show' ? true : !pop.classList.contains('is-open'));
        closeAll(willOpen ? pop : null);
        pop.classList.toggle('is-open', willOpen);
        setOpen(pop, willOpen, { source: tr });
        return;
      }
      var inside = e.composedPath().some(function (n) { return isPop(n); });
      if (!inside) closeAll(null);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !openList.length) return;
      var last = openList[openList.length - 1], tr = last._pulseTrigger;
      closeAll(null); if (tr && tr.focus) tr.focus();
    });
  }

  window.Pulse = window.Pulse || {};
  window.Pulse.popover = { attach: attach, place: place };
  window.Pulse.attach = attach;  // same call under a general name: popovers, drawers and dialogs inside a shadow root

  // Copy: one polite live region per document, so "Copied" is read out.
  var live = null;
  function say(text) {
    if (!live) { live = document.createElement('span'); live.setAttribute('role', 'status'); live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap'; document.body.appendChild(live); }
    live.textContent = ''; setTimeout(function () { live.textContent = text; }, 50);
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, fail) {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? ok() : fail(); } catch (e) { fail(e); } finally { ta.remove(); }
    });
  }
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('[data-pulse-copy]');
    if (!btn || btn.disabled) return;
    var id = btn.getAttribute('data-pulse-copy'), src = null, text = '';
    if (id) { var rn = btn.getRootNode(); src = rn.getElementById ? rn.getElementById(id) : document.getElementById(id); text = src ? ('value' in src && src.value !== undefined && src.tagName !== 'OUTPUT' ? src.value : src.textContent) : ''; }
    else { var panel = btn.closest('.pulse-code'); src = panel && (panel.querySelector('code') || panel.querySelector('pre')); text = src ? src.textContent : ''; }
    if (!text) return;
    copyText(text).then(function () {
      var word = btn.getAttribute('data-pulse-copied') || 'Copied', tip = btn.querySelector('.pulse-tooltip');
      say(word);
      if (tip) {
        if (tip._pulseWord === undefined) tip._pulseWord = tip.textContent;
        tip.textContent = word; tip.classList.add('is-open');
        clearTimeout(tip._pulseTimer);
        tip._pulseTimer = setTimeout(function () { tip.classList.remove('is-open'); tip.textContent = tip._pulseWord; }, 1600);
      }
    }, function () {});
  });

  // Slider: keep the fill (--v) and a mirrored <output> in step with the value.
  function syncSlider(input) {
    var min = parseFloat(input.min || 0), max = parseFloat(input.max || 100), v = parseFloat(input.value);
    input.style.setProperty('--v', ((v - min) / ((max - min) || 1) * 100) + '%');
    if (!input.id) return;
    var out = (input.getRootNode().querySelector ? input.getRootNode() : document).querySelector('output[for~="' + input.id + '"][data-pulse-mirror]');
    if (out) out.textContent = input.value + out.getAttribute('data-pulse-mirror');
  }
  document.addEventListener('input', function (e) { if (e.target && e.target.classList && e.target.classList.contains('pulse-slider__input')) syncSlider(e.target); });
  function syncAll() { [].forEach.call(document.querySelectorAll('.pulse-slider__input'), syncSlider); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncAll); else syncAll();
})();
