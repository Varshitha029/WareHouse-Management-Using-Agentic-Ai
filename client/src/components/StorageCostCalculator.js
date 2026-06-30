import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  MenuItem,
  Button,
  Paper,
  Alert,
  Divider,
  Slider,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from '@mui/material';
import {
  Calculate,
  Refresh,
  TrendingUp,
  SaveAlt,
  Info
} from '@mui/icons-material';
import axios from 'axios';

const StorageCostCalculator = () => {
  const [grainType, setGrainType] = useState('wheat');
  const [weight, setWeight] = useState(500);
  const [duration, setDuration] = useState(90);
  const [storageType, setStorageType] = useState('dry');
  const [calculating, setCalculating] = useState(false);
  const [costBreakdown, setCostBreakdown] = useState(null);
  const [pricingRates, setPricingRates] = useState(null);
  const [error, setError] = useState(null);

  const grainTypes = [
    { value: 'wheat', label: 'Wheat' },
    { value: 'rice', label: 'Rice' },
    { value: 'corn', label: 'Corn' },
    { value: 'barley', label: 'Barley' },
    { value: 'soybean', label: 'Soybean' },
    { value: 'pulses', label: 'Pulses' }
  ];

  const storageTypes = [
    { value: 'dry', label: 'Dry Storage', multiplier: 1.0 },
    { value: 'cold', label: 'Cold Storage', multiplier: 1.5 },
    { value: 'humidity', label: 'Humidity-Controlled', multiplier: 1.3 },
    { value: 'frozen', label: 'Frozen Storage', multiplier: 2.0 }
  ];

  useEffect(() => {
    fetchPricingRates();
  }, []);

  const fetchPricingRates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/warehouse/pricing-rates', {
        headers: { 'x-auth-token': token }
      });
      setPricingRates(response.data);
    } catch (err) {
      console.error('Failed to fetch pricing rates:', err);
      // Set default rates if API fails
      setPricingRates({
        baseRate: 1000,
        ratePerDay: 10,
        ratePerKg: 2,
        minimumCharge: 5000
      });
    }
  };

  const calculateCost = async () => {
    setCalculating(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/warehouse/calculate-cost', {
        grainType,
        weight,
        duration,
        storageType
      }, {
        headers: { 'x-auth-token': token }
      });
      
      setCostBreakdown(response.data);
    } catch (err) {
      // If API fails, calculate locally
      const storageTypeObj = storageTypes.find(st => st.value === storageType);
      const multiplier = storageTypeObj?.multiplier || 1.0;
      
      const baseCharge = pricingRates?.baseRate || 1000;
      const dailyCharge = (pricingRates?.ratePerDay || 10) * duration;
      const weightCharge = (pricingRates?.ratePerKg || 2) * weight;
      const subtotal = (baseCharge + dailyCharge + weightCharge) * multiplier;
      
      // Calculate different durations
      const calculations = {
        baseCharge,
        dailyCharge,
        weightCharge,
        storageTypeMultiplier: multiplier,
        subtotal,
        total: Math.max(subtotal, pricingRates?.minimumCharge || 5000),
        projections: {
          oneMonth: calculateForDuration(30, multiplier),
          threeMonths: calculateForDuration(90, multiplier),
          sixMonths: calculateForDuration(180, multiplier),
          oneYear: calculateForDuration(365, multiplier)
        },
        advancePaymentDiscounts: [
          { duration: '3 months', discount: 5, savings: subtotal * 0.05 },
          { duration: '6 months', discount: 10, savings: subtotal * 0.10 },
          { duration: '1 year', discount: 15, savings: subtotal * 0.15 }
        ]
      };
      
      setCostBreakdown(calculations);
    } finally {
      setCalculating(false);
    }
  };

  const calculateForDuration = (days, multiplier) => {
    const baseCharge = pricingRates?.baseRate || 1000;
    const dailyCharge = (pricingRates?.ratePerDay || 10) * days;
    const weightCharge = (pricingRates?.ratePerKg || 2) * weight;
    const subtotal = (baseCharge + dailyCharge + weightCharge) * multiplier;
    return Math.max(subtotal, pricingRates?.minimumCharge || 5000);
  };

  const handleReset = () => {
    setGrainType('wheat');
    setWeight(500);
    setDuration(90);
    setStorageType('dry');
    setCostBreakdown(null);
    setError(null);
  };

  const getStorageTypeDescription = (type) => {
    switch (type) {
      case 'dry':
        return 'Standard dry storage for grains with good shelf life';
      case 'cold':
        return 'Temperature-controlled storage for better preservation';
      case 'humidity':
        return 'Humidity-controlled for moisture-sensitive grains';
      case 'frozen':
        return 'Frozen storage for maximum shelf life';
      default:
        return '';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Calculate sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Storage Cost Calculator
          </Typography>
        </Box>
        <Tooltip title="Reset">
          <IconButton onClick={handleReset}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Calculate estimated storage costs based on grain type, weight, duration, and storage type. 
          Get projections for different periods and explore advance payment discounts.
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Storage Parameters
              </Typography>

              {/* Grain Type */}
              <TextField
                select
                label="Grain Type"
                value={grainType}
                onChange={(e) => setGrainType(e.target.value)}
                fullWidth
                sx={{ mb: 3 }}
              >
                {grainTypes.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>

              {/* Weight */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
                  Weight (kg): {weight}
                </Typography>
                <Slider
                  value={weight}
                  onChange={(e, newValue) => setWeight(newValue)}
                  min={100}
                  max={10000}
                  step={50}
                  marks={[
                    { value: 100, label: '100 kg' },
                    { value: 5000, label: '5,000 kg' },
                    { value: 10000, label: '10,000 kg' }
                  ]}
                  valueLabelDisplay="auto"
                />
                <TextField
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(parseInt(e.target.value) || 0)}
                  fullWidth
                  size="small"
                  InputProps={{ inputProps: { min: 100, max: 10000 } }}
                />
              </Box>

              {/* Duration */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
                  Duration (days): {duration}
                </Typography>
                <Slider
                  value={duration}
                  onChange={(e, newValue) => setDuration(newValue)}
                  min={7}
                  max={365}
                  step={1}
                  marks={[
                    { value: 7, label: '1 week' },
                    { value: 30, label: '1 month' },
                    { value: 90, label: '3 months' },
                    { value: 180, label: '6 months' },
                    { value: 365, label: '1 year' }
                  ]}
                  valueLabelDisplay="auto"
                />
                <TextField
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                  fullWidth
                  size="small"
                  InputProps={{ inputProps: { min: 7, max: 365 } }}
                />
              </Box>

              {/* Storage Type */}
              <TextField
                select
                label="Storage Type"
                value={storageType}
                onChange={(e) => setStorageType(e.target.value)}
                fullWidth
                helperText={getStorageTypeDescription(storageType)}
                sx={{ mb: 3 }}
              >
                {storageTypes.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label} (×{option.multiplier})
                  </MenuItem>
                ))}
              </TextField>

              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={calculateCost}
                disabled={calculating}
                startIcon={<Calculate />}
              >
                {calculating ? 'Calculating...' : 'Calculate Cost'}
              </Button>
            </CardContent>
          </Card>

          {/* Pricing Rates Info */}
          {pricingRates && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight="bold">
                  <Info fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Current Pricing Rates
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell>Base Rate</TableCell>
                        <TableCell align="right">₹{pricingRates.baseRate}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Rate per Day</TableCell>
                        <TableCell align="right">₹{pricingRates.ratePerDay}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Rate per Kg</TableCell>
                        <TableCell align="right">₹{pricingRates.ratePerKg}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Minimum Charge</TableCell>
                        <TableCell align="right">₹{pricingRates.minimumCharge}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Results Section */}
        <Grid item xs={12} md={7}>
          {costBreakdown ? (
            <Box>
              {/* Cost Breakdown */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Cost Breakdown
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell>Base Charge</TableCell>
                          <TableCell align="right">₹{costBreakdown.baseCharge?.toLocaleString()}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Daily Charge ({duration} days)</TableCell>
                          <TableCell align="right">₹{costBreakdown.dailyCharge?.toLocaleString()}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Weight Charge ({weight} kg)</TableCell>
                          <TableCell align="right">₹{costBreakdown.weightCharge?.toLocaleString()}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Storage Type Multiplier</TableCell>
                          <TableCell align="right">×{costBreakdown.storageTypeMultiplier}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Subtotal</strong></TableCell>
                          <TableCell align="right">
                            <strong>₹{costBreakdown.subtotal?.toLocaleString()}</strong>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={2}>
                            <Divider />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>
                            <Typography variant="h6" fontWeight="bold">
                              Total Cost
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="h6" fontWeight="bold" color="primary">
                              ₹{costBreakdown.total?.toLocaleString()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              {/* Cost Projections */}
              {costBreakdown.projections && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom fontWeight="bold">
                      <TrendingUp sx={{ verticalAlign: 'middle', mr: 1 }} />
                      Cost Projections
                    </Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Duration</TableCell>
                            <TableCell align="right">Estimated Cost</TableCell>
                            <TableCell align="right">Per Day</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>1 Month (30 days)</TableCell>
                            <TableCell align="right">₹{costBreakdown.projections.oneMonth?.toLocaleString()}</TableCell>
                            <TableCell align="right">₹{(costBreakdown.projections.oneMonth / 30).toFixed(2)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>3 Months (90 days)</TableCell>
                            <TableCell align="right">₹{costBreakdown.projections.threeMonths?.toLocaleString()}</TableCell>
                            <TableCell align="right">₹{(costBreakdown.projections.threeMonths / 90).toFixed(2)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>6 Months (180 days)</TableCell>
                            <TableCell align="right">₹{costBreakdown.projections.sixMonths?.toLocaleString()}</TableCell>
                            <TableCell align="right">₹{(costBreakdown.projections.sixMonths / 180).toFixed(2)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>1 Year (365 days)</TableCell>
                            <TableCell align="right">₹{costBreakdown.projections.oneYear?.toLocaleString()}</TableCell>
                            <TableCell align="right">₹{(costBreakdown.projections.oneYear / 365).toFixed(2)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              )}

              {/* Advance Payment Discounts */}
              {costBreakdown.advancePaymentDiscounts && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom fontWeight="bold">
                      <SaveAlt sx={{ verticalAlign: 'middle', mr: 1 }} />
                      Advance Payment Discounts
                    </Typography>
                    <Alert severity="success" sx={{ mb: 2 }}>
                      Save money by paying in advance! The longer the commitment, the bigger the savings.
                    </Alert>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Duration</TableCell>
                            <TableCell align="center">Discount</TableCell>
                            <TableCell align="right">You Save</TableCell>
                            <TableCell align="right">Final Cost</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {costBreakdown.advancePaymentDiscounts.map((discount, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Chip label={discount.duration} color="primary" size="small" />
                              </TableCell>
                              <TableCell align="center">
                                <Chip label={`${discount.discount}%`} color="success" size="small" />
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body1" color="success.main" fontWeight="bold">
                                  ₹{discount.savings?.toLocaleString()}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body1" fontWeight="bold">
                                  ₹{(costBreakdown.total - discount.savings)?.toLocaleString()}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              )}
            </Box>
          ) : (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 8 }}>
                <Calculate sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="textSecondary">
                  Enter your storage parameters and click "Calculate Cost" to see the results
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default StorageCostCalculator;
