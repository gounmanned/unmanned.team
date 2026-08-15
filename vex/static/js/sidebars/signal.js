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

    reload(signal, updates) {
        this.signal = signal;

        document.getElementById("signal-severity").value = signal.severity;
        document.getElementById("signal-status").value = signal.status;

        const banner = document.getElementById("severity-banner");
        banner.dataset.severity = signal.severity;
        banner.innerHTML = `<span>${Workspace.SEVERITY[signal.severity]}</span>`;
        this.add(signal);

        updates.sort((a, b) => new Date(a.updated) - new Date(b.updated)).forEach((update, _) => {
            this.add(update);
        });
    }

    add(update) {
        if (document.querySelector(`#updates li[data-key="${update.key}"]`)) return;

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
        const last = document.getElementById("updates").querySelector('li:last-child');
        last.scrollIntoView({ behavior: 'smooth' });
    }

    listen() {
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

        document.getElementById('signal-update').addEventListener('click', async (e) => {
            e.preventDefault();

            await SiteSpinner.withLoading(async () => {
                const signal = this.signal;
                const body = document.getElementById("response").value;
                const update = await this.api.update(signal.id, body);
                this.add(update);
            });
        });

        document.getElementById('signal-status').addEventListener('change', async (ev) => {
            await SiteSpinner.withLoading(async () => {
                const status = ev.target.selectedOptions[0].id;
                await this.api.patch(this.signal.key, { status: status });

                document.dispatchEvent(new CustomEvent('page:reload'));
                document.querySelector('site-overlay').click();
            });
        });

        document.getElementById('signal-severity').addEventListener('change', async (ev) => {
            const severity = ev.target.selectedOptions[0];
            const signal = await this.api.patch(this.signal.key, { severity: parseInt(severity.value) });

            this.state.signals[signal.account][signal.id] = signal;
            document.dispatchEvent(new CustomEvent('page:reload'));
            document.querySelector('site-overlay').click();
        });
    }
}