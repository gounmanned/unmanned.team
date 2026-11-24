class SettingsSidebar {
    constructor(state) {
        this.api = state.api;
        this.toggles = document.getElementById('settings-toggles');
        this.listen();
    }

    reset() {}

    async reload() {
        this.toggles.disabled = true;
        const off = new Set((await this.api.settings.list()).map(s => s.name));
        this.toggles.querySelectorAll('[role="switch"]').forEach(t => t.checked = !off.has(t.name));
        this.toggles.disabled = false;
    }

    listen() {
        this.toggles.addEventListener('change', ({ target }) => {
            target.checked ? this.api.settings.enable(target.name) : this.api.settings.disable(target.name);
        });
    }
}