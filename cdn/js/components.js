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
          top: var(--header-offset, 0);
          left: 0; right: 0;
          height: 52px;
          z-index: 10;
          background: var(--gray-panel);
          border-bottom: 1px solid var(--gray-line);
        }
        .header-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 32px;
          height: 100%;
        }
        .logo-area {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .logo-area img {
          height: 24px;
          width: 24px;
          object-fit: contain;
        }
        .company-name {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--ink, #1e293b);
        }
        .tagline {
          font-size: 0.9rem;
          color: var(--gray-mid, #6b7280);
          margin-left: 6px;
        }
        nav {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        ::slotted(h4) {
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          color: var(--ink, #1e293b);
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 4px 10px;
          transition: color 0.15s, border-color 0.15s;
        }
        ::slotted(h4:hover) {
          color: var(--pink, #e01280);
          border-color: var(--pink, #e01280);
        }
        @media (max-width: 768px) {
          nav { display: none; }
        }
      </style>

      <div class="header-container">
        <div class="logo-area">
          <img src="${this.getAttribute('logo') ?? 'https://cdn.unmanned.team/img/logo.png'}">
          <span class="company-name"></span>
          <span class="tagline"></span>
        </div>
        <nav>
          <slot></slot>
        </nav>
      </div>
    `;
  }

  setCompany(name, tagline) {
    this.shadowRoot.querySelector('.company-name').textContent = name;
    this.shadowRoot.querySelector('.tagline').textContent = tagline ?? '';
  }
}

class SiteSpinner extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
            .spinner-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                display: none;
            }
            .spinner {
                width: 60px;
                height: 60px;
                border: 6px solid #ccc;
                border-top: 6px solid var(--pink, #e01280);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .spinner.success {
                border: 6px solid var(--pink, #e01280);
                animation: none;
            }
            .checkmark {
                display: none;
                width: 30px;
                height: 30px;
            }
            .checkmark.show {
                display: block;
            }
            @keyframes spin {
                to {
                transform: rotate(360deg);
                }
            }
            </style>

            <div id="spinner" class="spinner-overlay">
                <div class="spinner">
                    <svg class="checkmark" viewBox="0 0 24 24" fill="none" stroke="var(--pink, #e01280)" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
            </div>
        `;
    }

    show() {
        this.shadowRoot.getElementById('spinner').style.display = 'flex';
    }

    hide() {
        const overlay = this.shadowRoot.getElementById('spinner');
        const spinner = this.shadowRoot.querySelector('.spinner');
        const checkmark = this.shadowRoot.querySelector('.checkmark');

        spinner.classList.add('success');
        checkmark.classList.add('show');

        setTimeout(() => {
            overlay.style.display = 'none';
            spinner.classList.remove('success');
            checkmark.classList.remove('show');
        }, 250);
    }

    static async withLoading(operation, delay = 200) {
        const spinner = document.querySelector("site-spinner");
        try {
            spinner.show();
            const [result] = await Promise.all([
                operation(),
                new Promise(resolve => setTimeout(resolve, delay))
            ]);
            return result;
        } finally {
            spinner.hide();
        }
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
                background: rgba(255, 255, 255, 0.15);
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

    click(){
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
                width: var(--modal-width, 40%);
                max-height: 90vh;
                flex-direction: column;
                background-color: white;
                z-index: 1002;
                opacity: 0;
                pointer-events: none;
                padding: 2rem;
                border-radius: 8px;
                box-shadow: 0 0 20px rgba(224, 18, 128, 0.5), 0 0 40px rgba(224, 18, 128, 0.2);
                overflow: hidden;
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

        this.dispatchEvent(new CustomEvent('window-click', {
            bubbles: true,
            composed: true
        }));
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
                background-color: var(--white, #FAF9F6);
                box-shadow: 0 0 5px rgba(224, 18, 128, 0.5), 0 0 40px rgba(224, 18, 128, 0.2);
                z-index: 1001;
                transform: translateX(100%);
            }

            .sidebar.open {
                transform: translateX(0);
            }

            ::slotted(.sidebar-container) {
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

        this.dispatchEvent(new CustomEvent('window-click', {
            bubbles: true,
            composed: true
        }));
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
                    height: 90%;
                    display: flex;
                    flex-direction: column;
                    background-color: var(--gray-soft, #fff);
                    box-shadow: 0 0 5px rgba(224, 18, 128, 0.5), 0 0 40px rgba(224, 18, 128, 0.2);
                    z-index: 1000;
                    visibility: hidden;
                    transform: translateY(100%);
                    overflow: hidden;
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
        
        this.dispatchEvent(new CustomEvent('window-click', {
            bubbles: true,
            composed: true
        }));
    }

    hide() {
        this._rollup.classList.remove('open');
    }
}

class SiteWatermark extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    position: absolute;
                    inset: 0;
                    z-index: 10;
                    display: block;
                }
                .watermark-overlay {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    gap: 20px;
                    background: var(--gray-soft, #fff);
                    opacity: 1;
                    visibility: visible;
                }
                .watermark-overlay.hidden {
                    opacity: 0;
                    visibility: hidden;
                    pointer-events: none;
                }
                .watermark-content {
                    max-width: 480px;
                    padding: 0 24px;
                }
                .watermark-logo {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                .watermark-logo img {
                    height: 48px;
                    opacity: 0.7;
                    object-fit: contain;
                }
                .watermark-title {
                    font-size: 18px;
                    color: #374151;
                    margin: 0;
                    font-weight: 500;
                    line-height: 1.4;
                }
                .watermark-subtitle {
                    font-size: 16px;
                    color: #9ca3af;
                    margin: 6px 0 0;
                    line-height: 1.5;
                }
            </style>
            <div class="watermark-overlay">
                <div class="watermark-content">
                    <div class="watermark-logo">
                    <img src="">
                    </div>
                    <p class="watermark-title"></p>
                    <p class="watermark-subtitle"></p>
                </div>
            </div>
        `;

        this._overlay  = this.shadowRoot.querySelector('.watermark-overlay');
        this._title    = this.shadowRoot.querySelector('.watermark-title');
        this._subtitle = this.shadowRoot.querySelector('.watermark-subtitle');
        this.shadowRoot.querySelector('.watermark-logo img').src = this.getAttribute('logo') ?? '';
        this._title.textContent = this.getAttribute('title') ?? '';
    }

    show(text) {
        this._subtitle.textContent = text ?? '';
        this._overlay.classList.remove('hidden');
        this.style.pointerEvents = '';
    }

    hide() {
        this._overlay.classList.add('hidden');
        this.style.pointerEvents = 'none';
    }
}

customElements.define('site-header', SiteHeader);
customElements.define('site-spinner', SiteSpinner);
customElements.define('site-overlay', SiteOverlay);
customElements.define('site-modal', SiteModal);
customElements.define('site-sidebar', SiteSidebar);
customElements.define('site-rollup', SiteRollup);
customElements.define('site-watermark', SiteWatermark);
