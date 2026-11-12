class AuditRollup {
    static CLOCK = new Intl.DateTimeFormat(undefined, {
        month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });

    constructor(api) {
        this.api = api;
        this.query = '';
        this.input = document.getElementById('audit-search-input');
        this.results = document.getElementById('audit-results');
        this.count = document.getElementById('audit-count');

        this.clear();
        this.listen();
    }

    async search() {
        const query = this.query = this.input.value.trim();
        if (!query) return this.clear();

        this.results.innerHTML = '';

        let logs = [];
        await SiteSpinner.withLoading(async () => {
            logs = await this.api.audit.search(query) ?? [];
        });

        if (query !== this.query) return;
        this.count.textContent = logs.length.toLocaleString();
        if (!logs.length) return this.empty(`No logs match "${Workspace.esc(query)}"`);

        const pattern = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const highlight = text => text.split(pattern)
            .map((part, i) => i % 2 ? `<mark>${Workspace.esc(part)}</mark>` : Workspace.esc(part))
            .join('');

        this.results.innerHTML = logs.map(log => `
            <li>
                <time datetime="${log.timestamp}">${AuditRollup.CLOCK.format(new Date(log.timestamp))}</time>
                <span>${highlight(log.message)}</span>
            </li>`).join('');
    }

    clear() {
        this.input.value = '';
        this.count.textContent = '—';
        this.empty('Search the audit log by keyword');
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
            if (e.key === 'Escape') this.clear();
        };

        this.results.onclick = (e) => {
            if (getSelection().toString()) return;
            e.target.closest('li:not(.audit-empty)')?.classList.toggle('expanded');
        };
    }
}