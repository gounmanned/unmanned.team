class ActionMode {
    constructor(state) {
        this.on = false;
        this.panel = new ActionPanel(state);

        this.el = {
            btn: document.getElementById('action-toggle'),
            tenant: document.getElementById('tenant-screen'),
            section: document.getElementById('action-section'),
            boot: document.getElementById('action-boot'),
        };

        this.el.btn.addEventListener('click', () => this.toggle());
    }

    async toggle() {
        this.on = !this.on;

        if (this.on) this.el.boot.classList.add('show');
        this.el.btn.classList.toggle('active', this.on);
        document.body.classList.toggle('action', this.on);
        this.el.tenant.hidden = this.on;
        this.el.section.hidden = !this.on;

        if (this.on) {
            this.panel.load();
            await new Promise(r => setTimeout(r, 900));
            this.el.boot.classList.remove('show');
        }
    }

    refresh() {
        if (this.on) this.panel.refresh();
    }
}

class ActionPanel {
    constructor(state) {
        this.api = state.api;
        this.list = document.getElementById('action-dots');
        this.wrap = this.list.parentElement;
        this.mid = document.getElementById('action-mid');
        this.right = document.getElementById('action-right');
        this.search = document.getElementById('action-search-input');
        this.dots = new Map();
        this.selected = null;
        this.actions = new Map();        // id → action, for the mid column
        this.selectedAction = null;

        this.modal = document.getElementById('action-modal');
        this.form = document.getElementById('action-form');
        this.pending = null;

        this.search.addEventListener('input', () => this._filter());
        this.mid.addEventListener('click', (e) => {
            const li = e.target.closest('.action-action-item');
            if (li) this._selectAction(li.dataset.id);
        });
        this._listenForDrops();
    }

    // --- dots list ---------------------------------------------------------

    async load() {
        this.list.innerHTML = '';
        this.dots.clear();
        this.actions.clear();
        this.selected = null;
        this.selectedAction = null;
        this._watermark();

        this.wrap.classList.add('loading');
        const assets = await this.api.inventory.list();
        this.wrap.classList.remove('loading');

        assets.filter(a => a.source === 'vex').forEach(a => this._add(a));
        this._filter();
    }

    async refresh() {
        const assets = (await this.api.inventory.list()).filter(a => a.source === 'vex');
        this._sync(assets);

        if (this.selected) this._loadActions(this.dots.get(this.selected), true);
        else this._watermark();
    }

    _sync(assets) {
        const names = new Set(assets.map(a => a.name));

        for (const name of [...this.dots.keys()]) {
            if (names.has(name)) continue;
            this.list.querySelector(`[data-name="${name}"]`)?.remove();
            this.dots.delete(name);
            if (this.selected === name) this.selected = null;
        }

        assets.forEach(a => this.dots.has(a.name) ? this._update(a) : this._add(a));
        this._filter();
    }

    _add(asset) {
        this.dots.set(asset.name, asset);

        const li = document.createElement('li');
        li.className = 'action-dot-item';
        li.dataset.name = asset.name;
        li.innerHTML = `
            <span class="action-dot-status ${this._freshness(asset.updated)}"></span>
            <span class="action-dot-name">${asset.name}</span>
            <span class="action-dot-seen">${this._ago(asset.updated)}</span>
        `;

        li.addEventListener('click', () => this._select(asset.name));
        this.list.appendChild(li);
    }

    _update(asset) {
        this.dots.set(asset.name, asset);
        const li = this.list.querySelector(`[data-name="${asset.name}"]`);
        li.querySelector('.action-dot-status').className = `action-dot-status ${this._freshness(asset.updated)}`;
        li.querySelector('.action-dot-seen').textContent = this._ago(asset.updated);
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
        if (!quiet) this.mid.innerHTML = '<div class="action-col-body loading"></div>';
        const actions = await this.api.action.get(asset.name) ?? [];
        if (this.selected !== asset.name) return;   // bailed if they switched dots mid-fetch
        this._renderActions(actions);
    }

    _renderActions(actions) {
        const sorted = [...actions].sort((a, b) => b.created.localeCompare(a.created));
        this.actions = new Map(sorted.map(a => [String(a.id), a]));

        this.mid.innerHTML = sorted.length ? `
            <div class="action-col-body action-col-body--scroll">
                <ul class="action-action-list">
                    ${sorted.map(a => {
                        const { tone, label } = this._statusInfo(a.status);
                        return `
                            <li class="action-action-item action-action-item--${tone}" data-id="${a.id}">
                                <span class="action-action-status" title="${label}"></span>
                                <span class="action-action-name"><span class="action-action-label">${a.name}</span><span class="action-action-id">${a.id}</span></span>
                                <span class="action-action-time">${this._clock(a.created)}</span>
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        ` : this._placeholder('action-empty', 'history', 'No activity');

        if (this.actions.has(this.selectedAction)) this._selectAction(this.selectedAction);
        else if (this.selectedAction) this._clearOutput();
    }

    _statusInfo(s) {
        if (s == 'T0') return { tone: 'ok', label: 'Success' };
        if (s == 'T2') return { tone: 'pending', label: 'Pending' };
        return { tone: 'bad', label: 'Failed' };
    }

    _selectAction(id) {
        const action = this.actions.get(id);
        if (!action) return;
        this.selectedAction = id;

        this.mid.querySelectorAll('.action-action-item').forEach(li =>
            li.classList.toggle('selected', li.dataset.id === id));

        this._renderOutput(action);
    }

    _renderOutput(action) {
        const { tone, label } = this._statusInfo(action.status);
        const asset = action.asset ?? this.selected;
        const output = this._outputText(action);
        const running = tone === 'pending';

        const body = running
            ? `<p class="action-terminal-line action-terminal-running"><span class="action-terminal-spinner"></span>running…</p>`
            : output.trim()
                ? `<pre class="action-terminal-output">${this._escape(output)}</pre>`
                : `<p class="action-terminal-line action-terminal-muted">(no output)</p>`;

        const exit = running ? '' : `
            <p class="action-terminal-line action-terminal-exit action-terminal-exit--${tone}">
                <span class="action-terminal-exit-mark"></span>process exited — ${label}
            </p>`;

        this.right.innerHTML = `
            <div class="action-terminal">
                <div class="action-terminal-body action-terminal-body--output">
                    <p class="action-terminal-line action-terminal-line--cmd">
                        <span class="action-terminal-prompt">${asset} ~ $</span>
                        <span class="action-terminal-cmd">${action.name}<span class="action-terminal-cmd-id">${action.id}</span></span>
                    </p>
                    ${body}
                    ${exit}
                    <p class="action-terminal-line action-terminal-line--foot">
                        <span class="action-terminal-prompt">${asset} ~ $</span>
                        <span class="action-terminal-cursor"></span>
                    </p>
                </div>
            </div>
        `;
    }

    _clearOutput() {
        this.selectedAction = null;
        this.right.innerHTML = this._placeholder('action-watermark', 'terminal', 'Select an action');
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
        this.mid.innerHTML = this._placeholder('action-watermark', 'ads_click', 'Select a dot to view its activity');
        this.right.innerHTML = this._placeholder('action-watermark', 'terminal', 'Select a dot to open a session');
    }

    // --- drop / modal ------------------------------------------------------

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
            this._openModal(e.dataTransfer.files[0]);
        });

        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this._submitAction();
        });

        this.form.querySelector('[data-cancel]').addEventListener('click', () => this._closeModal());
    }

    _openModal(file) {
        if (!file) return;
        this.pending = file;

        const { label, actionId } = this.form.elements;
        label.value = file.name.replace(/\.[^.]+$/, '');
        actionId.value = this._randomActionId();

        this.modal.show();
        label.focus();
    }

    async _submitAction() {
        await SiteSpinner.withLoading(async() => {
            const { label, actionId } = this.form.elements;
            const id = actionId.value;
            const name = label.value;
            const asset = this.selected;
            const ext = this.pending.name.includes('.')
                ? this.pending.name.slice(this.pending.name.lastIndexOf('.'))
                : '';
            const file = new File([this.pending], id + ext, { type: this.pending.type });

            this.pending = null;
            this._closeModal();

            this.api.file.root = 'action';
            await this.api.file.add(file);
            await this.api.action.add({ id: parseInt(id), name, asset, status: '-1' });
        }).then(() => {
            this.refresh();
        });
    }

    _closeModal() {
        this.pending = null;
        document.querySelector('site-overlay').click();
    }

    _randomActionId() {
        const [n] = crypto.getRandomValues(new BigUint64Array(1));
        return String(10n ** 13n + n % (9n * 10n ** 13n));
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

    _freshness(ts) {
        const minutes = (Date.now() - new Date(ts)) / 60000;
        if (minutes < 15) return 'live';
        if (new Date(ts).toDateString() === new Date().toDateString()) return 'today';
        return 'cold';
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