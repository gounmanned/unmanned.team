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

        this.search.addEventListener('input', () => this._filter());
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

    _add(asset) {
        this.dots.set(asset.name, asset);

        const fresh = new Date(asset.updated).toDateString() === new Date().toDateString();

        const li = document.createElement('li');
        li.className = 'attack-dot-item';
        li.dataset.name = asset.name;
        li.innerHTML = `
            <span class="attack-dot-status ${fresh ? 'fresh' : 'stale'}"></span>
            <span class="attack-dot-name">${asset.name}</span>
            <span class="attack-dot-seen">${this._ago(asset.updated)}</span>
        `;

        li.addEventListener('click', () => this._select(asset.name));
        this.list.appendChild(li);
    }

    async _select(name) {
        const asset = this.dots.get(name);
        this.selected = name;

        [...this.list.children].forEach(li =>
            li.classList.toggle('selected', li.dataset.name === name));

        this.mid.innerHTML = '<div class="attack-col-body loading"></div>';
        this._renderTerminal(asset);

        const actions = await this.api.action.get(asset.name) ?? [];
        if (this.selected !== name) return;
        this._renderActions(asset, actions);
    }

    _renderActions(asset, actions) {
        const sorted = [...actions].sort((a, b) => b.created.localeCompare(a.created));

        const tone = (s) => s === '-1' ? 'pending' : s === '0' ? 'ok' : 'bad';
        const label = (s) => s === '-1' ? 'Pending' : s === '0' ? 'Success' : 'Failed';

        this.mid.innerHTML = sorted.length ? `
            <div class="attack-col-body attack-col-body--scroll">
                <ul class="attack-action-list">
                    ${sorted.map(a => `
                        <li class="attack-action-item attack-action-item--${tone(a.status)}">
                            <span class="attack-action-status" title="${label(a.status)}"></span>
                            <span class="attack-action-name"><span class="attack-action-label">${a.name}</span><span class="attack-action-id">${a.id}</span></span>
                            <span class="attack-action-time">${this._clock(a.created)}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : `
            <div class="attack-empty">
                <span class="material-symbols-outlined">history</span>
                <p>No activity</p>
            </div>
        `;
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
        const mark = (icon, text) => `
            <div class="attack-watermark">
                <span class="material-symbols-outlined">${icon}</span>
                <p>${text}</p>
            </div>
        `;
        this.mid.innerHTML = mark('ads_click', 'Select a dot to view its activity');
        this.right.innerHTML = mark('terminal', 'Select a dot to open a session');
    }
}