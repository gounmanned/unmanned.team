class TenantScreen {
    static OUTCOMES = { all: 'All', CV: 'Autoclosed', CH: 'By you', CR: 'Accepted risk' };

    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.month = new Date();
        this.outcome = 'all';

        this.screen = document.getElementById('tenant-screen');
        this.period = document.getElementById('trend-period');

        const now = new Date();
        this.period.children[0].textContent = now.toLocaleString(undefined, { month: 'long' });
        this.period.children[1].textContent = now.getFullYear();

        this.table = new Table({
            queue: document.getElementById('queue-list'),
            recs: document.getElementById('recs-list'),
            history: document.getElementById('history'),
            open: signal => this.open(signal),
            move: (signal, status) => this.move(signal, status),
        });

        this.listen();
        new ResizeObserver(() => this.schedule()).observe(document.getElementById('trend-svg'));
    }

    // ── data ───────────────────────────────────────────────────────

    async reload() {
        const filter = this.month ? `date=${TenantScreen.yyyymm(this.month)}` : '';
        await this.api.signals.list(filter, new CustomEvent('signal:account'));
        await this.api.signals.list('status=O', new CustomEvent('signal:account'));
        await this.loadSetup();
    }

    reset() {
        this.api.reset();
        this.schedule();
    }

    async refresh() {
        const loader = SiteSpinner.cover(this.screen);
        this.reset();
        await this.reload();
        loader.remove();
    }

    signals() {
        return Object.values(this.state.signals?.[this.state.account()] ?? {});
    }

    async open(signal) {
        await SiteSpinner.withLoading(async () => {
            Workspace.sidebars.signal.reset();
            Workspace.sidebars.signal.inject(signal, await this.api.signals.get(signal.id));
            document.getElementById('signal-sidebar').show();
        });
    }

    async move(signal, status) {
        this.state.track({ ...signal, status, updated: new Date().toISOString() });
        this.schedule();

        try {
            this.state.track(await this.api.signals.patch(signal.id, { status }));
        } catch (err) {
            console.error('status update failed', err);
            this.state.track(signal);
        }
        this.schedule();
    }

    static yyyymm(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    // ── render ─────────────────────────────────────────────────────

    schedule() {
        this.frame ??= requestAnimationFrame(() => {
            this.frame = null;

            const all = this.signals();
            const open = all.filter(s => !s.status.startsWith('C'));
            const closed = all.filter(s => s.status.startsWith('C'));
            const threats = open.filter(Table.SCOPES.threats);
            const recs = open.filter(Table.SCOPES.recs);
            const shown = this.outcome === 'all' ? closed : closed.filter(s => s.status === this.outcome);

            this.table.render({ threats, recs, closed: shown, handled: closed.length });
            this.renderLanes(threats, recs);
            this.renderKpis(closed);
            this.renderOutcomes(closed);
            this.renderTrend(all.filter(Table.SCOPES.threats));
            this.screen.classList.toggle('critical', threats.some(s => s.metadata.threat));
        });
    }

    renderLanes(threats, recs) {
        const now = Date.now();
        const overdue = threats.filter(s => Table.due(s) < now).length;
        const next = Math.min(...threats.map(Table.due).filter(t => t > now));

        const summary = [
            overdue ? `<span class="alert">${overdue} past SLA</span>` : threats.length ? 'All within SLA' : '',
            Number.isFinite(next) ? `next due in ${Table.span(next - now)}` : '',
        ].filter(Boolean).join(' · ');

        document.getElementById('queue-count').textContent = threats.length.toLocaleString();
        document.getElementById('recs-count').textContent = recs.length.toLocaleString();
        document.getElementById('queue-summary').innerHTML = summary || 'SOC signals that need a human decision land here.';
    }

    renderKpis(closed) {
        const timed = closed.filter(Table.SCOPES.threats);
        const withDue = closed.filter(s => s.due);
        const span = s => Table.ended(s) - Workspace.time(s.created);
        const mttr = timed.length ? timed.reduce((t, s) => t + span(s), 0) / timed.length : null;
        const pct = (n, of) => of ? `${Math.round(n / of * 100)}%` : null;

        const kpis = [
            ['MTTR', mttr == null ? null : Table.span(mttr)],
            ['Autoclosed', pct(closed.filter(s => s.status === 'CV').length, closed.length)],
            ['Within SLA', pct(withDue.filter(s => Table.ended(s) <= Workspace.time(s.due)).length, withDue.length)],
        ];

        document.getElementById('handled-count').textContent = closed.length.toLocaleString();
        document.getElementById('kpis').innerHTML = kpis
            .filter(([, value]) => value != null)
            .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
            .join('');
    }

    renderOutcomes(closed) {
        document.getElementById('outcomes').innerHTML = Object.entries(TenantScreen.OUTCOMES).map(([key, label]) => {
            const n = key === 'all' ? closed.length : closed.filter(s => s.status === key).length;
            return `<button type="button" data-outcome="${key}" aria-pressed="${key === this.outcome}">${label}<span class="n">${n.toLocaleString()}</span></button>`;
        }).join('');
    }

    renderTrend(signals) {
        // month view: one point per day · year view: one point per month
        const now = new Date();
        const yearly = !this.month;
        const size = yearly ? 12 : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const bucket = d => yearly ? d.getMonth() : d.getDate() - 1;
        const date = i => yearly ? new Date(now.getFullYear(), i) : new Date(now.getFullYear(), now.getMonth(), i + 1);

        const counts = new Array(size).fill(0);
        signals.map(s => new Date(Workspace.time(s.created)))
            .filter(d => d.getFullYear() === now.getFullYear() && (yearly || d.getMonth() === now.getMonth()))
            .forEach(d => counts[bucket(d)]++);

        const svg = document.getElementById('trend-svg');
        const W = svg.clientWidth, H = svg.clientHeight;
        if (!W || !H) return;

        const pad = { t: 6, r: 0, b: 14, l: 0 };
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
                <title>${date(i).toLocaleDateString(undefined, yearly ? { month: 'long' } : { month: 'short', day: 'numeric' })}: ${v} SOC signal${v === 1 ? '' : 's'}</title>
            </rect>`).join('');

        // ── today marker ──
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const spin = still ? '' :
            `<animateTransform attributeName="transform" type="rotate"
            from="0 ${lx} ${ly}" to="-360 ${lx} ${ly}" dur="12s" repeatCount="indefinite"/>`;

        const waves = [0, 1]
            .map(i => `<circle class="trend-wave" cx="${lx}" cy="${ly}" r="22" style="animation-delay:${-i * 2.5}s"/>`).join('');

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
            <circle class="trend-halo" cx="${lx}" cy="${ly}" r="11"/>
            <g>
                <circle class="trend-reticle" cx="${lx}" cy="${ly}" r="6.5"/>
                ${spin}
            </g>
            <circle class="trend-today-pulse" cx="${lx}" cy="${ly}" r="3"/>
            <circle class="trend-today" cx="${lx}" cy="${ly}" r="3"/>
            </g>
            <g class="trend-axis">${ticks}</g>
            ${hits}
        `;
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

    // ── events ─────────────────────────────────────────────────────

    listen() {
        document.addEventListener('signal:account', ({ signal }) => {
            this.state.track(signal);
            this.schedule();
        });

        this.period.addEventListener('click', async (e) => {
            const tab = e.target.closest('[data-period]');
            if (!tab || tab.getAttribute('aria-pressed') === 'true') return;

            this.period.querySelectorAll('[data-period]').forEach(b => b.setAttribute('aria-pressed', b === tab));
            this.state.reset();
            this.month = tab.dataset.period === 'month' ? new Date() : null;

            await this.refresh();
        });

        // shade the pinned chart once the lanes start sliding under it
        const work = document.getElementById('signal-section');
        work.addEventListener('scroll', () => {
            this.screen.classList.toggle('scrolled', work.scrollTop > 0);
        }, { passive: true });

        document.getElementById('outcomes').addEventListener('click', (e) => {
            const chip = e.target.closest('[data-outcome]');
            if (!chip) return;

            this.outcome = chip.dataset.outcome;
            this.schedule();
        });
    }
}