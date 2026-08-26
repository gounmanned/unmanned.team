class InventoryRollup {
    static classify(asset) {
        const group = asset.metadata?.group;
        if (group === 'identity' || group === 'domain') return group;
        return 'other';
    }

    constructor(state) {
        this.state = state;
        this.api = state.api.inventory;
        this.wrap = document.getElementById('asset-table-wrap');
        this.tbody = document.querySelector('#asset-table tbody');
        this.toggle = document.getElementById('asset-scope-toggle');
        this.search = document.getElementById('asset-search');

        this.assets = [];
        this.scope = 'domain';
        this.query = '';
        this.labels = { domain: 'domains', identity: 'identities', other: 'assets' };
        this.listen();
    }

    async reset() {
        this.assets = [];
        this.query = '';
        this.search.value = '';
        this.render();
    }

    async reload() {
        this.assets = (await this.api.list()).map(a => ({ ...a, type: InventoryRollup.classify(a) }));
        this.render();
    }

    render() {
        Object.keys(this.labels).forEach(type => {
            const el = document.getElementById(`asset-count-${type}`);
            if (el) el.textContent = this.assets.filter(a => a.type === type).length;
        });

        const open = Object.values(this.state.signals[this.state.account()]).filter(s => s.status.startsWith('O'));

        const rows = this.assets
            .filter(a => a.type === this.scope)
            .filter(a => !this.query || a.name.toLowerCase().includes(this.query) || (a.source || '').toLowerCase().includes(this.query))
            .map(a => ({ ...a, signals: open.filter(s => s.asset == a.name).length }));

        this.wrap.classList.toggle('empty', rows.length === 0);
        document.getElementById('asset-empty-label').textContent = this.query
            ? `No ${this.labels[this.scope]} match "${this.query}"`
            : `No ${this.labels[this.scope]}`;

        this.tbody.innerHTML = rows.map(a => `
            <tr data-id="${a.id ?? a.name}" class="${a.status.startsWith('A') ? '' : 'asset-suspended'}">
                <td class="asset-status">
                    <button class="star-btn ${a.status.startsWith("A") ? '' : 'active'}" data-field="status" type="button" aria-label="Toggle status">
                        <span class="material-symbols-outlined">pause_circle</span>
                    </button>
                </td>
                <td class="asset-priority">
                    <button class="star-btn ${a.metadata?.priority === '1' ? 'active' : ''}" data-field="priority" type="button" aria-label="Toggle priority">
                        <span class="material-symbols-outlined">star</span>
                    </button>
                </td>
                <td class="asset-source"><img src="static/img/source/${a.source}.png" alt="" title="${a.source}"></td>
                <td class="asset-source">
                    ${a.metadata?.platform ? `<img src="static/img/source/${a.metadata.platform}.png" alt="" title="${a.metadata.platform}">` : '—'}
                </td>
                <td class="asset-value">${a.name}</td>
                <td class="asset-signals">${a.signals}</td>
                <td class="asset-seen">${a.updated ? new Date(a.updated).toLocaleDateString() : '—'}</td>          
            </tr>
        `).join('');
    }

    listen() {
        this.toggle.addEventListener('click', ev => {
            const btn = ev.target.closest('.scope-btn');
            if (!btn) return;

            this.scope = btn.dataset.scope;
            this.toggle.dataset.scope = this.scope;
            this.render();
        });

        this.search.addEventListener('input', ev => {
            this.query = ev.target.value.trim().toLowerCase();
            this.render();
        });

        this.tbody.addEventListener('click', ev => {
            this.handleStatusClick(ev) || this.handlePriorityClick(ev);
        });
    }

    handleStatusClick(ev) {
        const star = ev.target.closest('.star-btn[data-field="status"]');
        if (!star) return false;

        const tr = star.closest('tr');
        const id = tr.dataset.id;
        const asset = this.assets.find(a => (a.id ?? a.name) == id);
        if (!asset) return true;

        const value = asset.status.startsWith('A') ? 'X0' : 'A0';

        SiteSpinner.withLoading(async () => {
            await this.api.update(id, {}, value);
            asset.status = value;
            this.render();
        });

        return true;
    }

    handlePriorityClick(ev) {
        const star = ev.target.closest('.star-btn[data-field="priority"]');
        if (!star) return false;

        const tr = star.closest('tr');
        const id = tr.dataset.id;
        const next = !star.classList.contains('active');

        SiteSpinner.withLoading(async () => {
            await this.api.update(id, { priority: next ? '1' : '0' });
            star.classList.toggle('active', next);
            const asset = this.assets.find(a => (a.id ?? a.name) == id);
            if (asset?.metadata) asset.metadata.priority = next ? '1' : '0';
        });

        return true;
    }
}