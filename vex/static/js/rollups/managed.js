const fmt = n => n.toLocaleString();
const plural = (n, noun) => `${fmt(n)} ${noun}${n === 1 ? '' : 's'}`;
const pending = width => `<i class="shimmer" style="width:${width}px"></i>`;

const FLIP = '[data-domain], [data-create], [data-flip]';
const flipKey = el => el.dataset.domain ?? el.dataset.create ?? el.dataset.flip;

class ManagedRollup {
    quiet = true;

    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.list = document.getElementById('managed-accounts');
        this.search = document.getElementById('managed-search');
        this.detail = document.getElementById('managed-detail');

        this.members = new Map();   // domain -> admin emails
        this.assets = new Map();    // domain -> { assets, dots }
        this.rejected = null;       // last name the server refused to create
        this.managing = null;       // domain whose admin panel is open
        this.loading = true;        // until grants() returns
        this.scanning = true;       // until signals are in
        this.counting = true;       // until assets are in
        this.scanned = false;
        this.sorted = false;

        this.listen();
        setInterval(() => this.list.checkVisibility() && this.schedule(), 30000);   // keep countdowns fresh
    }

    get me() {
        return this.state.user.email;
    }

    reset() {
        this.scanning = true;
        this.counting = true;
        this.list.scrollTop = 0;
        this.schedule();
    }

    async reload() {
        await this.load();
        this._loadSignals();
        this._loadAssets();
    }

    async load() {
        const grants = await this.api.managed.grants(this.me);
        this.members = new Map(Object.entries(grants));
        this.loading = false;
        if (!this.members.has(this.managing)) this.managing = null;
        this.render();
    }

    async _loadSignals() {
        await this.api.managed.signals(new CustomEvent('signal:managed')).catch(console.error);
        this.scanning = false;
        this.schedule();
    }

    async _loadAssets() {
        this.assets = new Map();
        await this.api.managed.assets(new CustomEvent('managed:asset'));
        this.counting = false;
        this.schedule();
    }

    // ── data ────────────────────────────────────────────────────────────────

    _stats(domain) {
        const open = Object.values(this.state.signals[domain] ?? {}).filter(s => s.status.startsWith('O'));
        const soc = open.filter(Table.SCOPES.threats);
        const now = Date.now();
        const { assets = 0, dots = 0 } = this.assets.get(domain) ?? {};

        return {
            soc: soc.length,
            recs: open.length - soc.length,
            overdue: soc.filter(s => Table.due(s) < now).length,
            next: Math.min(...soc.map(Table.due)),
            peak: soc.length ? Math.max(...soc.map(s => Number(s.metadata.threat))) : null,
            assets,
            dots,
        };
    }

    static calm = ([a, x], [b, y]) => y.recs - x.recs || a.localeCompare(b);

    _query() {
        return this.search.value.trim().toLowerCase();
    }

    _matches() {
        const query = this._query();
        return [...this.members.keys()]
            .filter(domain => domain.includes(query))
            .sort()
            .map(domain => [domain, this._stats(domain)]);
    }

    // ── render ──────────────────────────────────────────────────────────────

    schedule() {
        this.frame ??= requestAnimationFrame(() => {
            this.frame = null;
            this._renderTotals();
            this._renderList();
        });
    }

    render() {
        this._renderTotals();
        this._renderList();
        this._renderDetail();
    }

    _renderTotals() {
        const totals = [...this.assets.values()].reduce((t, a) => ({ assets: t.assets + a.assets, dots: t.dots + a.dots }), { assets: 0, dots: 0 });
        const stat = (n, noun, ready) => `<span class="stat"><b>${ready ? fmt(n) : pending(18)}</b>${noun}${n === 1 ? '' : 's'}</span>`;

        document.getElementById('managed-totals').innerHTML = [
            stat(this.members.size, 'account', !this.loading),
            stat(totals.assets, 'asset', !this.counting),
            stat(totals.dots, 'dot', !this.counting),
        ].join('<span class="stat-divider"></span>');
    }

    _renderList() {
        this.search.closest('.managed-search').hidden = !this.loading && !this.members.size;

        if (this.loading) return this._draw(this._skeleton());
        if (!this.members.size) return this._draw(this._empty());
        if (this.scanning) return this.scanned || this._draw(this._skeleton());
        if (!this.scanned) setTimeout(() => { this.sorted = true; this.schedule(); }, 650);
        this.scanned = true;

        const query = this._query();
        const rows = this._matches();
        const needs = rows.filter(([, s]) => s.soc);
        const calm = rows.filter(([, s]) => !s.soc);
        if (this.sorted) calm.sort(ManagedRollup.calm);
        const create = query && !this.members.has(query) ? this._createRow(query, !rows.length) : '';

        this._draw(`
            ${create ? `<ol class="acct-list">${create}</ol>` : ''}
            ${this._needsLane(needs)}
            ${calm.length ? this._calmLane(calm) : ''}`);
    }

    _draw(html) {
        if (html === this.drawn) return;   // nothing changed; keep hover, focus and animations intact
        this.drawn = html;

        const focused = this.list.contains(document.activeElement) && document.activeElement.closest('[data-domain]')?.dataset.domain;
        const before = new Map([...this.list.querySelectorAll(FLIP)].map(el => [flipKey(el), el.getBoundingClientRect().top]));

        this.list.innerHTML = html;
        if (focused) this.list.querySelector(`[data-domain="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });

        this._settle(before);
    }

    _settle(before) {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const cascade = !before.size;
        let order = 0;

        this.list.querySelectorAll(FLIP).forEach(el => {
            const top = before.get(flipKey(el));

            if (top === undefined) {
                el.animate(
                    [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
                    { duration: 280, delay: cascade ? Math.min(order++, 12) * 28 : 0, easing: 'ease-out', fill: 'backwards' },
                );
                return;
            }

            const dy = top - el.getBoundingClientRect().top;
            if (Math.abs(dy) < 1) return;
            el.animate(
                [{ transform: `translateY(${dy}px)` }, { transform: 'none' }],
                { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
            );
        });
    }

    _ghost(name, status, opacity) {
        return `
            <li class="acct acct-ghost" style="opacity:${opacity}" aria-hidden="true">
                <span class="tenant-mark"></span>
                <span class="acct-main"><i style="width:${name}px"></i><i style="width:${status}px"></i></span>
            </li>`;
    }

    _skeleton() {
        return `
            <div class="acct-skeleton" aria-busy="true" aria-label="Loading accounts">
                <header class="lane-head">
                    <div class="lane-title">
                        <h1>${pending(132)}</h1>
                        <p>${pending(240)}</p>
                    </div>
                </header>
                <ol class="acct-list">
                    ${[[148, 72, 1], [116, 92, 0.8], [164, 60, 0.6], [128, 84, 0.4], [100, 70, 0.2]].map(r => this._ghost(...r)).join('')}
                </ol>
            </div>`;
    }

    _needsLane(needs) {
        const soc = needs.reduce((n, [, s]) => n + s.soc, 0);
        const overdue = needs.reduce((n, [, s]) => n + s.overdue, 0);

        const summary = needs.length
            ? [
                `${plural(soc, 'signal')} across ${plural(needs.length, 'account')}`,
                overdue && `<span class="is-overdue">${fmt(overdue)} past SLA</span>`,
            ].filter(Boolean).join(' · ')
            : 'Accounts with active security threats.';

        const body = needs.length
            ? needs.map(([domain, s]) => this._needsRow(domain, s)).join('')
            : `
                <li class="acct-clear" data-flip="clear">
                    <span class="material-symbols-outlined">verified_user</span>
                    <h3>Nothing needs you</h3>
                    <p>Every account is clear of active security threats.</p>
                </li>`;

        return `
            <header class="lane-head" data-flip="needs-head">
                <div class="lane-title">
                    <h1>Needs triage <span class="lane-count">${fmt(needs.length)}</span></h1>
                    <p>${summary}</p>
                </div>
            </header>
            <ol class="acct-list acct-needs">${body}</ol>`;
    }

    _calmLane(calm) {
        return `
            <header class="lane-head lane-head-quiet" data-flip="calm-head">
                <div class="lane-title">
                    <h2>Everything else <span class="lane-count">${fmt(calm.length)}</span></h2>
                    <p>No active security threats. Below are your recommendations.</p>
                </div>
            </header>
            <ol class="acct-list acct-calm">
                ${calm.map(([domain, s]) => this._calmRow(domain, s)).join('')}
            </ol>`;
    }

    _needsRow(domain, s) {
        const esc = Workspace.esc;
        const risk = Workspace.risk(s.peak);
        const status = [
            plural(s.soc, 'signal'),
            s.overdue && `<b class="is-overdue">${fmt(s.overdue)} past SLA</b>`,
        ].filter(Boolean).join('<i>·</i>');

        return `
            <li class="acct" data-domain="${esc(domain)}" tabindex="0" aria-selected="${domain === this.managing}">
                ${this._mark(domain)}
                <div class="acct-main">
                    <span class="acct-name">${esc(domain)}</span>
                    <span class="acct-status">${status}</span>
                </div>
                <span>${risk ? `<span class="threat-chip" data-risk="${risk.level}" title="Highest threat · ${risk.label}">${risk.pct}%</span>` : ''}</span>
                ${this._chip(s)}
                ${this._countdown(s.next)}
                ${this._actions()}
            </li>`;
    }

    _calmRow(domain, s) {
        const esc = Workspace.esc;
        const recs = s.recs ? plural(s.recs, 'recommendation') : '';

        return `
            <li class="acct calm" data-domain="${esc(domain)}" tabindex="0" aria-selected="${domain === this.managing}">
                ${this._mark(domain)}
                <div class="acct-main"><span class="acct-name">${esc(domain)}</span></div>
                <span class="acct-recs">${recs}</span>
                ${this._chip(s)}
                ${this._actions()}
            </li>`;
    }

    _chip({ assets, dots }) {
        if (this.counting) return `<span class="acct-chip is-loading">${pending(120)}</span>`;

        const pct = assets ? Math.round(dots / assets * 100) : 0;
        const level = !dots ? 'none' : pct === 100 ? 'full' : 'some';

        return `
            <span class="acct-chip" title="${fmt(dots)} of ${fmt(assets)} assets running a dot">
                <span class="acct-chip-assets"><b>${fmt(assets)}</b> assets</span>
                <span class="acct-chip-cov" data-level="${level}"><i></i>${pct}%</span>
            </span>`;
    }

    _countdown(next) {
        if (!Number.isFinite(next)) return `<span class="acct-due none">No SLA</span>`;

        const left = next - Date.now();
        const state = left < 0 ? 'overdue' : left < 3600000 ? 'soon' : '';
        const label = left < 0 ? `${Table.span(-left)} over SLA` : `next due in ${Table.span(left)}`;

        return `<span class="acct-due ${state}">${label}</span>`;
    }

    _actions() {
        return `
            <div class="acct-actions">
                <button type="button" class="acct-manage" data-manage title="Manage admins">
                    <span class="material-symbols-outlined">group</span>
                </button>
                <span class="acct-enter">Enter <span class="material-symbols-outlined">arrow_forward</span></span>
            </div>`;
    }

    _createRow(name, solo) {
        const esc = Workspace.esc;

        if (name === this.rejected) return `
            <li class="acct acct-create is-taken" data-flip="taken">
                <span class="tenant-mark"><span class="material-symbols-outlined">block</span></span>
                <span class="acct-name">Sorry, <b>${esc(name)}</b> isn't available. Try a different name.</span>
            </li>`;

        return `
            <li class="acct acct-create" data-create="${esc(name)}" tabindex="0">
                <span class="tenant-mark"><span class="material-symbols-outlined">add</span></span>
                <span class="acct-name">Create account <b>${esc(name)}</b></span>
                ${solo ? '<kbd>enter</kbd>' : ''}
            </li>`;
    }

    _empty() {
        const { rejected } = this;
        const esc = Workspace.esc;

        return `
            <ol class="acct-list">
                ${this._ghost(132, 64, 1)}${this._ghost(104, 80, 0.6)}${this._ghost(150, 56, 0.3)}

                <li class="managed-empty" data-flip="empty">
                    <h3>Create your workspace</h3>
                    <p>Your workspace brings together the devices, identities, and services you want to protect.</p>

                    <form class="managed-start ${rejected ? 'is-rejected' : ''}">
                        <input name="workspace" value="${esc(rejected ?? '')}" placeholder="acme.com" aria-label="Workspace name"
                               required pattern="\\S+" autocomplete="off" spellcheck="false">
                        <button type="submit">Create <span class="material-symbols-outlined">arrow_forward</span></button>
                    </form>

                    <p class="managed-start-note">
                        ${rejected
                            ? `Sorry, <b>${esc(rejected)}</b> isn't available. Try a different name.`
                            : 'One word, no spaces. Your company\'s domain works well.'}
                    </p>
                </li>
            </ol>`;
    }

    _mark(domain) {
        const esc = Workspace.esc;
        const logo = domain.includes('.') && `
            <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64" alt="" loading="lazy"
                 onload="this.naturalWidth <= 16 && this.remove()" onerror="this.remove()">`;

        return `<span class="tenant-mark">${esc(domain.slice(0, 2).toUpperCase())}${logo || ''}</span>`;
    }

    // ── admin panel ─────────────────────────────────────────────────────────

    _admins(domain) {
        return [...this.members.get(domain)]
            .sort((a, b) => (b === this.me) - (a === this.me) || a.localeCompare(b));
    }

    _renderDetail() {
        this.detail.hidden = this.loading || !this.managing;
        this.detail.innerHTML = this.managing ? this._accountPanel(this.managing) : '';
    }

    _accountPanel(domain) {
        const esc = Workspace.esc;
        const admins = this._admins(domain);

        return `
            <div class="tenant-panel">
                <header class="tenant-panel-head">
                    ${this._mark(domain)}
                    <div class="tenant-panel-title">
                        <span class="tenant-panel-kicker">Administrators</span>
                        <h3 title="${esc(domain)}">${esc(domain)}</h3>
                    </div>
                    <button class="tenant-panel-close" data-close title="Close">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </header>

                <ul class="admin-list">
                    ${admins.map(email => `
                        <li class="admin ${email === this.me ? 'is-me' : ''}">
                            <span class="admin-initial">${esc(email[0].toUpperCase())}</span>
                            <span class="admin-email" title="${esc(email)}">${esc(email)}</span>
                            ${email === this.me ? '<span class="admin-you">You</span>' : ''}
                            <button class="admin-remove" data-remove="${esc(email)}" title="Remove access">
                                <span class="admin-remove-label">Remove</span>
                                <span class="material-symbols-outlined">close</span>
                            </button>
                        </li>
                    `).join('')}
                </ul>

                <form class="admin-invite">
                    <span class="material-symbols-outlined">person_add</span>
                    <input name="email" type="email" placeholder="Add admin by email" autocomplete="off" required>
                    <button type="submit">Add</button>
                </form>
            </div>`;
    }

    // ── actions ─────────────────────────────────────────────────────────────

    _manage(domain) {
        this.managing = domain;
        this.list.querySelectorAll('[data-domain]').forEach(row => {
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
        this.managing = account;
        this.render();
    }

    async _assign(email) {
        const domain = this.managing;
        await SiteSpinner.withLoading(() => this.api.managed.assign(domain, email));
        this.members.get(domain).push(email);
        this.render();
    }

    async _unassign(email) {
        const domain = this.managing;
        await SiteSpinner.withLoading(() => this.api.managed.unassign(domain, email));

        if (email === this.me) {
            this.members.delete(domain);
            this.managing = null;
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
            if (!this.scanning) this.schedule();
        });

        document.addEventListener('managed:asset', ({ asset }) => {
            if (!asset) return;
            const counts = this.assets.get(asset.account) ?? { assets: 0, dots: 0 };
            counts.assets++;
            if (asset.metadata?.runtime) counts.dots++;
            this.assets.set(asset.account, counts);
        });

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

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                return this.list.querySelector('[data-domain], [data-create]')?.focus();
            }

            const query = this._query();
            if (e.key !== 'Enter' || !query) return;

            const first = this.list.querySelector('[data-domain]')?.dataset.domain;
            this.members.has(query) ? this._enter(query) : first ? this._enter(first) : this._create(query);
        });

        this.list.addEventListener('click', (e) => {
            const row = e.target.closest('[data-domain], [data-create]');
            if (row?.dataset.create) return this._create(row.dataset.create);
            if (!row?.dataset.domain) return;

            e.target.closest('[data-manage]') ? this._manage(row.dataset.domain) : this._enter(row.dataset.domain);
        });

        this.list.addEventListener('keydown', (e) => {
            const row = e.target.closest('[data-domain], [data-create]');
            if (!row) return;

            const rows = [...this.list.querySelectorAll('[data-domain], [data-create]')];
            const step = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 }[e.key];

            if (step) {
                e.preventDefault();
                const next = rows[rows.indexOf(row) + step];
                next ? next.focus() : step < 0 && this.search.focus();
            }

            if (e.key === 'Enter' && e.target === row) row.click();
        });

        this.list.addEventListener('submit', (e) => {
            e.preventDefault();
            this._create(new FormData(e.target).get('workspace').trim().toLowerCase());
        });

        this.detail.addEventListener('click', (e) => {
            const remove = e.target.closest('[data-remove]');
            if (remove?.dataset.armed) return this._unassign(remove.dataset.remove);

            this.detail.querySelectorAll('[data-armed]').forEach(button => delete button.dataset.armed);
            if (remove) return remove.dataset.armed = 'true';

            if (e.target.closest('[data-close]')) return this._manage(null);
        });

        this.detail.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = new FormData(e.target).get('email').trim().toLowerCase();
            if (email && !this.members.get(this.managing).includes(email)) this._assign(email);
        });
    }
}