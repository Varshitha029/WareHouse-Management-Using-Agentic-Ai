const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const axios = require('axios');

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001';

// ── GET /api/evaluation/summary ──────────────────────────────────────────────
// Returns the latest eval_summary.json (metrics data)
router.get('/summary', auth, async (req, res) => {
  try {
    const response = await axios.get(`${AI_ENGINE_URL}/eval/summary`, { timeout: 10000 });
    res.json(response.data);
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ error: 'No evaluation results found. Run evaluation first.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/evaluation/charts ───────────────────────────────────────────────
// Lists available chart files
router.get('/charts', auth, async (req, res) => {
  try {
    const response = await axios.get(`${AI_ENGINE_URL}/eval/charts`, { timeout: 10000 });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/evaluation/charts/:filename ─────────────────────────────────────
// Streams a PNG chart back to the browser
router.get('/charts/:filename', auth, async (req, res) => {
  try {
    const response = await axios.get(
      `${AI_ENGINE_URL}/eval/charts/${req.params.filename}`,
      { responseType: 'stream', timeout: 15000 }
    );
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    response.data.pipe(res);
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ error: `Chart ${req.params.filename} not found` });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/evaluation/run ─────────────────────────────────────────────────
// Triggers a fresh evaluation run (takes several minutes)
router.post('/run', auth, async (req, res) => {
  try {
    const response = await axios.post(`${AI_ENGINE_URL}/eval/run`, {}, { timeout: 10000 });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/evaluation/status ───────────────────────────────────────────────
// Returns {"running": bool, "started_at": ..., "finished_at": ..., "error": ...}
router.get('/status', auth, async (req, res) => {
  try {
    const response = await axios.get(`${AI_ENGINE_URL}/eval/status`, { timeout: 5000 });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
