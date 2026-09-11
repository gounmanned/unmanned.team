class MonitorRollup {
    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.screen = document.getElementById('monitor-screen');
        this.wrap = document.getElementById('monitor-table-wrap');
        this.list = document.getElementById('monitor-list');

        this.pickerOpen = false;
        this.connectingKey = null;
        this.credsExpanded = false;
        this.connecting = false;
        this.available = {};

        this.ready = this._loadSources();
        this.listen();
    }

    async _loadSources() {
        const keys = await fetch('static/img/source/manifest.json').then(r => r.json());
        keys.forEach(key => {
            this.available[key] = {
                name: key.charAt(0).toUpperCase() + key.slice(1),
                instances: [],
            };
        });
        this._render();
    }

    async reset() {
        await this.ready;
        Object.values(this.available).forEach(s => { s.instances = []; });
        this.pickerOpen = false;
        this.connectingKey = null;
        this.credsExpanded = false;
        this.connecting = false;
        this._renderCallout();
        this._render();
    }

    async reload() {
        await this.ready;
        const monitors = await this.api.monitors.list();
        monitors.forEach(monitor => this.add(monitor));
    }

    add(monitor, hasCreds = null) {
        const [, , name, indexStr] = monitor.split("/");
        const index = indexStr !== undefined ? parseInt(indexStr, 10) : 0;
        const source = this.available[name];
        if (source && !source.instances.some(i => i.idx === index)) {
            source.instances.push({ idx: index, hasCreds });
            source.instances.sort((a, b) => a.idx - b.idx);
            this._render();
        }
    }

    _nextIndex(key) {
        const instances = this.available[key].instances;
        return instances.length ? Math.max(...instances.map(i => i.idx)) + 1 : 0;
    }

    _allInstances() {
        return Object.entries(this.available).flatMap(([key, s]) =>
            s.instances.map(inst => ({ key, inst, source: s }))
        );
    }

    _icon(key) {
        return `<span class="monitor-icon"><img src="static/img/source/${key}.png"></span>`;
    }

    _renderCallout() {
        document.getElementById('monitor-callout').innerHTML = `
            <p class="monitor-callout-text">Every account has a unique mailbox that accepts signals. Forward alerts from routers, DMARC rua, and other services that send email notifications.</p>
            <p class="monitor-callout-address">${this.emailAddress}</p>
        `;
    }

    _render() {
        const instances = this._allInstances();
        this.wrap.classList.toggle('empty', instances.length === 0 && !this.pickerOpen);

        const rows = instances.map(({ key, inst, source }) => this._monitorRow(key, inst, source)).join('');
        this.list.innerHTML = rows + this._addSection();
    }

    _monitorRow(key, inst, source) {
        const label = source.instances.length > 1 ? `${source.name} #${inst.idx + 1}` : source.name;

        let sub = '';
        if (inst.hasCreds === true) sub = 'Full monitoring';
        else if (inst.hasCreds === false) sub = 'Outage only';

        return `
            <div class="monitor-row">
                ${this._icon(key)}
                <span class="monitor-name-block">
                    <span class="monitor-name">${label}</span>
                    ${sub ? `<span class="monitor-status-sub">${sub}</span>` : ''}
                </span>
                <span class="monitor-status"><span class="monitor-dot"></span>Connected</span>
                <button class="icon-btn" data-disconnect="${key}/${inst.idx}" aria-label="Disconnect ${label}">×</button>
            </div>
        `;
    }

    _addSection() {
        if (!this.pickerOpen) {
            return `
                <button class="monitor-add-toggle" data-open-picker>
                    <span class="material-symbols-outlined">add</span>
                    Add monitor
                </button>
            `;
        }

        if (!this.connectingKey) {
            const options = Object.entries(this.available).map(([key, s]) =>
                `<button class="monitor-source-option" data-pick="${key}">${this._icon(key)}<span>${s.name}</span></button>`
            ).join('');

            return `
                <div class="monitor-picker">
                    <p class="monitor-picker-label">Choose a source</p>
                    <div class="monitor-source-grid">${options}</div>
                    <button class="btn ghost" data-cancel-picker>Cancel</button>
                </div>
            `;
        }

        const key = this.connectingKey;
        const s = this.available[key];

        if (this.connecting) {
            return `
                <div class="monitor-picker monitor-picker-connecting">
                    <div class="monitor-connect-header">${this._icon(key)}<span class="monitor-name">${s.name}</span></div>
                    <p class="monitor-connect-note">Connecting…</p>
                </div>
            `;
        }

        const showCredField = this.credsExpanded;

        return `
            <div class="monitor-picker">
                <div class="monitor-connect-header">${this._icon(key)}<span class="monitor-name">${s.name}</span></div>
                ${!showCredField ? `<p class="monitor-connect-note">Connects instantly for outage monitoring. Add credentials for full monitoring.</p>` : ''}
                ${showCredField ? `
                    <textarea data-cred rows="2" placeholder="Paste your API key or credentials"></textarea>
                    <p class="monitor-connect-error" data-cred-error hidden>Enter your credentials first.</p>
                ` : ''}
                <div class="monitor-connect-actions">
                    <a href="docs/${key}.html" target="_blank" class="docs-link">Setup docs →</a>
                    <div class="monitor-connect-actions-right">
                        <button class="btn ghost" data-back>Back</button>
                        ${showCredField
                            ? `<button class="btn primary" data-submit>Connect</button>`
                            : `<button class="btn ghost" data-expand-creds>Add credentials</button>
                               <button class="btn primary" data-submit-empty>Connect</button>`}
                    </div>
                </div>
            </div>
        `;
    }

    get emailAddress() {
        const hex = Array.from(this.state.account())
            .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
            .join('');
        return `${hex}@vex.unmanned.team`;
    }

    _resetPicker() {
        this.pickerOpen = false;
        this.connectingKey = null;
        this.credsExpanded = false;
        this.connecting = false;
    }

    _connect(key, value, hasCreds) {
        const idx = this._nextIndex(key);
        this.connecting = true;
        this._render();

        return this.api.monitors.connect(`${key}/${idx}`, value).then(() => {
            this.available[key].instances.push({ idx, hasCreds });
            this.available[key].instances.sort((a, b) => a.idx - b.idx);
            this._resetPicker();
            this._render();
        }).catch(() => {
            this.connecting = false;
            alert("Invalid JSON. Verify your quotes are correct.");
            this._render();
        }).finally(() => {
            document.dispatchEvent(new CustomEvent('page:reset'));
        });
    }

    listen() {
        this.list.addEventListener('click', ev => {
            if (ev.target.closest('[data-open-picker]')) {
                this.pickerOpen = true;
                return this._render();
            }
            if (ev.target.closest('[data-cancel-picker]')) {
                this._resetPicker();
                return this._render();
            }
            if (ev.target.closest('[data-back]')) {
                this.connectingKey = null;
                this.credsExpanded = false;
                return this._render();
            }

            const pick = ev.target.closest('[data-pick]');
            if (pick) {
                this.connectingKey = pick.dataset.pick;
                this.credsExpanded = false;
                return this._render();
            }

            if (ev.target.closest('[data-expand-creds]')) {
                this.credsExpanded = true;
                return this._render();
            }

            if (ev.target.closest('[data-submit-empty]')) {
                return this._connect(this.connectingKey, '{}', false);
            }

            const disconnect = ev.target.closest('[data-disconnect]');
            if (disconnect) {
                const [key, idxStr] = disconnect.dataset.disconnect.split('/');
                const idx = parseInt(idxStr, 10);
                this.api.monitors.disconnect(`${key}/${idx}`);
                this.available[key].instances = this.available[key].instances.filter(i => i.idx !== idx);
                return this._render();
            }

            if (ev.target.closest('[data-submit]')) {
                const key = this.connectingKey;
                const textarea = this.list.querySelector('[data-cred]');
                const value = textarea.value.trim();
                if (!value) {
                    this.list.querySelector('[data-cred-error]').hidden = false;
                    return;
                }

                return this._connect(key, value, true);
            }
        });

        this.list.addEventListener('input', ev => {
            if (ev.target.matches('[data-cred]')) {
                const err = this.list.querySelector('[data-cred-error]');
                if (err) err.hidden = true;
            }
        });
    }
}