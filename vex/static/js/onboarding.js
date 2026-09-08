class Onboarding {
    static endpoint = false;

    constructor(state) {
        this.state = state;
        this.api = state.api;
    }

    async refresh() {
        document.getElementById("getting-started").classList.add("loading");

        const STEP_VENDORS = {
            email:         ['google', 'microsoft'],
            endpoint:      ['level', 'crowdstrike', 'sentinelone'],
            domain:        ['cloudflare', 'squarespace'],
            notifications: ['slack', 'teams', 'jira'],
        };

        const KNOWN_VENDORS = new Set(Object.values(STEP_VENDORS).flat());
        const vendorToStep = new Map(Object.entries(STEP_VENDORS).flatMap(([id, vendors]) => vendors.map(v => [v, id])));
        const monitors = await this.api.monitors.list().catch(() => []);
        const vendors = monitors.map(key => key.split('/').filter(Boolean)[1]).filter(Boolean);

        const matchedByStep = new Map();
        for (const v of vendors) {
            const id = vendorToStep.get(v) ?? (!KNOWN_VENDORS.has(v) ? 'saas' : null);
            if (id && !matchedByStep.has(id)) matchedByStep.set(id, v);
        }

        if (matchedByStep.has('endpoint')) {
            TenantScreen.endpoint = true;
        }

        for (const id of [...Object.keys(STEP_VENDORS), 'saas']) {
            const card = document.getElementById(`gs-${id}`);
            if (!card) continue;

            const vendor = matchedByStep.get(id);
            const isDone = id === 'endpoint' ? (TenantScreen.endpoint || !!vendor) : !!vendor;

            const check = card.querySelector('.gs-check');
            const status = card.querySelector('.gs-status');
            const logo = card.querySelector('.gs-logo');

            card.classList.toggle('done', isDone);
            check.textContent = isDone ? 'check_circle' : 'radio_button_unchecked';
            status.textContent = isDone ? 'Connected' : '';

            if (vendor) {
                logo.src = `static/img/source/${vendor}.png`;
                logo.style.display = 'block';
            } else if (!isDone) {
                logo.removeAttribute('src');
                logo.style.display = 'none';
            }
        }

        document.getElementById("getting-started").classList.remove("loading");
    }
}