class TenantScreen {
    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.table = new Table('signal-table');
        this.month = new Date();
        this.listen();

        new ResizeObserver(() => this.renderTrend()).observe(document.getElementById('trend-svg'));
        this.notifications = new Notifications(this.state);
    }

    async reload() {
        const filter = this.month ? `date=${this.month.toISOString().slice(0, 7)}` : "";
        await this.api.signals.list(filter, new CustomEvent("signal:account"));
        await this.api.signals.list(`status=O`, new CustomEvent("signal:account"));
    }

    async reset() {
        await SiteSpinner.withLoading(async() => {
            this.api.reset();
            this.table.clear();
            this.table.watermark(true);
            this.renderTrend();
            this.renderSpotlight();
            this.count();
        }).then(() => {
            this.notifications.refresh();
        });
    }

    count() {
        const rows = Array.from(this.table.body.children);
        const open = rows.filter(r => !r.classList.contains('closed')).length;
        const footnote = `${rows.length.toLocaleString()} signals ${open ? `(${open.toLocaleString()} open)` : ''}`;
        document.getElementById('signal-count').textContent = footnote;
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

    scheduleTrend() {
        if (this._trendFrame) return;
        this._trendFrame = requestAnimationFrame(() => {
            this._trendFrame = null;
            this.renderTrend();
            this.renderSpotlight();
        });
    }

    renderTrend() {
        const now = new Date();
        const year = now.getFullYear(), month = now.getMonth(), today = now.getDate();
        const days = new Date(year, month + 1, 0).getDate();

        const signals = Object.values(this.state.signals?.[this.state.account()] ?? {}).filter(s => {
            const d = new Date(s.created);
            return d.getFullYear() === year && d.getMonth() === month;
        });

        const counts = new Array(days).fill(0);
        signals.forEach(s => counts[new Date(s.created).getDate() - 1]++);

        document.getElementById('trend-month').textContent =
            now.toLocaleString(undefined, { month: 'long', year: 'numeric' });

        // chart
        const svg = document.getElementById('trend-svg');
        const W = svg.clientWidth, H = svg.clientHeight;
        if (!W || !H) return;

        const pad = { t: 10, r: 6, b: 18, l: 6 };
        const max = Math.max(1, ...counts);
        const step = (W - pad.l - pad.r) / (days - 1);
        const x = i => pad.l + i * step;
        const y = v => pad.t + (1 - v / max) * (H - pad.t - pad.b);
        const base = y(0);

        // x-axis spans the whole month; the line stops at today
        const pts = counts.slice(0, today).map((v, i) => [x(i), y(v)]);
        const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
        const [lx, ly] = pts.at(-1);
        const area = `${line} L${lx.toFixed(1)},${base} L${pts[0][0].toFixed(1)},${base} Z`;

        const ticks = [1, 8, 15, 22, days].map(d => {
            const anchor = d === 1 ? 'start' : d === days ? 'end' : 'middle';
            return `<text x="${x(d - 1)}" y="${H - 4}" text-anchor="${anchor}">${d}</text>`;
        }).join('');

        const hits = counts.map((v, i) => {
            const label = new Date(year, month, i + 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return `<rect x="${x(i) - step / 2}" y="0" width="${step}" height="${H}" fill="transparent">
                      <title>${label}: ${v} signal${v === 1 ? '' : 's'}</title>
                    </rect>`;
        }).join('');

        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.innerHTML = `
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style="stop-color:var(--brand);stop-opacity:.18"/>
                <stop offset="100%" style="stop-color:var(--brand);stop-opacity:0"/>
              </linearGradient>
            </defs>
            <line class="trend-baseline" x1="${pad.l}" x2="${W - pad.r}" y1="${base}" y2="${base}"/>
            <text class="trend-max" x="${W - pad.r}" y="${pad.t - 2}" text-anchor="end">peak ${max}</text>
            <path d="${area}" fill="url(#trend-fill)"/>
            <path class="trend-line" d="${line}"/>
            <circle class="trend-today-pulse" cx="${lx}" cy="${ly}" r="3"/>
            <circle class="trend-today" cx="${lx}" cy="${ly}" r="3"/>
            <g class="trend-axis">${ticks}</g>
            ${hits}
        `;
    }

    renderSpotlight() {
        const signal = Object.values(this.state.signals?.[this.state.account()] ?? {}).find(s =>
            Number(s.severity) === 1 && s.source === 'vex' && String(s.status).startsWith('O')
        );

        this._spotlight = signal;
        document.getElementById('spotlight-section').hidden = !signal;
        if (!signal) return;

        const day = value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const set = (id, text) => document.getElementById(id).textContent = text;

        set('spotlight-name', signal.name);
        set('spotlight-value', signal.value?.match(/^.*?[.!?](?=\s|$)/s)?.[0] ?? signal.value);
        set('spotlight-asset', signal.asset);
        set('spotlight-created', day(signal.created));
        set('spotlight-updated', day(signal.updated ?? signal.created));
        document.getElementById('spotlight-img').src = `static/img/source/${signal.source}.png`;
    }

    listen() {
        document.addEventListener('signal:account', (ev) => {
            const upsert = (row, signal) => {
                this.table.add(row, signal);
                this.table.watermark(false);
                this.scheduleTrend();
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
                <td class="id">#${signal.id}</td>
                <td class="strength">${this.strength(signal.metadata?.strength ?? 0)}</td>
                <td class="source">${signal.asset}</td>
                <td class="created">${Workspace.date(signal.created)}</td>
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

        document.getElementById('spotlight').addEventListener('click', async () => {
            if (!this._spotlight) return;
            await this.open(this._spotlight);
        });
    }
}