const MAP_CHARGE = -620;

class MapRollup {
    constructor(state) {
        this.state = state;
        this.api = state.api;

        this.graph = document.getElementById('map-graph');
        this.statsEl = document.getElementById('map-stats');
        this.controls = document.getElementById('map-controls');
        this.peek = document.getElementById('map-peek');

        this.nodes = [];
        this.links = [];
        this.nodeById = {};
        this.ownerOf = {};   // assetId -> sourceId
        this.adj = {};       // id -> Set(neighbour ids)
        this.pos = {};       // id -> {x,y}, remembered across reloads

        this.hovered = null; // node under the cursor
        this.peekId = null;  // asset shown in the side card

        this.sim = this.svg = this.scene = this.zoom = null;
        this.nodeSel = this.linkSel = null;

        this.listen();
    }

    reset() {
        this.nodes = [];
        this.links = [];
        this.nodeById = {};
        this.ownerOf = {};
        this.adj = {};
        this.pos = {};
        this.hovered = null;
        this.peekId = null;
        this._teardownGraph();
        this._closePeek();
        this._renderStats();
    }

    async reload() {
        const [, sources, assets] = await Promise.all([
            this._ensureD3(),
            this.api.sources.list(),
            this.api.inventory.list(),
        ]);

        this._buildGraph(sources, assets);
        this._renderStats();
        this._renderGraph();
    }

    _ensureD3() {
        if (window.d3) return Promise.resolve();
        return this._d3 ??= new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.append(s);
        });
    }

    /* ---- model ---- */

    _buildGraph(sources, assets) {
        const byId = {};

        const sourceNodes = sources.map((raw, i) => {
            const parts = raw.split('/');
            const key = parts[2] || raw;
            const idx = parseInt(parts[3], 10) || 0;
            return (byId[`s:${i}`] = {
                id: `s:${i}`, type: 'source', raw, key,
                label: this._cap(key) + (idx ? ` ${idx}` : ''),
            });
        });

        const links = [];
        const ownerOf = {};
        const assetNodes = assets.map((asset, i) => {
            const runtime = asset.metadata?.runtime;
            const node = (byId[`a:${i}`] = {
                id: `a:${i}`, type: 'asset',
                name: asset.name,
                label: this._assetLabel(asset.name),
                dot: !!runtime,
                runtime: runtime || null,
                updated: asset.updated,
                active: runtime ? MapRollup.isActive(asset.updated) : false,
            });
            const owner = asset.source && sourceNodes.find(s => s.raw.includes(asset.source));
            if (owner) {
                links.push({ source: owner.id, target: node.id });
                ownerOf[node.id] = owner.id;
            }
            return node;
        });

        const degree = {};
        const adj = {};
        for (const { source, target } of links) {
            degree[source] = (degree[source] || 0) + 1;
            (adj[source] ??= new Set()).add(target);
            (adj[target] ??= new Set()).add(source);
        }
        sourceNodes.forEach(s => (s.degree = degree[s.id] || 0));

        this.nodes = [...sourceNodes, ...assetNodes];
        this.nodes.forEach(n => Object.assign(n, this.pos[n.id]));   // restore remembered position
        this.links = links;
        this.nodeById = byId;
        this.ownerOf = ownerOf;
        this.adj = adj;
    }

    /* ---- render ---- */

    _renderGraph() {
        this._teardownGraph();

        if (!this.nodes.length) {
            this.graph.innerHTML = `
                <div class="map-empty">
                    <span class="material-symbols-outlined map-empty-icon">lan</span>
                    <h4>No assets yet</h4>
                    <p>Connect a source and its discovered assets will map out here.</p>
                </div>`;
            return;
        }

        const d3 = window.d3;
        const { width: W, height: H } = this.graph.getBoundingClientRect();

        const svg = d3.select(this.graph).append('svg')
            .attr('class', 'map-svg')
            .attr('viewBox', [0, 0, W, H]);
        this._defs(svg);

        const scene = svg.append('g');
        scene.append('rect')
            .attr('x', -6000).attr('y', -6000)
            .attr('width', 12000).attr('height', 12000)
            .attr('fill', 'url(#map-grid-major)');
        const gLinks = scene.append('g');
        const gNodes = scene.append('g');

        const zoom = d3.zoom().scaleExtent([0.3, 3]).on('zoom', e => scene.attr('transform', e.transform));
        svg.call(zoom).on('dblclick.zoom', null).on('click', () => this._clear());

        this.svg = svg;
        this.scene = scene;
        this.zoom = zoom;

        this.linkSel = gLinks.selectAll('line').data(this.links).join('line')
            .attr('class', l => this._edgeClass(l));

        this.nodeSel = gNodes.selectAll('g').data(this.nodes).join('g')
            .attr('class', d => this._nodeClass(d))
            .call(this._drag())
            .on('click', (e, d) => { e.stopPropagation(); this._pick(d); })
            .on('mouseenter', (e, d) => this._hover(d.id))
            .on('mouseleave', () => this._hover(null));

        this.nodeSel.each(function (d) {
            const g = d3.select(this);
            if (d.type === 'source') {
                g.append('circle').attr('class', 'map-disc').attr('r', 24);
                g.append('image').attr('href', `static/img/source/${d.key}.png`)
                    .attr('x', -13).attr('y', -13).attr('width', 26).attr('height', 26);
                g.append('text').attr('class', 'map-label').attr('y', 46).text(d.label);
            } else {
                g.append('circle').attr('class', 'map-sel').attr('r', 15);
                g.append('circle').attr('class', 'map-core').attr('r', 8);
                g.append('text').attr('class', 'map-label').attr('y', 30).text(d.label);
            }
        });

        this.sim = d3.forceSimulation(this.nodes)
            .force('link', d3.forceLink(this.links).id(d => d.id)
                .distance(l => 82 + Math.min(80, (l.source.degree || 0) * 4)))
            .force('charge', d3.forceManyBody().strength(MAP_CHARGE).distanceMax(560))
            .force('collide', d3.forceCollide().radius(d => d.type === 'source' ? 56 : 40))
            .force('x', d3.forceX(W / 2).strength(0.045))
            .force('y', d3.forceY(H / 2).strength(0.045))
            .on('tick', () => this._tick());

        setTimeout(() => this._fit(), 800);   // frame everything once it settles
    }

    _defs(svg) {
        const defs = svg.append('defs');

        const minor = defs.append('pattern').attr('id', 'map-grid')
            .attr('width', 40).attr('height', 40).attr('patternUnits', 'userSpaceOnUse');
        minor.append('path').attr('class', 'map-grid-line').attr('d', 'M40 0 H0 V40');

        const major = defs.append('pattern').attr('id', 'map-grid-major')
            .attr('width', 200).attr('height', 200).attr('patternUnits', 'userSpaceOnUse');
        major.append('rect').attr('width', 200).attr('height', 200).attr('fill', 'url(#map-grid)');
        major.append('path').attr('class', 'map-grid-line--major').attr('d', 'M200 0 H0 V200');
    }

    _tick() {
        this.linkSel
            .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        this.nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
        this.nodes.forEach(n => (this.pos[n.id] = { x: n.x, y: n.y }));
    }

    _drag() {
        const sim = () => this.sim;
        return window.d3.drag()
            .on('start', (e, d) => { if (!e.active) sim().alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
            .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
            .on('end', (e, d) => { if (!e.active) sim().alphaTarget(0); d.fx = d.fy = null; });
    }

    /* ---- interaction ---- */

    _pick(node) {
        if (node.type === 'asset') {
            this.peekId = node.id;
            this._openPeek(node);
        } else {
            this.peekId = null;
            this._closePeek();
            this._fit([node, ...this._neighbours(node.id)], 160, 500);   // frame the cluster
        }
        this._updateClasses();
    }

    _hover(id) {
        this.hovered = id;
        this._updateClasses();
    }

    _clear() {
        this.peekId = null;
        this._closePeek();
        this._updateClasses();
    }

    _neighbours(id) {
        return [...(this.adj[id] ?? [])].map(n => this.nodeById[n]);
    }

    /* ---- highlight ---- */

    _updateClasses() {
        if (!this.nodeSel) return;
        this.nodeSel.attr('class', d => this._nodeClass(d));
        this.linkSel.attr('class', l => this._edgeClass(l));
    }

    _focus() {
        return this.hovered ?? this.peekId;
    }

    _nodeClass(d) {
        const c = ['map-node', d.type === 'source' ? 'map-source' : 'map-asset'];
        if (d.type === 'asset') {
            c.push(d.dot ? (d.active ? 'is-active' : 'is-inactive') : 'no-dot');
            if (d.id === this.peekId) c.push('is-selected');
        }
        const focus = this._focus();
        if (focus) c.push(d.id === focus || this.adj[focus]?.has(d.id) ? 'is-near' : 'is-dim');
        return c.join(' ');
    }

    _edgeClass(l) {
        const focus = this._focus();
        if (!focus) return 'map-edge';
        const src = l.source.id ?? l.source;   // id before the sim runs, node after
        const tgt = l.target.id ?? l.target;
        return `map-edge ${src === focus || tgt === focus ? 'is-near' : 'is-dim'}`;
    }

    /* ---- zoom ---- */

    _zoomBy(k) {
        this.svg.transition().duration(220).call(this.zoom.scaleBy, k);
    }

    _fit(nodes = this.nodes, pad = 140, dur = 600) {
        const pts = nodes.filter(n => n.x != null);
        if (!this.svg || !pts.length) return;
        const d3 = window.d3;
        const { width: W, height: H } = this.graph.getBoundingClientRect();
        const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
        const x0 = Math.min(...xs), x1 = Math.max(...xs);
        const y0 = Math.min(...ys), y1 = Math.max(...ys);
        const scale = Math.max(0.3, Math.min(2.2, Math.min(W / (x1 - x0 + pad * 2), H / (y1 - y0 + pad * 2))));
        const t = d3.zoomIdentity
            .translate(W / 2 - scale * (x0 + x1) / 2, H / 2 - scale * (y0 + y1) / 2)
            .scale(scale);
        this.svg.transition().duration(dur).call(this.zoom.transform, t);
    }

    /* ---- side card ---- */

    _openPeek(node) {
        const owner = this.nodeById[this.ownerOf[node.id]];
        const dot = !node.dot
            ? '<span class="map-badge">Missing</span>'
            : node.active
                ? '<span class="map-badge is-live">Active</span>'
                : '<span class="map-badge is-idle">Idle</span>';
        this.peek.innerHTML = `
            <header class="map-peek-head">
                <span class="map-peek-kind">Asset</span>
                <button class="map-peek-close" aria-label="Close"><span class="material-symbols-outlined">close</span></button>
            </header>
            <h3 class="map-peek-title">${this._esc(node.label)}</h3>
            <p class="map-peek-name">${this._esc(node.name)}</p>
            <dl class="map-peek-meta">
                <div><dt>Source</dt><dd>${owner ? this._esc(owner.label) : '—'}</dd></div>
                <div><dt>Dot</dt><dd>${dot}</dd></div>
                ${node.runtime ? `<div><dt>Runtime</dt><dd>${this._esc(node.runtime)}</dd></div>` : ''}
                ${node.dot ? `<div><dt>Last seen</dt><dd>${this._ago(node.updated)}</dd></div>` : ''}
            </dl>`;
        this.peek.classList.add('is-open');
    }

    _closePeek() {
        this.peek.classList.remove('is-open');
        this.peek.innerHTML = '';
    }

    _renderStats() {
        const assets = this.nodes.filter(n => n.type === 'asset');
        const sources = this.nodes.length - assets.length;
        const dots = assets.filter(a => a.dot).length;
        const live = assets.filter(a => a.active).length;
        this.statsEl.innerHTML = `
            <span class="map-stat"><b>${sources}</b> sources</span>
            <span class="map-stat"><b>${dots}</b><small> / ${assets.length}</small> dots</span>
            <span class="map-stat is-live"><b>${live}</b> live</span>`;
    }

    _teardownGraph() {
        this.sim?.stop();
        this.sim = this.svg = this.scene = this.zoom = this.nodeSel = this.linkSel = null;
        this.graph.innerHTML = '';
    }

    /* ---- events ---- */

    listen() {
        this.controls.addEventListener('click', e => {
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'in') this._zoomBy(1.3);
            else if (act === 'out') this._zoomBy(1 / 1.3);
            else if (act === 'fit') this._fit();
        });

        this.peek.addEventListener('click', e => {
            if (e.target.closest('.map-peek-close')) this._clear();
        });

        window.addEventListener('resize', () => {
            clearTimeout(this._rsz);
            this._rsz = setTimeout(() => this.nodes.length && this._renderGraph(), 200);
        });
    }

    /* ---- helpers ---- */

    _cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

    _short(s, n) {
        s = String(s ?? '');
        return s.length > n ? s.slice(0, n - 1) + '…' : s;
    }

    _assetLabel(name) {
        const at = String(name ?? '').indexOf('@');   // emails: just the local part
        return this._short(at > 0 ? name.slice(0, at) : name, 16);
    }

    _esc(s) {
        return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    _ago(ts) {
        const m = Math.round((Date.now() - new Date(ts)) / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m}m ago`;
        if (m < 1440) return `${Math.round(m / 60)}h ago`;
        return `${Math.round(m / 1440)}d ago`;
    }

    static isActive(ts) {
        return Date.now() - new Date(ts) < 15 * 60000;
    }
}