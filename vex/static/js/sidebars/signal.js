class SignalSidebar {
    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.listen();
    }

    reset() {
        document.getElementById("updates").innerHTML = "";
        document.getElementById("response").value = "";
    }

    reload() {
        this.reset();
        this.signal = { id: null, kind: 3, status: "OA", asset: "", source: "vex" };
        this.render(this.signal, true);
    }

    inject(signal, updates) {
        this.signal = this.state.signals[signal.account][signal.id];
        this.render(this.signal, false);
        this.add(this.signal);

        updates.sort((a, b) => new Date(a.updated) - new Date(b.updated)).forEach((update) => {
            this.add(update);
        });

        document.dispatchEvent(new CustomEvent('page:reload'));
    }

    render(signal, empty = false) {
        const $ = (id) => document.getElementById(id);
        const kind = Workspace.KIND[signal.kind];
        const conf = signal.metadata?.confidence;

        $("updates-wrap").classList.toggle("empty", empty);
        $("signal-status").value = signal.status;
        $("signal-asset").value = signal.asset;
        $("signal-source").value = signal.source;
        $("kind-banner").dataset.kind = signal.kind ?? "";
        $("signal-kind").textContent = kind?.label ?? "";
        $("signal-kind-icon").textContent = kind?.icon ?? "";
        $("signal-confidence").hidden = conf == null;
        $("signal-confidence").textContent = conf == null ? "" : `${Math.round(conf * 100)}% confidence`;
    }

    add(update) {
        const message = document.createElement("li");
        message.dataset.key = update.key;
        message.className = "";

        const source = update.source || this.signal.source;
        message.innerHTML = `
            <div class="message-row">
                <div class="avatar">
                    <img class="message-avatar"
                         src="${Workspace.avatar(source)}"
                         onerror="this.onerror=null; this.src='static/img/source/slack.png';"
                    />
                </div>
                <div class="message-content">
                    <div class="header">
                        <div class="sender">${source}</div>
                        <div class="timestamp">${update.updated}</div>
                    </div>
                    <div class="body">${update.value}</div>
                </div>
            </div>
        `;

        document.getElementById("updates").appendChild(message);
        document.getElementById("response").value = "";
        document.getElementById("updates").querySelector('li:last-child').scrollIntoView({ behavior: 'smooth' });
    }

    validateAsset() {
        const input = document.getElementById("signal-asset");
        const asset = (this.signal.asset || "").trim();

        if (!asset) {
            input.reportValidity ? input.reportValidity() : input.focus();
            return false;
        }
        return true;
    }

    listen() {
        document.getElementById('signal-save').addEventListener('click', async (e) => {
            e.preventDefault();

            if (!this.validateAsset()) return;

            await SiteSpinner.withLoading(async () => {
                const comment = document.getElementById("response").value;

                if (this.signal.id && comment) {
                    const update = await this.api.signals.update(this.signal.id, comment);
                    this.add(update);
                } else {
                    await this.api.signals.create({
                        kind: this.signal.kind,
                        status: this.signal.status,
                        asset: this.signal.asset,
                        source: this.signal.source,
                        value: comment,
                    });

                    document.dispatchEvent(new CustomEvent('page:reload'));
                    document.querySelector('site-overlay').click();
                }
            });
        });

        document.getElementById('signal-status').addEventListener('change', async (ev) => {
            this.signal.status = ev.target.selectedOptions[0].id;
            if (!this.signal?.id) return;

            await SiteSpinner.withLoading(async () => {
                const signal = await this.api.signals.patch(this.signal.id, { status: this.signal.status });
                this.state.signals[signal.account][signal.id] = signal;
                document.dispatchEvent(new CustomEvent('page:reload'));
                document.querySelector('site-overlay').click();
            });
        });

        document.getElementById('signal-asset').addEventListener('change', async (ev) => {
            this.signal.asset = ev.target.value;
            if (!this.signal?.id) return;

            if (!this.validateAsset()) return;

            await SiteSpinner.withLoading(async () => {
                const signal = await this.api.signals.patch(this.signal.id, { asset: this.signal.asset });
                this.state.signals[signal.account][signal.id] = signal;
                document.dispatchEvent(new CustomEvent('page:reload'));
            });
        });

        document.getElementById('signal-source').addEventListener('change', async (ev) => {
            this.signal.source = ev.target.value;
            if (!this.signal?.id) return;

            await SiteSpinner.withLoading(async () => {
                const signal = await this.api.signals.patch(this.signal.id, { source: this.signal.source });
                this.state.signals[signal.account][signal.id] = signal;
                document.dispatchEvent(new CustomEvent('page:reload'));
            });
        });

        document.getElementById('signal-delete').addEventListener('click', async (e) => {
            e.preventDefault();

            await SiteSpinner.withLoading(async () => {
                const signal = this.signal;
                delete this.state.signals[signal.account][signal.id];
                await this.api.signals.delete(signal.id);

                document.dispatchEvent(new CustomEvent('page:reset'));
                document.querySelector('site-overlay').click();
            });
        });
    }
}