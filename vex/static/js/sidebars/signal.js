class SignalSidebar {
    constructor(state) {
        this.state = state;
        this.api = new SignalApi();
        this.listen();
    }

    reset() {
        this.api.set('account', this.state.account());
        document.getElementById("updates").innerHTML = "";
    }

    display(signal, updates) {
        this.signal = signal;
        this.render(signal);

        this.add(signal);
        updates.sort((a, b) => new Date(a.updated) - new Date(b.updated)).forEach((update) => {
            this.add(update);
        });
    }

    create() {
        this.render({
            id: null,
            severity: 5,
            status: "OR",
            asset: "",
            source: "helpdesk",
        });
    }

    render(signal) {
        document.getElementById("signal-severity").value = signal.severity;
        document.getElementById("signal-status").value = signal.status;
        document.getElementById("signal-asset").value = signal.asset;
        document.getElementById("signal-source").value = signal.source;

        const banner = document.getElementById("severity-banner");
        banner.dataset.severity = signal.severity;
    }

    add(update) {
        const message = document.createElement("li");
        message.dataset.key = update.key;
        message.className = "";

        const source = update.source || this.signal.source;
        message.innerHTML = `
            <div class="message-row">
                <div class="avatar"><img class="message-avatar" src="${Workspace.avatar(source)}" /></div>
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

    listen() {
        document.getElementById('signal-create').addEventListener('click', async (e) => {
            e.preventDefault();

            await SiteSpinner.withLoading(async () => {
                const body = document.getElementById("response").value;

                if (this.signal.id) {
                    const update = await this.api.update(this.signal.id, body);
                    this.add(update);
                } else {
                    const signal = await this.api.create({
                        severity: parseInt(this.signal.severity),
                        status: this.signal.status,
                        asset: this.signal.asset,
                        source: this.signal.source,
                        body,
                    });

                    document.dispatchEvent(new CustomEvent('page:reload'));
                    document.querySelector('site-overlay').click();
                }
            });
        });

        document.getElementById('signal-status').addEventListener('change', async (ev) => {
            if (!this.signal || !this.signal.id) return;
            
            await SiteSpinner.withLoading(async () => {
                const status = ev.target.selectedOptions[0].id;
                await this.api.patch(this.signal.id, { status: status });

                document.dispatchEvent(new CustomEvent('page:reload'));
                document.querySelector('site-overlay').click();
            });
        });

        document.getElementById('signal-severity').addEventListener('change', async (ev) => {
            if (!this.signal || !this.signal.id) return;

            await SiteSpinner.withLoading(async () => {
                const severity = ev.target.selectedOptions[0];
                const signal = await this.api.patch(this.signal.id, { severity: parseInt(severity.value) });
                this.state.signals[signal.account][signal.id] = signal;
                document.getElementById("severity-banner").dataset.severity = signal.severity;
                document.dispatchEvent(new CustomEvent('page:reset'));
            });
        });

        document.getElementById('signal-asset').addEventListener('change', async (ev) => {
            if (!this.signal || !this.signal.id) return;

            await SiteSpinner.withLoading(async () => {
                const asset = ev.target.value;
                const signal = await this.api.patch(this.signal.id, { asset: asset });
                this.state.signals[signal.account][signal.id] = signal;
                document.dispatchEvent(new CustomEvent('page:reset'));
            });
        });

        document.getElementById('signal-source').addEventListener('change', async (ev) => {
            if (!this.signal || !this.signal.id) return;

            await SiteSpinner.withLoading(async () => {
                const source = ev.target.value;
                const signal = await this.api.patch(this.signal.id, { source: source });
                this.state.signals[signal.account][signal.id] = signal;
                document.dispatchEvent(new CustomEvent('page:reset'));
            });
        });

        document.getElementById('signal-delete').addEventListener('click', async (e) => {
            e.preventDefault();

            await SiteSpinner.withLoading(async () => {
                const signal = this.signal;
                delete this.state.signals[signal.account][signal.id];
                await this.api.delete(signal.id);

                document.dispatchEvent(new CustomEvent('page:reset'));
                document.querySelector('site-overlay').click();
            });
        });
    }
}