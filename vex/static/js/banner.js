class Banner {
    static endpoint = false;

    static STEP_VENDORS = {
        email:         ['google', 'microsoft'],
        endpoint:      ['level', 'crowdstrike', 'sentinelone'],
        domain:        ['cloudflare', 'squarespace'],
        notifications: ['slack', 'teams', 'jira'],
    };

    static VENDOR_TO_STEP = new Map(
        Object.entries(Banner.STEP_VENDORS).flatMap(([id, vendors]) => vendors.map(v => [v, id]))
    );

    static KNOWN_VENDORS = new Set(Object.values(Banner.STEP_VENDORS).flat());

    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.statsLoading = false;
        this.el = document.getElementById("getting-started");
        this.initToggle();
    }

    initToggle() {
        const btn = document.getElementById("gs-toggle");
        if (!btn) return;
        btn.addEventListener("click", () => this.toggleStats());
    }

    async toggleStats() {
        const btn = document.getElementById("gs-toggle");
        const next = !this.el.classList.contains("stats-mode");

        this.el.classList.toggle("stats-mode", next);
        btn.setAttribute("aria-pressed", String(next));

        if (next) await this.loadStats();
    }

    static firstVendorMatch(monitors, vendors) {
        for (const key of monitors) {
            const vendor = key.split('/').filter(Boolean)[1];
            if (vendor && vendors.has(vendor)) return vendor;
        }
        return null;
    }

    async loadStats(monitors = null) {
        if (this.statsLoading) return;
        this.statsLoading = true;
        this.el.classList.add("stats-loading");

        const [assets, fetchedMonitors] = await Promise.all([
            this.api.inventory.list().catch(() => []),
            monitors ?? this.api.monitors.list().catch(() => []),
        ]);

        let emailCount = 0, endpointCount = 0, domainCount = 0;
        for (const { metadata: md = {} } of assets) {
            if (md.group === 'identity') emailCount++;
            if (md.platform) endpointCount++;
            if (md.group === 'domain') domainCount++;
        }

        const setStat = (id, value) => {
            const el = document.getElementById(`gs-stat-${id}`);
            if (el) el.textContent = value;
        };

        setStat('email', emailCount);
        setStat('endpoint', endpointCount);
        setStat('domain', domainCount);
        setStat('saas', fetchedMonitors.length);

        const notifVendor = Banner.firstVendorMatch(fetchedMonitors, new Set(Banner.STEP_VENDORS.notifications));
        const notifLogo = document.getElementById('gs-stat-notifications-logo');
        const notifEmpty = document.getElementById('gs-stat-notifications-empty');

        notifLogo?.toggleAttribute('hidden', !notifVendor);
        notifEmpty?.toggleAttribute('hidden', !!notifVendor);
        if (notifVendor && notifLogo) notifLogo.src = `static/img/source/${notifVendor}.png`;

        this.el.classList.remove("stats-loading");
        this.statsLoading = false;
    }

    async refresh() {
        this.el.classList.add("loading");

        const monitors = await this.api.monitors.list().catch(() => []);
        const matchedByStep = new Map();
        for (const key of monitors) {
            const vendor = key.split('/').filter(Boolean)[1];
            if (!vendor) continue;
            const id = Banner.VENDOR_TO_STEP.get(vendor) ?? (!Banner.KNOWN_VENDORS.has(vendor) ? 'saas' : null);
            if (id && !matchedByStep.has(id)) matchedByStep.set(id, vendor);
        }

        if (matchedByStep.has('endpoint')) {
            TenantScreen.endpoint = true;
        }

        for (const id of [...Object.keys(Banner.STEP_VENDORS), 'saas']) {
            const card = document.getElementById(`gs-${id}`);
            if (!card) continue;

            const vendor = matchedByStep.get(id);
            const isDone = id === 'endpoint' ? (TenantScreen.endpoint || !!vendor) : !!vendor;

            card.classList.toggle('done', isDone);
            card.querySelector('.gs-check').textContent = isDone ? 'check_circle' : 'radio_button_unchecked';
            card.querySelector('.gs-status').textContent = isDone ? 'Connected' : '';
        }

        this.el.classList.remove("loading");

        if (this.el.classList.contains("stats-mode")) {
            await this.loadStats(monitors);
        }
    }
}