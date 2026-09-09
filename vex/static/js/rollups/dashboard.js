class DashboardRollup {
    // Matches the <option> values in #signal-severity on the signal sidebar.
    static SEVERITY = {
        1: { label: 'Critical', color: '#e11d48' },
        2: { label: 'High', color: '#f97316' },
        3: { label: 'Medium', color: '#f59e0b' },
        4: { label: 'Low', color: '#3b82f6' },
        5: { label: 'Info', color: '#94a3b8' },
    };

    // Matches the <option> values in #signal-status on the signal sidebar.
    static STATUS = {
        OA: { label: 'Active', color: '#2563eb' },
        OB: { label: 'Blocked', color: '#f59e0b' },
        CH: { label: 'Resolved', color: '#16a34a' },
        CF: { label: 'False positive', color: '#94a3b8' },
        CR: { label: 'Accepted risk', color: '#8b5cf6' },
        CV: { label: 'Auto-closed', color: '#0ea5e9' },
    };

    // Named notification destinations for the monitors panel. Falls back to the
    // raw metadata value (title-cased) for anything not listed here.
    static DESTINATIONS = {
        slack: { label: 'Slack', color: '#8a5cf6' },
        teams: { label: 'Microsoft Teams', color: '#5059c9' },
        jira: { label: 'Jira', color: '#2684ff' },
    };

    // Bottom-to-top stacking order for the severity area chart — Critical ends
    // up drawn on top, since that's the band a security reviewer scans for first.
    static SEVERITY_STACK_ORDER = [5, 4, 3, 2, 1];

    // NOTE: identity assets don't carry an explicit "is this a human" flag in the
    // sample metadata, so this assumes service accounts are tagged via
    // metadata.type === 'service_account'. Adjust to match the real field.
    static classifyAsset(asset) {
        const group = asset.metadata?.group;
        if (group === 'domain') return 'domain';
        if (group !== 'identity') return 'other';
        return asset.metadata?.type === 'service_account' ? 'service' : 'human';
    }

    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.root = document.getElementById('dashboard-root');

        this.month = new Date();
        this.monthSignals = [];
        this.openSignals = [];
        this.assets = [];
        this.monitors = [];

        this.listen();
    }

    async reset() {
        this.monthSignals = [];
        this.openSignals = [];
        this.assets = [];
        this.monitors = [];
        this.render();
    }

    async reload() {
        await SiteSpinner.withLoading(async () => {
            this.monthSignals = [];
            this.openSignals = [];

            const monthKey = this.month.toISOString().slice(0, 7);

            await Promise.all([
                this.api.signals.list(`date=${monthKey}`, new CustomEvent('dashboard:signal-month')),
                this.api.signals.list('status=O', new CustomEvent('dashboard:signal-open')),
                this.api.inventory.list().then(assets => { this.assets = assets; }),
                this.api.monitors.list().then(monitors => { this.monitors = monitors; }),
            ]);

            this.render();
        });
    }

    async open(signal) {
        await SiteSpinner.withLoading(async () => {
            Workspace.sidebars.signal.reset();
            Workspace.sidebars.signal.inject(signal, await this.api.signals.get(signal.id));
            document.getElementById('signal-sidebar').show();
        });
    }

    render() {
        if (!this.root) return;

        const autoClosed = this.monthSignals.filter(s => s.status === 'CV').length;
        const criticalHighOpen = this.openSignals.filter(s => Number(s.severity) <= 2).length;
        const mttr = this.avgResolutionDays();
        const trend = this.recentSignalTrend();

        const severitySegments = this.severityBreakdown();
        const statusSegments = this.statusBreakdown();
        const topSources = this.topSources();
        const topChokePoints = this.topChokePoints();
        const chokepoint = topChokePoints[0];
        const destinationSegments = this.destinationBreakdown();
        const platformSegments = this.platformBreakdown();

        const humans = this.assets.filter(a => DashboardRollup.classifyAsset(a) === 'human').length;
        const suspended = this.assets.filter(a => !a.status?.startsWith('A')).length;
        const endpoints = this.assets.filter(a => !!a.metadata?.platform).length;
        const connected = this.monitors.filter(m => !m.status || m.status.startsWith('A')).length;

        const kpis = [
            { icon: 'bolt', value: this.openSignals.length.toLocaleString(), label: 'Open signals' },
            { icon: 'emergency', value: criticalHighOpen.toLocaleString(), label: 'Critical & high open' },
            { icon: 'trending_up', value: trend.current.toLocaleString(), label: 'New signals (7d)', trend: this.trendBadge(trend.current, trend.previous) },
            { icon: 'check_circle', value: autoClosed.toLocaleString(), label: 'Auto-closed this month' },
            { icon: 'schedule', value: mttr === null ? '—' : `${mttr.toFixed(1)}d`, label: 'Avg. time to close' },
        ];

        this.root.innerHTML = `
            ${this.buildKpiRow(kpis)}

            ${chokepoint ? this.buildChokepointCallout(chokepoint) : ''}

            <section class="dashboard-panel dashboard-panel--signals">
                <header class="dashboard-panel-header">
                    <h2><span class="material-symbols-outlined dashboard-panel-icon">sensors</span>Signals</h2>
                    <span class="dashboard-panel-sub">${this.month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</span>
                </header>
                <div class="dashboard-panel-body dashboard-signals-grid">
                    <div class="dashboard-chart-block">
                        <div class="dashboard-chart-block-label">Signal volume by severity, per day</div>
                        ${this.buildSeverityAreaChart()}
                        ${this.buildLegend(severitySegments, true)}
                    </div>
                    <div class="dashboard-chart-block dashboard-chart-block--donut">
                        <div class="dashboard-chart-block-label">Open signals by severity</div>
                        ${this.buildDonutChart(severitySegments, this.openSignals.length, 'open')}
                        ${this.buildLegend(severitySegments)}
                    </div>
                </div>
                <div class="dashboard-panel-body dashboard-signals-grid--row2">
                    <div class="dashboard-chart-block">
                        <div class="dashboard-chart-block-label">Top signal sources this month</div>
                        ${this.buildSourceBars(topSources)}
                    </div>
                    <div class="dashboard-chart-block">
                        <div class="dashboard-chart-block-label">Status breakdown this month</div>
                        ${this.buildStatusBars(statusSegments)}
                    </div>
                    <div class="dashboard-chart-block">
                        <div class="dashboard-chart-block-label">Repeat choke points</div>
                        ${this.buildChokePointList(topChokePoints)}
                    </div>
                </div>
            </section>

            <div class="dashboard-row-panels">
                <section class="dashboard-panel dashboard-panel--assets">
                    <header class="dashboard-panel-header">
                        <h2><span class="material-symbols-outlined dashboard-panel-icon">inventory_2</span>Assets</h2>
                    </header>
                    <div class="dashboard-panel-body dashboard-tile-grid">
                        ${this.statTile(humans, 'Employees')}
                        ${this.statTile(this.assets.length, 'Total assets')}
                        ${this.statTile(suspended, 'Suspended')}
                        ${this.statTile(endpoints, 'Endpoints')}
                    </div>
                    <div class="dashboard-panel-body">
                        <div class="dashboard-chart-block">
                            <div class="dashboard-chart-block-label">Endpoints by platform</div>
                            ${this.buildPlatformBars(platformSegments)}
                        </div>
                    </div>
                </section>

                <section class="dashboard-panel dashboard-panel--monitors">
                    <header class="dashboard-panel-header">
                        <h2><span class="material-symbols-outlined dashboard-panel-icon">radar</span>Monitors</h2>
                    </header>
                    <div class="dashboard-panel-body dashboard-monitors-grid">
                        <div class="dashboard-chart-block dashboard-chart-block--donut">
                            <div class="dashboard-chart-block-label">Connected</div>
                            ${this.buildDonutChart(
                                [{ label: 'Connected', color: '#2563eb', value: connected }],
                                this.monitors.length,
                                'monitors'
                            )}
                        </div>
                        <div class="dashboard-chart-block">
                            <div class="dashboard-chart-block-label">Where signals are sent</div>
                            ${this.buildDestinationBars(destinationSegments)}
                        </div>
                    </div>
                </section>
            </div>
        `;
    }

    // --- data shaping -------------------------------------------------------

    severityBreakdown() {
        const counts = {};
        this.openSignals.forEach(s => {
            const key = s.severity ?? 0;
            counts[key] = (counts[key] || 0) + 1;
        });

        return Object.entries(counts)
            .sort((a, b) => a[0] - b[0])
            .map(([severity, value]) => ({
                label: DashboardRollup.SEVERITY[severity]?.label ?? `Severity ${severity}`,
                color: DashboardRollup.SEVERITY[severity]?.color ?? '#94a3b8',
                value,
            }));
    }

    statusBreakdown() {
        const counts = {};
        this.monthSignals.forEach(s => {
            counts[s.status] = (counts[s.status] || 0) + 1;
        });

        return Object.entries(counts)
            .map(([status, value]) => ({
                label: DashboardRollup.STATUS[status]?.label ?? status,
                color: DashboardRollup.STATUS[status]?.color ?? '#94a3b8',
                value,
            }))
            .sort((a, b) => b.value - a.value);
    }

    topSources() {
        const counts = {};
        this.monthSignals.forEach(s => {
            counts[s.source] = (counts[s.source] || 0) + 1;
        });

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([source, value]) => ({ source, value }));
    }

    topChokePoints() {
        return [...this.openSignals]
            .filter(s => Number(s.metadata?.strength) > 0)
            .sort((a, b) => Number(b.metadata.strength) - Number(a.metadata.strength))
            .slice(0, 5);
    }

    destinationBreakdown() {
        const counts = {};
        this.monitors.forEach(m => {
            const dest = (m.metadata?.notification || '').toLowerCase();
            if (!dest) return;
            counts[dest] = (counts[dest] || 0) + 1;
        });

        return Object.entries(counts).map(([dest, value]) => ({
            label: DashboardRollup.DESTINATIONS[dest]?.label ?? (dest.charAt(0).toUpperCase() + dest.slice(1)),
            color: DashboardRollup.DESTINATIONS[dest]?.color ?? '#94a3b8',
            value,
        }));
    }

    platformBreakdown() {
        const counts = {};
        this.assets.forEach(a => {
            const platform = a.metadata?.platform;
            if (!platform) return;
            counts[platform] = (counts[platform] || 0) + 1;
        });

        return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([platform, value]) => ({ platform, value }));
    }

    // Average days between created and updated for signals closed this month.
    avgResolutionDays() {
        const closed = this.monthSignals.filter(s => s.status?.startsWith('C') && s.created && s.updated);
        if (!closed.length) return null;

        const totalDays = closed.reduce((sum, s) => sum + (new Date(s.updated) - new Date(s.created)) / 86400000, 0);
        return totalDays / closed.length;
    }

    // New-signal velocity, last 7 days vs the 7 days before that. NOTE: since
    // monthSignals only covers the current calendar month, this under-counts the
    // "previous 7 days" window during the first ~2 weeks of a new month.
    recentSignalTrend() {
        const now = Date.now(), oneDay = 86400000;
        let current = 0, previous = 0;

        this.monthSignals.forEach(s => {
            const age = now - new Date(s.created).getTime();
            if (age >= 0 && age <= 7 * oneDay) current++;
            else if (age > 7 * oneDay && age <= 14 * oneDay) previous++;
        });

        return { current, previous };
    }

    // --- small building blocks ----------------------------------------------

    statTile(value, label) {
        return `
            <div class="dashboard-tile">
                <div class="dashboard-tile-value">${value.toLocaleString()}</div>
                <div class="dashboard-tile-label">${label}</div>
            </div>
        `;
    }

    trendBadge(current, previous) {
        if (previous === 0 && current === 0) {
            return `<span class="dashboard-kpi-trend is-flat">flat</span>`;
        }
        if (previous === 0) {
            return `<span class="dashboard-kpi-trend is-up"><span class="material-symbols-outlined">trending_up</span>new</span>`;
        }

        const pct = Math.round(((current - previous) / previous) * 100);
        const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
        const icon = dir === 'up' ? 'trending_up' : dir === 'down' ? 'trending_down' : 'trending_flat';
        const sign = pct > 0 ? '+' : '';

        return `<span class="dashboard-kpi-trend is-${dir}"><span class="material-symbols-outlined">${icon}</span>${sign}${pct}%</span>`;
    }

    buildKpiRow(kpis) {
        return `
            <div class="dashboard-kpi-row">
                ${kpis.map(k => `
                    <div class="dashboard-kpi">
                        <div class="dashboard-kpi-top">
                            <span class="material-symbols-outlined dashboard-kpi-icon">${k.icon}</span>
                            ${k.trend ?? ''}
                        </div>
                        <div class="dashboard-kpi-value">${k.value}</div>
                        <div class="dashboard-kpi-label">${k.label}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Reuses the exact chokepoint-callout markup/classes from the tenant screen
    // (different id, so it can sit alongside that one) so it inherits the same
    // styling and reads as the same product concept, not a new component.
    buildChokepointCallout(signal) {
        return `
            <div class="chokepoint-callout" id="dashboard-chokepoint-callout" data-signal-id="${signal.id}">
                <div class="chokepoint-icon">
                    <img class="chokepoint-logo" src="static/img/source/${signal.source}.png" alt="${signal.source}" />
                </div>
                <div class="chokepoint-body">
                    <div class="chokepoint-title-row">
                        <span class="chokepoint-label">Choke Point</span>
                        <span class="chokepoint-name">${signal.name}</span>
                    </div>
                    <div class="chokepoint-meta">
                        <span>First seen <span class="cp-field">${Workspace.date(signal.created)}</span></span>
                        <span class="cp-dot"></span>
                        <span>Last updated <span class="cp-field">${Workspace.date(signal.updated)}</span></span>
                    </div>
                    <p class="chokepoint-explainer">A choke point is a single security weakness used by many attack paths. Fix this first.</p>
                </div>
            </div>
        `;
    }

    buildLegend(segments, compact) {
        if (!segments.length) return '';

        return `
            <ul class="dashboard-legend${compact ? ' dashboard-legend--compact' : ''}">
                ${segments.map(s => `
                    <li>
                        <span class="dashboard-legend-swatch" style="background:${s.color}"></span>
                        <span class="dashboard-legend-label">${s.label}</span>
                        ${compact ? '' : `<span class="dashboard-legend-value">${s.value}</span>`}
                    </li>
                `).join('')}
            </ul>
        `;
    }

    buildSeverityAreaChart() {
        const daysInMonth = new Date(this.month.getFullYear(), this.month.getMonth() + 1, 0).getDate();
        const order = DashboardRollup.SEVERITY_STACK_ORDER;
        const perSeverity = order.map(() => Array(daysInMonth).fill(0));

        this.monthSignals.forEach(s => {
            const day = new Date(s.created).getDate();
            if (day < 1 || day > daysInMonth) return;
            const idx = order.indexOf(Number(s.severity));
            if (idx === -1) return;
            perSeverity[idx][day - 1]++;
        });

        const w = 720, h = 200, pad = 10;
        const stepX = daysInMonth > 1 ? (w - pad * 2) / (daysInMonth - 1) : 0;
        const dailyTotal = Array.from({ length: daysInMonth }, (_, d) => perSeverity.reduce((sum, layer) => sum + layer[d], 0));
        const max = Math.max(1, ...dailyTotal);
        const cumulative = Array(daysInMonth).fill(0);

        const layers = order.map((sev, i) => {
            const topPoints = [];
            const bottomPoints = [];

            for (let d = 0; d < daysInMonth; d++) {
                const bottom = cumulative[d];
                const top = bottom + perSeverity[i][d];
                cumulative[d] = top;

                const x = pad + d * stepX;
                topPoints.push(`${x.toFixed(1)},${(h - pad - (top / max) * (h - pad * 2)).toFixed(1)}`);
                bottomPoints.unshift(`${x.toFixed(1)},${(h - pad - (bottom / max) * (h - pad * 2)).toFixed(1)}`);
            }

            const color = DashboardRollup.SEVERITY[sev]?.color ?? '#94a3b8';
            return `<polygon points="${topPoints.join(' ')} ${bottomPoints.join(' ')}" fill="${color}" fill-opacity="0.9"/>`;
        }).join('');

        return `
            <svg class="dashboard-areachart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
                ${layers}
            </svg>
        `;
    }

    buildDonutChart(segments, total, sublabel) {
        const size = 156, stroke = 20, r = (size - stroke) / 2, circumference = r * 2 * Math.PI;
        let offset = 0;

        const arcs = segments.filter(s => s.value > 0).map(s => {
            const dash = (s.value / (total || 1)) * circumference;
            const arc = `
                <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
                    stroke="${s.color}" stroke-width="${stroke}"
                    stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}"
                    stroke-dashoffset="${(-offset).toFixed(2)}"
                    transform="rotate(-90 ${size / 2} ${size / 2})"/>
            `;
            offset += dash;
            return arc;
        }).join('');

        return `
            <svg class="dashboard-donutchart" viewBox="0 0 ${size} ${size}">
                <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--dash-border, #e2e5eb)" stroke-width="${stroke}"/>
                ${arcs}
                <text x="${size / 2}" y="${size / 2 - 4}" class="dashboard-donutchart-total">${total}</text>
                <text x="${size / 2}" y="${size / 2 + 16}" class="dashboard-donutchart-label">${sublabel}</text>
            </svg>
        `;
    }

    buildBarRows(rows, { icon } = {}) {
        if (!rows.length) return null;

        const max = Math.max(1, ...rows.map(r => r.value));

        return `
            <div class="dashboard-rows">
                ${rows.map(r => `
                    <div class="dashboard-row">
                        <span class="dashboard-row-label${icon ? ' dashboard-row-label--icon' : ''}">
                            ${icon ? `<img src="static/img/source/${r.iconKey}.png" alt="" />` : ''}
                            ${r.label}
                        </span>
                        <span class="dashboard-row-track">
                            <span class="dashboard-row-fill" style="width:${((r.value / max) * 100).toFixed(1)}%; ${r.color ? `background:${r.color}` : ''}"></span>
                        </span>
                        <span class="dashboard-row-value">${r.value}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    buildDestinationBars(segments) {
        return this.buildBarRows(segments) ?? `<div class="dashboard-empty">No monitors have a notification destination configured</div>`;
    }

    buildStatusBars(segments) {
        return this.buildBarRows(segments) ?? `<div class="dashboard-empty">No signals recorded this month</div>`;
    }

    buildSourceBars(sources) {
        const rows = sources.map(s => ({ label: s.source, value: s.value, iconKey: s.source }));
        return this.buildBarRows(rows, { icon: true }) ?? `<div class="dashboard-empty">No signals recorded this month</div>`;
    }

    buildPlatformBars(platforms) {
        const rows = platforms.map(p => ({ label: p.platform, value: p.value, iconKey: p.platform }));
        return this.buildBarRows(rows, { icon: true }) ?? `<div class="dashboard-empty">No endpoint platforms detected</div>`;
    }

    // Reuses the same strength-meter markup as TenantScreen.strength(), so it
    // picks up signal.css styling for free instead of introducing a new pattern.
    strengthMeter(value) {
        const lit = Math.min(value, 10);
        const maxed = value >= 10;

        const bars = Array.from({ length: 10 }, (_, i) =>
            `<span class="strength-bar${i < lit ? ' lit' : ''}"></span>`
        ).join('');

        return `
            <div class="strength-meter${maxed ? ' maxed' : ''}">
                <span class="strength-bars">${bars}</span>
                <span class="strength-value">${value}${maxed ? '+' : ''}</span>
            </div>
        `;
    }

    buildChokePointList(signals) {
        if (!signals.length) {
            return `<div class="dashboard-empty">No repeat choke points among open signals</div>`;
        }

        return `
            <ul class="dashboard-chokelist">
                ${signals.map(s => `
                    <li data-signal-id="${s.id}">
                        <img src="static/img/source/${s.source}.png" alt="" />
                        <span class="dashboard-chokelist-name" title="${s.name}">${s.name}</span>
                        ${this.strengthMeter(Number(s.metadata.strength))}
                    </li>
                `).join('')}
            </ul>
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
}