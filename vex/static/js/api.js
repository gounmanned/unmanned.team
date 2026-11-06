class SignalApi extends Gateway {
    constructor(){
        super();
    }

    async list(param, event = null) {
        const resp = await this.call("GET", `signal?${param}`);

        resp.forEach(signal => {
            event.signal = signal;
            document.dispatchEvent(event);
        });
    }
   
    async get(id) {
        return await this.call("GET", `signal/${id}`);
    }

    async delete(id) {
        return await this.call("DELETE", `signal/${id}`);
    }

    async create(signal, params) {
        const query = params ? `?${new URLSearchParams(params)}` : "";
        return await this.call("POST", `signal${query}`, signal);
    }

    async update(id, blob) {
        return await this.call("POST", `signal/${id}`, {value: blob});
    }

    async patch(id, patch) {
        return await this.call("PATCH", `signal/${id}`, patch);
    }  
}

class SourceApi extends Gateway {
    constructor(){
        super();
    }

    async list() {
        return await this.call("GET", `source`);
    }
    
    async connect(name, blob) {
        await this.call("POST", `source/${name}`, JSON.parse(blob));
    }

    async disconnect(key) {
        await this.call("DELETE", `source/${key}`);
    }
}

class AssetApi extends Gateway {
    constructor(){
        super();
    }

    async list() {
        return await this.call("GET", "asset");
    }
    
    async get(asset) {
        return await this.call("GET", `asset/${encodeURIComponent(asset)}`);
    }

    async create(asset) {
        return await this.call("POST", "asset", asset);
    }
    
    async invite(asset) {
        return await this.call("PUT", "asset/invite", asset);
    }

    async run(asset, payload) {
        return await this.call("PUT", `asset/${encodeURIComponent(asset)}`, payload);
    }

    async delete(asset) {
        return await this.call("DELETE", `asset/${encodeURIComponent(asset)}`);
    }
}

class ManagedApi extends Gateway {
    constructor(){
        super();
    }

    async signals(event = null) {
        const resp = await this.call("GET", "managed/signal");

        resp?.forEach(signal => {
            event.signal = signal;
            document.dispatchEvent(event);
        });
    }
    
    async assets(event = null) {
        const resp = await this.call("GET", "managed/asset");

        resp?.forEach(asset => {
            event.asset = asset;
            document.dispatchEvent(event);
        });
    }

    async grants() {
        return await this.call('GET', `managed/grants`);
    }

    async assign(group, user) {
        return await this.call('POST', `managed/grants/${group}/${user}`);
    }

    async unassign(group, user) {
        return await this.call('DELETE', `managed/grants/${group}/${user}`);
    }
}

class AuditApi extends Gateway {
    constructor(){
        super();
    }

    async get(start, end) {
        return this.call("GET", `audit?start=${start}&end=${end}`);
    }

    async search(query) {
        return this.call("GET", `audit?q=${query}`);
    }
}

class FileApi extends Gateway {
    constructor(root){
        super();
        this.root = root;
    }

    async list() {
        return await this.call("GET", `file/${this.root}`);
    }

    async get(name) {
        return await this.download(`file/${this.root}?name=${name}`);
    }

    async add(file) {
        await this.upload(`file/${this.root}?name=${file.name}`, file);
    }
}

class ActionApi extends Gateway {
    constructor(root){
        super();
        this.root = root;
    }

    async list() {
        return await this.call("GET", "action");
    }
}

class OperationApi extends Gateway {
    constructor(){
        super();
    }

    async list() {
        return await this.call("GET", "operation");
    }

    async get(id) {
        return await this.call("GET", `operation/${id}`);
    }

    async run(asset) {
        return await this.call("POST", "operation", {asset});
    }
}

class Auth {
    static async init(code) {
        const backend = "us.unmanned.team";
        const client = "2314edi18c3o3t8sroh2u2hucf";
        const domain = "lock-unmanned.auth.us-east-2.amazoncognito.com";
        const redirect = window.location.origin; 

        Cognito.init(backend, client, domain, redirect);
        return Cognito.exchange(code);
    }
}
