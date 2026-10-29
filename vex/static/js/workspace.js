class AppState {
    constructor(user) {
        this.user = user;
        this.delegate;
        this.signals = {};
        this.api = new Api(this);
    }

    account(){
        return this.delegate || this.user.email.split('@').pop();
    }

    reset() {
        this.signals = {};
        this.api.reset();
    }

    track(signal) {
        this.signals[signal.account] ??= {};
        this.signals[signal.account][signal.id] = signal;
    }
}

class Api {
    constructor(state) {
        this.state = state;
        this.signals = new SignalApi(state);
        this.inventory = new AssetApi(state);
        this.managed = new ManagedApi(state);
        this.audit = new AuditApi(state);
        this.file = new FileApi(state);
        this.sources = new SourceApi(state);
    }

    reset(){
        this.signals.set("account", this.state.account());
        this.inventory.set("account", this.state.account());
        this.managed.set("account", this.state.account());
        this.audit.set("account", this.state.account());
        this.file.set("account", this.state.account());
        this.sources.set("account", this.state.account());
    }
}

class Workspace {
    static #instance;

    async render(code) {
        Workspace.#instance = this;

        Auth.init(code)
            .then(async user => {
                await SiteSpinner.withLoading(async () => {
                    const state = new AppState(user);

                    this.rollups = {
                        managed: new ManagedRollup(state),
                        source: new SourceRollup(state),
                        dot: new DotRollup(state),
                    };

                    this.sidebars = {
                        signal: new SignalSidebar(state),
                        backup: new BackupSidebar(state),
                    }

                    this.tenant = new TenantScreen(state);
                    this.reset(state);
                    this.reload();
                    this.listen();

                    setInterval(() => this.reload(), 60000);
                    document.addEventListener('page:reload', () => this.reload());
                    document.addEventListener('page:reset', () => this.reset(state));
                    document.getElementById("open-managed-rollup").click();
                });
                document.getElementById('auth-gate')?.remove();
            })
            .catch(err => {
                console.error(err);
            });
    }

    listen() {
        Object.keys(this.rollups).forEach(name => {
            document.getElementById(`open-${name}-rollup`).addEventListener("click", () => {
                SiteSpinner.withLoading(async () => {
                    document.getElementById(`${name}-screen`).show();
                    const rollup = this.rollups[name];
                    await rollup.reset();
                    await rollup.reload();
                });
            });
        });

        Object.keys(this.sidebars).forEach(name => {
            document.getElementById(`open-${name}-sidebar`).addEventListener("click", () => {
                SiteSpinner.withLoading(async () => {
                    document.getElementById(`${name}-sidebar`).show();
                    const sidebar = this.sidebars[name];
                    await sidebar.reset();
                    await sidebar.reload();
                });
            });
        });      
    }

    async reload() {
        await this.tenant.reload();
    }

    async reset(state) {
        state.reset();
        document.querySelector('site-header').setAccount(state.account(), `https://www.google.com/s2/favicons?domain=${state.account()}&sz=64`);

        await this.tenant.reset();
        await this.tenant.reload();
    }

    static avatar(s) {
        if (s == "vex") {
            return "https://cdn.unmanned.team/img/logo.png";
        }

        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
            return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(s)}`;
        }

        return `static/img/source/${s}.png`;
    }

    static date(iso, time = false) {
        const d = new Date(iso);
        return time
            ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
            : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    static esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
    }

    static encode(s) {
        return Array.from(s).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');        
    }

    static get sidebars() {
        document.querySelector('site-overlay').click();
        return Workspace.#instance?.sidebars;
    }

    static risk(threat) {
        if (threat == null || Number.isNaN(Number(threat))) return null;
        const pct = Math.min(100, Math.max(0, Math.round(Number(threat) * 100)));

        if (pct <= 50) return { pct, level: 'low',    label: 'Likely benign',    icon: 'verified_user' };
        if (pct <= 75) return { pct, level: 'medium', label: 'Suspicious',       icon: 'warning' };
        return               { pct, level: 'high',   label: 'Likely malicious', icon: 'dangerous' };
    }
}