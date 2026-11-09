/* Pulse behaviors. Plain JavaScript, no dependencies, no build step.
   Every behavior stays idle until the page uses its attribute, so loading this file changes nothing on its own.

   Popover
     <button popovertarget="tip" aria-controls="tip" aria-expanded="false">…</button>
     <div id="tip" popover class="pulse-popover pulse-popover--bottom pulse-popover--start" role="dialog" aria-labelledby="tip-t">…</div>
   The browser's Popover API opens and closes it (click the trigger, Esc, click outside, focus returns to the trigger).
   This file places it next to the trigger, points the caret at the trigger, flips it to the other side when there is no
   room, and keeps aria-expanded in step. Browsers without the Popover API get a small fallback that does the same.
   Content inside a shadow root: call Pulse.popover.attach(shadowRoot) once for that root. */
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

  function attach(root) {
    root.addEventListener('click', rememberTrigger, true);
    if (native) {
      // Hidden until placed. Opacity, not visibility, so autofocus inside the popover still works.
      root.addEventListener('beforetoggle', function (e) { if (isPop(e.target) && e.newState === 'open') e.target.style.opacity = '0'; }, true);
      root.addEventListener('toggle', function (e) { if (isPop(e.target)) setOpen(e.target, e.newState === 'open', e); }, true);
    }
  }
  attach(document);

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
})();
