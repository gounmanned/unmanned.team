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
        this.el = document.getElementById("getting-started");
        this.listen();
    }

    static firstVendorMatch(monitors, vendors) {
        for (const key of monitors) {
            const vendor = key.split('/').filter(Boolean)[1];
            if (vendor && vendors.has(vendor)) return vendor;
        }
        return null;
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
            const id = Banner.VENDOR_TO_STEP.get(vendor) ?? (!Banner.KNOWN_VENDORS.has(vendor) ? 'saas' : null);
            if (id && !matchedByStep.has(id)) matchedByStep.set(id, vendor);
        }

        if (matchedByStep.has('endpoint')) {
            TenantScreen.endpoint = true;
        }

        let emailCount = 0, endpointCount = 0, domainCount = 0, otherCount = 0;
        for (const { metadata: md = {} } of assets) {
            if (md.group === 'identity') emailCount++;
            if (md.platform) endpointCount++;
            if (md.group === 'domain') domainCount++;
            if (md.group !== 'identity' && md.group !== 'domain') otherCount++;
        }

        const setStat = (id, value) => {
            const el = document.getElementById(`gs-stat-${id}`);
            if (el) el.textContent = value;
        };

        setStat('email', emailCount);
        setStat('endpoint', endpointCount);
        setStat('domain', domainCount);
        setStat('saas', otherCount);

        const notifVendor = matchedByStep.get('notifications')
            ?? Banner.firstVendorMatch(monitors, new Set(Banner.STEP_VENDORS.notifications));
        const notifLogo = document.getElementById('gs-stat-notifications-logo');
        const notifEmpty = document.getElementById('gs-stat-notifications-empty');

        if (notifVendor && notifLogo) {
            notifLogo.src = `static/img/source/${notifVendor}.png`;
        }
        notifLogo?.toggleAttribute('hidden', !notifVendor);
        notifEmpty?.toggleAttribute('hidden', !!notifVendor);

        for (const id of [...Object.keys(Banner.STEP_VENDORS), 'saas']) {
            const card = document.getElementById(`gs-${id}`);
            if (!card) continue;

            const vendor = matchedByStep.get(id);
            let isDone = !!vendor;

            if (id === 'endpoint') {
                isDone = (TenantScreen.endpoint || !!vendor) && endpointCount > 0;
            }

            card.classList.toggle('done', isDone);
        }

        this.el.classList.remove("loading");
    }

    listen() {
        this.el.addEventListener("click", (e) => {
            if (e.target.closest(".gs-card-main")) document.getElementById("open-monitor-rollup").click();
        });
    }
}