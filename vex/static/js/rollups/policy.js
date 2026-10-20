class PolicyRollup {
    static isMet(p) { return p.status == 1; }

    constructor(state) {
        this.state = state;
        this.api = state.api.policy;

        this.familiesEl = document.getElementById('cmmc-families');
        this.tbody = document.querySelector('#cmmc-table tbody');
        this.search = document.getElementById('cmmc-search');
        this.scope = document.getElementById('cmmc-scope');
        this.count = document.getElementById('cmmc-count');
        this.countNote = document.getElementById('cmmc-note');

        this.policies = [];
        this.query = '';
        this.family = null;
        this.listen();
    }

    async reset() {
        this.policies = [];
        this.query = '';
        this.family = null;
        this.search.value = '';
        this.render();
    }

    async reload() {
        this.policies = await this.api.list();
        this.render();
    }

    families() {
        const groups = new Map();
        this.policies.forEach(p => {
            const g = groups.get(p.family) ?? { name: p.family, total: 0, met: 0 };
            g.total++;
            if (PolicyRollup.isMet(p)) g.met++;
            groups.set(p.family, g);
        });
        return [...groups.values()];
    }

    // ---- rendering ----

    render() {
        this.renderCount();
        this.renderFamilies();
        this.renderRows();
    }

    renderCount() {
        const total = this.policies.length;
        const met = this.policies.filter(PolicyRollup.isMet).length;
        this.count.textContent = `${total ? Math.round(met / total * 100) : 0}%`;
        this.countNote.textContent = met === total ? 'All objectives met' : `${met} of ${total} · ${total - met} remaining`;
    }

    renderFamilies() {
        this.familiesEl.innerHTML = this.families().map(({ name, total, met }) => {
            const done = met === total;
            const active = this.family === name;
            return `
                <button type="button" role="tab" data-family="${name}" title="${name}"
                        class="cmmc-family ${done ? 'is-complete' : ''} ${active ? 'active' : ''}">
                    <span class="material-symbols-outlined cmmc-family-icon">${done ? 'check_circle' : 'radio_button_unchecked'}</span>
                    <span class="cmmc-family-name">${name}</span>
                    <span class="cmmc-family-note">${met} of ${total}</span>
                    <span class="cmmc-bar"><span style="width:${met / total * 100}%"></span></span>
                </button>
            `;
        }).join('');
    }

    renderRows() {
        const rows = this.policies.filter(p =>
            (!this.family || p.family === this.family)
            && `${p.practice_id} ${p.requirement_id} ${p.requirement_text} ${p.objective_id} ${p.objective} ${p.owner ?? ''} ${p.evidence ?? ''}`
                .toLowerCase().includes(this.query));

        this.scope.textContent = `${this.family ?? 'All families'} · ${rows.length} objectives`;

        if (!rows.length) {
            this.tbody.innerHTML = `<tr class="cmmc-empty"><td colspan="9">No objectives match</td></tr>`;
            return;
        }

        this.tbody.innerHTML = rows.map((p, i) => this.rowHtml(p, rows[i - 1]?.requirement_id === p.requirement_id)).join('');
    }

    rowHtml(p, repeat) {
        const met = PolicyRollup.isMet(p);
        return `
            <tr class="${met ? 'is-met' : ''} ${repeat ? 'is-repeat' : ''}">
                <td class="cmmc-muted">${p.family}</td>
                <td class="cmmc-id cmmc-req">${p.practice_id}</td>
                <td class="cmmc-id cmmc-req">${p.requirement_id}</td>
                <td class="cmmc-wrap cmmc-req">${p.requirement_text}</td>
                <td class="cmmc-id">${p.objective_id}</td>
                <td class="cmmc-wrap">${p.objective}</td>
                <td>
                    <span class="cmmc-status">
                        <span class="material-symbols-outlined">${met ? 'check_circle' : 'cancel'}</span>
                        ${met ? 'Met' : 'Not met'}
                    </span>
                </td>
                <td>${p.owner || '<span class="cmmc-muted">—</span>'}</td>
                <td class="cmmc-wrap">${p.evidence || '<span class="cmmc-muted">—</span>'}</td>
            </tr>
        `;
    }

    // ---- events ----

    listen() {
        this.search.addEventListener('input', ev => {
            this.query = ev.target.value.trim().toLowerCase();
            this.renderRows();
        });

        this.familiesEl.addEventListener('click', ev => {
            const card = ev.target.closest('[data-family]');
            if (!card) return;
            this.family = this.family === card.dataset.family ? null : card.dataset.family;
            this.render();
        });
    }
}