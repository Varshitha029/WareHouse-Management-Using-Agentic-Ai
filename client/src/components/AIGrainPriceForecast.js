import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Typography,
  CircularProgress,
  Paper,
  Chip,
  Divider,
  Alert,
  Stack,
  IconButton
} from '@mui/material';
import {
  Psychology,
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Close,
  AutoAwesome,
  CalendarMonth,
  Grain
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

const AIGrainPriceForecast = ({ defaultGrain, buttonVariant = 'contained', buttonSize = 'medium', buttonText }) => {
  const [open, setOpen] = useState(false);
  const [grain, setGrain] = useState(defaultGrain || '');
  const [period, setPeriod] = useState('1month');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const formatInsightItem = (item) => {
    if (item === null || item === undefined) return '';
    if (typeof item === 'string' || typeof item === 'number') return String(item);
    if (typeof item === 'object') {
      if (item.factor || item.description) {
        const factorText = item.factor ? String(item.factor) : '';
        const descriptionText = item.description ? String(item.description) : '';
        const severityText = item.severity ? ` (${String(item.severity)})` : '';
        return `${factorText}${severityText}${factorText && descriptionText ? ': ' : ''}${descriptionText}`.trim();
      }
      return JSON.stringify(item);
    }
    return String(item);
  };

  const handleOpen = () => {
    setOpen(true);
    setResult(null);
    setError('');
    if (defaultGrain) setGrain(defaultGrain);
  };

  const handleClose = () => {
    setOpen(false);
    setResult(null);
    setError('');
  };

  const handlePredict = async () => {
    if (!grain) {
      setError('Please select a grain type');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setResult(null);

      const response = await axios.post('/api/ai/market/predict', {
        grainType: grain,
        horizon: period,
        action: 'predict'
      });

      const data = response.data?.data || response.data;
      setResult(data);
    } catch (err) {
      console.error('AI prediction error:', err);
      setError(err.response?.data?.message || 'Failed to get AI prediction. Please try again.');
    } finally {
      setLoading(false);
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

  const renderPredictionResult = () => {
    if (!result) return null;

    // Handle both direct prediction object and array of predictions
    const predictions = result.predictions || [result];
    const pred = predictions[0] || {};
    const predictedPrices = pred.predicted_prices || {};
    const factors = pred.factors || result.key_factors || [];
    const trend = pred.trend || result.trend || 'stable';
    const confidence = pred.confidence || result.confidence || 0;
    const marketSummary = result.market_summary || '';
    const bestTimeToSell = result.best_time_to_sell || {};
    const alerts = result.alerts || [];

    return (
      <Box sx={{ mt: 2 }}>
        {/* Main Trend Card */}
        <Paper
          elevation={3}
          sx={{
            p: 3,
            mb: 2,
            background: trend.toLowerCase().includes('bull') || trend.toLowerCase() === 'up'
              ? 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)'
              : trend.toLowerCase().includes('bear') || trend.toLowerCase() === 'down'
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
                <strong>{pred.grain || grain}</strong> — next {periodOptions.find(p => p.value === period)?.label || period}
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
                  <Typography variant="body2">{formatInsightItem(factor)}</Typography>
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
                {formatInsightItem(alert)}
              </Alert>
            ))}
          </Paper>
        )}
      </Box>
    );
  };

  return (
    <>
      <Button
        variant={buttonVariant}
        size={buttonSize}
        onClick={handleOpen}
        startIcon={<AutoAwesome />}
        sx={{
          background: buttonVariant === 'contained' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : undefined,
          color: buttonVariant === 'contained' ? 'white' : undefined,
          fontWeight: 'bold',
          borderRadius: 2,
          px: 3,
          '&:hover': {
            background: buttonVariant === 'contained' ? 'linear-gradient(135deg, #5a6fd6 0%, #6a4299 100%)' : undefined,
          }
        }}
      >
        {buttonText || 'AI Price Prediction'}
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Psychology sx={{ fontSize: 28 }} />
            <Typography variant="h6" fontWeight="bold">AI Grain Price Forecast</Typography>
          </Box>
          <IconButton onClick={handleClose} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select a grain type and time period to get an AI-powered prediction on whether the price will rise or fall.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              select
              fullWidth
              label="Grain Type"
              value={grain}
              onChange={(e) => { setGrain(e.target.value); setResult(null); }}
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
              value={period}
              onChange={(e) => { setPeriod(e.target.value); setResult(null); }}
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
            onClick={handlePredict}
            disabled={loading || !grain}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <AutoAwesome />}
            sx={{
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4299 100%)' },
              '&:disabled': { background: '#ccc' }
            }}
          >
            {loading ? 'Analyzing Market Data...' : `Predict ${grain || 'Grain'} Price`}
          </Button>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {renderPredictionResult()}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AIGrainPriceForecast;
