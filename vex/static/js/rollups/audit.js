class AuditRollup {
    static TAIL_INTERVAL = 10000;
    static TAIL_LOOKBACK = 3600000;
    static TAIL_LIMIT = 1000;
    static CLOCK = new Intl.DateTimeFormat(undefined, {
        month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });

    constructor(state) {
        this.api = state.api;
        this.query = '';
        this.tailTimer = null;

        this.screen = document.getElementById('audit-screen');
        this.input = document.getElementById('audit-search-input');
        this.results = document.getElementById('audit-results');
        this.count = document.getElementById('audit-count');
        this.countLabel = document.getElementById('audit-count-label');

        this.listen();
    }

    async reset() {
        this.stopTail();
        this.input.value = '';
        this.query = '';
    }

    async reload() {
        this.startTail();
    }

    // ── tail ───────────────────────────────────────────────────────

    startTail() {
        this.stopTail();
        this.total = 0;
        this.setCount(0, '1h events');
        this.empty(`${SiteSpinner.inline} Loading the last hour`);

        this.tailFrom = new Date(Date.now() - AuditRollup.TAIL_LOOKBACK);
        this.tailTimer = setInterval(() => this.pollTail(), AuditRollup.TAIL_INTERVAL);
        this.screen.classList.add('tailing');
        this.pollTail(false);
    }

    stopTail() {
        clearInterval(this.tailTimer);
        this.tailTimer = null;
        this.screen.classList.remove('tailing');
    }

    async pollTail(flash = true) {
        const timer = this.tailTimer;
        const start = this.tailFrom;
        const end = this.tailFrom = new Date();

        const logs = await this.api.audit.get(start.toISOString(), end.toISOString()) ?? [];
        if (timer !== this.tailTimer || !logs.length) return;

        this.total += logs.length;
        this.setCount(this.total, '1h events');

        const rows = logs.slice(0, AuditRollup.TAIL_LIMIT);
        this.results.querySelector('.audit-empty')?.remove();
        this.results.insertAdjacentHTML('afterbegin',
            rows.map(log => `<li${flash ? ' class="tail-new"' : ''}>${this.line(log)}</li>`).join(''));

        while (this.results.children.length > AuditRollup.TAIL_LIMIT) this.results.lastElementChild.remove();
    }

    // ── search ─────────────────────────────────────────────────────

    async search() {
        const query = this.query = this.input.value.trim();
        if (!query) return this.startTail();

        this.stopTail();
        this.results.innerHTML = '';

        let logs = [];
        await SiteSpinner.withLoading(async () => {
            logs = await this.api.audit.search(query) ?? [];
        });

        if (query !== this.query) return;
        this.setCount(logs.length, 'matches');
        if (!logs.length) return this.empty(`No logs match "${Workspace.esc(query)}"`);

        const pattern = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const highlight = text => text.split(pattern)
            .map((part, i) => i % 2 ? `<mark>${Workspace.esc(part)}</mark>` : Workspace.esc(part))
            .join('');

        this.results.innerHTML = logs.map(log => `<li>${this.line(log, highlight(log.message))}</li>`).join('');
    }

    // ── render ─────────────────────────────────────────────────────

    line(log, message = Workspace.esc(log.message)) {
        const time = AuditRollup.CLOCK.format(new Date(log.timestamp));
        return `<time datetime="${log.timestamp}">${time}</time><span>${message}</span>`;
    }

    setCount(n, label) {
        this.count.textContent = n.toLocaleString();
        this.countLabel.textContent = label;
    }

    empty(text) {
        this.results.innerHTML = `<li class="audit-empty">${text}</li>`;
    }

    listen() {
        document.getElementById('audit-search').onsubmit = (e) => {
            e.preventDefault();
            this.search();
        };

        this.input.onkeydown = (e) => {
            if (e.key !== 'Escape') return;
            this.input.value = '';
            this.search();
        };

        this.results.onclick = (e) => {
            if (getSelection().toString()) return;
            e.target.closest('li:not(.audit-empty)')?.classList.toggle('expanded');
        };

        new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) this.stopTail();
        }).observe(this.screen);
    }
}