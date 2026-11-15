const SOURCE_NAMES = {
    aws: 'AWS',
    constantcontact: 'Constant Contact',
    github: 'GitHub',
    godaddy: 'GoDaddy',
    google: 'Google Workspace',
    hubspot: 'HubSpot',
    microsoft: 'Microsoft 365',
    teams: 'Microsoft Teams',
};

class CoverageRollup {
    static RUN_STATUS = {
        T0: { tone: 'ok', label: 'Success', icon: 'check' },
        PENDING: { tone: 'pending', label: 'Pending', icon: 'pending' },
        FAILED: { tone: 'bad', label: 'Failed', icon: 'close' },
    };

    static STATE_LABEL = { live: 'Live', idle: 'Idle', none: 'No dot' };

    static runStatus(status) {
        return CoverageRollup.RUN_STATUS[status] ?? CoverageRollup.RUN_STATUS.FAILED;
    }

    static isActive(ts) {
        return Date.now() - Workspace.time(ts) < 15 * 60000;
    }

    static later(a, b) {
        return !b || Workspace.time(a) > Workspace.time(b) ? a : b;
    }

    static byDot = (a, b) => {
        const rank = { live: 0, idle: 1, none: 2 };
        return rank[a.state] - rank[b.state] || a.name.localeCompare(b.name);
    };

    constructor(state) {
        this.state = state;
        this.api = state.api;

        this.screen = document.getElementById('coverage-screen');
        this.body = document.getElementById('cov-body');
        this.search = document.getElementById('cov-search');
        this.stats = document.getElementById('cov-stats');
        this.drawer = document.getElementById('cov-drawer');
        this.sourcesBtn = document.getElementById('cov-sources-btn');
        this.toast = document.createElement('div');
        this.toast.className = 'cov-toast';
        this.screen.append(this.toast);

        this.vendors = {};          // vendor -> { name, ids }
        this.items = new Map();     // key -> asset item (dot + discovered asset merged)
        this.packOf = new Map();    // action id -> pack name
        this.loaded = false;

        this.confirming = null;     // source ref whose disconnect awaits a second click

        this.open = null;           // drawer: { kind: 'asset' | 'catalog' | 'connect' | 'mailbox', key }
        this.runs = [];             // open asset's runs, newest first
        this.expanded = null;       // run whose output is showing
        this.draft = '';
        this.error = null;
        this.connecting = false;

        this.ready = this._loadManifest();
        this.listen();
        setInterval(() => this.loaded && this.screen.checkVisibility() && this._tick(), 60000);
    }

    // ── lifecycle ──────────────────────────────────────────────────

    async _loadManifest() {
        const keys = await fetch('static/img/source/manifest.json').then(r => r.json());
        for (const key of keys) {
            this.vendors[key] = { name: SOURCE_NAMES[key] ?? key[0].toUpperCase() + key.slice(1), ids: [] };
        }
    }

    async reset() {
        await this.ready;
        this.loaded = false;
        this.items = new Map();
        this.confirming = null;
        this.search.value = '';
        Object.values(this.vendors).forEach(v => { v.ids = []; });
        this._close();
        this._render();
    }

    async reload() {
        await this.ready;
        this._loadPacks();
        await this._load();
        this._render();
        this._loadSeen();
    }

    async refresh() {
        await this._tick();
        if (this.open?.kind !== 'asset') return;
        this.items.has(this.open.key) ? this._loadRuns() : this._close();
    }

    async _tick() {
        await this._load();
        this._render();
        await this._loadSeen();
    }

    async _load() {
        const [sources, assets] = await Promise.all([this.api.sources.list(), this.api.inventory.list()]);

        Object.values(this.vendors).forEach(v => { v.ids = []; });
        for (const raw of sources) {
            const { vendor, id } = this._parse(raw);
            this.vendors[vendor]?.ids.push(id);
        }

        this.items = this._merge(assets, sources);
        this.loaded = true;
    }

    async _loadSeen() {
        const dotted = [...this.items.values()].filter(i => i.dot);
        await Promise.all(dotted.map(async item => {
            const runs = await this.api.inventory.get(item.dot.key) ?? [];
            runs.forEach(r => this._see(item, r.created));
        }));
        this._render();
    }

    _see(item, ts) {
        item.seen = CoverageRollup.later(ts, item.seen);
        item.state = CoverageRollup.isActive(item.seen) ? 'live' : 'idle';
    }

    async _loadPacks() {
        const packs = await this.api.action.list();
        this.packOf = new Map(Object.entries(packs).flatMap(([name, actions]) => actions.map(a => [String(a.id), name])));
        if (this.open?.kind === 'asset') this._renderDrawer();
    }

    // ── model ──────────────────────────────────────────────────────

    _parse(raw) {
        const [, , vendor, id] = raw.split('/');
        return { vendor, id, ref: `${vendor}/${id}` };
    }

    _merge(assets, sources) {
        const groups = Map.groupBy(assets, a => a.name.toLowerCase());

        return new Map([...groups.values()].map(members => {
            const dot = members.filter(a => a.metadata.runtime).sort((a, b) => Workspace.time(b.updated) - Workspace.time(a.updated))[0];
            const found = members.find(a => a.source && sources.some(s => s.includes(a.source)));
            const item = {
                key: (dot ?? members[0]).key,
                name: (found ?? members[0]).name,
                ref: found && this._parse(sources.find(s => s.includes(found.source))).ref,
                dot,
                members,
                state: 'none',
            };
            if (dot) this._see(item, CoverageRollup.later(dot.updated, this.items.get(item.key)?.seen));
            return [item.key, item];
        }));
    }

    _connections() {
        return Object.entries(this.vendors)
            .flatMap(([vendor, v]) => v.ids.map(id => ({ vendor, id, ref: `${vendor}/${id}`, system: id === '0' })))
            .sort((a, b) => b.system - a.system || this.vendors[a.vendor].name.localeCompare(this.vendors[b.vendor].name));   // managed SOC first
    }

    _sourceName({ vendor, id }) {
        return this.vendors[vendor].name + (this.vendors[vendor].ids.length > 1 && id !== '0' ? ` · ${id}` : '');
    }

    _sourcesOpen() {
        return ['catalog', 'connect', 'mailbox'].includes(this.open?.kind);
    }

    // ── render ─────────────────────────────────────────────────────

    _render() {
        this._renderStats();
        this._renderSourcesBtn();
        this._renderBody();
    }

    _renderSourcesBtn() {
        const conns = this._connections();
        const vendors = [...new Set(conns.map(c => c.vendor))];
        const stack = vendors.slice(0, 4).map(v => this._logo(v, 'cov-stack-logo')).join('');
        const more = vendors.length > 4 ? `<span class="cov-stack-more">+${vendors.length - 4}</span>` : '';

        this.sourcesBtn.classList.toggle('is-active', this._sourcesOpen());
        this.sourcesBtn.innerHTML = conns.length
            ? `<span class="cov-stack">${stack}${more}</span>Sources<span class="n">${conns.length + 1}</span>`
            : '<span class="material-symbols-outlined">add</span>Connect a source';
    }

    _renderStats() {
        const items = [...this.items.values()];
        const n = value => this.loaded ? value : '—';

        this.stats.innerHTML = [
            `<span class="stat"><b>${n(items.length)}</b>assets</span>`,
            `<span class="stat"><b>${n(items.filter(i => i.dot).length)}</b>dots</span>`,
        ].join('<span class="stat-divider"></span>');
    }

    _renderBody() {
        if (!this.loaded) return this.body.innerHTML = '';

        if (!this._connections().length && !this.items.size) {
            return this.body.innerHTML = `
                <div class="cov-empty">
                    <span class="material-symbols-outlined">hub</span>
                    <h4>Nothing connected yet</h4>
                    <p>Connect a source. Then install dots.</p>
                    <button type="button" class="cov-primary" data-catalog><span class="material-symbols-outlined">add</span>Add source</button>
                </div>`;
        }

        const items = [...this.items.values()].sort(CoverageRollup.byDot);
        const sources = new Map(this._connections().map(c => [c.ref, c]));

        this.body.innerHTML = `
            ${items.length ? `
                <div class="cov-row cov-row-head">
                    <span></span><span>Asset</span><span class="cov-col-source">Source</span><span>Dot</span><span class="cov-col-extra">Runtime</span><span class="cov-col-extra cov-seen">Last seen</span><span></span>
                </div>
                ${items.map(i => this._row(i, sources.get(i.ref))).join('')}` : ''}
            <p class="cov-no-match">No match</p>`;

        this._filter();
    }

    _logo(vendor, cls) {
        return `<img class="${cls}" src="static/img/source/${vendor}.png" alt="">`;
    }

    _row(item, source) {
        const selected = this.open?.kind === 'asset' && this.open.key === item.key;

        return `
            <div class="cov-row is-${item.state}${selected ? ' is-selected' : ''}" data-item="${Workspace.esc(item.key)}">
                <span class="cov-dot"></span>
                <span class="cov-name">${Workspace.esc(item.name)}</span>
                <span class="cov-col-source">${source ? `${this._logo(source.vendor, 'cov-chip-logo')}${this._sourceName(source)}` : '—'}</span>
                <span class="cov-state">${CoverageRollup.STATE_LABEL[item.state]}</span>
                <span class="cov-col-extra">${Workspace.esc(item.dot?.metadata.runtime ?? '')}</span>
                <span class="cov-col-extra cov-seen">${item.dot ? this._ago(item.seen) : ''}</span>
                <span class="material-symbols-outlined cov-go">chevron_right</span>
            </div>`;
    }

    _filter() {
        const query = this.search.value.trim().toLowerCase();
        for (const row of this.body.querySelectorAll('.cov-row[data-item]')) {
            row.hidden = !(JSON.stringify(this.items.get(row.dataset.item).members) + row.textContent).toLowerCase().includes(query);
        }
        this.body.classList.toggle('no-match', !!query && !this.body.querySelector('.cov-row[data-item]:not([hidden])'));
    }

    // ── drawer ─────────────────────────────────────────────────────

    _openDrawer(kind, key) {
        this.open = { kind, key };
        this.error = null;
        this.expanded = null;
        this.confirming = null;
        if (kind !== 'connect') this.draft = '';

        this.screen.classList.add('drawer-open');
        this._renderDrawer();
        this._markSelected();

        if (kind === 'asset' && this.items.get(key).dot) this._loadRuns();
        if (kind === 'connect') this.drawer.querySelector('[data-cred]').focus();
    }

    _close() {
        this.open = null;
        this.screen.classList.remove('drawer-open');
        this.drawer.hidden = true;
        this._markSelected();
    }

    _markSelected() {
        const key = this.open?.kind === 'asset' && this.open.key;
        this.body.querySelectorAll('.cov-row').forEach(row => row.classList.toggle('is-selected', row.dataset.item === key));
        this.sourcesBtn.classList.toggle('is-active', this._sourcesOpen());
    }

    _renderDrawer() {
        const { kind, key } = this.open;
        this.drawer.hidden = false;
        this.drawer.innerHTML = kind === 'catalog' ? this._catalog()
            : kind === 'connect' ? this._connectForm(key)
            : kind === 'mailbox' ? this._mailboxView()
            : this._assetView(this.items.get(key));
    }

    _drawerHead(title, { sub = '', back = '', actions = '' } = {}) {
        return `
            <header class="cov-drawer-head">
                ${back}
                <div class="cov-drawer-title">
                    <h3>${title}</h3>
                    ${sub ? `<p>${sub}</p>` : ''}
                </div>
                ${actions}
                ${this._iconBtn('close', 'close', 'Close (Esc)')}
            </header>`;
    }

    _iconBtn(act, icon, title, cls = '') {
        return `<button type="button" class="cov-icon-btn ${cls}" data-act="${act}" title="${title}"><span class="material-symbols-outlined">${icon}</span></button>`;
    }

    // ── drawer: sources ──

    _catalog() {
        const conns = this._connections();
        const connected = new Set(conns.filter(c => !c.system).map(c => c.vendor));
        const available = Object.keys(this.vendors)
            .filter(v => !connected.has(v))
            .sort((a, b) => this.vendors[a].name.localeCompare(this.vendors[b].name));

        return `
            ${this._drawerHead('Sources', { sub: 'Sources stream security events and alerts into your SOC.' })}
            <div class="cov-drawer-body cov-catalog">
                <section>
                    <h4 class="cov-section-head">Connected <span>${conns.length + 1}</span></h4>
                    <ul class="cov-list">
                        <li class="cov-item is-link" data-act="mailbox">
                            <span class="material-symbols-outlined cov-item-logo">alternate_email</span>
                            <span class="cov-item-name">SOC mailbox</span>
                            <span class="cov-item-meta">Managed by your SOC</span>
                            <span class="material-symbols-outlined cov-conn-end">lock</span>
                            <span class="material-symbols-outlined cov-conn-end cov-item-enter">arrow_forward</span>
                        </li>
                        ${conns.map(c => this._conn(c)).join('')}
                    </ul>
                </section>

                ${available.length ? `
                    <section>
                        <h4 class="cov-section-head">Available <span>${available.length}</span></h4>
                        <ul class="cov-list">
                            ${available.map(v => `
                                <li class="cov-item is-link" data-connect="${v}">
                                    ${this._logo(v, 'cov-item-logo')}
                                    <span class="cov-item-name">${this.vendors[v].name}</span>
                                    <span class="cov-item-go">Connect<span class="material-symbols-outlined">arrow_forward</span></span>
                                </li>`).join('')}
                        </ul>
                    </section>` : ''}
            </div>`;
    }

    _conn(conn) {
        const end = conn.system
            ? '<span class="material-symbols-outlined cov-conn-end" title="Managed by your SOC">lock</span>'
            : this.confirming === conn.ref
                ? `<button type="button" class="cov-confirm" data-disconnect="${conn.ref}">Disconnect?</button>`
                : `<button type="button" class="cov-icon-btn cov-conn-action" data-disconnect="${conn.ref}" title="Disconnect"><span class="material-symbols-outlined">link_off</span></button>`;

        return `
            <li class="cov-item" data-ref="${conn.ref}">
                ${this._logo(conn.vendor, 'cov-item-logo')}
                <span class="cov-item-name">${this._sourceName(conn)}</span>
                <span class="cov-item-meta">${conn.system ? 'Managed by your SOC' : ''}</span>
                ${end}
            </li>`;
    }

    _connectForm(vendor) {
        const { name } = this.vendors[vendor];
        const disabled = this.connecting ? 'disabled' : '';

        return `
            ${this._drawerHead(`Connect ${name}`, { sub: `Collect ${name} security events and alerts.`, back: this._iconBtn('back', 'arrow_back', 'All sources') })}
            <div class="cov-drawer-body cov-connect">
                ${this._logo(vendor, 'cov-connect-logo')}
                <div class="cov-field-head">
                    <label for="cov-cred">Credentials</label>
                    <a href="docs/${vendor}.html" target="_blank">Setup guide<span class="material-symbols-outlined">arrow_outward</span></a>
                </div>
                <textarea id="cov-cred" data-cred rows="5" spellcheck="false" ${disabled}
                          placeholder="Paste the JSON from the setup guide">${Workspace.esc(this.draft)}</textarea>
                <p class="cov-field-hint${this.error ? ' is-error' : ''}">${this.error ?? "You won't be able to view it again after connecting."}</p>
                <button type="button" class="cov-primary" data-submit ${disabled}>${this.connecting ? 'Connecting…' : `Connect ${name}`}</button>
            </div>`;
    }

    _mailbox() {
        return `${Workspace.encode(this.state.account())}@vex.unmanned.team`;
    }

    _mailboxView() {
        return `
            ${this._drawerHead('SOC mailbox', { sub: 'Collect signals from tools that can only send email.', back: this._iconBtn('back', 'arrow_back', 'All sources') })}
            <div class="cov-drawer-body cov-mailbox">
                <span class="material-symbols-outlined cov-connect-logo">alternate_email</span>
                <p>Every alert sent to this address becomes a signal for this account. Use it wherever a tool can email you but can't be connected directly.</p>

                <button type="button" class="cov-address" data-copy-mailbox title="Click to copy">
                    <code>${this._mailbox()}</code>
                    <span><span class="material-symbols-outlined">content_copy</span>Copy</span>
                </button>

                <h4>Works well for</h4>
                <ul>
                    <li><span class="material-symbols-outlined">security</span>Firewall and VPN appliance alerts</li>
                    <li><span class="material-symbols-outlined">router</span>ISP and network dashboard notifications</li>
                    <li><span class="material-symbols-outlined">mark_email_read</span>DMARC aggregate reports (set it as your <code>rua</code> address)</li>
                    <li><span class="material-symbols-outlined">notifications</span>Any service that emails security notices</li>
                </ul>
            </div>`;
    }

    // ── drawer: an asset ──

    _assetView(item) {
        const actions = `
            ${this._iconBtn('key', 'key', 'Copy dot key')}
            ${this._iconBtn('delete', 'delete', 'Delete', 'is-danger')}
            <span class="cov-head-divider"></span>`;

        return `
            ${this._drawerHead(Workspace.esc(item.name), { actions })}
            <div class="cov-drawer-body${item.dot ? '' : ' is-centered'}">
                ${item.dot ? this._runsView() : this._install(item)}
            </div>`;
    }

    _install(item) {
        return `
            <div class="cov-install">
                <span class="cov-install-mark"></span>
                <h4>No dot found</h4>
                <p>Install a dot to keep ${Workspace.esc(item.name)} hardened.</p>
                <button type="button" class="cov-primary" data-act="invite"><span class="material-symbols-outlined">mail</span>Send invitation</button>
            </div>`;
    }

    async _loadRuns() {
        const key = this.open.key;
        const runs = await this.api.inventory.get(this.items.get(key).dot.key) ?? [];
        if (this.open?.key !== key) return;   // they opened something else mid-fetch
        this.runs = runs.sort((a, b) => Workspace.time(b.created) - Workspace.time(a.created));
        this.runs.forEach(r => this._see(this.items.get(key), r.created));
        this._renderDrawer();
        this._render();
    }

    _runsView() {
        if (!this.runs.length) return '<p class="cov-quiet">No runs yet.</p>';

        const ok = Math.round(this.runs.filter(r => r.status === 'T0').length / this.runs.length * 100);

        return `
            <h4 class="cov-runs-head">Runs <span>${this.runs.length.toLocaleString()} · ${ok}% ok</span></h4>
            <ul class="cov-runs">${this.runs.map(r => this._run(r)).join('')}</ul>`;
    }

    _run(run) {
        const { tone, label, icon } = CoverageRollup.runStatus(run.status);
        const pack = this.packOf.get(String(run.id));
        const open = this.expanded === run.key;

        return `
            <li class="cov-run${open ? ' is-open' : ''}">
                <div class="cov-run-head" data-expand="${run.key}">
                    <span class="material-symbols-outlined cov-run-status is-${tone}" title="${label}">${icon}</span>
                    <span class="cov-run-name">${Workspace.esc(run.name)}</span>
                    ${pack ? `<span class="cov-run-pack">${Workspace.esc(pack)}</span>` : ''}
                    <time class="cov-run-time">${this._clock(run.created)}</time>
                    <button type="button" class="cov-icon-btn" data-rerun="${run.key}" title="Run again"><span class="material-symbols-outlined">replay</span></button>
                </div>
                ${open ? this._runOutput(run) : ''}
            </li>`;
    }

    _runOutput(run) {
        const output = this._output(run).trim();
        const text = run.status === 'PENDING' ? 'Still running…' : output ? Workspace.esc(output) : 'No output.';
        return `<pre class="cov-output">${text}</pre>`;
    }

    _toggleRun(key, li) {
        this.drawer.querySelector('.cov-run.is-open')?.classList.remove('is-open');
        this.drawer.querySelector('.cov-output')?.remove();
        this.expanded = this.expanded === key ? null : key;
        if (!this.expanded) return;

        li.classList.add('is-open');
        li.insertAdjacentHTML('beforeend', this._runOutput(this.runs.find(r => r.key === key)));
    }

    // ── actions ────────────────────────────────────────────────────

    async _rerun(key) {
        const { id, name } = this.runs.find(r => r.key === key);
        await SiteSpinner.withLoading(() => this.api.inventory.run(this.items.get(this.open.key).dot.key, { id, name }));
        this._toast(`${name} queued`);
        await this.refresh();
    }

    _copyKey() {
        const item = this.items.get(this.open.key);
        navigator.clipboard.writeText((item.dot ?? item.members[0]).token).then(() => this._toast('Dot key copied'));
    }

    async _invite() {
        const item = this.items.get(this.open.key);
        await SiteSpinner.withLoading(() => this.api.inventory.invite(item.members[0]));
        this._toast(`Install invite sent to ${item.name}`);
    }

    async _deleteAsset() {
        const item = this.items.get(this.open.key);
        await SiteSpinner.withLoading(() => Promise.all(item.members.map(a => this.api.inventory.delete(a.key))));
        this.items.delete(item.key);
        this._close();
        this._render();
    }

    async _submitFile(file) {
        await SiteSpinner.withLoading(async () => {
            const id = await this._hashId(file);
            const dot = file.name.lastIndexOf('.');
            const name = dot > 0 ? file.name.slice(0, dot) : file.name;
            const ext = dot > 0 ? file.name.slice(dot) : '';

            this.api.file.root = 'action';
            await this.api.file.add(new File([file], `${id}${ext}`, { type: file.type }));
            await this.api.inventory.run(this.items.get(this.open.key).dot.key, { id, name });
        });
        await this.refresh();
    }

    async _hashId(file) {
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        const hash = [...new Uint8Array(digest)].reduce((n, byte) => (n << 8n) | BigInt(byte), 0n);
        return Number(hash % 10n ** 13n);
    }

    _submitCredentials() {
        if (!this.draft.trim()) {
            this.error = 'Paste your credentials first.';
            return this._renderDrawer();
        }
        this._connect(this.open.key, this.draft.trim());
    }

    async _connect(vendor, value) {
        this.connecting = true;
        this.error = null;
        this._renderDrawer();

        try {
            await this.api.sources.connect(vendor, value);
        } catch {
            this.connecting = false;
            this.error = "Those credentials weren't accepted. If they're JSON, check that every quote is a straight double quote.";
            return this._renderDrawer();
        }
        this.connecting = false;

        const before = this._connections().map(c => c.ref);
        await this._load();
        const added = this._connections().map(c => c.ref).find(ref => !before.includes(ref));

        this._render();
        this._openDrawer('catalog');
        this.drawer.querySelector(`[data-ref="${added}"]`)?.classList.add('is-fresh');
        this._toast(`${this.vendors[vendor].name} connected`);
        document.dispatchEvent(new CustomEvent('page:reset'));
    }

    _disconnect(ref) {
        const [vendor, id] = ref.split('/');
        const name = this._sourceName({ vendor, id });
        this.api.sources.disconnect(ref);
        this.vendors[vendor].ids = this.vendors[vendor].ids.filter(i => i !== id);
        this.items.forEach(item => { if (item.ref === ref) item.ref = undefined; });
        this.confirming = null;
        this._render();
        this._renderDrawer();
        this._toast(`${name} disconnected`);
    }

    async _copyMailbox() {
        await navigator.clipboard.writeText(this._mailbox());
        this._toast('Mailbox address copied');
    }

    _toast(message) {
        this.toast.textContent = message;
        this.toast.classList.add('is-shown');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => this.toast.classList.remove('is-shown'), 2000);
    }

    // ── helpers ────────────────────────────────────────────────────

    _output(run) {
        return run.value ? new TextDecoder().decode(Uint8Array.from(run.value, c => c.charCodeAt(0))) : '';
    }

    _ago(ts) {
        const minutes = Math.round((Date.now() - Workspace.time(ts)) / 60000);
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
        return `${Math.round(minutes / 1440)}d ago`;
    }

    _clock(ts) {
        return new Date(Workspace.time(ts)).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    // ── events ─────────────────────────────────────────────────────

    listen() {
        this.search.addEventListener('input', () => this._filter());

        this.screen.addEventListener('click', (e) => {
            if (e.target.closest('[data-catalog]') && !this.connecting) this._openDrawer('catalog');
        });

        this.body.addEventListener('click', (e) => {
            const item = e.target.closest('[data-item]')?.dataset.item;
            if (item) this.open?.key === item ? this._close() : this._openDrawer('asset', item);
        });

        this.drawer.addEventListener('click', (e) => {
            const disconnect = e.target.closest('[data-disconnect]')?.dataset.disconnect;
            if (disconnect) {
                if (this.confirming === disconnect) return this._disconnect(disconnect);
                this.confirming = disconnect;
                return this._renderDrawer();
            }
            if (this.confirming) {
                this.confirming = null;
                this._renderDrawer();
            }

            const target = e.target.closest('[data-act], [data-connect], [data-expand], [data-rerun], [data-copy-mailbox], [data-submit]');
            if (!target) return;
            const { act, connect, expand, rerun } = target.dataset;

            if (rerun) return this._rerun(rerun);
            if (act === 'close') return this._close();
            if (act === 'back') return this._openDrawer('catalog');
            if (act === 'mailbox') return this._openDrawer('mailbox');
            if (act === 'invite') return this._invite();
            if (act === 'key') return this._copyKey();
            if (act === 'delete') return this._deleteAsset();
            if (connect) return this._openDrawer('connect', connect);
            if ('copyMailbox' in target.dataset) return this._copyMailbox();
            if ('submit' in target.dataset && !this.connecting) return this._submitCredentials();

            if (expand) this._toggleRun(expand, target.closest('.cov-run'));
        });

        this.drawer.addEventListener('input', (e) => {
            if (e.target.matches('[data-cred]')) this.draft = e.target.value;
        });

        this.drawer.addEventListener('keydown', (e) => {
            if (e.target.matches('[data-cred]') && e.key === 'Enter') {
                e.preventDefault();
                this._submitCredentials();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || !this.open || this.connecting || !this.screen.checkVisibility()) return;
            ['connect', 'mailbox'].includes(this.open.kind) ? this._openDrawer('catalog') : this._close();
        });

        const droppable = () => this.open?.kind === 'asset' && this.items.get(this.open.key).dot;

        this.drawer.addEventListener('dragover', (e) => {
            if (!droppable()) return;
            e.preventDefault();
            this.drawer.classList.add('is-dropping');
        });
        this.drawer.addEventListener('dragleave', (e) => {
            if (!this.drawer.contains(e.relatedTarget)) this.drawer.classList.remove('is-dropping');
        });
        this.drawer.addEventListener('drop', (e) => {
            e.preventDefault();
            this.drawer.classList.remove('is-dropping');
            const file = e.dataTransfer.files[0];
            if (file && droppable()) this._submitFile(file);
        });
    }
}