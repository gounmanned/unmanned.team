class ComplianceSidebar {
    static FAMILIES = {
        AC: 'Access Control',
        AT: 'Awareness and Training',
        AU: 'Audit and Accountability',
        CM: 'Configuration Management',
        IA: 'Identification and Authentication',
        IR: 'Incident Response',
        MA: 'Maintenance',
        MP: 'Media Protection',
        PS: 'Personnel Security',
        PE: 'Physical Protection',
        RA: 'Risk Assessment',
        CA: 'Security Assessment',
        SC: 'System and Communications Protection',
        SI: 'System and Information Integrity',
    };

    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.list = document.getElementById('compliance-list');
        this.strip = document.getElementById('compliance-bar');
        this.filter = document.getElementById('compliance-filter');
        this.stats = {
            score: document.getElementById('compliance-score'),
            met: document.getElementById('compliance-met'),
            open: document.getElementById('compliance-open'),
            families: document.getElementById('compliance-families'),
        };

        this.filter.addEventListener('click', e => this.show(e.target.closest('[data-filter]')));
        this.reset();
    }

    reset() {
        this.rows = [];
        this.counters = [];
    }

    async reload() {
        this.reset();
        this.skeleton();
        this.rows = await this.api.compliance.get('cmmc');

        const families = Object.entries(Object.groupBy(this.rows, row => row.family));
        this.list.replaceChildren(...families.map(([code, rows]) => this.family(code, rows)));
        this.strip.replaceChildren(...families.map(([code, rows]) => this.segment(code, rows)));
        this.tally();
        this.reveal();
    }

    browse() {
        return this.reload();
    }

    // ── render ─────────────────────────────────────────────────────

    family(code, rows) {
        const esc = Workspace.esc;
        const el = document.createElement('details');
        el.className = 'family';
        el.dataset.family = code;
        el.innerHTML = `
            <summary class="family-head">
                <span class="family-code">${esc(code)}</span>
                <span class="family-name">${esc(ComplianceSidebar.FAMILIES[code] ?? code)}</span>
                <span class="meter"></span>
                <span class="tally"></span>
                <span class="material-symbols-outlined family-chevron">expand_more</span>
            </summary>
            <div class="practices"></div>`;
        this.counter(el, rows);

        el.querySelector('.practices').append(...Object.values(Object.groupBy(rows, row => row.practice_id))
            .map(objectives => this.practice(objectives)));
        return el;
    }

    practice(objectives) {
        const esc = Workspace.esc;
        const [first] = objectives;
        const el = document.createElement('section');
        el.className = 'practice';
        el.innerHTML = `
            <header class="practice-head">
                <span class="practice-id">${esc(first.practice_id)}</span>
                <span class="meter"></span>
                <span class="tally"></span>
                <p class="practice-text">${esc(first.requirement_text)}</p>
            </header>
            <ol class="objectives"></ol>`;
        this.counter(el, objectives);

        el.querySelector('.objectives').append(...objectives.map(row => this.objective(row)));
        return el;
    }

    objective(row) {
        const item = document.createElement('li');
        item.className = 'objective';
        item.innerHTML = `
            <label class="objective-main">
                <input type="checkbox" class="objective-status" aria-label="Objective met">
                <span class="objective-text">${Workspace.esc(row.assessment_objective)}</span>
            </label>
            <div class="objective-fields">
                <label class="field">
                    <span class="material-symbols-outlined">person</span>
                    <input type="email" name="owner" placeholder="Owner email" spellcheck="false" autocomplete="off">
                </label>
                <label class="field">
                    <span class="material-symbols-outlined">link</span>
                    <input type="url" name="evidence" placeholder="Link to policy doc" pattern="https?://.+" spellcheck="false" autocomplete="off">
                    <a class="material-symbols-outlined evidence-open" target="_blank" rel="noopener" title="Open evidence">open_in_new</a>
                </label>
            </div>`;

        const status = item.querySelector('.objective-status');
        status.checked = row.status;
        item.classList.toggle('met', row.status);
        status.addEventListener('change', () => {
            row.status = status.checked;
            item.classList.toggle('met', row.status);
            this.tally();
            row.status ? this.save(row) : this.remove(row);
        });

        item.querySelectorAll('input[name]').forEach(input => {
            input.value = row[input.name] ?? '';
            input.addEventListener('change', () => {
                if (!input.checkValidity()) return;
                row[input.name] = input.value.trim();
                this.link(item, row);
            });
        });

        this.link(item, row);
        return item;
    }

    segment(code, rows) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'segment';
        el.style.flexGrow = rows.length;
        el.title = ComplianceSidebar.FAMILIES[code] ?? code;
        el.addEventListener('click', () => this.jump(code));
        this.counter(el, rows);
        return el;
    }

    link(item, row) {
        const open = item.querySelector('.evidence-open');
        open.href = row.evidence;
        open.hidden = !row.evidence;
    }

    skeleton() {
        Object.values(this.stats).forEach(el => el.textContent = '—');
        this.strip.replaceChildren();
        this.list.innerHTML = [[132, 1], [176, 0.85], [150, 0.7], [196, 0.55], [120, 0.4], [164, 0.25]]
            .map(([width, opacity]) => `
                <div class="family-ghost" style="opacity:${opacity}" aria-hidden="true">
                    <i class="shimmer" style="width:28px;height:20px"></i>
                    <i class="shimmer" style="width:${width}px"></i>
                </div>`).join('');
    }

    reveal() {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        [...this.list.children].forEach((el, i) => el.animate(
            [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
            { duration: 280, delay: i * 28, easing: 'ease-out', fill: 'backwards' },
        ));
    }

    // ── state ──────────────────────────────────────────────────────

    counter(host, rows) {
        this.counters.push({ host, rows, tally: host.querySelector('.tally') });
    }

    tally() {
        const met = rows => rows.filter(row => row.status).length;

        this.counters.forEach(({ host, rows, tally }) => {
            const done = met(rows);
            host.style.setProperty('--pct', `${done / rows.length * 100}%`);
            host.classList.toggle('complete', done === rows.length);
            host.classList.toggle('untouched', done === 0);
            if (tally) tally.textContent = `${done}/${rows.length}`;
        });

        const done = met(this.rows);
        const pct = Math.round(done / this.rows.length * 100);
        const families = this.list.querySelectorAll('.family');

        this.stats.score.textContent = `${pct}%`;
        this.stats.score.classList.toggle('complete', pct === 100);
        this.stats.met.textContent = done.toLocaleString();
        this.stats.open.textContent = (this.rows.length - done).toLocaleString();
        this.stats.families.textContent = `${[...families].filter(f => f.matches('.complete')).length}/${families.length}`;
    }

    show(tab) {
        if (!tab) return;
        this.filter.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', b === tab));
        this.list.dataset.filter = tab.dataset.filter;
    }

    jump(code) {
        const family = this.list.querySelector(`[data-family="${code}"]`);
        family.open = true;
        family.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    save(row) {
        return this.api.compliance.put('cmmc', row.practice_id, row.owner, row.evidence);
    }

    remove(row) {
        return this.api.compliance.remove('cmmc', row.practice_id);
    }
}