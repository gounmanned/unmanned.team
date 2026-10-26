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
        this.sorted = [];                // actions in display order
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
        this.sorted = [];
        this.selected = null;
        this.selectedKey = null;
        this._watermark();

        this.wrap.classList.add('loading');
        const assets = await this.api.inventory.list();
        this.wrap.classList.remove('loading');

        this.dots = new Map(assets.map(a => [a.name, a]));
        this._renderList();
        this._loadDotStat();
    }

    reset() {
        this.list.innerHTML = '';
        this.dots.clear();
        this.sorted = [];
        this.selected = null;
        this.selectedKey = null;
        this.search.value = '';
        this.bannerCount.textContent = '—';
        this._watermark();
    }

    async refresh() {
        const assets = await this.api.inventory.list();
        this.dots = new Map(assets.map(a => [a.name, a]));
        if (!this.dots.has(this.selected)) this.selected = null;

        this._renderList();
        this._loadDotStat();

        if (this.selected) this._loadActions(this.dots.get(this.selected), true);
        else this._watermark();
    }

    _loadDotStat() {
        const total = this.dots.size;
        const deployed = [...this.dots.values()].filter(a => a.metadata.runtime).length;
        this.bannerCount.innerHTML = `${deployed.toLocaleString()}<span class="dot-banner-stat-total"> / ${total.toLocaleString()}</span>`;
    }

    _renderList() {
        const rows = [...this.dots.values()].sort(DotRollup.byDot);
        this.list.innerHTML = rows.map(a => this._row(a)).join('');
        if (this.selected) this.list.querySelector(`[data-name="${this.selected}"]`)?.classList.add('selected');
        this._filter();
    }

    _row(asset) {
        const { runtime, platform } = asset.metadata;
        const mark = runtime
            ? `<img class="dot-item-runtime" src="static/img/runtime/${runtime}.png" alt="" title="${runtime}">`
            : `<span class="dot-item-nodot material-symbols-outlined">radio_button_unchecked</span>`;

        return `
            <li class="dot-item ${runtime ? 'has-dot' : 'no-dot'}" data-name="${asset.name}">
                <span class="dot-item-mark">
                    ${mark}
                    ${platform ? `<img class="dot-item-platform" src="static/img/platform/${platform}.png" alt="" title="${platform}">` : ''}
                </span>
                <span class="dot-item-name">${asset.name}</span>
                <span class="dot-item-seen">${runtime ? this._ago(asset.updated) : 'No dot'}</span>
            </li>
        `;
    }

    // assets still missing a dot sort to the top — those are the ones to deploy to
    static byDot(a, b) {
        return (a.metadata.runtime ? 1 : 0) - (b.metadata.runtime ? 1 : 0)
            || a.name.localeCompare(b.name);
    }

    _filter() {
        const q = this.search.value.trim().toLowerCase();
        let visible = 0;
        [...this.list.children].forEach(li => {
            li.hidden = !li.dataset.name.toLowerCase().includes(q);
            if (!li.hidden) visible++;
        });
        this.wrap.classList.toggle('no-match', !visible && this.dots.size > 0);
    }

    // --- selection ---------------------------------------------------------

    _select(name) {
        const asset = this.dots.get(name);
        this.selected = name;

        [...this.list.children].forEach(li =>
            li.classList.toggle('selected', li.dataset.name === name));

        this._clearOutput();
        this._loadActions(asset);
    }

    async _loadActions(asset, quiet = false) {
        if (!quiet) this.mid.innerHTML = '<div class="dot-col-body loading"></div>';
        const actions = await this.api.action.get(asset.name) ?? [];
        if (this.selected !== asset.name) return;   // bailed if they switched dots mid-fetch
        this._renderActions(actions);
    }

    _renderActions(actions) {
        const sorted = [...actions].sort((a, b) => b.created.localeCompare(a.created));
        this.sorted = sorted;

        const asset = this.dots.get(this.selected);
        const list = sorted.length ? `
            <div class="dot-col-body dot-col-body--scroll">
                <ul class="dot-action-list">
                    ${sorted.map(a => {
                        const { tone, label, icon } = this._statusInfo(a.status);
                        return `
                            <li class="dot-action-item dot-action-item--${tone}" data-key="${a.key}">
                                <span class="dot-action-status material-symbols-outlined" title="${label}">${icon}</span>
                                <span class="dot-action-name"><span class="dot-action-label">${a.name}</span><span class="dot-action-id">${a.id}</span></span>
                                <span class="dot-action-time">${this._clock(a.created)}</span>
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        ` : this._placeholder('dot-empty', 'history', 'No activity');

        this.mid.innerHTML = this._actionsHeader(asset, sorted) + list;

        if (this.selectedKey == null) return;
        if (this.sorted.some(a => a.key === this.selectedKey)) this._selectAction(this.selectedKey);
        else this._clearOutput();
    }

    _actionsHeader(asset, actions) {
        const total = actions.length;
        const success = actions.filter(a => this._statusInfo(a.status).tone === 'ok').length;
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
        const asset = action.asset ?? this.selected;
        const output = this._outputText(action);
        const running = tone === 'pending';

        const body = running
            ? `<p class="dot-terminal-line dot-terminal-running"><span class="dot-terminal-spinner"></span>running…</p>`
            : output.trim()
                ? `<pre class="dot-terminal-output">${this._escape(output)}</pre>`
                : `<p class="dot-terminal-line dot-terminal-muted">(no output)</p>`;

        const exit = running ? '' : `
            <p class="dot-terminal-line dot-terminal-exit dot-terminal-exit--${tone}">
                <span class="dot-terminal-exit-mark"></span>process exited — ${label}
            </p>`;

        this.right.innerHTML = `
            <div class="dot-terminal">
                <div class="dot-terminal-body dot-terminal-body--output">
                    <p class="dot-terminal-line dot-terminal-line--cmd">
                        <span class="dot-terminal-prompt">${asset} ~ $</span>
                        <span class="dot-terminal-cmd">${action.name}<span class="dot-terminal-cmd-id">${action.id}</span></span>
                    </p>
                    ${body}
                    ${exit}
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
            const name = file.name.replace(/\.[^.]+$/, '');
            const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
            const upload = new File([file], `${id}${ext}`, { type: file.type });

            this.api.file.root = 'action';
            await this.api.file.add(upload);
            await this.api.action.add({ id, name, asset: this.selected, status: '-1' });
        }).then(() => {
            this.refresh();
        });
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