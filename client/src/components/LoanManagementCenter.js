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
  TextField,
  Slider,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  LinearProgress
} from '@mui/material';
import {
  Refresh,
  AccountBalance,
  Calculate,
  Payment,
  TrendingUp,
  Info,
  CheckCircle,
  Warning
} from '@mui/icons-material';
import axios from 'axios';

const LoanManagementCenter = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  
  // Loan eligibility data
  const [eligibilityData, setEligibilityData] = useState(null);
  const [myLoans, setMyLoans] = useState([]);
  
  // Loan request form
  const [loanForm, setLoanForm] = useState({
    amount: '',
    duration: 12,
    purpose: '',
    interestRate: 10
  });
  
  // EMI Calculator
  const [emiCalculator, setEmiCalculator] = useState({
    amount: 100000,
    duration: 12,
    interestRate: 10
  });
  const [calculatedEMI, setCalculatedEMI] = useState(null);
  
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      
      // Fetch loan eligibility
      const eligibilityResponse = await axios.get('/api/loans/eligibility', {
        headers: { 'x-auth-token': token }
      });
      setEligibilityData(eligibilityResponse.data);
      
      // Fetch my loans
      const loansResponse = await axios.get('/api/loans/my-loans', {
        headers: { 'x-auth-token': token }
      });
      setMyLoans(loansResponse.data);
      
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch loan data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Calculate EMI whenever calculator values change
    calculateEMI();
  }, [emiCalculator]);

  const handleRefresh = () => {
    fetchData();
  };

  const calculateEMI = () => {
    const { amount, duration, interestRate } = emiCalculator;
    const monthlyRate = interestRate / 12 / 100;
    const emi = (amount * monthlyRate * Math.pow(1 + monthlyRate, duration)) / 
                 (Math.pow(1 + monthlyRate, duration) - 1);
    const totalAmount = emi * duration;
    const totalInterest = totalAmount - amount;
    
    setCalculatedEMI({
      monthlyEMI: Math.round(emi),
      totalAmount: Math.round(totalAmount),
      totalInterest: Math.round(totalInterest)
    });
  };

  const handleRequestLoan = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/loans/request', {
        ...loanForm,
        collateral: `Stored grains worth ₹${eligibilityData.totalGrainValue}`
      }, {
        headers: { 'x-auth-token': token }
      });
      
      setRequestDialogOpen(false);
      setLoanForm({ amount: '', duration: 12, purpose: '', interestRate: 10 });
      fetchData();
      alert('Loan request submitted successfully! Awaiting approval.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit loan request');
    }
  };

  const handlePayEMI = (loan) => {
    setSelectedLoan(loan);
    setPaymentDialogOpen(true);
  };

  const handleConfirmPayment = () => {
    // Redirect to payment gateway
    window.location.href = `/payment-gateway?type=loan&id=${selectedLoan._id}&amount=${selectedLoan.monthlyPayment}`;
  };

  const getLoanStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'approved':
        return 'info';
      case 'completed':
        return 'default';
      case 'defaulted':
        return 'error';
      default:
        return 'default';
    }
  };

  const getDaysOverdue = (dueDate) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diff = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AccountBalance sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Loan Management Center
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh} disabled={refreshing}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Loan Eligibility" />
          <Tab label={`My Loans (${myLoans.length})`} />
          <Tab label="EMI Calculator" />
        </Tabs>
      </Card>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Box>
          {/* Eligibility Summary */}
          <Alert severity="info" sx={{ mb: 3 }} icon={<Info />}>
            Based on your stored grains worth <strong>₹{eligibilityData?.totalGrainValue?.toLocaleString()}</strong>, 
            you can request a loan up to <strong>₹{eligibilityData?.maxLoanAmount?.toLocaleString()}</strong> (70% of grain value)
          </Alert>

          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Total Grain Value
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="primary">
                    ₹{eligibilityData?.totalGrainValue?.toLocaleString() || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Maximum Loan Amount
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" sx={{ color: '#4caf50' }}>
                    ₹{eligibilityData?.maxLoanAmount?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    70% of grain value
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Available Loan Amount
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" sx={{ color: '#ff9800' }}>
                    ₹{eligibilityData?.availableLoanAmount?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    After existing loans
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Grain Details */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Your Grain Collateral
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Grain Type</TableCell>
                      <TableCell align="right">Weight (kg)</TableCell>
                      <TableCell align="right">Value (₹)</TableCell>
                      <TableCell align="right">Loan Potential (₹)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {eligibilityData?.grainDetails?.map((grain, index) => (
                      <TableRow key={index}>
                        <TableCell>{grain.grainType}</TableCell>
                        <TableCell align="right">{grain.weight?.toLocaleString()}</TableCell>
                        <TableCell align="right">₹{grain.value?.toLocaleString()}</TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold" color="primary">
                            ₹{(grain.value * 0.7)?.toFixed(0).toLocaleString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Request Loan Button */}
          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<AccountBalance />}
            onClick={() => setRequestDialogOpen(true)}
            disabled={eligibilityData?.availableLoanAmount <= 0}
          >
            {eligibilityData?.availableLoanAmount > 0 
              ? 'Request New Loan' 
              : 'No Available Loan Amount (Clear existing loans)'}
          </Button>
        </Box>
      )}

      {activeTab === 1 && (
        <Box>
          {myLoans.length > 0 ? (
            <Grid container spacing={3}>
              {myLoans.map((loan, index) => {
                const daysOverdue = getDaysOverdue(loan.dueDate);
                const isOverdue = daysOverdue > 0 && loan.status === 'active';
                
                return (
                  <Grid item xs={12} md={6} key={index}>
                    <Card sx={{ border: isOverdue ? '2px solid #f44336' : 'none' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="h6" fontWeight="bold">
                            Loan #{loan._id?.substring(0, 8)}
                          </Typography>
                          <Chip 
                            label={loan.status}
                            color={getLoanStatusColor(loan.status)}
                            size="small"
                          />
                        </Box>

                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">
                              Loan Amount
                            </Typography>
                            <Typography variant="h6" fontWeight="bold" color="primary">
                              ₹{loan.amount?.toLocaleString()}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">
                              Interest Rate
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                              {loan.interestRate}%
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">
                              Duration
                            </Typography>
                            <Typography variant="body1">
                              {loan.duration} months
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">
                              Monthly EMI
                            </Typography>
                            <Typography variant="body1" fontWeight="bold">
                              ₹{loan.monthlyPayment?.toLocaleString()}
                            </Typography>
                          </Grid>
                        </Grid>

                        <Divider sx={{ my: 2 }} />

                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="textSecondary">
                              Total Amount
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">
                              ₹{loan.totalAmount?.toLocaleString()}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="textSecondary">
                              Paid Amount
                            </Typography>
                            <Typography variant="body2" fontWeight="bold" color="success.main">
                              ₹{loan.paidAmount?.toLocaleString()}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="body2" color="textSecondary">
                              Remaining Balance
                            </Typography>
                            <Typography variant="body1" fontWeight="bold" color="error.main">
                              ₹{loan.remainingAmount?.toLocaleString()}
                            </Typography>
                          </Box>

                          <LinearProgress 
                            variant="determinate" 
                            value={(loan.paidAmount / loan.totalAmount) * 100}
                            sx={{ height: 8, borderRadius: 4, mb: 2 }}
                            color="success"
                          />

                          {loan.status === 'active' && (
                            <Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="caption" color="textSecondary">
                                  Next Payment Due
                                </Typography>
                                <Typography variant="caption" fontWeight="bold">
                                  {new Date(loan.dueDate).toLocaleDateString()}
                                </Typography>
                              </Box>
                              
                              {isOverdue && (
                                <Alert severity="error" sx={{ mb: 2 }} icon={<Warning />}>
                                  <strong>Overdue by {daysOverdue} days!</strong> Please make payment immediately.
                                </Alert>
                              )}

                              <Button
                                variant="contained"
                                fullWidth
                                startIcon={<Payment />}
                                onClick={() => handlePayEMI(loan)}
                                color={isOverdue ? 'error' : 'primary'}
                              >
                                Pay EMI - ₹{loan.monthlyPayment?.toLocaleString()}
                              </Button>
                            </Box>
                          )}

                          {loan.status === 'pending' && (
                            <Alert severity="warning">
                              Loan application is pending approval
                            </Alert>
                          )}

                          {loan.status === 'completed' && (
                            <Alert severity="success" icon={<CheckCircle />}>
                              Loan fully repaid!
                            </Alert>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <Alert severity="info">
              You don't have any active loans. Use the Eligibility tab to request a new loan.
            </Alert>
          )}
        </Box>
      )}

      {activeTab === 2 && (
        <Box>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Calculate sx={{ fontSize: 32, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight="bold">
                      EMI Calculator
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" gutterBottom>
                      Loan Amount (₹)
                    </Typography>
                    <Slider
                      value={emiCalculator.amount}
                      onChange={(e, val) => setEmiCalculator({ ...emiCalculator, amount: val })}
                      min={10000}
                      max={eligibilityData?.maxLoanAmount || 500000}
                      step={10000}
                      valueLabelDisplay="on"
                      valueLabelFormat={(val) => `₹${val.toLocaleString()}`}
                    />
                    <TextField
                      type="number"
                      value={emiCalculator.amount}
                      onChange={(e) => setEmiCalculator({ ...emiCalculator, amount: parseInt(e.target.value) || 0 })}
                      fullWidth
                      size="small"
                      InputProps={{ startAdornment: '₹' }}
                    />
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" gutterBottom>
                      Loan Duration (Months)
                    </Typography>
                    <Slider
                      value={emiCalculator.duration}
                      onChange={(e, val) => setEmiCalculator({ ...emiCalculator, duration: val })}
                      min={6}
                      max={60}
                      step={6}
                      valueLabelDisplay="on"
                      marks={[
                        { value: 6, label: '6M' },
                        { value: 12, label: '1Y' },
                        { value: 24, label: '2Y' },
                        { value: 36, label: '3Y' },
                        { value: 60, label: '5Y' }
                      ]}
                    />
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" gutterBottom>
                      Interest Rate (% per annum)
                    </Typography>
                    <Slider
                      value={emiCalculator.interestRate}
                      onChange={(e, val) => setEmiCalculator({ ...emiCalculator, interestRate: val })}
                      min={5}
                      max={20}
                      step={0.5}
                      valueLabelDisplay="on"
                      valueLabelFormat={(val) => `${val}%`}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Calculation Results
                  </Typography>

                  {calculatedEMI && (
                    <Box>
                      <Paper sx={{ p: 3, mb: 2, backgroundColor: '#e3f2fd', textAlign: 'center' }}>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          Monthly EMI
                        </Typography>
                        <Typography variant="h3" fontWeight="bold" color="primary">
                          ₹{calculatedEMI.monthlyEMI?.toLocaleString()}
                        </Typography>
                      </Paper>

                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Paper sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="caption" color="textSecondary">
                              Principal Amount
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                              ₹{emiCalculator.amount?.toLocaleString()}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6}>
                          <Paper sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="caption" color="textSecondary">
                              Total Interest
                            </Typography>
                            <Typography variant="h6" fontWeight="bold" sx={{ color: '#ff9800' }}>
                              ₹{calculatedEMI.totalInterest?.toLocaleString()}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={12}>
                          <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: '#f3e5f5' }}>
                            <Typography variant="caption" color="textSecondary">
                              Total Amount Payable
                            </Typography>
                            <Typography variant="h5" fontWeight="bold" sx={{ color: '#9c27b0' }}>
                              ₹{calculatedEMI.totalAmount?.toLocaleString()}
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>

                      <Divider sx={{ my: 3 }} />

                      <Alert severity="info">
                        <Typography variant="body2">
                          <strong>Note:</strong> This is an estimated calculation. Actual EMI may vary based on processing fees and other charges.
                        </Typography>
                      </Alert>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Loan Request Dialog */}
      <Dialog open={requestDialogOpen} onClose={() => setRequestDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Request New Loan</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Maximum available: ₹{eligibilityData?.availableLoanAmount?.toLocaleString()}
            </Alert>
            
            <TextField
              label="Loan Amount"
              type="number"
              value={loanForm.amount}
              onChange={(e) => setLoanForm({ ...loanForm, amount: e.target.value })}
              fullWidth
              sx={{ mb: 2 }}
              InputProps={{ startAdornment: '₹' }}
              helperText={`Maximum: ₹${eligibilityData?.availableLoanAmount?.toLocaleString()}`}
            />

            <TextField
              label="Duration (months)"
              type="number"
              value={loanForm.duration}
              onChange={(e) => setLoanForm({ ...loanForm, duration: parseInt(e.target.value) })}
              fullWidth
              sx={{ mb: 2 }}
            />

            <TextField
              label="Interest Rate (% per annum)"
              type="number"
              value={loanForm.interestRate}
              onChange={(e) => setLoanForm({ ...loanForm, interestRate: parseFloat(e.target.value) })}
              fullWidth
              sx={{ mb: 2 }}
              InputProps={{ endAdornment: '%' }}
            />

            <TextField
              label="Purpose of Loan"
              multiline
              rows={3}
              value={loanForm.purpose}
              onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })}
              fullWidth
              placeholder="Describe why you need this loan..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleRequestLoan} 
            variant="contained"
            disabled={!loanForm.amount || !loanForm.purpose || parseFloat(loanForm.amount) > eligibilityData?.availableLoanAmount}
          >
            Submit Request
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)}>
        <DialogTitle>Confirm EMI Payment</DialogTitle>
        <DialogContent dividers>
          {selectedLoan && (
            <Box>
              <Typography variant="body1" gutterBottom>
                You are about to pay EMI for:
              </Typography>
              <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  Loan ID
                </Typography>
                <Typography variant="body1" fontWeight="bold" gutterBottom>
                  #{selectedLoan._id?.substring(0, 8)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  EMI Amount
                </Typography>
                <Typography variant="h5" fontWeight="bold" color="primary">
                  ₹{selectedLoan.monthlyPayment?.toLocaleString()}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirmPayment} 
            variant="contained" 
            color="primary"
            startIcon={<Payment />}
          >
            Proceed to Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LoanManagementCenter;
