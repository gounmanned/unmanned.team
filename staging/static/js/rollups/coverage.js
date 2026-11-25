// integrations a user can connect; each needs static/img/source/<key>.png
const CONNECTABLE = {
    aws: 'AWS',
    azure: 'Azure',
    cloudflare: 'Cloudflare',
    constantcontact: 'Constant Contact',
    datto: 'Datto',
    github: 'GitHub',
    godaddy: 'GoDaddy',
    google: 'Google Workspace',
    hubspot: 'HubSpot',
    jira: 'Jira',
    level: 'Level',
    microsoft: 'Microsoft 365',
    okta: 'Okta',
    orca: 'Orca',
    ramp: 'Ramp',
    rapid7: 'Rapid7',
    shopify: 'Shopify',
    slack: 'Slack',
    square: 'Square',
    teams: 'Microsoft Teams',
};

// every source we can name, including ones that only arrive on assets
const SOURCE_NAMES = {
    ...CONNECTABLE,
    stripe: 'Stripe',
    vex: 'VEX',
};

class CoverageRollup {
    static RUN_STATUS = {
        // Phosphor icons from Pulse. GAP: Pulse has no "pending" icon, so pending uses info.
        T0: { tone: 'ok', label: 'Success', icon: 'check-circle' },
        PENDING: { tone: 'pending', label: 'Pending', icon: 'info' },
        FAILED: { tone: 'bad', label: 'Failed', icon: 'warning-octagon' },
    };

    static STATE_RANK = { live: 0, idle: 1, none: 2 };

    static runStatus(status) {
        return CoverageRollup.RUN_STATUS[status] ?? CoverageRollup.RUN_STATUS.FAILED;
    }

    static isActive(ts) {
        return Date.now() - Workspace.time(ts) < 15 * 60000;
    }

    static later(a, b) {
        return !b || Workspace.time(a) > Workspace.time(b) ? a : b;
    }

    static byState = (a, b) => CoverageRollup.STATE_RANK[a.state] - CoverageRollup.STATE_RANK[b.state];

    static byDot = (a, b) => CoverageRollup.byState(a, b) || a.name.localeCompare(b.name);

    constructor(state) {
        this.state = state;
        this.api = state.api;

        this.screen = document.getElementById('coverage-screen');
        this.body = document.getElementById('cov-body');
        this.search = document.getElementById('cov-search');
        this.stats = document.getElementById('cov-stats');
        this.drawer = document.getElementById('cov-drawer');
        this.sourcesBtn = document.getElementById('cov-sources-btn');

        this.vendors = Object.fromEntries(Object.entries(CONNECTABLE).map(([key, name]) => [key, { name, ids: [] }]));   // vendor -> { name, ids }
        this.items = new Map();     // name -> person { key, name, ref, devices: [{ key, asset, runtime, seen, state }] }
        this.loaded = false;

        this.confirming = null;     // source ref whose disconnect awaits a second click

        this.open = null;           // drawer: { kind: 'asset' | 'catalog' | 'connect' | 'mailbox', key, device }
        this.runs = null;           // open device's runs, newest first (null while loading)
        this.expanded = null;       // run whose output is showing
        this.draft = '';
        this.error = null;
        this.connecting = false;

        this.listen();
        setInterval(() => this.loaded && this.screen.checkVisibility() && this._tick(), 60000);
    }

    // ── lifecycle ──────────────────────────────────────────────────

    reset() {
        this.loaded = false;
        this.items = new Map();
        this.confirming = null;
        this.search.value = '';
        Object.values(this.vendors).forEach(v => { v.ids = []; });
        this._close();
        this._render();
    }

    async reload() {
        await this._load();
        this._render();
        this._loadSeen();
    }

    async refresh() {
        await this._tick();
        if (this.open?.kind !== 'asset') return;
        this._device() ? this._loadRuns() : this._close();
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
        await Promise.all(this._devices().filter(d => d.runtime).map(async device => {
            const runs = await this.api.inventory.get(device.key) ?? [];
            runs.forEach(r => this._see(device, r.created));
        }));
        this._render();
    }

    _see(device, ts) {
        device.seen = CoverageRollup.later(ts, device.seen);
        device.state = CoverageRollup.isActive(device.seen) ? 'live' : 'idle';
    }

    // ── model ──────────────────────────────────────────────────────

    _parse(raw) {
        const [, , vendor, id] = raw.split('/');
        return { vendor, id, ref: `${vendor}/${id}` };
    }

    // one person per name; each of their assets is a device that can carry a dot
    _merge(assets, sources) {
        const groups = Map.groupBy(assets, a => a.name.toLowerCase());

        return new Map([...groups].map(([key, members]) => {
            const sourceOf = a => a.source && sources.find(s => s.includes(a.source));
            const found = members.find(sourceOf);
            const previous = this.items.get(key)?.devices ?? [];

            const devices = members.map(asset => {
                const device = { key: asset.key, id: asset.key.slice(asset.key.lastIndexOf(':') + 1), asset, runtime: asset.metadata.runtime, state: 'none' };
                const seen = previous.find(d => d.key === asset.key)?.seen;
                if (device.runtime) this._see(device, CoverageRollup.later(asset.updated, seen));
                return device;
            });

            return [key, {
                key,
                name: (found ?? members[0]).name,
                ref: found && this._parse(sourceOf(found)).ref,
                origin: members.map(a => a.source).find(s => s && s !== 'vex') ?? members.find(a => a.source === 'vex')?.source,   // the asset's own source, when it isn't a connection
                devices,
                get top() { return [...this.devices].sort(CoverageRollup.byState)[0]; },   // most active device
                get state() { return this.top.state; },
                get seen() { return this.devices.reduce((latest, d) => d.seen ? CoverageRollup.later(d.seen, latest) : latest, undefined); },
                get score() {   // weakest device sets the person's score
                    const scores = this.devices.map(d => d.asset.metadata.score).filter(s => s != null);
                    return scores.length ? Math.min(...scores) : undefined;
                },
            }];
        }));
    }

    _devices() {
        return [...this.items.values()].flatMap(p => p.devices);
    }

    _device() {
        return this.items.get(this.open.key)?.devices.find(d => d.key === this.open.device);
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
        const stack = vendors.slice(0, 4).map(v => `<span class="pulse-avatar pulse-avatar--sm pulse-avatar--circle">${this._logo(v, '')}</span>`).join('');
        const more = vendors.length > 4 ? `<span class="pulse-avatar pulse-avatar--sm pulse-avatar--circle pulse-avatar--more">+${vendors.length - 4}</span>` : '';

        this.sourcesBtn.classList.toggle('is-active', this._sourcesOpen());
        this.sourcesBtn.innerHTML = conns.length
            ? `<span class="pulse-avatar-group" aria-hidden="true">${stack}${more}</span>Sources <span class="pulse-chip__count">${conns.length + 1}</span>`
            : '<i class="pulse-icon pulse-icon--plus" aria-hidden="true"></i>Connect a source';
    }

    _renderStats() {
        const devices = this._devices();
        const n = value => this.loaded ? value : '—';

        const assets = devices.length, dots = devices.filter(d => d.runtime).length;
        this.stats.innerHTML = `<li><strong>${n(assets)}</strong> asset${assets === 1 ? '' : 's'}</li><li><strong>${n(dots)}</strong> Dot${dots === 1 ? '' : 's'}</li>`;
    }

    _renderBody() {
        if (!this.loaded) return this.body.innerHTML = '';

        if (!this._connections().length && !this.items.size) {
            return this.body.innerHTML = `
                <div class="pulse-empty cov-empty">
                    <i class="pulse-icon pulse-icon--graph pulse-empty__icon" aria-hidden="true"></i>
                    <p class="pulse-empty__title">Nothing connected yet</p>
                    <p class="pulse-empty__text">Connect a source. Then install Dots.</p>
                    <div class="pulse-empty__actions"><button type="button" class="pulse-btn pulse-btn--primary pulse-btn--sm" data-catalog><i class="pulse-icon pulse-icon--plus" aria-hidden="true"></i>Add source</button></div>
                </div>`;
        }

        const items = [...this.items.values()].sort(CoverageRollup.byDot);
        const sources = new Map(this._connections().map(c => [c.ref, c]));

        // Pulse data table (compact, interactive). Optional columns drop while the drawer is open (is-condensed).
        this.body.innerHTML = `
            ${items.length ? `
                <table class="pulse-table pulse-table--compact pulse-table--interactive cov-table${this.open ? ' is-condensed' : ''}">
                    <thead><tr>
                        <th scope="col" class="cov-dot-col" aria-label="Status"></th>
                        <th scope="col">Asset</th>
                        <th scope="col" data-optional>Source</th>
                        <th scope="col" class="pulse-table__num">Score</th>
                        <th scope="col" data-optional>Runtime</th>
                        <th scope="col" class="pulse-table__num" data-optional>Last seen</th>
                    </tr></thead>
                    <tbody>${items.map(i => this._row(i, sources.get(i.ref))).join('')}</tbody>
                </table>` : ''}
            <p class="cov-no-match">No match</p>`;

        this._filter();
    }

    _logo(vendor, cls) {
        const src = vendor === 'vex' ? Workspace.avatar('vex') : `static/img/source/${vendor}.png`;   // VEX's own mark
        return `<img class="${cls}" src="${src}" alt="">`;
    }

    _row(person, source) {
        const selected = this.open?.kind === 'asset' && this.open.key === person.key;
        const count = person.devices.length;
        const runtimes = [...new Set(person.devices.map(d => d.runtime).filter(Boolean))].join(', ');

        const dot = { live: 'pulse-status-dot--success pulse-status-dot--live', idle: 'pulse-status-dot--warning pulse-status-dot--idle' }[person.state] ?? 'pulse-status-dot--none';
        const label = { live: 'Live', idle: 'Idle' }[person.state] ?? 'No Dot';

        // The row opens the asset; the name is a button too, for keyboard users (Pulse's table rule).
        return `
            <tr class="cov-row is-${person.state}" data-item="${Workspace.esc(person.key)}" aria-selected="${selected}">
                <td class="cov-dot-col"><span class="pulse-status-dot ${dot}" role="img" aria-label="${label}"></span></td>
                <td><button type="button" class="cov-name">${Workspace.esc(person.name)}</button>${count > 1 ? `<small class="cov-count">${count} devices</small>` : ''}</td>
                <td data-optional class="cov-col-source">${this._sourceCell(person, source)}</td>
                <td class="pulse-table__num">${this._scoreCell(person.score)}</td>
                <td data-optional class="cov-col-extra">${Workspace.esc(runtimes)}</td>
                <td data-optional class="pulse-table__num cov-col-extra">${person.seen ? this._ago(person.seen) : ''}</td>
            </tr>`;
    }

    _scoreCell(score) {
        if (score == null) return '<span class="cov-score">—</span>';
        const tone = score >= 80 ? ' is-ok' : score <= 25 ? ' is-bad' : '';
        return `<span class="cov-score${tone}">${score}%</span>`;
    }

    _sourceCell(person, source) {
        if (source) return `${this._logo(source.vendor, 'cov-chip-logo')}${this._sourceName(source)}`;
        if (person.origin) return `${this._logo(person.origin, 'cov-chip-logo')}${Workspace.esc(person.origin === 'vex' ? Workspace.product() : (SOURCE_NAMES[person.origin] ?? person.origin))}`;
        return '—';
    }

    _filter() {
        const query = this.search.value.trim().toLowerCase();
        for (const row of this.body.querySelectorAll('.cov-row[data-item]')) {
            const assets = this.items.get(row.dataset.item).devices.map(d => d.asset);
            row.hidden = !(JSON.stringify(assets) + row.textContent).toLowerCase().includes(query);
        }
        this.body.classList.toggle('no-match', !!query && !this.body.querySelector('.cov-row[data-item]:not([hidden])'));
    }

    // ── drawer ─────────────────────────────────────────────────────

    // for an asset, `device` picks the tab; it defaults to the person's most active device
    _openDrawer(kind, key, device) {
        this.open = { kind, key };
        this.error = null;
        this.expanded = null;
        this.confirming = null;
        if (kind !== 'connect') this.draft = '';

        if (kind === 'asset') {
            this.open.device = device ?? this.items.get(key).top.key;
            this.runs = null;
        }

        this.screen.classList.add('drawer-open');
        this.body.querySelector('.cov-table')?.classList.add('is-condensed');
        this._renderDrawer();
        this._markSelected();

        if (kind === 'asset' && this._device().runtime) this._loadRuns();
        if (kind === 'connect') this.drawer.querySelector('[data-cred]').focus();
    }

    _close() {
        this.open = null;
        this.screen.classList.remove('drawer-open');
        this.body.querySelector('.cov-table')?.classList.remove('is-condensed');
        this.drawer.hidden = true;
        this._markSelected();
    }

    _markSelected() {
        const key = this.open?.kind === 'asset' && this.open.key;
        this.body.querySelectorAll('.cov-row').forEach(row => row.setAttribute('aria-selected', row.dataset.item === key));
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
        // Pulse drawer head: back, heading (title + description), end area (actions), close X.
        return `
            <header class="pulse-drawer__head cov-drawer-head">
                ${back}
                <div class="pulse-drawer__heading">
                    <h3 class="pulse-drawer__title">${title}</h3>
                    ${sub ? `<p class="pulse-drawer__desc">${sub}</p>` : ''}
                </div>
                ${actions ? `<div class="pulse-drawer__end">${actions}</div>` : ''}
                ${this._iconBtn('close', 'close', 'Close', 'pulse-drawer__close')}
            </header>`;
    }

    // Pulse icon buttons, all Phosphor.
    _iconBtn(act, icon, title, cls = '') {
        const pulse = { close: 'x', arrow_back: 'arrow-left', key: 'key', delete: 'trash' }[icon] ?? icon;
        const glyph = `<i class="pulse-icon pulse-icon--${pulse}" aria-hidden="true"></i>`;
        // Tooltips only where the icon isn't a convention: the close X gets none.
        const tip = act === 'close' ? '' : `<span class="pulse-tooltip pulse-tooltip--bottom pulse-tooltip--end" aria-hidden="true">${title}</span>`;
        return `<button type="button" class="${tip ? 'pulse-tooltip-host ' : ''}pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm cov-icon-btn ${cls}" data-act="${act}" aria-label="${title}">${glyph}${tip}</button>`;
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
                    <h4 class="pulse-eyebrow cov-section-head">Connected <span>${conns.length + 1}</span></h4>
                    <ul class="cov-list">
                        <li class="cov-item is-link" data-act="mailbox">
                            <i class="pulse-icon pulse-icon--envelope cov-item-logo" aria-hidden="true"></i>
                            <span class="cov-item-name">SOC mailbox</span>
                            <i class="pulse-icon pulse-icon--arrow-right cov-conn-end cov-item-enter" aria-hidden="true"></i>
                            <span class="cov-item-meta">Managed by your SOC</span>
                            <i class="pulse-icon pulse-icon--lock-simple pulse-icon--fill cov-conn-end" aria-hidden="true"></i>
                        </li>
                        ${conns.map(c => this._conn(c)).join('')}
                    </ul>
                </section>

                ${available.length ? `
                    <section>
                        <h4 class="pulse-eyebrow cov-section-head">Available <span>${available.length}</span></h4>
                        <ul class="cov-list">
                            ${available.map(v => `
                                <li class="cov-item is-link" data-connect="${v}">
                                    ${this._logo(v, 'cov-item-logo')}
                                    <span class="cov-item-name">${this.vendors[v].name}</span>
                                    <span class="cov-item-go">Connect <i class="pulse-icon pulse-icon--arrow-right" aria-hidden="true"></i></span>
                                </li>`).join('')}
                        </ul>
                    </section>` : ''}
            </div>`;
    }

    _conn(conn) {
        const end = conn.system
            ? '<i class="pulse-icon pulse-icon--lock-simple pulse-icon--fill cov-conn-end" title="Managed by your SOC" aria-hidden="true"></i>'
            : `<span class="pulse-row-actions"><button type="button" class="pulse-tooltip-host pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm cov-conn-action" data-disconnect="${conn.ref}" aria-label="Disconnect"><i class="pulse-icon pulse-icon--link-break" aria-hidden="true"></i><span class="pulse-tooltip pulse-tooltip--bottom pulse-tooltip--end" aria-hidden="true">Disconnect</span></button></span>`;

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
                <div class="pulse-field${this.error ? ' pulse-field--error' : ''}">
                    <div class="cov-field-head">
                        <label class="pulse-field__label" for="cov-cred">Credentials</label>
                        <a class="pulse-link pulse-link--xs" href="https://unmanned.team/docs/${vendor}" target="_blank" rel="noopener">Setup guide <i class="pulse-icon pulse-icon--arrow-square-out" aria-hidden="true"></i></a>
                    </div>
                    <textarea class="pulse-textarea cov-cred" id="cov-cred" data-cred rows="5" spellcheck="false" ${disabled}
                              placeholder="Paste the JSON from the setup guide" aria-describedby="cov-cred-help"${this.error ? ' aria-invalid="true"' : ''}>${Workspace.esc(this.draft)}</textarea>
                    <span class="pulse-field__help" id="cov-cred-help">${this.error ?? "You won’t be able to view it again after connecting."}</span>
                </div>
                <button type="button" class="pulse-btn pulse-btn--primary" data-submit ${disabled} ${this.connecting ? 'aria-busy="true"' : ''}>${this.connecting ? 'Connecting…' : `Connect ${name}`}</button>
            </div>`;
    }

    _mailbox() {
        return `${Workspace.encode(this.state.account())}@vex.unmanned.team`;
    }

    _mailboxView() {
        return `
            ${this._drawerHead('SOC mailbox', { sub: 'Collect signals from tools that can only send email.', back: this._iconBtn('back', 'arrow_back', 'All sources') })}
            <div class="cov-drawer-body cov-mailbox">
                <i class="pulse-icon pulse-icon--envelope pulse-icon--light cov-connect-logo" aria-hidden="true"></i>
                <p>Every alert sent to this address becomes a signal for this account. Use it wherever a tool can email you but can't be connected directly.</p>

                <div class="pulse-input-group pulse-input-group--readonly cov-address">
                    <input class="pulse-input" id="cov-mailbox-address" value="${Workspace.esc(this._mailbox())}" readonly aria-label="SOC mailbox address">
                    <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm pulse-tooltip-host" type="button" data-pulse-copy="cov-mailbox-address" aria-label="Copy the mailbox address">
                        <i class="pulse-icon pulse-icon--copy" aria-hidden="true"></i><span class="pulse-tooltip pulse-tooltip--bottom pulse-tooltip--end" aria-hidden="true">Copy</span>
                    </button>
                </div>

                <h4 class="pulse-eyebrow">Works well for</h4>
                <ul>
                    <li><i class="pulse-icon pulse-icon--shield" aria-hidden="true"></i>Firewall and VPN appliance alerts</li>
                    <li><i class="pulse-icon pulse-icon--globe" aria-hidden="true"></i>ISP and network dashboard notifications</li>
                    <li><i class="pulse-icon pulse-icon--envelope" aria-hidden="true"></i>DMARC aggregate reports (set it as your <code>rua</code> address)</li>
                    <li><i class="pulse-icon pulse-icon--bell" aria-hidden="true"></i>Any service that emails security notices</li>
                </ul>
            </div>`;
    }

    // ── drawer: a person and their devices ──

    _assetView(person) {
        const device = this._device();
        // Delete sits in a More menu, away from the close X, and confirms first.
        const actions = `
            ${this._iconBtn('key', 'key', 'Copy Dot key for this device')}
            <div class="pulse-menu-anchor pulse-menu-anchor--end">
                <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm" type="button" data-pulse-menu aria-haspopup="menu" aria-controls="cov-device-more" aria-label="More actions">
                    <i class="pulse-icon pulse-icon--dots-three pulse-icon--bold" aria-hidden="true"></i>
                </button>
                <div class="pulse-dropdown pulse-dropdown--menu" id="cov-device-more" hidden>
                    <div role="menu" aria-label="Device actions">
                        <button class="pulse-menu-item pulse-menu-item--danger" type="button" role="menuitem" data-act="delete"><i class="pulse-icon pulse-icon--trash" aria-hidden="true"></i><span class="pulse-menu-item__label">Delete device</span></button>
                    </div>
                </div>
            </div>
`;

        return `
            ${this._drawerHead(Workspace.esc(person.name), { actions })}
            ${this._deviceTabs(person)}
            <div class="cov-drawer-body${device.runtime ? '' : ' is-centered'}">
                ${device.runtime ? this._runsView() : this._install()}
            </div>`;
    }

    _deviceTabs(person) {
        const tabs = person.devices.map(d => `
            <button type="button" class="pulse-chip cov-device is-${d.state}" data-device="${Workspace.esc(d.key)}" aria-pressed="${d.key === this.open.device}" title="${Workspace.esc(d.key)}">
                <span class="pulse-status-dot ${{ live: 'pulse-status-dot--success pulse-status-dot--live', idle: 'pulse-status-dot--warning pulse-status-dot--idle' }[d.state] ?? 'pulse-status-dot--none'}" aria-hidden="true"></span><code>${Workspace.esc(d.id)}</code>${d.runtime ? `<small>${Workspace.esc(d.runtime)}</small>` : ''}
            </button>`).join('');

        return `
            <nav class="cov-devices" aria-label="Devices">
                ${tabs}
                <button type="button" class="pulse-btn pulse-btn--ghost pulse-btn--sm cov-device-add" data-act="add-device" title="Add another computer for ${Workspace.esc(person.name)}">Add device</button>
            </nav>`;
    }

    _install() {
        return `
            <div class="cov-install">
                <span class="cov-install-mark"></span>
                <h4>No Dot on this device</h4>
                <p>Install a Dot on this computer to keep it hardened.</p>
                <button type="button" class="pulse-btn pulse-btn--primary" data-act="invite"><i class="pulse-icon pulse-icon--envelope" aria-hidden="true"></i> Invite</button>
            </div>`;
    }

    async _loadRuns() {
        const { device } = this.open;
        const runs = await this.api.inventory.get(device) ?? [];
        if (this.open?.device !== device) return;   // they opened something else mid-fetch
        this.runs = runs.sort((a, b) => Workspace.time(b.created) - Workspace.time(a.created));
        this.runs.forEach(r => this._see(this._device(), r.created));
        this._renderDrawer();
        this._render();
    }

    _runsView() {
        if (!this.runs) return '';
        if (!this.runs.length) return '<p class="cov-quiet">No runs yet.</p>';

        const ok = Math.round(this.runs.filter(r => r.status === 'T0').length / this.runs.length * 100);

        return `
            <h4 class="pulse-eyebrow cov-runs-head">Runs <span>${this.runs.length.toLocaleString()} · ${ok}% ok</span></h4>
            <ul class="cov-runs">${this.runs.map(r => this._run(r)).join('')}</ul>`;
    }

    _run(run) {
        const { tone, label, icon } = CoverageRollup.runStatus(run.status);
        const open = this.expanded === run.key;

        return `
            <li class="cov-run${open ? ' is-open' : ''}">
                <div class="cov-run-head" data-expand="${run.key}">
                    <i class="pulse-icon pulse-icon--${icon} pulse-icon--fill cov-run-status is-${tone}" title="${label}" role="img" aria-label="${label}"></i>
                    <span class="cov-run-name">${Workspace.esc(run.name)}</span>
                    <time class="cov-run-time">${this._clock(run.created)}</time>
                    <span class="pulse-row-actions"><button type="button" class="pulse-tooltip-host pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm cov-icon-btn" data-rerun="${run.key}" aria-label="Run again"><i class="pulse-icon pulse-icon--arrow-counter-clockwise" aria-hidden="true"></i><span class="pulse-tooltip pulse-tooltip--bottom pulse-tooltip--end" aria-hidden="true">Run again</span></button></span>
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
        await Pulse.loading(() => this.api.inventory.run(this.open.device, { id, name }));
        this._toast(`${name} queued`);
        await this.refresh();
    }

    _copyKey() {
        navigator.clipboard.writeText(this._device().asset.token).then(() => this._toast('Dot key copied'));
    }

    async _invite() {
        const person = this.items.get(this.open.key);
        await Pulse.loading(() => this.api.inventory.invite(this._device().asset));
        this._toast(`Install invite sent to ${person.name}`);
    }

    async _addDevice() {
        const person = this.items.get(this.open.key);
        const before = new Set(person.devices.map(d => d.key));

        await Pulse.loading(() => this.api.inventory.create({ asset: this._device().asset.asset, source: 'vex' }));
        await this._load();
        this._render();

        const added = this.items.get(person.key).devices.find(d => !before.has(d.key));
        this._openDrawer('asset', person.key, added.key);
        this._toast(`Device added for ${person.name}`);
    }

    async _deleteDevice() {
        const person = this.items.get(this.open.key);
        const device = this._device();
        // A destructive action confirms first.
        const ok = await Pulse.confirm({
            title: 'Delete this device?',
            body: 'Its Dot stops reporting and the device leaves Coverage. You can’t undo it.',
            resource: `${person.name} · ${device.asset?.id ?? device.key}`,
            action: 'Delete device',
        });
        if (!ok) return;
        await Pulse.loading(() => this.api.inventory.delete(device.key));

        person.devices = person.devices.filter(d => d !== device);
        if (person.devices.length) {
            this._openDrawer('asset', person.key);
        } else {
            this.items.delete(person.key);
            this._close();
        }
        this._render();
    }

    async _submitFile(file) {
        await Pulse.loading(async () => {
            const id = await this._hashId(file);
            const dot = file.name.lastIndexOf('.');
            const name = dot > 0 ? file.name.slice(0, dot) : file.name;
            const ext = dot > 0 ? file.name.slice(dot) : '';

            this.api.file.root = 'actions';
            await this.api.file.add(new File([file], `${id}${ext}`, { type: file.type }));
            await this.api.inventory.run(this.open.device, { id, name });
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

    // Pulse toast (its toaster sits in the top layer, so it shows over this panel).
    _toast(message) {
        window.Pulse?.toast({ title: message, tone: 'neutral', icon: false, duration: 3000 });
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

        const acts = {
            close: () => this._close(),
            back: () => this._openDrawer('catalog'),
            mailbox: () => this._openDrawer('mailbox'),
            invite: () => this._invite(),
            key: () => this._copyKey(),
            'add-device': () => this._addDevice(),
            delete: () => this._deleteDevice(),
        };

        this.drawer.addEventListener('click', (e) => {
            // Disconnect confirms first.
            const disconnect = e.target.closest('[data-disconnect]')?.dataset.disconnect;
            if (disconnect) {
                const [vendor, id] = disconnect.split('/');
                const name = this._sourceName({ vendor, id }) || 'this source';
                return Pulse.confirm({
                    title: 'Disconnect this source?',
                    body: 'VEX stops reading it. Signals already collected stay. You can connect it again later.',
                    resource: name,
                    action: 'Disconnect',
                }).then(ok => ok && this._disconnect(disconnect));
            }

            const target = e.target.closest('[data-act], [data-connect], [data-device], [data-expand], [data-rerun], [data-copy-mailbox], [data-submit]');
            if (!target) return;
            const { act, connect, device, expand, rerun } = target.dataset;

            if (rerun) return this._rerun(rerun);
            if (device) return this._openDrawer('asset', this.open.key, device);
            if (act) return acts[act]();
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
            e.preventDefault(); // closing the inner drawer wins over closing the panel
            ['connect', 'mailbox'].includes(this.open.kind) ? this._openDrawer('catalog') : this._close();
        });

        const droppable = () => this.open?.kind === 'asset' && this._device()?.runtime;

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