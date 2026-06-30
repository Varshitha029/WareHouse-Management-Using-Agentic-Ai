import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Divider,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Stack,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Calculate,
  AccountBalance,
  Grain,
  TrendingUp,
  Send,
  CheckCircle,
  Info
} from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from '../i18n/LanguageContext';

const CustomerLoanCalculatorAndRequest = () => {
  const { t } = useTranslation();
  // Loan Calculator State
  const [grainValue, setGrainValue] = useState(0);
  const [requestedAmount, setRequestedAmount] = useState('');
  const [duration, setDuration] = useState('12');
  const [interestRate, setInterestRate] = useState('12');
  const [calculationResult, setCalculationResult] = useState(null);
  
  // Loan Request State
  const [purpose, setPurpose] = useState('');
  const [collateral, setCollateral] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [eligibility, setEligibility] = useState(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);

  useEffect(() => {
    fetchLoanEligibility();
  }, []);

  const fetchLoanEligibility = async () => {
    try {
      const response = await axios.get('/api/loans/eligibility');
      const data = response.data;
      
      // Parse all numeric values from strings to numbers
      const parsedEligibility = {
        totalGrainValue: parseFloat(data.totalGrainValue) || 0,
        maxLoanAmount: parseFloat(data.maxLoanAmount) || 0,
        totalActiveLoanAmount: parseFloat(data.totalActiveLoanAmount) || 0,
        availableLoanAmount: parseFloat(data.availableLoanAmount) || 0,
        grainDetails: data.grainDetails,
        loanToValueRatio: data.loanToValueRatio,
        eligibilityStatus: data.eligibilityStatus,
        message: data.message
      };
      
      setEligibility(parsedEligibility);
      setGrainValue(parsedEligibility.totalGrainValue);
    } catch (err) {
      console.error('Error fetching loan eligibility:', err);
    }
  };

  const calculateLoan = () => {
    const amount = parseFloat(requestedAmount);
    const months = parseInt(duration);
    const rate = parseFloat(interestRate);

    if (!amount || !months || !rate) {
      setError('Please fill all calculation fields');
      return;
    }

    // Allow calculation even if amount exceeds eligibility, but show warning
    const maxLoanAmount = grainValue * 0.70;
    if (amount > maxLoanAmount && maxLoanAmount > 0) {
      setError(`Warning: Requested amount (₹${amount.toFixed(2)}) exceeds maximum eligible amount of ₹${maxLoanAmount.toFixed(2)} based on your grain value. You can still calculate, but loan approval may be subject to additional collateral.`);
    } else {
      setError('');
    }

    // Calculate monthly EMI
    const monthlyRate = rate / 12 / 100;
    const monthlyEMI = amount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / 
                       (Math.pow(1 + monthlyRate, months) - 1);

    // Calculate total amounts
    const totalAmount = monthlyEMI * months;
    const totalInterest = totalAmount - amount;

    // Create amortization schedule
    let balance = amount;
    const schedule = [];
    
    for (let i = 1; i <= Math.min(months, 12); i++) { // Show first 12 months
      const interestPayment = balance * monthlyRate;
      const principalPayment = monthlyEMI - interestPayment;
      balance -= principalPayment;

      schedule.push({
        month: i,
        emi: monthlyEMI,
        principal: principalPayment,
        interest: interestPayment,
        balance: Math.max(0, balance)
      });
    }

    setCalculationResult({
      loanAmount: amount,
      monthlyEMI: monthlyEMI,
      totalAmount: totalAmount,
      totalInterest: totalInterest,
      duration: months,
      interestRate: rate,
      schedule: schedule
    });
  };

  const handleLoanRequest = () => {
    if (!calculationResult) {
      setError('Please calculate loan first');
      return;
    }
    setShowRequestDialog(true);
  };

  const submitLoanRequest = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      if (!purpose || !collateral) {
        setError('Please fill all required fields');
        setLoading(false);
        return;
      }

      const response = await axios.post('/api/loans/request', {
        amount: parseFloat(requestedAmount),
        duration: parseInt(duration),
        interestRate: parseFloat(interestRate),
        purpose,
        collateral
      });

      if (response.data.message) {
        setSuccess(response.data.message);
        setShowRequestDialog(false);
        
        // Reset form
        setRequestedAmount('');
        setPurpose('');
        setCollateral('');
        setCalculationResult(null);
        
        // Refresh eligibility
        fetchLoanEligibility();
      }
    } catch (err) {
      console.error('Loan request error:', err);
      setError(err.response?.data?.message || 'Failed to submit loan request');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const numAmount = parseFloat(amount) || 0;
    return `₹${numAmount.toFixed(2).toLocaleString('en-IN')}`;
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Calculate sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h5" fontWeight="bold">
          Loan Calculator & Request
        </Typography>
      </Box>

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

      <Grid container spacing={3}>
        {/* Eligibility Summary */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200' }}>
            <Typography variant="subtitle2" fontWeight="bold" color="info.main" gutterBottom>
              <Info sx={{ fontSize: 18, mr: 1, verticalAlign: 'middle' }} />
              Your Loan Eligibility
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Total Grain Value
                </Typography>
                <Typography variant="h6" fontWeight="bold">
                  {formatCurrency(grainValue)}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Maximum Loan (70%)
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="success.main">
                  {formatCurrency(grainValue * 0.70)}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Active Loans
                </Typography>
                <Typography variant="h6" fontWeight="bold">
                  {formatCurrency(eligibility?.totalActiveLoanAmount || 0)}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Available Amount
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="primary.main">
                  {formatCurrency(eligibility?.availableLoanAmount || 0)}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Loan Calculator */}
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Calculate Loan
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Loan Amount"
                  type="number"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">₹</InputAdornment>
                  }}
                  helperText={`Maximum: ₹${parseFloat(eligibility?.availableLoanAmount || 0).toFixed(2)}`}
                />

                <FormControl fullWidth>
                  <InputLabel>Loan Duration</InputLabel>
                  <Select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    label="Loan Duration"
                  >
                    <MenuItem value="6">6 Months</MenuItem>
                    <MenuItem value="12">12 Months (1 Year)</MenuItem>
                    <MenuItem value="18">18 Months</MenuItem>
                    <MenuItem value="24">24 Months (2 Years)</MenuItem>
                    <MenuItem value="36">36 Months (3 Years)</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Interest Rate (Annual)"
                  type="number"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>
                  }}
                  helperText="Default: 12% per annum"
                />

                <TextField
                  fullWidth
                  label="Loan Purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g., Agricultural inputs, Equipment purchase"
                  multiline
                  rows={2}
                />

                <TextField
                  fullWidth
                  label="Collateral Details"
                  value={collateral}
                  onChange={(e) => setCollateral(e.target.value)}
                  placeholder="e.g., Stored grains - Rice 100 bags"
                  multiline
                  rows={2}
                />

                <Button
                  variant="contained"
                  fullWidth
                  onClick={calculateLoan}
                  startIcon={<Calculate />}
                  size="large"
                >
                  Calculate EMI
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Calculation Results */}
        <Grid item xs={12} md={7}>
          {calculationResult ? (
            <Stack spacing={2}>
              {/* EMI Summary */}
              <Card sx={{ bgcolor: 'success.50' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Loan Summary
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                      <Typography variant="caption" color="text.secondary">
                        Loan Amount
                      </Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {formatCurrency(calculationResult.loanAmount)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="caption" color="text.secondary">
                        Monthly EMI
                      </Typography>
                      <Typography variant="h6" fontWeight="bold" color="primary.main">
                        {formatCurrency(calculationResult.monthlyEMI)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="caption" color="text.secondary">
                        Total Interest
                      </Typography>
                      <Typography variant="h6" fontWeight="bold" color="warning.main">
                        {formatCurrency(calculationResult.totalInterest)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="caption" color="text.secondary">
                        Total Payment
                      </Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {formatCurrency(calculationResult.totalAmount)}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 3 }}>
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={handleLoanRequest}
                      startIcon={<Send />}
                      size="large"
                      color="success"
                    >
                      Submit Loan Request
                    </Button>
                  </Box>
                </CardContent>
              </Card>

              {/* Amortization Schedule */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Payment Schedule (First 12 Months)
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Month</strong></TableCell>
                          <TableCell align="right"><strong>EMI</strong></TableCell>
                          <TableCell align="right"><strong>Principal</strong></TableCell>
                          <TableCell align="right"><strong>Interest</strong></TableCell>
                          <TableCell align="right"><strong>Balance</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {calculationResult.schedule.map((row) => (
                          <TableRow key={row.month} hover>
                            <TableCell>{row.month}</TableCell>
                            <TableCell align="right">
                              {formatCurrency(row.emi)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(row.principal)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(row.interest)}
                            </TableCell>
                            <TableCell align="right">
                              <Typography 
                                variant="body2" 
                                color={row.balance === 0 ? 'success.main' : 'text.primary'}
                              >
                                {formatCurrency(row.balance)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Stack>
          ) : (
            <Paper sx={{ p: 6, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <AccountBalance sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Calculate Your Loan
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Enter loan details on the left and click "Calculate EMI" to see your payment schedule
              </Typography>
            </Paper>
          )}
        </Grid>

        {/* Grain Details (from eligibility) */}
        {eligibility?.grainDetails && eligibility.grainDetails.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Grain sx={{ fontSize: 20, mr: 1, verticalAlign: 'middle' }} />
                  Your Stored Grains (Collateral)
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Grain Type</strong></TableCell>
                        <TableCell align="right"><strong>Weight (kg)</strong></TableCell>
                        <TableCell align="right"><strong>Value</strong></TableCell>
                        <TableCell align="right"><strong>Loan Eligible (60%)</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {eligibility.grainDetails.map((grain, index) => (
                        <TableRow key={index} hover>
                          <TableCell>{grain.grainType}</TableCell>
                          <TableCell align="right">{grain.weight}</TableCell>
                          <TableCell align="right">{formatCurrency(grain.value)}</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={formatCurrency(grain.value * 0.60)}
                              color="success"
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Loan Request Confirmation Dialog */}
      <Dialog open={showRequestDialog} onClose={() => setShowRequestDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Confirm Loan Request
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Your loan request will be sent to the warehouse owner for approval
          </Alert>
          
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Loan Amount
              </Typography>
              <Typography variant="h6" fontWeight="bold">
                {formatCurrency(calculationResult?.loanAmount)}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Monthly EMI
              </Typography>
              <Typography variant="h6" fontWeight="bold" color="primary.main">
                {formatCurrency(calculationResult?.monthlyEMI)}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Duration
              </Typography>
              <Typography variant="body1">
                {duration} months
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Purpose
              </Typography>
              <Typography variant="body1">
                {purpose}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Collateral
              </Typography>
              <Typography variant="body1">
                {collateral}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRequestDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={submitLoanRequest}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomerLoanCalculatorAndRequest;
