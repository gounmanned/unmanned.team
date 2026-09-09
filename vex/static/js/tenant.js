class TenantScreen {
    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.table = new Table('signal-table');
        this.month = new Date();
        this.listen();

        // add-ons
        this.notifications = new Notifications(this.state);
        this.banner = new Banner(this.state);
    }

    async reload() {
        const filter = this.month ? `date=${this.month.toISOString().slice(0, 7)}` : "";
        await this.api.signals.list(filter, new CustomEvent("signal:account"));
        await this.api.signals.list(`status=O`, new CustomEvent("signal:account"));

        // refresh add-ons
        this.notifications.refresh();
        this.banner.refresh();        
    }

    async reset() {
        await SiteSpinner.withLoading(async() => {
            this.api.reset();
            this.table.clear();
            this.table.watermark(true);
            this.generateChokepoint();
            this.count();
        });
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

    async open(signal) {
        await SiteSpinner.withLoading(async () => {
            Workspace.sidebars.signal.reset();
            Workspace.sidebars.signal.inject(signal, await this.api.signals.get(signal.id));
            document.getElementById('signal-sidebar').show();
        });
    }

    generateChokepoint() {
        const callout = document.getElementById('chokepoint-callout');
        if (!callout) return;

        const candidates = Object.values(this.state.signals[this.state.account()] ?? {})
            .filter(s => s.status?.startsWith('O') && s.metadata?.chokepoint);

        if (!candidates.length) {
            callout.style.display = 'none';
            this.chokepoint = null;
            return;
        }

        this.chokepoint = candidates.sort((a, b) =>
            new Date(b.metadata.chokepoint) - new Date(a.metadata.chokepoint)
        )[0];

        document.getElementById('chokepoint-name').textContent = this.chokepoint.name;
        document.getElementById('chokepoint-created').textContent = Workspace.date(this.chokepoint.created);
        document.getElementById('chokepoint-updated').textContent = Workspace.date(this.chokepoint.updated);

        const logo = document.getElementById('chokepoint-logo');
        logo.src = `static/img/source/${this.chokepoint.source}.png`;
        logo.alt = this.chokepoint.source;
        callout.style.display = 'flex';
    }
    
    listen() {
        document.addEventListener('signal:account', (ev) => {
            const upsert = (row, signal) => {
                this.table.add(row, signal);
                this.table.watermark(false);
                this.generateChokepoint();
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
                    await this.open(signal);
                });
            });

            upsert(row, signal);
            this.count();
        });

        document.getElementById('toggle').addEventListener('click', async () => {
            const active = document.getElementById('toggle').classList.toggle('active');
            document.getElementById('toggle-label').textContent = active ? 'This month' : 'This year';

            this.state.reset();
            this.month = active ? new Date() : null;

            await SiteSpinner.withLoading(async() => {
                await this.reset();
                await this.reload();
            });
        });

        document.getElementById('chokepoint-callout').addEventListener('click', () => {
            if (this.chokepoint) this.open(this.chokepoint);
        });
    }
}