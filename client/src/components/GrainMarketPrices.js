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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  MenuItem,
  Paper
} from '@mui/material';
import {
  Refresh,
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  ShowChart,
  Notifications,
  Calculate,
  Lightbulb,
  Add
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import axios from 'axios';

const GrainMarketPrices = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [marketPrices, setMarketPrices] = useState([]);
  const [myGrains, setMyGrains] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [priceAlerts, setPriceAlerts] = useState([]);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [newAlert, setNewAlert] = useState({
    grainType: 'wheat',
    targetPrice: '',
    alertType: 'above',
    notifyMethod: 'email'
  });

  const fetchMarketData = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      
      // Fetch current market prices
      const pricesResponse = await axios.get('/api/market/current-prices', {
        headers: { 'x-auth-token': token }
      });
      setMarketPrices(pricesResponse.data.prices);
      
      // Fetch my grains for profit calculation
      const grainsResponse = await axios.get('/api/warehouse/my-grains', {
        headers: { 'x-auth-token': token }
      });
      setMyGrains(grainsResponse.data);
      
      // Fetch price history
      const historyResponse = await axios.get('/api/market/price-history?days=30', {
        headers: { 'x-auth-token': token }
      });
      setPriceHistory(historyResponse.data);
      
      // Fetch my price alerts
      const alertsResponse = await axios.get('/api/market/my-alerts', {
        headers: { 'x-auth-token': token }
      });
      setPriceAlerts(alertsResponse.data);
      
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch market data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
  }, []);

  const handleRefresh = () => {
    fetchMarketData();
  };

  const handleCreateAlert = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/market/create-alert', newAlert, {
        headers: { 'x-auth-token': token }
      });
      
      setAlertDialogOpen(false);
      setNewAlert({
        grainType: 'wheat',
        targetPrice: '',
        alertType: 'above',
        notifyMethod: 'email'
      });
      fetchMarketData();
    } catch (err) {
      alert('Failed to create price alert');
    }
  };

  const handleDeleteAlert = async (alertId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/market/alerts/${alertId}`, {
        headers: { 'x-auth-token': token }
      });
      fetchMarketData();
    } catch (err) {
      alert('Failed to delete alert');
    }
  };

  const getTrendIcon = (change) => {
    if (change > 0) return <TrendingUp sx={{ color: 'success.main' }} />;
    if (change < 0) return <TrendingDown sx={{ color: 'error.main' }} />;
    return <TrendingFlat sx={{ color: 'text.secondary' }} />;
  };

  const getTrendColor = (change) => {
    if (change > 0) return 'success';
    if (change < 0) return 'error';
    return 'default';
  };

  const calculateProfitPotential = (grain) => {
    const currentPrice = marketPrices.find(p => p.type.toLowerCase() === grain.grainType?.toLowerCase());
    if (!currentPrice) return null;
    
    const totalWeight = grain.storageDetails?.totalWeight || 0;
    const storedValue = grain.storageDetails?.totalValue || 0;
    const currentMarketValue = totalWeight * currentPrice.pricePerKg;
    const potentialProfit = currentMarketValue - storedValue;
    const profitPercentage = ((potentialProfit / storedValue) * 100).toFixed(2);
    
    return {
      storedValue,
      currentMarketValue,
      potentialProfit,
      profitPercentage
    };
  };

  const getRecommendation = (grainType, change, profitPercentage) => {
    if (profitPercentage > 10 && change > 0) {
      return { action: 'SELL NOW', color: 'success', reason: 'High profit & rising prices' };
    } else if (profitPercentage > 5 && change < 0) {
      return { action: 'SELL SOON', color: 'warning', reason: 'Good profit but prices falling' };
    } else if (profitPercentage < 0 && change > 0) {
      return { action: 'HOLD', color: 'info', reason: 'Wait for better prices' };
    } else if (profitPercentage < 0 && change < 0) {
      return { action: 'HOLD & MONITOR', color: 'error', reason: 'Prices falling, may recover' };
    } else {
      return { action: 'MONITOR', color: 'default', reason: 'Market stable' };
    }
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
          <ShowChart sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Grain Market Prices
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Notifications />}
            onClick={() => setAlertDialogOpen(true)}
          >
            Set Price Alert
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Market prices updated daily. Use this data to make informed decisions about selling your stored grains.
      </Alert>

      {/* Current Prices */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Current Market Prices (per kg)
          </Typography>
          <Grid container spacing={2}>
            {marketPrices.map((price, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Paper sx={{ p: 2, border: '1px solid #e0e0e0' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" fontWeight="bold">
                      {price.type}
                    </Typography>
                    {getTrendIcon(price.change)}
                  </Box>
                  <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
                    ₹{price.pricePerKg?.toFixed(2)}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Chip 
                      label={`${price.change > 0 ? '+' : ''}${price.change?.toFixed(2)}`}
                      color={getTrendColor(price.change)}
                      size="small"
                    />
                    <Typography variant="caption" color="textSecondary">
                      vs yesterday
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Price History Chart */}
      {priceHistory.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              30-Day Price Trends
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={priceHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip />
                <Legend />
                <Line type="monotone" dataKey="wheat" stroke="#8884d8" name="Wheat" />
                <Line type="monotone" dataKey="rice" stroke="#82ca9d" name="Rice" />
                <Line type="monotone" dataKey="corn" stroke="#ffc658" name="Corn" />
                <Line type="monotone" dataKey="barley" stroke="#ff7300" name="Barley" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Profit Calculator */}
      {myGrains.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              <Calculate sx={{ verticalAlign: 'middle', mr: 1 }} />
              Your Grains - Profit Potential
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Grain Type</TableCell>
                    <TableCell align="right">Weight (kg)</TableCell>
                    <TableCell align="right">Stored Value</TableCell>
                    <TableCell align="right">Current Market Value</TableCell>
                    <TableCell align="right">Potential Profit</TableCell>
                    <TableCell align="center">Profit %</TableCell>
                    <TableCell>Recommendation</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {myGrains.map((grain, index) => {
                    const profit = calculateProfitPotential(grain);
                    if (!profit) return null;
                    
                    const grainPrice = marketPrices.find(p => p.type.toLowerCase() === grain.grainType?.toLowerCase());
                    const recommendation = getRecommendation(
                      grain.grainType,
                      grainPrice?.change || 0,
                      profit.profitPercentage
                    );
                    
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <Typography variant="body1" fontWeight="bold">
                            {grain.grainType}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {grain.storageDetails?.totalWeight?.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          ₹{profit.storedValue?.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          ₹{profit.currentMarketValue?.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          <Typography 
                            variant="body1" 
                            fontWeight="bold"
                            color={profit.potentialProfit >= 0 ? 'success.main' : 'error.main'}
                          >
                            {profit.potentialProfit >= 0 ? '+' : ''}₹{profit.potentialProfit?.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={`${profit.profitPercentage}%`}
                            color={profit.profitPercentage >= 0 ? 'success' : 'error'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title={recommendation.reason}>
                            <Chip 
                              label={recommendation.action}
                              color={recommendation.color}
                              size="small"
                              icon={<Lightbulb />}
                            />
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* My Price Alerts */}
      {priceAlerts.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              <Notifications sx={{ verticalAlign: 'middle', mr: 1 }} />
              My Price Alerts
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Grain Type</TableCell>
                    <TableCell align="right">Target Price</TableCell>
                    <TableCell>Alert Type</TableCell>
                    <TableCell>Notify Via</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {priceAlerts.map((alert, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body1" fontWeight="bold">
                          {alert.grainType}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        ₹{alert.targetPrice}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={alert.alertType === 'above' ? 'Price Above' : 'Price Below'}
                          size="small"
                          color={alert.alertType === 'above' ? 'success' : 'warning'}
                        />
                      </TableCell>
                      <TableCell>
                        {alert.notifyMethod}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={alert.isActive ? 'Active' : 'Triggered'}
                          color={alert.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Button 
                          size="small"
                          color="error"
                          onClick={() => handleDeleteAlert(alert._id)}
                        >
                          Delete
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

      {/* Create Alert Dialog */}
      <Dialog open={alertDialogOpen} onClose={() => setAlertDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Notifications />
            <Typography variant="h6">Set Price Alert</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Get notified when a grain's market price reaches your target price.
          </Alert>
          <TextField
            select
            label="Grain Type"
            value={newAlert.grainType}
            onChange={(e) => setNewAlert({ ...newAlert, grainType: e.target.value })}
            fullWidth
            sx={{ mb: 2 }}
          >
            {marketPrices.map((price) => (
              <MenuItem key={price.type} value={price.type.toLowerCase()}>
                {price.type}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Target Price (₹ per kg)"
            type="number"
            value={newAlert.targetPrice}
            onChange={(e) => setNewAlert({ ...newAlert, targetPrice: e.target.value })}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            select
            label="Alert Type"
            value={newAlert.alertType}
            onChange={(e) => setNewAlert({ ...newAlert, alertType: e.target.value })}
            fullWidth
            sx={{ mb: 2 }}
          >
            <MenuItem value="above">Price goes above target</MenuItem>
            <MenuItem value="below">Price goes below target</MenuItem>
          </TextField>
          <TextField
            select
            label="Notify Me Via"
            value={newAlert.notifyMethod}
            onChange={(e) => setNewAlert({ ...newAlert, notifyMethod: e.target.value })}
            fullWidth
          >
            <MenuItem value="email">Email</MenuItem>
            <MenuItem value="sms">SMS</MenuItem>
            <MenuItem value="both">Email & SMS</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateAlert} 
            variant="contained"
            disabled={!newAlert.targetPrice}
          >
            Create Alert
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GrainMarketPrices;
