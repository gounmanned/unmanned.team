class BreachScreen {
    constructor(state) {
        this.state = state;
        this.api = new BreachApi();
        this.screen = document.getElementById('breach-screen');
        this.watermark = this.screen.querySelector('site-watermark');
        this.left = document.getElementById('breach-left');
        this.list = document.getElementById('breach-signal-list');
        this.detailEmpty = document.getElementById('breach-detail-empty');
        this.detailContent = document.getElementById('breach-detail-content');
        this.titleEl = document.getElementById('breach-title');
        this.timestampEl = document.getElementById('breach-timestamp');
        this.narrativeEl = document.getElementById('breach-narrative');

        this.breach = null;
        this._renderSignals();
        this._renderDetail();
    }

    async reset() {
        this.watermark.show("Loading breach scenario");
        this.breach = null;
        this._renderSignals();
        this._renderDetail();
    }

    async reload() {
        const breaches = await this.api.list();
        this.breach = Array.isArray(breaches) && breaches.length ? breaches[0] : null;
        this._renderSignals();
        this._renderDetail();
        this.watermark.hide();
    }

    _hasBreach() {
        return !!this.breach;
    }

    _signals() {
        if (!this._hasBreach()) return [];

        const tracked = this.state.signals[this.state.account()] || {};
        const wanted = new Set(this.breach.signals.map(id => String(id)));
        return Object.values(tracked).filter(signal => wanted.has(String(signal.id)));
    }

    _renderSignals() {
        const signals = this._signals();
        this.left.classList.toggle('empty', signals.length === 0);
        this.list.innerHTML = signals.map(s => this._card(s)).join('');
    }

    _card(signal) {
        return `
            <li class="breach-signal-card" data-id="${signal.id}">
                <span class="breach-signal-icon">
                    <img src="static/img/source/${signal.source}.png" alt="${signal.source}">
                </span>
                <div class="breach-signal-body">
                    <div class="breach-signal-name">${signal.name}</div>
                    <div class="breach-signal-meta">
                        Found on <span class="breach-signal-created">${this._formatDate(signal.created)}</span>
                    </div>
                </div>
            </li>
        `;
    }

    _renderDetail() {
        if (!this._hasBreach()) {
            this.detailEmpty.style.display = 'flex';
            this.detailContent.style.display = 'none';
            return;
        }

        this.detailEmpty.style.display = 'none';
        this.detailContent.style.display = 'flex';

        this.titleEl.textContent = this.breach.name;
        this.timestampEl.textContent = this._formatDate(this.breach.created);

        const signalCount = (this.breach.signals || []).length;
        const paragraphs = this._splitParagraphs(this.breach.value || '', signalCount);

        this.narrativeEl.innerHTML = paragraphs.map((p, i) => `
            <div class="breach-narrative-step">
                <span class="breach-narrative-index">${i + 1}</span>
                <p class="breach-narrative-text">${p}</p>
            </div>
        `).join('');
    }

    _splitParagraphs(raw, signalCount) {
        if (!raw) return [];

        const paragraphs = raw
            .split(/\r?\n\s*\r?\n/)
            .map(p => p.trim())
            .filter(Boolean);

        if (signalCount && paragraphs.length !== signalCount) {
            console.warn(`breach narrative has ${paragraphs.length} paragraph(s) but ${signalCount} signal(s) — numbering may not align`);
        }

        return paragraphs;
    }

    _formatDate(ts) {
        if (!ts) return '';
        return new Date(ts).toLocaleString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    }
}