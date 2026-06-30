import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, Grid, Card, CardContent, CardActions,
  Chip, CircularProgress, LinearProgress, Alert, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions as MuiDialogActions,
  Accordion, AccordionSummary, AccordionDetails, Divider, Badge
} from '@mui/material';
import {
  PlayArrow, Refresh, ExpandMore, CheckCircle, Error as ErrorIcon,
  HourglassEmpty, SmartToy, Timeline, Speed, Visibility,
  AccountTree, Science, History, OpenInNew, CloudDone, CloudOff
} from '@mui/icons-material';
import axios from 'axios';

const WORKFLOW_ICONS = {
  'full-ai-analysis': <Science sx={{ fontSize: 40 }} />,
  'market-analysis': <Timeline sx={{ fontSize: 40 }} />,
  'storage-optimization': <AccountTree sx={{ fontSize: 40 }} />,
  'risk-assessment': <SmartToy sx={{ fontSize: 40 }} />
};

const WORKFLOW_COLORS = {
  'full-ai-analysis': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'market-analysis': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'storage-optimization': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'risk-assessment': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
};

const STATUS_CONFIG = {
  'pending': { color: 'default', icon: <HourglassEmpty fontSize="small" />, label: 'Pending' },
  'queued': { color: 'default', icon: <HourglassEmpty fontSize="small" />, label: 'Queued' },
  'running': { color: 'warning', icon: <CircularProgress size={16} />, label: 'Running' },
  'completed': { color: 'success', icon: <CheckCircle fontSize="small" />, label: 'Completed' },
  'partial': { color: 'warning', icon: <ErrorIcon fontSize="small" />, label: 'Partial' },
  'failed': { color: 'error', icon: <ErrorIcon fontSize="small" />, label: 'Failed' }
};

const AIWorkflowRunner = () => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeRuns, setActiveRuns] = useState({});
  const [runStatuses, setRunStatuses] = useState({});
  const [resultDialog, setResultDialog] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');
  const [n8nStatus, setN8nStatus] = useState(null);
  const pollingRefs = useRef({});

  useEffect(() => {
    fetchWorkflows();
    fetchHistory();
    fetchN8nStatus();
  }, []);

  const fetchN8nStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/ai/n8n-status', {
        headers: { 'x-auth-token': token }
      });
      setN8nStatus(response.data);
    } catch (err) {
      setN8nStatus({ connected: false });
    }
  };

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/workflows/list', {
        headers: { 'x-auth-token': token }
      });
      setWorkflows(response.data.workflows || []);
    } catch (err) {
      setError('Failed to load workflows. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/workflows/history?limit=10', {
        headers: { 'x-auth-token': token }
      });
      setHistory(response.data.runs || []);
    } catch (err) {
      // History fetch is optional
    }
  };

  const pollStatus = useCallback(async (runId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/workflows/status/${runId}`, {
        headers: { 'x-auth-token': token }
      });
      const data = response.data;
      setRunStatuses(prev => ({ ...prev, [runId]: data }));

      if (['completed', 'partial', 'failed'].includes(data.status)) {
        if (pollingRefs.current[runId]) {
          clearInterval(pollingRefs.current[runId]);
          delete pollingRefs.current[runId];
        }
        fetchHistory();
      }
    } catch (err) {
      // Keep polling
    }
  }, []);

  const handleRunWorkflow = async (workflowId) => {
    try {
      setError('');
      const token = localStorage.getItem('token');
      const response = await axios.post(`/api/workflows/run/${workflowId}`, {}, {
        headers: { 'x-auth-token': token }
      });
      const { runId } = response.data;

      setActiveRuns(prev => ({ ...prev, [workflowId]: runId }));
      setRunStatuses(prev => ({
        ...prev,
        [runId]: {
          runId,
          workflowId,
          status: 'queued',
          steps: response.data.steps
        }
      }));

      pollingRefs.current[runId] = setInterval(() => pollStatus(runId), 1500);
      pollStatus(runId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start workflow. Is the AI engine running?');
    }
  };

  const handleViewResults = async (runId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/workflows/result/${runId}`, {
        headers: { 'x-auth-token': token }
      });
      setResultData(response.data);
      setResultDialog(runId);
    } catch (err) {
      setError('Failed to fetch workflow results.');
    }
  };

  useEffect(() => {
    const refs = pollingRefs.current;
    return () => {
      Object.values(refs).forEach(clearInterval);
    };
  }, []);

  const isRunning = (workflowId) => {
    const runId = activeRuns[workflowId];
    if (!runId) return false;
    const status = runStatuses[runId];
    return status && ['queued', 'running'].includes(status.status);
  };

  const getActiveStatus = (workflowId) => {
    const runId = activeRuns[workflowId];
    return runId ? runStatuses[runId] : null;
  };

  const formatDuration = (ms) => {
    if (!ms) return '\u2014';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
          <SmartToy sx={{ color: '#667eea' }} /> AI Automation Workflows
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<History />}
            onClick={() => { setShowHistory(!showHistory); fetchHistory(); }}
            size="small"
          >
            {showHistory ? 'Hide History' : 'Run History'}
          </Button>
          <Tooltip title="Refresh workflows">
            <IconButton onClick={fetchWorkflows} size="small">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>
      )}

      {/* n8n Connection Status */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 2, border: n8nStatus?.connected ? '1px solid #4caf50' : '1px solid #ff9800' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {n8nStatus?.connected ? <CloudDone color="success" /> : <CloudOff color="warning" />}
          <Typography variant="body2" fontWeight={600}>
            n8n Workflow Engine: {n8nStatus?.connected ? 'Connected' : 'Disconnected'}
          </Typography>
          {n8nStatus?.connected && (
            <Chip label={`${n8nStatus.webhooksCount || 0} workflows`} size="small" color="success" variant="outlined" />
          )}
          {!n8nStatus?.connected && (
            <Chip label="Falling back to direct AI calls" size="small" color="warning" variant="outlined" />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {n8nStatus?.connected && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<OpenInNew />}
              onClick={() => window.open(n8nStatus.uiUrl || 'http://localhost:5678', '_blank')}
            >
              Open n8n UI
            </Button>
          )}
          <Tooltip title="Refresh n8n status">
            <IconButton size="small" onClick={fetchN8nStatus}>
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {workflows.map((wf) => {
          const running = isRunning(wf.id);
          const activeStatus = getActiveStatus(wf.id);

          return (
            <Grid item xs={12} sm={6} lg={3} key={wf.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'visible' }}>
                {running && (
                  <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, borderRadius: '12px 12px 0 0' }} />
                )}
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    mb: 2, p: 2, borderRadius: 2,
                    background: WORKFLOW_COLORS[wf.id] || WORKFLOW_COLORS['full-ai-analysis'],
                    color: 'white'
                  }}>
                    {WORKFLOW_ICONS[wf.id] || <SmartToy sx={{ fontSize: 40 }} />}
                  </Box>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {wf.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {wf.description}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {wf.steps.map(step => (
                      <Chip key={step.id} label={step.name} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                    ))}
                  </Box>
                </CardContent>

                {activeStatus && (
                  <Box sx={{ px: 2, pb: 1 }}>
                    <Divider sx={{ mb: 1 }} />
                    {activeStatus.steps?.map(step => (
                      <Box key={step.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.3 }}>
                        {STATUS_CONFIG[step.status]?.icon || <HourglassEmpty fontSize="small" />}
                        <Typography variant="caption" sx={{ flex: 1 }}>{step.name}</Typography>
                        <Chip
                          label={STATUS_CONFIG[step.status]?.label || step.status}
                          size="small"
                          color={STATUS_CONFIG[step.status]?.color || 'default'}
                          sx={{ height: 20, fontSize: '0.65rem' }}
                        />
                      </Box>
                    ))}
                    {activeStatus.totalDuration && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <Speed fontSize="small" /> Total: {formatDuration(activeStatus.totalDuration)}
                      </Typography>
                    )}
                  </Box>
                )}

                <CardActions sx={{ p: 2, pt: 1 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={running ? <CircularProgress size={18} color="inherit" /> : <PlayArrow />}
                    onClick={() => handleRunWorkflow(wf.id)}
                    disabled={running}
                    sx={{
                      background: running ? undefined : (WORKFLOW_COLORS[wf.id] || WORKFLOW_COLORS['full-ai-analysis']),
                      fontWeight: 600,
                      '&:hover': { opacity: 0.9 }
                    }}
                  >
                    {running ? 'Running...' : 'Run Workflow'}
                  </Button>
                  {activeStatus && ['completed', 'partial'].includes(activeStatus.status) && (
                    <Tooltip title="View Results">
                      <IconButton onClick={() => handleViewResults(activeRuns[wf.id])} color="primary" size="small">
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  )}
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {showHistory && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <History /> Recent Workflow Runs
          </Typography>
          {history.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No workflow runs yet. Click &quot;Run Workflow&quot; to start one.</Typography>
          ) : (
            history.map((run) => (
              <Box key={run.runId} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1, borderBottom: '1px solid #eee' }}>
                <Chip
                  icon={STATUS_CONFIG[run.status]?.icon}
                  label={STATUS_CONFIG[run.status]?.label || run.status}
                  color={STATUS_CONFIG[run.status]?.color || 'default'}
                  size="small"
                />
                <Typography variant="body2" fontWeight="bold" sx={{ flex: 1 }}>
                  {run.workflowName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {run.stepsSummary}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDuration(run.totalDuration)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {run.startedAt ? new Date(run.startedAt).toLocaleTimeString() : '\u2014'}
                </Typography>
                <Tooltip title="View Results">
                  <IconButton size="small" onClick={() => handleViewResults(run.runId)}>
                    <Visibility fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ))
          )}
        </Paper>
      )}

      <Dialog open={!!resultDialog} onClose={() => { setResultDialog(null); setResultData(null); }} maxWidth="lg" fullWidth>
        <DialogTitle sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}>
          <SmartToy />
          <span>Workflow Results: {resultData?.workflowName}</span>
          <Chip
            label={STATUS_CONFIG[resultData?.status]?.label || resultData?.status}
            color={STATUS_CONFIG[resultData?.status]?.color || 'default'}
            size="small"
            sx={{ ml: 'auto', color: 'white', borderColor: 'white' }}
            variant="outlined"
          />
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {resultData && (
            <Box>
              <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Started:</strong> {new Date(resultData.startedAt).toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Duration:</strong> {formatDuration(resultData.totalDuration)}
                </Typography>
              </Box>

              {resultData.steps?.map((step, idx) => (
                <Accordion key={step.id} defaultExpanded={step.status === 'completed'}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      <Badge badgeContent={idx + 1} color="primary">
                        {STATUS_CONFIG[step.status]?.icon}
                      </Badge>
                      <Typography fontWeight="bold" sx={{ flex: 1 }}>{step.name}</Typography>
                      <Chip label={step.agent} size="small" variant="outlined" sx={{ mr: 1 }} />
                      <Chip
                        label={STATUS_CONFIG[step.status]?.label}
                        size="small"
                        color={STATUS_CONFIG[step.status]?.color}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {formatDuration(step.duration)}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {step.error && (
                      <Alert severity="error" sx={{ mb: 2 }}>{step.error}</Alert>
                    )}
                    {step.result && (
                      <Paper sx={{ p: 2, bgcolor: '#f5f5f5', maxHeight: 400, overflowY: 'auto' }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.8rem' }}>
                          {JSON.stringify(step.result, null, 2)}
                        </pre>
                      </Paper>
                    )}
                    {!step.result && !step.error && (
                      <Typography variant="body2" color="text.secondary">No data available</Typography>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}
        </DialogContent>
        <MuiDialogActions>
          <Button onClick={() => { setResultDialog(null); setResultData(null); }}>Close</Button>
        </MuiDialogActions>
      </Dialog>
    </Box>
  );
};

export default AIWorkflowRunner;
