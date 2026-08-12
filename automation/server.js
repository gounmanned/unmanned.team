const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { chromium } = require('playwright');

const PORT = process.env.PORT || 4787;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:8080';

// sessionId -> { browser, context, page }
const sessions = new Map();

function isHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

app.post('/session', async (req, res) => {
    try {
        const browser = await chromium.launch({ headless: false });
        const context = await browser.newContext();
        const page = await context.newPage();

        const sessionId = crypto.randomUUID();
        sessions.set(sessionId, { browser, context, page });

        browser.on('disconnected', () => sessions.delete(sessionId));

        res.json({ sessionId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/session/:id/navigate', async (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Unknown session' });

    const { url } = req.body;
    if (!isHttpUrl(url)) return res.status(400).json({ error: 'url must be http(s)' });

    try {
        await session.page.bringToFront();
        await session.page.goto(url);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/session/:id/close', async (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Unknown session' });

    sessions.delete(req.params.id);
    await session.browser.close().catch(() => {});
    res.json({ ok: true });
});

app.listen(PORT, () => {
    console.log(`Vex automation service listening on http://localhost:${PORT} (allowed origin: ${ALLOWED_ORIGIN})`);
});
