class Table {
    static COLUMNS = {
        OA: 'Open',
        OB: 'Waiting on decision',
        CR: 'Accepted risk',
        CH: 'Closed by human',
        CV: 'Closed by VEX',
    };

    constructor(id, { open, move }) {
        this.body = document.querySelector(`#${id} tbody`);
        this.wrap = this.body.closest('.table-wrap');
        this.board = this.wrap.querySelector('.signal-board');
        this.open = open;
        this.move = move;
        this.signals = new Map();

        this.clear();
        this.listen();
        setInterval(() => this.tick(), 1000);
    }

    get size() {
        return this.signals.size;
    }

    clear() {
        this.signals.clear();
        this.body.innerHTML = '';
        this.board.innerHTML = Object.entries(Table.COLUMNS).map(([status, label]) => `
            <section class="board-col" data-status="${status}">
                <header><span>${label}</span><span class="board-col-count">0</span></header>
                <ol class="board-cards"></ol>
            </section>`).join('');
        this.wrap.classList.add('empty');
    }

    toggleView() {
        return this.wrap.classList.toggle('board');
    }

    add(signal) {
        this.signals.set(String(signal.id), signal);
        this.wrap.classList.remove('empty');
        this.renderRow(signal);
        this.renderCard(signal);
    }

    // ── rendering ──────────────────────────────────────────────────

    find(selector, id) {
        return this.wrap.querySelector(`${selector}[data-id="${CSS.escape(String(id))}"]`);
    }

    chip(kind) {
        return `<span class="kind-chip" data-kind="${kind}">${Workspace.KIND[kind]?.label ?? '—'}</span>`;
    }

    metadata(meta) {
        const entries = Object.entries(meta ?? {});
        if (!entries.length) {
            return `<span class="material-symbols-outlined metadata-icon empty">data_object</span>`;
        }

        return `
            <span class="metadata-hover">
                <span class="material-symbols-outlined metadata-icon">data_object</span>
                <dl class="metadata-tooltip">
                    ${entries.map(([k, v]) => `<dt>${Workspace.esc(k)}</dt><dd>${Workspace.esc(v)}</dd>`).join('')}
                </dl>
            </span>`;
    }

    elapsed(signal) {
        const utc = v => Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`);
        const end = signal.status === 'OA' ? Date.now() : utc(signal.updated ?? signal.created);
        const t = Math.max(0, Math.floor((end - utc(signal.created)) / 1000));

        return [t / 3600, (t % 3600) / 60, t % 60]
            .map(n => String(Math.floor(n)).padStart(2, '0'))
            .join(':');
    }

    renderRow(signal) {
        const row = this.find('tr', signal.id) ?? document.createElement('tr');
        const closed = signal.status.startsWith('C');
        const unread = !signal.read && !closed;
        const timed = signal.kind == 4;

        Object.assign(row.dataset, { id: signal.id, status: signal.status, kind: signal.kind, updated: signal.updated });
        row.classList.toggle('unread', unread);
        row.classList.toggle('closed', closed);
        row.innerHTML = `
            <td><img src="${Workspace.avatar(signal.source)}"/></td>
            <td class="kind">${this.chip(signal.kind)}</td>
            <td class="name" title="${Workspace.esc(signal.name)}">${Workspace.esc(signal.name.substring(0, 99))}</td>
            <td class="id">#${signal.id}</td>
            <td class="metadata">${this.metadata(signal.metadata)}</td>
            <td class="source">${Workspace.esc(signal.asset)}</td>
            <td class="created">${Workspace.date(signal.created)}</td>
            <td class="elapsed ${timed && signal.status === 'OA' ? 'live' : ''}">${timed ? this.elapsed(signal) : ''}</td>
            <td class="autoclose"></td>`;

        if (closed) return this.body.append(row);

        const anchor = [...this.body.children].find(r => {
            if (r === row || r.classList.contains('closed')) return false;
            const rUnread = r.classList.contains('unread');
            return unread !== rUnread ? unread : new Date(r.dataset.updated) < new Date(signal.updated);
        });

        this.body.insertBefore(row, anchor ?? this.body.querySelector('tr.closed'));
    }

    renderCard(signal) {
        const card = this.find('.board-card', signal.id)
            ?? Object.assign(document.createElement('li'), { className: 'board-card', draggable: true });

        card.dataset.id = signal.id;
        card.innerHTML = `
            <div class="board-card-top">
                <img src="${Workspace.avatar(signal.source)}" alt="">
                ${this.chip(signal.kind)}
            </div>
            <div class="board-card-name" title="${Workspace.esc(signal.name)}">${Workspace.esc(signal.name)}</div>
            <div class="board-card-meta">
                <span>${Workspace.esc(signal.asset)}</span>
                <span>${Workspace.date(signal.created)}</span>
            </div>`;

        const list = this.board.querySelector(`[data-status="${signal.status}"] .board-cards`);
        list ? list.prepend(card) : card.remove();

        this.board.querySelectorAll('.board-col').forEach(col => {
            col.querySelector('.board-col-count').textContent = col.querySelector('.board-cards').children.length;
        });
    }

    tick() {
        this.body.querySelectorAll('tr[data-kind="4"][data-status="OA"] td.elapsed').forEach(cell => {
            cell.textContent = this.elapsed(this.signals.get(cell.parentElement.dataset.id));
        });
    }

    // ── interaction ────────────────────────────────────────────────

    async drop(signal, status) {
        if (!signal || signal.status === status) return;
        this.renderCard({ ...signal, status });

        try {
            await this.move(signal, status);
        } catch (err) {
            console.error('status update failed', err);
            this.renderCard(signal);
        }
    }

    listen() {
        this.wrap.addEventListener('click', (e) => {
            const el = e.target.closest('tr[data-id], .board-card');
            if (!el) return;
            e.stopPropagation();
            this.open(this.signals.get(el.dataset.id));
        });

        this.board.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', e.target.closest('.board-card').dataset.id);
        });

        this.board.addEventListener('dragover', (e) => {
            if (e.target.closest('.board-col')) e.preventDefault();
        });

        this.board.addEventListener('drop', (e) => {
            const col = e.target.closest('.board-col');
            if (!col) return;
            e.preventDefault();
            this.drop(this.signals.get(e.dataTransfer.getData('text/plain')), col.dataset.status);
        });
    }
}