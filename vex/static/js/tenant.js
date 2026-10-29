class TenantScreen {
    static TAIL_INTERVAL = 30000;

    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.month = new Date();
        this.query = '';
        this.tailTimer = null;

        this.input = document.getElementById('signal-search-input');
        this.tailSwitch = document.getElementById('tail-switch');

        this.table = new Table('signal-table', {
            open: signal => this.open(signal),
            move: (signal, status) => this.move(signal, status),
        });

        this.listen();
        new ResizeObserver(() => this.renderTrend()).observe(document.getElementById('trend-svg'));
    }

    async reload() {
        const filter = this.month ? `date=${this.month.toISOString().slice(0, 7)}` : '';
        await this.api.signals.list(filter, new CustomEvent('signal:account'));
        await this.api.signals.list('status=O', new CustomEvent('signal:account'));
    }

    async reset() {
        await SiteSpinner.withLoading(async () => {
            this.api.reset();
            this.table.clear();
            this.stopTail();
            this.clearSearch();
            this.renderSpotlight();
            this.renderTrend();
        });
    }

    signals() {
        return Object.values(this.state.signals?.[this.state.account()] ?? {});
    }

    count() {
        const el = document.getElementById('signal-count');
        el.hidden = !!this.query;
        if (this.query) return;

        const all = this.signals();
        const open = all.filter(s => s.status.startsWith('O')).length;
        const closed = all.filter(s => s.status.startsWith('C'));
        const auto = closed.filter(s => s.status === 'CV').length;
        const pct = closed.length ? Math.round((auto / closed.length) * 100) : 0;

        const responded = closed.filter(s => s.metadata?.threat);
        const mttr = responded.length
            ? Math.round(responded.reduce((sum, s) => sum + (new Date(s.updated) - new Date(s.created)), 0) / responded.length / 60000)
            : 0;

        el.textContent = `${all.length.toLocaleString()} signals · ${open.toLocaleString()} open · ${mttr.toLocaleString()}m MTTR · ${pct}% autoclosed`;
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

        this.stopTail();
        const query = this.query;

        let logs = [];
        await SiteSpinner.withLoading(async () => {
            logs = await this.api.audit.search(query) ?? [];
        });

        if (query === this.query) this.table.showLogs(logs, query);
    }

    clearSearch() {
        this.query = '';
        this.input.value = '';
        this.table.hideLogs();
        this.count();
    }

    // ── tail ───────────────────────────────────────────────────────

    toggleTail() {
        this.tailTimer ? this.stopTail() : this.startTail();
    }

    startTail() {
        this.clearSearch();
        this.tailFrom = new Date(Date.now() - TenantScreen.TAIL_INTERVAL);
        this.tailSwitch.setAttribute('aria-pressed', 'true');
        this.table.placeholder('Tailing logs · please wait');

        this.tailTimer = setInterval(() => this.pollTail(), TenantScreen.TAIL_INTERVAL);
        this.pollTail();
    }

    stopTail() {
        clearInterval(this.tailTimer);
        this.tailTimer = null;
        this.tailSwitch.setAttribute('aria-pressed', 'false');
        this.table.hideLogs();
    }

    async pollTail() {
        const start = this.tailFrom;
        const end = this.tailFrom = new Date();
        const logs = await this.api.audit.get(start.toISOString(), end.toISOString()) ?? [];
        if (this.tailTimer) this.table.prependLogs(logs);
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

        const counts = new Array(days).fill(0);
        this.signals().forEach(s => {
            const d = new Date(s.created);
            if (d.getFullYear() === year && d.getMonth() === month) counts[d.getDate() - 1]++;
        });

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

        // ── radar centered on today ──
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const spin = still ? '' :
            `<animateTransform attributeName="transform" type="rotate"
            from="0 ${lx} ${ly}" to="-360 ${lx} ${ly}" dur="12s" repeatCount="indefinite"/>`;

        const R = Math.min(480, Math.max(220, W * 0.3));
        const rings = [0.25, 0.5, 0.75, 1]
            .map(f => `<circle class="trend-ring" cx="${lx}" cy="${ly}" r="${R * f}"/>`).join('');
        const waves = [0, 1, 2]
            .map(i => `<circle class="trend-wave" cx="${lx}" cy="${ly}" r="${R}" style="animation-delay:${-i * 1.4}s"/>`).join('');

        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.innerHTML = `
            <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style="stop-color:var(--brand);stop-opacity:.18"/>
                <stop offset="100%" style="stop-color:var(--brand);stop-opacity:0"/>
            </linearGradient>
            <radialGradient id="trend-radar-fade">
                <stop offset="0%" stop-color="#fff"/>
                <stop offset="35%" stop-color="#fff" stop-opacity=".8"/>
                <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
            </radialGradient>
            <mask id="trend-radar-mask" maskUnits="userSpaceOnUse"
                    x="${lx - R}" y="${ly - R}" width="${R * 2}" height="${R * 2}">
                <circle cx="${lx}" cy="${ly}" r="${R}" fill="url(#trend-radar-fade)"/>
            </mask>
            </defs>

            <g class="trend-radar" mask="url(#trend-radar-mask)">
            ${rings}
            ${waves}
            </g>

            <line class="trend-baseline" x1="${pad.l}" x2="${lx}" y1="${base}" y2="${base}"/>
            <line class="trend-future" x1="${lx}" x2="${W - pad.r}" y1="${base}" y2="${base}"/>
            <text class="trend-max" x="${W - pad.r}" y="${pad.t - 2}" text-anchor="end">peak ${max}</text>
            <path d="${area}" fill="url(#trend-fill)"/>
            <path class="trend-line" d="${line}"/>
            <line class="trend-now" x1="${lx}" x2="${lx}" y1="${ly}" y2="${base}"/>

            <g class="trend-radar">
            <circle class="trend-halo" cx="${lx}" cy="${ly}" r="16"/>
            <g>
                <circle class="trend-reticle" cx="${lx}" cy="${ly}" r="9"/>
                ${spin}
            </g>
            <circle class="trend-today-pulse" cx="${lx}" cy="${ly}" r="3.5"/>
            <circle class="trend-today" cx="${lx}" cy="${ly}" r="3.5"/>
            </g>
            <g class="trend-axis">${ticks}</g>
            ${hits}
        `;
    }

    renderSpotlight() {
        const signal = this.signals()
            .filter(s => s.status.startsWith('O') && s.metadata?.threat)
            .sort((a, b) => new Date(b.created) - new Date(a.created))[0];

        this._spotlight = signal;
        document.getElementById('overview').classList.toggle('critical', !!signal);
        if (!signal) return;

        document.getElementById('spotlight-name').textContent = signal.name;
        document.getElementById('spotlight-created').textContent = Workspace.date(signal.created);
        document.getElementById('spotlight-updated').textContent = Workspace.date(signal.updated ?? signal.created);
        document.getElementById('spotlight-img').src = `static/img/source/${signal.source}.png`;
    }

    // ── events ─────────────────────────────────────────────────────

    listen() {
        document.addEventListener('signal:account', ({ signal }) => {
            this.state.track(signal);
            this.table.add(signal);
            this.scheduleTrend();
            this.count();
        });

        this.tailSwitch.addEventListener('click', () => this.toggleTail());

        document.getElementById('view-switch').addEventListener('click', (e) => {
            this.stopTail();
            this.clearSearch();
            e.currentTarget.querySelector('span').textContent = this.table.toggleBoard() ? 'table_rows' : 'view_kanban';
        });

        document.getElementById('toggle').addEventListener('click', async (e) => {
            const active = e.currentTarget.classList.toggle('active');
            document.getElementById('toggle-label').textContent = active ? 'This month' : 'This year';

            this.state.reset();
            this.month = active ? new Date() : null;

            await SiteSpinner.withLoading(async () => {
                await this.reset();
                await this.reload();
            });
        });

        document.getElementById('spotlight').addEventListener('click', () => {
            if (this._spotlight) this.open(this._spotlight);
        });

        document.getElementById('signal-search').addEventListener('submit', (e) => {
            e.preventDefault();
            this.search(this.input.value);
        });

        this.input.addEventListener('input', () => {
            if (!this.input.value.trim() && this.query) this.clearSearch();
        });

        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.tailTimer ? this.stopTail() : this.clearSearch();
        });
    }
}