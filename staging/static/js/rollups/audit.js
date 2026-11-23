class AuditRollup {
    static TAIL_INTERVAL = 10000;
    static TAIL_LOOKBACK = 60000;
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
        this.empty(`${SiteSpinner.inline} Loading the last minute`);

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

        const rows = logs.slice(0, AuditRollup.TAIL_LIMIT);
        this.results.querySelector('.audit-empty')?.remove();
        this.results.insertAdjacentHTML('afterbegin', rows.map(log => `<li>${this.line(log, Workspace.esc, flash)}</li>`).join(''));

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
        if (!logs.length) return this.empty(`No logs match "${Workspace.esc(query)}"`);

        const pattern = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const highlight = text => text.split(pattern)
            .map((part, i) => i % 2 ? `<mark>${Workspace.esc(part)}</mark>` : Workspace.esc(part))
            .join('');

        this.results.innerHTML = logs.map(log => `<li>${this.line(log, highlight)}</li>`).join('');
    }

    // ── render ─────────────────────────────────────────────────────

    // Pulse log row with two columns (session, group) before the message; the row opens to the full text (Chad, 2026-11-19).
    line(log, mark = Workspace.esc, flash = false) {
        const time = AuditRollup.CLOCK.format(new Date(log.timestamp));
        return `<details class="pulse-log__row${flash ? ' is-new' : ''}"><summary>`
            + `<time class="pulse-log__time" datetime="${log.timestamp}">${time}</time>`
            + `<span class="pulse-log__col" title="${Workspace.esc(log.session ?? '')}">${mark(log.session ?? '')}</span>`
            + `<span class="pulse-log__col">${log.group ? `<span class="pulse-badge pulse-badge--sm pulse-badge--nodot audit-group" title="${Workspace.esc(log.group)}">${mark(log.group)}</span>` : ''}</span>`
            + `<span class="pulse-log__text">${mark(log.message ?? '')}</span>`
            + `</summary><pre class="pulse-log__full">${mark(log.message ?? '')}</pre></details>`;
    }

    empty(text) {
        this.results.innerHTML = `<li class="audit-empty">${text}</li>`;
    }

    listen() {
        document.getElementById('audit-search').onsubmit = (e) => {
            e.preventDefault();
            this.search();
        };

        // Pulse's clear X and Esc empty the field and fire an input event: back to the live view.
        this.input.addEventListener('input', () => { if (!this.input.value.trim() && this.query) this.search(); });

        new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) this.stopTail();
        }).observe(this.screen);
    }
}