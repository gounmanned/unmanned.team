class AuditRollup {
    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.screen = document.getElementById('audit-screen');
        this.body = document.getElementById('audit-terminal-body');
        this.list = document.getElementById('audit-list');
        this.emptyLabel = document.getElementById('audit-empty-label');
        this.footer = document.getElementById('audit-terminal-footer');
        this.filter = document.getElementById('audit-filter');
        this.range = document.getElementById('audit-range');

        this.logs = [];
        this.listen();
    }

    async reset() {
        this.logs = [];
        this.filter.value = '';
        this.range.value = '1';
        this.render();
    }

    async reload() {
        SiteSpinner.withLoading(async () => {
            const stream = await this.api.audit.messages(Number(this.range.value)) || [];
            this.logs = stream.map(log => {
                const [group, ...rest] = log.message.split(' | ');
                return { timestamp: log.timestamp, group, message: rest.join(' | ') };
            });
            this.render();
        });
    }

    render() {
        const q = this.filter.value.trim().toLowerCase();
        const rows = this.logs.filter(log =>
            !q || log.group.toLowerCase().includes(q) || log.message.toLowerCase().includes(q)
        );

        this.body.classList.toggle('empty', rows.length === 0);
        this.emptyLabel.textContent = q ? `No logs match "${q}"` : 'No logs recorded';

        this.list.innerHTML = rows.map(log => `
            <li class="audit-entry">
                <span class="audit-prompt">›</span>
                <span class="audit-time">${this.time(log.timestamp)}</span>
                <span class="audit-group">${this.escape(log.group)}</span>
                <span class="audit-message">${this.highlight(log.message, q)}</span>
            </li>
        `).join('');

        this.footer.innerHTML = `
            <span>${rows.length.toLocaleString()} ${rows.length === 1 ? 'entry' : 'entries'}</span>
            ${q ? `<span>· filtered from ${this.logs.length.toLocaleString()}</span>` : ''}
        `;
    }

    time(ts) {
        const d = new Date(ts);
        return isNaN(d) ? ts : d.toLocaleTimeString([], { hour12: false });
    }

    escape(text) {
        return text.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }

    highlight(text, q) {
        const escaped = this.escape(text);
        if (!q) return escaped;
        const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
        return escaped.replace(re, '<mark>$1</mark>');
    }

    listen() {
        this.filter.addEventListener('input', () => this.render());
        this.range.addEventListener('change', () => this.reload());
    }
}