class TenantScreen {
    constructor(state) {
        this.state = state;
        this.api = new Api(state);
        this.table = new Table('signal-table');
        this.month = new Date();
        this.listen();
    }

    async reload() {
        const filter = this.month ? `date=${this.month.toISOString().slice(0, 7)}` : "";
        await this.api.signals.list(filter, new CustomEvent("signal:account"));
        await this.api.signals.list(`status=O`, new CustomEvent("signal:account"));
    }

    async reset() {
        this.api.reset();
        this.table.clear();
        this.table.watermark(true);
        this.panel();
        document.querySelectorAll('[data-filter] .filter-count').forEach(i => i.textContent = 0);
    }

    async panel() {
        const withLoading = async (el, fn) => {
            el.classList.add('loading');
            try {
                return await fn();
            } finally {
                el.classList.remove('loading');
            }
        };

        const inventory = withLoading(document.getElementById('monitor-count'), async () => {
            const assets = await this.api.inventory.list();
            document.getElementById('monitor-users').textContent = assets.filter(a => a.metadata?.group === 'identity').length ?? 0;
            document.getElementById('monitor-domains').textContent = assets.filter(a => a.metadata?.group === 'domain').length ?? 0;
            document.getElementById('monitor-count').textContent = assets?.length ?? 0;
        });

        const monitors = withLoading(document.getElementById('monitors-count'), async () => {
            const m = await this.api.monitors.list();
            const google = m.some(m => /google/i.test(m));
            const microsoft = m.some(m => /microsoft/i.test(m));

            document.getElementById('monitors-count').textContent = m?.length ?? 0;
            document.getElementById('monitors-warning').style.display = google || microsoft ? 'none' : 'flex';
            document.getElementById('monitors-connected').style.display = google || microsoft ? 'flex' : 'none';
            document.getElementById('monitors-connected-text').textContent = google ? 'Google Workspace connected' : 'Microsoft 365 connected';
        });

        const scenario = () => withLoading(document.querySelector('.breach-today-card'), async () => {
            const card = document.querySelector('.breach-today-card');
            this.breaches = await this.api.breach.list();
            const breach = this.breaches?.find(b => new Date(b.created).toDateString() === new Date().toDateString());

            card.dataset.state = breach ? 'active' : 'empty';
            if (!breach) return;

            document.getElementById('breach-today-name').textContent = breach.name ?? '';
            document.getElementById('breach-today-asset').textContent = this.state.signals[this.state.account()][breach.id].asset ?? '—';
        });

        await Promise.all([inventory, monitors]).finally(scenario);
    }

    refresh(status){
        const count = document.querySelector(`[data-filter="${status}"] .filter-count`);
        if (!count) return;

        count.classList.add('loading');

        setTimeout(() => {
            const signals = this.state.signals[this.state.account()];
            count.textContent = Object.values(signals).filter(t => t.status == status).length;
            count.classList.remove('loading');
        }, 1000);
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
                if (signal.status !== row.dataset.status) {
                    this.refresh(signal.status);
                    this.refresh(row.dataset.status);
                }

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
            `;

            row.addEventListener('click', async (e) => {
                e.stopPropagation();

                await SiteSpinner.withLoading(async () => {
                    const updates = await this.api.signals.get(signal.id);
                    this.sidebar ??= new SignalSidebar(this.state);
                    this.sidebar.reset();
                    this.sidebar.display(this.state.signals[signal.account][signal.id], updates);
                    document.getElementById('signal-sidebar').show();
                });
            });

            upsert(row, signal);
        });

        document.querySelectorAll('.filter-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const current = card.classList.contains('active');
                document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));
                if (!current) card.classList.add('active');

                const filter = document.querySelector('.filter-card.active')?.dataset.filter;

                document.querySelectorAll('#signal-table tbody tr').forEach(row => {
                    const status = row.dataset.status;
                    row.style.display = !filter || status === filter ? '' : 'none';
                });
            });
        });

        document.getElementById('signal-create').addEventListener('click', () => {
            this.sidebar ??= new SignalSidebar(this.state);
            this.sidebar.reset();
            this.sidebar.create();
            document.getElementById('signal-sidebar').show();
        });

        document.getElementById('toggle').addEventListener('click', async () => {
            const active = document.getElementById('toggle').classList.toggle('active');
            document.getElementById('toggle-label').textContent = active ? 'This month' : 'All signals';

            this.state.signals = {};
            this.month = active ? new Date() : null;

            await SiteSpinner.withLoading(async() => {
                await this.reset();
                await this.reload();
            });
        });

        document.getElementById('delegation-notice').addEventListener('click', () => {
            this.state.delegate = null;
            document.dispatchEvent(new CustomEvent('page:reset'));
            document.querySelector('site-overlay').click();
            document.querySelector('.delegation-notice').classList.remove('visible');
        });
    }
}