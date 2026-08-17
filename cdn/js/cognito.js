class Cognito {

    static backend;
    static client_id;
    static domain;
    static redirect;
    static session;

    static init(backend, client, domain, redirect) {
        Cognito.backend = backend;
        Cognito.client_id = client;
        Cognito.domain = domain;
        Cognito.redirect = redirect;
    }

    static login(){
        const response_type = 'code';
        const scope = 'email+openid+profile';
        const hostedUI = `https://${Cognito.domain}/login?client_id=${Cognito.client_id}&response_type=${response_type}&scope=${scope}&redirect_uri=${encodeURIComponent(Cognito.redirect)}`;

        window.location.replace(hostedUI);
        throw new Error('Redirecting - stop execution');
    }

    static logout(){
        const redirect = encodeURIComponent("https://pinkduckcompany.com");

        window.location.href = `https://${Cognito.domain}/logout?client_id=${Cognito.client_id}&logout_uri=${redirect}`;
        throw new Error('Redirecting - stop execution');
    }

    static code() {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        if (!code) return null;

        url.searchParams.delete('code');
        window.history.replaceState({}, document.title, url.pathname);
        return code;
    }

    static async exchange(code) {
        const params = new URLSearchParams();
        params.append('client_id', Cognito.client_id);
        params.append('redirect_uri', Cognito.redirect);
        params.append('grant_type', 'authorization_code');
        params.append('code', code);

        const response = await fetch(`https://${Cognito.domain}/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });

        if (!response.ok) {
            Cognito.login();
        }

        const { id_token } = await response.json();        
        Cognito.session = id_token;

        return JSON.parse(atob(id_token.split('.')[1]));
    }
}

class Gateway {
    constructor(headers = {}){
        this.headers = headers;
    }

    set(name, value) {
        if (value == undefined) {
            delete this.headers[name];
        } else {
            this.headers[name] = value;
        }
    }

    async call(method, route, body = null) {
        try {
            const url = `https://${Cognito.backend}/${route}`;

            const options = {
                method: method,
                headers: {
                    ...this.headers,
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Cognito.session}`,
                }
            }

            if (body) {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(url, options);

            if (response.status === 401) Cognito.login();
            return response.ok ? response.json() : null;

        } catch (error) {
            return null;
        }
    }

    async upload(route, file) {
        const redirect = await this.call('POST', route);
        if (!redirect) return null;

        const response = await fetch(redirect.url, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type }
        });

        if (!response.ok) {
            console.error('file upload failed:', response.status);
            return null;
        }
    }

    async download(route) {
        const redirect = await this.call('GET', route);
        if (!redirect) return null;

        const response = await fetch(redirect.url, {
            method: 'GET'
        });

        if (!response.ok) {
            console.error('file download failed:', response.status);
            return null;
        }

        return response.text();
    }
}
