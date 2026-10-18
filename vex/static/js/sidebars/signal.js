const isOpen = (status) => !status.startsWith("C");

class SignalSidebar {
    static CHOICES = [
        { status: "R3", label: "Run investigation", primary: true, when: isOpen },
        { status: "R1", label: "Contain asset",  when: isOpen },
    ];

    static CLOSES = [
        { status: "CH", label: "Resolve", when: isOpen },
        { status: "CR", label: "Accept risk", when: isOpen },
        { status: "OB", label: "Reopen", when: (s) => !isOpen(s) },
    ];

    static CLOSED_AS = { CH: "resolved", CR: "accepted risk", CV: "auto-closed" };

    constructor(state) {
        this.state = state;
        this.api = state.api;
        document.getElementById("next-turn-avatar").src = Workspace.avatar("vex");
        this.listen();
    }

    reset() {
        document.getElementById("updates").replaceChildren();
        document.getElementById("reply-form").reset();
    }

    reload() {
        this.reset();
        this.signal = { id: null, status: "OB" };
        this.render();
    }

    inject(signal, updates) {
        this.signal = this.state.signals[signal.account][signal.id];
        this.render();
        this.add(this.signal, this.signal.created);

        updates.sort((a, b) => new Date(a.updated) - new Date(b.updated)).forEach((update) => this.add(update));
        document.getElementById("next-turn").scrollIntoView({ block: "end" });
        document.dispatchEvent(new CustomEvent("page:reload"));
    }

    render() {
        const isNew = !this.signal.id;
        const risk = isNew ? null : Workspace.risk(this.signal.metadata?.threat);

        const sidebar = document.getElementById("signal-sidebar");
        sidebar.classList.toggle("is-new", isNew);
        if (risk) sidebar.dataset.risk = risk.level;
        else delete sidebar.dataset.risk;

        document.getElementById("signal-label").textContent = isNew ? "New signal" : risk?.label ?? "Signal";
        document.getElementById("signal-icon").textContent = isNew ? "add_circle" : risk?.icon ?? "notifications";

        const threat = document.getElementById("signal-threat");
        threat.hidden = !risk;
        threat.textContent = risk ? `${risk.pct}% likely malicious` : "";

        document.getElementById("response").placeholder = isNew
            ? "What happened, where, and what needs to be done?"
            : "Add context for VEX";

        this.renderTurn();
    }

    renderTurn() {
        const { status } = this.signal;
        const open = isOpen(status);

        document.getElementById("next-turn-prompt").textContent = !open
            ? `This one's closed as ${SignalSidebar.CLOSED_AS[status]}.`
            : status == "OB" ? "How do you want to handle this?" : "What's next?";

        const choices = SignalSidebar.CHOICES.filter((c) => c.when(status)).map((c) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "choice";
            button.classList.toggle("is-primary", !!c.primary);
            button.dataset.status = c.status;
            button.textContent = c.label;
            return button;
        });
        document.getElementById("next-turn-choices").replaceChildren(...choices);

        const closes = SignalSidebar.CLOSES.filter((c) => c.when(status)).flatMap((c, i) => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.status = c.status;
            button.textContent = c.label;
            return i ? [" · ", button] : [button];
        });
        document.getElementById("next-turn-closes").replaceChildren(open ? "Or close it out: " : "", ...closes);
    }

    add(update, when = update.updated) {
        const source = update.source || this.signal.source;

        const li = document.createElement("li");
        li.innerHTML = `
            <img class="avatar" alt="">
            <div class="message">
                <div class="meta">
                    <span class="sender"></span>
                    <span class="tag">AI analyst</span>
                    <time class="timestamp"></time>
                </div>
                <div class="body"></div>
            </div>`;

        li.querySelector(".tag").hidden = source !== "vex";

        const avatar = li.querySelector(".avatar");
        avatar.onerror = () => { avatar.onerror = null; avatar.src = "static/img/source/slack.png"; };
        avatar.src = Workspace.avatar(source);

        const timestamp = li.querySelector(".timestamp");
        timestamp.textContent = Workspace.date(when, true);
        timestamp.dateTime = when ?? "";

        li.querySelector(".sender").textContent = source;
        li.querySelector(".body").innerHTML = DOMPurify.sanitize(
            marked.parse(update.value ?? "", { breaks: true, gfm: true })
        );

        document.getElementById("updates").append(li);
        document.getElementById("response").value = "";
        li.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    async note() {
        const value = document.getElementById("response").value.trim();
        if (!value) return;
        await SiteSpinner.withLoading(async () => {
            this.add(await this.api.signals.update(this.signal.id, value));
        });
    }

    async create() {
        const asset = document.getElementById("signal-asset");
        if (!asset.reportValidity()) return;

        await SiteSpinner.withLoading(async () => {
            await this.api.signals.create({
                status: this.signal.status,
                asset: asset.value.trim(),
                source: document.getElementById("signal-source").value.trim(),
                value: document.getElementById("response").value.trim(),
            });
            document.dispatchEvent(new CustomEvent("page:reload"));
            document.querySelector("site-overlay").click();
        });
    }

    async decide(status) {
        await this.note();
        if (status.startsWith("R")) return this.askVex(status);

        await SiteSpinner.withLoading(async () => {
            const signal = await this.api.signals.patch(this.signal.id, { status });
            this.state.signals[signal.account][signal.id] = signal;
            this.signal = signal;
            this.render();
            document.dispatchEvent(new CustomEvent("page:reload"));
        });
        if (!isOpen(status)) document.querySelector("site-overlay").click();
    }

    async askVex(status) {
        const sidebar = document.getElementById("signal-sidebar");
        sidebar.classList.add("is-busy");

        const thinking = document.createElement("li");
        thinking.innerHTML = `
            <img class="avatar" src="${Workspace.avatar("vex")}" alt="">
            <div class="message">
                <div class="meta"><span class="sender">vex</span><span class="tag">AI analyst</span></div>
                <div class="body thinking">Thinking…</div>
            </div>`;
        document.getElementById("updates").append(thinking);
        thinking.scrollIntoView({ block: "nearest" });

        const seen = (await this.api.signals.get(this.signal.id)).length;
        await this.api.signals.patch(this.signal.id, { status });
        this.signal.status = status;
        this.renderTurn();

        while (thinking.isConnected) {
            await new Promise((r) => setTimeout(r, 3750));
            const updates = await this.api.signals.get(this.signal.id);
            if (updates.length > seen) {
                thinking.remove();
                updates.slice(seen).forEach((u) => this.add(u));
            }
        }

        sidebar.classList.remove("is-busy");
        document.getElementById("next-turn").scrollIntoView({ behavior: "smooth", block: "end" });
    }

    async delete() {
        const { id, account } = this.signal;
        await SiteSpinner.withLoading(async () => {
            await this.api.signals.delete(id);
            delete this.state.signals[account][id];
            document.dispatchEvent(new CustomEvent("page:reset"));
            document.querySelector("site-overlay").click();
        });
    }

    listen() {
        document.getElementById("signal-save").addEventListener("click", () => {
            this.signal.id ? this.note() : this.create();
        });

        document.getElementById("next-turn").addEventListener("click", (ev) => {
            const button = ev.target.closest("button[data-status]");
            if (button) this.decide(button.dataset.status);
        });

        document.getElementById("signal-delete").addEventListener("click", () => this.delete());
    }
}