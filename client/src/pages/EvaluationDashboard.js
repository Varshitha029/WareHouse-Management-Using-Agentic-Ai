import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Container, Typography, Grid, Card, CardContent, Button,
  CircularProgress, Alert, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Divider, Tabs, Tab,
  LinearProgress, Tooltip, IconButton
} from '@mui/material';
import {
  PlayArrow, Refresh, CheckCircle, Schedule, ErrorOutline,
  Psychology, Speed, TrendingUp, Timeline, BubbleChart,
  AccountTree, BarChart, Assessment, ZoomIn
} from '@mui/icons-material';
import axios from 'axios';

// ── Color helpers ─────────────────────────────────────────────────────────────
const AGENT_COLORS = {
  inventory:  '#4caf50',
  pricing:    '#f44336',
  duration:   '#2196f3',
  loan_risk:  '#9c27b0',
  anomaly:    '#795548',
  email:      '#00bcd4',
};

const scoreColor = (v) => {
  if (v >= 90) return '#4caf50';
  if (v >= 75) return '#ff9800';
  return '#f44336';
};

// ── Chart definitions (displayed in groups) ───────────────────────────────────
const CHART_GROUPS = [
  {
    label: 'Routing & Accuracy',
    icon: <AccountTree />,
    charts: [
      { file: 'confusion_matrix.png',         title: 'Intent Routing Confusion Matrix',         desc: 'Which queries were routed to which agent' },
      { file: 'classification_metrics.png',   title: 'Routing Classification Metrics',          desc: 'Per-agent Precision, Recall & F1 with TP/FP/FN breakdown' },
      { file: 'per_agent_accuracy.png',       title: 'Per-Agent Accuracy',                      desc: 'Routing Recall, Success Rate & Response F1 per agent' },
    ]
  },
  {
    label: 'Performance',
    icon: <Speed />,
    charts: [
      { file: 'response_latency.png',         title: 'Response Latency by Agent',               desc: 'Mean ± std latency (ms) for each specialist' },
      { file: 'orchestration_overhead.png',   title: 'Orchestration Overhead',                  desc: 'Extra time added by the Master Agent coordinator' },
    ]
  },
  {
    label: 'Distribution & Profile',
    icon: <BubbleChart />,
    charts: [
      { file: 'agent_utilization.png',        title: 'Agent Utilization Distribution',          desc: 'How often each agent was selected by Master Agent' },
      { file: 'success_rate.png',             title: 'Success Rate · Response Recall · F1',     desc: 'Agent success rate and response-quality F1 scores' },
      { file: 'radar_chart.png',              title: 'Multi-Dimensional Performance Profile',   desc: 'Speed, success rate, response recall & F1, routing recall' },
    ]
  },
  {
    label: 'Architecture',
    icon: <Psychology />,
    charts: [
      { file: 'architecture_diagram.png',     title: 'Master-Coordinator Architecture',         desc: 'Full flow diagram showing how agents connect and data flows' },
    ]
  },
];

// ── Metric summary cards ──────────────────────────────────────────────────────
function MetricCard({ label, value, unit = '', color = '#1976d2', icon }) {
  return (
    <Card sx={{ height: '100%', borderLeft: `4px solid ${color}` }}>
      <CardContent sx={{ py: 2 }}>
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
          <Box sx={{ color, display: 'flex' }}>{icon}</Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
            {label}
          </Typography>
        </Box>
        <Typography variant="h5" fontWeight={800} sx={{ color }}>
          {value}<Typography component="span" variant="body2" color="text.secondary" ml={0.5}>{unit}</Typography>
        </Typography>
      </CardContent>
    </Card>
  );
}

// ── Chart image viewer ────────────────────────────────────────────────────────
function ChartImage({ file, title, desc }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [zoomed, setZoomed] = useState(false);
  const objUrl = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null); setSrc(null);
    axios.get(`/api/evaluation/charts/${file}`, { responseType: 'blob' })
      .then(res => {
        if (!alive) return;
        if (objUrl.current) URL.revokeObjectURL(objUrl.current);
        objUrl.current = URL.createObjectURL(res.data);
        setSrc(objUrl.current);
      })
      .catch(() => { if (alive) setErr('Chart not available yet'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [file]);

  useEffect(() => () => { if (objUrl.current) URL.revokeObjectURL(objUrl.current); }, []);

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
            <Typography variant="caption" color="text.secondary">{desc}</Typography>
          </Box>
          {src && (
            <Tooltip title="View full size">
              <IconButton size="small" onClick={() => setZoomed(true)}><ZoomIn fontSize="small" /></IconButton>
            </Tooltip>
          )}
        </Box>
      </CardContent>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1, minHeight: 220 }}>
        {loading && <CircularProgress size={32} />}
        {err && !loading && <Alert severity="info" sx={{ width: '100%' }}>{err}</Alert>}
        {src && !loading && (
          <img
            src={src} alt={title}
            style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 4, cursor: 'zoom-in' }}
            onClick={() => setZoomed(true)}
          />
        )}
      </Box>

      {/* Full-size lightbox */}
      {zoomed && src && (
        <Box
          sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
          onClick={() => setZoomed(false)}
        >
          <img src={src} alt={title} style={{ maxWidth: '95vw', maxHeight: '92vh', borderRadius: 8 }} />
          <Typography sx={{ position: 'absolute', bottom: 16, color: 'white', opacity: 0.8, fontSize: 13 }}>
            {title} — click anywhere to close
          </Typography>
        </Box>
      )}
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EvaluationDashboard() {
  const [summary, setSummary]       = useState(null);
  const [loadingSum, setLoadingSum] = useState(true);
  const [sumError, setSumError]     = useState(null);
  const [runStatus, setRunStatus]   = useState(null);   // {running, started_at, finished_at, error}
  const [running, setRunning]       = useState(false);
  const [runMsg, setRunMsg]         = useState('');
  const [activeTab, setActiveTab]   = useState(0);
  const pollRef = useRef(null);

  // ── Load summary ────────────────────────────────────────────────────────────
  const loadSummary = useCallback(() => {
    setLoadingSum(true); setSumError(null);
    axios.get('/api/evaluation/summary')
      .then(r => setSummary(r.data))
      .catch(e => setSumError(e.response?.data?.error || e.message))
      .finally(() => setLoadingSum(false));
  }, []);

  // ── Poll status ─────────────────────────────────────────────────────────────
  const pollStatus = useCallback(() => {
    axios.get('/api/evaluation/status')
      .then(r => {
        setRunStatus(r.data);
        if (r.data.running) {
          setRunning(true);
        } else if (running) {
          // Just finished
          setRunning(false);
          setRunMsg(r.data.error ? `Evaluation failed: ${r.data.error}` : 'Evaluation complete! Charts updated.');
          loadSummary();
          clearInterval(pollRef.current);
        }
      })
      .catch(() => {});
  }, [running, loadSummary]);

  useEffect(() => {
    loadSummary();
    pollStatus();
  }, [loadSummary]); // eslint-disable-line

  useEffect(() => {
    if (running) {
      pollRef.current = setInterval(pollStatus, 4000);
    }
    return () => clearInterval(pollRef.current);
  }, [running, pollStatus]);

  // ── Trigger evaluation ──────────────────────────────────────────────────────
  const handleRunEval = async () => {
    setRunMsg('');
    try {
      const r = await axios.post('/api/evaluation/run');
      if (r.data.success) {
        setRunning(true);
        setRunMsg('Evaluation started. This takes 5–10 minutes. Charts will refresh when done.');
      } else {
        setRunMsg(r.data.message || 'Could not start evaluation');
      }
    } catch (e) {
      setRunMsg(e.response?.data?.error || e.message);
    }
  };

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const agentResults   = summary?.agent_results  || {};
  const routingResults = summary?.routing_results || [];
  const routingAcc     = summary?.routing_accuracy || 0;
  const timestamp      = summary?.timestamp ? new Date(summary.timestamp).toLocaleString() : null;

  const agentKeys = Object.keys(agentResults);
  const systemMeanLatency = agentKeys.length
    ? Math.round(agentKeys.reduce((s, a) => s + (agentResults[a].mean_latency_ms || 0), 0) / agentKeys.length)
    : 0;
  const systemMeanRespF1 = agentKeys.length
    ? (agentKeys.reduce((s, a) => s + (agentResults[a].response_f1 || 0), 0) / agentKeys.length).toFixed(1)
    : 0;
  const systemMeanSuccessRate = agentKeys.length
    ? (agentKeys.reduce((s, a) => s + (agentResults[a].success_rate || 0), 0) / agentKeys.length)
    : 0;
  const macroF1      = summary?.macro_f1      ?? null;
  const weightedF1   = summary?.weighted_f1   ?? null;
  const clfMetrics   = summary?.classification_metrics_per_agent || {};

  // Per-agent routing accuracy from routing_results (fallback if clf_metrics absent)
  const perAgentRouting = {};
  agentKeys.forEach(a => {
    const total   = routingResults.filter(r => r.expected === a).length;
    const correct = routingResults.filter(r => r.expected === a && r.correct).length;
    perAgentRouting[a] = total > 0 ? Math.round(correct / total * 100) : 0;
  });

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>

      {/* ── Header ── */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            AI Agent Evaluation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Research paper metrics — Master-Coordinator multi-agent system performance
            {timestamp && <> &nbsp;·&nbsp; Last run: <b>{timestamp}</b></>}
          </Typography>
        </Box>
        <Box display="flex" gap={1} alignItems="center">
          <Button
            variant="outlined" startIcon={<Refresh />}
            onClick={loadSummary} disabled={loadingSum}
          >
            Refresh
          </Button>
          <Button
            variant="contained" color="primary" startIcon={running ? <CircularProgress size={16} color="inherit" /> : <PlayArrow />}
            onClick={handleRunEval} disabled={running}
            sx={{ minWidth: 180 }}
          >
            {running ? 'Running…' : 'Run Evaluation'}
          </Button>
        </Box>
      </Box>

      {/* ── Status alerts ── */}
      {running && (
        <Alert severity="info" sx={{ mb: 2 }} icon={<CircularProgress size={18} />}>
          Evaluation in progress — calling all 6 agents (48 routing tests + 2 direct runs each).
          This takes 5–10 minutes. Page will auto-refresh when done.
          <LinearProgress sx={{ mt: 1 }} />
        </Alert>
      )}
      {runMsg && !running && (
        <Alert severity={runMsg.toLowerCase().includes('fail') ? 'error' : 'success'} sx={{ mb: 2 }} onClose={() => setRunMsg('')}>
          {runMsg}
        </Alert>
      )}
      {sumError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {sumError} — run an evaluation to generate results.
        </Alert>
      )}

      {/* ── Run status chip ── */}
      {runStatus && (
        <Box mb={2} display="flex" gap={1} flexWrap="wrap">
          <Chip
            size="small"
            icon={runStatus.running ? <Schedule /> : runStatus.error ? <ErrorOutline /> : <CheckCircle />}
            label={runStatus.running ? 'Running' : runStatus.error ? 'Last run failed' : 'Idle'}
            color={runStatus.running ? 'warning' : runStatus.error ? 'error' : 'success'}
            variant="outlined"
          />
          {runStatus.finished_at && (
            <Chip size="small" variant="outlined"
              label={`Finished: ${new Date(runStatus.finished_at).toLocaleTimeString()}`} />
          )}
        </Box>
      )}

      {/* ── Summary metric cards ── */}
      {summary && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={6} sm={3}>
            <MetricCard label="Routing Accuracy" value={`${routingAcc.toFixed(1)}%`}
              color={scoreColor(routingAcc)} icon={<TrendingUp />} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <MetricCard label="Agent Success Rate" value={`${systemMeanSuccessRate.toFixed(1)}%`}
              color={scoreColor(systemMeanSuccessRate)} icon={<CheckCircle />} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <MetricCard label="Avg Response Latency" value={systemMeanLatency} unit="ms"
              color="#2196f3" icon={<Speed />} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <MetricCard
              label={macroF1 !== null ? `Macro-F1 (routing)` : 'Avg Response F1'}
              value={macroF1 !== null ? `${macroF1}%` : `${systemMeanRespF1}%`}
              color={scoreColor(macroF1 !== null ? macroF1 : systemMeanRespF1)}
              icon={<Assessment />}
            />
          </Grid>
        </Grid>
      )}

      {/* ── Per-agent metrics table ── */}
      {summary && agentKeys.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Per-Agent Metrics
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, backgroundColor: '#f5f5f5' } }}>
                    <TableCell>Agent</TableCell>
                    <TableCell align="center">Success Rate</TableCell>
                    <TableCell align="center">Mean Latency</TableCell>
                    <TableCell align="center">Resp Recall</TableCell>
                    <TableCell align="center">Resp F1</TableCell>
                    <TableCell align="center">Rout Precision</TableCell>
                    <TableCell align="center">Rout Recall</TableCell>
                    <TableCell align="center">Rout F1</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {agentKeys.map(agent => {
                    const m     = agentResults[agent];
                    const color = AGENT_COLORS[agent] || '#999';
                    const cm    = clfMetrics[agent] || {};
                    const routP  = cm.precision ?? perAgentRouting[agent] ?? 0;
                    const routR  = cm.recall    ?? perAgentRouting[agent] ?? 0;
                    const routF1 = cm.f1        ?? perAgentRouting[agent] ?? 0;
                    return (
                      <TableRow key={agent} hover>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                            <Typography fontWeight={600} textTransform="capitalize">
                              {agent.replace('_', ' ')}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={`${m.success_rate}%`} size="small"
                            sx={{ bgcolor: scoreColor(m.success_rate), color: 'white', fontWeight: 700, fontSize: 12 }} />
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2">{Math.round(m.mean_latency_ms)} ms</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={`${(m.response_recall ?? 0).toFixed(1)}%`} size="small" variant="outlined"
                            sx={{ borderColor: scoreColor(m.response_recall ?? 0), color: scoreColor(m.response_recall ?? 0), fontWeight: 600 }} />
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={`${(m.response_f1 ?? 0).toFixed(1)}%`} size="small" variant="outlined"
                            sx={{ borderColor: scoreColor(m.response_f1 ?? 0), color: scoreColor(m.response_f1 ?? 0), fontWeight: 600 }} />
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={`${routP}%`} size="small"
                            sx={{ bgcolor: scoreColor(routP), color: 'white', fontWeight: 700, fontSize: 12 }} />
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={`${routR}%`} size="small"
                            sx={{ bgcolor: scoreColor(routR), color: 'white', fontWeight: 700, fontSize: 12 }} />
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={`${routF1}%`} size="small"
                            sx={{ bgcolor: scoreColor(routF1), color: 'white', fontWeight: 700, fontSize: 12 }} />
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* System average row */}
                  <TableRow sx={{ '& td': { fontWeight: 700, bgcolor: '#fafafa', borderTop: '2px solid #e0e0e0' } }}>
                    <TableCell>System Average</TableCell>
                    <TableCell align="center">{systemMeanSuccessRate.toFixed(1)}%</TableCell>
                    <TableCell align="center">{systemMeanLatency} ms</TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">{systemMeanRespF1}%</TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center">—</TableCell>
                    <TableCell align="center" sx={{ color: macroF1 !== null ? scoreColor(macroF1) : 'inherit' }}>
                      {macroF1 !== null ? `${macroF1}%` : `${routingAcc.toFixed(1)}%`}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            <Typography variant="caption" color="text.secondary" mt={1} display="block">
              Resp Recall = % expected keywords found in response &nbsp;·&nbsp;
              Resp F1 = harmonic mean of response precision &amp; recall &nbsp;·&nbsp;
              Rout F1 = per-agent routing F1 (TP/FP/FN from 48-query classification test)
              {macroF1 !== null && <> &nbsp;·&nbsp; <b>Macro-F1: {macroF1}%</b>  Weighted-F1: {weightedF1}%</>}
            </Typography>
          </CardContent>
        </Card>
      )}

      <Divider sx={{ mb: 3 }} />

      {/* ── Chart tabs ── */}
      <Box mb={2}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
          {CHART_GROUPS.map((g, i) => (
            <Tab key={i} label={g.label} icon={g.icon} iconPosition="start"
              sx={{ fontWeight: 600, textTransform: 'none', minHeight: 48 }} />
          ))}
          <Tab label="All Charts" icon={<Timeline />} iconPosition="start"
            sx={{ fontWeight: 600, textTransform: 'none', minHeight: 48 }} />
        </Tabs>
      </Box>

      {CHART_GROUPS.map((group, gi) => {
        const isAll = activeTab === CHART_GROUPS.length;
        if (!isAll && activeTab !== gi) return null;
        return (
          <Box key={gi} mb={isAll ? 4 : 0}>
            {isAll && (
              <Typography variant="h6" fontWeight={700} mb={2} display="flex" alignItems="center" gap={1}>
                {group.icon} {group.label}
              </Typography>
            )}
            <Grid container spacing={3}>
              {group.charts.map(c => (
                <Grid item xs={12} md={group.charts.length === 1 ? 12 : 6} key={c.file}>
                  <ChartImage {...c} />
                </Grid>
              ))}
            </Grid>
            {isAll && gi < CHART_GROUPS.length - 1 && <Divider sx={{ my: 3 }} />}
          </Box>
        );
      })}

      {/* No data state */}
      {!loadingSum && !summary && !sumError && (
        <Box textAlign="center" py={8}>
          <BarChart sx={{ fontSize: 64, color: '#bbb', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>No evaluation data yet</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Click "Run Evaluation" to generate metrics. It calls all 6 agents with 48 test queries and produces 8 charts.
          </Typography>
          <Button variant="contained" startIcon={<PlayArrow />} onClick={handleRunEval}>
            Run Evaluation Now
          </Button>
        </Box>
      )}
    </Container>
  );
}
