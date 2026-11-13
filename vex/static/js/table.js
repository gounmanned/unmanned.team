class Table {
    static COLUMNS = {
        OB: 'Waiting on decision',
        CR: 'Accepted risk',
        CH: 'Closed by human',
        CV: 'Autoclosed by VEX',
    };

    static SCOPES = {
        all: () => true,
        threats: s => s.metadata?.threat != null,
        recs: s => s.metadata?.threat == null,
    };

    static OUTCOME_ICONS = { CV: 'bolt', CH: 'person', CR: 'shield' };
    static HISTORY_LIMIT = 200;

    static due = s => s.due ? Workspace.time(s.due) : Infinity;
    static ended = s => Workspace.time(s.updated ?? s.created);

    // most overdue / soonest due first, then highest threat, then oldest
    static urgency = (a, b) =>
        Table.due(a) - Table.due(b) ||
        (b.metadata?.threat ?? 0) - (a.metadata?.threat ?? 0) ||
        Workspace.time(a.created) - Workspace.time(b.created);

    static recency = (a, b) => Table.ended(b) - Table.ended(a);

    constructor({ queue, recs, history, open, move }) {
        this.queue = queue;
        this.recs = recs;
        this.history = history;
        this.open = open;
        this.move = move;
        this.signals = new Map();

        this.listen();
        setInterval(() => this.tick(), 1000);
    }

    // ── render ─────────────────────────────────────────────────────

    render({ threats, recs, closed, handled }) {
        this.signals = new Map([...threats, ...recs, ...closed].map(s => [String(s.id), s]));

        this.keepFocus(this.queue, () => {
            this.queue.innerHTML = threats.length
                ? threats.toSorted(Table.urgency).map(s => this.threatItem(s)).join('')
                : this.empty(handled);
        });

        this.keepFocus(this.recs, () => {
            this.recs.innerHTML = recs.length
                ? recs.toSorted(Table.recency).map(s => this.recItem(s)).join('')
                : `<li class="queue-none">No open recommendations.</li>`;
        });

        const sorted = closed.toSorted(Table.recency);
        const shown = sorted.slice(0, Table.HISTORY_LIMIT);
        const more = sorted.length > shown.length
            ? `<li class="history-more">Showing ${shown.length} of ${sorted.length.toLocaleString()}</li>`
            : '';

        this.keepFocus(this.history, () => {
            this.history.innerHTML = shown.length
                ? shown.map(s => this.historyItem(s)).join('') + more
                : `<li class="history-more">Nothing closed in this period.</li>`;
        });
    }

    keepFocus(list, draw) {
        const id = list.contains(document.activeElement) && document.activeElement.closest('li[data-id]')?.dataset.id;
        draw();
        if (id) list.querySelector(`li[data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    }

    empty(handled) {
        return `
            <li class="queue-empty">
                <span class="material-symbols-outlined">verified_user</span>
                <h3>Nothing needs you</h3>
                <p>VEX has handled ${handled.toLocaleString()} signal${handled === 1 ? '' : 's'} this period.</p>
            </li>`;
    }

    threatItem(signal) {
        const esc = Workspace.esc;

        return `
            <li class="q-item${signal.read ? '' : ' unread'}" data-id="${esc(signal.id)}" tabindex="0">
                <img class="q-avatar" src="${esc(Workspace.avatar(signal.source))}" alt="">
                <div class="q-main">
                    <div class="q-name" title="${esc(signal.name)}">${esc(signal.name)}</div>
                    ${this.sub(signal)}
                </div>
                ${this.threat(signal.metadata?.threat)}
                ${this.countdown(signal)}
                ${this.actions()}
            </li>`;
    }

    recItem(signal) {
        const esc = Workspace.esc;

        return `
            <li class="q-item rec${signal.read ? '' : ' unread'}" data-id="${esc(signal.id)}" tabindex="0">
                <img class="q-avatar" src="${esc(Workspace.avatar(signal.source))}" alt="">
                <div class="q-main">
                    <div class="q-name" title="${esc(signal.name)}">${esc(signal.name)}</div>
                    ${this.sub(signal)}
                </div>
                ${this.actions()}
            </li>`;
    }

    historyItem(signal) {
        const esc = Workspace.esc;
        const missed = signal.due && Table.ended(signal) > Workspace.time(signal.due);
        const took = Table.span(Table.ended(signal) - Workspace.time(signal.created));
        const kind = signal.metadata?.threat != null ? 'SOC' : 'Rec';

        return `
            <li class="h-item" data-id="${esc(signal.id)}" tabindex="0">
                <span class="h-outcome material-symbols-outlined" data-status="${esc(signal.status)}"
                      title="${Table.COLUMNS[signal.status] ?? ''}">${Table.OUTCOME_ICONS[signal.status] ?? 'done'}</span>
                <div class="h-main">
                    <div class="h-name" title="${esc(signal.name)}">${esc(signal.name)}</div>
                    <div class="h-sub">${kind} · ${esc(signal.asset)} · took ${took}${missed ? ' · <em>SLA missed</em>' : ''}</div>
                </div>
                <time>${Workspace.date(signal.updated ?? signal.created)}</time>
            </li>`;
    }

    sub(signal) {
        const esc = Workspace.esc;

        return `
            <div class="q-sub">
                <span>${esc(signal.asset)}</span>
                <span>${esc(signal.source)}</span>
                <span title="${Workspace.date(signal.created, true)}">${Table.ago(signal.created)}</span>
            </div>`;
    }

    static ago(v) {
        const ms = Date.now() - Workspace.time(v);
        return ms < 60000 ? 'just now' : `${Table.span(ms)} ago`;
    }

    actions() {
        return `
            <div class="q-actions">
                <button type="button" data-move="CR" title="Accept risk"><span class="material-symbols-outlined">shield</span></button>
                <button type="button" data-move="CH" title="Close"><span class="material-symbols-outlined">check</span></button>
            </div>`;
    }

    threat(threat) {
        const risk = Workspace.risk(threat);
        return risk
            ? `<span class="threat-chip" data-risk="${risk.level}" title="${risk.label}">${risk.pct}%</span>`
            : `<span class="threat-chip empty"></span>`;
    }

    countdown(signal) {
        if (!signal.due) return `<span class="q-due none">No SLA</span>`;

        const left = Workspace.time(signal.due) - Date.now();
        const state = left < 0 ? 'overdue' : left < 3600000 ? 'soon' : '';
        const label = left < 0 ? `${Table.span(-left)} over SLA` : `due in ${Table.span(left)}`;

        return `<span class="q-due ${state}" data-due title="Due ${Workspace.date(signal.due, true)}">${label}</span>`;
    }

    static span(ms) {
        const m = Math.max(0, Math.round(ms / 60000));
        if (m < 60) return `${m}m`;
        if (m < 1440) return `${Math.floor(m / 60)}h ${m % 60}m`;
        return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
    }

    tick() {
        this.queue.querySelectorAll('.q-due[data-due]').forEach(el => {
            el.outerHTML = this.countdown(this.signals.get(el.closest('li').dataset.id));
        });
    }

    // ── interaction ────────────────────────────────────────────────

    listen() {
        for (const list of [this.queue, this.recs, this.history]) {
            list.addEventListener('click', (e) => {
                const li = e.target.closest('li[data-id]');
                if (!li) return;
                e.stopPropagation();

                const signal = this.signals.get(li.dataset.id);
                const action = e.target.closest('[data-move]');
                action ? this.move(signal, action.dataset.move) : this.open(signal);
            });

            list.addEventListener('keydown', (e) => {
                const li = e.target.closest('li[data-id]');
                if (!li) return;

                const step = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 }[e.key];
                if (step) {
                    e.preventDefault();
                    (step > 0 ? li.nextElementSibling : li.previousElementSibling)?.focus();
                }
                if (e.key === 'Enter' && e.target === li) this.open(this.signals.get(li.dataset.id));
            });
        }
    }
}