class DotRollup {
    constructor(state) {
        this.api = state.api;
        this.list = document.getElementById('dot-list');
        this.wrap = this.list.parentElement;
        this.mid = document.getElementById('dot-mid');
        this.right = document.getElementById('dot-right');
        this.search = document.getElementById('dot-search-input');
        this.bannerCount = document.getElementById('dot-banner-count');
        this.dots = new Map();
        this.selected = null;
        this.sorted = [];
        this.selectedKey = null;

        this.search.addEventListener('input', () => this._filter());
        this.mid.addEventListener('click', (e) => {
            const li = e.target.closest('.dot-action-item');
            if (li) this._selectAction(li.dataset.key);
        });
        this.list.addEventListener('click', (e) => {
            const li = e.target.closest('.dot-item');
            if (li) this._select(li.dataset.name);
        });
        this._listenForDrops();
    }

    // --- dots list ---------------------------------------------------------

    async reload() {
        this._clearSelection();
        this.wrap.classList.add('loading');
        await this._load();
        this.wrap.classList.remove('loading');
    }

    reset() {
        this._clearSelection();
        this.dots.clear();
        this.list.innerHTML = '';
        this.search.value = '';
        this.bannerCount.textContent = '—';
    }

    async refresh() {
        await this._load();
        if (this.dots.has(this.selected)) this._loadActions(this.dots.get(this.selected), true);
        else this._clearSelection();
    }

    async _load() {
        const assets = await this.api.inventory.list();
        this.dots = new Map(assets.map(a => [a.name, a]));
        this._renderList();
    }

    _clearSelection() {
        this.selected = null;
        this.sorted = [];
        this.selectedKey = null;
        this._watermark();
    }

    _renderList() {
        const rows = [...this.dots.values()].sort(DotRollup.byDot);
        this.list.innerHTML = rows.map(a => this._row(a)).join('');
        if (this.selected) this.list.querySelector(`[data-name="${this.selected}"]`)?.classList.add('selected');
        this._filter();

        const deployed = rows.filter(a => a.metadata.runtime).length;
        this.bannerCount.innerHTML = `${deployed.toLocaleString()}<span class="dot-banner-stat-total"> / ${rows.length.toLocaleString()}</span>`;
    }

    _row(asset) {
        const { runtime } = asset.metadata;
        const mark = runtime
            ? `<span class="dot-item-status dot-item-status--${this._freshness(asset.updated)}" title="${runtime}"></span>`
            : `<span class="dot-item-nodot material-symbols-outlined">radio_button_unchecked</span>`;
        const source = asset.source
            ? `<img class="dot-item-source" src="static/img/source/${asset.source}.png" alt="" title="${asset.source}">`
            : '';

        return `
            <li class="dot-item ${runtime ? '' : 'no-dot'}" data-name="${asset.name}">
                <span class="dot-item-mark">${mark}${source}</span>
                <span class="dot-item-name">${asset.name}</span>
                <span class="dot-item-seen">${runtime ? this._ago(asset.updated) : 'No dot'}</span>
            </li>
        `;
    }

    static byDot(a, b) {
        return !!a.metadata.runtime - !!b.metadata.runtime || a.name.localeCompare(b.name);
    }

    _filter() {
        const q = this.search.value.trim().toLowerCase();
        let visible = 0;
        for (const li of this.list.children) {
            li.hidden = !li.dataset.name.toLowerCase().includes(q);
            if (!li.hidden) visible++;
        }
        this.wrap.classList.toggle('no-match', !visible && this.dots.size > 0);
    }

    // --- selection ---------------------------------------------------------

    _select(name) {
        this.selected = name;
        for (const li of this.list.children) li.classList.toggle('selected', li.dataset.name === name);

        this._clearOutput();
        this._loadActions(this.dots.get(name));
    }

    async _loadActions(asset, quiet = false) {
        if (!quiet) this.mid.innerHTML = '<div class="dot-col-body loading"></div>';
        const actions = await this.api.action.get(asset.name) ?? [];
        if (this.selected !== asset.name) return;   // they switched dots mid-fetch
        this._renderActions(asset, actions);
    }

    _renderActions(asset, actions) {
        this.sorted = [...actions].sort((a, b) => b.created.localeCompare(a.created));

        const list = this.sorted.length ? `
            <div class="dot-col-body dot-col-body--scroll">
                <ul class="dot-action-list">
                    ${this.sorted.map(a => this._actionRow(a)).join('')}
                </ul>
            </div>
        ` : this._placeholder('dot-empty', 'history', 'No activity');

        this.mid.innerHTML = this._actionsHeader(asset) + list;

        if (this.selectedKey == null) return;
        if (this.sorted.some(a => a.key === this.selectedKey)) this._selectAction(this.selectedKey);
        else this._clearOutput();
    }

    _actionRow(action) {
        const { tone, label, icon } = this._statusInfo(action.status);
        return `
            <li class="dot-action-item dot-action-item--${tone}" data-key="${action.key}">
                <span class="dot-action-status material-symbols-outlined" title="${label}">${icon}</span>
                <span class="dot-action-name"><span class="dot-action-label">${action.name}</span><span class="dot-action-id">${action.id}</span></span>
                <span class="dot-action-time">${this._clock(action.created)}</span>
            </li>
        `;
    }

    _actionsHeader(asset) {
        const total = this.sorted.length;
        const success = this.sorted.filter(a => a.status === 'T0').length;
        const rate = total ? Math.round((success / total) * 100) : 0;

        return `
            <div class="dot-mid-header">
                <img class="dot-mid-logo" src="static/img/platform/${asset.metadata.platform}.png" alt="${asset.metadata.platform}">
                <div class="dot-mid-meta">
                    <span class="dot-mid-name">${asset.name}</span>
                </div>
                <div class="dot-mid-stats">
                    <div class="dot-mid-stat">
                        <span class="dot-mid-stat-value">${total}</span>
                        <span class="dot-mid-stat-label">actions</span>
                    </div>
                    <div class="dot-mid-stat">
                        <span class="dot-mid-stat-value">${rate}%</span>
                        <span class="dot-mid-stat-label">success</span>
                    </div>
                </div>
            </div>
        `;
    }

    _statusInfo(s) {
        if (s === 'T0') return { tone: 'ok', label: 'Success', icon: 'check' };
        if (s === 'T2') return { tone: 'pending', label: 'Pending', icon: 'pending' };
        return { tone: 'bad', label: 'Failed', icon: 'close' };
    }

    _selectAction(key) {
        const action = this.sorted.find(a => a.key === key);
        if (!action) return;
        this.selectedKey = key;

        this.mid.querySelectorAll('.dot-action-item').forEach(li =>
            li.classList.toggle('selected', li.dataset.key === key));

        this._renderOutput(action);
    }

    _renderOutput(action) {
        const { tone, label } = this._statusInfo(action.status);
        const output = this._outputText(action);

        const body = tone === 'pending'
            ? `<p class="dot-terminal-line dot-terminal-running"><span class="dot-terminal-spinner"></span>running…</p>`
            : `
                ${output.trim()
                    ? `<pre class="dot-terminal-output">${this._escape(output)}</pre>`
                    : `<p class="dot-terminal-line dot-terminal-muted">(no output)</p>`}
                <p class="dot-terminal-line dot-terminal-exit dot-terminal-exit--${tone}">
                    <span class="dot-terminal-exit-mark"></span>process exited — ${label}
                </p>`;

        this.right.innerHTML = `
            <div class="dot-terminal">
                <div class="dot-terminal-body dot-terminal-body--output">
                    <p class="dot-terminal-line">
                        <span class="dot-terminal-prompt">${action.asset ?? this.selected} ~ $</span>
                        <span class="dot-terminal-cmd">${action.name}<span class="dot-terminal-cmd-id">${action.id}</span></span>
                    </p>
                    ${body}
                </div>
            </div>
        `;
    }

    _clearOutput() {
        this.selectedKey = null;
        this.right.innerHTML = this._placeholder('dot-watermark', 'terminal', 'Select an action');
    }

    _outputText(action) {
        if (!action.value) return '';
        const bytes = Uint8Array.from(atob(action.value), c => c.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    }

    _escape(s) {
        return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    }

    _watermark() {
        this.mid.innerHTML = this._placeholder('dot-watermark', 'ads_click', 'View activity');
        this.right.innerHTML = this._placeholder('dot-watermark', 'terminal', 'Action output');
    }

    // --- drop ------------------------------------------------------------

    _listenForDrops() {
        this.mid.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.mid.classList.add('drop-active');
        });

        this.mid.addEventListener('dragleave', (e) => {
            if (!this.mid.contains(e.relatedTarget)) this.mid.classList.remove('drop-active');
        });

        this.mid.addEventListener('drop', (e) => {
            e.preventDefault();
            this.mid.classList.remove('drop-active');
            const file = e.dataTransfer.files[0];
            if (file) this._submitAction(file);
        });
    }

    async _submitAction(file) {
        await SiteSpinner.withLoading(async () => {
            const id = await this._hashId(file);
            const dot = file.name.lastIndexOf('.');
            const name = dot > 0 ? file.name.slice(0, dot) : file.name;
            const ext = dot > 0 ? file.name.slice(dot) : '';

            this.api.file.root = 'action';
            await this.api.file.add(new File([file], `${id}${ext}`, { type: file.type }));
            await this.api.action.add({ id, name, asset: this.selected, status: '-1' });
        });
        await this.refresh();
    }

    async _hashId(file) {
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        const hash = [...new Uint8Array(digest)].reduce((n, byte) => (n << 8n) | BigInt(byte), 0n);
        return Number(hash % 10n ** 13n);
    }

    // --- time helpers ------------------------------------------------------

    _ago(ts) {
        const minutes = Math.round((Date.now() - new Date(ts)) / 60000);
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
        return `${Math.round(minutes / 1440)}d ago`;
    }

    _freshness(ts) {
        const seen = new Date(ts);
        if (Date.now() - seen < 15 * 60000) return 'fresh';
        if (seen.toDateString() === new Date().toDateString()) return 'today';
        return 'stale';
    }

    _clock(ts) {
        return new Date(ts).toLocaleString([], {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
    }

    _placeholder(cls, icon, text) {
        return `
            <div class="${cls}">
                <span class="material-symbols-outlined">${icon}</span>
                <p>${text}</p>
            </div>
        `;
    }
}