const ACCOUNT_STATES = {
    scanning: 'Scanning',
    threat: 'Active threat',
    open: 'Waiting on decision',
    clear: 'Protected',
};

const SPINNER = '<span class="managed-spinner"></span>';

const fmt = n => n.toLocaleString();
const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;

class ManagedRollup {
    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.list = document.getElementById('managed-accounts');
        this.search = document.getElementById('managed-search');
        this.detail = document.getElementById('managed-detail');
        this.summary = new ManagedSummary();

        this.members = new Map();   // domain -> admin emails
        this.assets = new Map();    // domain -> { assets, dots }
        this.rejected = null;       // last name the server refused to create
        this.selected = null;
        this.scanning = true;
        this.counting = true;

        document.getElementById('managed-user').textContent = this.me;
        this.listen();
    }

    get me() {
        return this.state.user.email;
    }

    reset() {
        this.scanning = true;
        this.counting = true;
        this.summary.reset();
        this.render();
    }

    async reload() {
        await this.load();
        this._loadSignals();
        this._loadAssets();
    }

    async load() {
        const grants = await this.api.managed.grants(this.me);
        this.members = new Map(Object.entries(grants));
        if (!this.members.has(this.selected)) this.selected = null;
        this.render();
    }

    async _loadSignals() {
        await this.api.managed.signals(new CustomEvent('signal:managed'));
        this.scanning = false;
        this.render();
    }

    async _loadAssets() {
        this.assets = new Map();
        await this.api.managed.assets(new CustomEvent('managed:asset'));
        this.counting = false;
        this.summary.render(this.assets);
        this.render();
    }

    // ── data ────────────────────────────────────────────────────────────────

    _stats(domain) {
        const open = Object.values(this.state.signals[domain] ?? {}).filter(s => s.status.startsWith('O'));
        const threats = open.filter(s => s.metadata?.threat).length;
        const { assets = 0, dots = 0 } = this.assets.get(domain) ?? {};

        return {
            open: open.length,
            unread: open.filter(s => !s.read).length,
            threats,
            assets,
            dots,
            state: this.scanning ? 'scanning' : threats ? 'threat' : open.length ? 'open' : 'clear',
        };
    }

    _counts() {
        const states = [...this.members.keys()].map(domain => this._stats(domain).state);
        return state => states.filter(s => s === state).length;
    }

    _query() {
        return this.search.value.trim().toLowerCase();
    }

    // ── render ──────────────────────────────────────────────────────────────

    render() {
        this._renderList();
        this._renderDetail();
    }

    _renderList() {
        const query = this._query();
        const stats = new Map([...this.members.keys()].map(domain => [domain, this._stats(domain)]));

        const rows = [...stats]
            .filter(([domain]) => domain.includes(query))
            .sort(([a, x], [b, y]) => y.threats - x.threats || y.open - x.open || a.localeCompare(b))
            .map(([domain, s]) => this._row(domain, s));

        if (query && !this.members.has(query)) rows.unshift(this._createRow(query));

        this.search.closest('.managed-search').hidden = !this.members.size;
        this.list.innerHTML = this._head() + (rows.length ? rows.join('') : this._empty());
    }

    _head() {
        return `
            <li class="tenant-head">
                <span>Account</span>
                <span>Signals</span>
                <span>Threats</span>
                <span>Dots</span>
                <span>Admins</span>
                <span></span>
            </li>
        `;
    }

    // A faded preview of the table, with a field to create the first workspace beneath it.
    _empty() {
        const { rejected } = this;

        const ghost = (name, status) => `
            <li class="tenant tenant--ghost" aria-hidden="true">
                <span class="tenant-account">
                    <span class="tenant-mark"></span>
                    <span class="tenant-text"><i style="width:${name}px"></i><i style="width:${status}px"></i></span>
                </span>
                <span class="tenant-num"><i></i></span>
                <span class="tenant-num"><i></i></span>
                <span class="tenant-num"><i></i></span>
                <span class="tenant-num"><i></i></span>
                <span></span>
            </li>
        `;

        return `
            ${ghost(132, 64)}${ghost(104, 80)}${ghost(150, 56)}

            <li class="managed-empty">
                <h3>Create your workspace</h3>
                <p>Your workspace brings together the devices, identities, and services you want to protect.</p>

                <form class="managed-start ${rejected ? 'is-rejected' : ''}">
                    <input name="workspace" value="${rejected ?? ''}" placeholder="acme.com" aria-label="Workspace name"
                           required pattern="\\S+" autocomplete="off" spellcheck="false">
                    <button type="submit">Create <span class="material-symbols-outlined">arrow_forward</span></button>
                </form>

                <p class="managed-start-note">
                    ${rejected
                        ? `Sorry, <b>${rejected}</b> isn't available. Try a different name.`
                        : 'One word, no spaces. Your company\'s domain works well.'}
                </p>
            </li>
        `;
    }

    _row(domain, { open, unread, threats, assets, dots, state }) {
        const dash = '<em>—</em>';

        const signals = this.scanning ? SPINNER : open ? fmt(open) : dash;
        const threatCount = this.scanning ? SPINNER : threats ? `<b class="tenant-threats">${threats}</b>` : dash;
        const dotCount = this.counting ? SPINNER : assets ? `${fmt(dots)}<small>/${fmt(assets)}</small>` : dash;

        return `
            <li class="tenant ${unread ? 'has-unread' : ''}" data-domain="${domain}" data-state="${state}" aria-selected="${domain === this.selected}">
                <span class="tenant-account">
                    ${this._mark(domain)}
                    <span class="tenant-text">
                        <span class="tenant-name" title="${domain}">${domain}</span>
                        ${this._status(state)}
                    </span>
                </span>
                <span class="tenant-num">
                    ${unread ? `<span class="tenant-unread">${fmt(unread)} unread</span>` : ''}
                    ${signals}
                </span>
                <span class="tenant-num">${threatCount}</span>
                <span class="tenant-num">${dotCount}</span>
                <span class="tenant-num">${this.members.get(domain).length}</span>
                <span class="material-symbols-outlined tenant-chev">chevron_right</span>
            </li>
        `;
    }

    _createRow(name) {
        if (name === this.rejected) return `
            <li class="tenant tenant--create is-taken" data-create="${name}">
                <span class="tenant-account">
                    <span class="tenant-mark"><span class="material-symbols-outlined">block</span></span>
                    <span class="tenant-name">Sorry, <b>${name}</b> isn't available. Try a different name.</span>
                </span>
            </li>
        `;

        return `
            <li class="tenant tenant--create" data-create="${name}">
                <span class="tenant-account">
                    <span class="tenant-mark"><span class="material-symbols-outlined">add</span></span>
                    <span class="tenant-name">Create account <b>${name}</b></span>
                </span>
                <kbd>enter</kbd>
            </li>
        `;
    }

    // Favicon over initials; tiny (placeholder) or missing icons fall back to the initials.
    _mark(domain) {
        const logo = domain.includes('.') && `
            <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="" loading="lazy"
                 onload="this.naturalWidth <= 16 && this.remove()" onerror="this.remove()">
        `;

        return `<span class="tenant-mark">${domain.slice(0, 2).toUpperCase()}${logo || ''}</span>`;
    }

    _status(state) {
        const icon = state === 'scanning' ? SPINNER : '';
        return `<span class="tenant-status" data-state="${state}">${icon}${ACCOUNT_STATES[state]}</span>`;
    }

    _renderDetail() {
        this.detail.hidden = !this.members.size;
        this.detail.innerHTML = this.selected ? this._accountPanel(this.selected) : this._overview();
    }

    _overview() {
        if (this.scanning) {
            return `<div class="managed-overview"><h3>Scanning accounts…</h3></div>`;
        }

        const count = this._counts();

        const title =
            count('threat') ? `${plural(count('threat'), 'account')} under active threat` :
            count('open')   ? `${plural(count('open'), 'account')} waiting on a decision` :
                              'Every account is protected';

        return `
            <div class="managed-overview">
                <h3>${title}</h3>
                <ul class="managed-breakdown">
                    ${['threat', 'open', 'clear'].map(state => `
                        <li data-state="${state}"><span>${ACCOUNT_STATES[state]}</span><b>${count(state)}</b></li>
                    `).join('')}
                </ul>
                <p class="managed-overview-hint">Select an account to manage access</p>
            </div>
        `;
    }

    _panelSummary(domain) {
        const { open, threats, dots, state } = this._stats(domain);

        return `
            <header class="tenant-panel-head">
                ${this._mark(domain)}
                <div class="tenant-panel-title">
                    <h3 title="${domain}">${domain}</h3>
                    ${this._status(state)}
                </div>
                <button class="tenant-panel-close" data-close title="Close">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </header>

            <dl class="tenant-panel-stats">
                <div><dt>Signals</dt><dd>${this.scanning ? '—' : fmt(open)}</dd></div>
                <div class="${threats ? 'is-threat' : ''}"><dt>Threats</dt><dd>${this.scanning ? '—' : fmt(threats)}</dd></div>
                <div><dt>Dots</dt><dd>${this.counting ? '—' : fmt(dots)}</dd></div>
            </dl>
        `;
    }

    _accountPanel(domain) {
        const admins = [...this.members.get(domain)]
            .sort((a, b) => (b === this.me) - (a === this.me) || a.localeCompare(b));

        return `
            <div class="tenant-panel">
                <div class="tenant-panel-summary">${this._panelSummary(domain)}</div>

                <div class="tenant-panel-label">Administrators <span>${admins.length}</span></div>

                <ul class="admin-list">
                    ${admins.map(email => `
                        <li class="admin ${email === this.me ? 'is-me' : ''}">
                            <span class="admin-initial">${email[0].toUpperCase()}</span>
                            <span class="admin-email" title="${email}">${email}</span>
                            ${email === this.me ? '<span class="admin-you">You</span>' : ''}
                            <button class="admin-remove" data-remove="${email}" title="Remove access">
                                <span class="admin-remove-label">Remove</span>
                                <span class="material-symbols-outlined">close</span>
                            </button>
                        </li>
                    `).join('')}
                </ul>

                <form class="admin-invite">
                    <input name="email" type="email" placeholder="Add admin by email" autocomplete="off">
                    <button type="submit">Add</button>
                </form>

                <footer class="tenant-panel-foot">
                    <button class="tenant-enter" data-enter>
                        Switch to ${domain}
                        <span class="material-symbols-outlined">arrow_forward</span>
                    </button>
                </footer>
            </div>
        `;
    }

    // ── actions ─────────────────────────────────────────────────────────────

    _select(domain) {
        this.selected = domain;
        this.list.querySelectorAll('.tenant[data-domain]').forEach(row => {
            row.setAttribute('aria-selected', row.dataset.domain === domain);
        });
        this._renderDetail();
    }

    async _create(account) {
        const created = await SiteSpinner.withLoading(() => this.api.managed.assign(account, this.me));
        if (!created) {
            this.rejected = account;
            this._renderList();
            return this.list.querySelector('.managed-start input')?.focus();
        }

        this.members.set(account, [this.me]);
        this.search.value = '';
        this.selected = account;
        this.render();
    }

    async _assign(email) {
        const domain = this.selected;
        await SiteSpinner.withLoading(() => this.api.managed.assign(domain, email));
        this.members.get(domain).push(email);
        this.render();
    }

    async _unassign(email) {
        const domain = this.selected;
        await SiteSpinner.withLoading(() => this.api.managed.unassign(domain, email));

        if (email === this.me) {
            this.members.delete(domain);
            this.selected = null;
        } else {
            this.members.set(domain, this.members.get(domain).filter(m => m !== email));
        }
        this.render();
    }

    _enter(domain) {
        this.state.delegate = domain;
        document.dispatchEvent(new CustomEvent('page:reset'));
        document.querySelector('site-overlay').click();
    }

    // ── events ──────────────────────────────────────────────────────────────

    listen() {
        document.addEventListener('signal:managed', (ev) => {
            this.state.track(ev.signal);
            if (this.scanning) return;

            this._renderList();
            if (this.selected) {
                this.detail.querySelector('.tenant-panel-summary').innerHTML = this._panelSummary(this.selected);
            } else {
                this._renderDetail();
            }
        });

        document.addEventListener('managed:asset', ({ asset }) => {
            if (!asset) return;
            const counts = this.assets.get(asset.account) ?? { assets: 0, dots: 0 };
            counts.assets++;
            if (asset.metadata?.runtime) counts.dots++;
            this.assets.set(asset.account, counts);
        });

        // "/" focuses search while this screen is open
        document.addEventListener('keydown', (e) => {
            if (e.key !== '/' || e.target.closest('input, textarea') || !this.search.checkVisibility()) return;
            e.preventDefault();
            this.search.focus();
        });

        this.search.addEventListener('input', () => this._renderList());

        this.search.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.search.value = '';
                return this._renderList();
            }

            const query = this._query();
            if (e.key !== 'Enter' || !query) return;
            this.members.has(query) ? this._select(query) : this._create(query);
        });

        this.list.addEventListener('click', (e) => {
            const row = e.target.closest('.tenant');
            if (row?.dataset.create) return this._create(row.dataset.create);
            if (row?.dataset.domain) this._select(row.dataset.domain);
        });

        this.list.addEventListener('submit', (e) => {
            e.preventDefault();
            this._create(new FormData(e.target).get('workspace').trim().toLowerCase());
        });

        this.list.addEventListener('dblclick', (e) => {
            const row = e.target.closest('.tenant[data-domain]');
            if (row) this._enter(row.dataset.domain);
        });

        // Removing an admin takes two clicks: the first arms the button, the second confirms.
        this.detail.addEventListener('click', (e) => {
            const remove = e.target.closest('[data-remove]');
            if (remove?.dataset.armed) return this._unassign(remove.dataset.remove);

            this.detail.querySelectorAll('[data-armed]').forEach(button => delete button.dataset.armed);
            if (remove) return remove.dataset.armed = 'true';

            if (e.target.closest('[data-close]')) return this._select(null);
            if (e.target.closest('[data-enter]')) return this._enter(this.selected);
        });

        this.detail.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = new FormData(e.target).get('email').trim().toLowerCase();
            if (email) this._assign(email);
        });
    }
}

class ManagedSummary {
    reset() {
        this._el('dots').innerHTML = SPINNER;
        this._el('coverage').innerHTML = SPINNER;
        this._el('assets').textContent = '—';
    }

    render(accounts) {
        const totals = [...accounts.values()].reduce(
            (sum, a) => ({ assets: sum.assets + a.assets, dots: sum.dots + a.dots }),
            { assets: 0, dots: 0 },
        );

        const coverage = totals.assets ? totals.dots / totals.assets * 100 : 0;
        const label = coverage > 0 && coverage < 10 ? coverage.toFixed(1) : Math.round(coverage);

        this._el('dots').textContent = fmt(totals.dots);
        this._el('assets').textContent = fmt(totals.assets);
        this._el('coverage').textContent = `${label}%`;
    }

    _el(key) {
        return document.getElementById(`managed-stat-${key}`);
    }
}