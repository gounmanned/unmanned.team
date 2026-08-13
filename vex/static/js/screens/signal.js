class TenantScreen {
    constructor(state) {
        this.state = state;
        this.api = new SignalApi();
        this.sidebar = new SignalSidebar('signal-sidebar');
        this.table = new Table('signal-table');
        this.month = new Date();
        this.listen();
    }

    async reload() {
        const filter = this.month ? `date=${this.month.toISOString().slice(0, 7)}` : "";
        await this.api.list(filter, new CustomEvent("signal:account"));
        await this.api.list(`status=O`, new CustomEvent("signal:account"));
    }

    async reset() {
        this.api.set("account", this.state.account());
        this.table.clear();
        this.table.watermark(true);
        document.querySelectorAll('[data-filter] .filter-count').forEach(i => i.textContent = 0);
    }

    updateFilter(status){
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
                    this.updateFilter(signal.status);
                    this.updateFilter(row.dataset.status);
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
                <td>${signal.name.substring(0, 99)}</td>
                <td>#${signal.id}</td>
                <td class="strength">${this.strength(signal.metadata?.strength ?? 0)}</td>
                <td>${signal.asset}</td>
                <td>${signal.created}</td>
            `;

            row.addEventListener('click', async (e) => {
                e.stopPropagation();

                await SiteSpinner.withLoading(async() => {
                    const updates = await this.api.get(signal.id);
                    this.sidebar.set(signal.id);
                    this.sidebar.open(this.state.signals[signal.account][signal.id], updates);
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
            document.getElementById("signal-modal").show();
        });

        document.getElementById('signal-create-2').addEventListener('click', async () => {
            const blob = document.getElementById("signal-value");
            const name = document.getElementById("new-signal-name");
            const asset = document.getElementById("new-signal-asset");
            const severity = document.getElementById("new-signal-severity");

            const signal = {
                name: name.value,
                value: blob.value,
                source: this.state.user.email,
                asset: asset.value.toLowerCase().trim(),
                severity: parseInt(severity.options[severity.selectedIndex].dataset.severity),
            };

            if (Object.values(signal).some(v => !v || v === "")) {
                alert("All fields are required!");
                return;
            }

            await SiteSpinner.withLoading(async() => {
                await this.api.create(signal);
            }).finally(() => {
                blob.value = "";
                name.value = "";
                asset.value = "";
            });

            document.dispatchEvent(new CustomEvent('page:reload'));
            document.querySelector('site-overlay').click();
        });

        document.getElementById('signal-delete').addEventListener('click', async (e) => {
            e.preventDefault();

            await SiteSpinner.withLoading(async() => {
                const signal = this.sidebar.signal;

                delete this.state.signals[signal.account][signal.id];
                await this.api.delete(signal.id);

                document.querySelectorAll('#signal-status option').forEach(o => this.updateFilter(o.id));
                document.dispatchEvent(new CustomEvent('page:reset'));
                document.querySelector('site-overlay').click();
            });
        });

        document.getElementById('signal-update').addEventListener('click', async (e) => {
            e.preventDefault();

            await SiteSpinner.withLoading(async() => {
                const signal = this.sidebar.signal;
                const body = document.getElementById("response").value;
                const update = await this.api.update(signal.id, body);
                this.sidebar.add(update);
            });
        });

        document.getElementById('signal-status').addEventListener('change', async (ev) => {
            await SiteSpinner.withLoading(async() => {
                const status = ev.target.selectedOptions[0].id;
                await this.api.patch(this.sidebar.key, {status: status});

                document.querySelectorAll('#signal-status option').forEach(o => this.updateFilter(o.id));
                document.dispatchEvent(new CustomEvent('page:reload'));
                document.querySelector('site-overlay').click();
            });
        });

        document.getElementById('signal-severity').addEventListener('change', async (ev) => {
            const severity = ev.target.selectedOptions[0];
            const signal = await this.api.patch(this.sidebar.key, {severity: parseInt(severity.value)});
            
            this.state.signals[signal.account][signal.id] = signal;           
            document.dispatchEvent(new CustomEvent('page:reload'));
            document.querySelector('site-overlay').click();
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