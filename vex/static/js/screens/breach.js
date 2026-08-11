class BreachScreen {
    static DAYS = 7;

    constructor(state) {
        this.state = state;
        this.api = new BreachApi();
        this.watermark = document.querySelector('#breach-screen site-watermark');

        this.railEl = document.getElementById('breach-rail');
        this.rangeEl = document.getElementById('breach-rail-range');
        this.body = document.getElementById('breach-body');
        this.detailEmpty = document.getElementById('breach-detail-empty');
        this.detailContent = document.getElementById('breach-detail-content');

        this.titleEl = document.getElementById('breach-title');
        this.timestampEl = document.getElementById('breach-timestamp');
        this.narrativeEl = document.getElementById('breach-narrative');

        this.signalImgEl = document.getElementById('breach-signal-img');
        this.signalNameEl = document.getElementById('breach-signal-name');
        this.severityBadgeEl = document.getElementById('breach-severity-badge');
        this.signalIdEl = document.getElementById('breach-signal-id');
        this.statAssetEl = document.getElementById('breach-stat-asset');
        this.statSourceEl = document.getElementById('breach-stat-source');
        this.strengthFillEl = document.getElementById('breach-strength-fill');
        this.strengthCountEl = document.getElementById('breach-strength-count');
        this.signalFoundEl = document.getElementById('breach-signal-found');

        this.breaches = [];
        this.selectedIndex = BreachScreen.DAYS - 1;
        this.listen();
    }

    async reset() {
        this.api.set("account", this.state.account());
        this.watermark.show("Generated scenario");
        this.breaches = [];
        this.selectedIndex = BreachScreen.DAYS - 1;
        this.render();
    }

    async reload() {
        this.breaches = await this.api.list();
        this.watermark.hide();
        this.render();
    }

    render() {
        this.week = BreachScreen._buildWeek(this.breaches);
        this._renderRail();
        this._renderDetail();
    }

    listen() {
        this.railEl.addEventListener('click', ev => {
            const btn = ev.target.closest('.breach-day');
            if (!btn || btn.classList.contains('breach-day-empty')) return;

            this.selectedIndex = Number(btn.dataset.index);
            this._renderRail();
            this._renderDetail();
        });
    }

    _renderRail() {
        const first = this.week.find(d => d.breach)?.date;
        const last = this.week[this.week.length - 1].date;
        this.rangeEl.textContent = first ? `${BreachScreen._formatShort(first)} – ${BreachScreen._formatShort(last)}` : '';

        this.railEl.innerHTML = this.week.map((slot, i) => {
            const isToday = i === BreachScreen.DAYS - 1;
            const isSelected = i === this.selectedIndex;
            const empty = !slot.breach;
            const signal = slot.breach ? this._signalFor(slot.breach) : null;
            const labelDate = slot.breach ? new Date(slot.breach.created) : slot.date;
            const classes = [
                'breach-day',
                isToday ? 'is-today' : '',
                isSelected ? 'is-selected' : '',
                empty ? 'breach-day-empty' : ''
            ].filter(Boolean).join(' ');

            return `
                <button type="button" class="${classes}" data-index="${i}" ${empty ? 'disabled' : ''}
                    aria-pressed="${isSelected}" aria-label="${BreachScreen._formatFull(labelDate)}${empty ? ', no scenario' : ''}">
                    <span class="breach-day-node">
                        ${empty ? '' : labelDate.getDate()}
                        ${signal ? `<span class="breach-day-dot" data-severity="${signal.severity}"></span>` : ''}
                    </span>
                    <span class="breach-day-label">${BreachScreen._monthShort(labelDate)}</span>
                </button>
            `;
        }).join('');
    }

    _renderDetail() {
        const slot = this.week[this.selectedIndex];
        const breach = slot?.breach;

        this.body.classList.toggle('empty', !breach);
        if (!breach) return;

        const signal = this._signalFor(breach);

        this.titleEl.textContent = breach.name;
        this.timestampEl.textContent = BreachScreen._formatFull(new Date(breach.created));
        this.narrativeEl.innerHTML = BreachScreen._narrative(breach.value);

        if (signal) this._renderSignal(signal);
    }

    _renderSignal(signal) {
        const severityLabel = Workspace.SEVERITY[signal.severity] || '—';

        this.signalImgEl.src = `static/img/source/${encodeURIComponent(signal.source)}.png`;
        this.signalImgEl.alt = signal.source;
        this.signalNameEl.textContent = signal.name;

        this.severityBadgeEl.textContent = severityLabel;
        this.severityBadgeEl.setAttribute('data-severity', signal.severity);

        this.signalIdEl.textContent = `Signal ${signal.id}`;
        this.statAssetEl.innerHTML = BreachScreen._breakable(signal.asset);
        this.statSourceEl.textContent = BreachScreen._capitalize(signal.source);

        const strength = signal.metadata?.strength ?? 0;
        const STRENGTH_SCALE = 10;
        this.strengthFillEl.style.width = `${Math.min(100, (strength / STRENGTH_SCALE) * 100)}%`;
        this.strengthCountEl.textContent = `${strength}× in scenarios`;

        this.signalFoundEl.innerHTML = `Signal first seen <b>${BreachScreen._formatFull(new Date(signal.created))}</b>`;
    }

    _signalFor(breach) {
        return (this.state.signals[this.state.account()] || {})[breach.id] || null;
    }

    static _buildWeek(breaches) {
        const slots = [];
        for (let i = BreachScreen.DAYS - 1; i >= 0; i--) {
            const date = BreachScreen._daysAgo(i);
            const breach = breaches.find(b => BreachScreen._isSameDay(new Date(b.created), date)) || null;
            slots.push({ date, breach });
        }
        return slots;
    }

    static _narrative(raw) {
        return BreachScreen._splitParagraphs(raw).map((p, i) => `
            <div class="breach-narrative-step ${/choke point/i.test(p) ? 'is-choke' : ''}">
                <span class="breach-narrative-index">${i + 1}</span>
                <p class="breach-narrative-text">${BreachScreen._esc(p)}</p>
            </div>
        `).join('');
    }

    static _splitParagraphs(raw) {
        if (!raw) return [];
        return raw.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean);
    }

    static _capitalize(s) {
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    }

    static _esc(s) {
        const div = document.createElement('div');
        div.textContent = s ?? '';
        return div.innerHTML;
    }

    static _breakable(s) {
        return BreachScreen._esc(s).replace(/([.\-@])/g, '$1<wbr>');
    }

    static _daysAgo(n) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - n);
        return d;
    }

    static _isSameDay(a, b) {
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    static _monthShort(d) {
        return d.toLocaleDateString(undefined, { month: 'short' });
    }

    static _formatShort(d) {
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    static _formatFull(d) {
        return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
}