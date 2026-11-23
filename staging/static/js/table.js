class Table {
    static OUTCOMES = {
        // Phosphor, matching production's meaning (Material bolt, person, shield).
        CV: { label: 'Autoclosed', icon: 'lightning' },
        CH: { label: 'By you', icon: 'user' },
        CR: { label: 'Accepted risk', icon: 'shield-warning' },   // the risk remains (Chad, 2026-11-18)
    };

    static SCOPES = {
        threats: s => s.metadata?.threat != null,
        recs: s => s.metadata?.threat == null,
    };

    static HISTORY_LIMIT = 200;

    static due = s => s.due ? Workspace.time(s.due) : Infinity;
    static ended = s => Workspace.time(s.updated ?? s.created);
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

    render({ threats, recs, closed }) {
        this.signals = new Map([...threats, ...recs, ...closed].map(s => [String(s.id), s]));

        this.keepFocus(this.queue, () => {
            this.queue.innerHTML = threats.length
                ? threats.toSorted(Table.urgency).map(s => this.item(s)).join('')
                : this.empty(recs.length);
        });

        this.keepFocus(this.recs, () => {
            this.recs.innerHTML = recs.length
                ? recs.toSorted(Table.recency).map(s => this.item(s)).join('')
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

    // All clear: one quiet line, the same as the accounts screen's (Chad, 2026-11-23: one pattern, little space).
    empty(recs) {
        const hint = recs ? `<span class="all-clear__hint">Work on the ${recs.toLocaleString()} recommendation${recs === 1 ? '' : 's'} while you wait.</span>` : '';
        return `
            <li class="queue-empty queue-clear all-clear">
                <i class="pulse-icon pulse-icon--shield-check pulse-icon--fill" aria-hidden="true"></i>
                <span class="all-clear__title">Nothing urgent right now</span>${hint}
            </li>`;
    }

    item(signal) {
        const esc = Workspace.esc;
        const threat = Table.SCOPES.threats(signal);

        // Pulse list row (a plain row: it holds its own buttons). The row itself opens the signal (click, Enter).
        return `
            <li class="pulse-list-row q-item${threat ? '' : ' rec'}" data-id="${esc(signal.id)}" tabindex="0">
                <span class="pulse-list-row__lead"><span class="pulse-avatar pulse-avatar--sm pulse-avatar--circle pulse-avatar--outline"><img class="q-avatar" src="${esc(Workspace.avatar(signal.source))}" alt=""></span></span>
                <span class="pulse-list-row__main">
                    <span class="pulse-list-row__title" title="${esc(signal.name)}">${esc(signal.name)}</span>
                    ${this.sub(signal)}
                </span>
                <span class="pulse-list-row__trail">${threat ? this.threat(signal.metadata.threat) + this.countdown(signal) : ''}</span>
                ${this.actions()}
            </li>`;
    }

    historyItem(signal) {
        const esc = Workspace.esc;
        const missed = signal.due && Table.ended(signal) > Workspace.time(signal.due);
        const took = Table.span(Table.ended(signal) - Workspace.time(signal.created));
        const kind = Table.SCOPES.threats(signal) ? 'SOC' : 'Rec';
        const outcome = Table.OUTCOMES[signal.status];

        return `
            <li class="pulse-list-row h-item" data-id="${esc(signal.id)}" tabindex="0">
                <span class="pulse-list-row__lead"><i class="h-outcome pulse-icon pulse-icon--${outcome?.icon ?? 'check'} pulse-icon--fill" data-status="${esc(signal.status)}"
                   title="${outcome?.label ?? ''}" role="img" aria-label="${outcome?.label ?? 'Closed'}"></i></span>
                <span class="pulse-list-row__main">
                    <span class="pulse-list-row__title" title="${esc(signal.name)}">${esc(signal.name)}</span>
                    <span class="pulse-list-row__meta">${kind} · ${esc(signal.asset)} · took ${took}${missed ? ' · <em>SLA missed</em>' : ''}</span>
                </span>
                <span class="pulse-list-row__trail"><time>${Workspace.date(signal.updated ?? signal.created)}</time></span>
            </li>`;
    }

    sub(signal) {
        const esc = Workspace.esc;

        return `<span class="pulse-list-row__meta">${esc(signal.asset)} · ${esc(signal.source)} · <span title="${Workspace.date(signal.created, true)}">${Table.ago(signal.created)}</span></span>`;
    }

    static ago(v) {
        const ms = Date.now() - Workspace.time(v);
        return ms < 60000 ? 'just now' : `${Table.span(ms)} ago`;
    }

    actions() {
        return `
            <span class="pulse-list-row__trail pulse-list-row__trail--reveal q-actions">
                <button class="pulse-tooltip-host pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm" type="button" data-move="CR" aria-label="Accept risk"><i class="pulse-icon pulse-icon--shield-warning" aria-hidden="true"></i><span class="pulse-tooltip pulse-tooltip--end" aria-hidden="true">Accept risk</span></button>
                <button class="pulse-tooltip-host pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm" type="button" data-move="CH" aria-label="Close signal"><i class="pulse-icon pulse-icon--check" aria-hidden="true"></i><span class="pulse-tooltip pulse-tooltip--end" aria-hidden="true">Close signal</span></button>
            </span>`;
    }

    threat(threat) {
        const risk = Workspace.risk(threat);
        return risk ? Table.verdict(risk) : '';
    }

    // The verdict as a word in its color, as on the accounts screen (Chad, 2026-11-19): a bare percent had no label. The
    // percent stays in the title and the signal panel. Likely benign stays gray: a signal in the queue isn't done.
    static verdict(risk) {
        return `<span class="q-verdict" data-risk="${risk.level}" title="${risk.pct}% ${risk.label.toLowerCase()}">${risk.label}</span>`;
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