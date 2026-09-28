class Notifications {
    static ONBOARDING = [
        { id: 'email',         icon: 'badge',         title: 'Connect your identity provider', vendors: ['google', 'microsoft'] },
        { id: 'domain',        icon: 'dns',           title: 'Connect your registrar', vendors: ['cloudflare'] },
        { id: 'endpoint',      icon: 'laptop_mac',    title: 'Connect your endpoints', vendors: ['level'] },
        { id: 'notifications', icon: 'notifications', title: 'Get push notifications', vendors: ['slack', 'teams', 'jira', 'rapid7'] },
    ];

    constructor(state) {
        this.api = state.api;
        this.items = [];
        this.setup = [];
        this.bell = document.getElementById('notification-bell');
        this.panel = document.getElementById('notification-panel');
        this.list = document.getElementById('notification-panel-list');
        this.refresh();
        this.listen();
    }

    async refresh() {
        const [items, assets, monitors] = await Promise.all([
            this.api.notification.list().catch(() => []),
            this.api.inventory.list().catch(() => []),
            this.api.monitors.list().catch(() => []),
        ]);

        this.items = items ?? [];
        this.setup = this.pendingSetup(assets ?? [], monitors ?? []);

        const total = this.items.length + this.setup.length;
        this.bell.classList.toggle('has-notifications', total > 0);
        this.bell.classList.toggle('setup-only', this.items.length === 0 && this.setup.length > 0);
        this.render();
    }

    pendingSetup(assets, monitors) {
        const vendors = new Set(
            monitors.map(key => key.split('/').filter(Boolean)[1]).filter(Boolean)
        );
        const hasEndpoints = assets.some(a => a.metadata?.platform);

        return Notifications.ONBOARDING.filter(step => {
            const done = step.id === 'endpoint'
                ? hasEndpoints
                : step.vendors.some(v => vendors.has(v));
            return !done;
        });
    }

    render() {
        const setup = this.setup.map(s => `
            <li class="notification-setup" data-step="${s.id}">
                <span class="material-symbols-outlined notification-setup-icon">${s.icon}</span>
                <div>
                    <div class="notification-name">Setup</div>
                    <div class="notification-value"><strong>${s.title}</strong></div>
                </div>
            </li>
        `).join('');

        const items = this.items.map(n => `
            <li>
                <div class="notification-name">${n.name}</div>
                <div class="notification-value">${n.value}</div>
                <div class="notification-time">${this.relativeTime(n.created)}</div>
            </li>
        `).join('');

        this.list.innerHTML = setup + items;
        this.panel.classList.toggle('empty', this.items.length + this.setup.length === 0);
    }

    listen() {
        this.bell.addEventListener('click', async (e) => {
            e.stopPropagation();
            const opening = !this.panel.classList.contains('open');
            if (opening) {
                await this.refresh();
            }
            this.panel.classList.toggle('open', opening);
        });

        this.list.addEventListener('click', (e) => {
            if (!e.target.closest('.notification-setup')) return;
            e.stopPropagation();
            this.panel.classList.remove('open');
            document.getElementById('open-monitor-rollup').click();
        });

        document.addEventListener('click', (e) => {
            if (!this.panel.contains(e.target) && !this.bell.contains(e.target)) {
                this.panel.classList.remove('open');
            }
        });
    }

    relativeTime(created) {
        const diff = (Date.now() - new Date(created).getTime()) / 1000;
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return new Date(created).toLocaleDateString();
    }
}