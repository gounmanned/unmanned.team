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

class MonitorApi extends Gateway {
    constructor(){
        super();
    }

    async list() {
        return await this.call("GET", `monitor`);
    }
    
    async connect(name, blob) {
        await this.call("POST", `monitor/${name}`, JSON.parse(blob));
    }

    async disconnect(key) {
        await this.call("DELETE", `monitor/${key}`);
    }
}

class AssetApi extends Gateway {
    constructor(){
        super();
    }

    async list() {
        return await this.call("GET", `asset`);
    }

    async update(name, key, val) {
        const patch = {key: key, value: val};
        return await this.call("PATCH", `asset/${name}`, patch);
    }
}

class BreachApi extends Gateway {
    constructor(){
        super();
    }

    async list() {
        return await this.call("GET", `breach`);
    }
}

class ManagedApi extends Gateway {
    constructor(){
        super();
    }

    async list(event = null) {
        const resp = await this.call("GET", "managed/signal");

        resp?.forEach(signal => {
            event.signal = signal;
            document.dispatchEvent(event);
        });
    }
    
    async overview(account) {
        return await this.call('GET', `managed/overview?account=${account}`);
    }

    async grants(who) {
        return await this.call('GET', `managed/grants?for=${who}`);
    }

    async assign(group, user) {
        await this.call('POST', `managed/grants/${group}/${user}`);
    }

    async unassign(group, user) {
        await this.call('DELETE', `managed/grants/${group}/${user}`);
    }

    async invite(email) {
        await this.call('POST', 'managed/invite', {to: email});
    }
}

class AuditApi extends Gateway {
    constructor(){
        super();
    }

    async messages(hours = 24) {
        return this.call("GET", `audit?hours=${hours}`);
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
