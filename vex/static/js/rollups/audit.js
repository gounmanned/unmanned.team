class AuditRollup {
    constructor(state) {
        this.state = state;
        this.api = new Api(state);
        this.screen = document.getElementById('audit-screen');
        this.watermark = this.screen.querySelector('site-watermark');
        this.body = document.getElementById('audit-terminal-body');
        this.list = document.getElementById('audit-list');
        this.emptyLabel = document.getElementById('audit-empty-label');
        this.footer = document.getElementById('audit-terminal-footer');
        this.filter = document.getElementById('audit-filter');

        this.logs = [];
        this.query = '';
        this.listen();
    }

    async reset() {
        this.api.reset();
        this.logs = [];
        this.query = '';
        this.filter.value = '';
        this.watermark.show("24-hour audit");
        this.render();
    }

    async reload() {
        const stream = await this.api.audit.messages() || [];
        this.logs = stream.map(log => {
            const [group, ...rest] = log.message.split(' | ');
            return { timestamp: log.timestamp, group, message: rest.join(' | ') };
        });
        this.watermark.hide();
        this.render();
    }

    render() {
        const q = this.query;
        const rows = this.logs.filter(log =>
            !q || log.group.toLowerCase().includes(q) || log.message.toLowerCase().includes(q)
        );

        this.body.classList.toggle('empty', rows.length === 0);
        this.emptyLabel.textContent = q ? `No logs match "${this.query}"` : 'No logs recorded';

        this.list.innerHTML = rows.map(log => `
            <li class="audit-entry">
                <span class="audit-prompt">›</span>
                <span class="audit-time">${this.time(log.timestamp)}</span>
                <span class="audit-group">${this.escape(log.group)}</span>
                <span class="audit-message">${this.highlight(log.message)}</span>
            </li>
        `).join('');

        this.footer.innerHTML = `
            <span>${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}</span>
            ${q ? `<span>· filtered from ${this.logs.length}</span>` : ''}
        `;
    }

    time(ts) {
        const d = new Date(ts);
        return isNaN(d) ? ts : d.toLocaleTimeString([], { hour12: false });
    }

    escape(text) {
        return text.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }

    highlight(text) {
        const escaped = this.escape(text);
        if (!this.query) return escaped;
        const re = new RegExp(`(${this.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
        return escaped.replace(re, '<mark>$1</mark>');
    }

    listen() {
        this.filter.addEventListener('input', ev => {
            this.query = ev.target.value.trim().toLowerCase();
            this.render();
        });
    }
}