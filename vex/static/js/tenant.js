class TenantScreen {
    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.table = new Table('signal-table');
        this.month = new Date();
        this.listen();

        this.notifications = new Notifications(this.api.notification);
    }

    async reload() {
        const filter = this.month ? `date=${this.month.toISOString().slice(0, 7)}` : "";
        await this.api.signals.list(filter, new CustomEvent("signal:account"));
        await this.api.signals.list(`status=O`, new CustomEvent("signal:account"));

        this.notifications.show();
        this.panel();
    }

    async reset() {
        await SiteSpinner.withLoading(async() => {
            this.api.reset();
            this.table.clear();
            this.table.watermark(true);
            this.count();
            this.panel();
        });
    }

    async panel() {
        const spin = async (el, fn) => {
            el.classList.add('loading');
            try { return await fn(); }
            finally { el.classList.remove('loading'); }
        };

        const setAlarm = (card, reason) => {
            card.dataset.alarm = reason ? 'true' : 'false';
            const tab = card.querySelector('.alarm-tab');
            if (tab) tab.textContent = reason ?? '';
        };

        const inventory = spin(document.getElementById('open-inventory-rollup'), async () => {
            const card = document.getElementById('open-inventory-rollup');
            const assets = await this.api.inventory.list();
            const users = assets.filter(a => a.metadata?.group === 'identity');
            const domains = assets.filter(a => a.metadata?.group === 'domain');

            document.getElementById('monitor-users').textContent = users.length ?? 0;
            document.getElementById('monitor-domains').textContent = domains.length ?? 0;
            document.getElementById('monitor-count').textContent = assets?.length ?? 0;

            const suspended = users.filter(a => a.status.startsWith("X")).length;
            setAlarm(card, suspended ? `Restore ${suspended} suspended assets`: null);
        });

        const monitors = spin(document.getElementById('open-monitor-rollup'), async () => {
            const card = document.getElementById('open-monitor-rollup');
            const m = await this.api.monitors.list();
            const identity = m.find(x => /google|microsoft/i.test(x));
            setAlarm(card, m.length === 0 ? 'Set up your monitors' : null);

            document.getElementById('monitors-count').textContent = m?.length ?? 0;
            document.getElementById('monitors-identity-name').textContent = identity ? (/google/i.test(identity) ? 'Google' : 'Microsoft') : 'n/a';
        });

        const scenario = spin(document.getElementById('open-breach-rollup'), async () => {
            const card = document.querySelector('.breach-card');
            this.breaches = await this.api.breach.list();
            const breach = this.breaches?.find(b => new Date(b.created).toDateString() === new Date().toDateString());

            card.dataset.state = breach ? 'active' : 'empty';
            setAlarm(card, breach ? "Fix the choke point" : null);
            if (!breach) return;

            document.getElementById('breach-name').textContent = breach.name ?? '';
            document.getElementById('breach-asset').textContent = this.state.signals[this.state.account()][breach.id].asset ?? '—';
        });

        const threats = spin(document.getElementById('open-threat-sidebar'), async () => {
            const card = document.querySelector('.threat-card');
            const page = await this.api.threat.list();
            const hits = Object.values(this.state.signals[this.state.account()] || {})
                .filter(s => s.source === 'threat' && s.status?.startsWith('O'));
            setAlarm(card, hits.length ? "Assess potential targeted attacks" : null);

            document.getElementById('threat-count').textContent = hits.length;
            document.getElementById('monitors-threat-total').textContent = page.threats.length.toLocaleString(); 
        });

        await Promise.allSettled([inventory, monitors, scenario, threats]);
    }

    count() {
        const el = document.getElementById('signal-count');
        const n = this.table.body.children.length;
        if (el) el.textContent = `${n.toLocaleString()} signal${n === 1 ? '' : 's'}`;
    }

    strength(value) {
        const lit = Math.min(value, 10);
        const maxed = value >= 10;

        const bars = Array.from({ length: 10 }, (_, i) =>
            `<span class="strength-bar${i < lit ? ' lit' : ''}"></span>`
        ).join('');

        return `
            <div class="strength-meter${maxed ? ' maxed' : ''}">
            <span class="strength-bars">${bars}</span>
            <span class="strength-value">${value}${maxed ? '+' : ''}</span>
            </div>
        `;
    }

    listen() {
        document.addEventListener('signal:account', (ev) => {
            const upsert = (row, signal) => {
                this.table.add(row, signal);
                this.table.watermark(false);
            };

            this.state.track(ev.signal);
            const signal = ev.signal;

            const row = document.createElement('tr');
            row.id = signal.id;

            const existing = this.table.body.querySelector(`tr#${CSS.escape(row.id)}`);
            if (existing) {
                upsert(existing, signal);
                return;
            }

            row.innerHTML = `
                <td><img src="${Workspace.avatar(signal.source)}"/></td>
                <td class="severity"></td>
                <td class="name" title="${signal.name}">${signal.name.substring(0, 99)}</td>
                <td>#${signal.id}</td>
                <td class="strength">${this.strength(signal.metadata?.strength ?? 0)}</td>
                <td class="source">${signal.asset}</td>
                <td>${signal.created}</td>
                <td class="autoclose"></td>
            `;

            row.addEventListener('click', async (e) => {
                e.stopPropagation();

                await SiteSpinner.withLoading(async () => {
                    Workspace.sidebars.signal.reset();
                    Workspace.sidebars.signal.inject(signal, await this.api.signals.get(signal.id));
                    document.getElementById('signal-sidebar').show();
                });
            });

            upsert(row, signal);
            this.count();
        });

        document.getElementById('toggle').addEventListener('click', async () => {
            const active = document.getElementById('toggle').classList.toggle('active');
            document.getElementById('toggle-label').textContent = active ? 'This month' : 'This year';

            this.state.signals = {};
            this.month = active ? new Date() : null;

            await SiteSpinner.withLoading(async() => {
                await this.reset();
                await this.reload();
            });
        });

        document.getElementById('delegation-notice').addEventListener('click', () => {
            this.state.delegate = null;
            this.state.api.reset();

            document.dispatchEvent(new CustomEvent('page:reset'));
            document.querySelector('.delegation-notice').classList.remove('visible');
        });
    }
}