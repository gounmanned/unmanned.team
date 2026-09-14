class InventoryRollup {
    static PALETTE = ['#e01280', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2'];

    constructor(state) {
        this.state = state;
        this.api = state.api.inventory;
        this.wrap = document.getElementById('asset-table-wrap');
        this.tbody = document.querySelector('#asset-table tbody');
        this.search = document.getElementById('asset-search');
        this.legend = document.getElementById('asset-legend');

        this.assets = [];
        this.query = '';

        this.listen();
    }

    async reset() {
        this.assets = [];
        this.query = '';
        this.search.value = '';

        this.tbody.innerHTML = '';
        this.wrap.classList.add('empty');
        document.getElementById('asset-empty-label').textContent = 'No assets';
        if (this.legend) this.legend.innerHTML = '';
    }

    async reload() {
        const raw = await this.api.list();
        this.assets = raw.map(a => ({ ...a, type: a.metadata?.group || 'other' }));
        this.render();
    }

    render() {
        const q = this.query;
        const rows = this.assets.filter(a => {
            if (!q) return true;
            return a.name.toLowerCase().includes(q)
                || (a.source || '').toLowerCase().includes(q)
                || a.type.toLowerCase().includes(q);
        });

        const open = Object.values(this.state.signals?.[this.state.account()] ?? {}).filter(s => s.status.startsWith('O'));
        const withSignals = rows.map(a => ({ ...a, signals: open.filter(s => s.asset == a.name).length }));

        this.wrap.classList.toggle('empty', withSignals.length === 0);
        document.getElementById('asset-empty-label').textContent = q
            ? `No assets match "${q}"`
            : 'No assets';

        if (this.legend) this.legend.innerHTML = this.renderLegend();

        this.tbody.innerHTML = withSignals.map(a => `
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
                    ${a.metadata?.platform ? `<img src="static/img/platform/${a.metadata.platform}.png" title="${a.metadata.platform}">` : '—'}
                </td>
                <td class="asset-group"><span class="group-badge">${a.type}</span></td>
                <td class="asset-value">${a.name}</td>
                <td class="asset-signals">${a.signals}</td>
                <td class="asset-seen">${a.updated ? new Date(a.updated).toLocaleDateString() : '—'}</td>
            </tr>
        `).join('');
    }

    renderLegend() {
        const counts = {};
        this.assets.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });

        const groups = Object.keys(counts).sort((a, b) =>
            a === 'other' ? 1 : b === 'other' ? -1 : a.localeCompare(b)
        );

        const total = this.assets.length;
        const totalChip = `<span class="legend-chip legend-total">${total} asset${total === 1 ? '' : 's'}</span>`;

        const groupChips = groups.map((g, i) => {
            const color = InventoryRollup.PALETTE[i % InventoryRollup.PALETTE.length];
            return `
                <span class="legend-chip">
                    <span class="legend-dot" style="background:${color}"></span>
                    ${g}
                    <span class="legend-count">${counts[g]}</span>
                </span>
            `;
        }).join('');

        return totalChip + groupChips;
    }

    listen() {
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
            await this.api.update(id, { priority: next ? '1' : '' });
            star.classList.toggle('active', next);
            const asset = this.assets.find(a => (a.id ?? a.name) == id);
            if (asset?.metadata) asset.metadata.priority = next ? '1' : '0';
        });

        return true;
    }
}