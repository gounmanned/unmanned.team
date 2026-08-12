class AutomationClient {
    constructor(base = 'http://localhost:4787') {
        this.base = base;
    }

    async startSession() {
        const resp = await fetch(`${this.base}/session`, { method: 'POST' });
        if (!resp.ok) throw new Error('automation service unavailable');
        const { sessionId } = await resp.json();
        return sessionId;
    }

    async navigate(sessionId, url) {
        const resp = await fetch(`${this.base}/session/${sessionId}/navigate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });
        if (!resp.ok) throw new Error('automation navigate failed');
    }

    async closeSession(sessionId) {
        if (!sessionId) return;
        await fetch(`${this.base}/session/${sessionId}/close`, { method: 'POST' }).catch(() => {});
    }
}
