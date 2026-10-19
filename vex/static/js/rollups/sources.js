class SourceRollup {
    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.screen = document.getElementById('source-screen');
        this.wrap = document.getElementById('source-table-wrap');
        this.list = document.getElementById('source-list');

        this.pickerOpen = false;
        this.connectingKey = null;
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
        this._resetPicker();
        this._renderCallout();
        this._render();
    }

    async reload() {
        await this.ready;
        const sources = await this.api.sources.list();
        Object.values(this.available).forEach(s => { s.instances = []; });
        sources.forEach(s => this.add(s));
        this._render();
    }

    add(source) {
        const [, , name, indexStr] = source.split("/");
        const index = indexStr !== undefined ? parseInt(indexStr, 10) : 0;
        const found = this.available[name];
        if (found && !found.instances.includes(index)) {
            found.instances.push(index);
            found.instances.sort((a, b) => a - b);
        }
    }

    async _connect(key, value) {
        this.connecting = true;
        this._render();

        try {
            // Backend assigns the index; send only the name (e.g. "google")
            await this.api.sources.connect(key, value);
        } catch {
            this.connecting = false;
            alert("Invalid JSON. Verify your quotes are correct.");
            this._render();
            return;
        } finally {
            document.dispatchEvent(new CustomEvent('page:reset'));
        }

        this._resetPicker();
        try {
            await this.reload();
        } catch {
            this._render();
        }
    }

    _allInstances() {
        return Object.entries(this.available).flatMap(([key, s]) =>
            s.instances.map(idx => ({ key, idx, source: s }))
        );
    }

    _icon(key) {
        return `<span class="source-icon"><img src="static/img/source/${key}.png"></span>`;
    }

    _renderCallout() {
        document.getElementById('source-callout').innerHTML = `
            <p class="source-callout-text">Every account has a unique mailbox that accepts signals. Forward alerts from routers, DMARC rua, and other services that send email notifications.</p>
            <p class="source-callout-address">${this.emailAddress}</p>
        `;
    }

    _render() {
        const instances = this._allInstances();
        this.wrap.classList.toggle('empty', instances.length === 0 && !this.pickerOpen);

        const rows = instances.map(({ key, idx, source }) => this._sourceRow(key, idx, source)).join('');
        this.list.innerHTML = rows + this._addSection();
    }

    _sourceRow(key, idx, source) {
        const multi = source.instances.length > 1;
        const id = multi ? `<span class="source-id">${idx}</span>` : '';

        return `
            <div class="source-row">
                ${this._icon(key)}
                <span class="source-name">${source.name}${id}</span>
                <span class="source-status"><span class="source-dot"></span>Connected</span>
                <button class="icon-btn" data-disconnect="${key}/${idx}" aria-label="Disconnect ${source.name}${multi ? ` ${idx}` : ''}">×</button>
            </div>
        `;
    }

    _addSection() {
        if (!this.pickerOpen) {
            return `
                <button class="source-add-toggle" data-open-picker>
                    <span class="material-symbols-outlined">add</span>
                    Add source
                </button>
            `;
        }

        if (!this.connectingKey) {
            const options = Object.entries(this.available).map(([key, s]) =>
                `<button class="source-source-option" data-pick="${key}">${this._icon(key)}<span>${s.name}</span></button>`
            ).join('');

            return `
                <div class="source-picker">
                    <p class="source-picker-label">Choose a source</p>
                    <div class="source-source-grid">${options}</div>
                    <button class="btn ghost" data-cancel-picker>Cancel</button>
                </div>
            `;
        }

        const key = this.connectingKey;
        const s = this.available[key];

        if (this.connecting) {
            return `
                <div class="source-picker source-picker-connecting">
                    <div class="source-connect-header">${this._icon(key)}<span class="source-name">${s.name}</span></div>
                    <p class="source-connect-note">Connecting…</p>
                </div>
            `;
        }

        return `
            <div class="source-picker">
                <div class="source-connect-header">${this._icon(key)}<span class="source-name">${s.name}</span></div>
                <p class="source-connect-note">Credentials are required.</p>
                <textarea data-cred rows="2" placeholder="Paste your API key or credentials"></textarea>
                <p class="source-connect-error" data-cred-error hidden>Enter your credentials first.</p>
                <div class="source-connect-actions">
                    <a href="docs/${key}.html" target="_blank" class="docs-link">Setup docs →</a>
                    <div class="source-connect-actions-right">
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

    _resetPicker() {
        this.pickerOpen = false;
        this.connectingKey = null;
        this.connecting = false;
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
                this.api.sources.disconnect(`${key}/${idx}`);
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

                return this._connect(key, value);
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