// The VEX shell on Pulse: the app header and the panels VEX opens (side panels, screens, the modal).
// Each panel is a Pulse dialog or drawer in a shadow root; Pulse's pulse.js gives them focus, Esc, backdrop and the loading
// cover. This file keeps what is VEX's own: the account switcher, and closing everything after an action (<site-overlay>).

const PULSE_CSS = ['pulse-tokens.css', 'pulse-icons.css', 'pulse-components.css'].map(f => 'https://cdn.unmanned.team/pulse/v1/' + f)
  .map(href => `<link rel="stylesheet" href="${href}">`).join('');

// Shared by the shell's dialogs: open modal, close, and tell VEX when the person closed it (Esc, backdrop).
class ShellDialog extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    window.addEventListener('overlay-click', () => this.hide());
    this.shadowRoot.innerHTML = PULSE_CSS + this.template();
    this._dialog = this.shadowRoot.querySelector('dialog');
    if (window.Pulse?.attach) window.Pulse.attach(this.shadowRoot);
    else document.addEventListener('DOMContentLoaded', () => window.Pulse?.attach(this.shadowRoot), { once: true });

    // A click on the dimmed page: pulse.js handles it for drawers; the rest do it here.
    if (!this._dialog.classList.contains('pulse-drawer')) {
      this._dialog.addEventListener('click', (e) => { if (e.target === this._dialog) this._dialog.close(); });
    }

    // The head's close X ([data-pulse-close] in this panel's light-DOM content, which pulse.js can't tie to a dialog inside
    // the shadow root) closes it the same way as Esc.
    this.addEventListener('click', (e) => {
      const btn = e.target.closest?.('[data-pulse-close]');
      if (btn && this.contains(btn) && this._dialog.open) this._dialog.close();
    });

    // Closed by the person (Esc, backdrop, X), not by hide(): close everything, as VEX's overlay click did.
    // ('close' fires after close() returns, so hide() leaves the flag for this handler to clear.)
    this._dialog.addEventListener('close', () => {
      if (this._hiding) { this._hiding = false; return; }
      document.querySelector('site-overlay')?.click();
    });
  }

  // modal="false": no dimming, the page stays usable beside the panel (another signal swaps it) and Esc still closes it.
  get modal() { return this.getAttribute('modal') !== 'false'; }

  show() {
    if (!this._dialog.open) {
      if (this.modal) this._dialog.showModal();
      else {
        this._dialog.show();
        this._dialog.querySelector('slot')?.assignedElements().find(el => el.matches('.pulse-drawer__head, header'))
          ?.querySelector('.pulse-drawer__title')?.focus({ preventScroll: true });
      }
    }
    this.dispatchEvent(new CustomEvent('window-click', { bubbles: true, composed: true }));
  }

  hide() {
    if (!this._dialog?.open) return;
    this._hiding = true;
    this._dialog.close();
  }
}

class SiteHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  // Pulse's app header. The mark and an optional wide logo come from Pulse's brand tokens, so nothing patches them.
  // VEX's own parts: the account switcher and the actions slot.
  connectedCallback() {
    this.shadowRoot.innerHTML = PULSE_CSS + `
      <style>
        :host { display: block; position: fixed; inset: 0 0 auto 0; z-index: 10; }
        .pulse-app-header { position: static; width: 100%; padding-inline: var(--space-32); }   /* the page's inset: the mark lines up with the content */
        .divider { flex: none; width: var(--border-width-1); height: 20px; background: var(--color-border-default); }
        .account-group {
          display: flex; align-items: center; gap: var(--space-4);
          margin-left: calc(-1 * var(--space-8)); padding: var(--space-4) var(--space-8);
          border-radius: var(--radius-control); cursor: pointer; transition: background-color 0.15s;
        }
        .account-group:hover { background: var(--color-interactive-hover); }
        .account-name { font: 500 var(--type-label-md-size) / 1 var(--font-sans); color: var(--color-text-primary); }
        ::slotted([slot="account-switcher"]) {
          display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; padding: 0;
          border: none; background: transparent; color: inherit; pointer-events: none;
        }
        @media (max-width: 768px) {
          .pulse-app-header { padding-inline: var(--space-16); }
          .pulse-app-header__actions { display: none; }
        }
      </style>
      <header class="pulse-app-header">
        <a class="pulse-app-header__brand" href="/">
          <span class="pulse-brand-dot" aria-hidden="true"></span>
          <span class="pulse-brand-mark" role="img" aria-label="VEX"></span>
          <span class="pulse-app-header__name">VEX</span>
          <span class="pulse-brand-wide" role="img" aria-label="VEX" hidden></span>
        </a>
        <span class="divider"></span>
        <span class="account-group">
          <span class="account-name"></span>
          <slot name="account-switcher"></slot>
        </span>
        <div class="pulse-app-header__actions"><slot></slot></div>
      </header>
    `;
    if (window.Pulse?.attach) window.Pulse.attach(this.shadowRoot);

    this.shadowRoot.querySelector('.account-group').addEventListener('click', () => {
      this.shadowRoot.querySelector('slot[name="account-switcher"]').assignedElements()[0]?.click();
    });

    this.brand();
  }

  // VEX: Pulse's dot lockup. A client: mark + name, or its wide logo when its tokens set one (Pulse picks dot or mark by data-brand).
  brand() {
    const root = this.shadowRoot;
    const name = 'VEX';
    root.querySelectorAll('[role="img"]').forEach(el => el.setAttribute('aria-label', name));
    root.querySelector('.pulse-app-header__name').textContent = name;
    const wide = getComputedStyle(document.documentElement).getPropertyValue('--brand-logo-wide').trim();
    const hasWide = !!wide && wide !== 'none';
    const header = root.querySelector('.pulse-app-header');
    header.classList.toggle('has-wide', hasWide);
    root.querySelector('.pulse-brand-wide').hidden = !hasWide;
    root.querySelector('.pulse-app-header__brand > .pulse-brand-mark').hidden = hasWide;   // Pulse shows the mark in the wide slot on phones
    root.querySelector('.pulse-app-header__name').hidden = hasWide;
    root.querySelector('.pulse-brand-dot').hidden = hasWide;
  }

  setAccount(name) {
    this.shadowRoot.querySelector('.account-name').textContent = name;
  }
}

// VEX's "close everything" switch: VEX calls document.querySelector('site-overlay').click() after an action.
class SiteOverlay extends HTMLElement {
  show() {}
  hide() {}
  click() {
    this.dispatchEvent(new CustomEvent('overlay-click', { bubbles: true, composed: true }));
  }
}

class SiteModal extends ShellDialog {
  template() {
    return `<dialog class="pulse-dialog" part="modal"><slot></slot></dialog>`;
  }
}

// Side panels: Pulse's XL drawer (half the window, 640 to 800px); size="standard" gives Pulse's standard width.
class SiteSidebar extends ShellDialog {
  template() {
    return `
      <style>
        ::slotted(.container) { flex: 1; overflow-y: auto; min-height: 0; }
        ::slotted(.sidebar-actions) { flex-shrink: 0; margin-top: auto; }
      </style>
      <dialog class="pulse-drawer${this.getAttribute('size') === 'standard' ? '' : ' pulse-drawer--xl'}"><slot></slot></dialog>
    `;
  }
}

// Screens: Pulse's screen drawer (rises from the bottom, full width, stops just short of the top).
// show({ page }) makes it full height (the accounts screen); show({ instant }) skips the opening slide (first load).
// While the host has [locked] (nothing to go back to), Esc doesn't close it.
class SiteRollup extends ShellDialog {
  template() {
    return `<style>:host { display: contents; }
      dialog.pulse-drawer.is-page { height: 100%; }
      dialog.pulse-drawer.is-instant, dialog.pulse-drawer.is-instant::backdrop { transition: none; }
      @starting-style { dialog.pulse-drawer.is-instant[open] { transform: none; } }
    </style><dialog class="pulse-drawer pulse-drawer--screen"><slot></slot></dialog>`;
  }

  connectedCallback() {
    super.connectedCallback();
    // Chrome ignores a prevented 'cancel' until the person has interacted with the page, so stop the Esc key itself too.
    this._dialog.addEventListener('cancel', (e) => { if (this.hasAttribute('locked')) e.preventDefault(); });
    this._dialog.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.hasAttribute('locked')) e.preventDefault(); });
  }

  show({ page = false, instant = false } = {}) {
    if (!this._dialog.open) {
      this._dialog.classList.toggle('is-page', page);
      this._dialog.classList.toggle('is-instant', instant);
    }
    super.show();
    // Only the opening is instant: the close slides down.
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => this._dialog.classList.remove('is-instant')));
  }
}

customElements.define('site-header', SiteHeader);
customElements.define('site-overlay', SiteOverlay);
customElements.define('site-modal', SiteModal);
customElements.define('site-sidebar', SiteSidebar);
customElements.define('site-rollup', SiteRollup);
