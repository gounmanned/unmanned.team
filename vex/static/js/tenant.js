class TenantScreen {
    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.month = new Date();
        this.scope = 'all';

        this.section = document.getElementById('signal-section');
        this.period = document.getElementById('trend-period');

        const now = new Date();
        this.period.children[0].textContent = now.toLocaleString(undefined, { month: 'long' });
        this.period.children[1].textContent = now.getFullYear();

        this.table = new Table('signal-table', {
            open: signal => this.open(signal),
            move: (signal, status) => this.move(signal, status),
        });

        this.audit = new AuditRollup(this.api);

        this.listen();
        new ResizeObserver(() => this.renderTrend()).observe(document.getElementById('trend-svg'));
    }

    async reload() {
        const filter = this.month ? `date=${this.month.toISOString().slice(0, 7)}` : '';
        await this.api.signals.list(filter, new CustomEvent('signal:account'));
        await this.api.signals.list('status=O', new CustomEvent('signal:account'));
        await this.loadSetup();
    }

    async reset() {
        this.api.reset();
        this.table.clear();
        this.audit.clear();
        this.renderThreat();
        this.renderTrend();
    }

    async refresh() {
        this.loader = SiteSpinner.cover(this.section);
        await this.reset();
        await this.reload();
        this.loader.remove();
    }

    signals() {
        return Object.values(this.state.signals?.[this.state.account()] ?? {});
    }

    scoped(scope = this.scope) {
        return this.signals().filter(Table.SCOPES[scope]);
    }

    count() {
        document.querySelectorAll('#signal-scope [data-scope]').forEach(tab => {
            tab.querySelector('.scope-count').textContent = this.scoped(tab.dataset.scope).length.toLocaleString();
        });

        const all = this.scoped();
        const closed = all.filter(s => s.status.startsWith('C'));
        const auto = closed.filter(s => s.status === 'CV').length;
        const pct = closed.length ? Math.round((auto / closed.length) * 100) : 0;

        const responded = closed.filter(s => s.metadata?.threat);
        const mttr = responded.length
            ? `${Math.round(responded.reduce((sum, s) => sum + (new Date(s.updated) - new Date(s.created)), 0) / responded.length / 60000).toLocaleString()}m`
            : '—';

        document.getElementById('signal-count').textContent = `${mttr} MTTR · ${pct}% autoclosed`;
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

    // ── setup ──────────────────────────────────────────────────────

    async loadSetup() {
        const [assets, sources] = await Promise.all([this.api.inventory.list(), this.api.sources.list()]);
        this.renderSetup({
            dots: assets.filter(a => a.metadata?.runtime).length,
            sources: sources.length,
        });
    }

    renderSetup({ dots, sources, warn = {} }) {
        for (const [key, count] of Object.entries({ dot: dots, source: sources })) {
            const chip = document.getElementById(`open-${key}-rollup`);
            chip.dataset.state = !count ? 'empty' : warn[key] ? 'warn' : 'ok';
            chip.querySelector('.setup-chip-count').textContent = count.toLocaleString();
            chip.querySelector('.setup-chip-noun').textContent = count === 1 ? chip.dataset.noun.slice(0, -1) : chip.dataset.noun;
        }
    }

    // ── overview ───────────────────────────────────────────────────

    scheduleTrend() {
        if (this._trendFrame) return;
        this._trendFrame = requestAnimationFrame(() => {
            this._trendFrame = null;
            this.renderThreat();
            this.renderTrend();
        });
    }

    renderTrend() {
        // month view: one point per day · year view: one point per month
        const now = new Date();
        const yearly = !this.month;
        const size = yearly ? 12 : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const bucket = d => yearly ? d.getMonth() : d.getDate() - 1;
        const date = i => yearly ? new Date(now.getFullYear(), i) : new Date(now.getFullYear(), now.getMonth(), i + 1);

        const counts = new Array(size).fill(0);
        this.scoped().map(s => new Date(s.created))
            .filter(d => d.getFullYear() === now.getFullYear() && (yearly || d.getMonth() === now.getMonth()))
            .forEach(d => counts[bucket(d)]++);

        const svg = document.getElementById('trend-svg');
        const W = svg.clientWidth, H = svg.clientHeight;
        if (!W || !H) return;

        const pad = { t: 10, r: 0, b: 18, l: 0 };
        const max = Math.max(1, ...counts);
        const step = (W - pad.l - pad.r) / (size - 1);
        const x = i => pad.l + i * step;
        const y = v => pad.t + (1 - v / max) * (H - pad.t - pad.b);
        const base = y(0);
        const pts = counts.slice(0, bucket(now) + 1).map((v, i) => [x(i), y(v)]);
        const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
        const [lx, ly] = pts.at(-1);
        const area = `${line} L${lx.toFixed(1)},${base} L${pts[0][0].toFixed(1)},${base} Z`;

        const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => {
            const i = Math.round(f * (size - 1));
            const anchor = f === 0 ? 'start' : f === 1 ? 'end' : 'middle';
            const text = yearly ? date(i).toLocaleDateString(undefined, { month: 'short' }) : i + 1;
            return `<text x="${x(i)}" y="${H - 4}" text-anchor="${anchor}">${text}</text>`;
        }).join('');

        const hits = counts.map((v, i) => `
            <rect x="${x(i) - step / 2}" y="0" width="${step}" height="${H}" fill="transparent">
                <title>${date(i).toLocaleDateString(undefined, yearly ? { month: 'long' } : { month: 'short', day: 'numeric' })}: ${v} signal${v === 1 ? '' : 's'}</title>
            </rect>`).join('');

        // ── today marker ──
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const spin = still ? '' :
            `<animateTransform attributeName="transform" type="rotate"
            from="0 ${lx} ${ly}" to="-360 ${lx} ${ly}" dur="12s" repeatCount="indefinite"/>`;

        const waves = [0, 1]
            .map(i => `<circle class="trend-wave" cx="${lx}" cy="${ly}" r="44" style="animation-delay:${-i * 2.5}s"/>`).join('');

        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.innerHTML = `
            <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style="stop-color:var(--brand);stop-opacity:.18"/>
                <stop offset="100%" style="stop-color:var(--brand);stop-opacity:0"/>
            </linearGradient>
            </defs>

            <line class="trend-baseline" x1="${pad.l}" x2="${lx}" y1="${base}" y2="${base}"/>
            <line class="trend-future" x1="${lx}" x2="${W - pad.r}" y1="${base}" y2="${base}"/>
            <path d="${area}" fill="url(#trend-fill)"/>
            <path class="trend-line" d="${line}"/>
            <line class="trend-now" x1="${lx}" x2="${lx}" y1="${ly}" y2="${base}"/>

            <g class="trend-radar">
            ${waves}
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

    renderThreat() {
        const active = this.signals().some(s => s.status.startsWith('O') && s.metadata?.threat);
        document.getElementById('overview').classList.toggle('critical', active);
    }

    // ── events ─────────────────────────────────────────────────────

    listen() {
        document.addEventListener('signal:account', ({ signal }) => {
            this.loader.remove();
            this.state.track(signal);
            this.table.add(signal);
            this.scheduleTrend();
            this.count();
        });

        document.getElementById('view-switch').addEventListener('click', (e) => {
            e.currentTarget.querySelector('span').textContent = this.table.toggleBoard() ? 'table_rows' : 'view_kanban';
        });

        this.period.addEventListener('click', async (e) => {
            const tab = e.target.closest('[data-period]');
            if (!tab || tab.getAttribute('aria-pressed') === 'true') return;

            this.period.querySelectorAll('[data-period]').forEach(b => b.setAttribute('aria-pressed', b === tab));
            this.state.reset();
            this.month = tab.dataset.period === 'month' ? new Date() : null;

            await this.refresh();
        });

        document.getElementById('signal-scope').addEventListener('click', (e) => {
            const tab = e.target.closest('[data-scope]');
            if (!tab || tab.dataset.scope === this.scope) return;

            this.scope = tab.dataset.scope;
            e.currentTarget.querySelectorAll('[data-scope]').forEach(b => b.setAttribute('aria-pressed', b === tab));
            this.table.filter(this.scope);
            this.renderTrend();
            this.count();
        });
    }
}