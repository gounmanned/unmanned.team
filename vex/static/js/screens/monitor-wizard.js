class MonitorWizard {
    constructor(monitorApi, available, onDone) {
        this.api = monitorApi;
        this.available = available;
        this.onDone = onDone;
        this.automation = new AutomationClient();

        this.modal = document.getElementById('monitor-wizard-modal');
        this.title = document.getElementById('wizard-title');
        this.subtitle = document.getElementById('wizard-subtitle');
        this.body = document.getElementById('wizard-body');
        this.footer = document.getElementById('wizard-footer');

        this.stepsCache = {};
        this.sessionId = null;

        this.listen();
    }

    open() {
        this.selected = new Set();
        this.queue = [];
        this.monitorIndex = 0;
        this.stepIndex = 0;
        this._renderSelect();
        this.modal.show();
    }

    listen() {
        this.body.addEventListener('change', ev => {
            const box = ev.target.closest('[data-select]');
            if (!box) return;
            box.checked ? this.selected.add(box.dataset.select) : this.selected.delete(box.dataset.select);
            this._renderSelect();
        });

        this.body.addEventListener('click', ev => {
            const remove = ev.target.closest('[data-remove]');
            if (remove) {
                this.selected.delete(remove.dataset.remove);
                return this.selected.size ? this._renderReview() : this._renderSelect();
            }

            const launch = ev.target.closest('[data-launch]');
            if (launch) this._launch(launch);
        });

        this.footer.addEventListener('click', ev => {
            if (ev.target.closest('[data-next-review]')) return this._renderReview();
            if (ev.target.closest('[data-back-select]')) return this._renderSelect();
            if (ev.target.closest('[data-confirm-start]')) return this._startWalkthrough();
            if (ev.target.closest('[data-wizard-cancel]')) return this._cancel();
            if (ev.target.closest('[data-wizard-back]')) return this._back();
            if (ev.target.closest('[data-wizard-next]')) return this._next();
            if (ev.target.closest('[data-wizard-done]')) return this.modal.hide();

            const connect = ev.target.closest('[data-wizard-connect]');
            if (connect) this._connect(connect.dataset.wizardConnect);
        });

        this.modal.addEventListener('overlay-click', () => this._cleanupSession());
    }

    _pending() {
        return Object.entries(this.available).filter(([, s]) => !s.active);
    }

    _renderSelect() {
        this.title.textContent = 'Guided Setup';
        this.subtitle.textContent = 'Choose which monitors you want to connect';

        const rows = this._pending();
        this.body.innerHTML = rows.length ? `
            <ul class="wizard-checklist">
                ${rows.map(([key, s]) => `
                    <li class="wizard-check-row ${this.selected.has(key) ? 'checked' : ''}">
                        <label>
                            <input type="checkbox" data-select="${key}" ${this.selected.has(key) ? 'checked' : ''}>
                            <span class="monitor-row-icon"><img src="static/img/source/${key}.png"></span>
                            <span class="wizard-check-name">${s.name}</span>
                        </label>
                        <span class="wizard-check-confirm">${this.selected.has(key) ? '<span class="material-symbols-outlined">check_circle</span>Added' : ''}</span>
                    </li>
                `).join('')}
            </ul>
        ` : `<p class="wizard-empty">Every monitor is already connected.</p>`;

        this.footer.innerHTML = `
            <button class="monitor-action ghost" data-wizard-cancel>Cancel</button>
            <div class="wizard-footer-right">
                <span class="wizard-footer-note">${this.selected.size} selected</span>
                <button class="monitor-action primary" data-next-review ${this.selected.size ? '' : 'disabled'}>Review selection</button>
            </div>
        `;
    }

    _renderReview() {
        this.title.textContent = 'Confirm your selection';
        this.subtitle.textContent = 'You can still remove a monitor before setup starts';

        this.body.innerHTML = `
            <ul class="wizard-review-list">
                ${[...this.selected].map(key => `
                    <li class="wizard-review-row">
                        <span class="monitor-row-icon"><img src="static/img/source/${key}.png"></span>
                        <span class="wizard-check-name">${this.available[key].name}</span>
                        <span class="wizard-check-confirm"><span class="material-symbols-outlined">check_circle</span>Confirmed</span>
                        <button class="monitor-action ghost" data-remove="${key}">Remove</button>
                    </li>
                `).join('')}
            </ul>
        `;

        this.footer.innerHTML = `
            <button class="monitor-action" data-back-select>Back</button>
            <button class="monitor-action primary" data-confirm-start>Confirm &amp; start setup</button>
        `;
    }

    async _startWalkthrough() {
        this.queue = [...this.selected];
        this.monitorIndex = 0;

        await SiteSpinner.withLoading(() => this._enterMonitor());
    }

    async _enterMonitor() {
        this.currentKey = this.queue[this.monitorIndex];
        this.currentSteps = await this._loadSteps(this.currentKey);
        this.stepIndex = 0;
        this._renderStep();
    }

    async _loadSteps(key) {
        if (this.stepsCache[key]) return this.stepsCache[key];

        // Split on <h2> in document order rather than walking DOM children —
        // some docs (e.g. google.html) nest their <h2> steps inside wrapper
        // divs, so a direct-children walk would miss them.
        let containerHtml = '';
        try {
            const resp = await fetch(`docs/${key}.html`);
            const html = await resp.text();
            const container = new DOMParser().parseFromString(html, 'text/html').querySelector('.container');
            containerHtml = container ? container.innerHTML : '';
        } catch {
            containerHtml = '';
        }

        containerHtml = containerHtml
            .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '')
            .replace(/<hr[^>]*class="step-divider"[^>]*>/gi, '');

        const headingRe = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
        const matches = [...containerHtml.matchAll(headingRe)];

        const raw = [];
        const firstStart = matches.length ? matches[0].index : containerHtml.length;
        const overview = containerHtml.slice(0, firstStart).trim();
        if (overview) raw.push({ title: 'Overview', html: overview });

        matches.forEach((m, i) => {
            const heading = document.createElement('div');
            heading.innerHTML = m[0];
            const title = heading.textContent.trim();
            const start = m.index + m[0].length;
            const end = i + 1 < matches.length ? matches[i + 1].index : containerHtml.length;
            raw.push({ title, html: containerHtml.slice(start, end).trim() });
        });

        const parsed = raw.map(s => {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = s.html;
            const link = wrapper.querySelector('a[href^="http"]');
            return { title: s.title, html: s.html, url: link ? link.href : null };
        });

        if (!parsed.length) {
            parsed.push({
                title: 'Setup',
                html: `<p>See the <a href="docs/${key}.html" target="_blank">full documentation</a> for this monitor.</p>`,
                url: null,
            });
        }

        parsed.push({ title: 'Connect', connect: true });
        this.stepsCache[key] = parsed;
        return parsed;
    }

    _renderStep() {
        const key = this.currentKey;
        const name = this.available[key].name;
        const steps = this.currentSteps;
        const step = steps[this.stepIndex];

        this.title.textContent = `${name} · ${step.title}`;
        this.subtitle.textContent = `Step ${this.stepIndex + 1} of ${steps.length} · Monitor ${this.monitorIndex + 1} of ${this.queue.length}`;

        if (step.connect) {
            this.body.innerHTML = `
                <div class="wizard-connect">
                    <p>Paste the credentials or configuration data for ${name} below.</p>
                    <textarea id="wizard-connect-input" rows="3" placeholder="Enter your API key, credentials, or configuration data here…"></textarea>
                    <a href="docs/${key}.html" target="_blank" class="docs-link">View full documentation →</a>
                </div>
            `;
        } else {
            this.body.innerHTML = `
                <div class="wizard-step-doc">${step.html}</div>
                ${step.url ? `
                    <button class="monitor-action" data-launch="${step.url}">Launch guided browser →</button>
                    <a href="${step.url}" target="_blank" class="docs-link wizard-fallback-link" hidden>Open in new tab →</a>
                ` : ''}
            `;
        }

        const backDisabled = this.monitorIndex === 0 && this.stepIndex === 0;
        this.footer.innerHTML = `
            <div class="wizard-footer-left">
                <button class="monitor-action ghost" data-wizard-cancel>Cancel</button>
                <button class="monitor-action" data-wizard-back ${backDisabled ? 'disabled' : ''}>Back</button>
            </div>
            ${step.connect
                ? `<button class="monitor-action primary" data-wizard-connect="${key}">Connect ${name}</button>`
                : `<button class="monitor-action primary" data-wizard-next>Next</button>`}
        `;
    }

    async _launch(button) {
        const url = button.dataset.launch;
        try {
            if (!this.sessionId) this.sessionId = await this.automation.startSession();
            await this.automation.navigate(this.sessionId, url);
            Workspace.toast('Guided browser opened to this step.');
        } catch {
            button.hidden = true;
            const fallback = button.nextElementSibling;
            if (fallback?.classList.contains('wizard-fallback-link')) fallback.hidden = false;
            Workspace.toast('Automation service unavailable — opening the link instead.');
        }
    }

    _next() {
        this.stepIndex++;
        this._renderStep();
    }

    async _back() {
        if (this.stepIndex > 0) {
            this.stepIndex--;
            return this._renderStep();
        }
        if (this.monitorIndex > 0) {
            this.monitorIndex--;
            this.currentKey = this.queue[this.monitorIndex];
            this.currentSteps = await this._loadSteps(this.currentKey);
            this.stepIndex = this.currentSteps.length - 1;
            this._renderStep();
        }
    }

    async _connect(key) {
        const value = this.body.querySelector('#wizard-connect-input')?.value ?? '';

        try {
            await SiteSpinner.withLoading(() => this.api.connect(key, value));
        } catch {
            return Workspace.toast(`Couldn't connect ${this.available[key].name} — check the credentials and try again.`);
        }

        this.available[key].active = true;
        Workspace.toast(`${this.available[key].name} connected.`);

        this.monitorIndex++;
        this.monitorIndex < this.queue.length ? await this._enterMonitor() : await this._finish();
    }

    async _finish() {
        this.title.textContent = 'Setup complete';
        this.subtitle.textContent = '';
        this.body.innerHTML = `<p class="wizard-empty">All set — your monitors are connected.</p>`;
        this.footer.innerHTML = `<button class="monitor-action primary" data-wizard-done>Done</button>`;

        await this._cleanupSession();
        this.onDone();
    }

    _cancel() {
        this._cleanupSession();
        this.modal.hide();
    }

    async _cleanupSession() {
        if (!this.sessionId) return;
        await this.automation.closeSession(this.sessionId);
        this.sessionId = null;
    }
}
