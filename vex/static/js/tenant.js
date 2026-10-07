class TenantScreen {
    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.month = new Date();
        this.query = '';
        this.results = [];

        this.table = new Table('signal-table', {
            open: signal => this.open(signal),
            move: (signal, status) => this.move(signal, status),
        });

        this.listen();

        new ResizeObserver(() => this.renderTrend()).observe(document.getElementById('trend-svg'));
        this.notifications = new Notifications(this.state);
        this.attack = new AttackMode(this.state, () => this.reload());
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
            this.clearSearch();
            this.renderSpotlight();
            this.renderTrend();
            this.attack.reset();
        }).then(() => {
            this.notifications.refresh();
        });
    }

    count() {
        const el = document.getElementById('signal-count');
        el.hidden = !!this.query;
        if (this.query) return;

        const all = [...this.table.signals.values()];
        const total = all.length;
        const open = all.filter(s => String(s.status).startsWith('O')).length;
        const closed = all.filter(s => String(s.status).startsWith('C')).length;
        const auto = all.filter(s => s.status === 'CV').length;
        const pct = closed ? Math.round((auto / closed) * 100) : 0;

        el.innerHTML = `${total.toLocaleString()} signals · ${open.toLocaleString()} open · ${pct}% autoclosed`;
    }

    async open(signal) {
        await SiteSpinner.withLoading(async () => {
            Workspace.sidebars.signal.reset();
            Workspace.sidebars.signal.inject(signal, await this.api.signals.get(signal.id));
            document.getElementById('signal-sidebar').show();
        });
    }

    async move(signal, status) {
        this.state.track(await this.api.signals.patch(signal.id, { status }));
        document.dispatchEvent(new CustomEvent('page:reload'));
    }

    // ── search ─────────────────────────────────────────────────────

    async search(q) {
        this.query = q.trim();
        if (!this.query) return this.clearSearch();

        const query = this.query;
        document.getElementById('signal-table-wrap').classList.add('searching');

        let logs = [];
        await SiteSpinner.withLoading(async () => {
            try {
                logs = await this.api.audit.search(query) ?? [];
            } catch (err) {
                console.error('audit query failed', err);
            }
        });

        if (query !== this.query) return;
        this.results = logs;
        this.renderResults();
    }

    clearSearch() {
        this.query = '';
        this.results = [];
        document.getElementById('signal-search-input').value = '';
        document.getElementById('signal-search-results').innerHTML = '';
        document.getElementById('signal-table-wrap').classList.remove('searching');
        this.count();
    }

    renderResults() {
        const pattern = new RegExp(`(${this.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const highlight = text => String(text).split(pattern)
            .map((part, i) => i % 2 ? `<mark>${Workspace.esc(part)}</mark>` : Workspace.esc(part))
            .join('');

        document.getElementById('signal-search-results').innerHTML = this.results.length
            ? this.results.map(log => `<li>${highlight(log.message ?? log)}</li>`).join('')
            : `<li class="search-empty">No logs match "${Workspace.esc(this.query)}"</li>`;

        document.getElementById('signal-table-wrap').scrollTop = 0;
    }

    // ── overview ───────────────────────────────────────────────────

    scheduleTrend() {
        if (this._trendFrame) return;
        this._trendFrame = requestAnimationFrame(() => {
            this._trendFrame = null;
            this.renderSpotlight();
            this.renderTrend();
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

        const svg = document.getElementById('trend-svg');
        const W = svg.clientWidth, H = svg.clientHeight;
        if (!W || !H) return;

        const pad = { t: 10, r: 6, b: 18, l: 6 };
        const max = Math.max(1, ...counts);
        const step = (W - pad.l - pad.r) / (days - 1);
        const x = i => pad.l + i * step;
        const y = v => pad.t + (1 - v / max) * (H - pad.t - pad.b);
        const base = y(0);
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
        const signal = Object.values(this.state.signals?.[this.state.account()] ?? {})
            .filter(s => Number(s.kind) == 1 && String(s.status).startsWith('O'))
            .sort((a, b) => new Date(b.created) - new Date(a.created))[0];

        this._spotlight = signal;
        document.getElementById('overview').classList.toggle('critical', !!signal);
        if (!signal) return;

        const day = value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const set = (id, text) => document.getElementById(id).textContent = text;

        set('spotlight-name', signal.name);
        set('spotlight-created', day(signal.created));
        set('spotlight-updated', day(signal.updated ?? signal.created));
        document.getElementById('spotlight-img').src = `static/img/source/${signal.source}.png`;
    }

    // ── events ─────────────────────────────────────────────────────

    listen() {
        document.addEventListener('signal:account', ({ signal }) => {
            this.state.track(signal);
            this.table.add(signal);
            this.scheduleTrend();
            this.attack.onSignal(signal);
            if (!this.query) this.count();
        });

        document.getElementById('view-switch').addEventListener('click', (e) => {
            e.currentTarget.querySelector('span').textContent = this.table.toggleView() ? 'table_rows' : 'view_kanban';
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

        document.getElementById('signal-search').addEventListener('submit', (e) => {
            e.preventDefault();
            this.search(document.getElementById('signal-search-input').value);
        });

        document.getElementById('signal-search-input').addEventListener('input', () => {
            if (!document.getElementById('signal-search-input').value.trim() && this.query) this.clearSearch();
        });

        document.getElementById('signal-search-input').addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.clearSearch();
        });

        document.getElementById('signal-search-results').addEventListener('click', (e) => {
            if (getSelection().toString()) return;
            e.target.closest('li:not(.search-empty)')?.classList.toggle('expanded');
        });
    }
}