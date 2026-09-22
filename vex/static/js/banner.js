class Banner {
    static endpoint = false;

    static STEP_VENDORS = {
        email:         ['google', 'microsoft'],
        endpoint:      ['level'],
        domain:        ['cloudflare'],
        notifications: ['slack', 'teams', 'jira', 'rapid7'],
    };

    static VENDOR_TO_STEP = new Map(
        Object.entries(Banner.STEP_VENDORS).flatMap(([id, vendors]) => vendors.map(v => [v, id]))
    );

    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.el = document.getElementById("getting-started");
        this.listen();
    }

    async refresh() {
        this.el.classList.add("loading");

        const [assets, monitors] = await Promise.all([
            this.api.inventory.list().catch(() => []),
            this.api.monitors.list().catch(() => []),
        ]);

        const matchedByStep = new Map();
        for (const key of monitors) {
            const vendor = key.split('/').filter(Boolean)[1];
            if (!vendor) continue;
            const id = Banner.VENDOR_TO_STEP.get(vendor);
            if (id && !matchedByStep.has(id)) matchedByStep.set(id, vendor);
        }

        if (matchedByStep.has('endpoint')) {
            TenantScreen.endpoint = true;
        }

        let endpointCount = 0;
        for (const asset of assets) {
            const md = asset.metadata ?? {};
            if (md.platform) endpointCount++;
        }

        let allDone = true;

        for (const id of Object.keys(Banner.STEP_VENDORS)) {
            const card = document.getElementById(`gs-${id}`);
            if (!card) continue;

            const vendor = matchedByStep.get(id);
            let isDone = !!vendor;

            if (id === 'endpoint') {
                isDone = (TenantScreen.endpoint || !!vendor) && endpointCount > 0;
            }

            card.classList.toggle('done', isDone);

            const check = card.querySelector('.gs-check');
            if (check) check.textContent = isDone ? 'check_circle' : 'radio_button_unchecked';

            if (!isDone) allDone = false;
        }

        this.el.hidden = allDone;
        this.el.classList.remove("loading");
    }

    listen() {
        this.el.addEventListener("click", (e) => {
            if (e.target.closest(".gs-card-main")) document.getElementById("open-monitor-rollup").click();
        });
    }
}