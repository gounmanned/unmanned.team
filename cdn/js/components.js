class SiteHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 52px;
          z-index: 10;
          background: color-mix(in srgb, var(--surface) var(--glass-opacity, 72%), transparent);
          -webkit-backdrop-filter: var(--glass-blur, blur(24px) saturate(180%));
          backdrop-filter: var(--glass-blur, blur(24px) saturate(180%));
          border-bottom: 1px solid var(--line);
        }
        .header-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 40px;
          height: 100%;
        }
        .logo-area {
          display: flex;
          align-items: center;
          gap: 18px;
          flex-shrink: 0;
        }
        .brand {
          display: flex;
          align-items: center;
          padding-right: 8px;
          gap: 4px;
          text-decoration: none;
          color: var(--text-body);
        }
        .brand img {
          height: 22px;
          width: 22px;
          object-fit: contain;
        }
        .brand span {
          font-size: 0.95rem;
          font-weight: 700;
          letter-spacing: 0.01em;
        }
        .divider {
          width: 1px;
          height: 24px;
          background: var(--line);
          flex-shrink: 0;
        }
        .account-group {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .account-group:hover {
          background: var(--surface-alt);
        }
        .account-name {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-body);
        }
        ::slotted([slot="account-switcher"]) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          padding: 0;
          border: none;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          pointer-events: none;
        }
        nav {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        @media (max-width: 768px) {
          nav { display: none; }
        }
      </style>

      <div class="header-container">
        <div class="logo-area">
          <a class="brand" href="/">
            <img class="brand-logo" src="https://cdn.unmanned.team/img/logo.png"/>
            <span class="brand-name">VEX</span>
          </a>
          <span class="divider"></span>
          <span class="account-group">
            <span class="account-name"></span>
            <slot name="account-switcher"></slot>
          </span>
        </div>
        <nav>
          <slot></slot>
        </nav>
      </div>
    `;

    this.shadowRoot.querySelector('.account-group').addEventListener('click', () => {
      const switcher = this.shadowRoot
        .querySelector('slot[name="account-switcher"]')
        .assignedElements()[0];
      switcher?.click();
    });
  }

  setAccount(name) {
    this.shadowRoot.querySelector('.account-name').textContent = name;
  }
}

class SiteSpinner extends HTMLElement {
    static inline = '<site-spinner inline></site-spinner>';
    static #pending = 0;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = `
            <style>
                :host { --size: 56px; --width: 4px; --speed: 0.65s; }

                :host(:not([inline], [cover])) {
                    position: fixed; inset: 0; z-index: 9999;
                    display: none; place-items: center;
                    background: rgb(255 255 255 / 0.5);
                }
                :host([active]) { display: grid; }

                :host([cover]) {
                    --size: 20px; --width: 2px;
                    position: absolute; inset: 0;
                    display: grid; place-items: center;
                    pointer-events: none;
                }

                :host([inline]) {
                    --size: 0.85em; --width: 1.5px;
                    display: inline-grid;
                    vertical-align: -0.1em;
                }

                .ring {
                    box-sizing: border-box;
                    display: grid; place-items: center;
                    width: var(--size); height: var(--size);
                    border: var(--width) solid color-mix(in srgb, var(--brand) 15%, transparent);
                    border-top-color: var(--brand);
                    border-radius: 50%;
                    animation: spin var(--speed) linear infinite;
                }

                svg { display: none; width: 50%; color: var(--brand); }
                :host([done]) .ring { border-color: var(--brand); animation: none; }
                :host([done]) svg { display: block; }

                @keyframes spin { to { transform: rotate(360deg); } }
                @media (prefers-reduced-motion: reduce) { :host { --speed: 2s; } }
            </style>

            <div class="ring">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
        `;
    }

    show() {
        clearTimeout(this.timer);
        this.removeAttribute('done');
        this.setAttribute('active', '');
    }

    hide(ok) {
        if (!ok) return this.removeAttribute('active');
        this.setAttribute('done', '');
        this.timer = setTimeout(() => this.removeAttribute('active'), 250);
    }

    static async withLoading(operation, delay = 200) {
        const spinner = document.querySelector('site-spinner:not([inline], [cover])');
        let ok = false;

        SiteSpinner.#pending++;
        spinner.show();

        try {
            const [result] = await Promise.all([operation(), new Promise(r => setTimeout(r, delay))]);
            ok = true;
            return result;
        } finally {
            if (--SiteSpinner.#pending === 0) spinner.hide(ok);
        }
    }

    static cover(el) {
        const spinner = document.createElement('site-spinner');
        spinner.setAttribute('cover', '');
        return el.appendChild(spinner);
    }
}

class SiteOverlay extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    window.addEventListener('window-click', () => this.show());

    this.shadowRoot.innerHTML = `
      <style>
      .overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(10, 10, 10, 0.15);
        backdrop-filter: blur(2px);
        z-index: 999;
        display: none;
      }

      .overlay.active {
        display: block;
      }
      @media (max-width: 1024px) {
        .overlay.active {
          display: none;
        }
      }
      </style>
      <div class="overlay" id="overlay"></div>
    `;

    const overlay = this.shadowRoot.getElementById('overlay');

    overlay.addEventListener('click', (ev) => {
      if (ev.target !== overlay) return;

      this.hide();

      this.dispatchEvent(new CustomEvent('overlay-click', {
        bubbles: true,
        composed: true
      }));
    });
  }

  show() {
    this.shadowRoot.getElementById('overlay').classList.add('active');
  }

  hide() {
    this.shadowRoot.getElementById('overlay').classList.remove('active');
  }

  click() {
    this.hide();
    this.dispatchEvent(new CustomEvent('overlay-click', {
      bubbles: true,
      composed: true
    }));
  }
}

class SiteModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    window.addEventListener('overlay-click', () => this.hide());

    this.shadowRoot.innerHTML = `
      <style>
      .modal {
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.95);
        width: 40%;
        max-height: 90vh;
        flex-direction: column;
        background-color: var(--surface);
        z-index: 1002;
        opacity: 0;
        pointer-events: none;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 0 20px rgba(224, 18, 128, 0.5), 0 0 40px rgba(224, 18, 128, 0.2);
        overflow: hidden;
        color: var(--text-body);
      }

      .modal.open {
        display: flex;
        opacity: 1;
        pointer-events: auto;
        transform: translate(-50%, -50%) scale(1);
      }

      @media (max-width: 1024px) {
        .modal {
          height: 100%;
          width: 100%;
        }
      }
      </style>

      <div class="modal" role="dialog" part="modal" aria-modal="true">
        <slot></slot>
      </div>
    `;

    this._modal = this.shadowRoot.querySelector('.modal');
  }

  show() {
    this._modal.classList.add('open');
    this.dispatchEvent(new CustomEvent('window-click', { bubbles: true, composed: true }));
  }

  hide() {
    this._modal.classList.remove('open');
  }
}

class SiteSidebar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    window.addEventListener('overlay-click', () => this.hide());

    this.shadowRoot.innerHTML = `
      <style>
      .sidebar {
        position: fixed;
        bottom: 0;
        right: 0;
        width: 50%;
        height: 100vh;
        display: flex;
        justify-content: center;
        flex-direction: column;
        background-color: var(--surface);
        box-shadow: 0 0 5px rgba(224, 18, 128, 0.5), 0 0 40px rgba(224, 18, 128, 0.2);
        z-index: 1001;
        transform: translateX(100%);
      }

      .sidebar.open {
        transform: translateX(0);
      }

      ::slotted(.container) {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
      }

      ::slotted(.sidebar-actions) {
        flex-shrink: 0;
        margin-top: auto;
      }

      @media (max-width: 1024px) {
        .sidebar {
          width: 100%;
        }
      }
      </style>

      <div class="sidebar" role="dialog" aria-modal="true">
        <slot></slot>
      </div>
    `;

    this._sidebar = this.shadowRoot.querySelector('.sidebar');
  }

  show() {
    this._sidebar.classList.add('open');
    this.dispatchEvent(new CustomEvent('window-click', { bubbles: true, composed: true }));
  }

  hide() {
    this._sidebar.classList.remove('open');
  }
}

class SiteRollup extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    window.addEventListener('overlay-click', () => this.hide());

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: contents;
        }
        .rollup {
          position: fixed;
          bottom: 0;
          left: 0;
          width: 100%;
          height: var(--rollup-height, 90%);
          display: flex;
          flex-direction: column;
          background-color: var(--surface);
          border-top: 1px solid var(--line);
          box-shadow: 0 0 5px rgba(224, 18, 128, 0.5), 0 0 40px rgba(224, 18, 128, 0.2);
          z-index: 1000;
          visibility: hidden;
          transform: translateY(100%);
          overflow: hidden;
          transition: transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1), visibility 0.26s;
        }
        .rollup.open {
          visibility: visible;
          transform: translateY(0);
        }
        @media (max-width: 1024px) {
          .rollup {
            height: 100%;
          }
        }
      </style>
      <div class="rollup" role="dialog" aria-modal="true">
        <slot></slot>
      </div>
    `;

    this._rollup = this.shadowRoot.querySelector('.rollup');
  }

  show() {
    this._rollup.classList.add('open');
    this.dispatchEvent(new CustomEvent('window-click', { bubbles: true, composed: true }));
  }

  hide() {
    this._rollup.classList.remove('open');
  }
}

customElements.define('site-header', SiteHeader);
customElements.define('site-spinner', SiteSpinner);
customElements.define('site-overlay', SiteOverlay);
customElements.define('site-modal', SiteModal);
customElements.define('site-sidebar', SiteSidebar);
customElements.define('site-rollup', SiteRollup);