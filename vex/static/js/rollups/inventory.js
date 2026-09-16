class InventoryRollup {
    static PALETTE = ['#e01280', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2'];

    constructor(state) {
        this.state = state;
        this.api = state.api.inventory;
        this.split = document.getElementById('asset-split');
        this.wrap = document.getElementById('asset-table-wrap');
        this.tbody = document.querySelector('#asset-table tbody');
        this.search = document.getElementById('asset-search');
        this.legend = document.getElementById('asset-legend');

        // profile popout
        this.profile = document.getElementById('asset-profile');
        this.profileAvatar = document.getElementById('asset-profile-avatar');
        this.profileName = document.getElementById('asset-profile-name');
        this.profileStatus = document.getElementById('asset-profile-status');
        this.profileUpdated = document.getElementById('asset-profile-updated');
        this.profilePlatformRow = document.getElementById('asset-profile-platform-row');
        this.profilePlatform = document.getElementById('asset-profile-platform');
        this.profileSignalList = document.getElementById('asset-profile-signal-list');

        // sets
        this.assets = [];
        this.query = '';
        this.activeAssetId = null;
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
        this.closeProfile();
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

        this.legend.innerHTML = this.renderLegend();
        this.tbody.innerHTML = withSignals.map(a => {
            return `
                <tr data-id="${a.id ?? a.name}" class="${a.status.startsWith('A') ? '' : 'asset-suspended'} ${(a.id ?? a.name) == this.activeAssetId ? 'asset-row-active' : ''}">
                    <td class="asset-status">
                        <button class="star-btn ${a.status.startsWith("A") ? '' : 'active'}" data-field="status" type="button" aria-label="Status">
                            <span class="material-symbols-outlined">pause_circle</span>
                        </button>
                    </td>
                    <td class="asset-priority">
                        <button class="star-btn ${a.metadata?.priority === '1' ? 'active' : ''}" data-field="priority" type="button" aria-label="Priority">
                            <span class="material-symbols-outlined">star</span>
                        </button>
                    </td>
                    <td class="asset-source"><img src="static/img/source/${a.source}.png" alt="" title="${a.source}"></td>
                    <td class="asset-source">
                        ${a.metadata?.platform ? `<img src="static/img/platform/${a.metadata.platform}.png" title="${a.metadata.platform}">` : '—'}
                    </td>
                    <td class="asset-group"><span class="group-badge" data-group="${a.type}">${a.type}</span></td>
                    <td class="asset-value">${a.name}</td>
                    <td class="asset-signals">${a.signals}</td>
                    <td class="asset-seen">${a.updated ? new Date(a.updated).toLocaleDateString() : '—'}</td>
                    <td class="asset-open">
                        <button class="asset-open-btn" type="button" aria-label="View asset">
                            <span class="material-symbols-outlined">arrow_forward</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
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
                <span class="legend-chip legend-chip-clickable" data-group="${g}">
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
            this.handleGroupBadgeClick(ev)
                || this.handleStatusClick(ev)
                || this.handlePriorityClick(ev)
                || this.handleRowClick(ev);
        });

        if (this.legend) {
            this.legend.addEventListener('click', ev => this.handleLegendChipClick(ev));
        }

        this.profile.querySelector('#asset-profile-close').addEventListener('click', () => this.closeProfile());
    }

    filterByGroup(group) {
        this.search.value = group;
        this.query = group.trim().toLowerCase();
        this.render();
    }

    handleLegendChipClick(ev) {
        const chip = ev.target.closest('.legend-chip[data-group]');
        if (!chip) return false;
        this.filterByGroup(chip.dataset.group);
        return true;
    }

    handleGroupBadgeClick(ev) {
        const badge = ev.target.closest('.group-badge[data-group]');
        if (!badge) return false;
        this.filterByGroup(badge.dataset.group);
        return true;
    }

    handleStatusClick(ev) {
        const star = ev.target.closest('.star-btn[data-field="status"]');
        if (!star) return false;

        const id = star.closest('tr').dataset.id;
        const asset = this.assets.find(a => (a.id ?? a.name) == id);
        if (!asset) return true;

        const value = asset.status.startsWith('A') ? 'X0' : 'A0';
        const action = value === 'X0' ? 'lock' : 'unlock';
        if (!window.confirm(`Are you sure you want to ${action} "${asset.name}"?`)) return true;

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

        const id = star.closest('tr').dataset.id;
        const next = !star.classList.contains('active');

        SiteSpinner.withLoading(async () => {
            await this.api.update(id, { priority: next ? '1' : '' });
            star.classList.toggle('active', next);
            const asset = this.assets.find(a => (a.id ?? a.name) == id);
            if (asset?.metadata) asset.metadata.priority = next ? '1' : '0';
        });
        return true;
    }

    handleRowClick(ev) {
        const tr = ev.target.closest('tr[data-id]');
        if (!tr) return false;

        const asset = this.assets.find(a => (a.id ?? a.name) == tr.dataset.id);
        if (!asset) return false;

        this.openProfile(asset);
        return true;
    }

    openProfile(asset) {
        this.activeAssetId = asset.id ?? asset.name;
        this.split.classList.add('profile-open');
        this.render();

        const active = asset.status.startsWith('A');
        this.profileAvatar.src = `static/img/source/${asset.source}.png`;
        this.profileAvatar.alt = asset.source;
        this.profileName.textContent = asset.name;
        this.profileStatus.textContent = active ? 'Active' : 'Disabled';
        this.profileStatus.classList.toggle('is-active', active);
        this.profileStatus.classList.toggle('is-disabled', !active);
        this.profileUpdated.textContent = asset.updated ? new Date(asset.updated).toLocaleDateString() : '—';

        const platform = asset.metadata?.platform;
        this.profilePlatformRow.hidden = !platform;
        if (platform) this.profilePlatform.textContent = platform;

        this.profileSignalList.innerHTML = `<div class="asset-profile-signals-empty">Loading…</div>`;
        this.api.get(asset.name).then(signals => {
            this.renderProfileSignals(signals || []);
        });
    }

    renderProfileSignals(signals) {
        if (!signals.length) {
            this.profileSignalList.innerHTML = `<div class="asset-profile-signals-empty">No signals</div>`;
            return;
        }

        const sorted = [...signals].sort((a, b) => new Date(b.created) - new Date(a.created));
        this.profileSignalList.innerHTML = sorted.map(s => {
            const isOpen = s.status.startsWith('O');
            return `
                <li class="profile-signal ${isOpen ? 'is-open' : 'is-closed'}">
                    <span class="profile-signal-dot"></span>
                    <div class="profile-signal-body">
                        <div class="profile-signal-name">${s.name ?? s.id}</div>
                        <div class="profile-signal-meta">
                            <span class="profile-signal-status">${isOpen ? 'Open' : 'Closed'}</span>
                            <span class="profile-signal-date">${s.created ? new Date(s.created).toLocaleDateString() : '—'}</span>
                        </div>
                    </div>
                </li>
            `;
        }).join('');
    }

    closeProfile() {
        this.activeAssetId = null;
        this.split.classList.remove('profile-open');
        this.tbody.querySelectorAll('tr.asset-row-active').forEach(tr => tr.classList.remove('asset-row-active'));
    }
}