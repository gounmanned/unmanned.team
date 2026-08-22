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
    }

    reset(){
        this.signals.set("account", this.state.account());
        this.breach.set("account", this.state.account());
        this.inventory.set("account", this.state.account());
        this.managed.set("account", this.state.account());
        this.audit.set("account", this.state.account());
        this.file.set("account", this.state.account());
        this.monitors.set("account", this.state.account());
    }
}

class Workspace {
    static SEVERITY = {
        1: 'Critical',
        2: 'High',
        3: 'Medium',
        4: 'Low',
        5: 'Info',
    };

    async render(code) {
        Auth.init(code)
            .then(async user => await SiteSpinner.withLoading(async () => {
                const state = new AppState(user);
                this.tenant = new TenantScreen(state);

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
                }

                this.reset(state);
                this.reload(state);
                this.listen();

                setInterval(() => this.reload(state), 60000)                
                document.addEventListener('page:reload', () => this.reload(state));
                document.addEventListener('page:reset', () => this.reset(state));
            }))
            .catch(err => {
                console.error(err);
            }).finally(() => {
                document.querySelector('site-header').setCompany("Vex", "Prevent the breach");
                Workspace.toast("Vex is currently running unauthenticated security tests against your accounts.");
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

    async reload(state) {
        await this.tenant.reload();
        await this.rollups.managed.reload();
    }

    async reset(state) {
        await this.tenant.reset();
        await this.tenant.reload();
    }

    static avatar(s) {
        if (s == "security@vex.unmanned.team") {
            return "https://cdn.unmanned.team/img/logo.png";
        }

        const local = `static/img/source/${s}.png`;
        const fallback = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(s)}`;
        return `${local}" onerror="this.onerror=null;this.src=&apos;${fallback}&apos;`;
    }

    static debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    static toast(text, duration = 5000) {
        const el = document.getElementById('toast');

        requestAnimationFrame(() => el.classList.add('open'));
        el.querySelector("#toast-text").textContent = text;
        setTimeout(() => { el.classList.remove('open') }, duration);
    }
}