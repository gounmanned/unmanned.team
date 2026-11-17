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
     Pulse.toast({ title: 'Report exported', text: '…', tone: 'success', action: { label: 'View', href: '…' }, duration: 5000 })
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
  document.addEventListener('input', function (e) { if (e.target && e.target.classList && e.target.classList.contains('pulse-slider__input')) syncSlider(e.target); });
  function syncAll() { [].forEach.call(document.querySelectorAll('.pulse-slider__input'), syncSlider); }
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
    var tab = e.target.closest && e.target.closest('[role="tab"]');
    if (tab && isPulseTab(tab) && tab.getAttribute('aria-disabled') !== 'true') selectTab(tab, false);
  });
  document.addEventListener('keydown', function (e) {
    var tab = e.target.closest && e.target.closest('[role="tab"]'), list = isPulseTab(tab);
    if (!list) return;
    var tabs = tabsOf(list), i = tabs.indexOf(tab), vertical = list.getAttribute('aria-orientation') === 'vertical';
    var next = { ArrowRight: !vertical && 1, ArrowLeft: !vertical && -1, ArrowDown: vertical && 1, ArrowUp: vertical && -1 }[e.key];
    var to = next ? tabs[(i + next + tabs.length) % tabs.length] : e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : null;
    if (to) { e.preventDefault(); selectTab(to, true); }
  });
  function initTabs() {
    [].forEach.call(document.querySelectorAll('.pulse-tabs[role="tablist"]'), function (list) {
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
    if (m.getAttribute('role') === 'listbox') {
      if (!m.hasAttribute('tabindex')) m.tabIndex = -1;
      var opts = options(m); setActive(m, opts.filter(function (o) { return o.getAttribute('aria-selected') === 'true'; })[0] || opts[0]);
      m.focus();
    }
  }
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
    var t = e.target; if (!t.closest) return;
    var btn = t.closest('[data-pulse-menu]');
    if (btn) { e.preventDefault(); btn.getAttribute('aria-expanded') === 'true' ? closeMenu(btn, false) : openMenu(btn); return; }
    var opt = t.closest('[role="option"]'), lb = opt && opt.closest('[role="listbox"]');
    if (opt && lb && openMenus.some(function (b) { return menuOf(b) === lb; }) && opt.getAttribute('aria-disabled') !== 'true') { choose(lb, opt); return; }
    openMenus.slice().forEach(function (b) { var m = menuOf(b); if (!(m && m.contains(t))) closeMenu(b, false); });
  });
  document.addEventListener('keydown', function (e) {
    if (!openMenus.length) return;
    var btn = openMenus[openMenus.length - 1], m = menuOf(btn);
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(btn, true); return; }
    if (!m || m.getAttribute('role') !== 'listbox' || document.activeElement !== m) return;
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
      if (to !== b && !(m && m.contains(to)) && (b.contains(e.target) || (m && m.contains(e.target)))) closeMenu(b, false);
    });
  });
  function initMenus() {
    [].forEach.call(document.querySelectorAll('[data-pulse-menu]'), function (b) {
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
    if (!toaster || !toaster.isConnected) { toaster = el('div', 'pulse-toaster'); document.body.appendChild(toaster); }
    var t = el('div', 'pulse-toast' + (tone === 'info' ? '' : ' pulse-toast--' + tone));
    t.setAttribute('role', tone === 'danger' ? 'alert' : 'status');
    var icon = el('i', 'pulse-icon pulse-icon--' + ICON[tone] + ' pulse-icon--fill'); icon.setAttribute('aria-hidden', 'true'); t.appendChild(icon);
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
    var ms = o.duration == null ? 5000 : o.duration, timer = null;
    function start() { if (ms > 0) timer = setTimeout(function () { t.remove(); }, ms); }
    function stop() { clearTimeout(timer); }
    t.addEventListener('mouseenter', stop); t.addEventListener('mouseleave', start);
    t.addEventListener('focusin', stop); t.addEventListener('focusout', start);
    start();
    return t;
  }
  window.Pulse.toast = toast;
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t.closest) return;
    var trig = t.closest('[data-pulse-toast]');
    if (trig) { toast({ title: trig.getAttribute('data-pulse-toast'), text: trig.getAttribute('data-pulse-toast-text'), tone: trig.getAttribute('data-pulse-toast-tone') || undefined }); return; }
    var x = t.closest('.pulse-dismiss'), box = x && x.closest('.pulse-alert, .pulse-toast');
    if (box && box.dispatchEvent(new CustomEvent('pulse:dismiss', { bubbles: true, cancelable: true }))) box.remove();
  });

  function initAll() { initTabs(); initMenus(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll); else initAll();
})();
