const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const markdown = (value) => DOMPurify.sanitize(marked.parse(value, { breaks: true, gfm: true }));

class HackerSidebar {
    static POLL_MS = 5000;
    static DONE = "1";

    static GREETING = "I'm an expert red team agent. What do you want me to assess?";

    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.listen();
        this.reset();
    }

    reset() {
        document.getElementById("hacker-updates").replaceChildren();
        document.getElementById("hacker-form").reset();
        this.add("vex", HackerSidebar.GREETING);
    }

    add(source, value = "") {
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

        const now = new Date().toISOString();
        const timestamp = li.querySelector(".timestamp");
        timestamp.textContent = Workspace.date(now, true);
        timestamp.dateTime = now;

        li.querySelector(".sender").textContent = source;
        li.querySelector(".body").innerHTML = markdown(value);

        document.getElementById("hacker-updates").append(li);
        li.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return li;
    }

    addStep(step) {
        const li = this.add("vex");
        li.classList.add("step");
        li.querySelector(".body").innerHTML = `
            <div class="step-head">
                <span class="material-symbols-outlined step-status"></span>
                <span class="step-name"></span>
            </div>
            <div class="step-output"></div>`;

        li.querySelector(".step-name").textContent = step.name;
        return li;
    }

    renderStep(li, step) {
        const done = step.status === HackerSidebar.DONE;
        li.classList.toggle("is-done", done);
        li.querySelector(".step-status").textContent = done ? "check_circle" : "progress_activity";

        if (step.value) {
            li.querySelector(".step-output").innerHTML = markdown(step.value);
            li.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }

    async ask() {
        const input = document.getElementById("hacker-question");
        const question = input.value.trim();
        if (!question) return;

        const sidebar = document.getElementById("hacker-sidebar");
        sidebar.classList.add("is-busy");
        input.value = "";

        this.add("you", question);
        const thinking = this.add("vex", "Evaluating…");
        thinking.querySelector(".body").classList.add("thinking");

        let { operation, steps } = await this.api.operation.run(question);
        let cursor = 0;
        let row = null;

        while (cursor < steps.length) {
            await sleep(HackerSidebar.POLL_MS);
            ({ steps } = await this.api.operation.get(operation.id));
            steps.sort((a, b) => a.id - b.id);
            thinking.remove();

            for (; cursor < steps.length; cursor++) {
                row ??= this.addStep(steps[cursor]);
                this.renderStep(row, steps[cursor]);
                if (steps[cursor].status !== HackerSidebar.DONE) break;
                row = null;
            }
        }

        thinking.remove();
        sidebar.classList.remove("is-busy");
    }

    listen() {
        document.getElementById("hacker-form").addEventListener("submit", (ev) => {
            ev.preventDefault();
            this.ask();
        });

        document.getElementById("hacker-question").addEventListener("keydown", (ev) => {
            if (ev.key !== "Enter" || ev.shiftKey) return;
            ev.preventDefault();
            ev.target.form.requestSubmit();
        });
    }
}