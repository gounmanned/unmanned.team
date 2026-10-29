class ManagedRollup {
    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.list = document.getElementById('managed-accounts');
        this.hero = document.querySelector('#managed-screen .managed-hero');
        this.detail = document.querySelector('#managed-screen .managed-detail');
        this.members = new Map();
        this.selected = null;
        this.expanded = new Set();
        this.parents = new Map();
        this.children = new Map();
        this.summary = new ManagedSummary();
        this.listen();
    }

    reset() {
        this.members.forEach((_, domain) => {
            this._setBadgeLoading(domain);
            this._setUnread(domain, false);
            this._setThreat(domain, 0);
        });
        this.summary.reset();
    }

    async reload() {
        await this.load();

        (async () => {
            await this.api.managed.signals(new CustomEvent("signal:managed"));
            this.members.forEach((_, domain) => this._settleBadge(domain));
            this._arrange();
            this._renderHero();
            if (this.selected) this._selectAccount(this.selected);
        })();

        (async () => {
            this.summary.resetAssets();
            await this.api.managed.assets(new CustomEvent("managed:asset"));
            this.summary.renderAssets();
        })();
    }

    async load() {
        const grants = await this.api.managed.grants(this.state.user.email);
        Object.entries(grants).forEach(([domain, members]) => this._add(domain, members));

        const pending = await this.api.managed.grants("pending");
        (pending ?? []).forEach((email) => {
            const domain = email.split("@")[1];
            this._add(domain, [], false);
        });

        this._arrange();
        document.querySelector('.managed-accounts-wrap').classList.toggle('empty', this.members.size === 0);
    }

    _showDetail(show) {
        this.hero.hidden = show;
        this.detail.hidden = !show;
    }

    _open(domain) {
        return Object.values(this.state.signals[domain] ?? {})
            .filter(t => t.status.startsWith('O'));
    }

    _renderHero() {
        const threatCounts = [...this.members.keys()].map(domain =>
            this._open(domain).filter(t => t.metadata?.threat).length
        );

        const threats = threatCounts.reduce((n, c) => n + c, 0);
        const affected = threatCounts.filter(Boolean).length;

        const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
        const title = this.hero.querySelector('.managed-hero-title');
        const text = this.hero.querySelector('.managed-hero-text');
        const icon = document.getElementById('managed-hero-icon');

        this.hero.classList.toggle('is-threat', threats > 0);
        icon.src = threats ? 'https://cdn.unmanned.team/img/logo.png' : 'static/img/status/CH.svg';

        if (threats) {
            title.textContent = threats.toLocaleString();
            text.textContent = `Active threats across ${affected.toLocaleString()} of ${plural(threatCounts.length, 'account')}`;
        } else {
            title.textContent = 'All clear.';
            text.textContent = `No active threats across ${plural(threatCounts.length, 'account')}`;
        }
    }

    _row(domain) {
        return document.getElementById(`managed-account-${domain}`);
    }

    _setBadge(domain, count) {
        const badge = this._row(domain).querySelector('.managed-badge-content');

        if (count === 0) {
            badge.innerHTML = '<img src="static/img/status/CH.svg" class="managed-badge-icon">';
        } else {
            badge.textContent = count > 999 ? '999' : count;
        }
    }

    _setBadgeLoading(domain) {
        this._row(domain).querySelector('.managed-badge-content').innerHTML = '<span class="managed-badge-spinner"></span>';
    }

    _settleBadge(domain) {
        const scope = this._collapsed(domain) ? this._subtree(domain) : [domain];
        const open = scope.flatMap(d => this._open(d));

        this._setBadge(domain, open.length);
        this._setUnread(domain, open.some(t => !t.read));
        this._setThreat(domain, open.filter(t => t.metadata?.threat).length);
    }

    _setUnread(domain, unread) {
        this._row(domain).querySelector('.managed-account-badge').classList.toggle('has-unread', unread);
    }

    _setThreat(domain, count) {
        const li = this._row(domain);
        li.classList.toggle('has-threat', count > 0);
        li.querySelector('.managed-account-threat').textContent = count > 99 ? '99+' : count;
    }

    _collapsed(domain) {
        return this.children.has(domain) && !this.expanded.has(domain);
    }

    _parent(domain) {
        return this.members.get(domain)
            .map(email => email.split('@')[1])
            .find(d => d !== domain && this.members.has(d));
    }

    _subtree(domain, seen = new Set()) {
        if (seen.has(domain)) return [];
        seen.add(domain);
        return [domain, ...(this.children.get(domain) ?? []).flatMap(child => this._subtree(child, seen))];
    }

    _branch(domain) {
        const chain = [];
        while (domain && !chain.includes(domain)) {
            chain.push(domain);
            domain = this.parents.get(domain);
        }
        return chain;
    }

    _arrange() {
        this.parents = new Map();
        this.children = new Map();
        const roots = [];

        this.members.forEach((_, domain) => {
            const parent = this._parent(domain);
            if (!parent) return roots.push(domain);
            this.parents.set(domain, parent);
            if (!this.children.has(parent)) this.children.set(parent, []);
            this.children.get(parent).push(domain);
        });

        const totals = new Map();
        this.members.forEach((_, domain) => {
            totals.set(domain, this._subtree(domain).reduce((n, d) => n + this._open(d).length, 0));
        });

        const byTotal = (a, b) => totals.get(b) - totals.get(a);
        const placed = new Set();

        const place = (domain, depth, hidden = false) => {
            if (placed.has(domain)) return;
            placed.add(domain);

            const kids = (this.children.get(domain) ?? []).sort(byTotal);
            const collapsed = this._collapsed(domain);

            const li = this._row(domain);
            li.style.setProperty('--depth', depth);
            li.classList.toggle('has-children', kids.length > 0);
            li.classList.toggle('collapsed', collapsed);
            li.hidden = hidden;
            this.list.appendChild(li);

            kids.forEach(child => place(child, depth + 1, hidden || collapsed));
        };

        roots.sort(byTotal).forEach(domain => place(domain, 0));
        this.members.forEach((_, domain) => place(domain, 0));
    }

    _add(domain, members = [], enabled = true) {
        if (this.members.has(domain)) return;
        this.members.set(domain, members);

        const li = document.createElement('li');
        li.id = `managed-account-${domain}`;
        li.dataset.domain = domain;
        li.className = `managed-account-item${enabled ? '' : ' pending'}`;
        li.innerHTML = `
            <button class="managed-account-toggle" title="Expand / collapse">
                <span class="material-symbols-outlined">chevron_right</span>
            </button>
            <span class="managed-account-badge">
                <span class="managed-badge-content"></span>
            </span>
            <span class="managed-account-name">${domain}</span>
            <span class="managed-account-threat" title="Active threats"></span>
        `;

        this.list.appendChild(li);
        this._setBadgeLoading(domain);
    }

    _selectAccount(domain) {
        this.selected = domain;
        const admins = this.members.get(domain);
        const signals = this._open(domain).sort((a, b) => b.created.localeCompare(a.created));

        const midnight = new Date();
        midnight.setHours(0, 0, 0, 0);

        this._showDetail(true);
        this.detail.innerHTML = `
            <div class="managed-detail-col managed-detail-col--admins">
                <div class="managed-col-header">
                    <img class="managed-overview-favicon"
                        src="https://www.google.com/s2/favicons?domain=${domain}&sz=64"
                        onerror="this.src='https://cdn.unmanned.team/img/logo.png'"
                        alt="${domain}">
                    <span class="managed-col-header-title">${domain}</span>
                </div>
                <div class="managed-col-body">
                    <ul class="managed-admin-list">
                        ${admins.map(email => `
                            <li class="managed-row-item">
                                <img class="managed-row-avatar" src="${Workspace.avatar(email)}">
                                <span class="managed-row-label">${email}</span>
                                <button class="managed-row-action" data-email="${email}" title="Remove">
                                    <span class="material-symbols-outlined">close</span>
                                </button>
                            </li>
                        `).join('') || `<li class="managed-row-empty">No administrators yet</li>`}
                    </ul>
                </div>
                <div class="managed-col-footer">
                    <input class="managed-footer-input" type="text" placeholder="Invite by email"/>
                    <button class="managed-footer-btn">
                        <span class="material-symbols-outlined">person_add</span>
                    </button>
                </div>
            </div>

            <div class="managed-detail-col managed-detail-col--signals">
                <div class="managed-col-header">
                    <span class="managed-col-header-title">Open Signals</span>
                </div>
                <div class="managed-col-body">
                    ${signals.length ? `
                        <ul class="managed-list">
                            ${signals.map(t => `
                                <li class="managed-row-item managed-row-item--signal">
                                    <img class="managed-row-avatar managed-row-avatar--square" src="${Workspace.avatar(t.source)}"/>
                                    <span class="managed-row-label">${t.name}</span>
                                    ${t.asset ? `<span class="managed-row-asset"><span class="material-symbols-outlined">my_location</span>${t.asset}</span>` : ''}
                                    ${t.source ? `<span class="managed-row-source">${t.source}</span>` : ''}
                                    ${new Date(t.created) >= midnight ? '<span class="managed-row-tag">Today</span>' : ''}
                                </li>
                            `).join('')}
                        </ul>
                    ` : `
                        <div class="managed-signals-empty">
                            <div class="managed-signals-radar">
                                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                                    <circle class="radar-ring" cx="50" cy="50" r="20"/>
                                    <circle class="radar-ring" cx="50" cy="50" r="35"/>
                                    <circle class="radar-ring" cx="50" cy="50" r="48"/>
                                </svg>
                            </div>
                            <span class="material-symbols-outlined">radar</span>
                            <p>No signals</p>
                        </div>
                    `}
                </div>
                <div class="managed-col-footer">
                    <button class="managed-enter-btn">
                        <span class="material-symbols-outlined">login</span>
                        Enter Account
                    </button>
                </div>
            </div>
        `;
    }

    async _unassign(email) {
        const domain = this.selected;
        await SiteSpinner.withLoading(() => this.api.managed.unassign(domain, email));
        this.members.set(domain, this.members.get(domain).filter(m => m !== email));
        this._arrange();
        this._selectAccount(domain);
    }

    async _assign(email) {
        const domain = this.selected;
        await SiteSpinner.withLoading(() => this.api.managed.assign(domain, email));
        this.members.get(domain).push(email);
        this._arrange();
        this._selectAccount(domain);
    }

    _enter(domain) {
        this.state.delegate = domain;
        document.dispatchEvent(new CustomEvent('page:reset'));
        document.querySelector('site-overlay').click();
    }

    listen() {
        document.addEventListener("signal:managed", (ev) => {
            this.state.track(ev.signal);
            this._branch(ev.signal.account).forEach(domain => this._settleBadge(domain));
            this._renderHero();
        });

        this.list.addEventListener('click', (e) => {
            const li = e.target.closest('.managed-account-item:not(.pending)');
            if (!li) return;

            if (e.target.closest('.managed-account-toggle')) {
                const domain = li.dataset.domain;
                this.expanded.has(domain) ? this.expanded.delete(domain) : this.expanded.add(domain);
                this._arrange();
                return this._settleBadge(domain);
            }

            this._selectAccount(li.dataset.domain);
        });

        this.detail.addEventListener('click', (e) => {
            const remove = e.target.closest('.managed-row-action');
            if (remove) return this._unassign(remove.dataset.email);

            if (e.target.closest('.managed-footer-btn')) {
                const email = this.detail.querySelector('.managed-footer-input').value.trim();
                if (email) this._assign(email);
                return;
            }

            if (e.target.closest('.managed-enter-btn')) this._enter(this.selected);
        });

        document.getElementById('managed-root-btn').addEventListener('click', () => this._enter(null));

        document.getElementById('managed-invite-btn').addEventListener('click', async () => {
            const input = document.getElementById('managed-invite-input');
            const email = input.value.trim();
            if (!email) return;

            await SiteSpinner.withLoading(async () => {
                await this.api.managed.invite(email);
                await this.load();
            }).finally(() => {
                input.value = '';
            });
        });
    }
}

class ManagedSummary {
    constructor() {
        this.resetAssets();
        this.listen();
    }

    reset() {
        this.resetAssets();

        ['dots', 'coverage'].forEach(key => {
            this._el(key).innerHTML = '<span class="managed-badge-spinner"></span>';
        });
        this._el('assets').textContent = '—';
    }

    resetAssets() {
        this.assets = 0;
        this.dots = 0;
    }

    renderAssets() {
        const coverage = this.assets ? this.dots / this.assets * 100 : 0;
        const label = coverage > 0 && coverage < 10 ? coverage.toFixed(1) : Math.round(coverage);

        this._el('dots').textContent = this.dots.toLocaleString();
        this._el('assets').textContent = this.assets.toLocaleString();
        this._el('coverage').textContent = `${label}%`;
    }

    _el(key) {
        return document.getElementById(`managed-stat-${key}`);
    }

    listen() {
        document.addEventListener("managed:asset", (ev) => {
            if (!ev.asset) return;
            this.assets++;
            if (ev.asset.metadata?.runtime) this.dots++;
        });
    }
}