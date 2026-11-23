class BackupSidebar {
    // Phosphor file icons from Pulse.
    static ICONS = { txt: 'file-text', csv: 'file-csv', md: 'file-md', json: 'file-code', log: 'bug', yml: 'file-code', zip: 'file-zip', sql: 'file-sql' };

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

        const files = await this.api.file.list();
        files.forEach(name => this.add(name));
        this.wrap.classList.toggle('empty', !this.list.children.length);
    }

    async browse() {
        const loader = SiteSpinner.cover(this.wrap);
        await this.reload();
        loader.remove();
    }

    breadcrumb() {
        const esc = Workspace.esc;
        // Pulse breadcrumb. The steps open a folder here, so they are buttons styled as quiet links.
        this.crumbs.innerHTML = `<ol>${['Backups', ...this.pathStack].map((part, i, all) => i === all.length - 1
            ? `<li><span aria-current="page">${esc(part)}</span></li>`
            : `<li><button type="button" class="pulse-link pulse-link--quiet pulse-link--sm crumb-link" data-depth="${i}">${esc(part)}</button></li>`
        ).join('')}</ol>`;
    }

    add(name) {
        const path = name.replace(/\/$/, '').replace(/^backup\/?/, '');
        if (!path) return;

        const folder = name.endsWith('/');
        const display = path.split('/').pop();
        const icon = folder ? 'folder' : BackupSidebar.ICONS[display.split('.').pop().toLowerCase()] ?? 'file-text';

        // Pulse list row you can open: a folder opens here, a file downloads.
        const item = document.createElement('li');
        item.innerHTML = `
            <button type="button" class="pulse-list-row entry ${folder ? 'entry-folder' : 'entry-file'}" aria-label="${folder ? 'Open' : 'Download'} ${Workspace.esc(display)}">
                <span class="pulse-list-row__lead"><i class="pulse-icon pulse-icon--${icon} file-icon" aria-hidden="true"></i></span>
                <span class="pulse-list-row__main"><span class="pulse-list-row__title">${Workspace.esc(display)}</span></span>
                ${folder ? '<span class="pulse-list-row__trail"><i class="pulse-icon pulse-icon--arrow-right entry-chevron" aria-hidden="true"></i></span>' : ''}
            </button>`;

        item.firstElementChild.addEventListener('click', () => folder ? this.open(display) : this.download(item.firstElementChild, display));
        this.list.append(item);
    }

    open(folder) {
        this.pathStack.push(folder);
        this.browse();
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
            this.browse();
        });
    }
}