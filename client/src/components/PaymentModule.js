import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import {
  Payment,
  AccountBalance,
  CreditCard,
  QrCode2,
  Receipt,
  CheckCircle,
  Refresh,
  Visibility
} from '@mui/icons-material';
import axios from 'axios';
import RazorpayPayment from './RazorpayPayment';

const PaymentModule = ({ userRole = 'customer' }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingPayments, setPendingPayments] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentDetailsDialog, setPaymentDetailsDialog] = useState(false);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('all');
  
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'cash',
    reference: '',
    notes: ''
  });

  const [razorpayDialog, setRazorpayDialog] = useState(false);
  const [stats, setStats] = useState({
    totalPending: 0,
    totalPaid: 0,
    thisMonth: 0
  });

  useEffect(() => {
    fetchPaymentData();
  }, []);

  const fetchPaymentData = async () => {
    try {
      setLoading(true);
      const [pendingRes, historyRes] = await Promise.all([
        axios.get('/api/payments/pending'),
        axios.get('/api/payments/history')
      ]);

      setPendingPayments(pendingRes.data.payments || []);
      setPaymentHistory(historyRes.data.transactions || []);

      // Calculate stats
      const totalPending = pendingRes.data.payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const totalPaid = historyRes.data.transactions?.reduce((sum, t) => 
        sum + (t.amount?.totalAmount || t.amount?.baseAmount || t.amount || 0), 0
      ) || 0;
      
      const thisMonth = historyRes.data.transactions?.filter(t => {
        const paymentDate = new Date(t.createdAt || t.payment?.date);
        const now = new Date();
        return paymentDate.getMonth() === now.getMonth() && 
               paymentDate.getFullYear() === now.getFullYear();
      }).reduce((sum, t) => sum + (t.amount?.totalAmount || t.amount?.baseAmount || t.amount || 0), 0) || 0;

      setStats({ totalPending, totalPaid, thisMonth });
    } catch (err) {
      console.error('Error fetching payment data:', err);
      setError('Failed to load payment data');
    } finally {
      setLoading(false);
    }
  };

  const handleMakePayment = (payment = null) => {
    if (payment) {
      setSelectedPayment(payment);
      setPaymentForm({
        amount: payment.amount || '',
        paymentMethod: 'cash',
        reference: '',
        notes: ''
      });
    }
    setPaymentDialog(true);
  };

  const handlePaymentSubmit = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      setLoading(true);
      setError('');

      if (paymentForm.paymentMethod === 'online') {
        // Use Razorpay for online payments
        setRazorpayDialog(true);
        setPaymentDialog(false);
        return;
      }

      // Create payment transaction for cash/UPI
      const paymentData = {
        type: selectedPayment?.type || 'general_payment',
        amount: {
          baseAmount: parseFloat(paymentForm.amount),
          totalAmount: parseFloat(paymentForm.amount)
        },
        payment: {
          method: paymentForm.paymentMethod,
          status: 'completed',
          reference: paymentForm.reference || `PAY-${Date.now()}`,
          date: new Date()
        },
        metadata: {
          notes: paymentForm.notes,
          paymentId: selectedPayment?._id
        }
      };

      const response = await axios.post('/api/payments/create', paymentData);

      setSuccess('Payment processed successfully!');
      setPaymentDialog(false);
      setSelectedPayment(null);
      resetForm();
      fetchPaymentData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const handleRazorpaySuccess = async (paymentData) => {
    try {
      setSuccess('Online payment processed successfully!');
      setRazorpayDialog(false);
      fetchPaymentData();
    } catch (err) {
      setError('Payment verification failed');
    }
  };

  const handleViewDetails = (payment) => {
    setSelectedPayment(payment);
    setPaymentDetailsDialog(true);
  };

  const resetForm = () => {
    setPaymentForm({
      amount: '',
      paymentMethod: 'cash',
      reference: '',
      notes: ''
    });
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'cash': return '💵';
      case 'upi': return '📱';
      case 'card': return '💳';
      case 'online': return '🌐';
      default: return '💰';
    }
  };

  const getPaymentTypeLabel = (type) => {
    switch (type) {
      case 'weighbridge_fee': return 'Weighbridge Fee';
      case 'grain_storage_rent': return 'Storage Rent';
      case 'loan_repayment': return 'Loan Repayment';
      case 'grain_loan': return 'Grain Loan';
      case 'grain_release': return 'Grain Release';
      default: return type?.replace(/_/g, ' ').toUpperCase() || 'Payment';
    }
  };

  const getPaymentTypeColor = (type) => {
    switch (type) {
      case 'weighbridge_fee': return 'primary';
      case 'grain_storage_rent': return 'success';
      case 'loan_repayment': return 'warning';
      case 'grain_loan': return 'info';
      case 'grain_release': return 'secondary';
      default: return 'default';
    }
  };

  const filteredPaymentHistory = paymentTypeFilter === 'all' 
    ? paymentHistory 
    : paymentHistory.filter(t => t.type === paymentTypeFilter);

  return (
    <Box>
      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', color: 'white' }}>
                <Payment sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Pending Payments
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    ₹{stats.totalPending.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', color: 'white' }}>
                <CheckCircle sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Paid
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    ₹{stats.totalPaid.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', color: 'white' }}>
                <AccountBalance sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    This Month
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    ₹{stats.thisMonth.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Pending Payments */}
      {pendingPayments.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Pending Payments</Typography>
              <Chip label={`${pendingPayments.length} Pending`} color="warning" />
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Description</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingPayments.map((payment) => (
                    <TableRow key={payment._id}>
                      <TableCell>{payment.description || 'Payment Due'}</TableCell>
                      <TableCell>
                        <Typography variant="body1" fontWeight="bold" color="primary">
                          ₹{payment.amount?.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(payment.dueDate || payment.createdAt)}</TableCell>
                      <TableCell>
                        <Chip label="Pending" color="warning" size="small" />
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<Payment />}
                          onClick={() => handleMakePayment(payment)}
                        >
                          Pay Now
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Make Custom Payment Button (for owner) */}
      {userRole === 'owner' && (
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={<Payment />}
            onClick={() => handleMakePayment()}
          >
            Record Payment
          </Button>
        </Box>
      )}

      {/* Payment History */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Payment History</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Filter by Type</InputLabel>
                <Select
                  value={paymentTypeFilter}
                  label="Filter by Type"
                  onChange={(e) => setPaymentTypeFilter(e.target.value)}
                >
                  <MenuItem value="all">All Payments</MenuItem>
                  <MenuItem value="weighbridge_fee">⚖️ Weighbridge Fees</MenuItem>
                  <MenuItem value="grain_storage_rent">🏢 Storage Rent</MenuItem>
                  <MenuItem value="loan_repayment">💰 Loan Repayments</MenuItem>
                  <MenuItem value="grain_loan">🌾 Grain Loans</MenuItem>
                  <MenuItem value="grain_release">📦 Grain Release</MenuItem>
                </Select>
              </FormControl>
              <IconButton onClick={fetchPaymentData} disabled={loading}>
                <Refresh />
              </IconButton>
            </Box>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredPaymentHistory.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Payment Type</TableCell>
                    <TableCell>Details</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPaymentHistory.map((transaction) => (
                    <TableRow key={transaction._id}>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(transaction.createdAt || transaction.payment?.date)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(transaction.createdAt || transaction.payment?.date).toLocaleTimeString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={getPaymentTypeLabel(transaction.type)} 
                          size="small"
                          color={getPaymentTypeColor(transaction.type)}
                        />
                      </TableCell>
                      <TableCell>
                        {transaction.vehicle ? (
                          <Box>
                            <Typography variant="body2" fontWeight="600">
                              {transaction.vehicle.vehicleNumber || 'N/A'}
                            </Typography>
                            <Chip 
                              label={transaction.vehicle.visitPurpose === 'weighing_only' ? 'Weight Check' : 'Loading/Unloading'}
                              size="small"
                              color={transaction.vehicle.visitPurpose === 'weighing_only' ? 'primary' : 'secondary'}
                              sx={{ mt: 0.5 }}
                            />
                          </Box>
                        ) : transaction.type === 'loan_repayment' ? (
                          <Box>
                            <Typography variant="body2" fontWeight="600" color="warning.main">
                              💰 Loan Payment
                            </Typography>
                            {transaction.loanDetails && (
                              <Typography variant="caption" color="text.secondary">
                                Outstanding: ₹{transaction.loanDetails.outstandingAmount?.toLocaleString()}
                              </Typography>
                            )}
                          </Box>
                        ) : transaction.type === 'grain_storage_rent' ? (
                          <Box>
                            <Typography variant="body2" fontWeight="600" color="success.main">
                              🏢 Storage Rent
                            </Typography>
                            {transaction.grainDetails && (
                              <Typography variant="caption" color="text.secondary">
                                {transaction.grainDetails.grainType?.toUpperCase()} - {transaction.grainDetails.numberOfBags} bags
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {transaction.customer?.username || 'N/A'}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getPaymentMethodIcon(transaction.payment?.method)}
                          {transaction.payment?.method?.toUpperCase()}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1" fontWeight="bold" color="success.main">
                          ₹{(transaction.amount?.totalAmount || transaction.amount?.baseAmount || transaction.amount || 0).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={(transaction.payment?.status || 'completed').toUpperCase()}
                          color="success"
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => handleViewDetails(transaction)}>
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">No payment history found</Alert>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Make Payment</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  label="Payment Method"
                >
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="upi">UPI</MenuItem>
                  <MenuItem value="card">Card</MenuItem>
                  <MenuItem value="online">Online (Razorpay)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {paymentForm.paymentMethod !== 'cash' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Payment Reference / Transaction ID"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  placeholder="Enter transaction ID or reference number"
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes (Optional)"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                placeholder="Add any additional notes..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handlePaymentSubmit}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <Payment />}
          >
            {paymentForm.paymentMethod === 'online' ? 'Pay Online' : 'Confirm Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Razorpay Payment Dialog */}
      {razorpayDialog && (
        <RazorpayPayment
          amount={parseFloat(paymentForm.amount)}
          onSuccess={handleRazorpaySuccess}
          onClose={() => setRazorpayDialog(false)}
        />
      )}

      {/* Payment Details Dialog */}
      <Dialog open={paymentDetailsDialog} onClose={() => setPaymentDetailsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Payment Details</DialogTitle>
        <DialogContent dividers>
          {selectedPayment && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                  <Typography variant="caption" color="text.secondary">Transaction ID</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {selectedPayment.transactionId || selectedPayment._id}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                  <Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {formatDate(selectedPayment.createdAt || selectedPayment.payment?.date)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper sx={{ p: 2, backgroundColor: 'success.50' }}>
                  <Typography variant="caption" color="text.secondary">Amount</Typography>
                  <Typography variant="h6" color="success.main" fontWeight="bold">
                    ₹{(selectedPayment.amount?.totalAmount || selectedPayment.amount?.baseAmount || selectedPayment.amount || 0).toLocaleString()}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                  <Typography variant="caption" color="text.secondary">Method</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {selectedPayment.payment?.method?.toUpperCase()}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Chip 
                    label={(selectedPayment.payment?.status || 'completed').toUpperCase()}
                    color="success"
                    size="small"
                  />
                </Paper>
              </Grid>
              {selectedPayment.payment?.reference && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                    <Typography variant="caption" color="text.secondary">Reference</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {selectedPayment.payment.reference}
                    </Typography>
                  </Paper>
                </Grid>
              )}
              {selectedPayment.metadata?.notes && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                    <Typography variant="caption" color="text.secondary">Notes</Typography>
                    <Typography variant="body2">
                      {selectedPayment.metadata.notes}
                    </Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDetailsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PaymentModule;
