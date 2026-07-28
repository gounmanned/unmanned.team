class MonitorScreen {
    constructor(state) {
        this.state = state;
        this.api = new MonitorApi();
        this.screen = document.getElementById('monitor-screen');
        this.list = document.getElementById('monitor-list');
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

        this.render();
        this.listen();
    }

    async reset() {
        this.api.set("account", this.state.account());
        this.watermark.show("Scan for signals");
        Object.values(this.available).forEach(s => { s.active = false; });
        this.expanded = null;
        this.render();
    }

    async reload() {
        const monitors = await this.api.list();
        monitors.forEach(monitor => this.add(monitor));
        this.watermark.hide();
    }

    render() {
        this._renderCallout();
        this._renderList();
    }

    add(monitor) {
        const name = monitor.split("/")[2];
        if (this.available[name]) { this.available[name].active = true; this.render(); }
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

    _renderList() {
        this.list.innerHTML = this._sorted().map(([key, s]) => this._row(key, s)).join('');
    }

    _row(key, s) {
        const open = this.expanded === key;
        return `
            <div class="monitor-row ${open ? 'expanded' : ''} ${s.active ? 'connected' : ''}">
                <div class="monitor-row-main">
                    <div class="monitor-row-icon"><img src="static/img/source/${key}.png"></div>
                    <div class="monitor-row-body">
                        <span class="monitor-row-title">${s.name}</span>
                        ${s.active ? `<span class="monitor-row-status"><span class="monitor-status-dot"></span>Connected</span>` : ''}
                    </div>
                    ${s.active
                        ? `<button class="monitor-action ghost" data-disconnect="${key}">Disconnect</button>`
                        : `<button class="monitor-action" data-connect="${key}">${open ? 'Cancel' : 'Connect'}</button>`}
                </div>
                ${open ? `
                    <div class="monitor-row-form">
                        <textarea data-key="${key}" rows="3" placeholder="Enter your API key, credentials, or configuration data here…"></textarea>
                        <div class="monitor-row-form-actions">
                            <a href="docs/${key}.html" target="_blank" class="docs-link">View setup documentation →</a>
                            <button class="monitor-action primary" data-submit="${key}">Connect</button>
                        </div>
                    </div>
                ` : ''}
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
        this.screen.addEventListener('click', ev => {
            const connect = ev.target.closest('[data-connect]');
            if (connect) {
                const key = connect.dataset.connect;
                this.expanded = this.expanded === key ? null : key;
                return this.render();
            }
            const disconnect = ev.target.closest('[data-disconnect]');
            if (disconnect) {
                const key = disconnect.dataset.disconnect;
                this.api.disconnect(key);
                this.available[key].active = false;
                return this.render();
            }
            const submit = ev.target.closest('[data-submit]');
            if (submit) {
                const key = submit.dataset.submit;
                const value = this.list.querySelector(`textarea[data-key="${key}"]`).value;
                this.api.connect(key, value);
                this.available[key].active = true;
                this.expanded = null;
                this.render();
            }
        });
    }
}