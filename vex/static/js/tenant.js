class TenantScreen {
    static OUTCOMES = { all: 'All', CV: 'Autoclosed', CH: 'By you', CR: 'Accepted risk' };
    static PENDING = {
        queue: '#queue-count, #recs-count, #queue-summary',
        history: '#kpi-mttr, #kpi-autoclosed, #kpi-sla, #resolved-count',
        setup: '.setup-chip-count',
        events: '#events-count',
    };

    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.month = new Date();
        this.outcome = 'all';
        this.run = 0;
        this.pending = new Set(Object.keys(TenantScreen.PENDING));
        this.revealed = false;
        this.assets = 0;
        this.events = 0;

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

    get loading() {
        return this.pending.size > 0;
    }

    async reload() {
        if (!this.state.account()) return;

        await Promise.all([
            this.api.signals.list('status=O', new CustomEvent('signal:account')).then(this.settle('queue')),
            this.loadHistory().then(this.settle('history')),
            this.countAssets().then(this.settle('setup', n => this.assets = n)),
            this.countEvents().then(this.settle('events', n => this.events = n)),
        ]);
    }

    loadHistory() {
        const filter = this.month ? `date=${TenantScreen.yyyymm(this.month)}` : '';
        return this.api.signals.list(filter, new CustomEvent('signal:account'));
    }

    settle(part, apply) {
        const run = this.run;
        return value => {
            if (run !== this.run) return;
            apply?.(value);
            this.pending.delete(part);
            this.schedule();
        };
    }

    reset() {
        this.api.reset();
        this.run++;
        this.pending = new Set(Object.keys(TenantScreen.PENDING));
        this.revealed = false;

        this.screen.classList.remove('critical', 'scrolled');
        document.getElementById('signal-section').scrollTop = 0;
        document.getElementById('queue-summary').textContent = 'Loading signals for this account';
        document.querySelector('.setup-seg').dataset.state = 'loading';
        this.skeleton();
        this.mark();
        this.schedule();
    }

    async refresh() {
        this.reset();
        await this.reload();
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

    inPeriod(signal) {
        const d = new Date(Workspace.time(signal.created));
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && (!this.month || d.getMonth() === now.getMonth());
    }

    // ── render ─────────────────────────────────────────────────────

    schedule() {
        this.frame ??= requestAnimationFrame(() => {
            this.frame = null;

            const all = this.signals();
            const open = all.filter(s => !s.status.startsWith('C'));
            const closed = all.filter(s => s.status.startsWith('C') && this.inPeriod(s));
            const threats = open.filter(Table.SCOPES.threats);
            const recs = open.filter(Table.SCOPES.recs);
            const shown = this.outcome === 'all' ? closed : closed.filter(s => s.status === this.outcome);
            const ready = part => !this.pending.has(part);

            if (ready('queue')) {
                this.table.render({ threats, recs, closed: ready('history') ? shown : [], resolved: closed.length });
                this.renderLanes(threats, recs);
                this.screen.classList.toggle('critical', threats.some(s => s.metadata.threat));
            }

            if (ready('history')) {
                this.renderKpis(closed);
                this.renderOutcomes(closed);
            }

            if (ready('setup')) this.renderSetup(this.assets);
            if (ready('events')) document.getElementById('events-count').textContent = this.events.toLocaleString();

            this.renderTrend(all.filter(s => Table.SCOPES.threats(s) && this.inPeriod(s)));
            this.mark();
            this.reveal();
        });
    }

    mark() {
        Object.entries(TenantScreen.PENDING).forEach(([part, selector]) => {
            document.querySelectorAll(selector).forEach(el => el.classList.toggle('is-pending', this.pending.has(part)));
        });
        this.screen.querySelector('.trend-chart').classList.toggle('is-dim', this.pending.has('history'));
    }

    skeleton() {
        const row = (name, sub, opacity) => `
            <li class="q-item q-ghost" style="opacity:${opacity}" aria-hidden="true">
                <span class="q-avatar shimmer"></span>
                <span class="q-main"><i class="shimmer" style="width:${name}px"></i><i class="shimmer" style="width:${sub}px"></i></span>
            </li>`;
        const rows = list => list.map(r => row(...r)).join('');

        document.getElementById('queue-list').innerHTML = rows([[184, 96, 1], [148, 120, 0.75], [204, 80, 0.5], [132, 104, 0.25]]);
        document.getElementById('recs-list').innerHTML = rows([[164, 88, 0.6], [140, 112, 0.3]]);
        document.getElementById('history').innerHTML = '';
    }

    reveal() {
        if (this.revealed || this.pending.has('queue')) return;
        this.revealed = true;
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        ['queue-list', 'recs-list'].forEach(id => {
            [...document.getElementById(id).children].slice(0, 14).forEach((li, i) => li.animate(
                [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
                { duration: 280, delay: i * 28, easing: 'ease-out', fill: 'backwards' },
            ));
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
        document.getElementById('queue-summary').innerHTML = summary || 'Signals that need a human decision land here.';
    }

    renderKpis(closed) {
        const timed = closed.filter(Table.SCOPES.threats);
        const withDue = closed.filter(s => s.due);
        const mttr = timed.reduce((t, s) => t + Table.ended(s) - Workspace.time(s.created), 0) / timed.length;
        const pct = (n, of, none = '—') => of ? `${Math.round(n / of * 100)}%` : none;
        const set = (id, text) => document.getElementById(id).textContent = text;

        set('kpi-mttr', !timed.length ? '—' : mttr < 60000 ? '0' : Table.span(mttr));
        set('kpi-autoclosed', pct(closed.filter(s => s.status === 'CV').length, closed.length));
        set('kpi-sla', pct(withDue.filter(s => Table.ended(s) <= Workspace.time(s.due)).length, withDue.length, '100%'));
        set('resolved-count', closed.length.toLocaleString());
    }

    renderOutcomes(closed) {
        document.getElementById('outcomes').innerHTML = Object.entries(TenantScreen.OUTCOMES).map(([key, label]) => {
            const n = key === 'all' ? closed.length : closed.filter(s => s.status === key).length;
            return `<button type="button" data-outcome="${key}" aria-pressed="${key === this.outcome}">${label}<span class="n">${n.toLocaleString()}</span></button>`;
        }).join('');
    }

    renderTrend(signals) {
        const now = new Date();
        const yearly = !this.month;
        const size = yearly ? 12 : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const bucket = d => yearly ? d.getMonth() : d.getDate() - 1;
        const date = i => yearly ? new Date(now.getFullYear(), i) : new Date(now.getFullYear(), now.getMonth(), i + 1);

        const counts = new Array(size).fill(0);
        signals.forEach(s => counts[bucket(new Date(Workspace.time(s.created)))]++);

        const svg = document.getElementById('trend-svg');
        const W = svg.clientWidth, H = svg.clientHeight;
        const key = [W, H, bucket(now), counts].join('|');
        if (!W || !H || key === this.trendKey) return;
        this.trendKey = key;

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

        const ticks = counts.map((_, i) => {
            const anchor = i === 0 ? 'start' : i === size - 1 ? 'end' : 'middle';
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

    async countAssets() {
        const assets = await this.api.inventory.list();
        return new Set(assets.map(a => a.name.toLowerCase())).size;   // same de-dupe as the coverage table
    }

    renderSetup(assets) {
        const seg = document.querySelector('.setup-seg');
        seg.dataset.state = assets ? 'ok' : 'empty';
        seg.querySelector('.setup-chip-count').textContent = assets.toLocaleString();
    }

    // ── audit ──────────────────────────────────────────────────────

    async countEvents() {
        const end = new Date();
        const start = new Date(end - 3600000);
        const logs = await this.api.audit.get(start.toISOString(), end.toISOString()) ?? [];
        return logs.length;
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
            this.month = tab.dataset.period === 'month' ? new Date() : null;
            this.pending.add('history');
            this.schedule();

            await this.loadHistory().then(this.settle('history'));
        });

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