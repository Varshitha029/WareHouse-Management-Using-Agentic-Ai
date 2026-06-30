import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  LinearProgress,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Stack,
  Collapse
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Warning,
  CheckCircle,
  Info,
  Refresh,
  ShowChart,
  MonetizationOn,
  Schedule,
  Visibility,
  AutoAwesome,
  Psychology,
  Grain,
  CalendarMonth,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import axios from 'axios';

const grainOptions = [
  'Rice', 'Wheat', 'Maize', 'Jowar', 'Bajra',
  'Cotton', 'Soybean', 'Groundnut', 'Red Gram', 'Bengal Gram',
  'Sunflower', 'Sesame', 'Paddy', 'Tur Dal', 'Chana'
];

const periodOptions = [
  { value: '1week', label: '1 Week' },
  { value: '2weeks', label: '2 Weeks' },
  { value: '1month', label: '1 Month' },
  { value: '3months', label: '3 Months' },
  { value: '6months', label: '6 Months' },
  { value: '1year', label: '1 Year' }
];

const PredictionsTab = () => {
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [marketAlerts, setMarketAlerts] = useState([]);
  const [marketPrices, setMarketPrices] = useState([]);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    profitableCount: 0,
    atRiskCount: 0
  });
  const [error, setError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailsDialog, setDetailsDialog] = useState(false);

  // AI Price Prediction state
  const [aiGrain, setAiGrain] = useState('');
  const [aiPeriod, setAiPeriod] = useState('1month');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');
  const [aiSectionExpanded, setAiSectionExpanded] = useState(true);

  useEffect(() => {
    fetchPredictions();
    fetchMarketAlerts();
    fetchMarketPrices();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      fetchPredictions();
      fetchMarketAlerts();
      fetchMarketPrices();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const fetchMarketPrices = async () => {
    try {
      const response = await axios.get('/api/market/live-prices');
      setMarketPrices(response.data.prices || []);
    } catch (err) {
      console.error('Market prices fetch error:', err);
    }
  };

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/predictions/dashboard-predictions', {
        headers: { 'x-auth-token': token }
      });
      setPredictions(response.data.predictions || []);
      setAlerts(response.data.alerts || []);
      setStats({
        totalCustomers: response.data.totalCustomers || 0,
        profitableCount: response.data.profitableCount || 0,
        atRiskCount: response.data.atRiskCount || 0
      });
      setError('');
    } catch (err) {
      setError('Failed to fetch predictions. ML service may be unavailable.');
      console.error('Predictions fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/predictions/market-alerts', {
        headers: { 'x-auth-token': token }
      });
      setMarketAlerts(response.data.alerts || []);
    } catch (err) {
      console.error('Market alerts fetch error:', err);
    }
  };

  const handleViewDetails = (customer) => {
    setSelectedCustomer(customer);
    setDetailsDialog(true);
  };

  // AI Price Prediction handler - triggers WMS Market Prediction n8n workflow
  const handleAiPredict = async (grainOverride) => {
    const grain = (typeof grainOverride === 'string' && grainOverride) ? grainOverride : aiGrain;
    if (!grain) {
      setAiError('Please select a grain type');
      return;
    }
    if (grainOverride) setAiGrain(grainOverride);
    try {
      setAiLoading(true);
      setAiError('');
      setAiResult(null);

      const token = localStorage.getItem('token');
      const response = await axios.post('/api/ai/market/predict', {
        grainType: grain,
        horizon: aiPeriod,
        action: 'predict'
      }, {
        headers: { 'x-auth-token': token }
      });

      const data = response.data?.data || response.data;
      setAiResult(data);
    } catch (err) {
      console.error('AI Market Prediction error:', err);
      setAiError(err.response?.data?.message || err.response?.data?.error || 'Failed to get AI prediction. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const getTrendIcon = (trend) => {
    if (!trend) return <TrendingFlat sx={{ fontSize: 48 }} color="info" />;
    const t = trend.toLowerCase();
    if (t === 'bullish' || t === 'up' || t === 'rising') return <TrendingUp sx={{ fontSize: 48 }} color="success" />;
    if (t === 'bearish' || t === 'down' || t === 'falling') return <TrendingDown sx={{ fontSize: 48 }} color="error" />;
    return <TrendingFlat sx={{ fontSize: 48 }} color="info" />;
  };

  const getTrendColor = (trend) => {
    if (!trend) return 'info.main';
    const t = trend.toLowerCase();
    if (t === 'bullish' || t === 'up' || t === 'rising') return 'success.main';
    if (t === 'bearish' || t === 'down' || t === 'falling') return 'error.main';
    return 'info.main';
  };

  const getTrendLabel = (trend) => {
    if (!trend) return 'Stable';
    const t = trend.toLowerCase();
    if (t === 'bullish' || t === 'up' || t === 'rising') return '📈 Price will RISE';
    if (t === 'bearish' || t === 'down' || t === 'falling') return '📉 Price will FALL';
    return '➡️ Price will remain STABLE';
  };

  const getTrendChipColor = (trend) => {
    if (!trend) return 'info';
    const t = trend.toLowerCase();
    if (t === 'bullish' || t === 'up' || t === 'rising') return 'success';
    if (t === 'bearish' || t === 'down' || t === 'falling') return 'error';
    return 'info';
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading && predictions.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShowChart /> ML Predictions & Market Intelligence
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AutoAwesome />}
            endIcon={aiSectionExpanded ? <ExpandLess /> : <ExpandMore />}
            onClick={() => setAiSectionExpanded(!aiSectionExpanded)}
            sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            AI Price Prediction
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => {
              fetchPredictions();
              fetchMarketAlerts();
            }}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* AI Price Prediction Inline Panel */}
      <Collapse in={aiSectionExpanded} timeout="auto">
        <Paper sx={{ p: 3, mb: 4, border: '2px solid', borderColor: 'primary.main', borderRadius: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Psychology sx={{ fontSize: 28, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight="bold">AI Grain Price Forecast</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a grain type and time period to get an AI-powered prediction on whether the price will rise or fall.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              select
              fullWidth
              label="Grain Type"
              value={aiGrain}
              onChange={(e) => { setAiGrain(e.target.value); setAiResult(null); }}
              InputProps={{
                startAdornment: <Grain sx={{ mr: 1, color: 'action.active' }} />
              }}
            >
              {grainOptions.map((g) => (
                <MenuItem key={g} value={g}>{g}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              label="Prediction Period"
              value={aiPeriod}
              onChange={(e) => { setAiPeriod(e.target.value); setAiResult(null); }}
              InputProps={{
                startAdornment: <CalendarMonth sx={{ mr: 1, color: 'action.active' }} />
              }}
            >
              {periodOptions.map((p) => (
                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
              ))}
            </TextField>
          </Stack>

          <Button
            variant="contained"
            fullWidth
            onClick={() => handleAiPredict()}
            disabled={aiLoading || !aiGrain}
            startIcon={aiLoading ? <CircularProgress size={20} color="inherit" /> : <AutoAwesome />}
            sx={{
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4299 100%)' },
              '&:disabled': { background: '#ccc' }
            }}
          >
            {aiLoading ? 'Analyzing Market Data...' : `Predict ${aiGrain || 'Grain'} Price`}
          </Button>

          {aiError && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setAiError('')}>
              {aiError}
            </Alert>
          )}

          {/* AI Prediction Results */}
          {aiResult && (() => {
            const predictions = aiResult.predictions || [aiResult];
            const pred = predictions[0] || {};
            const predictedPrices = pred.predicted_prices || {};
            const factors = pred.factors || aiResult.key_factors || [];
            const trend = pred.trend || aiResult.trend || 'stable';
            const confidence = pred.confidence || aiResult.confidence || 0;
            const marketSummary = aiResult.market_summary || '';
            const bestTimeToSell = aiResult.best_time_to_sell || {};
            const alerts = aiResult.alerts || [];

            return (
              <Box sx={{ mt: 2 }}>
                {/* Main Trend Card */}
                <Paper
                  elevation={3}
                  sx={{
                    p: 3,
                    mb: 2,
                    background: trend.toLowerCase().includes('bull') || trend.toLowerCase() === 'up' || trend.toLowerCase() === 'rising'
                      ? 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)'
                      : trend.toLowerCase().includes('bear') || trend.toLowerCase() === 'down' || trend.toLowerCase() === 'falling'
                        ? 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)'
                        : 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                    borderRadius: 3
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {getTrendIcon(trend)}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h5" fontWeight="bold" color={getTrendColor(trend)}>
                        {getTrendLabel(trend)}
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 0.5 }}>
                        <strong>{pred.grain || aiGrain}</strong> — next {periodOptions.find(p => p.value === aiPeriod)?.label || aiPeriod}
                      </Typography>
                    </Box>
                    <Chip
                      label={`${confidence}% confidence`}
                      color={getTrendChipColor(trend)}
                      sx={{ fontWeight: 'bold', fontSize: '0.9rem', py: 0.5 }}
                    />
                  </Box>
                </Paper>

                {/* Price Predictions */}
                {Object.keys(predictedPrices).length > 0 && (
                  <Paper sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      💰 Price Forecast
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                      {pred.current_price && (
                        <Paper sx={{ p: 1.5, minWidth: 120, textAlign: 'center', bgcolor: 'grey.100' }}>
                          <Typography variant="caption" color="text.secondary">Current</Typography>
                          <Typography variant="h6" fontWeight="bold">₹{pred.current_price?.toLocaleString('en-IN')}</Typography>
                        </Paper>
                      )}
                      {predictedPrices.one_week && (
                        <Paper sx={{ p: 1.5, minWidth: 120, textAlign: 'center', bgcolor: 'primary.50' }}>
                          <Typography variant="caption" color="text.secondary">1 Week</Typography>
                          <Typography variant="h6" fontWeight="bold" color="primary.main">
                            ₹{predictedPrices.one_week?.toLocaleString('en-IN')}
                          </Typography>
                        </Paper>
                      )}
                      {predictedPrices.one_month && (
                        <Paper sx={{ p: 1.5, minWidth: 120, textAlign: 'center', bgcolor: 'info.50' }}>
                          <Typography variant="caption" color="text.secondary">1 Month</Typography>
                          <Typography variant="h6" fontWeight="bold" color="info.main">
                            ₹{predictedPrices.one_month?.toLocaleString('en-IN')}
                          </Typography>
                        </Paper>
                      )}
                      {predictedPrices.three_months && (
                        <Paper sx={{ p: 1.5, minWidth: 120, textAlign: 'center', bgcolor: 'warning.50' }}>
                          <Typography variant="caption" color="text.secondary">3 Months</Typography>
                          <Typography variant="h6" fontWeight="bold" color="warning.main">
                            ₹{predictedPrices.three_months?.toLocaleString('en-IN')}
                          </Typography>
                        </Paper>
                      )}
                      {predictedPrices.six_months && (
                        <Paper sx={{ p: 1.5, minWidth: 120, textAlign: 'center', bgcolor: 'secondary.50' }}>
                          <Typography variant="caption" color="text.secondary">6 Months</Typography>
                          <Typography variant="h6" fontWeight="bold" color="secondary.main">
                            ₹{predictedPrices.six_months?.toLocaleString('en-IN')}
                          </Typography>
                        </Paper>
                      )}
                    </Stack>
                  </Paper>
                )}

                {/* Key Factors */}
                {factors.length > 0 && (
                  <Paper sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      🔍 Key Factors
                    </Typography>
                    <Stack spacing={1}>
                      {factors.map((factor, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <Typography variant="body2" color="primary.main" fontWeight="bold">•</Typography>
                          <Typography variant="body2">{factor}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                )}

                {/* Market Summary */}
                {marketSummary && (
                  <Alert severity="info" sx={{ mb: 2 }} icon={<Psychology />}>
                    <Typography variant="subtitle2" fontWeight="bold">Market Summary</Typography>
                    <Typography variant="body2">{marketSummary}</Typography>
                  </Alert>
                )}

                {/* Best Time to Sell */}
                {bestTimeToSell && Object.keys(bestTimeToSell).length > 0 && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold">💡 Best Time to Sell</Typography>
                    {typeof bestTimeToSell === 'string' ? (
                      <Typography variant="body2">{bestTimeToSell}</Typography>
                    ) : (
                      Object.entries(bestTimeToSell).map(([key, value]) => (
                        <Typography variant="body2" key={key}>
                          <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : value}
                        </Typography>
                      ))
                    )}
                  </Alert>
                )}

                {/* Alerts */}
                {alerts.length > 0 && (
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      ⚠️ Alerts
                    </Typography>
                    {alerts.map((alert, idx) => (
                      <Alert key={idx} severity="warning" sx={{ mb: idx < alerts.length - 1 ? 1 : 0 }}>
                        {alert}
                      </Alert>
                    ))}
                  </Paper>
                )}
              </Box>
            );
          })()}
        </Paper>
      </Collapse>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" fontWeight="bold">
                    {stats.totalCustomers}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Active Storage Customers
                  </Typography>
                </Box>
                <Info sx={{ fontSize: 50, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" fontWeight="bold">
                    {stats.profitableCount}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Profitable Customers
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(stats.profitableCount / stats.totalCustomers) * 100 || 0}
                    sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.3)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }}
                  />
                </Box>
                <CheckCircle sx={{ fontSize: 50, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" fontWeight="bold">
                    {stats.atRiskCount}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    At-Risk Customers
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(stats.atRiskCount / stats.totalCustomers) * 100 || 0}
                    sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.3)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }}
                  />
                </Box>
                <Warning sx={{ fontSize: 50, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Live Market Prices */}
      {marketPrices.length > 0 && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MonetizationOn /> Live Market Prices
            </Typography>
            <Chip
              icon={<Schedule />}
              label="Auto-refresh every 5 min"
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Grain Type</strong></TableCell>
                  <TableCell align="right"><strong>Current Price</strong></TableCell>
                  <TableCell align="right"><strong>Change</strong></TableCell>
                  <TableCell align="right"><strong>Trend</strong></TableCell>
                  <TableCell align="right"><strong>Last Updated</strong></TableCell>
                  <TableCell align="center"><strong>AI Forecast</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {marketPrices.map((price, index) => {
                  const priceChange = price.previousPrice 
                    ? ((price.currentPrice - price.previousPrice) / price.previousPrice * 100).toFixed(2)
                    : 0;
                  const isPositive = priceChange > 0;
                  
                  return (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Typography fontWeight="600">{price.grainType || price.name}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="primary">
                          ₹{price.currentPrice?.toFixed(2) || price.price?.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={`${isPositive ? '+' : ''}${priceChange}%`}
                          color={isPositive ? 'success' : priceChange < 0 ? 'error' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {isPositive ? (
                          <TrendingUp color="success" />
                        ) : priceChange < 0 ? (
                          <TrendingDown color="error" />
                        ) : (
                          <span>—</span>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" color="text.secondary">
                          {price.lastUpdated 
                            ? new Date(price.lastUpdated).toLocaleTimeString('en-IN')
                            : new Date().toLocaleTimeString('en-IN')}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Psychology />}
                          onClick={() => {
                            setAiSectionExpanded(true);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            const grainName = typeof price.grainType === 'string' ? price.grainType : (typeof price.name === 'string' ? price.name : String(price.grainType || price.name));
                            handleAiPredict(grainName);
                          }}
                        >
                          Predict
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Market Alerts */}
      {marketAlerts.length > 0 && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp /> Market Trends & Alerts
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {marketAlerts.map((alert, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Alert
                  severity={getSeverityColor(alert.severity)}
                  icon={alert.priceChange > 0 ? <TrendingUp /> : <TrendingDown />}
                >
                  <Typography variant="subtitle2" fontWeight="bold">
                    {alert.title}
                  </Typography>
                  <Typography variant="body2" component="div">{alert.message}</Typography>
                  <Chip
                    label={`${alert.priceChange > 0 ? '+' : ''}${alert.priceChange}%`}
                    size="small"
                    color={alert.priceChange > 0 ? 'success' : 'error'}
                    sx={{ mt: 1 }}
                  />
                </Alert>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Critical Alerts */}
      {alerts.length > 0 && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning /> Critical Alerts ({alerts.length})
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {alerts.slice(0, 6).map((alert, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Alert severity={getSeverityColor(alert.severity)}>
                  <Typography variant="subtitle2" fontWeight="bold" component="div">
                    {alert.title}
                  </Typography>
                  <Typography variant="body2" component="div">{alert.message}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }} component="div">
                    Customer: {alert.customerName}
                  </Typography>
                </Alert>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Predictions Table */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MonetizationOn /> Customer Predictions
        </Typography>
        <Divider sx={{ my: 2 }} />
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Grain Type</TableCell>
                <TableCell align="right">Bags / Weight</TableCell>
                <TableCell align="right">Storage Days</TableCell>
                <TableCell align="right">Predicted Price</TableCell>
                <TableCell align="right">Profit/Loss</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {predictions.map((pred) => (
                <TableRow key={pred.customerId} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {pred.customerName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {pred.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={pred.grainType} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {pred.totalBags} bags
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {pred.totalWeight} kg
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Days in storage">
                      <Chip
                        icon={<Schedule />}
                        label={`${pred.storageDuration}d`}
                        size="small"
                        color={pred.storageDuration > 180 ? 'warning' : 'default'}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold" color="primary">
                      {formatCurrency(pred.predictedPrice * pred.totalWeight)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ₹{pred.predictedPrice.toFixed(2)}/kg
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      fontWeight="bold"
                      color={pred.isProfitable ? 'success.main' : 'error.main'}
                    >
                      {pred.isProfitable ? '+' : ''}{formatCurrency(pred.profitLoss)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {pred.isProfitable ? (
                      <Chip
                        icon={<CheckCircle />}
                        label="Profitable"
                        color="success"
                        size="small"
                      />
                    ) : (
                      <Chip
                        icon={<Warning />}
                        label="At Risk"
                        color="error"
                        size="small"
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetails(pred)}
                        color="primary"
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {predictions.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <ShowChart sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No predictions available
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Predictions will appear once customers have active storage allocations
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Details Dialog */}
      <Dialog open={detailsDialog} onClose={() => setDetailsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Customer Prediction Details
        </DialogTitle>
        <DialogContent dividers>
          {selectedCustomer && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  {selectedCustomer.customerName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedCustomer.email}
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'primary.50' }}>
                  <Typography variant="caption" color="text.secondary">Grain Type</Typography>
                  <Typography variant="h6">{selectedCustomer.grainType}</Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'secondary.50' }}>
                  <Typography variant="caption" color="text.secondary">Total Storage</Typography>
                  <Typography variant="h6">
                    {selectedCustomer.totalBags} bags / {selectedCustomer.totalWeight} kg
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'warning.50' }}>
                  <Typography variant="caption" color="text.secondary">Storage Duration</Typography>
                  <Typography variant="h6">{selectedCustomer.storageDuration} days</Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'info.50' }}>
                  <Typography variant="caption" color="text.secondary">Total Rent Paid</Typography>
                  <Typography variant="h6">{formatCurrency(selectedCustomer.totalRentPaid)}</Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'success.50' }}>
                  <Typography variant="caption" color="text.secondary">Predicted Sale Price</Typography>
                  <Typography variant="h6" color="success.main">
                    {formatCurrency(selectedCustomer.predictedPrice * selectedCustomer.totalWeight)}
                  </Typography>
                  <Typography variant="caption">
                    ₹{selectedCustomer.predictedPrice.toFixed(2)} per kg
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: selectedCustomer.isProfitable ? 'success.50' : 'error.50' }}>
                  <Typography variant="caption" color="text.secondary">Expected Profit/Loss</Typography>
                  <Typography
                    variant="h6"
                    color={selectedCustomer.isProfitable ? 'success.main' : 'error.main'}
                  >
                    {selectedCustomer.isProfitable ? '+' : ''}{formatCurrency(selectedCustomer.profitLoss)}
                  </Typography>
                  <Typography variant="caption">
                    {selectedCustomer.isProfitable ? 'Profitable' : 'At Risk'}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Alert severity={selectedCustomer.isProfitable ? 'success' : 'warning'}>
                  <Typography variant="subtitle2" fontWeight="bold" component="div">
                    {selectedCustomer.isProfitable ? 'Recommendation: Good Position' : 'Recommendation: Monitor Closely'}
                  </Typography>
                  <Typography variant="body2" component="div">
                    {selectedCustomer.isProfitable
                      ? 'This customer is in a profitable position. Market conditions are favorable.'
                      : 'This customer may incur losses. Consider advising them on optimal sale timing or market trends.'}
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PredictionsTab;
