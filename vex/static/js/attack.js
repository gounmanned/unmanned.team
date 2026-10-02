class AttackMode {
    static TEST = {
        title: 'Credential Phishing',
        description: 'Launches a simulated phishing campaign against the selected identity to measure detection and response.',
        img: 'static/img/test/phish.png',
    };

    constructor(state, reload) {
        this.state  = state;
        this.api    = state.api;
        this.reload = reload;
        this.on     = false;
        this.test   = null;

        this.el = {
            btn:      document.getElementById('attack-toggle'),
            section:  document.getElementById('attack-section'),
            boot:     document.getElementById('attack-boot'),
            launch:   document.getElementById('attack-launch'),
            progress: document.getElementById('attack-progress'),
            target:   document.getElementById('attack-target'),
            clock:    document.getElementById('attack-clock'),
        };

        this.el.btn.addEventListener('click', () => this.toggle());
        document.getElementById('attack-start').addEventListener('click', () => this.start());
    }

    toggle() { return this.on ? this.close() : this.open(); }

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
    }

    boot(show) {
        this.el.boot.classList.toggle('show', show);
        this.el.boot.setAttribute('aria-hidden', String(!show));
    }

    current() {
        const signals = this.state.signals?.[this.state.account()] ?? {};
        return Object.values(signals).find(s =>
            s.source === 'test' && String(s.status).startsWith('O'));
    }

    fill(view, test) {
        document.getElementById(`attack-${view}-title`).textContent = test.title;
        document.getElementById(`attack-${view}-desc`).textContent  = test.description;
        document.getElementById(`attack-${view}-img`).src           = test.img;
    }

    async render() {
        this.test = this.current();
        const running = !!this.test;

        this.el.launch.hidden   = running;
        this.el.progress.hidden = !running;

        this.fill(running ? 'progress' : 'launch', AttackMode.TEST);
        if (running) return;

        const assets = await this.api.inventory.list();
        this.el.target.innerHTML =
            assets.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
    }

    async start() {
        const name = this.el.target.value;
        if (!name) return;
        await SiteSpinner.withLoading(async () => {
            await this.api.attack.run(name);
            await this.reload();
        });
    }

    onSignal(signal) {
        if (this.on && signal.source === 'test') this.render();
    }
}