class AppState {
    constructor(user) {
        this.user = user;
        this.delegate;
        this.signals = {};
    }

    account(){
        return this.delegate || this.user.email.split('@').pop();
    }

    track(signal) {
        this.signals[signal.account] ??= {};
        this.signals[signal.account][signal.id] = signal;
    }
}

class Workspace {
    async render(code) {
        Auth.init(code)
            .then(async user => await SiteSpinner.withLoading(async () => {
                const state = new AppState(user);
                this.tenant = new TenantScreen(state);

                this.rollups = {
                    managed: new ManagedScreen(state),
                    monitor: new MonitorScreen(state),
                    asset: new AssetScreen(state),
                    breach: new BreachScreen(state),
                };

                await this.reset(state);
                await this.reload(state);
                this.listen();

                setInterval(() => this.reload(state), 60000)                
                document.addEventListener('page:reload', () => this.reload(state));
                document.addEventListener('page:reset', () => this.reset(state));
            }))
            .catch(err => {
                console.error(err);
            }).finally(() => {
                document.querySelector('site-header').setCompany("Unmanned", "Welcome to Vex");
            });
    }

    listen() {
        Object.keys(this.rollups).forEach(name => {
            document.getElementById(`open-${name}-screen`).addEventListener("click", () => {
                SiteSpinner.withLoading(async() => this.show(name));
            });
        });
    }

    async reload(state) {
        await this.tenant.reload();
        await this.rollups.managed.reload();
    }

    async reset(state) {
        await SiteSpinner.withLoading(async() => {
            await this.tenant.reset();
            await this.tenant.reload();
        });
    }

    async show(name) {
        document.getElementById(`${name}-screen`).show();
        const screen = this.rollups[name];
        await screen.reset();
        await screen.reload();
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
}