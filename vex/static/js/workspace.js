class AppState {
    constructor(user) {
        this.user = user;
        this.delegate;
        this.signals = {};
        this.api = new Api(this);
    }

    account(){
        return this.delegate;
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
        this.inventory = new InventoryApi(state);
        this.managed = new ManagedApi(state);
        this.audit = new AuditApi(state);
        this.file = new FileApi(state);
        this.sources = new SourceApi(state);
        this.settings = new SettingsApi(state);
        this.compliance = new ComplianceApi(state);
    }

    reset(){
        this.signals.set("account", this.state.account());
        this.inventory.set("account", this.state.account());
        this.managed.set("account", this.state.account());
        this.audit.set("account", this.state.account());
        this.file.set("account", this.state.account());
        this.sources.set("account", this.state.account());
        this.settings.set("account", this.state.account());
        this.compliance.set("account", this.state.account());
    }
}

class Workspace {
    static #instance;

    async render(code) {
        Workspace.#instance = this;

        Auth.init(code)
            .then(user => {
                const state = new AppState(user);

                this.rollups = {
                    managed: new ManagedRollup(state),
                    coverage: new CoverageRollup(state),
                    audit: new AuditRollup(state),
                };

                this.sidebars = {
                    signal: new SignalSidebar(state),
                    backup: new BackupSidebar(state),
                    compliance: new ComplianceSidebar(state),
                }

                this.tenant = new TenantScreen(state);
                this.listen();

                setInterval(() => this.reload(), 60000);
                document.addEventListener('page:reload', () => this.reload());
                document.addEventListener('page:reset', () => this.reset(state));

                this.open('managed');
                this.reveal();
            })
            .catch(err => {
                console.error(err);
            });
    }

    reveal() {
        document.getElementById('auth-gate').remove();
        document.documentElement.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
    }

    open(name) {
        const rollup = this.rollups[name];
        const run = async () => {
            document.getElementById(`${name}-screen`).show();
            await rollup.reset();
            await rollup.reload();
        };

        return rollup.quiet ? run() : SiteSpinner.withLoading(run);
    }

    listen() {
        Object.keys(this.rollups).forEach(name => {
            document.getElementById(`open-${name}-rollup`).addEventListener("click", () => this.open(name));
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

        await this.tenant.refresh();
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

    static time(v) {
        return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`);
    }

    static date(iso, time = false) {
        if (!iso) return '';

        const d = new Date(Workspace.time(iso));
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

    static risk(threat) {
        if (threat == null || Number.isNaN(Number(threat))) return null;
        const pct = Math.min(100, Math.max(0, Math.round(Number(threat) * 100)));

        if (pct <= 50) return { pct, level: 'low',    label: 'Likely benign',    icon: 'verified_user' };
        if (pct <= 75) return { pct, level: 'medium', label: 'Suspicious',       icon: 'warning' };
        return               { pct, level: 'high',   label: 'Likely malicious', icon: 'dangerous' };
    }

    static get sidebars() {
        document.querySelector('site-overlay').click();
        return Workspace.#instance?.sidebars;
    }
}