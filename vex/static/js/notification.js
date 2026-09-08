class Notifications {
    constructor(state) {
        this.api = state.api.notification;
        this.items = [];
        this.bell = document.getElementById('notification-bell');
        this.panel = document.getElementById('notification-panel');
        this.list = document.getElementById('notification-panel-list');
        this.refresh();
        this.listen();
    }

    async refresh() {
        const items = await this.api.list() ?? [];
        this.items = items;
        this.bell.classList.toggle('has-notifications', this.items.length > 0);
        this.render();
    }

    render() {
        this.list.innerHTML = this.items.map(n => `
            <li>
                <div class="notification-name">${n.name}</div>
                <div class="notification-value">${n.value}</div>
                <div class="notification-time">${this.relativeTime(n.created)}</div>
            </li>
        `).join('');

        this.panel.classList.toggle('empty', this.items.length === 0);
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