// The VEX shell, moved to Pulse: a copy of cdn/js/components.js (David's) inside staging/, so other pages that load the CDN
// shell are not affected. If it should replace the CDN file instead, it can move there.
// Same elements and the same methods VEX calls (show, hide, setAccount, SiteSpinner.withLoading/cover/inline,
// site-overlay.click()), so nothing else in VEX had to change for it.
//
// What changed:
// - Sidebars are Pulse XL drawers, rollups are Pulse screen drawers, the modal is a Pulse dialog (native <dialog>s, modal).
// - The header is Pulse's app header; the spinner is Pulse's spinner and cover.
// - Pulse's dimmed backdrop replaces <site-overlay>'s drawing; <site-overlay> stays as VEX's "close everything" switch.
// - Esc and a click on the dimmed page close a panel (as VEX's overlay click did: everything closes).
// - No hard-coded colors: the pink glow is gone (Pulse elevation instead); every color is a Pulse token.

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

    // A non-modal panel doesn't get the browser's Esc, so catch it here (unless a menu or another dialog inside took it).
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || this.modal || !this._dialog.open) return;
      if (document.querySelector('dialog:modal') || this.shadowRoot.querySelector('dialog:modal')) return;
      this._dialog.close();
    });

    // Closed by the person (Esc, backdrop, X), not by hide(): close everything, as VEX's overlay click did.
    // ('close' fires after close() returns, so hide() leaves the flag for this handler to clear.)
    this._dialog.addEventListener('close', () => {
      if (this._hiding) { this._hiding = false; return; }
      document.querySelector('site-overlay')?.click();
    });
  }

  // modal="false" (the signal panel, Chad 2026-11-23, as production and Linear, Jira, Gmail): no dimming, the page stays usable
  // beside it (another signal swaps the panel), Esc still closes it. Settings, Recovery and confirms stay modal.
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
    SiteSpinner.raise();
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
        .pulse-app-header { position: static; width: 100%; padding-inline: var(--space-32); }   /* the page's inset: the mark lines up with the content (2026-11-23) */
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

// Pulse's spinner (batch 2026-11-19), same API as VEX's: the page-wide one is a manual popover cover (top layer, above
// panels); [cover] covers its parent; [inline] is a small ring in text. No shadow root: Pulse's classes style it.
class SiteSpinner extends HTMLElement {
    static inline = '<site-spinner inline></site-spinner>';
    static #pending = 0;

    connectedCallback() {
        if (this.hasAttribute('inline')) {
            this.className = 'pulse-spinner pulse-spinner--sm';
            this.setAttribute('role', 'status');
            this.setAttribute('aria-label', 'Loading');
            return;
        }
        this.className = 'pulse-spinner-cover';
        if (!this.hasAttribute('cover')) this.setAttribute('popover', 'manual');
        this.innerHTML = `<span class="pulse-spinner ${this.hasAttribute('cover') ? '' : 'pulse-spinner--lg'}" role="status" aria-label="Loading"></span>`;
    }

    show() {
        clearTimeout(this.timer);
        this.setAttribute('active', '');
        this.#top();
    }

    hide() { this.#off(); }   // GAP: VEX's ring ended on a check; Pulse's spinner has no "done" state.

    #top() {
        if (!this.popover) return;
        if (this.matches(':popover-open')) this.hidePopover();
        this.showPopover();
    }

    #off() {
        this.removeAttribute('active');
        if (this.popover && this.matches(':popover-open')) this.hidePopover();
    }

    // A panel just opened above the page-wide spinner: put the spinner back on top while it's active.
    static raise() {
        const spinner = document.querySelector('site-spinner:not([inline], [cover])');
        if (spinner?.hasAttribute('active')) spinner.#top();
    }

    static async withLoading(operation, delay = 200) {
        const spinner = document.querySelector('site-spinner:not([inline], [cover])');
        SiteSpinner.#pending++;
        spinner.show();
        try {
            const [result] = await Promise.all([operation(), new Promise(r => setTimeout(r, delay))]);
            return result;
        } finally {
            if (--SiteSpinner.#pending === 0) spinner.hide();
        }
    }

    static cover(el) {
        const spinner = document.createElement('site-spinner');
        spinner.setAttribute('cover', '');
        return el.appendChild(spinner);
    }
}

// Pulse's dialog backdrop dims the page now; this element only keeps VEX's "close everything" switch
// (VEX calls document.querySelector('site-overlay').click() after an action).
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

// Sidebars: Pulse's XL drawer (half the window, 640 to 800px).
// Side panels are Pulse's XL drawer; size="standard" gives Pulse's standard width (a short list, like settings).
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

// Rollups: Pulse's screen drawer (rises from the bottom, full width, stops just short of the top, square).
// (Chad, 2026-11-19): the accounts screen is a page, full height. On first load it's simply there
// (no slide); opened from the app it rises like Pulse's screen drawer, and choosing an account slides it down out of the way,
// as in production. Pulse turns the motion off for reduced motion. While the host has [locked] (nothing to go back to), Esc
// doesn't close it.
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
customElements.define('site-spinner', SiteSpinner);
customElements.define('site-overlay', SiteOverlay);
customElements.define('site-modal', SiteModal);
customElements.define('site-sidebar', SiteSidebar);
customElements.define('site-rollup', SiteRollup);
