class RiskSidebar {
    constructor(state) {
        this.state = state;
        this.api = state.api.signals;
        this.list = document.getElementById('risk-list');
        this.wrap = document.getElementById('risk-list-wrap');
        this.listen();
    }

    async reset() {
        this.list.innerHTML = '';
    }

    async reload() {
        this.wrap.classList.remove('empty');
        await this.api.list(`status=CR`, new CustomEvent('signal:risk'));
        this.wrap.classList.toggle('empty', this.list.children.length === 0);
    }

    async reopen(id, item) {
        const btn = item.querySelector('.risk-remove');
        btn.disabled = true;

        try {
            await this.api.patch(id, { status: 'OA' });
            item.remove();
            this.wrap.classList.toggle('empty', this.list.children.length === 0);
        } catch (err) {
            btn.disabled = false;
        } finally {
            document.dispatchEvent(new CustomEvent('page:reset'));
        }
    }

    listen() {
        document.addEventListener('signal:risk', (ev) => {
            const signal = ev.signal;
            const item = document.createElement('li');

            item.className = 'entry entry-risk';
            item.dataset.id = signal.id;
            item.innerHTML = `
                <img class="risk-source-icon" src="static/img/source/${signal.source}.png"
                     alt="${signal.source}" onerror="this.replaceWith(Object.assign(document.createElement('span'), {className:'material-symbols-outlined risk-source-fallback', textContent:'travel_explore'}))">
                <span class="risk-name">${signal.name}</span>
                <span class="risk-asset">${signal.asset}</span>
                <span class="risk-accepted">accepted ${Workspace.date(signal.updated)}</span>
                <button class="risk-remove" type="button" title="Reopen risk" aria-label="Reopen risk">
                    <span class="material-symbols-outlined">close</span>
                </button>
            `;

            item.querySelector('.risk-remove').addEventListener('click', () => this.reopen(signal.id, item));
            this.list.appendChild(item);
            this.wrap.classList.remove('empty');
        });
    }
}