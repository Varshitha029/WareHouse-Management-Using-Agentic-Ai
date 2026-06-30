import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Paper,
  Divider,
  Collapse,
  LinearProgress
} from '@mui/material';
import {
  Refresh,
  AccountBalance,
  CheckCircle,
  Cancel,
  Visibility,
  TrendingUp,
  Psychology,
  Warehouse,
  Assessment
} from '@mui/icons-material';
import axios from 'axios';
import LoanCalculator from './LoanCalculator';

const customerName = (c) =>
  c?.profile?.firstName
    ? `${c.profile.firstName} ${c.profile.lastName || ''}`.trim()
    : c?.username || c?.email || 'N/A';

const customerPhone = (c) => c?.profile?.phone || c?.phone || '';

const normalizeAiData = (raw) => raw?.results?.data || raw?.results || raw?.data || raw?.prediction || raw || {};

const normalizeLoanRiskAssessment = (raw = {}) => {
  const d = normalizeAiData(raw);
  const parsedScore = Number(d.risk_score ?? d.riskScore ?? d.score);
  const riskScore = Number.isFinite(parsedScore) ? Math.max(0, Math.min(100, parsedScore)) : 0;

  let recommendation = String(d.recommendation || d.decision || '').toLowerCase();
  if (!['approve', 'reject', 'conditional', 'review'].includes(recommendation)) {
    recommendation = riskScore <= 35 ? 'approve' : riskScore <= 65 ? 'conditional' : 'reject';
  }

  return {
    risk_score: riskScore,
    recommendation,
    suggested_amount: d.suggested_amount ?? d.suggestedAmount ?? d.max_recommended_amount ?? d.max_loan_recommended,
    interest_adjustment: d.interest_adjustment ?? d.interestAdjustment ?? 0,
    reasons: d.reasons ?? d.factors ?? d.risk_factors ?? [],
    summary: d.summary ?? d.analysis ?? d.reasoning ?? ''
  };
};

const LoanPortfolioManager = () => {
  // ── Loan portfolio ──────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loanData, setLoanData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [customerLoans, setCustomerLoans] = useState([]);

  // ── Customer Requests ────────────────────────────────────────────────
  const [requests, setRequests] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState('');
  const [reqSuccess, setReqSuccess] = useState('');
  const [processDialog, setProcessDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [loanDuration, setLoanDuration] = useState('');
  const [loanCollateral, setLoanCollateral] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ── Individual AI Risk (per request) ────────────────────────────────
  const [aiAssessments, setAiAssessments] = useState({});
  const [aiLoading, setAiLoading] = useState({});

  // ── Portfolio AI Risk (Customer Loans tab) ───────────────────────────
  const [portfolioRiskResult, setPortfolioRiskResult] = useState(null);
  const [portfolioRiskLoading, setPortfolioRiskLoading] = useState(false);
  const [portfolioRiskError, setPortfolioRiskError] = useState('');

  // ── Fetch ────────────────────────────────────────────────────────────
  const fetchLoanData = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      const [portfolioRes, pendingRes, loansRes] = await Promise.all([
        axios.get('/api/analytics/owner/loan-portfolio', { headers: { 'x-auth-token': token } }),
        axios.get('/api/loans/pending-approvals', { headers: { 'x-auth-token': token } }),
        axios.get('/api/loans/all-customer-loans', { headers: { 'x-auth-token': token } })
      ]);
      setLoanData({ ...portfolioRes.data, pendingApprovals: pendingRes.data.loans || [] });
      setCustomerLoans(loansRes.data.loans || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch loan data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await axios.get('/api/requests/all');
      setRequests(response.data || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
  };

  useEffect(() => { fetchLoanData(); fetchRequests(); }, []);

  const handleRefresh = () => { fetchLoanData(); fetchRequests(); };

  // ── Loan approval actions ──────────────────────────────────────────
  const handleApproveClick = (loan) => { setSelectedLoan(loan); setApprovalDialogOpen(true); };

  const handleApproveLoan = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/loans/${selectedLoan._id}/approve`, { notes: approvalNotes }, { headers: { 'x-auth-token': token } });
      setApprovalDialogOpen(false); setSelectedLoan(null); setApprovalNotes('');
      fetchLoanData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve loan');
    }
  };

  const handleRejectLoan = async (loanId) => {
    if (!window.confirm('Are you sure you want to reject this loan?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/loans/${loanId}/reject`, {}, { headers: { 'x-auth-token': token } });
      fetchLoanData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject loan');
    }
  };

  // ── Request processing actions ──────────────────────────────────────
  const resetForm = () => {
    setSelectedRequest(null); setRejectionReason(''); setLoanAmount('');
    setInterestRate(''); setLoanDuration(''); setLoanCollateral(''); setStartDate(''); setEndDate('');
  };

  const openProcessDialog = (request) => {
    setSelectedRequest(request);
    if (request.type === 'loan_approval' && request.loanDetails) {
      setLoanAmount(request.loanDetails.requestedAmount?.toString() || '');
      setLoanDuration(request.loanDetails.duration?.toString() || '');
      setLoanCollateral(request.loanDetails.collateral || '');
    }
    setProcessDialog(true);
  };

  const handleApproveRequest = async () => {
    try {
      setReqLoading(true); setReqError('');
      const payload = { action: 'approve' };
      if (selectedRequest.type === 'loan_approval') {
        if (!loanAmount || !interestRate || !loanDuration || !startDate || !endDate) {
          setReqError('Please fill all loan details including start and end dates');
          setReqLoading(false); return;
        }
        const monthlyEMI = (parseFloat(loanAmount) * (1 + parseFloat(interestRate) / 100)) / parseInt(loanDuration);
        payload.loanData = {
          amount: parseFloat(loanAmount), interestRate: parseFloat(interestRate),
          duration: parseInt(loanDuration), collateral: loanCollateral || selectedRequest.loanDetails?.collateral,
          monthlyEMI: monthlyEMI.toFixed(2), startDate, endDate
        };
      }
      await axios.put(`/api/requests/${selectedRequest._id}/process`, payload);
      setReqSuccess('Request approved successfully!');
      setProcessDialog(false); resetForm(); fetchRequests(); fetchLoanData();
    } catch (err) {
      setReqError(err.response?.data?.message || 'Failed to approve request');
    } finally {
      setReqLoading(false);
    }
  };

  const handleRejectRequest = async () => {
    try {
      setReqLoading(true); setReqError('');
      if (!rejectionReason.trim()) { setReqError('Please provide a rejection reason'); setReqLoading(false); return; }
      await axios.put(`/api/requests/${selectedRequest._id}/process`, { action: 'reject', rejectionReason });
      setReqSuccess('Request rejected');
      setProcessDialog(false); resetForm(); fetchRequests();
    } catch (err) {
      setReqError(err.response?.data?.message || 'Failed to reject request');
    } finally {
      setReqLoading(false);
    }
  };

  // ── Individual Loan Risk (WMS - Loan Risk Assessment) ──────────────
  const handleAiAssessment = async (request) => {
    const reqId = request._id;
    try {
      setAiLoading(prev => ({ ...prev, [reqId]: true }));
      const token = localStorage.getItem('token');
      const customerId = request.customer?._id || request.customer;
      const loanAmountValue = Number(request.loanDetails?.requestedAmount || 0);
      const payload = {
        customerId,
        loanAmount: loanAmountValue,
        user_id: customerId,
        customer_id: customerId,
        customer_name: customerName(request.customer),
        loan_amount: loanAmountValue,
        loan_purpose: request.loanDetails?.purpose || '',
        loan_duration: request.loanDetails?.duration || 0,
        collateral: request.loanDetails?.collateral || '',
        message: request.message || '',
        request_id: reqId
      };
      const response = await axios.post('/api/ai/loan-risk/assess', payload, {
        headers: { 'x-auth-token': token }
      });
      const normalized = normalizeLoanRiskAssessment(response.data);
      setAiAssessments(prev => ({
        ...prev,
        [reqId]: {
          risk_score: normalized.risk_score,
          recommendation: normalized.recommendation,
          suggested_amount: normalized.suggested_amount ?? loanAmountValue,
          interest_adjustment: normalized.interest_adjustment,
          reasons: normalized.reasons,
          summary: normalized.summary,
          raw: response.data
        }
      }));
    } catch (err) {
      setAiAssessments(prev => ({
        ...prev,
        [reqId]: { error: err.response?.data?.detail || err.response?.data?.error || 'WMS - Loan Risk Assessment workflow unavailable. Ensure n8n is running and the workflow is active.' }
      }));
    } finally {
      setAiLoading(prev => ({ ...prev, [reqId]: false }));
    }
  };

  // ── Portfolio Risk Assessment (WMS - Risk Assessment) ──────────────
  const handlePortfolioRiskAssessment = async () => {
    try {
      setPortfolioRiskLoading(true); setPortfolioRiskError('');
      const token = localStorage.getItem('token');
      const payload = {
        total_loans: customerLoans.length,
        loans: customerLoans.map(loan => ({
          loan_id: loan._id,
          customer: customerName(loan.customer),
          amount: loan.amount || 0,
          outstanding: loan.remainingAmount || 0,
          status: loan.status,
          interest_rate: loan.interestRate || 0,
          duration: loan.duration || 0,
          grain_type: loan.grainDetails?.grainType || '',
          bags: loan.grainDetails?.numberOfBags || 0
        })),
        summary: {
          total_issued: loanData?.totalIssued || 0,
          active_loans: loanData?.activeLoans || 0,
          total_amount: loanData?.totalAmount || 0,
          active_amount: loanData?.activeAmount || 0
        }
      };
      const response = await axios.post('/api/ai/risk-assessment', payload, {
        headers: { 'x-auth-token': token }
      });
      const raw = response.data;
      // Handle nested n8n structure: { workflow, status, results: { data: {...} } }
      const inner = raw?.results?.data || raw?.results || raw?.data || raw;
      setPortfolioRiskResult(inner);
    } catch (err) {
      setPortfolioRiskError(err.response?.data?.detail || err.response?.data?.error || 'WMS - Risk Assessment workflow unavailable. Ensure n8n is running and the workflow is active.');
    } finally {
      setPortfolioRiskLoading(false);
    }
  };



  // ── AI Result Card (reusable) ──────────────────────────────────────
  const AiRiskCard = ({ data, onClose }) => {
    if (data.error) {
      return <Alert severity="error" sx={{ m: 1 }} onClose={onClose}>{data.error}</Alert>;
    }
    const riskColor = data.risk_score <= 30 ? '#4caf50' : data.risk_score <= 60 ? '#ff9800' : '#f44336';
    const bgColor = data.recommendation === 'approve'
      ? 'linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)'
      : data.recommendation === 'reject'
      ? 'linear-gradient(135deg, #ffebee 0%, #fce4ec 100%)'
      : 'linear-gradient(135deg, #fff3e0 0%, #fff8e1 100%)';
    return (
      <Card variant="outlined" sx={{ m: 1, background: bgColor, borderLeft: `4px solid ${riskColor}` }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Psychology color="secondary" />
              <Typography variant="subtitle2" fontWeight="bold">AI Loan Risk Assessment — WMS - Loan Risk Assessment</Typography>
            </Box>
            {onClose && <IconButton size="small" onClick={onClose}><Cancel fontSize="small" /></IconButton>}
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <Typography variant="caption" color="text.secondary">Risk Score (higher is worse)</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LinearProgress variant="determinate" value={Math.min(data.risk_score || 0, 100)}
                  sx={{ flex: 1, height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': { backgroundColor: riskColor } }} />
                <Typography variant="body2" fontWeight="bold">{data.risk_score ?? '-'}/100</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="caption" color="text.secondary">Recommendation</Typography>
              <Box>
                <Chip
                  label={(data.recommendation || 'review').toUpperCase()}
                  size="small"
                  color={data.recommendation === 'approve' ? 'success' : data.recommendation === 'reject' ? 'error' : 'warning'}
                  icon={data.recommendation === 'approve' ? <CheckCircle /> : data.recommendation === 'reject' ? <Cancel /> : undefined}
                />
              </Box>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="caption" color="text.secondary">Suggested Amount</Typography>
              <Typography variant="body2" fontWeight="bold">
                {data.suggested_amount != null ? `Rs.${Number(data.suggested_amount).toLocaleString()}` : '-'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="caption" color="text.secondary">Interest Adjustment</Typography>
              <Typography variant="body2" fontWeight="bold">
                {data.interest_adjustment != null ? `${data.interest_adjustment > 0 ? '+' : ''}${data.interest_adjustment}%` : '-'}
              </Typography>
            </Grid>
            {data.summary && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">AI Summary</Typography>
                <Typography variant="body2">{data.summary}</Typography>
              </Grid>
            )}
            {data.reasons?.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Key Factors</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {data.reasons.map((r, i) => <Chip key={i} label={r} size="small" variant="outlined" />)}
                </Box>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>
    );
  };

  // ── Guards ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
  if (!loanData) return null;

  const { totalIssued, activeLoans, totalAmount, activeAmount, interestEarned, pendingApprovals } = loanData;
  const pendingRequestCount = requests.filter(r => r.status === 'pending').length;
  const totalPending = (pendingApprovals?.length || 0) + pendingRequestCount;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AccountBalance sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight="bold">Loan Portfolio Management</Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh} disabled={refreshing}><Refresh /></IconButton>
        </Tooltip>
      </Box>

      {/* Global alerts */}
      {totalPending > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {pendingApprovals?.length > 0 && <span><strong>{pendingApprovals.length}</strong> loan application{pendingApprovals.length > 1 ? 's' : ''} pending. </span>}
          {pendingRequestCount > 0 && <span><strong>{pendingRequestCount}</strong> customer request{pendingRequestCount > 1 ? 's' : ''} awaiting action.</span>}
        </Alert>
      )}
      {reqError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setReqError('')}>{reqError}</Alert>}
      {reqSuccess && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setReqSuccess('')}>{reqSuccess}</Alert>}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>Total Loans Issued</Typography>
              <Typography variant="h3" fontWeight="bold" sx={{ color: '#fff', mb: 1 }}>{totalIssued}</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>Rs.{totalAmount?.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', backgroundColor: '#e8f5e9' }}>
            <CardContent>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>Active Loans</Typography>
              <Typography variant="h3" fontWeight="bold" sx={{ color: '#4caf50', mb: 1 }}>{activeLoans}</Typography>
              <Typography variant="body2" color="textSecondary">Rs.{activeAmount?.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', backgroundColor: '#e3f2fd' }}>
            <CardContent>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>Interest Earned</Typography>
              <Typography variant="h3" fontWeight="bold" sx={{ color: '#1976d2', mb: 1 }}>Rs.{interestEarned?.toLocaleString()}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp sx={{ fontSize: 18, color: '#4caf50' }} />
                <Typography variant="body2" color="textSecondary">This month</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', backgroundColor: '#fff3e0' }}>
            <CardContent>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>Pending</Typography>
              <Typography variant="h3" fontWeight="bold" sx={{ color: '#ff9800', mb: 1 }}>{totalPending}</Typography>
              <Typography variant="body2" color="textSecondary">
                {pendingApprovals?.length || 0} loans &middot; {pendingRequestCount} requests
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label={`Pending Approvals (${totalPending})`} />
          <Tab label="Customer Loans" />
          <Tab label="Loan Calculator" />
        </Tabs>
      </Card>

      {/* ── TAB 0: Pending Approvals ─────────────────────────────────── */}
      {activeTab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* Section 1 — Loan Applications */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">Loan Applications</Typography>
              {pendingApprovals?.length > 0 ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Customer</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="right">Rate</TableCell>
                        <TableCell align="right">Duration</TableCell>
                        <TableCell>Collateral</TableCell>
                        <TableCell>Purpose</TableCell>
                        <TableCell align="right">Requested</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pendingApprovals.map((loan) => (
                        <TableRow key={loan._id}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">{customerName(loan.customer)}</Typography>
                            <Typography variant="caption" color="textSecondary">{loan.customer?.email}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body1" fontWeight="bold" color="primary">Rs.{loan.amount?.toLocaleString()}</Typography>
                          </TableCell>
                          <TableCell align="right">{loan.interestRate}%</TableCell>
                          <TableCell align="right">{loan.duration} mo</TableCell>
                          <TableCell><Typography noWrap sx={{ maxWidth: 160 }}>{loan.collateral}</Typography></TableCell>
                          <TableCell><Typography noWrap sx={{ maxWidth: 130 }}>{loan.purpose}</Typography></TableCell>
                          <TableCell align="right">{new Date(loan.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell align="center">
                            <Tooltip title="View"><IconButton size="small"><Visibility /></IconButton></Tooltip>
                            <Tooltip title="Approve">
                              <IconButton size="small" color="success" onClick={() => handleApproveClick(loan)}><CheckCircle /></IconButton>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <IconButton size="small" color="error" onClick={() => handleRejectLoan(loan._id)}><Cancel /></IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info" sx={{ mt: 1 }}>No pending loan applications at this time.</Alert>
              )}
            </CardContent>
          </Card>

          {/* Section 2 — Customer Requests (pending) */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">Customer Requests</Typography>
              {requests.filter(r => r.status === 'pending').length > 0 ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Customer</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Details</TableCell>
                        <TableCell>Message</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {requests.filter(r => r.status === 'pending').map((request) => (
                        <React.Fragment key={request._id}>
                          <TableRow>
                            <TableCell>
                              <Typography variant="body2" fontWeight="bold">{customerName(request.customer)}</Typography>
                              <Typography variant="caption" color="text.secondary">{customerPhone(request.customer)}</Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                icon={request.type === 'vacate_warehouse' ? <Warehouse /> : <AccountBalance />}
                                label={request.type.replace('_', ' ')}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {request.type === 'vacate_warehouse' && request.allocationDetails && (
                                <Box>
                                  <Typography variant="body2">{request.allocationDetails.building} - {request.allocationDetails.block}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {request.allocationDetails.slotLabel} ({request.allocationDetails.bags} bags of {request.allocationDetails.grainType})
                                  </Typography>
                                </Box>
                              )}
                              {request.type === 'loan_approval' && request.loanDetails && (
                                <Box>
                                  <Typography variant="body2">Rs.{request.loanDetails.requestedAmount?.toLocaleString()}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {request.loanDetails.duration} months - {request.loanDetails.purpose}
                                  </Typography>
                                </Box>
                              )}
                            </TableCell>
                            <TableCell sx={{ maxWidth: 180 }}>
                              <Typography variant="body2" noWrap>{request.message}</Typography>
                            </TableCell>
                            <TableCell>{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Button size="small" variant="outlined" onClick={() => openProcessDialog(request)}>Process</Button>
                                {request.type === 'loan_approval' && (
                                  <Button
                                    size="small" variant="outlined" color="secondary"
                                    startIcon={aiLoading[request._id] ? <CircularProgress size={14} /> : <Psychology />}
                                    onClick={() => handleAiAssessment(request)}
                                    disabled={aiLoading[request._id]}
                                  >
                                    AI Risk
                                  </Button>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>

                          {/* Inline AI assessment result */}
                          {aiAssessments[request._id] && (
                            <TableRow>
                              <TableCell colSpan={6} sx={{ py: 0 }}>
                                <Collapse in timeout="auto" unmountOnExit>
                                  <AiRiskCard
                                    data={aiAssessments[request._id]}
                                    onClose={() => setAiAssessments(prev => { const n = { ...prev }; delete n[request._id]; return n; })}
                                  />
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info" sx={{ mt: 1 }}>No pending customer requests at this time.</Alert>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ── TAB 1: Customer Loans ──────────────────────────────────────── */}
      {activeTab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">Customer Loans</Typography>
                <Button
                  variant="contained"
                  startIcon={portfolioRiskLoading ? <CircularProgress size={16} color="inherit" /> : <Assessment />}
                  onClick={handlePortfolioRiskAssessment}
                  disabled={portfolioRiskLoading || customerLoans.length === 0}
                  sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                >
                  {portfolioRiskLoading ? 'Analyzing...' : 'AI Portfolio Risk'}
                </Button>
              </Box>

              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Loan Terms:</strong> 60% loan on grain market value. Bags x 50kg / 100 = Quintals x Market price = Grain value. Eligible = Grain value x 60%
                </Typography>
              </Alert>

              {customerLoans.length > 0 ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Customer</TableCell>
                        <TableCell align="right">Grain Bags</TableCell>
                        <TableCell align="right">Quintals</TableCell>
                        <TableCell align="right">Grain Value</TableCell>
                        <TableCell align="right">Loan (60%)</TableCell>
                        <TableCell align="right">Outstanding</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {customerLoans.map((loan) => {
                        const gd = loan.grainDetails || {};
                        const bags = gd.numberOfBags || 0;
                        const quintals = gd.quintals ?? ((bags * (gd.bagWeight || 50)) / 100);
                        const grainVal = gd.totalValue ?? (quintals * (gd.marketValue || 2000));
                        const loanAmt = loan.amount || 0;
                        const outstanding = loan.remainingAmount || 0;
                        return (
                          <TableRow key={loan._id}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="bold">{customerName(loan.customer)}</Typography>
                              <Typography variant="caption" color="textSecondary">{loan.customer?.email}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography>{bags.toLocaleString()}</Typography>
                              {gd.grainType && <Typography variant="caption" color="text.secondary">{gd.grainType}</Typography>}
                            </TableCell>
                            <TableCell align="right">{typeof quintals === 'number' ? quintals.toFixed(2) : quintals}</TableCell>
                            <TableCell align="right">
                              <Typography color="primary">Rs.{grainVal.toLocaleString()}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography fontWeight="bold" color="success.main">Rs.{loanAmt.toLocaleString()}</Typography>
                              <Typography variant="caption" color="textSecondary">
                                ({grainVal > 0 ? ((loanAmt / grainVal) * 100).toFixed(0) : 0}%)
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography color={outstanding > 0 ? 'error' : 'success.main'}>
                                Rs.{outstanding.toLocaleString()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip label={loan.status} size="small"
                                color={loan.status === 'active' ? 'success' : loan.status === 'completed' ? 'info' : loan.status === 'pending' ? 'warning' : 'default'}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="View Details"><IconButton size="small"><Visibility /></IconButton></Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">No customer loans found.</Alert>
              )}
            </CardContent>
          </Card>

          {/* Portfolio AI Risk Result */}
          {portfolioRiskError && (
            <Alert severity="error" onClose={() => setPortfolioRiskError('')}>{portfolioRiskError}</Alert>
          )}
          {portfolioRiskResult && (() => {
            const d = portfolioRiskResult;
            const alerts = d.alerts || [];
            const riskSummary = d.risk_summary || {};
            const recommendations = d.recommendations || [];
            const severityColor = { critical: '#d32f2f', warning: '#f57c00', info: '#0288d1' };
            const severityBg = { critical: '#ffebee', warning: '#fff3e0', info: '#e1f5fe' };
            const severityMui = { critical: 'error', warning: 'warning', info: 'info' };
            return (
              <Card sx={{ background: 'linear-gradient(135deg, #e8eaf6 0%, #f3e5f5 100%)', borderLeft: '4px solid #7c4dff' }}>
                <CardContent>
                  {/* Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Assessment sx={{ color: '#7c4dff' }} />
                      <Typography variant="h6" fontWeight="bold">Portfolio Risk Analysis — WMS - Risk Assessment</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => setPortfolioRiskResult(null)}><Cancel /></IconButton>
                  </Box>

                  {/* Overview stats */}
                  {(d.total_alerts != null || d.critical_alerts != null) && (
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      {d.total_alerts != null && (
                        <Grid item xs={6} sm={3}>
                          <Paper sx={{ p: 1.5, textAlign: 'center', background: '#f3e5f5' }}>
                            <Typography variant="h4" fontWeight="bold" color="secondary">{d.total_alerts}</Typography>
                            <Typography variant="caption" color="text.secondary">Total Alerts</Typography>
                          </Paper>
                        </Grid>
                      )}
                      {d.critical_alerts != null && (
                        <Grid item xs={6} sm={3}>
                          <Paper sx={{ p: 1.5, textAlign: 'center', background: '#ffebee' }}>
                            <Typography variant="h4" fontWeight="bold" color="error">{d.critical_alerts}</Typography>
                            <Typography variant="caption" color="text.secondary">Critical Alerts</Typography>
                          </Paper>
                        </Grid>
                      )}
                      {riskSummary.overall && (
                        <Grid item xs={12} sm={6}>
                          <Paper sx={{ p: 1.5, background: '#fff8e1' }}>
                            <Typography variant="caption" color="text.secondary">Overall Assessment</Typography>
                            <Typography variant="body2" fontWeight="bold" sx={{ mt: 0.5 }}>{riskSummary.overall}</Typography>
                          </Paper>
                        </Grid>
                      )}
                    </Grid>
                  )}

                  {/* Risk Summary by Category */}
                  {Object.keys(riskSummary).filter(k => k !== 'overall').length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Risk Summary by Category</Typography>
                      <Grid container spacing={1}>
                        {Object.entries(riskSummary).filter(([k]) => k !== 'overall').map(([category, text]) => {
                          const level = text.toLowerCase().startsWith('high') ? 'error'
                            : text.toLowerCase().startsWith('medium') ? 'warning' : 'success';
                          return (
                            <Grid item xs={12} sm={6} key={category}>
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: 1, borderRadius: 1, bgcolor: 'background.paper' }}>
                                <Chip label={category.toUpperCase()} size="small" color={level} sx={{ minWidth: 90, mt: 0.2 }} />
                                <Typography variant="body2">{text}</Typography>
                              </Box>
                            </Grid>
                          );
                        })}
                      </Grid>
                    </Box>
                  )}

                  {/* Alerts */}
                  {alerts.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Detected Alerts</Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {alerts.map((alert) => (
                          <Paper key={alert.id} variant="outlined" sx={{
                            p: 1.5,
                            borderLeft: `4px solid ${severityColor[alert.severity] || '#666'}`,
                            background: severityBg[alert.severity] || '#fafafa'
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Chip
                                label={alert.severity?.toUpperCase()}
                                size="small"
                                color={severityMui[alert.severity] || 'default'}
                              />
                              <Chip label={alert.category} size="small" variant="outlined" />
                              <Typography variant="body2" fontWeight="bold">{alert.title}</Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{alert.description}</Typography>
                            {alert.recommended_action && (
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                                <Typography variant="caption" fontWeight="bold" color="primary" sx={{ whiteSpace: 'nowrap' }}>Action:</Typography>
                                <Typography variant="caption">{alert.recommended_action}</Typography>
                              </Box>
                            )}
                          </Paper>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Recommendations */}
                  {recommendations.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Recommendations</Typography>
                      <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                        {recommendations.map((rec, i) => (
                          <Typography component="li" variant="body2" key={i} sx={{ mb: 0.5 }}>{rec}</Typography>
                        ))}
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </Box>
      )}

      {/* ── TAB 2: Loan Calculator ────────────────────────────────────── */}
      {activeTab === 2 && <LoanCalculator />}

      {/* ── Loan Approval Dialog ─────────────────────────────────────── */}
      <Dialog open={approvalDialogOpen} onClose={() => setApprovalDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve Loan Application</DialogTitle>
        <DialogContent dividers>
          {selectedLoan && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Customer</Typography>
                  <Typography fontWeight="bold">{customerName(selectedLoan.customer)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Loan Amount</Typography>
                  <Typography fontWeight="bold" color="primary">Rs.{selectedLoan.amount?.toLocaleString()}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Interest Rate</Typography>
                  <Typography>{selectedLoan.interestRate}%</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Duration</Typography>
                  <Typography>{selectedLoan.duration} months</Typography>
                </Grid>
              </Grid>
              <TextField label="Approval Notes (Optional)" multiline rows={3} fullWidth value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleApproveLoan} variant="contained" color="success" startIcon={<CheckCircle />}>Approve Loan</Button>
        </DialogActions>
      </Dialog>

      {/* ── Process Request Dialog ───────────────────────────────────── */}
      <Dialog open={processDialog} onClose={() => { setProcessDialog(false); resetForm(); }} maxWidth="md" fullWidth>
        <DialogTitle>{selectedRequest?.status === 'pending' ? 'Process Request' : 'Request Details'}</DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Customer</Typography>
                  <Typography>{customerName(selectedRequest.customer)}</Typography>
                  <Typography variant="caption">{selectedRequest.customer?.email}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Request Type</Typography>
                  <Chip icon={selectedRequest.type === 'vacate_warehouse' ? <Warehouse /> : <AccountBalance />}
                    label={selectedRequest.type.replace('_', ' ')} size="small" />
                </Grid>
                <Grid item xs={12}><Divider /></Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Message</Typography>
                  <Typography>{selectedRequest.message}</Typography>
                </Grid>

                {selectedRequest.type === 'vacate_warehouse' && selectedRequest.allocationDetails && (
                  <>
                    <Grid item xs={12}><Divider /></Grid>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary">Allocation Details</Typography>
                      <Typography>Building: {selectedRequest.allocationDetails.building}</Typography>
                      <Typography>Block: {selectedRequest.allocationDetails.block}</Typography>
                      <Typography>Slot: {selectedRequest.allocationDetails.slotLabel}</Typography>
                      <Typography>Grain: {selectedRequest.allocationDetails.grainType} ({selectedRequest.allocationDetails.bags} bags)</Typography>
                    </Grid>
                  </>
                )}

                {selectedRequest.type === 'loan_approval' && selectedRequest.status === 'pending' && (
                  <>
                    <Grid item xs={12}><Divider /></Grid>
                    <Grid item xs={12}><Typography variant="h6">Loan Details to Approve</Typography></Grid>
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth label="Loan Amount (Rs.)" type="number" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth label="Interest Rate (%)" type="number" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth label="Duration (months)" type="number" value={loanDuration} onChange={(e) => setLoanDuration(e.target.value)} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth label="Collateral" value={loanCollateral} onChange={(e) => setLoanCollateral(e.target.value)} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                    </Grid>
                    {loanAmount && interestRate && loanDuration && (
                      <Grid item xs={12}>
                        <Alert severity="info">
                          Monthly EMI: Rs.{((parseFloat(loanAmount) * (1 + parseFloat(interestRate) / 100)) / parseInt(loanDuration)).toFixed(2)}
                        </Alert>
                      </Grid>
                    )}
                  </>
                )}

                {selectedRequest.status === 'pending' && (
                  <>
                    <Grid item xs={12}><Divider /></Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth label="Rejection Reason (if rejecting)" multiline rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
                    </Grid>
                  </>
                )}

                {selectedRequest.status === 'rejected' && selectedRequest.rejectionReason && (
                  <Grid item xs={12}>
                    <Alert severity="error">
                      <Typography variant="subtitle2">Rejection Reason:</Typography>
                      <Typography variant="body2">{selectedRequest.rejectionReason}</Typography>
                    </Alert>
                  </Grid>
                )}

                {selectedRequest.status === 'approved' && selectedRequest.createdLoan && (
                  <Grid item xs={12}>
                    <Alert severity="success">
                      <Typography variant="subtitle2">Loan Created Successfully</Typography>
                      <Typography variant="body2">
                        Amount: Rs.{selectedRequest.createdLoan.amount} | Interest: {selectedRequest.createdLoan.interestRate}% | Duration: {selectedRequest.createdLoan.duration} months
                      </Typography>
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {selectedRequest?.status === 'pending' ? (
            <>
              <Button onClick={() => { setProcessDialog(false); resetForm(); }}>Cancel</Button>
              <Button startIcon={<Cancel />} color="error" onClick={handleRejectRequest} disabled={reqLoading}>Reject</Button>
              <Button startIcon={<CheckCircle />} variant="contained" color="success" onClick={handleApproveRequest} disabled={reqLoading}>Approve</Button>
            </>
          ) : (
            <Button onClick={() => { setProcessDialog(false); resetForm(); }}>Close</Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LoanPortfolioManager;
