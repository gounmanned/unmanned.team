const isOpen = (status) => !status.startsWith("C");

class SignalSidebar {
    static CHOICES = [
        { status: "R3", label: "Run investigation", primary: true, when: isOpen },
        { status: "R1", label: "Contain asset",  when: isOpen },
    ];

    static RECOMMEND = [
        { status: "R4", label: "Get recommendation", primary: true, when: isOpen },
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
        const self = () => {
            document.getElementById("next-turn-avatar").src = Workspace.avatar("vex");
            document.getElementById("next-turn-sender").textContent = Workspace.sender("vex");
        };
        self();
        this.listen();
    }

    reset() {
        document.querySelectorAll("#updates > :not(#next-turn)").forEach((el) => el.remove());   // the analyst's turn stays, last
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
        // the sidebar is a native dialog now, not rendered until show() (which runs right after inject),
        // so scroll to the latest message on the next frame. VEX's always-rendered sidebar could scroll at once.
        requestAnimationFrame(() => document.getElementById("next-turn").scrollIntoView({ block: "end" }));
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
        // Phosphor icons and a Pulse badge; a new signal gets the plus, as on the Add signal button.
        const icon = isNew ? "plus" : { low: "check-circle", medium: "warning", high: "warning-octagon" }[risk?.level] ?? "bell";
        document.getElementById("signal-icon").className = `pulse-icon pulse-icon--${icon}${risk ? " pulse-icon--fill" : ""}`;   // sits in the head's Pulse icon slot

        const threat = document.getElementById("signal-threat");
        threat.hidden = !risk;
        threat.textContent = risk ? `${risk.pct}% likely malicious` : "";
        threat.className = `pulse-badge pulse-badge--nodot${risk ? ` pulse-badge--${{ low: "success", medium: "warning", high: "danger" }[risk.level]}` : ""}`;

        document.getElementById("response").placeholder = isNew
            ? "What happened, where, and what needs to be done?"
            : `Add context for ${Workspace.product()}`;

        this.renderTurn();
    }

    renderTurn() {
        const { status, metadata } = this.signal;
        const open = isOpen(status);

        document.getElementById("next-turn-prompt").textContent = !open
            ? `This one's closed as ${SignalSidebar.CLOSED_AS[status]}.`
            : status == "OB" ? "How do you want to handle this?" : "What's next?";

        const options = metadata?.threat ? SignalSidebar.CHOICES : SignalSidebar.RECOMMEND;
        const choices = options.filter((c) => c.when(status)).map((c) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `pulse-btn pulse-btn--sm pulse-btn--reply ${c.primary ? "pulse-btn--primary" : "pulse-btn--neutral"}`;   // Pulse reply button
            button.dataset.status = c.status;
            button.textContent = c.label;
            return button;
        });

        document.getElementById("next-turn-choices").replaceChildren(...choices);

        const closes = SignalSidebar.CLOSES.filter((c) => c.when(status)).map((c) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "pulse-btn pulse-btn--ghost-neutral pulse-btn--sm pulse-btn--reply";
            button.dataset.status = c.status;
            button.textContent = c.label;
            return button;
        });

        const label = Object.assign(document.createElement("span"), { textContent: open ? "Close it out:" : "" });
        document.getElementById("next-turn-closes").replaceChildren(label, ...closes);
    }

    add(update, when = update.updated) {
        const source = update.source || this.signal.source;

        // Pulse message: avatar, head (sender, AI analyst tag, time) and body.
        const li = document.createElement("li");
        li.className = "pulse-message";
        li.innerHTML = `
            <span class="pulse-avatar pulse-avatar--circle pulse-avatar--outline"><img class="avatar" alt=""></span>
            <div class="pulse-message__head">
                <span class="pulse-message__sender sender"></span>
                <span class="pulse-badge pulse-badge--accent pulse-badge--nodot tag">AI analyst</span>
                <time class="pulse-message__time timestamp"></time>
            </div>
            <div class="pulse-message__body body markdown"></div>`;

        li.querySelector(".tag").hidden = source !== "vex";

        const avatar = li.querySelector(".avatar");
        avatar.onerror = () => { avatar.onerror = null; avatar.src = "static/img/source/slack.png"; };
        avatar.src = Workspace.avatar(source);
        avatar.classList.toggle("is-analyst", source === "vex");

        const timestamp = li.querySelector(".timestamp");
        timestamp.textContent = Workspace.date(when, true);
        timestamp.dateTime = when ?? "";

        li.querySelector(".sender").textContent = Workspace.sender(source);

        const body = li.querySelector(".body");
        const json = SignalSidebar.json(update.value);
        // JSON goes in Pulse's small code panel.
        if (json) {
            const panel = Object.assign(document.createElement("div"), { className: "pulse-code pulse-code--sm" });
            const pre = document.createElement("pre");
            pre.append(Object.assign(document.createElement("code"), { textContent: json }));
            panel.append(pre);
            body.replaceChildren(panel);
        } else body.innerHTML = Markdown.parse(update.value ?? "");

        document.getElementById("next-turn").before(li);
        document.getElementById("response").value = "";
        li.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    static json(text) {
        try {
            const value = JSON.parse(text);
            return typeof value === "object" && value ? JSON.stringify(value, null, 2) : null;
        } catch {
            return null;
        }
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

        const due = document.getElementById("signal-due").value;

        await SiteSpinner.withLoading(async () => {
            await this.api.signals.create({
                status: this.signal.status,
                asset: asset.value.trim(),
                source: document.getElementById("signal-source").value.trim(),
                value: document.getElementById("response").value.trim(),
                ...(due && { due: new Date(due).toISOString() }),
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
        thinking.className = "pulse-message";
        thinking.innerHTML = `
            <span class="pulse-avatar pulse-avatar--circle pulse-avatar--outline"><img class="avatar" src="${Workspace.avatar("vex")}" alt=""></span>
            <div class="pulse-message__head"><span class="pulse-message__sender">${Workspace.esc(Workspace.sender("vex"))}</span><span class="pulse-badge pulse-badge--accent pulse-badge--nodot">AI analyst</span></div>
            <div class="pulse-message__body thinking">${SiteSpinner.inline} Thinking…</div>`;
        document.getElementById("next-turn").before(thinking);
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

        // Delete is in the More menu and confirms with Pulse's destructive dialog first.
        document.getElementById("signal-delete").addEventListener("click", async () => {
            const ok = await Workspace.confirmDestructive({
                title: "Delete this signal?",
                body: "This removes the signal and its thread. You can’t undo it.",
                resource: this.signal.name ?? "",
                action: "Delete signal",
            });
            if (ok) this.delete();
        });
    }
}