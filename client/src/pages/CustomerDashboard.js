import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,  Divider,
  Tab,
  Tabs,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  InputAdornment,} from '@mui/material';
import {
  Warehouse,  Payment,
  LocalShipping,
  AccountBalance,
  Receipt,
  Refresh,  ContactSupport,
  Lock,
  LocationOn,
  ShowChart,
  NotificationsActive,
  Calculate,
  Send,
  PhoneAndroid,
  AccountBalanceWallet,} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import CustomerContactForm from '../components/CustomerContactForm';
import axios from 'axios';

// Import enhanced customer components
import CustomerGrainLocationView from '../components/CustomerGrainLocationView';
import CustomerMarketPricesAndPredictions from '../components/CustomerMarketPricesAndPredictions';
import CustomerLoanAlerts from '../components/CustomerLoanAlerts';
import CustomerLoanCalculatorAndRequest from '../components/CustomerLoanCalculatorAndRequest';
import CustomerRequestForm from '../components/CustomerRequestForm';
import AILoanRecommendations from '../components/AILoanRecommendations';

const CustomerDashboard = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Dialogs
  const [contactDialog, setContactDialog] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState(false);
  
  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Payment state
  const [paymentForm, setPaymentForm] = useState({
    type: 'rent',       // 'rent' | 'loan'
    amount: '',
    method: 'upi',
    description: '',
    allocationId: '',
    loanId: '',
  });  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [allocations, setAllocations] = useState([]);
  const [loans, setLoans] = useState([]);
  const [lastPaymentTxnId, setLastPaymentTxnId] = useState(null);

  const openBillInTab = async ({ tab, type, transactionId, onError }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/payments/bill/${type}/${transactionId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
        timeout: 20000
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      tab.location.href = url;
      setTimeout(() => window.URL.revokeObjectURL(url), 300000);
    } catch (err) {
      try { tab.close(); } catch (_) {}
      if (onError) onError(err);
    }
  };

  const { user } = useAuth();
  useEffect(() => {
    fetchCustomerData();
    
    // Check if user needs to change password
    if (user?.needsPasswordChange) {
      setPasswordDialog(true);
    }
  }, [user]);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      
      const statsRes = await axios.get('/api/customers/stats/dashboard');
      setStats(statsRes.data);

      // Load allocations and loans for payment dropdowns
      const [allocRes, loanRes, histRes] = await Promise.allSettled([
        axios.get('/api/warehouse/allocations/my-locations'),
        axios.get('/api/loans/my-loans'),
        axios.get('/api/payments/history'),
      ]);
      if (allocRes.status === 'fulfilled') setAllocations(allocRes.value.data?.allocations || allocRes.value.data || []);
      if (loanRes.status === 'fulfilled')  setLoans(loanRes.value.data?.loans || loanRes.value.data || []);
      if (histRes.status === 'fulfilled')  setPaymentHistory(histRes.value.data?.transactions || histRes.value.data || []);

    } catch (error) {
      console.error('Error fetching customer data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      setError('');

      await axios.post('/api/auth/change-password', {
        currentPassword: user?.needsPasswordChange ? undefined : passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      setSuccess('Password changed successfully!');
      setPasswordDialog(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      
      // Refresh user data
      await fetchCustomerData();
      
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  // Download bill PDF through axios proxy (avoids React Router intercept)
  // Open receipt PDF in a new tab.
  // window.open MUST be called synchronously before any await so the browser
  // treats it as a direct user-gesture popup (otherwise it gets blocked).
  const openBill = async (type, transactionId) => {
    // 1. Open blank tab synchronously — still inside user-gesture call stack
    const newTab = window.open('about:blank', '_blank');
    if (!newTab) {
      setPaymentError('Popup blocked. Please allow popups for this site and try again.');
      return;
    }
    await openBillInTab({
      tab: newTab,
      type,
      transactionId,
      onError: (err) => {
        console.error('Bill open error:', err);
        setPaymentError('Failed to open receipt. Please try again.');
      }
    });
  };

  const handleCustomerPayment = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      setPaymentError('Enter a valid amount'); return;
    }
    setPaymentLoading(true);
    setPaymentError('');
    setPaymentSuccess('');

    try {
      // Create Razorpay order
      const orderRes = await axios.post('/api/payments/create-order', {
        amount: parseFloat(paymentForm.amount),
        type: paymentForm.type === 'loan' ? 'storage' : 'storage',
        description: paymentForm.description || `${paymentForm.type} payment`,
      });

      if (!orderRes.data.success || !orderRes.data.keyId) {
        throw new Error('Payment gateway not configured. Please contact the warehouse.');
      }

      const { orderId, keyId } = orderRes.data;

      const options = {
        key: keyId,
        amount: Math.round(parseFloat(paymentForm.amount) * 100),
        currency: 'INR',
        name: 'Sarvani Farmers Warehouse',
        description: paymentForm.type === 'rent' ? 'Storage Rent Payment' : 'Loan Repayment',
        order_id: orderId,
        handler: async (response) => {
          try {
            // Verify payment
            await axios.post('/api/payments/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            // Record in customer-payment endpoint
            const recordRes = await axios.post('/api/payments/customer-payment', {
              type:           paymentForm.type,
              amount:         parseFloat(paymentForm.amount),
              method:         paymentForm.method,
              description:    paymentForm.description || `${paymentForm.type} payment`,
              allocationId:   paymentForm.allocationId || undefined,
              loanId:         paymentForm.loanId       || undefined,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId:   response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            });

            const newTxnId = recordRes.data.transaction?._id;
            setLastPaymentTxnId(newTxnId);
            // Note: cannot auto-open popup here (deep inside Razorpay async callback = blocked by browser)
            // User can click "View Receipt" in the success alert below.
            setPaymentSuccess(`Payment of Rs. ${paymentForm.amount} received! Click "View Receipt" to open the bill.`);
            setPaymentForm(prev => ({ ...prev, amount: '', description: '' }));
            fetchCustomerData();
          } catch (err) {
            setPaymentError('Payment recorded with gateway but verification failed. Contact support.');
          } finally {
            setPaymentLoading(false);
          }
        },
        prefill: { name: user?.name || '', contact: user?.phone || '' },
        theme:  { color: '#1976d2' },
        // UPI only
        method: {
          upi:         paymentForm.method === 'upi',
          card:        false,
          wallet:      false,
          emi:         false,
        },
        modal: { ondismiss: () => setPaymentLoading(false) }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => { setPaymentError('Payment failed. Please try again.'); setPaymentLoading(false); });
      rzp.open();

    } catch (err) {
      console.error('Payment error:', err);
      setPaymentError(err.response?.data?.message || err.message || 'Payment initiation failed.');
      setPaymentLoading(false);
    }
  };

  const StatsCards = () => (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Warehouse color="primary" sx={{ fontSize: 40, mr: 2 }} />
              <Box>
                <Typography color="text.secondary" gutterBottom>
                  {t('dashboard.activeStorage')}
                </Typography>
                <Typography variant="h4">
                  {stats?.activeStorage || 0}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <AccountBalance color="success" sx={{ fontSize: 40, mr: 2 }} />
              <Box>
                <Typography color="text.secondary" gutterBottom>
                  {t('dashboard.totalSpent')}
                </Typography>
                <Typography variant="h4">
                  ₹{stats?.totalSpent || 0}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <LocalShipping color="info" sx={{ fontSize: 40, mr: 2 }} />
              <Box>
                <Typography color="text.secondary" gutterBottom>
                  Vehicles
                </Typography>
                <Typography variant="h4">
                  {stats?.totalVehicles || 0}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Payment color="warning" sx={{ fontSize: 40, mr: 2 }} />
              <Box>
                <Typography color="text.secondary" gutterBottom>
                  {t('dashboard.pendingPayments')}
                </Typography>
                <Typography variant="h4">
                  ₹{stats?.pendingPayments || 0}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          {t('dashboard.customerDashboard')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<Lock />}
            onClick={() => setPasswordDialog(true)}
          >
            {t('dashboard.changePassword')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<ContactSupport />}
            onClick={() => setContactDialog(true)}
          >
            {t('dashboard.contactUs')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchCustomerData}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <StatsCards />
      
      {/* AI Loan Recommendations - Show prominently at top */}
      <Box sx={{ mb: 3 }}>
        <AILoanRecommendations customerId={user?._id} />
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<LocationOn />} label={t('customer.grainLocations')} />
          <Tab icon={<ShowChart />} label={t('customer.marketPredictions')} />
          <Tab icon={<NotificationsActive />} label={t('customer.loanAlerts')} />
          <Tab icon={<Calculate />} label={t('customer.loanCalculator')} />
          <Tab icon={<Send />} label={t('customer.myRequests')} />
          <Tab icon={<Payment />} label="My Payments" />
        </Tabs>
      </Box>

      {activeTab === 0 && <CustomerGrainLocationView />}
      {activeTab === 1 && <CustomerMarketPricesAndPredictions />}
      {activeTab === 2 && <CustomerLoanAlerts />}
      {activeTab === 3 && <CustomerLoanCalculatorAndRequest />}
      {activeTab === 4 && <CustomerRequestForm />}

      {/* ── Payments Tab ────────────────────────────────────────────── */}
      {activeTab === 5 && (
        <Grid container spacing={3}>
          {/* Payment Form */}
          <Grid item xs={12} md={5}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Payment sx={{ verticalAlign: 'middle', mr: 1 }} color="primary" />
                  Make a Payment
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {paymentError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPaymentError('')}>{paymentError}</Alert>}
                {paymentSuccess && (
                  <Alert
                    severity="success"
                    sx={{ mb: 2 }}
                    onClose={() => { setPaymentSuccess(''); setLastPaymentTxnId(null); }}
                    action={
                      lastPaymentTxnId && (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          onClick={() => openBill('storage', lastPaymentTxnId)}
                          startIcon={<Receipt />}
                        >
                          View Receipt Again
                        </Button>
                      )
                    }
                  >
                    {paymentSuccess}
                  </Alert>
                )}

                <Grid container spacing={2}>
                  {/* Payment Type */}
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Payment For</InputLabel>
                      <Select
                        value={paymentForm.type}
                        label="Payment For"
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, type: e.target.value, allocationId: '', loanId: '' }))}
                      >
                        <MenuItem value="rent">Storage Rent</MenuItem>
                        <MenuItem value="loan">Loan Repayment</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Allocation / Loan selector */}
                  {paymentForm.type === 'rent' && allocations.length > 0 && (
                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>Select Allocation</InputLabel>
                        <Select
                          value={paymentForm.allocationId}
                          label="Select Allocation"
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, allocationId: e.target.value }))}
                        >
                          <MenuItem value="">-- Select --</MenuItem>
                          {allocations.filter(a => a.status === 'active').map(a => (
                            <MenuItem key={a._id} value={a._id}>
                              Box {a.boxNumber || a._id?.toString().slice(-4)} — {a.grainType || 'Grain'}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  )}
                  {paymentForm.type === 'loan' && loans.length > 0 && (
                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>Select Loan</InputLabel>
                        <Select
                          value={paymentForm.loanId}
                          label="Select Loan"
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, loanId: e.target.value }))}
                        >
                          <MenuItem value="">-- Select --</MenuItem>
                          {loans.filter(l => ['active','approved'].includes(l.status)).map(l => (
                            <MenuItem key={l._id} value={l._id}>
                              Loan #{l._id?.toString().slice(-5)} — Due: Rs. {l.remainingAmount || l.amount}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  )}

                  {/* Amount */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Amount (Rs.)"
                      type="number"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                      InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                    />
                  </Grid>

                  {/* Description */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Note (optional)"
                      value={paymentForm.description}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </Grid>

                  {/* Payment Method — UPI only */}
                  <Grid item xs={12}>
                    <FormLabel component="legend" sx={{ fontSize: 13, mb: 1 }}>Payment Method</FormLabel>
                    <RadioGroup
                      row
                      value={paymentForm.method}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, method: e.target.value }))}
                    >
                      <FormControlLabel
                        value="upi"
                        control={<Radio />}
                        label={
                          <Box sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
                            <PhoneAndroid color="success" fontSize="small" />
                            <Typography variant="body2">UPI</Typography>
                          </Box>
                        }
                      />
                    </RadioGroup>
                  </Grid>

                  {/* Pay Button */}
                  <Grid item xs={12}>
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      startIcon={paymentLoading ? <CircularProgress size={20} color="inherit" /> : <Payment />}
                      onClick={handleCustomerPayment}
                      disabled={paymentLoading || !paymentForm.amount}
                      sx={{ py: 1.5 }}
                    >
                      {paymentLoading ? 'Opening Payment...' : `Pay Rs. ${paymentForm.amount || '0'}`}
                    </Button>
                    <Typography variant="caption" color="text.secondary" sx={{ display:'block', mt:1, textAlign:'center' }}>
                      Secured by Razorpay. You will be redirected to complete payment.
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Payment History */}
          <Grid item xs={12} md={7}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Receipt sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Payment History
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {paymentHistory.length === 0 ? (
                  <Alert severity="info">No payment history yet.</Alert>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Amount</TableCell>
                          <TableCell>Method</TableCell>
                          <TableCell>Receipt</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paymentHistory.slice(0,20).map((txn) => (
                          <TableRow key={txn._id} hover>
                            <TableCell sx={{ fontSize: 12 }}>
                              {new Date(txn.createdAt).toLocaleDateString('en-IN')}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={(txn.type || '').replace(/_/g,' ')}
                                size="small"
                                color={txn.type === 'weighbridge_fee' ? 'info' : txn.type === 'loan_repayment' ? 'warning' : 'default'}
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                              Rs. {(txn.amount?.totalAmount || txn.amount?.baseAmount || 0).toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, textTransform:'uppercase' }}>
                              {txn.payment?.method || 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Receipt />}
                                onClick={() =>
                                  openBill(
                                    txn.type === 'weighbridge_fee' ? 'weighbridge' : 'storage',
                                    txn._id
                                  )
                                }
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Customer Contact Form */}
      <CustomerContactForm 
        open={contactDialog} 
        onClose={() => setContactDialog(false)} 
      />

      {/* Password Change Dialog */}
      <Dialog 
        open={passwordDialog} 
        onClose={() => !user?.needsPasswordChange && setPasswordDialog(false)}
        maxWidth="sm" 
        fullWidth
        disableEscapeKeyDown={user?.needsPasswordChange}
      >
        <DialogTitle>
          {user?.needsPasswordChange ? t('auth.setPassword') : t('dashboard.changePassword')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {user?.needsPasswordChange ? (
              <Alert severity="info" sx={{ mb: 3 }}>
                {t('auth.welcomeSetPassword')}
              </Alert>
            ) : (
              <TextField
                fullWidth
                type="password"
                label={t('auth.currentPassword')}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                sx={{ mb: 2 }}
              />
            )}
            
            <TextField
              fullWidth
              type="password"
              label={t('auth.newPassword')}
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              helperText={t('auth.minimumChars')}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              type="password"
              label={t('auth.confirmPassword')}
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              error={passwordForm.newPassword !== passwordForm.confirmPassword && passwordForm.confirmPassword !== ''}
              helperText={
                passwordForm.newPassword !== passwordForm.confirmPassword && passwordForm.confirmPassword !== ''
                  ? t('auth.passwordMismatch')
                  : ''
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          {!user?.needsPasswordChange && (
            <Button onClick={() => setPasswordDialog(false)}>{t('common.cancel')}</Button>
          )}
          <Button 
            onClick={handlePasswordChange} 
            variant="contained"
            disabled={loading || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword}
          >
            {loading ? <CircularProgress size={24} /> : t('dashboard.changePassword')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CustomerDashboard;