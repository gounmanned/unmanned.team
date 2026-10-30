class DotRollup {
    static platforms = ['windows', 'mac'];

    constructor(state) {
        this.api = state.api;
        this.shelf = document.getElementById('dot-shelf');
        this.list = document.getElementById('dot-list');
        this.wrap = this.list.parentElement;
        this.mid = document.getElementById('dot-mid');
        this.right = document.getElementById('dot-right');
        this.search = document.getElementById('dot-search-input');
        this.bannerCount = document.getElementById('dot-banner-count');
        this.dots = new Map();
        this.packs = new Map();
        this.selected = null;
        this.sorted = [];
        this.selectedKey = null;

        this.search.addEventListener('input', () => this._filter());
        this.mid.addEventListener('click', (e) => {
            if (e.target.closest('.dot-mid-delete')) return this._deleteAsset();
            if (e.target.closest('.dot-mid-key')) return this._copyKey();
            const li = e.target.closest('.dot-action-item');
            if (li) this._selectAction(li.dataset.key);
        });
        this.list.addEventListener('click', (e) => {
            const li = e.target.closest('.dot-item');
            if (li) this._select(li.dataset.key);
        });
        this._initShelf();
        this._listenForDrops();
    }

    // --- action packs ------------------------------------------------------

    _initShelf() {
        this.shelf.insertAdjacentHTML('beforebegin', `
            <div class="dot-shelf-head">
                <span class="dot-shelf-title">Action packs</span>
                <span class="dot-shelf-hint">
                    <span class="material-symbols-outlined">drag_pan</span>
                    Drag onto a selected dot to run
                </span>
            </div>
        `);

        this.shelf.addEventListener('dragstart', (e) => {
            const card = e.target.closest('.dot-pack');
            e.dataTransfer.setData('application/x-dot-pack', card.dataset.pack);
            e.dataTransfer.effectAllowed = 'copy';
            card.classList.add('dragging');
            if (this.selected) this.mid.classList.add('drop-ready');
            else this._toast('Select a dot first, then drop the pack on it');
        });

        this.shelf.addEventListener('dragend', (e) => {
            e.target.closest('.dot-pack').classList.remove('dragging');
            this.mid.classList.remove('drop-ready');
        });
    }

    async _loadPacks() {
        const packs = await this.api.action.list();
        this.packs = new Map(Object.entries(packs));
        this._renderShelf();
    }

    _renderShelf() {
        this.shelf.innerHTML = [...this.packs].map(([name, actions]) => `
            <li class="dot-pack" draggable="true" data-pack="${name}" title="${name} · ${actions.map(a => a.name).join(', ')}">
                <span class="dot-pack-logo">
                    <img src="static/img/packs/${name.toLowerCase()}.png" alt="">
                    <span class="dot-pack-count">${actions.length}</span>
                </span>
                <span class="dot-pack-name">${name}</span>
            </li>
        `).join('');
    }

    async _runPack(pack) {
        const actions = this.packs.get(pack);
        await SiteSpinner.withLoading(() => Promise.all(
            actions.map(({ id, name }) => this.api.inventory.run(this.selected, { id, name }))
        ));
        this._toast(`${pack} queued · ${actions.length} action${actions.length === 1 ? '' : 's'}`);
        await this.refresh();
    }

    // --- dots list ---------------------------------------------------------

    async reload() {
        this._clearSelection();
        this._loadPacks();
        this.wrap.classList.add('loading');
        await this._load();
        this.wrap.classList.remove('loading');
    }

    reset() {
        this._clearSelection();
        this.dots.clear();
        this.packs.clear();
        this.list.innerHTML = '';
        this.shelf.innerHTML = '';
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
        this.dots = new Map(assets.map(a => [a.key, a]));
        this._renderList();
    }

    _clearSelection() {
        this.selected = null;
        this.sorted = [];
        this.selectedKey = null;
        this._watermark();
    }

    _renderList() {
        const rows = [...this.dots.values()];
        const dotted = rows.filter(a => a.metadata.runtime).sort(DotRollup.byActivity);
        const undotted = rows.filter(a => !a.metadata.runtime).sort(DotRollup.byName);
        const open = this.list.querySelector('.dot-group details')?.open ?? false;

        this.list.innerHTML = dotted.map(a => this._row(a)).join('')
            + (undotted.length ? this._group(undotted, open) : '');
        if (this.selected) this.list.querySelector(`[data-key="${this.selected}"]`)?.classList.add('selected');
        this._filter();

        this.bannerCount.innerHTML = `${dotted.length.toLocaleString()}<span class="dot-banner-stat-total"> / ${rows.length.toLocaleString()}</span>`;
    }

    _group(assets, open) {
        return `
            <li class="dot-group">
                <details ${open ? 'open' : ''}>
                    <summary class="dot-group-toggle">
                        <span class="dot-group-chevron material-symbols-outlined">chevron_right</span>
                        <span class="dot-group-label">Missing dot</span>
                        <span class="dot-group-count">${assets.length}</span>
                    </summary>
                    <ul class="dot-group-list">
                        ${assets.map(a => this._row(a)).join('')}
                    </ul>
                </details>
            </li>
        `;
    }

    _row(asset) {
        const { runtime } = asset.metadata;
        const mark = runtime
            ? `<span class="dot-item-status dot-item-status--${DotRollup.isActive(asset.updated) ? 'active' : 'inactive'}" title="${runtime}"></span>`
            : `<span class="dot-item-nodot material-symbols-outlined">radio_button_unchecked</span>`;
        return `
            <li class="dot-item ${runtime ? '' : 'no-dot'}" data-key="${asset.key}">
                <span class="dot-item-mark">${mark}</span>
                <span class="dot-item-name">${asset.name}</span>
                <span class="dot-item-seen">${runtime ? this._ago(asset.updated) : 'No dot'}</span>
            </li>
        `;
    }

    static byName(a, b) {
        return a.name.localeCompare(b.name);
    }

    static byActivity(a, b) {
        return DotRollup.isActive(b.updated) - DotRollup.isActive(a.updated) || DotRollup.byName(a, b);
    }

    _filter() {
        const q = this.search.value.trim().toLowerCase();
        let visible = 0;
        for (const li of this.list.querySelectorAll('.dot-item')) {
            li.hidden = !JSON.stringify(this.dots.get(li.dataset.key)).toLowerCase().includes(q);
            if (!li.hidden) visible++;
        }
        this.wrap.classList.toggle('no-match', !visible && this.dots.size > 0);

        const group = this.list.querySelector('.dot-group');
        if (!group) return;
        const shown = group.querySelectorAll('.dot-item:not([hidden])').length;
        group.hidden = !shown;
        group.querySelector('.dot-group-count').textContent = shown;
    }

    // --- selection ---------------------------------------------------------

    _select(key) {
        this.selected = key;
        for (const li of this.list.querySelectorAll('.dot-item')) li.classList.toggle('selected', li.dataset.key === key);

        this._clearOutput();
        this._loadActions(this.dots.get(key));
    }

    async _loadActions(asset, quiet = false) {
        if (!quiet) this.mid.innerHTML = '<div class="dot-col-body loading"></div>';
        const actions = await this.api.inventory.get(asset.key) ?? [];
        if (this.selected !== asset.key) return;   // they switched dots mid-fetch
        this._renderActions(asset, actions);
    }

    _copyKey() {
        navigator.clipboard.writeText(Workspace.encode(this.selected))
            .then(() => this._toast('Key copied to clipboard'));
    }

    _toast(message) {
        let toast = document.getElementById('dot-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'dot-toast';
            toast.className = 'dot-toast';
            document.getElementById('dot-screen').appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('dot-toast--show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => toast.classList.remove('dot-toast--show'), 2000);
    }

    async _deleteAsset() {
        const asset = this.dots.get(this.selected);
        await SiteSpinner.withLoading(() => this.api.inventory.delete(this.selected));
        this.dots.delete(this.selected);
        this._clearSelection();
        this._renderList();
    }

    _renderActions(asset, actions) {
        this.sorted = [...actions].sort((a, b) => b.created.localeCompare(a.created));

        const list = this.sorted.length ? `
            <div class="dot-col-body dot-col-body--scroll">
                <ul class="dot-action-list">
                    ${this.sorted.map(a => this._actionRow(a)).join('')}
                </ul>
            </div>
        ` : this._placeholder('dot-empty dot-empty--overlay', 'Drop an action pack here');

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
        const { runtime } = asset.metadata;

        const logo = runtime
            ? `<span class="dot-mid-logo" title="${runtime}"><img src="static/img/runtime/${runtime}.png" alt=""></span>`
            : `<span class="dot-mid-logo dot-mid-logo--empty"></span>`;

        return `
            <div class="dot-mid-header">
                ${logo}
                <div class="dot-mid-meta">
                    <span class="dot-mid-name">${asset.name}</span>
                    ${this._metadata(asset.metadata)}
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
                <span class="dot-mid-divider"></span>
                <button type="button" class="dot-mid-key" title="Copy key" aria-label="Copy key">
                    <span class="material-symbols-outlined">key</span>
                </button>
                <button type="button" class="dot-mid-delete" title="Delete asset" aria-label="Delete asset">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        `;
    }

    _metadata(meta) {
        const entries = Object.entries(meta ?? {});
        if (!entries.length) {
            return `<span class="dot-meta-icon empty material-symbols-outlined">data_object</span>`;
        }

        return `
            <span class="dot-meta-hover">
                <span class="dot-meta-icon material-symbols-outlined">data_object</span>
                <dl class="dot-meta-tooltip">
                    ${entries.map(([k, v]) => `<dt>${Workspace.esc(k)}</dt><dd>${Workspace.esc(v)}</dd>`).join('')}
                </dl>
            </span>`;
    }

    _statusInfo(s) {
        if (s === 'T0') return { tone: 'ok', label: 'Success', icon: 'check' };
        if (s === 'PENDING') return { tone: 'pending', label: 'Pending', icon: 'pending' };
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
        const prompt = this.dots.get(this.selected)?.name ?? this.selected;

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
                        <span class="dot-terminal-prompt">${prompt} ~ $</span>
                        <span class="dot-terminal-cmd">${action.name}<span class="dot-terminal-cmd-id">${action.id}</span></span>
                    </p>
                    ${body}
                </div>
            </div>
        `;
    }

    _clearOutput() {
        this.selectedKey = null;
        this.right.innerHTML = this._placeholder('dot-watermark', 'Select action');
    }

    _outputText(action) {
        if (!action.value) return '';
        try {
            const bytes = Uint8Array.from(action.value, c => c.charCodeAt(0));
            return new TextDecoder().decode(bytes);
        } catch {
            return '';
        }
    }

    _escape(s) {
        return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    }

    _watermark() {
        this.mid.innerHTML = this._placeholder('dot-watermark', 'Actions');
        this.right.innerHTML = this._placeholder('dot-watermark', 'Response');
    }

    // --- drop ------------------------------------------------------------

    _listenForDrops() {
        this.mid.addEventListener('dragover', (e) => {
            if (!this.selected) return;
            e.preventDefault();
            this.mid.classList.add('drop-active');
        });

        this.mid.addEventListener('dragleave', (e) => {
            if (!this.mid.contains(e.relatedTarget)) this.mid.classList.remove('drop-active');
        });

        this.mid.addEventListener('drop', (e) => {
            e.preventDefault();
            this.mid.classList.remove('drop-active', 'drop-ready');
            const pack = e.dataTransfer.getData('application/x-dot-pack');
            if (pack) return this._runPack(pack);
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

            await this.api.inventory.run(this.selected, { id, name });
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

    static isActive(ts) {
        return Date.now() - new Date(ts) < 5 * 60000;
    }

    _clock(ts) {
        return new Date(ts).toLocaleString([], {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
    }

    _placeholder(cls, text) {
        return `
            <div class="${cls}">
                <div class="dot-watermark-line">
                    <span class="dot-watermark-label">${text}</span>
                </div>
            </div>
        `;
    }
}