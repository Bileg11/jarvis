'use strict';
// ── JARVIS TELEGRAM WEBHOOK — Railway Express Server ─────────────
// Vercel-с ялгаатай: persistent server, timeout байхгүй

const express = require('express');
const handler = require('./api/telegram');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/',  (req, res) => res.send('JARVIS webhook running ✅'));
app.post('/api/telegram', handler);

app.listen(PORT, () => console.log(`[JARVIS] Webhook server running on port ${PORT}`));
