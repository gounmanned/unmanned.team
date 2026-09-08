class Notifications {
    constructor(api) {
        this.api = api;
        this.items = [];
        this.bell = document.getElementById('notification-bell');
        this.panel = document.getElementById('notification-panel');
        this.list = document.getElementById('notification-panel-list');
        this.refresh();
        this.listen();
    }

    async refresh() {
        this.items = await this.api.list() ?? [];
        this.bell.classList.toggle('has-notifications', this.items.length > 0);
    }

    clear() {
        this.items = [];
        this.bell.classList.remove('has-notifications');
        this.panel.classList.remove('open');
        this.list.innerHTML = '';
    }

    render() {
        this.list.innerHTML = this.items.map(n => `
            <li>
                <div class="notification-name">${this.escape(n.name)}</div>
                <div class="notification-value">${this.escape(n.value)}</div>
                <div class="notification-time">${this.relativeTime(n.created)}</div>
            </li>
        `).join('');

        this.panel.classList.toggle('empty', this.items.length === 0);
    }

    escape(str) {
        const div = document.createElement('div');
        div.textContent = str ?? '';
        return div.innerHTML;
    }

    listen() {
        this.bell.addEventListener('click', async (e) => {
            e.stopPropagation();

            const opening = !this.panel.classList.contains('open');
            if (opening) {
                await this.refresh();
                this.render();
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