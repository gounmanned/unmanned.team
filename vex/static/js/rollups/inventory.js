class InventoryRollup {
    static PLATFORMS = ['chrome', 'mac', 'windows', 'ps1', 'sh'];

    static idOf(a) { return String(a.id ?? a.name); }
    static isActive(a) { return a.status.startsWith('A'); }
    static isOpen(s) { return s.status.startsWith('O'); }
    static date(d) { return d ? new Date(d).toLocaleDateString() : '—'; }

    static platformIcon(p) {
        const value = p?.toLowerCase();
        return InventoryRollup.PLATFORMS.find(name => value?.includes(name));
    }

    static esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
    }

    constructor(state) {
        this.state = state;
        this.api = state.api.inventory;

        this.tbody = document.querySelector('#asset-table tbody');
        this.search = document.getElementById('asset-search');
        this.count = document.getElementById('inv-identity-count');
        this.countNote = document.getElementById('inv-identity-note');

        this.assets = [];
        this.query = '';
        this.expandedId = null;
        this.signalsByAsset = new Map();
        this.listen();
    }

    reset() {
        this.assets = [];
        this.query = '';
        this.expandedId = null;
        this.signalsByAsset.clear();
        this.search.value = '';
        this.render();
    }

    async reload() {
        const assets = await this.api.list();
        this.assets = assets.map(a => ({ ...a, metadata: { ...a.metadata } }));
        this.signalsByAsset.clear();
        this.render();
    }

    find(id) {
        return this.assets.find(a => InventoryRollup.idOf(a) === id);
    }

    // ---- rendering ----

    render() {
        this.renderCount();
        this.renderRows();
    }

    renderCount() {
        const total = this.assets.length;
        const disabled = this.assets.filter(a => !InventoryRollup.isActive(a)).length;
        this.count.textContent = total;
        this.countNote.textContent = disabled ? `${total - disabled} active · ${disabled} disabled` : 'All active';
    }

    openSignalCounts() {
        const counts = {};
        Object.values(this.state.signals?.[this.state.account()] ?? {})
            .filter(InventoryRollup.isOpen)
            .forEach(s => { counts[s.asset] = (counts[s.asset] || 0) + 1; });
        return counts;
    }

    renderRows() {
        const rows = this.assets.filter(a =>
            `${a.name} ${a.source} ${a.metadata.platform ?? ''}`.toLowerCase().includes(this.query));

        if (!rows.length) {
            this.tbody.innerHTML = `<tr class="inv-empty"><td colspan="8">No identities match</td></tr>`;
            return;
        }

        const openSignals = this.openSignalCounts();

        this.tbody.innerHTML = rows.map(a => {
            const expanded = InventoryRollup.idOf(a) === this.expandedId;
            return this.rowHtml(a, openSignals[a.name] || 0, expanded) + (expanded ? this.signalRowsHtml(a) : '');
        }).join('');
    }

    rowHtml(a, openCount, expanded) {
        const { esc, platformIcon, idOf, isActive, date } = InventoryRollup;
        const active = isActive(a);
        const { platform, priority } = a.metadata;
        const icon = platformIcon(platform);
        const classes = [!active && 'is-locked', expanded && 'is-expanded'].filter(Boolean).join(' ');

        return `
            <tr data-id="${esc(idOf(a))}" class="${classes}">
                <td>
                    <button type="button" class="row-btn" data-action="status" title="${active ? 'Lock' : 'Unlock'}">
                        <span class="material-symbols-outlined">${active ? 'pause_circle' : 'lock'}</span>
                    </button>
                </td>
                <td>
                    <button type="button" class="row-btn ${priority === '1' ? 'is-on' : ''}" data-action="priority" title="Priority">
                        <span class="material-symbols-outlined">star</span>
                    </button>
                </td>
                <td class="identity-name">${esc(a.name)}</td>
                <td><img class="inv-logo" src="static/img/source/${esc(a.source)}.png" alt="" title="${esc(a.source)}"></td>
                <td>${icon ? `<img class="inv-logo" src="static/img/platform/${icon}.png" alt="" title="${esc(platform)}">` : '—'}</td>
                <td>${openCount ? `<span class="signal-pill">${openCount}</span>` : '<span class="inv-muted">0</span>'}</td>
                <td>${date(a.updated)}</td>
                <td><span class="material-symbols-outlined inv-chevron">expand_more</span></td>
            </tr>
        `;
    }

    signalRowsHtml(a) {
        const { esc, isOpen, date } = InventoryRollup;
        const signals = this.signalsByAsset.get(a.name);

        if (!signals?.length) {
            return `
                <tr class="signal-row">
                    <td colspan="2"></td>
                    <td colspan="6"><span class="branch"></span>${signals ? 'No signals for this identity' : 'Loading signals…'}</td>
                </tr>
            `;
        }

        return [...signals]
            .sort((x, y) => (isOpen(y) - isOpen(x)) || (new Date(y.created) - new Date(x.created)))
            .map(s => {
                const open = isOpen(s);
                return `
                    <tr class="signal-row ${open ? 'is-open' : ''}">
                        <td colspan="2"></td>
                        <td colspan="3"><span class="branch"></span><span class="signal-dot"></span>${esc(s.name ?? s.id)}</td>
                        <td class="signal-status">${open ? 'Open' : 'Closed'}</td>
                        <td>${date(s.created)}</td>
                        <td></td>
                    </tr>
                `;
            }).join('');
    }

    // ---- events ----

    listen() {
        this.search.addEventListener('input', ev => {
            this.query = ev.target.value.trim().toLowerCase();
            this.renderRows();
        });

        this.tbody.addEventListener('click', ev => {
            const row = ev.target.closest('tr[data-id]');
            if (!row) return;

            const asset = this.find(row.dataset.id);
            switch (ev.target.closest('[data-action]')?.dataset.action) {
                case 'status':   return this.toggleStatus(asset);
                case 'priority': return this.togglePriority(asset);
                default:         return this.toggleExpanded(asset);
            }
        });
    }

    // ---- actions ----

    update(asset, metadata, status) {
        SiteSpinner.withLoading(async () => {
            await this.api.update(InventoryRollup.idOf(asset), metadata, status);
            Object.assign(asset.metadata, metadata);
            if (status) asset.status = status;
            this.render();
        });
    }

    togglePriority(asset) {
        this.update(asset, { priority: asset.metadata.priority === '1' ? '' : '1' });
    }

    toggleStatus(asset) {
        const lock = InventoryRollup.isActive(asset);
        if (!window.confirm(`Are you sure you want to ${lock ? 'lock' : 'unlock'} "${asset.name}"?`)) return;
        this.update(asset, {}, lock ? 'X0' : 'A0');
    }

    async toggleExpanded(asset) {
        const id = InventoryRollup.idOf(asset);
        this.expandedId = this.expandedId === id ? null : id;
        this.renderRows();

        if (this.expandedId && !this.signalsByAsset.has(asset.name)) {
            this.signalsByAsset.set(asset.name, await this.api.get(asset.name) || []);
            this.renderRows();
        }
    }
}