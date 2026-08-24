class ThreatSidebar {
    constructor(state) {
        this.state = state;
        this.api = state.api.threat;
        this.threats = [];
        this.list = document.getElementById('threat-list');
        this.wrap = document.getElementById('threat-list-wrap');
        this.search = document.getElementById('threat-search');
        this.search.addEventListener('input', () => this.filter(this.search.value));
    }

    async reset() {
        this.search.value = '';
    }

    async reload() {
        this.list.innerHTML = '';
        this.threats = (await this.api.list()).sort((a, b) => new Date(b.created) - new Date(a.created));
        this.threats.forEach(threat => this.add(threat));
        this.wrap.classList.toggle('empty', this.threats.length === 0);
        this.wrap.classList.remove('no-results');
    }

    add(threat) {
        const created = this.formatTime(threat.created);

        const item = document.createElement('li');
        item.className = 'entry entry-threat';
        item.innerHTML = `
            <img class="threat-source-icon" src="static/img/source/${threat.source}.png"
                 alt="${threat.source}" onerror="this.replaceWith(Object.assign(document.createElement('span'), {className:'material-symbols-outlined threat-source-fallback', textContent:'travel_explore'}))">
            <span class="threat-name">${threat.name}</span>
            <span class="threat-created">${created}</span>
        `;

        item.dataset.search = [threat.name, threat.source].filter(Boolean).join(' ').toLowerCase();
        this.list.appendChild(item);
    }

    filter(query) {
        const q = query.trim().toLowerCase();
        let visible = 0;

        this.list.querySelectorAll('.entry').forEach(el => {
            const match = !q || el.dataset.search.includes(q);
            el.style.display = match ? '' : 'none';
            if (match) visible++;
        });

        this.wrap.classList.toggle('no-results', this.threats.length > 0 && visible === 0);
    }

    formatTime(ts) {
        if (!ts) return '';
        const date = new Date(ts);
        if (isNaN(date.getTime())) return '';

        const diffMs = Date.now() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);

        if (diffMin < 1) return 'just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        const diffDay = Math.floor(diffHr / 24);
        if (diffDay < 7) return `${diffDay}d ago`;

        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
}