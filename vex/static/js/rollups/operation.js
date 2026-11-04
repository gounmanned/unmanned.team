const CHARGE = -520;

class OperationRollup {
    constructor(state) {
        this.state = state;
        this.api = state.api;

        this.head = document.getElementById('operation-list-head');
        this.list = document.getElementById('operation-list');
        this.graph = document.getElementById('operation-graph');
        this.detail = document.getElementById('operation-detail');

        this.operations = [];
        this.nodes = [];
        this.links = [];
        this.nodeById = {};
        this.pos = {};              // cached x/y by node id, survives reloads

        this.selectedOp = null;     // operation id, as a string
        this.selectedAsset = null;  // asset node id
        this.targets = [];          // asset names to highlight
        this.running = false;

        // d3 handles
        this.sim = null;
        this.svg = null;
        this.scene = null;
        this.zoom = null;
        this.nodeSel = null;
        this.linkSel = null;
        this.runSel = null;

        this.listen();
    }

    async reset() {
        this.operations = [];
        this.nodes = [];
        this.links = [];
        this.nodeById = {};
        this.pos = {};
        this.selectedOp = null;
        this.selectedAsset = null;
        this.targets = [];
        this._teardownGraph();
        this._render();
        this._closeDossier();
    }

    async reload() {
        const [operations, sources, assets] = await Promise.all([
            this.api.operation.list(),
            this.api.sources.list(),
            this.api.inventory.list(),
        ]);

        this.operations = operations.sort((a, b) => this._time(b.updated) - this._time(a.updated));
        this._buildGraph(sources, assets);
        this._render();

        if (this.selectedOp) this._select(this.selectedOp);
    }

    /* ---- graph model ---- */

    _buildGraph(sources, assets) {
        const byId = {};

        const sourceNodes = sources.map((raw, i) => {
            const parts = raw.split('/');
            const key = parts[2] || raw;
            const idx = parseInt(parts[3], 10) || 0;
            return (byId[`s:${i}`] = {
                id: `s:${i}`,
                type: 'source',
                raw,
                key,
                label: this._cap(key) + (idx ? ` ${idx}` : ''),
            });
        });

        const links = [];
        const assetNodes = assets.map((asset, i) => {
            const node = (byId[`a:${i}`] = {
                id: `a:${i}`,
                type: 'asset',
                name: asset.name,
                label: this._assetLabel(asset.name),
                dot: !!(asset.metadata && asset.metadata.runtime),
            });
            const owner = asset.source && sourceNodes.find(s => s.raw.includes(asset.source));
            if (owner) links.push({ source: owner.id, target: node.id, assetName: asset.name });
            return node;
        });

        // degree per source — denser hubs push their leaves out further
        const degree = {};
        links.forEach(l => (degree[l.source] = (degree[l.source] || 0) + 1));
        sourceNodes.forEach(s => (s.degree = degree[s.id] || 0));

        const nodes = [...sourceNodes, ...assetNodes];
        // seed from last layout so reloads don't jump the map around
        nodes.forEach(n => {
            const p = this.pos[n.id];
            if (p) { n.x = p.x; n.y = p.y; }
        });

        this.nodes = nodes;
        this.links = links;
        this.nodeById = byId;
    }

    /* ---- actions ---- */

    async _run(assetName) {
        if (this.running) return;
        this.running = true;
        this._renderRun();

        const op = await this.api.operation.run(assetName);
        this.running = false;
        this.operations.unshift(op);
        this.selectedAsset = null;
        this._select(op.id);
    }

    async _select(opId) {
        const op = this.operations.find(o => String(o.id) === String(opId));
        if (!op) return;

        this.selectedOp = String(op.id);
        this.selectedAsset = null;
        this.targets = op.metadata?.targets ?? [];

        this._renderList();
        this._renderRun();
        this._applyHighlights();
        this._focusTargets();
        this._openDossier(op);

        const updates = await this.api.operation.get(op.id);
        if (this.selectedOp !== String(op.id)) return;   // selection moved on while loading
        this._renderUpdates(updates);
    }

    /* ---- render ---- */

    _render() {
        this._renderList();
        this._renderGraph();
    }

    _renderList() {
        const count = this.operations.length;
        this.head.innerHTML = `
            <span class="list-head-title">Operations</span>
            <span class="list-head-count">${count}</span>
        `;

        if (!count) {
            this.list.innerHTML = `
                <div class="op-empty">
                    <span class="material-symbols-outlined op-empty-icon">swords</span>
                    <h4>No operations yet</h4>
                    <p>Select an asset on the map to set your foothold, then launch an operation from it.</p>
                </div>`;
            return;
        }

        this.list.innerHTML = this.operations.map(op => this._opRow(op)).join('');
    }

    _opRow(op) {
        const sel = String(op.id) === this.selectedOp ? ' is-selected' : '';
        const n = op.metadata?.targets?.length || 0;
        return `
            <button class="op-item${sel}" data-op="${this._esc(op.id)}">
                <span class="op-item-top">
                    <span class="op-item-asset">${this._esc(op.asset)}</span>
                    <span class="op-item-time">${this._ago(op.updated)}</span>
                </span>
                <span class="op-item-foot">
                    <span class="op-item-id">#${this._esc(op.id)}</span>
                    ${n ? `<span class="op-item-targets"><span class="material-symbols-outlined">target</span>${n}</span>` : ''}
                </span>
            </button>`;
    }

    /* ---- graph (d3) ---- */

    _renderGraph() {
        this._teardownGraph();

        if (!this.nodes.length) {
            this.graph.innerHTML = `
                <div class="graph-empty">
                    <span class="material-symbols-outlined graph-empty-icon">lan</span>
                    <h4>No assets</h4>
                    <p>Connect a source to build map.</p>
                </div>`;
            return;
        }

        this.graph.innerHTML = '';
        const d3 = window.d3;
        const rect = this.graph.getBoundingClientRect();
        const W = rect.width || 900;
        const H = rect.height || 640;

        const svg = d3.select(this.graph).append('svg')
            .attr('class', 'graph-svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', [0, 0, W, H]);

        const scene = svg.append('g').attr('class', 'scene');
        const gLinks = scene.append('g').attr('class', 'links');
        const gNodes = scene.append('g').attr('class', 'nodes');
        const gRun = scene.append('g').attr('class', 'run-layer');

        const zoom = d3.zoom()
            .scaleExtent([0.35, 3])
            .on('zoom', e => scene.attr('transform', e.transform));
        svg.call(zoom).on('dblclick.zoom', null);

        // click on empty canvas clears the asset selection
        svg.on('click', () => {
            this.selectedAsset = null;
            this._renderRun();
            this._applyHighlights();
        });

        this.svg = svg;
        this.scene = scene;
        this.zoom = zoom;
        this.gRun = gRun;

        this.linkSel = gLinks.selectAll('line')
            .data(this.links)
            .join('line')
            .attr('class', 'edge');

        const self = this;
        this.nodeSel = gNodes.selectAll('g')
            .data(this.nodes)
            .join('g')
            .attr('class', d => self._nodeClass(d))
            .call(this._drag())
            .on('click', (e, d) => {
                e.stopPropagation();
                if (d.type !== 'asset') return;
                self.selectedAsset = self.selectedAsset === d.id ? null : d.id;
                self._renderRun();
                self._applyHighlights();
            });

        this.nodeSel.each(function (d) {
            const g = d3.select(this);
            if (d.type === 'source') {
                g.append('circle').attr('class', 'source-halo').attr('r', 30);
                g.append('circle').attr('class', 'source-disc').attr('r', 24);
                g.append('image')
                    .attr('href', `static/img/source/${d.key}.png`)
                    .attr('x', -12).attr('y', -12).attr('width', 24).attr('height', 24)
                    .attr('preserveAspectRatio', 'xMidYMid meet');
                g.append('text').attr('class', 'node-label').attr('y', 44).text(d.label);
            } else {
                g.append('circle').attr('class', 'asset-ring').attr('r', 17);
                g.append('circle').attr('class', 'asset-disc').attr('r', 11);
                g.append('text').attr('class', 'node-label').attr('y', 31).text(d.label);
            }
        });

        this.sim = d3.forceSimulation(this.nodes)
            .force('link', d3.forceLink(this.links).id(d => d.id)
                .distance(l => 74 + Math.min(70, (l.source.degree || 0) * 4))
                .strength(0.5))
            .force('charge', d3.forceManyBody().strength(CHARGE).distanceMax(520))
            .force('collide', d3.forceCollide().radius(d => (d.type === 'source' ? 54 : 42)).iterations(2))
            .force('x', d3.forceX(W / 2).strength(0.04))
            .force('y', d3.forceY(H / 2).strength(0.04))
            .on('tick', () => this._tick());

        this.sim.alpha(0.9).restart();

        this._applyHighlights();
        this._renderRun();
    }

    _tick() {
        this.linkSel
            .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        this.nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
        this.nodes.forEach(n => (this.pos[n.id] = { x: n.x, y: n.y }));
        this._positionRun();
    }

    _drag() {
        const sim = () => this.sim;
        return window.d3.drag()
            .on('start', (e, d) => {
                if (!e.active) sim().alphaTarget(0.3).restart();
                d.fx = d.x; d.fy = d.y;
            })
            .on('drag', (e, d) => {
                d.fx = e.x; d.fy = e.y;
                this._positionRun();
            })
            .on('end', (e, d) => {
                if (!e.active) sim().alphaTarget(0);
                d.fx = null; d.fy = null;
            });
    }

    _renderRun() {
        if (!this.gRun) return;
        this.gRun.selectAll('*').remove();
        this.runSel = null;

        const n = this.selectedAsset && this.nodeById[this.selectedAsset];
        if (!n) return;

        const g = this.gRun.append('g')
            .attr('class', 'run-btn')
            .on('click', e => { e.stopPropagation(); this._run(n.name); });
        g.append('rect').attr('class', 'run-bg').attr('x', -54).attr('y', -16).attr('width', 108).attr('height', 32).attr('rx', 16);
        g.append('text').attr('class', 'run-label').attr('y', 0).text(this.running ? 'Launching…' : '▶  Launch');

        this.runSel = g;
        this._positionRun();
    }

    _positionRun() {
        if (!this.runSel) return;
        const n = this.selectedAsset && this.nodeById[this.selectedAsset];
        if (!n) return;
        const dy = n.y > 70 ? -36 : 36;
        this.runSel.attr('transform', `translate(${n.x},${n.y + dy})`);
    }

    _applyHighlights() {
        if (!this.nodeSel) return;
        this.nodeSel.attr('class', d => this._nodeClass(d));
        this.linkSel.attr('class', d => (this.targets.includes(d.assetName) ? 'edge is-target' : 'edge'));
    }

    _nodeClass(d) {
        const c = ['node', d.type === 'source' ? 'node-source' : 'node-asset'];
        if (d.type === 'asset') {
            if (d.dot) c.push('is-dot');
            if (this.targets.includes(d.name)) c.push('is-target');
            if (this.selectedAsset === d.id) c.push('is-selected');
        }
        return c.join(' ');
    }

    _focusTargets() {
        if (!this.svg || !this.zoom) return;
        const pts = this.nodes.filter(n => n.type === 'asset' && this.targets.includes(n.name) && n.x != null);
        if (!pts.length) return;

        const d3 = window.d3;
        const rect = this.graph.getBoundingClientRect();
        const W = rect.width, H = rect.height;
        const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const pad = 140;
        const bw = maxX - minX + pad * 2;
        const bh = maxY - minY + pad * 2;
        const scale = Math.max(0.4, Math.min(1.9, 0.9 / Math.max(bw / W, bh / H)));
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        const t = d3.zoomIdentity.translate(W / 2 - scale * cx, H / 2 - scale * cy).scale(scale);
        this.svg.transition().duration(500).call(this.zoom.transform, t);
    }

    _teardownGraph() {
        if (this.sim) this.sim.stop();
        this.sim = null;
        this.svg = null;
        this.scene = null;
        this.zoom = null;
        this.nodeSel = null;
        this.linkSel = null;
        this.runSel = null;
        this.gRun = null;
        this.graph.innerHTML = '';
    }

    /* ---- dossier (right, floating) ---- */

    _openDossier(op) {
        const t = this.targets.length;
        this.detail.innerHTML = `
            <header class="dossier-head">
                <div class="dossier-head-main">
                    <span class="dossier-kicker">Operation log</span>
                    <h3 class="dossier-title">${this._esc(op.asset)}</h3>
                </div>
                <button class="dossier-close" aria-label="Close dossier">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </header>
            <div class="dossier-meta">
                <span class="dossier-chip"><span class="material-symbols-outlined">tag</span>${this._esc(op.id)}</span>
                <span class="dossier-chip"><span class="material-symbols-outlined">schedule</span>${this._ago(op.updated)}</span>
                ${t ? `<span class="dossier-chip is-target"><span class="material-symbols-outlined">target</span>${t} target${t === 1 ? '' : 's'}</span>` : ''}
            </div>
            <div class="dossier-body">
                <div class="dossier-status">Loading activity…</div>
            </div>
        `;
        this.detail.classList.add('is-open');
    }

    _renderUpdates(updates) {
        const body = this.detail.querySelector('.dossier-body');
        if (!body) return;

        if (!updates.length) {
            body.innerHTML = `<div class="dossier-status">No activity recorded yet.</div>`;
            return;
        }

        const entries = updates.map(u => `
            <li class="log-entry">
                <div class="log-entry-head">
                    <span class="log-entry-source">${this._esc(u.source)}</span>
                    <span class="log-entry-time">${this._ago(u.updated)}</span>
                </div>
                <div class="log-entry-body markdown">${DOMPurify.sanitize(marked.parse(u.value || ''))}</div>
            </li>`).join('');

        body.innerHTML = `<ol class="dossier-log">${entries}</ol>`;
    }

    _closeDossier() {
        this.detail.classList.remove('is-open');
        this.detail.innerHTML = '';
        this.selectedOp = null;
        this.targets = [];
        this._renderList();
        this._applyHighlights();
    }

    /* ---- events ---- */

    listen() {
        this.list.addEventListener('click', e => {
            const item = e.target.closest('[data-op]');
            if (item) this._select(item.dataset.op);
        });

        this.detail.addEventListener('click', e => {
            if (e.target.closest('.dossier-close')) this._closeDossier();
        });

        window.addEventListener('resize', () => {
            clearTimeout(this._rsz);
            this._rsz = setTimeout(() => { if (this.nodes.length) this._renderGraph(); }, 200);
        });
    }

    /* ---- helpers ---- */

    _cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

    _short(s, n) {
        s = String(s ?? '');
        return s.length > n ? s.slice(0, n - 1) + '…' : s;
    }

    _assetLabel(name) {
        name = String(name ?? '');
        const at = name.indexOf('@');          // emails show just the local part
        return this._short(at > 0 ? name.slice(0, at) : name, 15);
    }

    _esc(s) {
        return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    _time(ts) {
        const t = new Date(ts).getTime();
        return isNaN(t) ? 0 : t;
    }

    _ago(ts) {
        const t = this._time(ts);
        if (!t) return '';
        const s = Math.round((Date.now() - t) / 1000);
        if (s < 60) return 'just now';
        const m = Math.round(s / 60);
        if (m < 60) return `${m}m ago`;
        const h = Math.round(m / 60);
        if (h < 24) return `${h}h ago`;
        const d = Math.round(h / 24);
        if (d < 30) return `${d}d ago`;
        return new Date(t).toLocaleDateString();
    }
}