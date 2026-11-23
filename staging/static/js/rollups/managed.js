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
        ManagedRollup.WIDE.addEventListener('change', () => this._fit());
        let fitting; addEventListener('resize', () => { cancelAnimationFrame(fitting); fitting = requestAnimationFrame(() => this._fit()); });
        setInterval(() => this.list.checkVisibility() && this.schedule(), 30000);   // keep countdowns fresh
    }

    get me() {
        return this.state.user.email;
    }

    reset() {
        // a page with no X, as in production. With no account entered yet there's nothing to go
        // back to, so Esc stays put; once in an account, Esc returns to it.
        document.getElementById('managed-screen').toggleAttribute('locked', !this.state.delegate);

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
            verdicts: soc.reduce((n, s) => { const r = Workspace.risk(s.metadata.threat); if (r) n[r.level]++; return n; }, { high: 0, medium: 0, low: 0 }),
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
        // Pulse inline stats for the head (one line, "3 accounts · 73 assets · 33 Dots").
        const stat = (n, noun, ready) => `<li><strong>${ready ? fmt(n) : pending(18)}</strong> ${noun}${n === 1 ? '' : 's'}</li>`;

        document.getElementById('managed-totals').innerHTML = [
            stat(this.members.size, 'account', !this.loading),
            stat(totals.assets, 'asset', !this.counting),
            stat(totals.dots, 'Dot', !this.counting),
        ].join('');
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
            ${create ? `<ol class="pulse-list pulse-list--compact acct-list">${create}</ol>` : ''}
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
        this._fit();
        document.fonts?.ready.then(() => this._fit());   // widths measured in the fallback font are too narrow

        this._settle(before);
    }

    // (Chad, 2026-11-20): above phone width each data column is as wide as its longest content on screen, plus one
    // standard gap, the same in both groups; the spare width goes to the name column. Phones keep the CSS.
    static WIDE = matchMedia('(min-width: 701px)');
    // px between columns' contents: 32 up to 1100px wide, growing to 56 at 1600px and wider (Chad, 2026-11-20).
    static gap() { return Math.round(32 + 24 * Math.min(1, Math.max(0, (innerWidth - 1100) / 500))); }

    _fit() {
        const cols = [...this.list.querySelectorAll('.acct-table colgroup')].map(g => [...g.children]);
        if (!ManagedRollup.WIDE.matches) { this.list.style.removeProperty('--acct-gap'); return cols.flat().forEach(c => c.style.removeProperty('width')); }

        const rows = [...this.list.querySelectorAll('tr.acct')];
        if (!rows.length) return;
        const text = el => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().width; };
        const content = [
            td => td.querySelector('.acct-name-cell > :first-child').offsetWidth + 12 + td.querySelector('.acct-name').scrollWidth + 2,   // +2: text widths round down
            td => text(td),
            td => text(td),
            td => td.querySelector('.acct-cov-line')?.offsetWidth ?? text(td),
            td => text(td),
        ];
        // Cells carry half the gap on each side (managed.css), so the gap is the same after left- and right-aligned columns.
        const gap = ManagedRollup.gap();
        this.list.style.setProperty('--acct-gap', `${gap}px`);
        const widths = content.map((measure, i) => Math.ceil(Math.max(...rows.map(r => measure(r.cells[i])))) + gap);
        // The name takes the spare width and the data sits at the right, by the actions (Chad, 2026-11-23; Polaris and Carbon
        // tables): names get room to breathe and the data columns line up at the same place in every window.
        const actions = Math.ceil(Math.max(...rows.map(r => r.querySelector('.acct-actions')?.scrollWidth ?? 0))) + gap / 2;
        cols.forEach(g => {
            g[0].style.width = 'auto';
            widths.slice(1).forEach((w, i) => { g[i + 1].style.width = `${w}px`; });
            g[g.length - 1].style.width = `${actions}px`;
        });
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
            <li class="pulse-skeleton-row acct-ghost" style="opacity:${opacity}" aria-hidden="true">
                <span class="pulse-skeleton pulse-skeleton--mark"></span><span class="pulse-skeleton" style="max-width:${name}px"></span>
            </li>`;
    }

    _skeleton() {
        return `
            <div class="acct-skeleton" aria-busy="true" aria-label="Loading accounts">
                <header class="lane-head">
                    <div class="lane-title"><h3>${pending(132)}</h3></div>
                </header>
                <ol class="acct-list">
                    ${[[148, 72, 1], [116, 92, 0.8], [164, 60, 0.6], [128, 84, 0.4], [100, 70, 0.2]].map(r => this._ghost(...r)).join('')}
                </ol>
            </div>`;
    }

    // One list in two groups with equal labels, as Gmail's priority inbox (Chad, 2026-11-19): the page is "Accounts", the
    // groups are its parts. The rows carry the counts, so the labels have no description line.
    _needsLane(needs) {
        // The heading stays at 0 (Chad, 2026-11-23), as Waiting on you does in an account; one quiet line under it.
        const head = `
            <header class="lane-head" data-flip="needs-head">
                <div class="lane-title"><h3>Needs triage <span class="lane-count">${fmt(needs.length)}</span></h3></div>
            </header>`;
        if (!needs.length) return head + `
            <p class="acct-none all-clear" data-flip="clear"><i class="pulse-icon pulse-icon--shield-check pulse-icon--fill" aria-hidden="true"></i><span class="all-clear__title">Nothing urgent right now</span></p>`;

        return head + `
            ${this._table(needs.map(([domain, s]) => this._needsRow(domain, s)).join(''), 'acct-needs', 'Accounts that need triage')}`;
    }

    _calmLane(calm) {
        return `
            <header class="lane-head lane-head-quiet" data-flip="calm-head">
                <div class="lane-title"><h3>Everything else <span class="lane-count">${fmt(calm.length)}</span></h3></div>
            </header>
            ${this._table(calm.map(([domain, s]) => this._calmRow(domain, s)).join(''), 'acct-calm', 'Accounts with no active threats')}`;
    }

    // Pulse headless data table (Chad, 2026-11-19): aligned columns, no visible head, units in every cell. Both lanes use the
    // same columns (account, status, assets and coverage, next SLA, actions), so they line up with each other.
    _table(rows, cls, label) {
        return `
            <table class="pulse-table pulse-table--interactive pulse-table--headless acct-table ${cls}" aria-label="${label}">
                <colgroup><col class="acct-col-name"><col class="acct-col-status"><col class="acct-col-assets"><col class="acct-col-cov"><col class="acct-col-sla"><col class="acct-col-actions"></colgroup>
                <thead><tr><th scope="col">Account</th><th scope="col">Signals</th><th scope="col" class="pulse-table__num">Assets</th><th scope="col" class="pulse-table__num">Dot coverage</th><th scope="col">Next SLA</th><th scope="col"><span class="pulse-visually-hidden">Actions</span></th></tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
    }

    // Status: the count first so rows line up, then the worst verdict as colored text, one only (Chad, 2026-11-19).
    // Likely benign gets none; the percent stays in the signal panel.
    _needsRow(domain, s) {
        const esc = Workspace.esc;
        const v = s.verdicts;
        const verdict = v.high ? `<b class="acct-verdict is-high">${fmt(v.high)} likely malicious</b>`
            : v.medium ? `<b class="acct-verdict is-medium">${fmt(v.medium)} suspicious</b>` : '';
        const status = [
            plural(s.soc, 'signal'),
            verdict,
            s.overdue && `<b class="is-overdue">${fmt(s.overdue)} past SLA</b>`,
        ].filter(Boolean).join(' · ');

        return `
            <tr class="acct" data-domain="${esc(domain)}" tabindex="0" aria-selected="${domain === this.managing}">
                <td><span class="acct-name-cell">${this._mark(domain)}<span class="acct-name-stack"><span class="acct-name">${esc(domain)}</span>${verdict ? `<span class="acct-sub">${verdict}</span>` : ''}</span></span></td>
                <td class="acct-status">${status}</td>
                ${this._chip(s, domain)}
                <td>${this._countdown(s.next)}</td>
                <td class="pulse-table__num">${this._actions()}</td>
            </tr>`;
    }

    _calmRow(domain, s) {
        const esc = Workspace.esc;
        const recs = s.recs ? plural(s.recs, 'recommendation') : ManagedRollup.none;

        return `
            <tr class="acct calm" data-domain="${esc(domain)}" tabindex="0" aria-selected="${domain === this.managing}">
                <td><span class="acct-name-cell">${this._mark(domain)}<span class="acct-name">${esc(domain)}</span></span></td>
                <td class="acct-recs">${recs}</td>
                ${this._chip(s, domain)}
                <td>${ManagedRollup.none}</td>
                <td class="pulse-table__num">${this._actions()}</td>
            </tr>`;
    }

    // Two right-aligned cells. Coverage is an amount, so a small Pulse progress bar under the percent (gray, green when every
    // asset has a Dot), not a status dot (Chad, 2026-11-19).
    _chip({ assets, dots }, domain = '') {
        if (this.counting) return `<td class="pulse-table__num">${pending(56)}</td><td class="pulse-table__num">${pending(72)}</td>`;

        const pct = assets ? Math.round(dots / assets * 100) : 0;
        const level = !dots ? 'none' : pct === 100 ? 'full' : 'some';
        const covId = `cov-${Workspace.encode(domain)}`;

        return `
            <td class="pulse-table__num acct-assets"><b>${fmt(assets)}</b> asset${assets === 1 ? '' : 's'}</td>
            <td class="pulse-table__num acct-cov" data-level="${level}" title="${fmt(dots)} of ${fmt(assets)} assets running a Dot">
                <span class="acct-cov-line">
                    <span class="pulse-progress pulse-progress--sm ${level === 'full' ? 'pulse-progress--success' : 'pulse-progress--neutral'}" style="--p: ${pct}%">
                        <span class="pulse-progress__track" role="progressbar" aria-labelledby="${covId}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span class="pulse-progress__fill"></span></span>
                    </span>
                    <span class="acct-cov-label" id="${covId}">${pct}%<span class="acct-cov-word"> covered</span></span>
                </span></td>`;
    }

    // An empty cell shows a faint en dash, so rows read complete and columns stay aligned (Carbon, Polaris); screen
    // readers hear "None" (Chad, 2026-11-20).
    static none = `<span class="acct-none-cell" aria-hidden="true">–</span><span class="pulse-visually-hidden">None</span>`;

    _countdown(next) {
        if (!Number.isFinite(next)) return `<span class="acct-due none">No SLA</span>`;

        const left = next - Date.now();
        const state = left < 0 ? 'overdue' : left < 3600000 ? 'soon' : '';
        const label = left < 0 ? `${Table.span(-left)} over SLA` : `next due in ${Table.span(left)}`;

        return `<span class="acct-due ${state}">${label}</span>`;
    }

    _actions() {
        return `
            <!-- Manage admins always shows at the right edge (it anchors the row and is easy to find); Enter appears beside it on hover. -->
            <span class="acct-actions pulse-row-actions">
                <!-- the whole row enters the account; this is its visible cue, not a separate control. -->
                <span class="pulse-table__reveal"><span class="pulse-btn pulse-btn--primary pulse-btn--sm acct-enter" aria-hidden="true">Enter <i class="pulse-icon pulse-icon--arrow-right" aria-hidden="true"></i></span></span>
                <button type="button" class="pulse-tooltip-host pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm" data-manage aria-label="Manage admins">
                    <i class="pulse-icon pulse-icon--users" aria-hidden="true"></i>
                <span class="pulse-tooltip pulse-tooltip--end" aria-hidden="true">Manage admins</span></button>
            </span>`;
    }

    _createRow(name, solo) {
        const esc = Workspace.esc;

        if (name === this.rejected) return `
            <li class="pulse-list-row acct-create is-taken" data-flip="taken">
                <span class="pulse-list-row__lead"><span class="pulse-avatar tenant-mark" aria-hidden="true"><i class="pulse-icon pulse-icon--warning-circle" aria-hidden="true"></i></span></span>
                <span class="pulse-list-row__main"><span class="pulse-list-row__title">Sorry, <b>${esc(name)}</b> isn’t available. Try a different name.</span></span>
            </li>`;

        return `
            <li class="pulse-list-row acct-create" data-create="${esc(name)}" tabindex="0">
                <span class="pulse-list-row__lead"><span class="pulse-avatar tenant-mark" aria-hidden="true"><i class="pulse-icon pulse-icon--plus" aria-hidden="true"></i></span></span>
                <span class="pulse-list-row__main"><span class="pulse-list-row__title">Create account <b>${esc(name)}</b></span></span>
                ${solo ? '<span class="pulse-list-row__trail"><kbd class="pulse-input-group__key">enter</kbd></span>' : ''}
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

                    <form class="managed-start">
                        <div class="pulse-field ${rejected ? 'pulse-field--error' : ''}">
                            <div class="managed-start-row">
                                <input class="pulse-input pulse-input--lg" name="workspace" value="${esc(rejected ?? '')}" placeholder="acme.com" aria-label="Workspace name"
                                       required pattern="\\S+" autocomplete="off" spellcheck="false" aria-describedby="managed-start-help"${rejected ? ' aria-invalid="true"' : ''}>
                                <button class="pulse-btn pulse-btn--primary pulse-btn--lg" type="submit">Create <i class="pulse-icon pulse-icon--arrow-right" aria-hidden="true"></i></button>
                            </div>
                            <span class="pulse-field__help" id="managed-start-help">
                                ${rejected
                                    ? `Sorry, <b>${esc(rejected)}</b> isn’t available. Try a different name.`
                                    : 'One word, no spaces. Your company’s domain works well.'}
                            </span>
                        </div>
                    </form>
                </li>
            </ol>`;
    }

    _mark(domain) {
        const esc = Workspace.esc;
        const logo = domain.includes('.') && `
            <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64" alt="" loading="lazy"
                 onload="this.naturalWidth <= 16 && this.remove()" onerror="this.remove()">`;

        return `<span class="pulse-avatar tenant-mark" aria-hidden="true">${esc(domain.slice(0, 2).toUpperCase())}${logo || ''}</span>`;
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
                        <p class="pulse-eyebrow">Administrators</p>
                        <h3 title="${esc(domain)}">${esc(domain)}</h3>
                    </div>
                    <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm" type="button" data-close aria-label="Close">
                        <i class="pulse-icon pulse-icon--x" aria-hidden="true"></i>
                    </button>
                </header>

                <ul class="pulse-list pulse-list--compact admin-list">
                    ${admins.map(email => `
                        <li class="pulse-list-row admin ${email === this.me ? 'is-me' : ''}">
                            <span class="pulse-list-row__lead"><span class="pulse-avatar pulse-avatar--sm pulse-avatar--circle" aria-hidden="true">${esc(email[0].toUpperCase())}</span></span>
                            <span class="pulse-list-row__main"><span class="pulse-list-row__title" title="${esc(email)}">${esc(email)}</span></span>
                            ${email === this.me ? '<span class="pulse-list-row__trail"><span class="pulse-badge pulse-badge--nodot">You</span></span>' : ''}
                            <span class="pulse-list-row__trail pulse-list-row__trail--reveal">
                                <button class="pulse-tooltip-host pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm" type="button" data-remove="${esc(email)}" aria-label="Remove access for ${esc(email)}">
                                    <i class="pulse-icon pulse-icon--trash" aria-hidden="true"></i>
                                <span class="pulse-tooltip pulse-tooltip--end" aria-hidden="true">Remove access</span></button>
                            </span>
                        </li>
                    `).join('')}
                </ul>

                <!-- Pulse input group with a button at the end. -->
                <form class="pulse-input-group admin-invite">
                    <i class="pulse-icon pulse-icon--users" aria-hidden="true"></i>
                    <input class="pulse-input" name="email" type="email" placeholder="Add admin by email" aria-label="Add admin by email" autocomplete="off" required>
                    <button class="pulse-btn pulse-btn--primary pulse-btn--sm" type="submit">Add</button>
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
        // start the slide down first, then load the account a few frames later; loading first blocked the page
        // long enough that the slide was skipped and the change looked instant (Chad, 2026-11-19).
        document.querySelector('site-overlay').click();
        requestAnimationFrame(() => requestAnimationFrame(() => document.dispatchEvent(new CustomEvent('page:reset'))));
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
            // Removing access confirms with Pulse's destructive dialog first.
            const remove = e.target.closest('[data-remove]');
            if (remove) {
                const email = remove.dataset.remove;
                return Workspace.confirmDestructive({
                    title: 'Remove this admin?',
                    body: `${email} loses access to this account. You can invite them again later.`,
                    resource: this.managing,
                    action: 'Remove access',
                }).then(ok => ok && this._unassign(email));
            }

            if (e.target.closest('[data-close]')) return this._manage(null);
        });

        this.detail.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = new FormData(e.target).get('email').trim().toLowerCase();
            if (email && !this.members.get(this.managing).includes(email)) this._assign(email);
        });
    }
}