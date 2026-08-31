class Notifications {
    constructor(api, containerId = 'notification-stack') {
        this.api = api;
        this.container = document.getElementById(containerId);
    }

    async show() {
        const notifications = await this.api.list();
        if (!notifications?.length) return;

        notifications.forEach(n => this.render(n));
    }

    render(notification) {
        const el = document.createElement('div');
        el.className = 'notification-toast';
        el.innerHTML = `
            <span class="material-symbols-outlined notification-icon">notifications</span>
            <div class="notification-body">
                <div class="notification-name">${notification.name}</div>
                <div class="notification-value">${notification.value}</div>
                <div class="notification-time">${this.relativeTime(notification.created)}</div>
            </div>
            <span class="material-symbols-outlined notification-close">close</span>
        `;

        const closeBtn = el.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.dismiss(notification.key, el, closeBtn));

        this.container.appendChild(el);
    }

    async dismiss(key, el, closeBtn) {
        closeBtn.style.pointerEvents = 'none';
        el.classList.add('dismissing');

        try {
            await this.api.clear(key);
            el.remove();
        } catch (e) {
            el.classList.remove('dismissing');
            closeBtn.style.pointerEvents = '';
            console.error('Failed to clear notification', key, e);
        }
    }

    relativeTime(created) {
        const diff = (Date.now() - new Date(created).getTime()) / 1000;
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return new Date(created).toLocaleDateString();
    }
}