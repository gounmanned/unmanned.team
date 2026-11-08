class DotRollup {
    static platforms = ['windows', 'mac'];

    static STATUS = {
        T0: { tone: 'ok', label: 'Success', icon: 'check' },
        PENDING: { tone: 'pending', label: 'Pending', icon: 'pending' },
        FAILED: { tone: 'bad', label: 'Failed', icon: 'close' },
    };

    static status(s) {
        return DotRollup.STATUS[s] ?? DotRollup.STATUS.FAILED;
    }

    constructor(state) {
        this.api = state.api;
        this.screen = document.getElementById('dot-screen');
        this.shelf = document.getElementById('dot-shelf');
        this.list = document.getElementById('dot-list');
        this.wrap = this.list.parentElement;
        this.mid = document.getElementById('dot-mid');
        this.search = document.getElementById('dot-search-input');
        this.bannerCount = document.getElementById('dot-banner-count');
        this.terminal = this._append('dot-term');
        this.toast = this._append('dot-toast');

        this.dots = new Map();
        this.packs = new Map();
        this.packOf = new Map();
        this.selected = null;       // asset key
        this.sorted = [];           // its actions, newest first
        this.selectedKey = null;    // action shown in the terminal

        this.search.addEventListener('input', () => this._filter());

        this.list.addEventListener('click', (e) => {
            const li = e.target.closest('.dot-item');
            if (li) this._select(li.dataset.key);
        });

        this.mid.addEventListener('click', (e) => {
            const act = e.target.closest('[data-act]')?.dataset.act;
            const key = e.target.closest('.dot-action-item')?.dataset.key;
            if (act === 'invite') return this._invite();
            if (act === 'key') return this._copyKey();
            if (act === 'delete') return this._deleteAsset();
            if (act === 'rerun') return this._rerun(key);
            if (!key) return;
            if (key === this.selectedKey) this._closeTerminal();
            else this._openAction(key);
        });

        this.terminal.addEventListener('click', (e) => {
            if (e.target.closest('[data-act="close"]')) this._closeTerminal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this._closeTerminal();
        });

        this._initShelf();
        this._listenForDrops();
        this._empty();
    }

    _append(className) {
        const el = document.createElement('div');
        el.className = className;
        this.screen.append(el);
        return el;
    }

    // --- running -----------------------------------------------------------

    async _queue(actions, message) {
        await SiteSpinner.withLoading(() => Promise.all(
            actions.map(({ id, name }) => this.api.inventory.run(this.selected, { id, name }))
        ));
        this._toast(message);
        await this.refresh();
    }

    _rerun(key) {
        const action = this.sorted.find(a => a.key === key);
        this._queue([action], `${action.name} queued`);
    }

    _runPack(pack) {
        const actions = this.packs.get(pack);
        this._queue(actions, `${pack} queued · ${actions.length} action${actions.length === 1 ? '' : 's'}`);
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
        this.packOf = new Map([...this.packs].flatMap(([name, actions]) => actions.map(a => [String(a.id), name])));
        this._renderShelf();
        if (this.sorted.length) this._renderActions(this.dots.get(this.selected), this.sorted);
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

    // --- dots list ---------------------------------------------------------

    async reload() {
        this._clearSelection();
        this._loadPacks();
        await this._load();
    }

    reset() {
        this._clearSelection();
        this.dots.clear();
        this.packs.clear();
        this.packOf.clear();
        this.list.innerHTML = '';
        this.shelf.innerHTML = '';
        this.search.value = '';
        this.bannerCount.innerHTML = SiteSpinner.inline;
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
        this._closeTerminal();
        this._empty();
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
                        Missing dot
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
                ${mark}
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

    // --- selected dot ------------------------------------------------------

    _select(key) {
        this.selected = key;
        this.list.querySelectorAll('.dot-item').forEach(li => li.classList.toggle('selected', li.dataset.key === key));
        this._closeTerminal();
        this._loadActions(this.dots.get(key));
    }

    async _loadActions(asset, quiet = false) {
        if (!quiet) this.mid.innerHTML = '<site-spinner cover></site-spinner>';
        const actions = await this.api.inventory.get(asset.key) ?? [];
        if (this.selected !== asset.key) return;   // they switched dots mid-fetch
        this._renderActions(asset, actions);
    }

    _copyKey() {
        navigator.clipboard.writeText(this.dots.get(this.selected).token).then(() => this._toast('Dot key copied'));
    }

    async _invite() {
        const asset = this.dots.get(this.selected);
        await SiteSpinner.withLoading(() => this.api.inventory.invite(asset));
        this._toast(`Invitation sent to ${asset.name}`);
    }

    async _deleteAsset() {
        await SiteSpinner.withLoading(() => this.api.inventory.delete(this.selected));
        this.dots.delete(this.selected);
        this._clearSelection();
        this._renderList();
    }

    _toast(message) {
        this.toast.textContent = message;
        this.toast.classList.add('dot-toast--show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => this.toast.classList.remove('dot-toast--show'), 2000);
    }

    _renderActions(asset, actions) {
        this.sorted = [...actions].sort((a, b) => b.created.localeCompare(a.created));

        const list = this.sorted.length
            ? `<ul class="dot-actions">${this.sorted.map(a => this._actionRow(a)).join('')}</ul>`
            : this._placeholder('drag_pan', 'No actions yet', 'Drag an action pack here to run it.', 'dot-empty--overlay');

        this.mid.innerHTML = this._actionsHeader(asset) + list;

        // keep an open terminal in sync after a refresh
        if (this.selectedKey != null) this._openAction(this.selectedKey);
    }

    _actionRow(action) {
        const { tone, label, icon } = DotRollup.status(action.status);
        const pack = this.packOf.get(String(action.id));
        return `
            <li class="dot-action-item dot-action-item--${tone}" data-key="${action.key}">
                <span class="dot-action-status material-symbols-outlined" title="${label}">${icon}</span>
                <span class="dot-action-name">
                    <span class="dot-action-label">${action.name}</span>
                    <span class="dot-action-id">${action.id}</span>
                    ${pack ? `<span class="dot-action-pack">${pack}</span>` : ''}
                </span>
                <span class="dot-action-time">${this._clock(action.created)}</span>
                ${this._iconBtn('rerun', 'replay', 'Rerun')}
            </li>
        `;
    }

    _actionsHeader(asset) {
        const total = this.sorted.length;
        const rate = total && Math.round(this.sorted.filter(a => a.status === 'T0').length / total * 100);
        const { runtime } = asset.metadata;

        return `
            <div class="dot-mid-header">
                <span class="dot-mid-logo" title="${runtime ?? ''}">${runtime ? `<img src="static/img/runtime/${runtime}.png" alt="">` : ''}</span>
                <span class="dot-mid-name">${asset.name}</span>
                ${this._metadata(asset.metadata)}
                <div class="dot-mid-stat">
                    <span class="dot-mid-stat-value">${total}</span>
                    ${total ? `<span class="dot-mid-stat-label">${rate}% success</span>` : ''}
                </div>
                <span class="dot-mid-divider"></span>
                ${this._iconBtn('invite', 'mail', 'Send invite')}
                ${this._iconBtn('key', 'key', 'Copy key')}
                ${this._iconBtn('delete', 'delete', 'Delete asset', 'dot-icon-btn--danger')}
            </div>
        `;
    }

    _metadata(meta) {
        const entries = Object.entries(meta ?? {});
        if (!entries.length) return `<span class="dot-meta-icon empty material-symbols-outlined">data_object</span>`;

        return `
            <span class="dot-meta-hover">
                <span class="dot-meta-icon material-symbols-outlined">data_object</span>
                <dl class="dot-meta-tooltip">
                    ${entries.map(([k, v]) => `<dt>${Workspace.esc(k)}</dt><dd>${Workspace.esc(v)}</dd>`).join('')}
                </dl>
            </span>`;
    }

    _iconBtn(act, icon, title, cls = '') {
        return `
            <button type="button" class="dot-icon-btn ${cls}" data-act="${act}" title="${title}">
                <span class="material-symbols-outlined">${icon}</span>
            </button>`;
    }

    // --- terminal ----------------------------------------------------------

    _openAction(key) {
        const action = this.sorted.find(a => a.key === key);
        if (!action) return this._closeTerminal();

        this.selectedKey = key;
        this._markAction(key);
        this._renderTerminal(action);
        this.screen.classList.add('term-open');
    }

    _closeTerminal() {
        this.selectedKey = null;
        this._markAction(null);
        this.screen.classList.remove('term-open');
    }

    _markAction(key) {
        this.mid.querySelectorAll('.dot-action-item').forEach(li => li.classList.toggle('selected', li.dataset.key === key));
    }

    _renderTerminal(action) {
        const { tone, label } = DotRollup.status(action.status);
        const host = this.dots.get(this.selected)?.name ?? this.selected;
        const output = this._outputText(action);

        const result = tone === 'pending'
            ? `<p class="dot-term-muted"><span class="dot-term-mark"></span>running…</p>`
            : `${output.trim()
                    ? `<pre class="dot-term-output">${Workspace.esc(output)}</pre>`
                    : `<p class="dot-term-muted">(no output)</p>`}
               <p class="dot-term-muted"><span class="dot-term-mark"></span>process exited — ${label}</p>`;

        this.terminal.className = `dot-term dot-term--${tone}`;
        this.terminal.innerHTML = `
            <header class="dot-term-bar">
                <span class="material-symbols-outlined dot-term-icon">terminal</span>
                <span class="dot-term-title">${host}</span>
                <span class="dot-term-time">${this._clock(action.created)}</span>
                ${this._iconBtn('close', 'close', 'Close (Esc)')}
            </header>
            <div class="dot-term-body">
                <p><span class="dot-term-prompt">${host} ~ $</span> <b>${action.name}</b> <span class="dot-term-muted">${action.id}</span></p>
                ${result}
            </div>
        `;
    }

    _outputText(action) {
        if (!action.value) return '';
        try {
            return new TextDecoder().decode(Uint8Array.from(action.value, c => c.charCodeAt(0)));
        } catch {
            return '';
        }
    }

    // --- empty states ------------------------------------------------------

    _empty() {
        this.mid.innerHTML = this._placeholder('adjust', 'Select a dot', 'Pick an asset on the left to see its actions.');
    }

    _placeholder(icon, label, hint, cls = '') {
        return `
            <div class="dot-empty ${cls}">
                <span class="dot-empty-icon material-symbols-outlined">${icon}</span>
                <span class="dot-empty-label">${label}</span>
                <span class="dot-empty-hint">${hint}</span>
            </div>
        `;
    }

    // --- drop --------------------------------------------------------------

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

    // --- time --------------------------------------------------------------

    _ago(ts) {
        const minutes = Math.round((Date.now() - new Date(ts)) / 60000);
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
        return `${Math.round(minutes / 1440)}d ago`;
    }

    static isActive(ts) {
        return Date.now() - new Date(ts) < 15 * 60000;
    }

    _clock(ts) {
        return new Date(ts).toLocaleString([], {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
    }
}