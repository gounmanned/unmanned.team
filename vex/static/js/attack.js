class AttackMode {
    static TEST = {
        title: 'Impossible travel',
        description: 'Launch an impossible travel test against any identity to measure detection and response.',
        img: 'static/img/test/T1078.png',
    };

    constructor(state, reload) {
        this.state = state;
        this.api = state.api;
        this.reload = reload;
        this.on = false;
        this.test = null;
        this.timer = null;

        this.el = {
            btn: document.getElementById('attack-toggle'),
            section: document.getElementById('attack-section'),
            boot: document.getElementById('attack-boot'),
            launch: document.getElementById('attack-launch'),
            progress: document.getElementById('attack-progress'),
            target: document.getElementById('attack-target'),
            clock: document.getElementById('attack-clock'),
        };

        this.el.btn.addEventListener('click', () => this.toggle());
        document.getElementById('attack-start').addEventListener('click', () => this.start());
    }

    toggle() {
        return this.on ? this.close() : this.open();
    }

    reset() {
        this.close();
        this.el.target.innerHTML = '';
    }

    async open() {
        this.on = true;
        this.el.btn.classList.add('active');
        this.boot(true);
        document.body.classList.add('attack');
        this.el.section.hidden = false;

        await Promise.all([this.render(), new Promise(r => setTimeout(r, 900))]);
        this.boot(false);
    }

    close() {
        this.on = false;
        this.el.btn.classList.remove('active');
        this.el.section.hidden = true;
        document.body.classList.remove('attack');
        clearInterval(this.timer);
    }

    boot(show) {
        this.el.boot.classList.toggle('show', show);
        this.el.boot.setAttribute('aria-hidden', String(!show));
    }

    current() {
        const signals = this.state.signals[this.state.account()] ?? {};
        return Object.values(signals).find(s => s.kind == 4 && s.status?.startsWith('O'));
    }

    fill(view, test) {
        document.getElementById(`attack-${view}-title`).textContent = test.title;
        document.getElementById(`attack-${view}-desc`).textContent = test.description;
        document.getElementById(`attack-${view}-img`).src = test.img;
    }

    async render(test = this.current()) {
        this.test = test;
        const running = !!test;

        this.el.launch.hidden = running;
        this.el.progress.hidden = !running;

        this.fill(running ? 'progress' : 'launch', AttackMode.TEST);
        clearInterval(this.timer);
        if (running) return this.tick();

        const assets = await this.api.inventory.list();
        this.el.target.innerHTML = assets.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
    }

    tick() {
        const start = new Date(this.test.created);
        const p = n => String(Math.floor(n)).padStart(2, '0');

        const draw = () => {
            const s = (Date.now() - start) / 1000;
            this.el.clock.textContent = `${p(s / 3600)}:${p(s / 60 % 60)}:${p(s % 60)}`;
        };

        draw();
        this.timer = setInterval(draw, 1000);
    }

    async start() {
        const name = this.el.target.value;
        if (!name) return;

        await SiteSpinner.withLoading(async () => {
            const test = await this.api.attack.run(name);
            await this.reload();
            await this.render(test);
        });
    }

    onSignal(signal) {
        if (this.on && signal.metadata?.test) this.render();
    }
}