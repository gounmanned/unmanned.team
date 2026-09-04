class ThreatSidebar {
    constructor(state) {
        this.state = state;
        this.api = state.api.threat;
        this.threats = [];
        this.list = document.getElementById('threat-list');
        this.wrap = document.getElementById('threat-list-wrap');
        this.search = document.getElementById('threat-search');
        this.callout = document.getElementById('threats-callout');
        this.calloutList = this.callout.querySelector('.threats-callout-names');
        this.search.addEventListener('input', () => this.filter(this.search.value));
    }

    async reset() {
        this.search.value = '';
    }

    async reload() {
        this.list.innerHTML = '';
        this.threats = (await this.pages()).sort((a, b) => new Date(b.created) - new Date(a.created));
        this.threats.forEach(threat => this.add(threat));
        this.wrap.classList.toggle('empty', this.threats.length === 0);
        this.wrap.classList.remove('no-results');
        this.hits();
    }

    async pages() {
        const all = [];
        let offset = null;

        do {
            const res = await this.api.list(offset);
            if (!res) break;

            all.push(...res.threats);
            offset = (res.page && Object.keys(res.page).length > 0) ? res.page : null;
        } while (offset);

        return all;
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

    hits() {
        const signals = Object.values(this.state.signals[this.state.account()] || {})
            .filter(s => s.source === 'threat' && s.status.startsWith("O"));

        this.callout.hidden = signals.length === 0;
        this.calloutList.innerHTML = '';

        signals.forEach(signal => {
            const row = document.createElement('div');
            row.className = 'threats-callout-hit';

            const name = document.createElement('span');
            name.className = 'threats-callout-hit-name';
            name.textContent = signal.name;
            name.title = signal.name;

            const arrow = document.createElement('button');
            arrow.type = 'button';
            arrow.className = 'threats-callout-hit-arrow material-symbols-outlined';
            arrow.textContent = 'chevron_right';
            arrow.setAttribute('aria-label', `Open ${signal.name}`);
            arrow.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openSignal(signal);
            });

            row.append(name, arrow);
            this.calloutList.appendChild(row);
        });
    }

    async openSignal(signal) {
        await SiteSpinner.withLoading(async () => {
            Workspace.sidebars.signal.reset();
            Workspace.sidebars.signal.inject(signal, await this.state.api.signals.get(signal.id));
            document.getElementById('signal-sidebar').show();
        });
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