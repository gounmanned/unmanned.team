class InventoryScreen {
    static EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    static DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

    static classify(name) {
        if (InventoryScreen.EMAIL_RE.test(name)) return 'identity';
        if (InventoryScreen.DOMAIN_RE.test(name)) return 'domain';
        return 'other';
    }

    constructor(state) {
        this.state = state;
        this.api = new AssetApi();
        this.watermark = document.querySelector('#inventory-screen site-watermark');
        this.wrap = document.getElementById('asset-table-wrap');
        this.tbody = document.querySelector('#asset-table tbody');
        this.toggle = document.getElementById('asset-scope-toggle');
        this.search = document.getElementById('asset-search');

        this.assets = [];
        this.scope = 'domain';
        this.query = '';
        this.labels = { domain: 'domains', identity: 'identities', other: 'other assets' };
        this.listen();
    }

    async reset() {
        this.api.set("account", this.state.account());
        this.watermark.show("Collecting assets");
        this.assets = [];
        this.query = '';
        this.search.value = '';
        this.render();
    }

    async reload() {
        this.assets = (await this.api.list()).map(a => ({ ...a, type: InventoryScreen.classify(a.name) }));
        this.watermark.hide();
        this.render();
    }

    render() {
        Object.keys(this.labels).forEach(type => {
            const el = document.getElementById(`asset-count-${type}`);
            if (el) el.textContent = this.assets.filter(a => a.type === type).length;
        });

        const signalsForAccount = Object.values(this.state.signals[this.state.account()]);

        const rows = this.assets
            .filter(a => a.type === this.scope)
            .filter(a => !this.query || a.name.toLowerCase().includes(this.query) || (a.source || '').toLowerCase().includes(this.query))
            .map(a => ({ ...a, signals: signalsForAccount.filter(s => s.asset == a.name).length }));

        this.wrap.classList.toggle('empty', rows.length === 0);
        document.getElementById('asset-empty-label').textContent = this.query
            ? `No ${this.labels[this.scope]} match "${this.query}"`
            : `No ${this.labels[this.scope]}`;
        
        this.tbody.innerHTML = rows.map(a => `
            <tr data-id="${a.id ?? a.name}">
                <td class="asset-source"><img src="static/img/source/${a.source}.png" alt="" title="${a.source}"></td>
                <td class="asset-value">
                    ${a.name}
                    <button class="copy-btn" data-copy="${a.name}" type="button" aria-label="Copy value">
                        <span class="material-symbols-outlined">content_copy</span>
                    </button>
                </td>
                <td class="asset-signals">
                    ${Object.values(this.state.signals[this.state.account()]).filter(s => s.asset == a.name).length}
                </td>
                <td class="asset-seen">${a.updated ? new Date(a.updated).toLocaleDateString() : '—'}</td>
            </tr>
        `).join('');
    }

    listen() {
        this.toggle.addEventListener('click', ev => {
            const btn = ev.target.closest('.scope-btn');
            if (!btn) return;

            this.scope = btn.dataset.scope;
            this.toggle.dataset.scope = this.scope;
            this.render();
        });

        this.search.addEventListener('input', ev => {
            this.query = ev.target.value.trim().toLowerCase();
            this.render();
        });

        this.tbody.addEventListener('click', ev => {
            const btn = ev.target.closest('.copy-btn');
            if (!btn) return;

            navigator.clipboard.writeText(btn.dataset.copy).then(() => {
                const icon = btn.querySelector('.material-symbols-outlined');
                btn.classList.add('copied');
                icon.textContent = 'check';

                setTimeout(() => {
                    btn.classList.remove('copied');
                    icon.textContent = 'content_copy';
                }, 1200);
            });
        });
    }
}