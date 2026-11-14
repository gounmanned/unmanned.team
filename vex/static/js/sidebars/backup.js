class BackupSidebar {
    static ICONS = { txt: 'description', csv: 'table_chart', md: 'article', json: 'code', log: 'bug_report', yml: 'code', zip: 'folder_zip', sql: 'storage' };

    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.list = document.getElementById('file-list');
        this.wrap = document.getElementById('file-list-wrap');
        this.crumbs = document.getElementById('file-breadcrumb');
        this.pathStack = [];
        this.listen();
    }

    reset() {
        this.pathStack = [];
    }

    async reload() {
        this.list.innerHTML = '';
        this.wrap.classList.remove('empty');
        this.api.file.root = ['backup', ...this.pathStack].join('/') + '/';
        this.breadcrumb();

        const loader = SiteSpinner.cover(this.wrap);
        const files = await this.api.file.list();
        loader.remove();

        files.forEach(name => this.add(name));
        this.wrap.classList.toggle('empty', !this.list.children.length);
    }

    breadcrumb() {
        const esc = Workspace.esc;
        this.crumbs.innerHTML = ['Backups', ...this.pathStack].map((part, i, all) => i === all.length - 1
            ? `<span class="crumb-active">${esc(part)}</span>`
            : `<span class="crumb-link" data-depth="${i}">${esc(part)}</span><span class="crumb-sep">/</span>`
        ).join('');
    }

    add(name) {
        const path = name.replace(/\/$/, '').replace(/^backup\/?/, '');
        if (!path) return;

        const folder = name.endsWith('/');
        const display = path.split('/').pop();
        const icon = folder ? 'folder' : BackupSidebar.ICONS[display.split('.').pop().toLowerCase()] ?? 'description';

        const item = document.createElement('li');
        item.className = `entry ${folder ? 'entry-folder' : 'entry-file'}`;
        item.innerHTML = `
            <span class="material-symbols-outlined file-icon">${icon}</span>
            <span class="message">${Workspace.esc(display)}</span>
            ${folder ? '<span class="material-symbols-outlined entry-chevron">chevron_right</span>' : ''}`;

        item.addEventListener('click', () => folder ? this.open(display) : this.download(item, display));
        this.list.append(item);
    }

    open(folder) {
        this.pathStack.push(folder);
        this.reload();
    }

    async download(item, name) {
        const spinner = document.createElement('site-spinner');
        spinner.setAttribute('inline', '');
        item.append(spinner);

        try {
            const redirect = await this.api.file.call('GET', `file/${this.api.file.root.replace(/\/$/, '')}?name=${encodeURIComponent(name)}`);
            if (!redirect) return;

            const response = await fetch(redirect.url);
            if (!response.ok) return;

            const a = Object.assign(document.createElement('a'), {
                href: URL.createObjectURL(await response.blob()),
                download: name,
            });
            a.click();
            URL.revokeObjectURL(a.href);
        } finally {
            spinner.remove();
        }
    }

    listen() {
        this.crumbs.addEventListener('click', (e) => {
            const crumb = e.target.closest('.crumb-link');
            if (!crumb) return;
            this.pathStack = this.pathStack.slice(0, Number(crumb.dataset.depth));
            this.reload();
        });
    }
}