class TenantScreen {
    static PENDING = {
        queue: '#queue-count, #recs-count, #queue-summary',
        history: '#kpi-mttr, #kpi-autoclosed, #kpi-sla, #resolved-count',
        setup: '.setup-chip-count, .setup-chip-pct',
        events: '#events-count',
    };

    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.monthly = true;
        this.outcome = 'all';
        this.run = 0;
        this.pending = new Set(Object.keys(TenantScreen.PENDING));
        this.revealed = false;
        this.coverage = { assets: 0, dots: 0 };
        this.ekg = new Ekg(this.api, () => this.reload());   // the sweep's minute is the screen's refresh clock

        this.screen = document.getElementById('tenant-screen');
        this.period = document.getElementById('period');

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
    }

    // ── data ───────────────────────────────────────────────────────

    get loading() {
        return this.pending.size > 0;
    }

    async reload() {
        if (!this.state.account()) return;

        if (!this.ekg.running) this.ekg.start(this.settle('events'));
        await Promise.all([
            this.api.signals.list('status=O', new CustomEvent('signal:account')).then(this.settle('queue')),
            this.loadHistory().then(this.settle('history')),
            this.countAssets().then(this.settle('setup', c => this.coverage = c)),
        ]);
    }

    loadHistory() {
        const filter = this.monthly ? `date=${TenantScreen.yyyymm(new Date())}` : '';
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
        this.ekg.stop();
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
        return d.getFullYear() === now.getFullYear() && (!this.monthly || d.getMonth() === now.getMonth());
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
                this.table.render({ threats, recs, closed: ready('history') ? shown : [] });
                this.renderLanes(threats, recs);
                this.screen.classList.toggle('critical', threats.some(s => s.metadata.threat));
            }

            if (ready('history')) {
                this.renderKpis(closed);
                this.renderOutcomes(closed);
            }

            if (ready('setup')) this.renderSetup(this.coverage);

            this.mark();
            this.reveal();
        });
    }

    mark() {
        Object.entries(TenantScreen.PENDING).forEach(([part, selector]) => {
            document.querySelectorAll(selector).forEach(el => el.classList.toggle('is-pending', this.pending.has(part)));
        });
    }

    skeleton() {
        // Pulse skeleton rows (batch 2026-11-19); VEX keeps its fade-out down the list.
        const row = (name, sub, opacity) => `
            <li class="pulse-skeleton-row q-ghost" style="opacity:${opacity}" aria-hidden="true">
                <span class="pulse-skeleton pulse-skeleton--mark"></span><span class="pulse-skeleton" style="max-width:${name}px"></span>
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
        const chips = [['all', 'All'], ...Object.entries(Table.OUTCOMES).map(([key, o]) => [key, o.label])];
        document.getElementById('outcomes').innerHTML = chips.map(([key, label]) => {
            const n = key === 'all' ? closed.length : closed.filter(s => s.status === key).length;
            return `<button class="pulse-chip" type="button" data-outcome="${key}" aria-pressed="${key === this.outcome}">${label} <span class="pulse-chip__count">${n.toLocaleString()}</span></button>`;
        }).join('');
    }

    // ── setup ──────────────────────────────────────────────────────

    async countAssets() {
        const assets = await this.api.inventory.list();
        return {
            assets: assets.length,   // one per asset key, same as the coverage table
            dots: assets.filter(a => a.metadata?.runtime).length,
        };
    }

    renderSetup({ assets, dots }) {
        const seg = document.querySelector('.setup-seg');
        seg.dataset.state = assets ? 'ok' : 'empty';
        seg.querySelector('.setup-chip-count').textContent = assets.toLocaleString();
        seg.querySelector('.setup-chip-pct').textContent = assets ? `(${Math.round(dots / assets * 100)}%)` : '';
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
            this.monthly = tab.dataset.period === 'month';
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

// ── ekg: live sweep of real-time audit events, one wall-clock minute per pass ──

class Ekg {
    static WINDOW = 60;
    static PAD = { t: 8, b: 16 };
    static POLL = 2000;
    static MINUTE = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

    constructor(api, onMinute) {
        this.api = api;
        this.onMinute = onMinute;
        this.run = 0;
        this.timer = null;
        this.events = [];
        this.size = { W: 0, H: 0 };
        this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;

        this.counter = document.getElementById('events-count');
        this.svg = document.getElementById('ekg-svg');
        this.svg.innerHTML = `
            <line class="ekg-ahead"/>
            <g class="ekg-axis">
                <text class="ekg-from" text-anchor="start"/>
                <text class="ekg-next" text-anchor="end"/>
                <text class="ekg-now" text-anchor="middle">live</text>
            </g>
            <path class="ekg-trace"/>
            <line class="ekg-scan" y1="0"/>
            <circle class="ekg-halo" r="3"/>
            <circle class="ekg-head" r="3"/>
        `;
        this.trace = this.svg.querySelector('.ekg-trace');
        this.ahead = this.svg.querySelector('.ekg-ahead');
        [this.fromLabel, this.nextLabel, this.nowLabel] = this.svg.querySelectorAll('.ekg-axis text');
        this.scan = this.svg.querySelector('.ekg-scan');
        this.dots = this.svg.querySelectorAll('circle');

        new ResizeObserver(() => this.resize()).observe(this.svg);
    }

    start(ready) {
        this.stop();
        this.ready = ready;
        this.primed = false;
        this.minute = null;
        this.count = null;
        this.from = new Date(Math.floor(Date.now() / 60000) * 60000);   // only this minute matters

        this.poll();
        this.timer = setInterval(() => this.poll(), Ekg.POLL);
        if (!this.still) this.loop();
    }

    stop() {
        this.run++;
        clearInterval(this.timer);
        this.timer = null;
        cancelAnimationFrame(this.frame);
    }

    get running() {
        return this.timer !== null;
    }

    loop = () => {
        this.render();
        this.frame = requestAnimationFrame(this.loop);
    };

    async poll() {
        const run = this.run;
        const start = this.from;
        const end = this.from = new Date();

        const logs = await this.api.audit.get(start.toISOString(), end.toISOString()) ?? [];
        if (run !== this.run) return;

        const times = logs.map(log => Date.parse(log.timestamp));
        if (this.primed) this.events.push(...times);
        else {
            this.events = times;
            this.primed = true;
            this.ready();
        }
        this.render();
    }

    resize() {
        const W = this.svg.clientWidth, H = this.svg.clientHeight;
        const base = H - Ekg.PAD.b;
        this.size = { W, H, base };
        this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

        Object.entries({ x2: W, y1: base, y2: base }).forEach(([k, v]) => this.ahead.setAttribute(k, v));
        this.scan.setAttribute('y2', base);
        [this.fromLabel, this.nextLabel, this.nowLabel].forEach(t => t.setAttribute('y', H - 3));
        this.nextLabel.setAttribute('x', W);
        this.render();
    }

    render(now = Date.now()) {
        const { WINDOW, PAD } = Ekg;
        const minute = Math.floor(now / 60000) * 60000;

        if (minute !== this.minute) {
            if (this.minute) this.onMinute();
            this.minute = minute;
            this.fromLabel.textContent = Ekg.MINUTE.format(minute);
            this.nextLabel.textContent = `${Ekg.MINUTE.format(minute + 60000)} →`;
        }

        this.events = this.events.filter(t => t >= minute);
        const slots = new Array(WINDOW).fill(0);
        this.events.filter(t => t < minute + 60000).forEach(t => slots[Math.floor((t - minute) / 1000)]++);

        const head = (now - minute) / 1000;
        const drawn = Math.floor(head);
        const count = slots.slice(0, drawn).reduce((a, b) => a + b, 0);
        if (this.primed && count !== this.count) {
            this.count = count;
            this.counter.textContent = count.toLocaleString();
        }

        const { W, base } = this.size;
        if (!W) return;

        const w = W / WINDOW;
        const amp = base - PAD.t;
        const max = Math.max(3, ...slots);
        const pt = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
        const idle = t => base - 2.5 * Math.sin(t * 2.1) - 1.2 * Math.sin(t * 4.3);

        let d = `M0,${idle(0).toFixed(1)}`;
        for (let i = 0; i < drawn; i++) {
            const x = i * w, c = slots[i];
            if (!c) { d += ` L${pt(x + w, idle(i + 1))}`; continue; }
            const h = amp * Math.max(0.3, c / max);
            const y = idle(i);
            d += ` L${pt(x + w * .3, y)} L${pt(x + w * .45, y - h)}`
                + ` L${pt(x + w * .6, y + Math.min(h * .4, 5))} L${pt(x + w * .75, y)}`
                + ` L${pt(x + w, idle(i + 1))}`;
        }

        const hx = head * w;
        const hy = idle(head);
        this.trace.setAttribute('d', `${d} L${pt(hx, hy)}`);
        this.ahead.setAttribute('x1', hx);
        this.scan.setAttribute('x1', hx);
        this.scan.setAttribute('x2', hx);
        this.dots.forEach(c => { c.setAttribute('cx', hx); c.setAttribute('cy', hy); });
        this.place(hx, W);
    }

    place(hx, W) {
        const room = 44;   // keep "now" from colliding with the end labels
        this.nowLabel.setAttribute('x', Math.min(Math.max(hx, room / 2), W - room / 2));
        this.fromLabel.classList.toggle('hidden', hx < room + 24);
        this.nextLabel.classList.toggle('hidden', hx > W - room - 40);
    }
}