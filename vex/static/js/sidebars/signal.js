class SignalSidebar {
    static NEW_COPY = {
        placeholder: "What happened, where, and what needs to be done?",
        action: "Create signal",
    };

    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.listen();
    }

    reset() {
        document.getElementById("updates").replaceChildren();
        document.getElementById("response").value = "";
    }

    reload() {
        this.reset();
        this.signal = { id: null, status: "OB", asset: "", source: "vex" };
        this.render();
    }

    inject(signal, updates) {
        this.signal = this.state.signals[signal.account][signal.id];
        this.render();
        this.add(this.signal);

        updates.sort((a, b) => new Date(a.updated) - new Date(b.updated)).forEach((update) => this.add(update));
        document.dispatchEvent(new CustomEvent("page:reload"));
    }

    render() {
        const s = this.signal;
        const isNew = !s.id;
        const risk = isNew ? null : Workspace.risk(s.metadata?.threat);

        const sidebar = document.getElementById("signal-sidebar");
        sidebar.classList.toggle("is-new", isNew);
        if (risk) sidebar.dataset.risk = risk.level;
        else delete sidebar.dataset.risk;

        document.getElementById("signal-status").value = s.status;
        document.getElementById("signal-asset").value = s.asset;
        document.getElementById("signal-source").value = s.source;
        document.getElementById("signal-label").textContent = isNew ? "New signal" : risk?.label ?? "Signal";
        document.getElementById("signal-icon").textContent = isNew ? "add_circle" : risk?.icon ?? "notifications";

        const threat = document.getElementById("signal-threat");
        threat.hidden = !risk;
        threat.textContent = risk ? `${risk.pct}% likely malicious` : "";

        document.getElementById("response").placeholder = isNew ? SignalSidebar.NEW_COPY.placeholder : "Add context to this signal";
        document.getElementById("signal-save-label").textContent = isNew ? SignalSidebar.NEW_COPY.action : "";
    }

    add(update) {
        const source = update.source || this.signal.source;

        const li = document.createElement("li");
        li.dataset.key = update.key;
        li.innerHTML = `
            <img class="avatar" alt="">
            <div class="message">
                <div class="meta">
                    <span class="sender"></span>
                    <time class="timestamp"></time>
                </div>
                <div class="body"></div>
            </div>`;

        const avatar = li.querySelector(".avatar");
        avatar.onerror = () => { avatar.onerror = null; avatar.src = "static/img/source/slack.png"; };
        avatar.src = Workspace.avatar(source);

        const timestamp = li.querySelector(".timestamp");
        timestamp.textContent = Workspace.date(update.updated, true);
        timestamp.dateTime = update.updated ?? "";

        li.querySelector(".sender").textContent = source;
        li.querySelector(".body").innerHTML = DOMPurify.sanitize(
            marked.parse(update.value ?? "", { breaks: true, gfm: true })
        );

        document.getElementById("updates").append(li);
        document.getElementById("response").value = "";
        li.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    validateAsset() {
        if ((this.signal.asset || "").trim()) return true;
        document.getElementById("signal-asset").reportValidity();
        return false;
    }

    async patch(fields) {
        await SiteSpinner.withLoading(async () => {
            const signal = await this.api.signals.patch(this.signal.id, fields);
            this.state.signals[signal.account][signal.id] = signal;
            this.signal = signal;
            this.render();
            document.dispatchEvent(new CustomEvent("page:reload"));
        });
    }

    listen() {
        document.getElementById("signal-save").addEventListener("click", async () => {
            const value = document.getElementById("response").value.trim();

            if (this.signal.id) {
                if (!value) return;
                await SiteSpinner.withLoading(async () => {
                    this.add(await this.api.signals.update(this.signal.id, value));
                });
                return;
            }

            if (!this.validateAsset()) return;

            const { status, asset, source } = this.signal;
            await SiteSpinner.withLoading(async () => {
                await this.api.signals.create({ status, asset, source, value });
                document.dispatchEvent(new CustomEvent("page:reload"));
                document.querySelector("site-overlay").click();
            });
        });

        document.getElementById("signal-asset").addEventListener("change", (ev) => {
            this.signal.asset = ev.target.value;
            if (this.signal.id && this.validateAsset()) this.patch({ asset: this.signal.asset });
        });

        document.getElementById("signal-source").addEventListener("change", (ev) => {
            this.signal.source = ev.target.value;
            if (this.signal.id) this.patch({ source: this.signal.source });
        });

        document.getElementById("signal-status").addEventListener("change", async (ev) => {
            this.signal.status = ev.target.value;
            if (!this.signal.id) return;

            if (this.signal.status.startsWith("R")) {
                const thinking = document.createElement("li");
                thinking.innerHTML = `
                    <img class="avatar" src="${Workspace.avatar("vex")}" alt="">
                    <div class="message">
                        <div class="meta"><span class="sender">vex</span></div>
                        <div class="body thinking">Thinking…</div>
                    </div>`;

                document.getElementById("updates").append(thinking);
                thinking.scrollIntoView({ block: "nearest" });

                const seen = (await this.api.signals.get(this.signal.id)).length;
                await this.api.signals.patch(this.signal.id, { status: this.signal.status });

                while (thinking.isConnected) {
                    await new Promise((r) => setTimeout(r, 3750));
                    const updates = await this.api.signals.get(this.signal.id);
                    if (updates.length > seen) {
                        thinking.remove();
                        updates.slice(seen).forEach((u) => this.add(u));
                    }
                }
            } else {
                this.patch({ status: this.signal.status }).then(() => {
                    document.querySelector("site-overlay").click();
                });
            }
        });

        document.getElementById("signal-delete").addEventListener("click", async () => {
            const { id, account } = this.signal;
            await SiteSpinner.withLoading(async () => {
                await this.api.signals.delete(id);
                delete this.state.signals[account][id];
                document.dispatchEvent(new CustomEvent("page:reset"));
                document.querySelector("site-overlay").click();
            });
        });
    }
}