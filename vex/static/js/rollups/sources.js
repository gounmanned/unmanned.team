const DISPLAY_NAMES = {
    aws: 'AWS',
    constantcontact: 'Constant Contact',
    github: 'GitHub',
    godaddy: 'GoDaddy',
    google: 'Google Workspace',
    hubspot: 'HubSpot',
    microsoft: 'Microsoft 365',
    teams: 'Microsoft Teams',
};

class SourceRollup {
    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.list = document.getElementById('source-list');
        this.mailbox = document.getElementById('source-mailbox');

        this.sources = {};          // vendor -> { name, ids }
        this.selected = null;       // vendor being connected
        this.draft = '';
        this.error = null;
        this.connecting = false;
        this.confirming = null;     // "vendor/id" awaiting a second click
        this.fresh = [];            // refs to highlight after connecting
        this.addOpen = null;        // accordion state; null until first load

        this.ready = this._loadManifest();
        this.listen();
    }

    async _loadManifest() {
        const keys = await fetch('static/img/source/manifest.json').then(r => r.json());
        for (const key of keys) {
            this.sources[key] = { name: DISPLAY_NAMES[key] ?? key[0].toUpperCase() + key.slice(1), ids: [] };
        }
        this._render();
    }

    async reset() {
        await this.ready;
        Object.values(this.sources).forEach(s => { s.ids = []; });
        this.selected = null;
        this.confirming = null;
        this.addOpen = null;
        this._renderMailbox();
        this._render();
    }

    async reload() {
        await this.ready;
        Object.values(this.sources).forEach(s => { s.ids = []; });
        (await this.api.sources.list()).forEach(s => this.add(s));
        this.addOpen ??= this._userCount() === 0;
        this._render();
    }

    // keys look like /accountID/vendor/sourceID
    add(source) {
        const [, , vendor, id] = source.split('/');
        const s = this.sources[vendor];
        if (s && !s.ids.includes(id)) s.ids.push(id);
    }

    // --- state ---

    _isSystem(id) {
        return id.endsWith('0');
    }

    _userCount(key) {
        const keys = key ? [key] : Object.keys(this.sources);
        return keys.flatMap(k => this.sources[k].ids).filter(id => !this._isSystem(id)).length;
    }

    _connections() {
        return Object.entries(this.sources)
            .flatMap(([key, s]) => s.ids.map(id => ({ key, id, ref: `${key}/${id}`, system: this._isSystem(id) })))
            .sort((a, b) => a.system - b.system || this._byName(a.key, b.key));
    }

    _byName(a, b) {
        return this.sources[a].name.localeCompare(this.sources[b].name);
    }

    // --- actions ---

    _select(key) {
        this.selected = key;
        this.draft = '';
        this.error = null;
        this._render();
        this.list.querySelector('[data-cred]').focus();
    }

    _submit() {
        const value = this.draft.trim();
        if (!value) {
            this.error = 'Paste your credentials first.';
            return this._render();
        }
        this._connect(this.selected, value);
    }

    async _connect(key, value) {
        this.connecting = true;
        this.error = null;
        this._render();

        try {
            await this.api.sources.connect(key, value);
        } catch {
            this.error = "Those credentials weren't accepted. If they're JSON, check that every quote is a straight double quote.";
            return;
        } finally {
            this.connecting = false;
            document.dispatchEvent(new CustomEvent('page:reset'));
            this._render();
        }

        const before = this._connections().map(c => c.ref);
        this.draft = '';
        await this.reload();
        this.fresh = this._connections().map(c => c.ref).filter(ref => !before.includes(ref));
        this._render();
        this.fresh = [];
    }

    _disconnect(ref) {
        const [key, id] = ref.split('/');
        this.api.sources.disconnect(ref);
        this.sources[key].ids = this.sources[key].ids.filter(i => i !== id);
        this.confirming = null;
        this._render();
    }

    async _copy() {
        const label = this.mailbox.querySelector('.src-mailbox-label');
        await navigator.clipboard.writeText(this.address);
        label.textContent = 'Copied';
        label.classList.add('is-copied');
        setTimeout(() => {
            label.textContent = 'Your alert mailbox';
            label.classList.remove('is-copied');
        }, 1500);
    }

    // --- rendering ---

    _logo(key) {
        return `<img class="src-logo" src="static/img/source/${key}.png" alt="">`;
    }

    _renderMailbox() {
        this.address = `${Workspace.encode(this.state.account())}@vex.unmanned.team`;
        this.mailbox.innerHTML = `
            <button class="src-mailbox-address" title="Forward email-only alerts here. Click to copy.">${this.address}</button>
            <span class="src-mailbox-label">Your alert mailbox</span>
        `;
    }

    _render() {
        this.list.innerHTML = `
            <nav class="src-left">
                ${this._connections().map(c => this._connectedRow(c)).join('')}
                ${this._addGroup()}
            </nav>
            <main class="src-main">
                ${this.selected ? this._connectForm() : this._idle()}
            </main>
        `;
    }

    _connectedRow({ key, id, ref, system }) {
        const s = this.sources[key];
        const meta = system ? 'Managed by system' : this._userCount(key) > 1 ? `ID ${id}` : 'Connected';

        let action = '<span class="material-symbols-outlined src-lock">lock</span>';
        if (!system) {
            action = this.confirming === ref
                ? `<button class="src-x is-confirming" data-disconnect="${ref}">Disconnect</button>`
                : `<button class="src-x" data-disconnect="${ref}" title="Disconnect"><span class="material-symbols-outlined">close</span></button>`;
        }

        return `
            <div class="src-row${this.fresh.includes(ref) ? ' is-new' : ''}">
                ${this._logo(key)}
                <div class="src-row-text">
                    <span class="src-name">${s.name}</span>
                    <span class="src-meta${system ? '' : ' is-live'}">${meta}</span>
                </div>
                ${action}
            </div>
        `;
    }

    _addGroup() {
        const keys = Object.keys(this.sources).sort((a, b) => this._byName(a, b));

        return `
            <details class="src-add" ${this.addOpen ? 'open' : ''}>
                <summary>
                    <span class="material-symbols-outlined">chevron_right</span>
                    Add a source
                    <span class="src-add-count">${keys.length}</span>
                </summary>
                ${keys.map(key => `
                    <button class="src-row is-option${this.selected === key ? ' is-selected' : ''}" data-select="${key}">
                        ${this._logo(key)}
                        <span class="src-name">${this.sources[key].name}</span>
                    </button>
                `).join('')}
            </details>
        `;
    }

    _idle() {
        const keys = Object.keys(this.sources).sort((a, b) => this._byName(a, b));
        return `
            <div class="src-cloud">
                ${keys.map((k, i) => `
                    <button style="--i: ${i}" data-select="${k}" title="${this.sources[k].name}">${this._logo(k)}</button>
                `).join('')}
            </div>
        `;
    }

    _connectForm() {
        const key = this.selected;
        const { name } = this.sources[key];
        const disabled = this.connecting ? 'disabled' : '';

        return `
            <button class="src-close" data-close title="Close"><span class="material-symbols-outlined">close</span></button>
            <div class="src-panel">
                <img class="src-hero" src="static/img/source/${key}.png" alt="">
                <h3>Connect ${name}</h3>
                <p class="src-sub">Collect ${name} event logs and security alerts.</p>

                <div class="src-field">
                    <div class="src-field-head">
                        <label for="src-cred">Credentials</label>
                        <a href="docs/${key}.html" target="_blank">Setup guide<span class="material-symbols-outlined">arrow_outward</span></a>
                    </div>
                    <textarea id="src-cred" data-cred rows="2" spellcheck="false" ${disabled}
                              placeholder="Paste the JSON from the setup guide">${Workspace.esc(this.draft)}</textarea>
                    <p class="src-hint${this.error ? ' is-error' : ''}">${this.error ?? "You won't be able to view it again after connecting."}</p>
                </div>

                <button class="src-connect" data-submit ${disabled}>
                    ${this.connecting ? 'Connecting…' : `Connect ${name}`}
                </button>
            </div>
        `;
    }

    // --- events ---

    listen() {
        this.mailbox.addEventListener('click', ev => {
            if (ev.target.closest('.src-mailbox-address')) this._copy();
        });

        this.list.addEventListener('click', ev => {
            if (ev.target.closest('.src-add summary')) {
                ev.preventDefault();
                this.addOpen = !this.addOpen;
                this.confirming = null;
                return this._render();
            }

            const disconnect = ev.target.closest('[data-disconnect]')?.dataset.disconnect;
            if (disconnect) {
                if (this.confirming === disconnect) return this._disconnect(disconnect);
                this.confirming = disconnect;
                return this._render();
            }
            if (this.confirming) {
                this.confirming = null;
                this._render();
            }

            if (this.connecting) return;

            const select = ev.target.closest('[data-select]')?.dataset.select;
            if (select) return this._select(select);
            if (ev.target.closest('[data-submit]')) return this._submit();
            if (ev.target.closest('[data-close]')) {
                this.selected = null;
                this._render();
            }
        });

        this.list.addEventListener('input', ev => {
            if (ev.target.matches('[data-cred]')) this.draft = ev.target.value;
        });

        this.list.addEventListener('keydown', ev => {
            if (ev.target.matches('[data-cred]') && ev.key === 'Enter') {
                ev.preventDefault();
                this._submit();
            }
        });

        document.addEventListener('keydown', ev => {
            if (ev.key === 'Escape' && this.selected && !this.connecting) {
                this.selected = null;
                this._render();
            }
        });
    }
}