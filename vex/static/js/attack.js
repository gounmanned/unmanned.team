class AttackMode {
    constructor(state) {
        this.on = false;
        this.panel = new AttackPanel(state);

        this.el = {
            btn: document.getElementById('attack-toggle'),
            tenant: document.getElementById('tenant-screen'),
            section: document.getElementById('attack-section'),
            boot: document.getElementById('attack-boot'),
        };

        this.el.btn.addEventListener('click', () => this.toggle());
    }

    async toggle() {
        this.on = !this.on;

        if (this.on) this.el.boot.classList.add('show');
        this.el.btn.classList.toggle('active', this.on);
        document.body.classList.toggle('attack', this.on);
        this.el.tenant.hidden = this.on;
        this.el.section.hidden = !this.on;

        if (this.on) {
            this.panel.load();
            await new Promise(r => setTimeout(r, 900));
            this.el.boot.classList.remove('show');
        }
    }
}

class AttackPanel {
    constructor(state) {
        this.api = state.api;
        this.list = document.getElementById('attack-dots');
        this.wrap = this.list.parentElement;
        this.mid = document.getElementById('attack-mid');
        this.right = document.getElementById('attack-right');
        this.search = document.getElementById('attack-search-input');
        this.dots = new Map();
        this.selected = null;

        this.modal = document.getElementById('action-modal');
        this.form = document.getElementById('action-form');
        this.pending = null;

        this.search.addEventListener('input', () => this._filter());
        this._listenForDrops();
    }

    // --- dots list ---------------------------------------------------------

    async load() {
        this.list.innerHTML = '';
        this.dots.clear();
        this.selected = null;
        this._watermark();

        this.wrap.classList.add('loading');
        const assets = await this.api.inventory.list();
        this.wrap.classList.remove('loading');

        assets.filter(a => a.source === 'vex').forEach(a => this._add(a));
        this._filter();
    }

    _add(asset) {
        this.dots.set(asset.name, asset);

        const li = document.createElement('li');
        li.className = 'attack-dot-item';
        li.dataset.name = asset.name;
        li.innerHTML = `
            <span class="attack-dot-status ${this._freshness(asset.updated)}"></span>
            <span class="attack-dot-name">${asset.name}</span>
            <span class="attack-dot-seen">${this._ago(asset.updated)}</span>
        `;

        li.addEventListener('click', () => this._select(asset.name));
        this.list.appendChild(li);
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

        this._renderTerminal(asset);
        this._loadActions(asset);
    }

    async _loadActions(asset) {
        this.mid.innerHTML = '<div class="attack-col-body loading"></div>';
        const actions = await this.api.action.get(asset.name) ?? [];
        if (this.selected !== asset.name) return;   // bailed if they switched dots mid-fetch
        this._renderActions(actions);
    }

    _renderActions(actions) {
        const sorted = [...actions].sort((a, b) => b.created.localeCompare(a.created));

        const status = (s) =>
            s === '-1' ? { tone: 'pending', label: 'Pending' } :
            s === '0'  ? { tone: 'ok',      label: 'Success' } :
                         { tone: 'bad',     label: 'Failed'  };

        this.mid.innerHTML = sorted.length ? `
            <div class="attack-col-body attack-col-body--scroll">
                <ul class="attack-action-list">
                    ${sorted.map(a => {
                        const { tone, label } = status(a.status);
                        return `
                            <li class="attack-action-item attack-action-item--${tone}">
                                <span class="attack-action-status" title="${label}"></span>
                                <span class="attack-action-name"><span class="attack-action-label">${a.name}</span><span class="attack-action-id">${a.id}</span></span>
                                <span class="attack-action-time">${this._clock(a.created)}</span>
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        ` : this._placeholder('attack-empty', 'history', 'No activity');
    }

    _renderTerminal(asset) {
        this.right.innerHTML = `
            <div class="attack-terminal">
                <div class="attack-terminal-body" aria-disabled="true">
                    <p class="attack-terminal-line">
                        <span class="attack-terminal-prompt">${asset.name} ~ $</span>
                        <span class="attack-terminal-cursor"></span>
                    </p>

                    <button class="attack-shell" type="button" role="switch" aria-checked="false" disabled>
                        <span class="attack-shell-track"><span class="attack-shell-thumb"></span></span>
                        <span class="attack-shell-label">Request shell</span>
                    </button>
                </div>
            </div>
        `;
    }

    _watermark() {
        this.mid.innerHTML = this._placeholder('attack-watermark', 'ads_click', 'Select a dot to view its activity');
        this.right.innerHTML = this._placeholder('attack-watermark', 'terminal', 'Select a dot to open a session');
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

        if (this.selected === asset) this._loadActions(this.dots.get(asset));
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
            hour: '2-digit', minute: '2-digit',
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