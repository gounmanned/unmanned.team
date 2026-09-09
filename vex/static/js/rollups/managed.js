class ManagedRollup {
    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.screen = document.getElementById('managed-screen');
        this.list = document.getElementById('managed-accounts');
        this.members = new Map();
        this.listen();
    }

    async reset() {
        this.members.forEach((_, domain) => {
            this._setBadgeLoading(domain);
            this._setUnread(domain, false);
        });
    }

    async reload() {
        await this.load();

        (async () => {
            await this.api.managed.list(new CustomEvent("signal:managed"));
            this.members.forEach((_, domain) => this._settleBadge(domain));
        })();
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

    _midnight() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    _updateEmptyState() {
        const wrap = document.querySelector('.managed-accounts-wrap');
        if (wrap) wrap.classList.toggle('empty', this.members.size === 0);
    }

    _setBadge(domain, count) {
        const badge = document.getElementById(`managed-badge-content-${domain}`);
        if (!badge) return;

        if (count === 0) {
            badge.innerHTML = '<img src="static/img/status/CH.svg" class="managed-badge-icon">';
        } else {
            badge.textContent = count > 999 ? '999' : count;
        }
    }

    _setBadgeLoading(domain) {
        const badge = document.getElementById(`managed-badge-content-${domain}`);
        if (!badge) return;

        badge.innerHTML = '<span class="managed-badge-spinner"></span>';
    }

    _settleBadge(domain) {
        const open = Object.values(this.state.signals[domain] ?? {})
            .filter(t => t.status.startsWith('O'));

        this._setBadge(domain, open.length);
        this._setUnread(domain, open.some(t => !t.read));
    }

    _setUnread(domain, unread) {
        const badge = document.getElementById(`managed-badge-${domain}`);
        if (badge) badge.classList.toggle('has-unread', unread);
    }

    _add(domain, members = [], enabled = true) {
        if (this.members.has(domain)) return;
        this.members.set(domain, members);

        const li = document.createElement('li');
        li.id = `managed-account-${domain}`;
        li.className = `managed-account-item${enabled ? '' : ' pending'}`;
        li.innerHTML = `
            <span class="managed-account-badge" id="managed-badge-${domain}">
                <span class="managed-badge-content" id="managed-badge-content-${domain}"></span>
            </span>
            <span class="managed-account-name">${domain}</span>
        `;

        if (enabled) li.addEventListener('click', () => {
            this._selectAccount(domain);
        });

        this.list.appendChild(li);
        this._setBadgeLoading(domain);
    }

    async _selectAccount(domain) {
        const right = document.getElementById('managed-right');
        const account = this.members.get(domain);
        const signals = Object.values(this.state.signals[domain] ?? {})
            .filter(t => t.status.startsWith('O'))
            .sort((a, b) => b.created.localeCompare(a.created));

        const midnight = this._midnight();

        right.innerHTML = `
            <div class="managed-detail">
                <div class="managed-detail-col managed-detail-col--admins">
                    <div class="managed-col-header">
                        <img class="managed-overview-favicon"
                            src="https://www.google.com/s2/favicons?domain=${domain}&sz=64"
                            onerror="this.src='https://cdn.unmanned.team/img/logo.png'"
                            alt="${domain}">
                        <span class="managed-col-header-title">${domain}</span>
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
                    <div class="managed-col-body managed-col-body--scroll">
                        <ul class="managed-list">
                            ${signals.length ? signals.map(t => `
                                <li class="managed-row-item managed-row-item--signal">
                                    <img class="managed-row-avatar managed-row-avatar--square" src="${Workspace.avatar(t.source)}"/>
                                    <span class="managed-row-sev managed-row-sev--${t.severity}" title="Severity ${t.severity}"></span>
                                    <span class="managed-row-label">${t.name}</span>
                                    ${t.asset ? `<span class="managed-row-asset"><span class="material-symbols-outlined">my_location</span>${t.asset}</span>` : ''}
                                    ${t.source ? `<span class="managed-row-source">${t.source}</span>` : ''}
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
            document.dispatchEvent(new CustomEvent('page:reset'));
            document.querySelector('site-overlay').click();
        });
    }

    listen() {
        document.addEventListener("signal:managed", (ev) => {
            this.state.track(ev.signal);
            this._settleBadge(ev.signal.account);
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