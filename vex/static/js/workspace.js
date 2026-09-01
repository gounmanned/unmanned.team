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
        this.breach = new BreachApi(state);
        this.inventory = new AssetApi(state);
        this.managed = new ManagedApi(state);
        this.audit = new AuditApi(state);
        this.file = new FileApi(state);
        this.monitors = new MonitorApi(state);
        this.threat = new ThreatApi(state);
        this.notification = new NotificationApi(state);
    }

    reset(){
        this.signals.set("account", this.state.account());
        this.breach.set("account", this.state.account());
        this.inventory.set("account", this.state.account());
        this.managed.set("account", this.state.account());
        this.audit.set("account", this.state.account());
        this.file.set("account", this.state.account());
        this.monitors.set("account", this.state.account());
        this.threat.set("account", this.state.account());
        this.notification.set("account", this.state.account());
    }
}

class Workspace {
    static #instance;

    static SEVERITY = {
        1: 'Critical',
        2: 'High',
        3: 'Medium',
        4: 'Low',
        5: 'Info',
    };

    async render(code) {
        Workspace.#instance = this;
        Auth.init(code)
            .then(async user => await SiteSpinner.withLoading(async () => {
                const state = new AppState(user);

                this.rollups = {
                    managed: new ManagedRollup(state),
                    monitor: new MonitorRollup(state),
                    inventory: new InventoryRollup(state),
                    breach: new BreachRollup(state),
                    audit: new AuditRollup(state),
                };

                this.sidebars = {
                    signal: new SignalSidebar(state),
                    backup: new BackupSidebar(state),
                    threat: new ThreatSidebar(state),
                    risk: new RiskSidebar(state),
                }

                this.tenant = new TenantScreen(state);
                this.reset();
                this.reload();
                this.listen();

                setInterval(() => this.reload(), 60000)                
                document.addEventListener('page:reload', () => this.reload());
                document.addEventListener('page:reset', () => this.reset());
            }))
            .catch(err => {
                console.error(err);
            }).finally(() => {
                document.querySelector('site-header').setCompany("Vex", "Security Operations Center");
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

    async reset() {
        await this.tenant.reset();
        await this.tenant.reload();
    }

    static avatar(s) {
        if (s == "security@vex.unmanned.team") {
            return "https://cdn.unmanned.team/img/logo.png";
        }

        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
            return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(s)}`;
        }

        return `static/img/source/${s}.png`;
    }

    static debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    static date(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    static get sidebars() {
        document.querySelector('site-overlay').click();
        return Workspace.#instance?.sidebars;
    }
}