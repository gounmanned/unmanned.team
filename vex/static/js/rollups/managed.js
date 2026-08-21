class ManagedRollup {
    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.screen = document.getElementById('managed-screen');
        this.list = document.getElementById('managed-accounts');
        this.members = new Map();
        this.listen();
    }

    async reset() {}

    async reload() {
        this._resetBadges();
        await this.load();
        this.api.managed.list(new CustomEvent("signal:managed"));

        const signals = Object.values(this.state.signals)
            .flatMap(a => Object.values(a))
            .filter(t => t.status.startsWith('O'));

        this._renderMetrics(signals);
    }

    async load() {
        const grants = await this.api.managed.grants(this.state.user.email);
        Object.entries(grants).forEach(([domain, members]) => {
            this._add(domain, members);
        });

        const pending = await this.api.managed.grants("pending");
        (pending ?? []).forEach((email) => {
            const domain = email.split("@")[1];
            this._add(domain, [domain], false);
        });

        this._updateEmptyState();
    }

    _renderMetrics = Workspace.debounce((signals) => {
        const row = document.getElementById('managed-signals-row');
        if (!row) return;

        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(0, 0, 0, 0);
        const created = signals.filter(s => new Date(s.created) >= midnight);

        const counts = [1, 2, 3, 4, 5].map(sev => signals.filter(s => Number(s.severity) === sev).length);
        const todayCounts = [1, 2, 3, 4, 5].map(sev => created.filter(s => Number(s.severity) === sev).length);

        row.innerHTML = counts.map((n, i) => {
            const deltaHtml = todayCounts[i] ? `<span class="box-delta">+${todayCounts[i]} today</span>` : '';
            return `
                <div class="managed-signal-box${n === 0 ? ' zero' : ''}" data-severity="${i + 1}">
                    <span class="box-top">
                        <span class="box-count">${n}</span>
                        ${deltaHtml}
                    </span>
                    <span class="box-label">${Workspace.SEVERITY[i + 1]}</span>
                </div>
            `;
        }).join('');
    }, 50);

    _updateEmptyState() {
        const wrap = document.querySelector('.managed-accounts-wrap');
        if (wrap) wrap.classList.toggle('empty', this.members.size === 0);
    }

    _resetBadges() {
        this.members.forEach((_, domain) => {
            this._setBadge(domain, 0);
        });
    }

    _setBadge(domain, count) {
        const badge = document.getElementById(`managed-badge-${domain}`);
        if (!badge) return;

        if (count === 0) {
            badge.innerHTML = '<img src="static/img/status/CH.svg" class="managed-badge-icon">';
        } else {
            badge.textContent = count > 999 ? '999' : count;
        }
    }

    _add(domain, members = [], enabled = true) {
        if (this.members.has(domain)) return;
        this.members.set(domain, members);

        const li = document.createElement('li');
        li.id = `managed-account-${domain}`;
        li.className = `managed-account-item${enabled ? '' : ' pending'}`;
        li.innerHTML = `
            <span class="managed-account-badge" id="managed-badge-${domain}"></span>
            <span class="managed-account-name">${domain}</span>
        `;

        if (enabled) li.addEventListener('click', () => {
            this._selectAccount(domain);
        });

        this.list.appendChild(li);
        this._setBadge(domain, 0);
    }

    async _selectAccount(domain) {
        const right = document.getElementById('managed-right');
        const account = this.members.get(domain);
        const signals = Object.values(this.state.signals[domain] ?? {})
            .filter(t => t.status.startsWith('O'))
            .sort((a, b) => b.created.localeCompare(a.created));

        const midnight = new Date();
        midnight.setHours(0, 0, 0, 0);

        right.innerHTML = `
            <div class="managed-detail">
                <div class="managed-detail-col managed-detail-col--overview" id="managed-overview-col">
                    <div class="managed-col-header">
                        <img class="managed-overview-favicon"
                            src="https://www.google.com/s2/favicons?domain=${domain}&sz=64"
                            onerror="this.src='https://cdn.unmanned.team/img/logo.png'"
                            alt="${domain}">
                        <span class="managed-col-header-title">${domain}</span>
                    </div>
                    <div class="managed-col-body">
                        <div class="managed-overview" id="managed-overview">
                            <p class="managed-overview-value" id="managed-overview-value">
                                Your account overview updates every 24 hours.
                            </p>
                            <span class="managed-overview-created" id="managed-overview-created"></span>
                        </div>
                    </div>
                </div>

                <div class="managed-detail-col managed-detail-col--admins">
                    <div class="managed-col-header">
                        <span class="managed-col-header-title">Administrators</span>
                    </div>
                    <div class="managed-col-body managed-col-body--scroll">
                        <ul class="managed-admin-list">
                            ${account.map(email => `
                                <li class="managed-row-item">
                                    <img class="managed-row-avatar" src="${Workspace.avatar(email)}">
                                    <span class="managed-row-label">${email}</span>
                                    <button class="managed-row-action" data-email="${email}" title="Remove">
                                        <span class="material-symbols-outlined">close</span>
                                    </button>
                                </li>
                            `).join('')}
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
                    <div class="managed-col-body managed-col-body--scroll">
                        <ul class="managed-list">
                            ${SignalSidebar.length ? signals.map(t => `
                                <li class="managed-row-item">
                                    <img class="managed-row-avatar managed-row-avatar--square" src="${Workspace.avatar(t.source)}"/>
                                    <span class="managed-row-label">${t.name}</span>
                                    ${new Date(t.created) >= midnight ? '<span class="managed-row-tag">Today</span>' : ''}
                                </li>
                            `).join('') : `<li class="managed-row-empty">No open signal</li>`}
                        </ul>
                    </div>
                    <div class="managed-col-footer managed-col-footer--action">
                        <button class="managed-enter-btn">
                            <span class="material-symbols-outlined">login</span>
                            Enter Account
                        </button>
                    </div>
                </div>
            </div>
        `;

        right.querySelector('.managed-admin-list').addEventListener('click', async (e) => {
            const btn = e.target.closest('.managed-row-action');
            if (!btn) return;

            const email = btn.dataset.email;
            await SiteSpinner.withLoading(() => this.api.managed.unassign(domain, email));
            this.members.set(domain, account.filter(m => m !== email));
            this._selectAccount(domain);
        });

        right.querySelector('.managed-footer-btn').addEventListener('click', async () => {
            const input = right.querySelector('.managed-footer-input');
            const email = input.value.trim();
            if (!email) return;

            await SiteSpinner.withLoading(() => this.api.managed.assign(domain, email));
            account.push(email);
            this._selectAccount(domain);
        });

        right.querySelector('.managed-enter-btn').addEventListener('click', () => {
            this.state.delegate = domain;
            this.state.api.reset();
            document.querySelector('.delegation-notice').firstChild.textContent = domain;
            document.querySelector('.delegation-notice').classList.add('visible');
            document.dispatchEvent(new CustomEvent('page:reset'));
            document.querySelector('site-overlay')?.click();
        });

        this._loadOverview(domain);
    }

    async _loadOverview(domain) {
        const column = document.getElementById('managed-overview-col');
        const created = document.getElementById('managed-overview-created');
        const value = document.getElementById('managed-overview-value');

        column.classList.add('loading');
        const account = await this.api.managed.overview(domain);
        column.classList.remove('loading');
        if (!document.getElementById('managed-overview-col')) return;

        if (account) {
            value.textContent = account.metadata?.overview;
            const d = new Date(account.created);
            created.textContent = `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
        }
    }

    listen() {
        document.addEventListener("signal:managed", (ev) => {
            this.state.track(ev.signal);

            const signals = Object.values(this.state.signals[ev.signal.account] ?? {});
            const open = signals.filter(t => t.status.startsWith('O'));

            const badge = document.getElementById(`managed-badge-${ev.signal.account}`);
            this._setBadge(ev.signal.account, open.length);

            const sum = Object.values(this.state.signals).flatMap(a => Object.values(a)).filter(s => s.status.startsWith('O'));
            this._renderMetrics(sum);
        });

        document.getElementById('managed-invite-btn').addEventListener('click', async () => {
            const input = document.getElementById('managed-invite-input');
            const email = input.value.trim();
            if (!email) return;

            await SiteSpinner.withLoading(async() => {
                await this.api.managed.invite(email);
                await this.load();
            }).finally(() => {
                input.value = '';
            });
        });
    }
}