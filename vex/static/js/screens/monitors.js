class MonitorScreen {
    constructor(state) {
        this.state = state;
        this.api = new MonitorApi();
        this.screen = document.getElementById('monitor-screen');
        this.wrap = document.getElementById('monitor-table-wrap');
        this.tbody = document.getElementById('monitor-list');
        this.watermark = this.screen.querySelector('site-watermark');
        this.expanded = null;

        this.available = {
            google:     { name: 'Google Workspace' },
            microsoft:  { name: 'Microsoft 365' },
            cloudflare: { name: 'Cloudflare' },
            level:      { name: 'Level.io' },
            shopify:    { name: 'Shopify' },
            hubspot:    { name: 'Hubspot' },
            square:     { name: 'Square' },
            quickbooks: { name: 'Quickbooks' },
            ramp:       { name: 'Ramp' },
            aws:        { name: 'AWS' },
        };

        this._renderCallout();
        this._renderTable();
        this.listen();
    }

    async reset() {
        this.api.set("account", this.state.account());
        this.watermark.show("Scan for signals");
        Object.values(this.available).forEach(s => { s.active = false; });
        this.expanded = null;
        this._renderCallout();
        this._renderTable();
    }

    async reload() {
        const monitors = await this.api.list();
        monitors.forEach(monitor => this.add(monitor));
        this.watermark.hide();
    }

    add(monitor) {
        const name = monitor.split("/")[2];
        if (this.available[name]) {
            this.available[name].active = true;
            this._renderTable();
        }
    }

    _sorted() {
        return Object.entries(this.available).sort(([, a], [, b]) =>
            (b.active ?? false) - (a.active ?? false)
        );
    }

    _renderCallout() {
        document.getElementById('monitor-callout').innerHTML = `
            <p class="monitor-callout-text">Every Vex account has a unique mailbox that accepts signals. We recommend you forward alerts from routers, outage monitors, DMARC rua locations, and other applications that send email notifications.</p>
            <p class="monitor-callout-address">${this.emailAddress}</p>
        `;
    }

    _renderTable() {
        const rows = this._sorted();
        this.wrap.classList.toggle('empty', rows.length === 0);
        this.tbody.innerHTML = rows.map(([key, s]) => this._row(key, s)).join('');
    }

    _row(key, s) {
        const open = this.expanded === key;
        const main = `
            <tr class="monitor-table-row ${s.active ? 'connected' : ''} ${open ? 'expanded' : ''}" data-key="${key}">
                <td>
                    <span class="monitor-table-name">
                        <span class="monitor-row-icon"><img src="static/img/source/${key}.png"></span>
                        ${s.name}
                    </span>
                </td>
                <td>
                    ${s.active
                        ? `<span class="monitor-row-status"><span class="monitor-status-dot"></span>Connected</span>`
                        : `<span class="monitor-table-status-muted">Not connected</span>`}
                </td>
                <td class="monitor-table-action">
                    ${s.active
                        ? `<button class="monitor-action ghost" data-disconnect="${key}">Disconnect</button>`
                        : `<button class="monitor-action" data-connect="${key}">${open ? 'Cancel' : 'Connect'}</button>`}
                </td>
            </tr>
        `;

        const config = open ? `
            <tr class="monitor-config-row" data-key="${key}">
                <td colspan="3">
                    <div class="monitor-row-form">
                        <textarea data-key="${key}" rows="3" placeholder="Enter your API key, credentials, or configuration data here…"></textarea>
                        <div class="monitor-row-form-actions">
                            <a href="docs/${key}.html" target="_blank" class="docs-link">View setup documentation →</a>
                            <button class="monitor-action primary" data-submit="${key}">Connect</button>
                        </div>
                    </div>
                </td>
            </tr>
        ` : '';

        return main + config;
    }

    get emailAddress() {
        const hex = Array.from(this.state.account())
            .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
            .join('');
        return `${hex}@vex.unmanned.team`;
    }

    listen() {
        this.tbody.addEventListener('click', ev => {
            const connect = ev.target.closest('[data-connect]');
            if (connect) {
                this.expanded = this.expanded === connect.dataset.connect ? null : connect.dataset.connect;
                return this._renderTable();
            }

            const disconnect = ev.target.closest('[data-disconnect]');
            if (disconnect) {
                const key = disconnect.dataset.disconnect;
                this.api.disconnect(key);
                this.available[key].active = false;
                return this._renderTable();
            }

            const submit = ev.target.closest('[data-submit]');
            if (submit) {
                const key = submit.dataset.submit;
                const value = this.tbody.querySelector(`textarea[data-key="${key}"]`).value;
                this.api.connect(key, value);
                this.available[key].active = true;
                this.expanded = null;
                return this._renderTable();
            }

            const row = ev.target.closest('.monitor-table-row:not(.connected)');
            if (row) {
                this.expanded = this.expanded === row.dataset.key ? null : row.dataset.key;
                this._renderTable();
            }
        });
    }
}