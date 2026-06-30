const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const N8N_URL = process.env.N8N_URL || 'http://localhost:5678';
const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001';
const N8N_PROXY_TIMEOUT_MS = parseInt(process.env.N8N_PROXY_TIMEOUT_MS || '8000', 10);
const AI_ENGINE_TIMEOUT_MS = parseInt(process.env.AI_ENGINE_TIMEOUT_MS || '60000', 10);

function resolveAiTimeoutMs(endpoint) {
  if (endpoint === '/full-analysis') {
    return Math.max(AI_ENGINE_TIMEOUT_MS, 90000);
  }
  return AI_ENGINE_TIMEOUT_MS;
}

// Load n8n webhook config
let n8nWebhooks = {};
try {
  const configPath = path.join(__dirname, '..', 'config', 'n8nWebhooks.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    n8nWebhooks = config.webhooks || {};
  }
} catch (err) {
  console.warn('⚠️  Could not load n8n webhook config for workflows:', err.message);
}

// ==================== In-Memory Workflow State ====================

// Stores all workflow runs (in production, use MongoDB)
const workflowRuns = new Map();

// Available workflow definitions — each step has an n8nKey for n8n routing
const WORKFLOWS = {
  'full-ai-analysis': {
    name: 'Full AI Analysis',
    description: 'Runs all AI agents via n8n: Market Prediction → Anomaly Detection → Storage Duration → Inventory Analysis',
    n8nWebhookKey: 'full_analysis', // compound n8n workflow
    steps: [
      { id: 'market-predict', name: 'Market Price Prediction', agent: 'pricing', n8nKey: 'market_predict', endpoint: '/market/predict', method: 'POST', payload: { action: 'predict', grainType: 'all', horizon: '3months' } },
      { id: 'anomaly-detect', name: 'Anomaly & Fraud Detection', agent: 'anomaly', n8nKey: 'anomaly_detect', endpoint: '/anomaly/detect', method: 'POST', payload: { action: 'detect' } },
      { id: 'storage-duration', name: 'Storage Duration Prediction', agent: 'duration', n8nKey: 'predict_duration', endpoint: '/predict-duration', method: 'POST', payload: { grain_type: 'rice', total_bags: 100, total_weight_kg: 5000, monthly_rent_per_bag: 50 } },
      { id: 'inventory-analyze', name: 'Inventory Intelligence', agent: 'inventory', n8nKey: 'inventory_analyze', endpoint: '/inventory/analyze', method: 'POST', payload: { action: 'analyze' } }
    ]
  },
  'market-analysis': {
    name: 'Market Analysis',
    description: 'Market prediction + anomaly detection via n8n',
    n8nWebhookKey: 'market_analysis',
    steps: [
      { id: 'market-predict', name: 'Market Price Prediction', agent: 'pricing', n8nKey: 'market_predict', endpoint: '/market/predict', method: 'POST', payload: { action: 'predict', grainType: 'all', horizon: '3months' } },
      { id: 'anomaly-detect', name: 'Anomaly Detection', agent: 'anomaly', n8nKey: 'anomaly_detect', endpoint: '/anomaly/detect', method: 'POST', payload: { action: 'detect' } }
    ]
  },
  'storage-optimization': {
    name: 'Storage Optimization',
    description: 'Storage duration prediction + inventory analysis via n8n',
    n8nWebhookKey: 'storage_optimization',
    steps: [
      { id: 'storage-duration', name: 'Storage Duration Prediction', agent: 'duration', n8nKey: 'predict_duration', endpoint: '/predict-duration', method: 'POST', payload: { grain_type: 'rice', total_bags: 100, total_weight_kg: 5000, monthly_rent_per_bag: 50 } },
      { id: 'inventory-analyze', name: 'Inventory Analysis', agent: 'inventory', n8nKey: 'inventory_analyze', endpoint: '/inventory/analyze', method: 'POST', payload: { action: 'analyze' } }
    ]
  },
  'risk-assessment': {
    name: 'Risk Assessment',
    description: 'Loan risk + anomaly detection via n8n',
    n8nWebhookKey: 'risk_assessment',
    steps: [
      { id: 'loan-risk', name: 'Loan Risk Assessment', agent: 'loan_risk', n8nKey: 'loan_risk_assess', endpoint: '/loan-risk/assess', method: 'POST', payload: { action: 'assess' } },
      { id: 'anomaly-detect', name: 'Anomaly & Fraud Detection', agent: 'anomaly', n8nKey: 'anomaly_detect', endpoint: '/anomaly/detect', method: 'POST', payload: { action: 'detect' } }
    ]
  }
};

// ==================== Helper Functions ====================

function generateRunId() {
  return `wf-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

async function callAIEngine(n8nKey, endpoint, method, payload) {
  // Try n8n first
  const webhookUrl = n8nWebhooks[n8nKey];
  if (webhookUrl) {
    try {
      const response = await axios({
        method: 'POST',
        url: webhookUrl,
        data: { body: payload || {}, originalEndpoint: endpoint },
        timeout: N8N_PROXY_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`🔄 n8n workflow step: ${n8nKey} → OK`);
      return response.data;
    } catch (n8nError) {
      console.warn(`⚠️  n8n unavailable for ${n8nKey}, falling back to direct AI`);
    }
  }

  // Fallback: direct AI engine call
  const config = {
    method,
    url: `${AI_ENGINE_URL}${endpoint}`,
    timeout: resolveAiTimeoutMs(endpoint),
    headers: { 'Content-Type': 'application/json' }
  };
  if (payload && method !== 'GET') config.data = payload;
  const response = await axios(config);
  return response.data;
}

async function executeWorkflow(runId, workflowId, userId) {
  const workflow = WORKFLOWS[workflowId];
  const run = workflowRuns.get(runId);

  run.status = 'running';
  run.startedAt = new Date();

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    const stepState = run.steps[i];

    stepState.status = 'running';
    stepState.startedAt = new Date();

    try {
      const result = await callAIEngine(step.n8nKey, step.endpoint, step.method, step.payload);
      stepState.status = 'completed';
      stepState.completedAt = new Date();
      stepState.duration = stepState.completedAt - stepState.startedAt;
      stepState.result = result;
    } catch (error) {
      stepState.status = 'failed';
      stepState.completedAt = new Date();
      stepState.duration = stepState.completedAt - stepState.startedAt;
      stepState.error = error.response?.data?.detail || error.message;
      // Continue to next step even if one fails
    }
  }

  // Calculate overall status
  const allCompleted = run.steps.every(s => s.status === 'completed');
  const anyFailed = run.steps.some(s => s.status === 'failed');

  run.status = allCompleted ? 'completed' : anyFailed ? 'partial' : 'completed';
  run.completedAt = new Date();
  run.totalDuration = run.completedAt - run.startedAt;
}

// ==================== Routes ====================

// GET /api/workflows/list - Get all available workflow definitions
router.get('/list', auth, (req, res) => {
  const workflows = Object.entries(WORKFLOWS).map(([id, wf]) => ({
    id,
    name: wf.name,
    description: wf.description,
    stepCount: wf.steps.length,
    steps: wf.steps.map(s => ({ id: s.id, name: s.name, agent: s.agent }))
  }));
  res.json({ workflows });
});

// POST /api/workflows/run/:workflowId - Trigger a workflow
router.post('/run/:workflowId', auth, async (req, res) => {
  const { workflowId } = req.params;
  const workflow = WORKFLOWS[workflowId];

  if (!workflow) {
    return res.status(404).json({ error: 'Workflow not found', available: Object.keys(WORKFLOWS) });
  }

  const runId = generateRunId();

  // Initialize run state
  const run = {
    runId,
    workflowId,
    workflowName: workflow.name,
    triggeredBy: req.user?.id || 'manual',
    status: 'queued',
    startedAt: null,
    completedAt: null,
    totalDuration: null,
    steps: workflow.steps.map(step => ({
      id: step.id,
      name: step.name,
      agent: step.agent,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      duration: null,
      result: null,
      error: null
    }))
  };

  workflowRuns.set(runId, run);

  // Start execution in background (non-blocking)
  executeWorkflow(runId, workflowId, req.user?.id);

  res.json({
    message: `Workflow "${workflow.name}" started`,
    runId,
    workflowId,
    steps: run.steps.map(s => ({ id: s.id, name: s.name, status: s.status }))
  });
});

// GET /api/workflows/status/:runId - Get real-time status of a workflow run
router.get('/status/:runId', auth, (req, res) => {
  const run = workflowRuns.get(req.params.runId);
  if (!run) {
    return res.status(404).json({ error: 'Workflow run not found' });
  }

  res.json({
    runId: run.runId,
    workflowId: run.workflowId,
    workflowName: run.workflowName,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    totalDuration: run.totalDuration,
    steps: run.steps.map(s => ({
      id: s.id,
      name: s.name,
      agent: s.agent,
      status: s.status,
      duration: s.duration,
      hasResult: !!s.result,
      error: s.error
    }))
  });
});

// GET /api/workflows/result/:runId - Get full results of a completed workflow
router.get('/result/:runId', auth, (req, res) => {
  const run = workflowRuns.get(req.params.runId);
  if (!run) {
    return res.status(404).json({ error: 'Workflow run not found' });
  }

  res.json({
    runId: run.runId,
    workflowId: run.workflowId,
    workflowName: run.workflowName,
    status: run.status,
    triggeredBy: run.triggeredBy,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    totalDuration: run.totalDuration,
    steps: run.steps.map(s => ({
      id: s.id,
      name: s.name,
      agent: s.agent,
      status: s.status,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      duration: s.duration,
      result: s.result,
      error: s.error
    }))
  });
});

// GET /api/workflows/history - Get recent workflow runs
router.get('/history', auth, (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const runs = Array.from(workflowRuns.values())
    .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0))
    .slice(0, limit)
    .map(run => ({
      runId: run.runId,
      workflowId: run.workflowId,
      workflowName: run.workflowName,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      totalDuration: run.totalDuration,
      stepsSummary: `${run.steps.filter(s => s.status === 'completed').length}/${run.steps.length} completed`
    }));

  res.json({ runs, total: workflowRuns.size });
});

module.exports = router;
