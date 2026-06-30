import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Badge,
  Tabs,
  Tab,
  Card,
  CardContent,
  Divider,
  Autocomplete,
  CircularProgress,
  Collapse,
  LinearProgress
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Pending,
  Warehouse,
  AccountBalance,
  Info,
  Notifications,
  Psychology,
  Search,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import axios from 'axios';

const normalizeLoanRiskAssessment = (raw = {}) => {
  const payload = raw?.results?.data || raw?.results || raw?.data || raw?.prediction || raw || {};
  const parsedScore = Number(payload?.risk_score ?? payload?.riskScore ?? payload?.score);
  const riskScore = Number.isFinite(parsedScore) ? Math.max(0, Math.min(100, parsedScore)) : 0;

  let recommendation = String(payload?.recommendation || payload?.decision || '').toLowerCase();
  if (!['approve', 'reject', 'conditional', 'review'].includes(recommendation)) {
    recommendation = riskScore <= 35 ? 'approve' : riskScore <= 65 ? 'conditional' : 'reject';
  }

  return {
    risk_score: riskScore,
    recommendation,
    suggested_amount:
      payload?.suggested_amount ??
      payload?.suggestedAmount ??
      payload?.max_recommended_amount ??
      payload?.max_loan_recommended ??
      0,
    interest_adjustment: payload?.interest_adjustment ?? payload?.interestAdjustment ?? 0,
    reasons: payload?.reasons || payload?.risk_factors || payload?.factors || [],
    summary: payload?.summary || payload?.reasoning || '',
    raw
  };
};

const OwnerRequestManagement = () => {
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Dialogs
  const [processDialog, setProcessDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Loan details for approval
  const [loanAmount, setLoanAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [duration, setDuration] = useState('');
  const [loanCollateral, setLoanCollateral] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Customer selector state
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerTransactions, setCustomerTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);

  // AI Loan Risk Assessment state
  const [aiAssessments, setAiAssessments] = useState({});
  const [aiLoading, setAiLoading] = useState({});

  useEffect(() => {
    fetchRequests();
    fetchCustomers();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [activeTab, requests]);

  // Fetch customers for the autocomplete selector
  const fetchCustomers = async () => {
    try {
      setCustomerLoading(true);
      const response = await axios.get('/api/customers', { params: { limit: 500 } });
      setCustomers(response.data?.customers || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setCustomerLoading(false);
    }
  };

  // Fetch transactions for a selected customer
  const fetchCustomerTransactions = async (customerId) => {
    try {
      setTransactionsLoading(true);
      const response = await axios.get(`/api/transactions/customer/${customerId}`);
      setCustomerTransactions(response.data || []);
      setShowTransactions(true);
    } catch (err) {
      console.error('Error fetching customer transactions:', err);
      setError('Failed to fetch transactions for this customer');
      setCustomerTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  // AI Loan Risk Assessment
  const handleAiAssessment = async (request) => {
    const reqId = request._id;
    try {
      setAiLoading(prev => ({ ...prev, [reqId]: true }));
      const token = localStorage.getItem('token');
      const customerId = request.customer?._id || request.customer;
      const loanAmount = Number(request.loanDetails?.requestedAmount || 0);
      const response = await axios.post('/api/ai/loan-risk/assess', {
        action: 'assess',
        customerId,
        loanAmount,
        user_id: customerId,
        customer_id: customerId,
        loan_amount: loanAmount
      }, { headers: { 'x-auth-token': token } });
      const normalized = normalizeLoanRiskAssessment(response.data);
      setAiAssessments(prev => ({ ...prev, [reqId]: normalized }));
    } catch (err) {
      console.error('AI Assessment error:', err);
      setAiAssessments(prev => ({
        ...prev,
        [reqId]: { error: err.response?.data?.detail || 'AI Engine unavailable. Make sure the AI engine is running on port 8001.' }
      }));
    } finally {
      setAiLoading(prev => ({ ...prev, [reqId]: false }));
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await axios.get('/api/requests/all');
      setRequests(response.data || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
      setError('Failed to fetch requests');
    }
  };

  const filterRequests = () => {
    if (activeTab === 'all') {
      setFilteredRequests(requests);
    } else {
      setFilteredRequests(requests.filter(r => r.status === activeTab));
    }
  };

  const handleApprove = async () => {
    try {
      setLoading(true);
      setError('');

      const payload = { action: 'approve' };

      // If it's a loan request, include loan details
      if (selectedRequest.type === 'loan_approval') {
        if (!loanAmount || !interestRate || !duration || !startDate || !endDate) {
          setError('Please fill all loan details including start and end dates');
          setLoading(false);
          return;
        }

        const monthlyEMI = (parseFloat(loanAmount) * (1 + parseFloat(interestRate) / 100)) / parseInt(duration);

        payload.loanData = {
          amount: parseFloat(loanAmount),
          interestRate: parseFloat(interestRate),
          duration: parseInt(duration),
          collateral: loanCollateral || selectedRequest.loanDetails?.collateral,
          monthlyEMI: monthlyEMI.toFixed(2),
          startDate: startDate,
          endDate: endDate
        };
      }

      await axios.put(`/api/requests/${selectedRequest._id}/process`, payload);

      setSuccess('Request approved successfully!');
      setProcessDialog(false);
      resetForm();
      fetchRequests();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to approve request');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setLoading(true);
      setError('');

      if (!rejectionReason.trim()) {
        setError('Please provide a rejection reason');
        setLoading(false);
        return;
      }

      await axios.put(`/api/requests/${selectedRequest._id}/process`, {
        action: 'reject',
        rejectionReason
      });

      setSuccess('Request rejected');
      setProcessDialog(false);
      resetForm();
      fetchRequests();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to reject request');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedRequest(null);
    setRejectionReason('');
    setLoanAmount('');
    setInterestRate('');
    setDuration('');
    setLoanCollateral('');
    setStartDate('');
    setEndDate('');
  };

  const openProcessDialog = (request) => {
    setSelectedRequest(request);
    if (request.type === 'loan_approval' && request.loanDetails) {
      setLoanAmount(request.loanDetails.requestedAmount?.toString() || '');
      setDuration(request.loanDetails.duration?.toString() || '');
      setLoanCollateral(request.loanDetails.collateral || '');
    }
    setProcessDialog(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Badge badgeContent={pendingCount} color="error">
              <Notifications sx={{ fontSize: 40 }} color="primary" />
            </Badge>
            <Box>
              <Typography variant="h5">Customer Requests</Typography>
              <Typography color="text.secondary">
                {pendingCount} pending request{pendingCount !== 1 ? 's' : ''}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* ===== Customer Selector & Transaction Viewer ===== */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Search color="primary" /> Customer Transaction Lookup
          </Typography>
          <Autocomplete
            options={customers}
            getOptionLabel={(option) =>
              `${option.profile?.firstName || ''} ${option.profile?.lastName || ''} (${option.username || option.email})`.trim()
            }
            value={selectedCustomer}
            onChange={(_, newValue) => {
              setSelectedCustomer(newValue);
              if (newValue) {
                fetchCustomerTransactions(newValue._id);
              } else {
                setCustomerTransactions([]);
                setShowTransactions(false);
              }
            }}
            inputValue={customerSearch}
            onInputChange={(_, newInput) => setCustomerSearch(newInput)}
            loading={customerLoading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search Customer"
                placeholder="Type customer name, email or phone..."
                variant="outlined"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {customerLoading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            isOptionEqualToValue={(option, value) => option._id === value._id}
            noOptionsText="No customers found"
            sx={{ mb: 2 }}
          />

          {transactionsLoading && <LinearProgress sx={{ mb: 2 }} />}

          {showTransactions && selectedCustomer && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Transactions for {selectedCustomer.profile?.firstName || selectedCustomer.username}
                  {' '}({customerTransactions.length} found)
                </Typography>
                <IconButton size="small" onClick={() => setShowTransactions(!showTransactions)}>
                  {showTransactions ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>
              <Collapse in={showTransactions}>
                {customerTransactions.length === 0 ? (
                  <Alert severity="info">No transactions found for this customer.</Alert>
                ) : (
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 350 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Grain</TableCell>
                          <TableCell>Bags</TableCell>
                          <TableCell align="right">Amount (₹)</TableCell>
                          <TableCell>Payment</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {customerTransactions.map((txn) => (
                          <TableRow key={txn._id} hover>
                            <TableCell>{new Date(txn.createdAt || txn.date).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Chip label={txn.type || 'N/A'} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>{txn.grain?.type || txn.grainType || '-'}</TableCell>
                            <TableCell>{txn.grain?.bags || txn.bags || '-'}</TableCell>
                            <TableCell align="right">
                              ₹{(txn.amount?.totalAmount || txn.totalAmount || 0).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={txn.payment?.status || txn.paymentStatus || 'N/A'}
                                size="small"
                                color={
                                  (txn.payment?.status || txn.paymentStatus) === 'paid' ? 'success' :
                                  (txn.payment?.status || txn.paymentStatus) === 'pending' ? 'warning' : 'default'
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={txn.status || 'N/A'}
                                size="small"
                                color={txn.status === 'completed' ? 'success' : txn.status === 'active' ? 'info' : 'default'}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Collapse>
            </>
          )}
        </CardContent>
      </Card>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab 
              label={
                <Badge badgeContent={pendingCount} color="error">
                  Pending
                </Badge>
              } 
              value="pending" 
            />
            <Tab label="Approved" value="approved" />
            <Tab label="Rejected" value="rejected" />
            <Tab label="All" value="all" />
          </Tabs>
        </Box>

        {filteredRequests.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Info sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography color="text.secondary">
              No {activeTab !== 'all' ? activeTab : ''} requests found
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRequests.map((request) => (
                  <React.Fragment key={request._id}>
                    <TableRow>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {request.customer?.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {request.customer?.phone}
                        </Typography>
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
                            <Typography variant="body2">
                              {request.allocationDetails.building} - {request.allocationDetails.block}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {request.allocationDetails.slotLabel} ({request.allocationDetails.bags} bags of {request.allocationDetails.grainType})
                            </Typography>
                          </Box>
                        )}
                        {request.type === 'loan_approval' && request.loanDetails && (
                          <Box>
                            <Typography variant="body2">
                              ₹{request.loanDetails.requestedAmount?.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {request.loanDetails.duration} months - {request.loanDetails.purpose}
                            </Typography>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200 }}>
                        <Typography variant="body2" noWrap>
                          {request.message}
                        </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={request.status}
                        color={getStatusColor(request.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(request.createdAt).toLocaleDateString()}
                    </TableCell>
                      <TableCell>
                        {request.status === 'pending' ? (
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => openProcessDialog(request)}
                            >
                              Process
                            </Button>
                            {request.type === 'loan_approval' && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="secondary"
                                startIcon={aiLoading[request._id] ? <CircularProgress size={16} /> : <Psychology />}
                                onClick={() => handleAiAssessment(request)}
                                disabled={aiLoading[request._id]}
                              >
                                AI Assessment
                              </Button>
                            )}
                          </Box>
                        ) : (
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedRequest(request);
                                setProcessDialog(true);
                              }}
                            >
                              <Info />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* AI Risk Assessment Result Row */}
                    {aiAssessments[request._id] && (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ py: 0 }}>
                          <Collapse in={!!aiAssessments[request._id]} timeout="auto" unmountOnExit>
                            {aiAssessments[request._id].error ? (
                              <Alert severity="error" sx={{ m: 1 }} onClose={() => setAiAssessments(prev => { const next = { ...prev }; delete next[request._id]; return next; })}>
                                {aiAssessments[request._id].error}
                              </Alert>
                            ) : (
                              <Card
                                variant="outlined"
                                sx={{
                                  m: 1,
                                  background: aiAssessments[request._id].recommendation === 'approve'
                                    ? 'linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)'
                                    : aiAssessments[request._id].recommendation === 'reject'
                                    ? 'linear-gradient(135deg, #ffebee 0%, #fce4ec 100%)'
                                    : 'linear-gradient(135deg, #fff3e0 0%, #fff8e1 100%)',
                                  borderLeft: `4px solid ${
                                    aiAssessments[request._id].recommendation === 'approve' ? '#4caf50' :
                                    aiAssessments[request._id].recommendation === 'reject' ? '#f44336' : '#ff9800'
                                  }`
                                }}
                              >
                                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <Psychology color="secondary" />
                                    <Typography variant="subtitle2" fontWeight="bold">
                                      AI Loan Risk Assessment
                                    </Typography>
                                  </Box>
                                  <Grid container spacing={2}>
                                    <Grid item xs={12} sm={3}>
                                      <Typography variant="caption" color="text.secondary">Risk Score (higher is worse)</Typography>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <LinearProgress
                                          variant="determinate"
                                          value={aiAssessments[request._id].risk_score}
                                          sx={{
                                            flex: 1, height: 8, borderRadius: 4,
                                            '& .MuiLinearProgress-bar': {
                                              backgroundColor:
                                                aiAssessments[request._id].risk_score <= 30 ? '#4caf50' :
                                                aiAssessments[request._id].risk_score <= 60 ? '#ff9800' : '#f44336'
                                            }
                                          }}
                                        />
                                        <Typography variant="body2" fontWeight="bold">
                                          {aiAssessments[request._id].risk_score}/100
                                        </Typography>
                                      </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={3}>
                                      <Typography variant="caption" color="text.secondary">Recommendation</Typography>
                                      <Box>
                                        <Chip
                                          label={aiAssessments[request._id].recommendation?.toUpperCase()}
                                          size="small"
                                          color={
                                            aiAssessments[request._id].recommendation === 'approve' ? 'success' :
                                            aiAssessments[request._id].recommendation === 'reject' ? 'error' : 'warning'
                                          }
                                          icon={aiAssessments[request._id].recommendation === 'approve' ? <CheckCircle /> : <Cancel />}
                                        />
                                      </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={3}>
                                      <Typography variant="caption" color="text.secondary">Suggested Amount</Typography>
                                      <Typography variant="body2" fontWeight="bold">
                                        ₹{aiAssessments[request._id].suggested_amount?.toLocaleString()}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={12} sm={3}>
                                      <Typography variant="caption" color="text.secondary">Interest Adjustment</Typography>
                                      <Typography variant="body2" fontWeight="bold">
                                        {aiAssessments[request._id].interest_adjustment > 0 ? '+' : ''}
                                        {aiAssessments[request._id].interest_adjustment}%
                                      </Typography>
                                    </Grid>
                                    {aiAssessments[request._id].reasons?.length > 0 && (
                                      <Grid item xs={12}>
                                        <Typography variant="caption" color="text.secondary">Reasons</Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                          {aiAssessments[request._id].reasons.map((reason, idx) => (
                                            <Chip key={idx} label={reason} size="small" variant="outlined" />
                                          ))}
                                        </Box>
                                      </Grid>
                                    )}
                                  </Grid>
                                </CardContent>
                              </Card>
                            )}
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Process Request Dialog */}
      <Dialog 
        open={processDialog} 
        onClose={() => {
          setProcessDialog(false);
          resetForm();
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          {selectedRequest?.status === 'pending' ? 'Process Request' : 'Request Details'}
        </DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Customer</Typography>
                  <Typography variant="body1">{selectedRequest.customer?.name}</Typography>
                  <Typography variant="caption">{selectedRequest.customer?.email}</Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Request Type</Typography>
                  <Chip
                    icon={selectedRequest.type === 'vacate_warehouse' ? <Warehouse /> : <AccountBalance />}
                    label={selectedRequest.type.replace('_', ' ')}
                    size="small"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Divider />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Message</Typography>
                  <Typography variant="body1">{selectedRequest.message}</Typography>
                </Grid>

                {selectedRequest.type === 'vacate_warehouse' && selectedRequest.allocationDetails && (
                  <>
                    <Grid item xs={12}>
                      <Divider />
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary">Allocation Details</Typography>
                      <Typography variant="body1">
                        Building: {selectedRequest.allocationDetails.building}
                      </Typography>
                      <Typography variant="body1">
                        Block: {selectedRequest.allocationDetails.block}
                      </Typography>
                      <Typography variant="body1">
                        Slot: {selectedRequest.allocationDetails.slotLabel}
                      </Typography>
                      <Typography variant="body1">
                        Grain: {selectedRequest.allocationDetails.grainType} ({selectedRequest.allocationDetails.bags} bags)
                      </Typography>
                    </Grid>
                  </>
                )}

                {selectedRequest.type === 'loan_approval' && selectedRequest.status === 'pending' && (
                  <>
                    <Grid item xs={12}>
                      <Divider />
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="h6" gutterBottom>Loan Details to Approve</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Loan Amount (₹)"
                        type="number"
                        value={loanAmount}
                        onChange={(e) => setLoanAmount(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Interest Rate (%)"
                        type="number"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Duration (months)"
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Collateral"
                        value={loanCollateral}
                        onChange={(e) => setLoanCollateral(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Loan Start Date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Loan End Date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    {loanAmount && interestRate && duration && (
                      <Grid item xs={12}>
                        <Alert severity="info">
                          Monthly EMI: ₹{((parseFloat(loanAmount) * (1 + parseFloat(interestRate) / 100)) / parseInt(duration)).toFixed(2)}
                        </Alert>
                      </Grid>
                    )}
                  </>
                )}

                {selectedRequest.status === 'pending' && (
                  <>
                    <Grid item xs={12}>
                      <Divider />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Rejection Reason (if rejecting)"
                        multiline
                        rows={3}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                      />
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
                        Amount: ₹{selectedRequest.createdLoan.amount} | 
                        Interest: {selectedRequest.createdLoan.interestRate}% | 
                        Duration: {selectedRequest.createdLoan.duration} months
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
              <Button 
                onClick={() => {
                  setProcessDialog(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                startIcon={<Cancel />}
                color="error"
                onClick={handleReject}
                disabled={loading}
              >
                Reject
              </Button>
              <Button
                startIcon={<CheckCircle />}
                variant="contained"
                color="success"
                onClick={handleApprove}
                disabled={loading}
              >
                Approve
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => {
                setProcessDialog(false);
                resetForm();
              }}
            >
              Close
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OwnerRequestManagement;
