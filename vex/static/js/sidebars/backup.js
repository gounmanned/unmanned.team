class BackupSidebar {
    constructor(state) {
        this.state = state;
        this.api = new FileApi();
        this.list = document.getElementById('file-list');
        this.wrap = document.getElementById('file-list-wrap');
        this.pathStack = [];
    }

    async reset() {
        this.api.set('account', this.state.account());
        this.pathStack = [];
        await this.reload();
    }

    async reload() {
        this.list.innerHTML = '';
        this.api.root = ['backup', ...this.pathStack].join('/') + '/';
        this.breadcrumb();

        const files = await this.api.list();
        files.forEach(name => this.add(name));
        this.wrap.classList.toggle('empty', files.length === 0);
    }

    breadcrumb() {
        const bar = document.getElementById('file-breadcrumb');
 
        bar.innerHTML = ['root', ...this.pathStack].map((part, i, arr) => {
            const last = i === arr.length - 1;
            return last
                ? `<span class="crumb-active">${part}</span>`
                : `<span class="crumb-link" data-depth="${i}">${part}</span><span class="crumb-sep">›</span>`;
        }).join('');

        bar.querySelectorAll('.crumb-link').forEach(el => {
            el.addEventListener('click', () => {
                this.pathStack = this.pathStack.slice(0, parseInt(el.dataset.depth));
                this.reload();
            });
        });
    }

    add(name) {
        const folder = name.endsWith('/');
        const rawName = name.replace(/\/$/, '');
        const stripped = rawName.replace(/^backup\/?/, '');
        if (!stripped) return;

        const displayName = stripped.split('/').pop();
        const icons = { txt: 'description', csv: 'table_chart', md: 'article', json: 'code', log: 'bug_report', yml: 'code', zip: 'folder_zip', sql: 'storage' };
        const icon = folder ? 'folder' : (icons[displayName.split('.').pop().toLowerCase()] || 'description');

        const item = document.createElement('li');
        item.className = `entry ${folder ? 'entry-folder' : 'entry-file'}`;
        item.innerHTML = `
            <span class="material-symbols-outlined file-icon">${icon}</span>
            <span class="message">${displayName}</span>
            ${folder ? '<span class="material-symbols-outlined entry-chevron">chevron_right</span>' : ''}
        `;

        item.addEventListener('click', async () => {
            if (folder) {
                this.pathStack.push(displayName);
                this.reload();
            } else {
                const redirect = await this.api.call('GET', `file/${this.api.root.replace(/\/$/, '')}?name=${displayName}`);
                if (!redirect) return;
                const response = await fetch(redirect.url, { method: 'GET' });
                if (!response.ok) return;

                const blob = await response.blob();
                const a = Object.assign(document.createElement('a'), {
                    href: URL.createObjectURL(blob),
                    download: displayName
                });

                a.click();
                URL.revokeObjectURL(a.href);
            }
        });

        this.list.appendChild(item);
    }
}