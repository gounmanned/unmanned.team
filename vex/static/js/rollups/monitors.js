class MonitorRollup {
    constructor(state) {
        this.state = state;
        this.api = new MonitorApi();
        this.screen = document.getElementById('monitor-screen');
        this.wrap = document.getElementById('monitor-table-wrap');
        this.list = document.getElementById('monitor-list');
        this.watermark = this.screen.querySelector('site-watermark');

        this.pickerOpen = false;
        this.connectingKey = null;

        this.available = {
            google:     { name: 'Google Workspace', instances: [] },
            microsoft:  { name: 'Microsoft 365', instances: [] },
            cloudflare: { name: 'Cloudflare', instances: [] },
            level:      { name: 'Level.io', instances: [] },
            shopify:    { name: 'Shopify', instances: [] },
            hubspot:    { name: 'Hubspot', instances: [] },
            square:     { name: 'Square', instances: [] },
            quickbooks: { name: 'Quickbooks', instances: [] },
            ramp:       { name: 'Ramp', instances: [] },
            aws:        { name: 'AWS', instances: [] },
            github:     { name: 'Github', instances: [] },
            slack:      { name: 'Slack', instances: [] },
            constantcontact: { name: 'Constant Contact', instances: [] },
        };

        this._renderCallout();
        this._render();
        this.listen();
    }

    async reset() {
        this.api.set("account", this.state.account());
        this.watermark.show("Scan for signals");
        Object.values(this.available).forEach(s => { s.instances = []; });
        this.pickerOpen = false;
        this.connectingKey = null;
        this._renderCallout();
        this._render();
    }

    async reload() {
        const monitors = await this.api.list();
        monitors.forEach(monitor => this.add(monitor));
        this.watermark.hide();
    }

    add(monitor) {
        const [, , name, indexStr] = monitor.split("/");
        const index = indexStr !== undefined ? parseInt(indexStr, 10) : 0;
        const source = this.available[name];
        if (source && !source.instances.includes(index)) {
            source.instances.push(index);
            source.instances.sort((a, b) => a - b);
            this._render();
        }
    }

    _nextIndex(key) {
        const instances = this.available[key].instances;
        return instances.length ? Math.max(...instances) + 1 : 0;
    }

    _allInstances() {
        return Object.entries(this.available).flatMap(([key, s]) =>
            s.instances.map(idx => ({ key, idx, source: s }))
        );
    }

    _icon(key) {
        return `<span class="monitor-icon"><img src="static/img/source/${key}.png"></span>`;
    }

    _renderCallout() {
        document.getElementById('monitor-callout').innerHTML = `
            <p class="monitor-callout-text">Every Vex account has a unique mailbox that accepts signals. Forward alerts from routers, DMARC rua, and other services that send email notifications.</p>
            <p class="monitor-callout-address">${this.emailAddress}</p>
        `;
    }

    _render() {
        const instances = this._allInstances();
        this.wrap.classList.toggle('empty', instances.length === 0 && !this.pickerOpen);

        const rows = instances.map(({ key, idx, source }) => this._monitorRow(key, idx, source)).join('')
            || `<div class="monitor-empty">No monitors connected yet.</div>`;

        this.list.innerHTML = rows + this._addSection();
    }

    _monitorRow(key, idx, source) {
        const label = source.instances.length > 1 ? `${source.name} #${idx + 1}` : source.name;
        return `
            <div class="monitor-row">
                ${this._icon(key)}
                <span class="monitor-name">${label}</span>
                <span class="monitor-status"><span class="monitor-dot"></span>Connected</span>
                <button class="icon-btn" data-disconnect="${key}/${idx}" aria-label="Disconnect ${label}">×</button>
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
            const options = Object.entries(this.available).map(([key, s]) => `
                <button class="monitor-source-option" data-pick="${key}">${this._icon(key)}${s.name}</button>
            `).join('');

            return `
                <div class="monitor-picker">
                    <p class="monitor-picker-label">Choose a source</p>
                    <div class="monitor-source-grid">${options}</div>
                    <button class="btn ghost" data-cancel-picker>Cancel</button>
                </div>
            `;
        }

        const s = this.available[this.connectingKey];
        return `
            <div class="monitor-picker">
                <div class="monitor-connect-header">${this._icon(this.connectingKey)}<span class="monitor-name">${s.name}</span></div>
                <textarea data-cred rows="2" placeholder="Paste your API key or credentials"></textarea>
                <p class="monitor-connect-error" data-cred-error hidden>Enter your credentials first.</p>
                <div class="monitor-connect-actions">
                    <a href="docs/${this.connectingKey}.html" target="_blank" class="docs-link">Setup docs →</a>
                    <div class="monitor-connect-actions-right">
                        <button class="btn ghost" data-back>Back</button>
                        <button class="btn primary" data-submit>Connect</button>
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

    listen() {
        this.list.addEventListener('click', ev => {
            if (ev.target.closest('[data-open-picker]')) {
                this.pickerOpen = true;
                return this._render();
            }
            if (ev.target.closest('[data-cancel-picker]')) {
                this.pickerOpen = false;
                this.connectingKey = null;
                return this._render();
            }
            if (ev.target.closest('[data-back]')) {
                this.connectingKey = null;
                return this._render();
            }

            const pick = ev.target.closest('[data-pick]');
            if (pick) {
                this.connectingKey = pick.dataset.pick;
                return this._render();
            }

            const disconnect = ev.target.closest('[data-disconnect]');
            if (disconnect) {
                const [key, idxStr] = disconnect.dataset.disconnect.split('/');
                const idx = parseInt(idxStr, 10);
                this.api.disconnect(`${key}/${idx}`);
                this.available[key].instances = this.available[key].instances.filter(i => i !== idx);
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
                const idx = this._nextIndex(key);
                this.api.connect(`${key}/${idx}`, value);
                this.available[key].instances.push(idx);
                this.available[key].instances.sort((a, b) => a - b);
                this.pickerOpen = false;
                this.connectingKey = null;
                return this._render();
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