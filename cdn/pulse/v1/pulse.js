/* Pulse behaviors. Plain JavaScript, no dependencies, no build step.
   Every behavior stays idle until the page uses its attribute, so loading this file changes nothing on its own.

   Popover
     <button popovertarget="tip" aria-controls="tip" aria-expanded="false">…</button>
     <div id="tip" popover class="pulse-popover pulse-popover--bottom pulse-popover--start" role="dialog" aria-labelledby="tip-t">…</div>
   The browser's Popover API opens and closes it (click the trigger, Esc, click outside, focus returns to the trigger).
   This file places it next to the trigger, points the caret at the trigger, flips it to the other side when there is no
   room, and keeps aria-expanded in step. Browsers without the Popover API get a small fallback that does the same.
   Content inside a shadow root: call Pulse.attach(shadowRoot) once for that root (Pulse.popover.attach still works).

   Tooltip
     <button class="pulse-btn … pulse-tooltip-host" aria-label="Copy"><i class="pulse-icon pulse-icon--copy"></i>
       <span class="pulse-tooltip pulse-tooltip--bottom" aria-hidden="true">Copy to clipboard</span></button>
   CSS shows it on hover and keyboard focus. This file lifts it into the top layer while it shows (so a scrolling or clipped box
   never cuts it off), flips it above or below when there's no room, and adds Esc: it hides the tooltip until the pointer or focus leaves.

   Drawer (and any native <dialog>)
     <button data-pulse-open="prices">…</button>
     <dialog id="prices" class="pulse-drawer" aria-labelledby="prices-t">… <button data-pulse-close aria-label="Close">…</button> …</dialog>
   The opener can be an <a href>, so it still goes somewhere without JS; with JS the link is cancelled.
   data-pulse-open opens the dialog with that id as a modal (or beside the page, still usable, when the dialog has data-modal="false").
   data-pulse-close inside it closes it; so does a click on the dimmed page. Esc and returning focus are the browser's.
   On open, focus goes to the title (an autofocus element inside wins), so the close X isn't shown as selected.
   Esc also closes a dialog or drawer opened beside the page (data-modal="false", or the page's own dialog.show()), unless a modal is
   open or something inside used the key; focus goes back to the opener.

   Confirm
     Pulse.confirm({ title, body, resource, action: 'Delete' }).then(function (ok) { if (ok) … });
   Builds and opens the destructive dialog; true on the destructive button, false on Cancel, Esc, the X or the dimmed page.

   Loading
     Pulse.loading(function () { return fetch(…); }, { delay: 200 }).then(function (result) { … });
   The page-wide cover while a task runs (at least delay ms; overlapping tasks share one cover; above open panels).
     var c = Pulse.cover(box); … c.remove();     a cover over one box. The inline spinner is markup: <span class="pulse-spinner pulse-spinner--sm" role="status" aria-label="Loading"></span>

   Copy
     <button class="pulse-btn … pulse-tooltip-host" data-pulse-copy aria-label="Copy">… <span class="pulse-tooltip" aria-hidden="true">Copy to clipboard</span></button>
   data-pulse-copy copies the code of the pulse-code panel the button sits in. data-pulse-copy="some-id" copies the text of that
   element instead (an input's value). The tooltip says "Copied" for a moment (data-pulse-copied="…" to change the word) and a
   screen reader hears it too.

   Clear (search)
     <div class="pulse-input-group">… <input class="pulse-input" type="search" placeholder="…"> <kbd class="pulse-input-group__key">/</kbd>
       <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-input-group__clear" type="button" data-pulse-clear aria-label="Clear search">…x icon…</button></div>
   CSS shows the X only while the field has text (the field needs a placeholder). Clicking it empties the field, focuses it and
   fires an input event, so lists refilter. Esc in a field with text clears it the same way (and doesn't close the drawer around it).

   Slider
     <input class="pulse-slider__input" type="range" …>   keeps the fill in step with the thumb. Any <output for="its-id"> or element
     with data-pulse-value-of="its-id" shows the value, formatted by its attributes:
       data-pulse-format="number" | "currency" | "percent"   (data-pulse-currency="USD" by default)
       data-pulse-scale="4"          multiplies first (120 employees x $4 = $480)
       data-pulse-prefix / data-pulse-suffix   text around it; data-pulse-mirror="%" is the short form of a suffix
       data-pulse-formatter="name"   your own: Pulse.formats.name = function (value, input) { return '…'; }
     The slider's aria-valuetext follows its <output>, so screen readers hear the formatted value.

   Tabs
     <div class="pulse-tabs pulse-tabs--line" role="tablist" aria-label="…"><button class="pulse-tab" role="tab" aria-selected="true" aria-controls="panel-a">…</button>…</div>
     <div id="panel-a" role="tabpanel">…</div>
   A click, or the arrow keys, Home and End, selects a tab and shows its panel (the others get hidden). Fires "pulse:tab" on the tablist.

   Menu (dropdown and nav menu)
     <div class="pulse-menu-anchor"><button data-pulse-menu aria-expanded="false" aria-controls="m">…</button>
       <nav class="pulse-dropdown pulse-dropdown--nav" id="m" hidden>…</nav></div>
   data-pulse-menu opens and closes the list it controls. Esc, a click outside or tabbing away closes it. A listbox
   (role="listbox") also gets the arrow keys, Enter and Space; choosing an option marks it aria-selected, writes its label into the
   trigger's [data-pulse-label] and fires "pulse:select" (detail: value, option) on the listbox. Only triggers with data-pulse-menu
   are touched, so a page that runs its own menu script is left alone.

   Toast
     Pulse.toast({ title: 'Report exported', text: '…', tone: 'success', action: { label: 'View', href: '…' }, duration: 5000, icon: false })
     or a button with data-pulse-toast="Report exported" (and data-pulse-toast-tone, -text).
   Stacks toasts bottom right, removes them after the duration (0 keeps it), pauses while hovered or focused. Any .pulse-dismiss
   inside an alert or toast removes it (fires "pulse:dismiss" first; cancel it to keep it).
*/
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
  // The real target and focused element, also inside (open) shadow roots, so behaviors work in web components.
  function tgt(e) { var p = e.composedPath ? e.composedPath() : null; var t = p && p.length ? p[0] : e.target; return t && t.nodeType === 3 ? t.parentElement : t; }
  function activeEl() { var a = document.activeElement; while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement; return a; }

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

  // Scroll lock: works for dialogs inside shadow roots too, where html:has() can't see them.
  var locked = [];
  function unlockIfClosed() {
    locked = locked.filter(function (d) { return d.open; });
    if (!locked.length) document.documentElement.classList.remove('pulse-scroll-lock');
  }
  function lockScroll(dlg) {
    if (locked.indexOf(dlg) < 0) locked.push(dlg);
    document.documentElement.classList.add('pulse-scroll-lock');
    dlg.addEventListener('close', unlockIfClosed);
  }
  // Closing can come from anywhere (a close button, Esc, the page's own script), so check after every click and key too.
  document.addEventListener('click', function () { if (locked.length) setTimeout(unlockIfClosed, 0); }, true);
  document.addEventListener('keyup', function () { if (locked.length) setTimeout(unlockIfClosed, 0); }, true);

  function dialogClick(e) {
    var t = e.target; if (!t || !t.closest) return;
    var opener = t.closest('[data-pulse-open]');
    if (opener) {
      var rn = opener.getRootNode(), dlg = rn.getElementById ? rn.getElementById(opener.getAttribute('data-pulse-open')) : null;
      if (!dlg || !dlg.showModal) return;
      // An <a href> opener still works without JS (it goes to its link); with JS it opens the dialog instead.
      e.preventDefault();
      if (dlg.open) return;
      // From an action in an open menu: close the menu first, so focus (and the return after closing) is the menu's button.
      var mb = typeof openMenus !== 'undefined' && openMenus.filter(function (b) { var mm = menuOf(b); return mm && mm.contains(opener); })[0];
      if (mb) { closeMenu(mb, true); opener = mb; }
      dlg._pulseOpener = opener;
      if (dlg.getAttribute('data-modal') === 'false') dlg.show(); else { dlg.showModal(); lockScroll(dlg); }
      focusTitle(dlg);   // at once too, for browsers without the dialog toggle event
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

  // On open, focus the dialog's or drawer's title (tabindex -1, no ring) instead of its first button, so a close X never reads as
  // selected; Tab goes to the X next. An element inside with autofocus wins (destructive dialogs keep Cancel). Closing a modal
  // returns focus to the opener (the browser's own step). Runs for every open, however the page opened it, in shadow roots too.
  // Looks inside the dialog and inside what is slotted into it (a web component that renders <dialog><slot></slot></dialog>).
  function findIn(dlg, sel) {
    var el = dlg.querySelector(sel); if (el) return el;
    var slots = dlg.querySelectorAll('slot');
    for (var i = 0; i < slots.length; i++) {
      var els = slots[i].assignedElements ? slots[i].assignedElements({ flatten: true }) : [];
      for (var j = 0; j < els.length; j++) { if (els[j].matches(sel)) return els[j]; var f = els[j].querySelector(sel); if (f) return f; }
    }
    return null;
  }
  function holds(dlg, el) {
    if (dlg.contains(el)) return true;
    var slots = dlg.querySelectorAll('slot');
    for (var i = 0; i < slots.length; i++) {
      var els = slots[i].assignedElements ? slots[i].assignedElements({ flatten: true }) : [];
      for (var j = 0; j < els.length; j++) if (els[j] === el || els[j].contains(el)) return true;
    }
    return false;
  }
  function focusTitle(dlg) {
    if (!dlg || !dlg.open || findIn(dlg, '[autofocus]')) return;
    if (!dlg.classList.contains('pulse-drawer') && !dlg.classList.contains('pulse-dialog') && !findIn(dlg, '.pulse-dialog')) return;
    var id = dlg.getAttribute('aria-labelledby'), rn = dlg.getRootNode(), title = null;
    if (id) {
      title = rn.getElementById ? rn.getElementById(id) : null;
      if (!title && rn.host) { var hr = rn.host.getRootNode(); title = hr.getElementById ? hr.getElementById(id) : null; }   // the id is in the light DOM
      if (title && !holds(dlg, title)) title = null;
    }
    title = title || findIn(dlg, '.pulse-drawer__title, .pulse-dialog__title');
    if (!title) return;
    if (!title.hasAttribute('tabindex')) title.setAttribute('tabindex', '-1');
    title.focus({ preventScroll: true });
  }
  // Every Pulse dialog and drawer that is open, in opening order, whatever opened it (data-pulse-open or the page's own show()),
  // in shadow roots too: Esc for panels beside the page and the loading cover use it. The opener is remembered for focus return.
  var openDialogs = [];
  function isPulseDialog(d) { return d.classList.contains('pulse-drawer') || d.classList.contains('pulse-dialog') || !!d.querySelector('.pulse-dialog'); }
  function dialogBefore(e) {
    var d = e.target;
    if (d && d.tagName === 'DIALOG' && e.newState === 'open' && !d._pulseOpener) { var a = activeEl(); if (a && a !== document.body) d._pulseOpener = a; }
  }
  function dialogToggle(e) {
    var d = e.target; if (!d || d.tagName !== 'DIALOG') return;
    if (e.newState === 'open') {
      focusTitle(d);
      if (openDialogs.indexOf(d) < 0) openDialogs.push(d);
      raiseCover();   // a panel opened while the page is loading: keep the cover on top
    } else {
      openDialogs = openDialogs.filter(function (x) { return x !== d; });
      d._pulseOpener = null;
    }
  }

  function attach(root) {
    root.addEventListener('click', rememberTrigger, true);
    root.addEventListener('beforetoggle', dialogBefore, true);
    root.addEventListener('toggle', dialogToggle, true);
    root.addEventListener('click', dialogClick);
    if (native) {
      // Hidden until placed. Opacity, not visibility, so autofocus inside the popover still works.
      root.addEventListener('beforetoggle', function (e) { if (isPop(e.target) && e.newState === 'open') e.target.style.opacity = '0'; }, true);
      root.addEventListener('toggle', function (e) { if (isPop(e.target)) setOpen(e.target, e.newState === 'open', e); }, true);
    }
  }
  attach(document);

  // Tooltip in the top layer: while it can show, the bubble becomes a manual popover placed from its host's rect, so a scrolling
  // list or a clipped box never cuts it off. Same markup; CSS still decides when it shows (hover, keyboard focus, is-open, Esc).
  // With no room on its side it flips (above <-> below). Without the Popover API it stays where CSS puts it.
  var openTips = [], TIP_GAP = 8, EDGE = 8;
  function tipOf(host) { for (var c = host.firstElementChild; c; c = c.nextElementSibling) if (c.classList.contains('pulse-tooltip')) return c; return null; }
  function tipActive(host, tip) {
    if (host.disabled || host.getAttribute('aria-disabled') === 'true') return false;
    if (tip.classList.contains('is-open')) return true;
    if (host.classList.contains('is-dismissed')) return false;
    // A tooltip in the top layer doesn't count as hovering its host, so check the tooltip itself too.
    return host.matches(':hover') || tip.matches(':hover') || host.matches(':focus-visible') || !!host.querySelector(':focus-visible');
  }
  function placeTip(host, tip) {
    var r = host.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, vw = innerWidth, vh = innerHeight;
    var cl = tip.classList, side = cl.contains('pulse-tooltip--left') ? 'left' : cl.contains('pulse-tooltip--right') ? 'right' : cl.contains('pulse-tooltip--bottom') ? 'bottom' : 'top';
    if (tip._pulseFlip) side = tip._pulseFlip;
    var x, y, shift = 0;
    if (side === 'top' || side === 'bottom') {
      // Flip when there's no room on this side but there is on the other.
      if (side === 'top' && r.top - h - TIP_GAP < EDGE && r.bottom + TIP_GAP + h <= vh - EDGE) side = 'bottom';
      else if (side === 'bottom' && r.bottom + TIP_GAP + h > vh - EDGE && r.top - TIP_GAP - h >= EDGE) side = 'top';
      y = side === 'top' ? r.top - h - TIP_GAP : r.bottom + TIP_GAP;
      if (cl.contains('pulse-tooltip--start')) x = r.left - EDGE;
      else if (cl.contains('pulse-tooltip--end')) x = r.right + EDGE - w;
      else { x = r.left + r.width / 2 - w / 2; var cx = Math.min(Math.max(x, EDGE), vw - w - EDGE); shift = x - cx; x = cx; }   // keep it on screen; the caret stays on the host
    } else {
      x = side === 'left' ? r.left - w - TIP_GAP : r.right + TIP_GAP;
      y = r.top + r.height / 2 - h / 2;
    }
    var wasBottom = cl.contains('pulse-tooltip--bottom'), wantBottom = side === 'bottom';
    if ((side === 'top' || side === 'bottom') && wasBottom !== wantBottom) { cl.toggle('pulse-tooltip--bottom', wantBottom); tip._pulseFlipped = !tip._pulseFlipped; }
    tip.style.setProperty('--tip-x', Math.round(x) + 'px'); tip.style.setProperty('--tip-y', Math.round(y) + 'px'); tip.style.setProperty('--tip-shift', Math.round(shift) + 'px');
  }
  function openTip(host, tip) {
    if (!tip.matches(':popover-open')) {
      if (!tip.hasAttribute('popover')) tip.setAttribute('popover', 'manual');
      try { tip.showPopover(); } catch (e) { return; }
      openTips.push({ host: host, tip: tip });
    }
    placeTip(host, tip);
  }
  function closeTip(entry) {
    var tip = entry.tip;
    if (tip._pulseFlipped) { tip.classList.toggle('pulse-tooltip--bottom'); tip._pulseFlipped = false; }
    try { tip.hidePopover(); } catch (e) {}
    tip.removeAttribute('popover'); ['--tip-x', '--tip-y', '--tip-shift'].forEach(function (k) { tip.style.removeProperty(k); });
    openTips = openTips.filter(function (o) { return o !== entry; });
  }
  function syncTip(host) {
    var tip = host && tipOf(host); if (!tip || !native) return;
    host.classList.toggle('is-tip-hover', tip.matches(':hover'));   // keeps the CSS showing it while the pointer is on it
    if (tipActive(host, tip)) { clearTimeout(tip._pulseHide); openTip(host, tip); return; }
    clearTimeout(tip._pulseHide);
    tip._pulseHide = setTimeout(function () {   // after the fade-out
      var entry = openTips.filter(function (o) { return o.tip === tip; })[0];
      if (entry && !tipActive(host, tip)) closeTip(entry);
    }, 160);
  }
  function tipEvent(e) {
    var t = tgt(e), host = t && t.closest && t.closest('.pulse-tooltip-host'); if (!host) return;
    if (e.type === 'pointerover' && t.closest('.pulse-tooltip')) host.classList.add('is-tip-hover');   // at once, before the CSS can hide it
    setTimeout(function () { syncTip(host); }, 0);
  }
  if (native) {
    ['pointerover', 'pointerout', 'focusin', 'focusout'].forEach(function (ev) { document.addEventListener(ev, tipEvent, true); });
    var replaceTips = function () { openTips.forEach(function (o) { if (o.tip.matches(':popover-open')) placeTip(o.host, o.tip); }); };
    window.addEventListener('scroll', replaceTips, true); window.addEventListener('resize', replaceTips);
  }

  // Tooltip: Esc hides the ones showing; each comes back after the pointer and focus have left its host.
  function tipHosts(root) { return root.querySelectorAll ? root.querySelectorAll('.pulse-tooltip-host:hover, .pulse-tooltip-host:focus-within') : []; }
  function dismissTip(host) {
    if (host.classList.contains('is-dismissed')) return;
    host.classList.add('is-dismissed');
    syncTip(host);
    var check = function () {
      setTimeout(function () {
        if (host.matches(':hover') || host.matches(':focus-within')) return;
        host.classList.remove('is-dismissed');
        syncTip(host);
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
  window.Pulse.tooltip = { sync: syncTip };
  // Pulse.attach(shadowRoot): once per shadow root. Wires popovers, dialogs and drawers inside it and sets up its tabs, menus
  // and sliders (clicks, keys and copy already work there through the page-level listeners).
  window.Pulse.attach = function (root) { attach(root); if (root && root !== document) { initAll(root); syncAll(root); } };

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
    var t0 = tgt(e), btn = t0 && t0.closest && t0.closest('[data-pulse-copy]');
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
        tip.textContent = word; tip.classList.add('is-open'); syncTip(btn);
        clearTimeout(tip._pulseTimer);
        tip._pulseTimer = setTimeout(function () { tip.classList.remove('is-open'); tip.textContent = tip._pulseWord; syncTip(btn); }, 1600);
      }
    }, function () {});
  });

  // Clear: empty the input group's field, keep focus there, and let the page's own input listener refilter.
  function clearField(input) {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.focus();
  }
  document.addEventListener('click', function (e) {
    var t0 = tgt(e), btn = t0 && t0.closest && t0.closest('[data-pulse-clear]');
    if (!btn || btn.disabled) return;
    var group = btn.closest('.pulse-input-group'), input = group && group.querySelector('input, textarea');
    if (input) { e.preventDefault(); clearField(input); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var input = tgt(e);
    if (!input || !input.matches || !input.matches('.pulse-input-group input, .pulse-input-group textarea') || !input.value) return;
    var group = input.closest('.pulse-input-group');
    if (!group.querySelector('[data-pulse-clear]')) return;
    e.preventDefault(); e.stopPropagation();
    clearField(input);
  }, true);

  // Slider: keep the fill (--v) and any formatted outputs in step with the value.
  window.Pulse.formats = window.Pulse.formats || {};
  function formatValue(el, v, input) {
    var name = el.getAttribute('data-pulse-formatter');
    if (name && typeof window.Pulse.formats[name] === 'function') return String(window.Pulse.formats[name](v, input));
    var scale = parseFloat(el.getAttribute('data-pulse-scale')); if (!isNaN(scale)) v = v * scale;
    var f = el.getAttribute('data-pulse-format'), text;
    try {
      if (f === 'currency') text = new Intl.NumberFormat(undefined, { style: 'currency', currency: el.getAttribute('data-pulse-currency') || 'USD', maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);
      else if (f === 'number') text = new Intl.NumberFormat().format(v);
      else if (f === 'percent') text = new Intl.NumberFormat().format(v) + '%';
      else text = String(v);
    } catch (e) { text = String(v); }
    var suffix = el.hasAttribute('data-pulse-suffix') ? el.getAttribute('data-pulse-suffix') : (el.getAttribute('data-pulse-mirror') || '');
    return (el.getAttribute('data-pulse-prefix') || '') + text + suffix;
  }
  var FORMAT_ATTRS = ['data-pulse-format', 'data-pulse-formatter', 'data-pulse-mirror', 'data-pulse-scale', 'data-pulse-prefix', 'data-pulse-suffix'];
  function syncSlider(input) {
    var min = parseFloat(input.min || 0), max = parseFloat(input.max || 100), v = parseFloat(input.value);
    input.style.setProperty('--v', ((v - min) / ((max - min) || 1) * 100) + '%');
    if (!input.id) return;
    var root = input.getRootNode().querySelectorAll ? input.getRootNode() : document, first = null;
    [].forEach.call(root.querySelectorAll('output[for~="' + input.id + '"], [data-pulse-value-of="' + input.id + '"]'), function (el) {
      if (!FORMAT_ATTRS.some(function (a) { return el.hasAttribute(a); })) return;
      el.textContent = formatValue(el, v, input);
      if (!first && el.tagName === 'OUTPUT') first = el;
    });
    if (first) input.setAttribute('aria-valuetext', first.textContent);
  }
  document.addEventListener('input', function (e) { var t = tgt(e); if (t && t.classList && t.classList.contains('pulse-slider__input')) syncSlider(t); });
  function syncAll(root) { [].forEach.call((root && root.querySelectorAll ? root : document).querySelectorAll('.pulse-slider__input'), syncSlider); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncAll); else syncAll();

  function byId(from, id) { var rn = from.getRootNode(); return id ? (rn.getElementById ? rn.getElementById(id) : document.getElementById(id)) : null; }

  // ---------- Tabs ----------
  function tabsOf(list) { return [].filter.call(list.querySelectorAll('[role="tab"]'), function (t) { return t.closest('[role="tablist"]') === list && t.getAttribute('aria-disabled') !== 'true' && !t.disabled; }); }
  function selectTab(tab, focus) {
    var list = tab.closest('[role="tablist"]');
    [].forEach.call(list.querySelectorAll('[role="tab"]'), function (t) {
      if (t.closest('[role="tablist"]') !== list) return;
      var on = t === tab, panel = byId(t, t.getAttribute('aria-controls'));
      t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
    list.dispatchEvent(new CustomEvent('pulse:tab', { bubbles: true, detail: { tab: tab } }));
  }
  function isPulseTab(t) { var l = t && t.closest && t.closest('[role="tablist"]'); return l && l.classList.contains('pulse-tabs') ? l : null; }
  document.addEventListener('click', function (e) {
    var t = tgt(e), tab = t && t.closest && t.closest('[role="tab"]');
    if (tab && isPulseTab(tab) && tab.getAttribute('aria-disabled') !== 'true') selectTab(tab, false);
  });
  document.addEventListener('keydown', function (e) {
    var t = tgt(e), tab = t && t.closest && t.closest('[role="tab"]'), list = isPulseTab(tab);
    if (!list) return;
    var tabs = tabsOf(list), i = tabs.indexOf(tab), vertical = list.getAttribute('aria-orientation') === 'vertical';
    var next = { ArrowRight: !vertical && 1, ArrowLeft: !vertical && -1, ArrowDown: vertical && 1, ArrowUp: vertical && -1 }[e.key];
    var to = next ? tabs[(i + next + tabs.length) % tabs.length] : e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : null;
    if (to) { e.preventDefault(); selectTab(to, true); }
  });
  function initTabs(root) {
    [].forEach.call((root || document).querySelectorAll('.pulse-tabs[role="tablist"]'), function (list) {
      var all = tabsOf(list); if (!all.length) return;
      var sel = all.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || all[0];
      [].forEach.call(list.querySelectorAll('[role="tab"]'), function (t) {
        if (t.closest('[role="tablist"]') !== list) return;
        var p = byId(t, t.getAttribute('aria-controls')); t.tabIndex = t === sel ? 0 : -1;
        t.setAttribute('aria-selected', t === sel ? 'true' : 'false'); if (p) p.hidden = t !== sel;
      });
    });
  }

  // ---------- Menus (dropdown and nav menu) ----------
  var openMenus = [];
  function menuOf(btn) { return byId(btn, btn.getAttribute('aria-controls')); }
  function options(lb) { return [].filter.call(lb.querySelectorAll('[role="option"]'), function (o) { return o.getAttribute('aria-disabled') !== 'true'; }); }
  function setActive(lb, opt) {
    [].forEach.call(lb.querySelectorAll('[role="option"]'), function (o) { o.classList.toggle('is-focus', o === opt); });
    if (opt) { if (!opt.id) opt.id = 'pulse-opt-' + Math.random().toString(36).slice(2, 9); lb.setAttribute('aria-activedescendant', opt.id); if (opt.scrollIntoView) opt.scrollIntoView({ block: 'nearest' }); }
  }
  function openMenu(btn) {
    var m = menuOf(btn); if (!m) return;
    openMenus.slice().forEach(function (b) { if (b !== btn) closeMenu(b, false); });
    m.hidden = false; btn.setAttribute('aria-expanded', 'true');
    if (openMenus.indexOf(btn) < 0) openMenus.push(btn);
    var items = menuItems(m);
    if (items.length) items[0].focus();
    if (m.getAttribute('role') === 'listbox') {
      if (!m.hasAttribute('tabindex')) m.tabIndex = -1;
      var opts = options(m); setActive(m, opts.filter(function (o) { return o.getAttribute('aria-selected') === 'true'; })[0] || opts[0]);
      m.focus();
    }
  }
  function menuItems(m) { return [].filter.call(m.querySelectorAll('[role="menuitem"]'), function (i) { return !i.disabled && i.getAttribute('aria-disabled') !== 'true' && !i.closest('[hidden]'); }); }
  function closeMenu(btn, focusBack) {
    var m = menuOf(btn); if (m) { m.hidden = true; if (m.getAttribute('role') === 'listbox') setActive(m, null); }
    btn.setAttribute('aria-expanded', 'false');
    openMenus = openMenus.filter(function (b) { return b !== btn; });
    if (focusBack) btn.focus();
  }
  function choose(lb, opt) {
    [].forEach.call(lb.querySelectorAll('[role="option"]'), function (o) { o.setAttribute('aria-selected', o === opt ? 'true' : 'false'); });
    var label = opt.querySelector('.pulse-menu-item__label'), text = (label || opt).textContent.trim();
    var btn = openMenus.filter(function (b) { return menuOf(b) === lb; })[0] || document.querySelector('[data-pulse-menu][aria-controls="' + lb.id + '"]');
    if (btn) { var slot = btn.querySelector('[data-pulse-label]') || btn; if (slot !== btn || !btn.children.length) slot.textContent = text; btn.setAttribute('data-value', opt.getAttribute('data-value') || text); }
    lb.dispatchEvent(new CustomEvent('pulse:select', { bubbles: true, detail: { value: opt.getAttribute('data-value') || text, option: opt } }));
    if (btn) closeMenu(btn, true);
  }
  document.addEventListener('click', function (e) {
    var t = tgt(e); if (!t || !t.closest) return;
    var btn = t.closest('[data-pulse-menu]');
    if (btn) { e.preventDefault(); btn.getAttribute('aria-expanded') === 'true' ? closeMenu(btn, false) : openMenu(btn); return; }
    var opt = t.closest('[role="option"]'), lb = opt && opt.closest('[role="listbox"]');
    if (opt && lb && openMenus.some(function (b) { return menuOf(b) === lb; }) && opt.getAttribute('aria-disabled') !== 'true') { choose(lb, opt); return; }
    // An action in a menu closes the menu and puts focus back on its button (so a dialog it opens returns focus there).
    var mi = t.closest('[role="menuitem"]'), owner = mi && openMenus.filter(function (b) { var mm = menuOf(b); return mm && mm.contains(mi); })[0];
    if (owner && !mi.disabled && mi.getAttribute('aria-disabled') !== 'true') { closeMenu(owner, true); return; }
    openMenus.slice().forEach(function (b) { var m = menuOf(b); if (!(m && m.contains(t))) closeMenu(b, false); });
  });
  document.addEventListener('keydown', function (e) {
    if (!openMenus.length) return;
    var btn = openMenus[openMenus.length - 1], m = menuOf(btn);
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(btn, true); return; }
    var mi = m ? menuItems(m) : [], at = mi.indexOf(activeEl());
    if (at >= 0 && /^(ArrowDown|ArrowUp|Home|End)$/.test(e.key)) {
      e.preventDefault();
      var to = e.key === 'ArrowDown' ? mi[(at + 1) % mi.length] : e.key === 'ArrowUp' ? mi[(at - 1 + mi.length) % mi.length] : e.key === 'Home' ? mi[0] : mi[mi.length - 1];
      to.focus(); return;
    }
    if (!m || m.getAttribute('role') !== 'listbox' || activeEl() !== m) return;
    var opts = options(m), cur = m.querySelector('[role="option"].is-focus'), i = opts.indexOf(cur);
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(m, opts[Math.min(i + 1, opts.length - 1)]); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(m, opts[Math.max(i - 1, 0)]); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(m, opts[0]); }
    else if (e.key === 'End') { e.preventDefault(); setActive(m, opts[opts.length - 1]); }
    else if ((e.key === 'Enter' || e.key === ' ') && cur) { e.preventDefault(); choose(m, cur); }
    else if (e.key === 'Tab') closeMenu(btn, false);
  });
  document.addEventListener('focusout', function (e) {
    openMenus.slice().forEach(function (b) {
      var m = menuOf(b), to = e.relatedTarget;
      if (!to) return;  // clicks on nothing are handled by the click listener
      var from = tgt(e); if (to !== b && !(m && m.contains(to)) && (b.contains(from) || (m && m.contains(from)))) closeMenu(b, false);
    });
  });
  function initMenus(root) {
    [].forEach.call((root || document).querySelectorAll('[data-pulse-menu]'), function (b) {
      var m = menuOf(b); if (!b.hasAttribute('aria-expanded')) b.setAttribute('aria-expanded', 'false');
      if (m && b.getAttribute('aria-expanded') !== 'true') m.hidden = true;
      if (m && m.getAttribute('role') === 'listbox' && !b.hasAttribute('aria-haspopup')) b.setAttribute('aria-haspopup', 'listbox');
    });
  }

  // ---------- Toasts and dismiss ----------
  var ICON = { info: 'info', neutral: 'info', success: 'check-circle', warning: 'warning', danger: 'warning-octagon' };
  var toaster = null;
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function toast(o) {
    o = typeof o === 'string' ? { title: o } : (o || {});
    var tone = o.tone || 'neutral';
    if (!toaster || !toaster.isConnected) {
      toaster = el('div', 'pulse-toaster');
      if (native) toaster.setAttribute('popover', 'manual');   // top layer: above open dialogs and drawers
      document.body.appendChild(toaster);
    }
    var t = el('div', 'pulse-toast' + (tone === 'info' ? '' : ' pulse-toast--' + tone));
    t.setAttribute('role', tone === 'danger' ? 'alert' : 'status');
    if (o.icon !== false) { var icon = el('i', 'pulse-icon pulse-icon--' + ICON[tone] + ' pulse-icon--fill'); icon.setAttribute('aria-hidden', 'true'); t.appendChild(icon); }
    var body = el('div', 'pulse-toast__body'); body.appendChild(el('span', 'pulse-toast__title', o.title || ''));
    if (o.text) body.appendChild(el('span', 'pulse-toast__text', o.text));
    if (o.action) {
      var a = el(o.action.href ? 'a' : 'button', 'pulse-toast__cta', o.action.label);
      if (o.action.href) a.href = o.action.href; else { a.type = 'button'; a.style.cssText = 'border:0;background:none;padding:0'; }
      if (o.action.onClick) a.addEventListener('click', o.action.onClick);
      body.appendChild(a);
    }
    t.appendChild(body);
    var x = el('button', 'pulse-dismiss'); x.type = 'button'; x.setAttribute('aria-label', 'Dismiss');
    var xi = el('i', 'pulse-icon pulse-icon--x'); xi.setAttribute('aria-hidden', 'true'); x.appendChild(xi); t.appendChild(x);
    toaster.appendChild(t);
    raiseToaster();
    var ms = o.duration == null ? 5000 : o.duration, timer = null;
    function start() { if (ms > 0) timer = setTimeout(function () { t.remove(); tidy(); }, ms); }
    function stop() { clearTimeout(timer); }
    t.addEventListener('mouseenter', stop); t.addEventListener('mouseleave', start);
    t.addEventListener('focusin', stop); t.addEventListener('focusout', start);
    start();
    return t;
  }
  // A modal dialog makes everything outside it inert, popovers included, so the toaster moves into the top open modal
  // (and back to <body> when none is open). Shown again so it sits above anything opened since.
  function topModal() { var all = [].filter.call(document.querySelectorAll('dialog[open]'), function (d) { try { return d.matches(':modal'); } catch (err) { return false; } }); return all[all.length - 1] || null; }
  function raiseToaster() {
    if (!toaster) return;
    var home = topModal() || document.body;
    if (toaster.parentNode !== home) {
      if (native) { try { toaster.hidePopover(); } catch (err) {} }
      home.appendChild(toaster);
      if (home !== document.body) home.addEventListener('close', function back() { home.removeEventListener('close', back); if (toaster.children.length) setTimeout(raiseToaster, 0); else { toaster.remove(); toaster = null; } });
    }
    if (native) { try { if (toaster.matches(':popover-open')) toaster.hidePopover(); toaster.showPopover(); } catch (err) {} }
  }
  function tidy() { if (toaster && native && !toaster.children.length) { try { toaster.hidePopover(); } catch (err) {} } }
  window.Pulse.toast = toast;
  document.addEventListener('click', function (e) {
    var t = tgt(e); if (!t || !t.closest) return;
    var trig = t.closest('[data-pulse-toast]');
    if (trig) { toast({ title: trig.getAttribute('data-pulse-toast'), text: trig.getAttribute('data-pulse-toast-text'), tone: trig.getAttribute('data-pulse-toast-tone') || undefined }); return; }
    var x = t.closest('.pulse-dismiss'), box = x && x.closest('.pulse-alert, .pulse-toast');
    if (box && box.dispatchEvent(new CustomEvent('pulse:dismiss', { bubbles: true, cancelable: true }))) { box.remove(); tidy(); }
  });

  // Esc for a dialog or drawer opened beside the page (data-modal="false" or the page's own show()): the browser only gives Esc to
  // modal dialogs. Closes the most recent one, unless a modal dialog is open, a popover or menu took the key, or something inside
  // already handled it; focus goes back to whatever opened it.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    openDialogs = openDialogs.filter(function (d) { return d.open; });
    if (document.querySelector('dialog:modal') || openDialogs.some(function (d) { return d.matches(':modal'); })) return;
    var roots = [document].concat(openDialogs.map(function (d) { return d.getRootNode(); }));
    if (roots.some(function (r) { return r.querySelector && r.querySelector('.pulse-popover:popover-open, .pulse-popover.is-open'); })) return;
    var panels = openDialogs.filter(isPulseDialog), d = panels[panels.length - 1];
    if (!d) return;
    e.preventDefault();
    var o = d._pulseOpener;
    d.close();
    if (o && o.isConnected && o.focus) o.focus();
  });

  // Pulse.confirm({ title, body, resource, action, cancel }): the destructive dialog, built by Pulse (no markup needed). Resolves
  // true on the destructive button, false on Cancel, Esc, the X or a click on the dimmed page. Cancel has focus on open; focus
  // returns to what opened it. Text goes in as text, never HTML.
  var confirmSeq = 0;
  function confirmDialog(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var n = ++confirmSeq, d = document.createElement('dialog'), ok = false;
      d.className = 'pulse-dialog';
      d.setAttribute('aria-labelledby', 'pulse-confirm-title-' + n);
      d.setAttribute('aria-describedby', 'pulse-confirm-body-' + n);
      d.innerHTML =
        '<div class="pulse-dialog__head"><div class="pulse-dialog__copy">' +
          '<h2 class="pulse-dialog__title" id="pulse-confirm-title-' + n + '"></h2><p class="pulse-dialog__body" id="pulse-confirm-body-' + n + '"></p></div>' +
          '<button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm pulse-dialog__close" type="button" aria-label="Close" data-x>' +
          '<i class="pulse-icon pulse-icon--x" aria-hidden="true"></i></button></div>' +
        '<div class="pulse-dialog__resource" hidden></div>' +
        '<div class="pulse-dialog__actions"><button class="pulse-btn pulse-btn--secondary" type="button" data-no autofocus></button>' +
          '<button class="pulse-btn pulse-btn--destructive" type="button" data-yes></button></div>';
      d.querySelector('.pulse-dialog__title').textContent = opts.title || 'Are you sure?';
      var body = d.querySelector('.pulse-dialog__body');
      if (opts.body) body.textContent = opts.body; else { body.remove(); d.removeAttribute('aria-describedby'); }
      var res = d.querySelector('.pulse-dialog__resource');
      if (opts.resource) { res.textContent = opts.resource; res.hidden = false; }
      d.querySelector('[data-no]').textContent = opts.cancel || 'Cancel';
      d.querySelector('[data-yes]').textContent = opts.action || 'Delete';
      d.addEventListener('click', function (e) {
        var t = e.target;
        if (t.closest('[data-yes]')) { ok = true; d.close(); }
        else if (t.closest('[data-no], [data-x]') || t === d) d.close();
      });
      d.addEventListener('close', function () { d.remove(); resolve(ok); }, { once: true });
      document.body.appendChild(d);
      d.showModal();
    });
  }
  window.Pulse.confirm = confirmDialog;

  // Pulse.loading(task, { delay }): the page-wide cover (a large spinner over a dim page, in the top layer, above open panels)
  // while an async task runs. task is a function returning a promise, or a promise. The cover stays at least delay ms (200 by
  // default, so it doesn't flash) and overlapping tasks share it: it goes when the last one ends. Returns the task's result (or
  // its error). Pulse.cover(element): the same over one box; returns the cover, whose remove() takes it away.
  var pageCover = null, coverCount = 0;
  function raiseCover() {
    if (!pageCover || !coverCount || !native) return;
    try { if (pageCover.matches(':popover-open')) pageCover.hidePopover(); pageCover.showPopover(); } catch (err) {}
  }
  function loading(task, opts) {
    var delay = opts && opts.delay != null ? opts.delay : 200;
    if (!pageCover) {
      pageCover = document.createElement('div');
      pageCover.className = 'pulse-spinner-cover';
      if (native) pageCover.setAttribute('popover', 'manual'); else pageCover.style.cssText = 'position:fixed;inset:0;z-index:2000';
      pageCover.innerHTML = '<span class="pulse-spinner pulse-spinner--lg" role="status" aria-label="Loading"></span>';
    }
    if (!pageCover.isConnected) document.body.appendChild(pageCover);
    coverCount++;
    if (native) raiseCover(); else pageCover.hidden = false;
    var work;
    try { work = Promise.resolve(typeof task === 'function' ? task() : task); } catch (err) { work = Promise.reject(err); }
    var wait = new Promise(function (r) { setTimeout(r, delay); });
    function done() {
      if (--coverCount > 0) return;
      coverCount = 0;
      if (native) { try { pageCover.hidePopover(); } catch (err) {} } else pageCover.hidden = true;
    }
    return Promise.all([work, wait]).then(function (r) { done(); return r[0]; }, function (err) { return wait.then(function () { done(); throw err; }); });
  }
  function cover(el) {
    var c = document.createElement('div'), moved = false;
    c.className = 'pulse-spinner-cover';
    c.innerHTML = '<span class="pulse-spinner" role="status" aria-label="Loading"></span>';
    if (getComputedStyle(el).position === 'static') { el.style.position = 'relative'; moved = true; }
    el.appendChild(c);
    var rm = c.remove.bind(c);
    c.remove = function () { rm(); if (moved) el.style.position = ''; };
    return c;
  }
  window.Pulse.loading = loading;
  window.Pulse.cover = cover;

  function initAll(root) { root = root && root.querySelectorAll ? root : document; initTabs(root); initMenus(root); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll); else initAll();
})();
