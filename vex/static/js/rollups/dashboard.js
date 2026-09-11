class DashboardRollup {
    static STATUS = {
        OA: { label: 'Active', color: '#2563eb' },
        OB: { label: 'Blocked', color: '#f59e0b' },
        CH: { label: 'Resolved', color: '#16a34a' },
        CF: { label: 'False positive', color: '#94a3b8' },
        CR: { label: 'Accepted risk', color: '#8b5cf6' },
        CV: { label: 'Auto-closed', color: '#0ea5e9' },
    };

    static SOURCE_PALETTE = ['#3b82f6', '#8b5cf6', '#f97316', '#16a34a', '#e11d48', '#0ea5e9', '#f59e0b', '#6366f1'];

    static ASSET_GROUPS = {
        identity: { label: 'Human', color: '#3b82f6' },
        domain:   { label: 'Domain', color: '#8b5cf6' },
        other:    { label: 'Other', color: '#94a3b8' },
    };

    static classifyAsset(asset) {
        const group = asset.metadata?.group;
        return DashboardRollup.ASSET_GROUPS[group] ? group : 'other';
    }

    static monitorVendor(key) {
        if (typeof key !== 'string') return null;
        return key.split('/').filter(Boolean)[1] ?? null;
    }

    static HEADER_STATS = [
        { id: 'email',    label: 'Email accounts', icon: 'mail' },
        { id: 'endpoint', label: 'Endpoints',       icon: 'laptop' },
        { id: 'domain',   label: 'Domains',         icon: 'public' },
        { id: 'saas',     label: 'SaaS monitors',   icon: 'radar' },
    ];

    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.root = document.getElementById('dashboard-root');

        this.month = new Date();
        this.openSignals = [];
        this.monthSignals = [];
        this.assets = [];
        this.monitors = [];

        this.listen();
    }

    async reset() {
        this.openSignals = [];
        this.monthSignals = [];
        this.assets = [];
        this.monitors = [];
        this.render();
    }

    async reload() {
        await SiteSpinner.withLoading(async () => {
            this.openSignals = [];
            this.monthSignals = [];

            const monthKey = this.month.toISOString().slice(0, 7);

            const [, , assets, monitors] = await Promise.all([
                this.api.signals.list(`date=${monthKey}`, new CustomEvent('dashboard:signal-month')),
                this.api.signals.list('status=O', new CustomEvent('dashboard:signal-open')),
                this.api.inventory.list().catch(() => []),
                this.api.monitors.list().catch(() => []),
            ]);

            this.assets = assets;
            this.monitors = monitors;

            this.render();
        });
    }

    render() {
        if (!this.root) return;

        this.openSignals ??= [];
        this.monthSignals ??= [];
        this.assets ??= [];
        this.monitors ??= [];

        this.root.innerHTML = `
            ${this.buildHeaderStats()}

            <section class="dashboard-panel dashboard-panel--signals">
                <header class="dashboard-panel-header">
                    <h2><span class="material-symbols-outlined dashboard-panel-icon">bolt</span>Signals</h2>
                    <span class="dashboard-panel-sub">${this.month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</span>
                </header>

                <div class="dashboard-panel-body dashboard-kpi-mini-row">
                    ${this.miniKpi(this.openSignals.length, 'Open signals')}
                    ${this.miniKpi(this.closedThisMonthCount(), 'Closed this month')}
                    ${this.miniKpi(this.formatDuration(this.avgOpenTime()), 'Avg. open time')}
                    ${this.miniKpi(this.autoClosedCount(), 'Auto-closed')}
                </div>

                <div class="dashboard-panel-body dashboard-signals-grid">
                    <div class="dashboard-chart-block dashboard-chart-block--donut">
                        <div class="dashboard-chart-block-label">Signals by source</div>
                        ${this.buildPieChart(this.sourceBreakdown(), this.monthSignals.length, 'this month')}
                        ${this.buildLegend(this.sourceBreakdown())}
                    </div>
                    <div class="dashboard-chart-block dashboard-chart-block--donut">
                        <div class="dashboard-chart-block-label">Signals by status</div>
                        ${this.buildPieChart(this.statusBreakdown(), this.monthSignals.length, 'this month')}
                        ${this.buildLegend(this.statusBreakdown())}
                    </div>
                    <div class="dashboard-chart-block dashboard-chart-block--callout">
                        <div class="dashboard-chart-block-label">Highest strength open signal</div>
                        ${this.buildTopStrengthCallout()}
                    </div>
                </div>
            </section>

            <div class="dashboard-row-panels">
                <section class="dashboard-panel dashboard-panel--assets">
                    <header class="dashboard-panel-header">
                        <h2><span class="material-symbols-outlined dashboard-panel-icon">inventory_2</span>Assets</h2>
                    </header>
                    <div class="dashboard-panel-body dashboard-assets-grid">
                        <div class="dashboard-chart-block dashboard-chart-block--donut">
                            <div class="dashboard-chart-block-label">Tracked assets</div>
                            ${this.buildPieChart(this.assetGroupBreakdown(), this.assets.length, 'total')}
                            ${this.buildLegend(this.assetGroupBreakdown())}
                        </div>
                        <div class="dashboard-tile-grid--2col">
                            ${this.statTile(this.assets.length, 'Total assets')}
                            ${this.statTile(this.suspendedCount(), 'Suspended', 'is-warning')}
                        </div>
                    </div>
                </section>

                <section class="dashboard-panel dashboard-panel--monitors">
                    <header class="dashboard-panel-header">
                        <h2><span class="material-symbols-outlined dashboard-panel-icon">sensors</span>Connected monitors</h2>
                        <span class="dashboard-panel-sub">${this.monitors.length}</span>
                    </header>
                    <div class="dashboard-panel-body">
                        ${this.buildMonitorGrid()}
                    </div>
                </section>
            </div>
        `;
    }

    // --- data shaping -------------------------------------------------------

    closedThisMonthCount() {
        return this.monthSignals.filter(s => s.status?.startsWith('C')).length;
    }

    autoClosedCount() {
        return this.monthSignals.filter(s => s.status === 'CV').length;
    }

    suspendedCount() {
        return this.assets.filter(a => a.status?.startsWith('X')).length;
    }

    avgOpenTime() {
        const closed = this.monthSignals.filter(s => s.status?.startsWith('C') && s.created && s.updated);
        if (!closed.length) return null;

        const totalMs = closed.reduce((sum, s) => sum + (new Date(s.updated) - new Date(s.created)), 0);
        return totalMs / closed.length;
    }

    formatDuration(ms) {
        if (ms === null || Number.isNaN(ms)) return '—';
        const hours = ms / 3600000;
        if (hours < 24) return `${hours.toFixed(1)}h`;
        return `${(hours / 24).toFixed(1)}d`;
    }

    sourceBreakdown() {
        const counts = {};
        this.monthSignals.forEach(s => { counts[s.source] = (counts[s.source] || 0) + 1; });

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([source, value], i) => ({
                label: source,
                color: DashboardRollup.SOURCE_PALETTE[i % DashboardRollup.SOURCE_PALETTE.length],
                value,
            }));
    }

    statusBreakdown() {
        const counts = {};
        this.monthSignals.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });

        return Object.entries(counts)
            .map(([status, value]) => ({
                label: DashboardRollup.STATUS[status]?.label ?? status,
                color: DashboardRollup.STATUS[status]?.color ?? '#94a3b8',
                value,
            }))
            .sort((a, b) => b.value - a.value);
    }

    assetGroupBreakdown() {
        const counts = { identity: 0, domain: 0, other: 0 };
        this.assets.forEach(a => { counts[DashboardRollup.classifyAsset(a)]++; });

        return Object.entries(counts)
            .filter(([, value]) => value > 0)
            .map(([group, value]) => ({
                label: DashboardRollup.ASSET_GROUPS[group].label,
                color: DashboardRollup.ASSET_GROUPS[group].color,
                value,
            }));
    }

    topStrengthSignal() {
        return [...this.openSignals]
            .filter(s => Number(s.metadata?.strength) > 0)
            .sort((a, b) => Number(b.metadata.strength) - Number(a.metadata.strength))[0] ?? null;
    }

    // --- header stat strip ----------------------------------------------

    buildHeaderStats() {
        let email = 0, endpoint = 0, domain = 0;
        for (const { metadata: md = {} } of this.assets) {
            if (md.group === 'identity') email++;
            if (md.platform) endpoint++;
            if (md.group === 'domain') domain++;
        }
        const values = { email, endpoint, domain, saas: this.monitors.length };

        return `
            <div class="dashboard-stat-strip">
                ${DashboardRollup.HEADER_STATS.map(stat => `
                    <div class="dashboard-stat-card">
                        <span class="material-symbols-outlined dashboard-stat-icon">${stat.icon}</span>
                        <div class="dashboard-stat-body">
                            <div class="dashboard-stat-value">${(values[stat.id] ?? 0).toLocaleString()}</div>
                            <div class="dashboard-stat-label">${stat.label}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // --- small building blocks ----------------------------------------------

    miniKpi(value, label) {
        return `
            <div class="dashboard-mini-kpi">
                <div class="dashboard-mini-kpi-value">${typeof value === 'number' ? value.toLocaleString() : value}</div>
                <div class="dashboard-mini-kpi-label">${label}</div>
            </div>
        `;
    }

    statTile(value, label, modifier = '') {
        return `
            <div class="dashboard-tile ${modifier}">
                <div class="dashboard-tile-value">${value.toLocaleString()}</div>
                <div class="dashboard-tile-label">${label}</div>
            </div>
        `;
    }

    buildLegend(segments) {
        if (!segments.length) return `<div class="dashboard-empty">No data yet</div>`;
        return `
            <ul class="dashboard-legend">
                ${segments.map(s => `
                    <li>
                        <span class="dashboard-legend-swatch" style="background:${s.color}"></span>
                        <span class="dashboard-legend-label">${s.label}</span>
                        <span class="dashboard-legend-value">${s.value}</span>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    buildPieChart(segments, total, sublabel) {
        const size = 148, stroke = 22, r = (size - stroke) / 2, circumference = r * 2 * Math.PI;
        let offset = 0;

        const arcs = segments.filter(s => s.value > 0).map(s => {
            const dash = (s.value / (total || 1)) * circumference;
            const arc = `
                <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
                    stroke="${s.color}" stroke-width="${stroke}" stroke-linecap="butt"
                    stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}"
                    stroke-dashoffset="${(-offset).toFixed(2)}"
                    transform="rotate(-90 ${size / 2} ${size / 2})"/>
            `;
            offset += dash;
            return arc;
        }).join('');

        return `
            <svg class="dashboard-piechart" viewBox="0 0 ${size} ${size}">
                <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--dash-border)" stroke-width="${stroke}"/>
                ${arcs}
                <text x="${size / 2}" y="${size / 2 - 4}" class="dashboard-piechart-total">${total}</text>
                <text x="${size / 2}" y="${size / 2 + 16}" class="dashboard-piechart-label">${sublabel}</text>
            </svg>
        `;
    }

    wifiStrengthHero(value) {
        const heights = [16, 26, 36, 46];

        const bars = heights.map((h, i) => `
            <rect x="${i * 17}" y="${46 - h}" width="13" height="${h}" rx="3" class="wifi-bar-hero"/>
        `).join('');

        return `
            <div class="wifi-strength-hero">
                <svg viewBox="0 0 63 46" class="wifi-strength-hero-svg">${bars}</svg>
                <div class="wifi-strength-hero-value">${value}</div>
                <div class="wifi-strength-hero-caption">attack paths</div>
            </div>
        `;
    }

    buildTopStrengthCallout() {
        const signal = this.topStrengthSignal();
        if (!signal) return `<div class="dashboard-empty">No open signals with recorded strength</div>`;

        return `
            <div class="dashboard-strength-hero" data-signal-id="${signal.id}">
                ${this.wifiStrengthHero(Number(signal.metadata.strength))}
                <div class="dashboard-strength-hero-body">
                    <div class="dashboard-strength-hero-name" title="${signal.name}">${signal.name}</div>
                    <div class="dashboard-strength-hero-meta">
                        <span class="dashboard-strength-hero-meta-item">
                            <img class="dashboard-strength-hero-source-logo" src="static/img/source/${signal.source}.png" />
                            ${signal.source}
                        </span>
                        <span class="dashboard-strength-hero-meta-item">
                            <span class="material-symbols-outlined">location_on</span>
                            ${signal.asset}
                        </span>
                        <span class="dashboard-strength-hero-meta-item">
                            <span class="material-symbols-outlined">schedule</span>
                            First seen ${Workspace.date(signal.created)}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    buildMonitorGrid() {
        const vendors = this.monitors
            .map(key => DashboardRollup.monitorVendor(key))
            .filter(Boolean);

        if (!vendors.length) {
            return `<div class="dashboard-empty">No monitors connected yet</div>`;
        }

        return `
            <div class="dashboard-monitor-grid">
                ${vendors.map(vendor => `
                    <div class="dashboard-monitor-card">
                        <span class="dashboard-monitor-status is-on"></span>
                        <img class="dashboard-monitor-logo" src="static/img/source/${vendor}.png" />
                        <span class="dashboard-monitor-name">${vendor}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    listen() {
        document.addEventListener('dashboard:signal-month', ev => {
            this.monthSignals.push(ev.signal);
        });

        document.addEventListener('dashboard:signal-open', ev => {
            this.openSignals.push(ev.signal);
        });

        this.root?.addEventListener('click', ev => {
            const node = ev.target.closest('[data-signal-id]');
            if (!node) return;
            const signal = this.openSignals.find(s => String(s.id) === node.dataset.signalId);
            if (signal) this.open(signal);
        });
    }

    async open(signal) {
        await SiteSpinner.withLoading(async () => {
            Workspace.sidebars.signal.reset();
            Workspace.sidebars.signal.inject(signal, await this.api.signals.get(signal.id));
            document.getElementById('signal-sidebar').show();
        });
    }
}