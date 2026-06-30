import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  Paper,
  Divider,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress
} from '@mui/material';
import {
  Calculate,
  CurrencyRupee,
  Grain,
  AccountBalance,
  Refresh
} from '@mui/icons-material';
import axios from 'axios';

const LoanCalculator = () => {
  const [loading, setLoading] = useState(false);
  const [grainData, setGrainData] = useState(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    numberOfBags: '',
    weightPerBag: 50, // Default 50 kg
    marketValuePerQuintal: '',
    grainType: 'rice'
  });

  const [calculationResult, setCalculationResult] = useState(null);

  useEffect(() => {
    fetchCustomerGrainData();
  }, []);

  const fetchCustomerGrainData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get('/api/dynamic-warehouse/my-grain-locations');
      const grainLocations = response.data.grainLocations || [];
      
      if (grainLocations.length > 0) {
        // Calculate total bags and grain value
        let totalBags = 0;
        let totalValue = 0;
        const grainTypeMap = {};
        
        grainLocations.forEach(location => {
          const bags = location.allocation?.bags || 0;
          const grainType = location.allocation?.grainType || 'other';
          const weight = location.allocation?.weight || (bags * 50); // Assume 50kg per bag if not specified
          
          totalBags += bags;
          
          // Group by grain type
          if (!grainTypeMap[grainType]) {
            grainTypeMap[grainType] = { bags: 0, weight: 0 };
          }
          grainTypeMap[grainType].bags += bags;
          grainTypeMap[grainType].weight += weight;
        });
        
        // Get dominant grain type (type with most bags)
        const dominantGrain = Object.keys(grainTypeMap).reduce((a, b) => 
          grainTypeMap[a].bags > grainTypeMap[b].bags ? a : b
        );
        
        // Calculate total weight in quintals
        const totalWeightKg = Object.values(grainTypeMap).reduce((sum, g) => sum + g.weight, 0);
        const totalQuintals = totalWeightKg / 100;
        
        // Get market price for dominant grain
        const grainInfo = grainTypes.find(g => g.value === dominantGrain) || grainTypes.find(g => g.value === 'other');
        const marketValuePerQuintal = grainInfo.avgPrice;
        const totalMarketValue = totalQuintals * marketValuePerQuintal;
        const maxLoanAmount = totalMarketValue * 0.60;
        
        setGrainData({
          totalBags,
          totalWeightKg: totalWeightKg.toFixed(2),
          totalQuintals: totalQuintals.toFixed(2),
          dominantGrain,
          marketValuePerQuintal,
          totalMarketValue: totalMarketValue.toFixed(2),
          maxLoanAmount: maxLoanAmount.toFixed(2),
          grainTypeMap
        });
        
        // Auto-fill form with grain data
        setFormData(prev => ({
          ...prev,
          numberOfBags: totalBags.toString(),
          grainType: dominantGrain,
          marketValuePerQuintal: marketValuePerQuintal.toString(),
          weightPerBag: (totalWeightKg / totalBags).toFixed(0)
        }));
      }
    } catch (err) {
      console.error('Error fetching grain data:', err);
      setError('Unable to fetch your grain data. You can still calculate manually.');
    } finally {
      setLoading(false);
    }
  };

  const grainTypes = [
    { value: 'rice', label: 'Rice', avgPrice: 1500 },
    { value: 'wheat', label: 'Wheat', avgPrice: 1200 },
    { value: 'maize', label: 'Maize', avgPrice: 1100 },
    { value: 'barley', label: 'Barley', avgPrice: 1300 },
    { value: 'millet', label: 'Millet', avgPrice: 1400 },
    { value: 'sorghum', label: 'Sorghum', avgPrice: 1250 },
    { value: 'pulses', label: 'Pulses', avgPrice: 1800 },
    { value: 'other', label: 'Other', avgPrice: 1000 }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Auto-fill market value based on grain type
    if (name === 'grainType') {
      const grain = grainTypes.find(g => g.value === value);
      setFormData(prev => ({
        ...prev,
        grainType: value,
        marketValuePerQuintal: grain?.avgPrice || ''
      }));
    }
  };

  const calculateLoan = () => {
    const bags = parseFloat(formData.numberOfBags);
    const weightPerBag = parseFloat(formData.weightPerBag);
    const marketValue = parseFloat(formData.marketValuePerQuintal);

    if (!bags || !weightPerBag || !marketValue) {
      alert('Please fill all fields');
      return;
    }

    // Total weight in kg
    const totalWeightKg = bags * weightPerBag;

    // Convert to quintals (100 kg = 1 quintal)
    const totalQuintals = totalWeightKg / 100;

    // Total market value
    const totalMarketValue = totalQuintals * marketValue;

    // Loan amount (60% of market value)
    const loanAmount = totalMarketValue * 0.60;

    // Monthly EMI calculation (assuming 12% annual interest, 12 months)
    const annualInterestRate = 0.12;
    const monthlyInterestRate = annualInterestRate / 12;
    const numberOfMonths = 12;
    
    const monthlyEMI = loanAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfMonths)) / 
                       (Math.pow(1 + monthlyInterestRate, numberOfMonths) - 1);

    const totalRepayment = monthlyEMI * numberOfMonths;
    const totalInterest = totalRepayment - loanAmount;

    setCalculationResult({
      numberOfBags: bags,
      weightPerBag,
      totalWeightKg,
      totalQuintals: totalQuintals.toFixed(2),
      marketValuePerQuintal: marketValue,
      totalMarketValue: totalMarketValue.toFixed(2),
      loanAmount: loanAmount.toFixed(2),
      loanPercentage: 60,
      monthlyEMI: monthlyEMI.toFixed(2),
      totalRepayment: totalRepayment.toFixed(2),
      totalInterest: totalInterest.toFixed(2),
      interestRate: '12%',
      tenure: numberOfMonths
    });
  };

  const resetCalculator = () => {
    setFormData({
      numberOfBags: '',
      weightPerBag: 50,
      marketValuePerQuintal: '',
      grainType: 'rice'
    });
    setCalculationResult(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Calculate sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
        <Typography variant="h4" component="h1" fontWeight="bold">
          Loan Calculator
        </Typography>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {grainData && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Your Grain Value:</strong> Total {grainData.totalBags} bags ({grainData.totalWeightKg} kg) worth ₹{grainData.totalMarketValue}. 
            <strong> Maximum Loan Available: ₹{grainData.maxLoanAmount} (60% of grain value)</strong>
          </Typography>
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Loan Terms:</strong> Customers receive 60% loan on grain market value. 
          Each bag = 50kg, 100kg = 1 quintal. Interest rate: 12% per annum.
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <Grain sx={{ mr: 1 }} />
                Grain Details
              </Typography>
              <Button
                size="small"
                startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
                onClick={fetchCustomerGrainData}
                disabled={loading}
              >
                Refresh
              </Button>
            </Box>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Grain Type</InputLabel>
                  <Select
                    name="grainType"
                    value={formData.grainType}
                    onChange={handleInputChange}
                    label="Grain Type"
                  >
                    {grainTypes.map(grain => (
                      <MenuItem key={grain.value} value={grain.value}>
                        {grain.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Number of Bags"
                  name="numberOfBags"
                  type="number"
                  value={formData.numberOfBags}
                  onChange={handleInputChange}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Grain /></InputAdornment>
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Weight per Bag (kg)"
                  name="weightPerBag"
                  type="number"
                  value={formData.weightPerBag}
                  onChange={handleInputChange}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">kg</InputAdornment>
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Market Value per Quintal"
                  name="marketValuePerQuintal"
                  type="number"
                  value={formData.marketValuePerQuintal}
                  onChange={handleInputChange}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">₹</InputAdornment>
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<Calculate />}
                  onClick={calculateLoan}
                >
                  Calculate Loan
                </Button>
              </Grid>

              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={resetCalculator}
                >
                  Reset
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Results Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <AccountBalance sx={{ mr: 1 }} />
              Loan Calculation Results
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {calculationResult ? (
              <Box>
                {/* Summary Cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6}>
                    <Card sx={{ bgcolor: 'primary.light' }}>
                      <CardContent>
                        <Typography variant="caption" sx={{ color: 'white' }}>
                          Total Grain Value
                        </Typography>
                        <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold' }}>
                          ₹{parseFloat(calculationResult.totalMarketValue).toLocaleString()}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card sx={{ bgcolor: 'success.light' }}>
                      <CardContent>
                        <Typography variant="caption" sx={{ color: 'white' }}>
                          Eligible Loan (60%)
                        </Typography>
                        <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold' }}>
                          ₹{parseFloat(calculationResult.loanAmount).toLocaleString()}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Detailed Breakdown */}
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Parameter</strong></TableCell>
                        <TableCell align="right"><strong>Value</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>Number of Bags</TableCell>
                        <TableCell align="right">{calculationResult.numberOfBags}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Weight per Bag</TableCell>
                        <TableCell align="right">{calculationResult.weightPerBag} kg</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Total Weight</TableCell>
                        <TableCell align="right">{calculationResult.totalWeightKg} kg</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Total Quintals</strong></TableCell>
                        <TableCell align="right"><strong>{calculationResult.totalQuintals}</strong></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Market Value/Quintal</TableCell>
                        <TableCell align="right">₹{calculationResult.marketValuePerQuintal}</TableCell>
                      </TableRow>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell><strong>Total Market Value</strong></TableCell>
                        <TableCell align="right"><strong>₹{parseFloat(calculationResult.totalMarketValue).toLocaleString()}</strong></TableCell>
                      </TableRow>
                      <TableRow sx={{ bgcolor: 'success.light' }}>
                        <TableCell sx={{ color: 'white' }}><strong>Loan Amount (60%)</strong></TableCell>
                        <TableCell align="right" sx={{ color: 'white' }}>
                          <strong>₹{parseFloat(calculationResult.loanAmount).toLocaleString()}</strong>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                <Divider sx={{ my: 2 }} />

                {/* EMI Details */}
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Repayment Details (12% Interest, 12 Months)
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell>Monthly EMI</TableCell>
                        <TableCell align="right"><strong>₹{parseFloat(calculationResult.monthlyEMI).toLocaleString()}</strong></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Total Interest</TableCell>
                        <TableCell align="right">₹{parseFloat(calculationResult.totalInterest).toLocaleString()}</TableCell>
                      </TableRow>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell><strong>Total Repayment</strong></TableCell>
                        <TableCell align="right"><strong>₹{parseFloat(calculationResult.totalRepayment).toLocaleString()}</strong></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <CurrencyRupee sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  Enter grain details and click "Calculate Loan" to see results
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LoanCalculator;
