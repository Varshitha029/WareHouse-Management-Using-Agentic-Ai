import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Button,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  IconButton,
  LinearProgress
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  ShowChart,
  Refresh,
  Info,
  CalendarToday,
  CurrencyRupee,
  Speed
} from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from '../i18n/LanguageContext';
import AIPricePredictions from './AIPricePredictions';
import AIGrainPriceForecast from './AIGrainPriceForecast';

const CustomerMarketPricesAndPredictions = () => {
  const { t } = useTranslation();
  const [marketPrices, setMarketPrices] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [customerGrains, setCustomerGrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const [aiPredictions, setAiPredictions] = useState({});
  const [aiPredictionsLoading, setAiPredictionsLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selectedGrain, setSelectedGrain] = useState('Rice');

  useEffect(() => {
    fetchMarketData();
    fetchCustomerGrains();
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      fetchMarketData();
      fetchCustomerGrains();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchMarketData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await axios.get('/api/market/live-prices');
      setMarketPrices(response.data.prices || []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching market prices:', err);
      setError(err.response?.data?.message || t('market.errorFetchingPrices'));
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerGrains = async () => {
    try {
      const response = await axios.get('/api/warehouse/allocations/my-locations');
      const allocations = response.data.allocations || [];
      
      // Extract grain types from allocations
      const grains = [];
      allocations.forEach(allocation => {
        // Check allocation object for grain data
        if (allocation.allocation && allocation.allocation.grainType && allocation.allocation.weight) {
          const grainType = allocation.allocation.grainType;
          const weightKg = allocation.allocation.weight;
          const entryDate = allocation.duration?.startDate || allocation.createdAt;
          
          // Check if grain already exists in array
          const existingGrain = grains.find(g => g.name === grainType);
          
          if (existingGrain) {
            // Add to existing grain
            existingGrain.weight += weightKg;
            existingGrain.quantity += 1; // Count allocations
          } else {
            // Add new grain
            grains.push({
              name: grainType,
              weight: weightKg,
              quantity: 1,
              entryDate: entryDate,
              currentValue: (weightKg / 100) * 3200 // Estimated value: weight in quintals * price
            });
          }
        }
      });
      
      setCustomerGrains(grains);
      
      // Set selected grain to first grain if available
      if (grains.length > 0 && !selectedGrain) {
        setSelectedGrain(grains[0].name);
      }
    } catch (err) {
      console.error('Error fetching customer grains:', err);
    }
  };

  const fetchPredictions = async () => {
    try {
      setAiPredictionsLoading(true);
      setError('');
      if (!customerGrains.length) {
        setAiPredictions({});
        return;
      }

      const grainPricePayload = customerGrains.map((grain) => ({
        type: grain.name,
        weight: grain.weight || 0,
        storageDuration: calculateStorageDays(grain.entryDate)
      }));

      const [priceResponse, durationResults] = await Promise.all([
        axios.post('/api/predictions/grain-prices', { grains: grainPricePayload }),
        Promise.all(customerGrains.map(async (grain) => {
          try {
            const durationResponse = await axios.post('/api/ai/predict-duration', {
              grain_type: grain.name,
              total_bags: Math.max(Number(grain.quantity) || 1, 1),
              total_weight_kg: Math.max(Number(grain.weight) || 100, 100),
              monthly_rent_per_bag: 50
            });
            return { grain: grain.name, data: durationResponse.data };
          } catch (durationErr) {
            return { grain: grain.name, data: null };
          }
        }))
      ]);

      const priceByGrain = {};
      (priceResponse.data?.predictions || []).forEach((item) => {
        priceByGrain[String(item.grainType || '').toLowerCase()] = item;
      });

      const durationByGrain = {};
      durationResults.forEach((item) => {
        durationByGrain[String(item.grain || '').toLowerCase()] = item.data?.success ? item.data.prediction : null;
      });

      const mergedPredictions = {};
      customerGrains.forEach((grain) => {
        const key = String(grain.name || '').toLowerCase();
        const priceData = priceByGrain[key] || {};
        const durationData = durationByGrain[key] || {};
        const optimalMonths = Number(durationData?.optimal_months || durationData?.optimalMonths || 0);

        mergedPredictions[key] = {
          success: true,
          price: {
            predicted_category:
              Number(priceData.priceChange) > 5 ? 'High' : Number(priceData.priceChange) < -5 ? 'Low' : 'Medium',
            confidence: Number(priceData.confidence) || 0
          },
          profit: {
            predicted_category: Number(priceData.priceChange) >= 0 ? 'Profit' : 'Loss',
            confidence: Number(priceData.confidence) || 0
          },
          duration: {
            predicted_category:
              optimalMonths > 6 ? 'Long-term' : optimalMonths >= 3 ? 'Medium-term' : optimalMonths > 0 ? 'Short-term' : 'N/A',
            confidence: Math.min(Math.max((Number(durationData?.confidence_percent || durationData?.confidencePercent || 0) / 100), 0), 1)
          }
        };
      });

      setAiPredictions(mergedPredictions);
    } catch (err) {
      console.error('Error fetching AI predictions:', err);
      setError(err.response?.data?.message || t('market.errorFetchingPredictions') || 'Failed to fetch AI predictions');
      setAiPredictions({});
    } finally {
      setAiPredictionsLoading(false);
    }
  };

  const calculateStorageDays = (entryDate) => {
    if (!entryDate) return 0;
    const today = new Date();
    const entry = new Date(entryDate);
    const diffTime = Math.abs(today - entry);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPriceChange = (current, previous) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous * 100).toFixed(2);
  };

  const getPriceTrend = (change) => {
    if (change > 0) return 'up';
    if (change < 0) return 'down';
    return 'stable';
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRecommendationColor = (recommendation) => {
    const colors = {
      'sell_now': 'success',
      'hold': 'warning',
      'wait': 'info'
    };
    return colors[recommendation] || 'default';
  };

  const getRecommendationLabel = (recommendation) => {
    const labels = {
      'sell_now': t('market.sellNow'),
      'hold': t('market.hold'),
      'wait': t('market.wait')
    };
    return labels[recommendation] || recommendation;
  };

  const hasAiColumns = Object.keys(aiPredictions).length > 0;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box display="flex" alignItems="center" gap={2}>
          <ShowChart sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" fontWeight="bold">
              {t('market.title')}
            </Typography>
            {lastUpdate && (
              <Typography variant="caption" color="text.secondary">
                {t('market.lastUpdated')}: {formatDate(lastUpdate)}
              </Typography>
            )}
          </Box>
        </Box>
        <Stack direction="row" spacing={2}>
          <AIGrainPriceForecast
            defaultGrain={selectedGrain || 'Rice'}
            buttonVariant="contained"
            buttonSize="medium"
          />
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchMarketData}
            disabled={loading}
          >
            {t('market.refreshPrices')}
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {/* AI Price Predictions - Prominent Display */}
      <Box sx={{ mb: 3 }}>
        <AIPricePredictions 
          grainType={selectedGrain}
          currentPrice={marketPrices.find(p => p.grainType === selectedGrain)?.currentPrice}
        />
      </Box>

      <Grid container spacing={3}>
        {/* Live Market Prices */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <CurrencyRupee color="success" />
                <Typography variant="h6" fontWeight="bold">
                  {t('market.livePrices')}
                </Typography>
              </Box>

              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>{t('grainLocations.grainType')}</strong></TableCell>
                      <TableCell align="right"><strong>{t('market.currentPrice')}</strong></TableCell>
                      <TableCell align="right"><strong>{t('market.previousPrice')}</strong></TableCell>
                      <TableCell align="center"><strong>{t('market.change')}</strong></TableCell>
                      <TableCell align="center"><strong>{t('market.trend')}</strong></TableCell>
                      <TableCell align="right"><strong>{t('market.marketType')}</strong></TableCell>
                      <TableCell align="center"><strong>AI Forecast</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {marketPrices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          <Typography color="text.secondary">
                            {t('market.noMarketData')}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      marketPrices.map((price, index) => {
                        const change = getPriceChange(price.currentPrice, price.previousPrice);
                        const trend = getPriceTrend(change);
                        
                        return (
                          <TableRow key={index} hover>
                            <TableCell>
                              <Typography fontWeight="bold">
                                {price.grainType}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography fontWeight="bold" color="primary.main">
                                ₹{price.currentPrice?.toLocaleString('en-IN')}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color="text.secondary">
                                ₹{price.previousPrice?.toLocaleString('en-IN')}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={`${change > 0 ? '+' : ''}${change}%`}
                                color={trend === 'up' ? 'success' : trend === 'down' ? 'error' : 'default'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">
                              {trend === 'up' ? (
                                <TrendingUp color="success" />
                              ) : trend === 'down' ? (
                                <TrendingDown color="error" />
                              ) : (
                                <Typography variant="body2">-</Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color="text.secondary">
                                {price.market || t('market.localMarket')}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <AIGrainPriceForecast
                                defaultGrain={price.grainType}
                                buttonVariant="outlined"
                                buttonSize="small"
                                buttonText="Predict"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Customer's Stored Grains */}
        <Grid item xs={12}>
          <Card sx={{ bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Speed color="info" />
                  <Typography variant="h6" fontWeight="bold">
                    AI-Powered Price Predictions
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  onClick={fetchPredictions}
                  disabled={aiPredictionsLoading || customerGrains.length === 0}
                  startIcon={aiPredictionsLoading ? <CircularProgress size={16} /> : <ShowChart />}
                >
                  {aiPredictionsLoading ? 'Getting AI Insights...' : 'Get AI Price Predictions'}
                </Button>
              </Box>

                {customerGrains.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Speed sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No Stored Grains Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Add grains to your warehouse to get AI-powered price predictions and market insights.
                    </Typography>
                  </Paper>
                ) : (
                  <>
                    <TableContainer component={Paper}>
                      <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>{t('grainLocations.grainType')}</strong></TableCell>
                        <TableCell align="right"><strong>{t('market.quantity')}</strong></TableCell>
                        <TableCell align="right"><strong>{t('grainLocations.weight')} (kg)</strong></TableCell>
                        <TableCell align="center"><strong>{t('market.storageDays')}</strong></TableCell>
                        <TableCell align="right"><strong>{t('market.currentValue')}</strong></TableCell>
                        {hasAiColumns && (
                          <>
                            <TableCell align="center"><strong>AI Price Category</strong></TableCell>
                            <TableCell align="center"><strong>AI Profit Outlook</strong></TableCell>
                            <TableCell align="center"><strong>Storage Duration</strong></TableCell>
                            <TableCell align="center"><strong>AI Confidence</strong></TableCell>
                          </>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {customerGrains.map((grain, index) => {
                        const aiPrediction = aiPredictions[String(grain.name || '').toLowerCase()];
                        const storageDays = calculateStorageDays(grain.entryDate);
                        
                        return (
                          <TableRow key={index} hover>
                            <TableCell>
                              <Typography fontWeight="bold">
                                {grain.name}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{grain.quantity}</TableCell>
                            <TableCell align="right">{grain.weight}</TableCell>
                            <TableCell align="center">
                              <Chip
                                icon={<CalendarToday />}
                                label={`${storageDays} ${t('payments.days')}`}
                                size="small"
                                color={storageDays > 90 ? 'warning' : 'default'}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography fontWeight="bold" color="success.main">
                                ₹{grain.currentValue?.toLocaleString('en-IN')}
                              </Typography>
                            </TableCell>
                            
                            {hasAiColumns && (
                              <>
                                <TableCell align="center">
                                  <Chip
                                    label={aiPrediction?.price?.predicted_category || 'N/A'}
                                    color={aiPrediction?.price?.predicted_category === 'High' ? 'success' : aiPrediction?.price?.predicted_category === 'Low' ? 'error' : 'warning'}
                                    size="small"
                                    variant={aiPrediction ? 'filled' : 'outlined'}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Chip
                                    label={aiPrediction?.profit?.predicted_category || 'N/A'}
                                    color={aiPrediction?.profit?.predicted_category === 'Profit' ? 'success' : 'error'}
                                    size="small"
                                    variant={aiPrediction ? 'filled' : 'outlined'}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Chip
                                    label={aiPrediction?.duration?.predicted_category || 'N/A'}
                                    color="info"
                                    size="small"
                                    variant={aiPrediction ? 'filled' : 'outlined'}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                                    <Tooltip title={`Price: ${((aiPrediction?.price?.confidence || 0) * 100).toFixed(0)}%, Profit: ${((aiPrediction?.profit?.confidence || 0) * 100).toFixed(0)}%, Duration: ${((aiPrediction?.duration?.confidence || 0) * 100).toFixed(0)}%`}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <LinearProgress
                                          variant="determinate"
                                          value={((aiPrediction?.price?.confidence || 0) + (aiPrediction?.profit?.confidence || 0) + (aiPrediction?.duration?.confidence || 0)) / 3 * 100}
                                          sx={{ width: 60, height: 6, borderRadius: 3 }}
                                        />
                                        <Typography variant="caption">
                                          {(((aiPrediction?.price?.confidence || 0) + (aiPrediction?.profit?.confidence || 0) + (aiPrediction?.duration?.confidence || 0)) / 3 * 100).toFixed(0)}%
                                        </Typography>
                                      </Box>
                                    </Tooltip>
                                  </Stack>
                                </TableCell>
                              </>
                            )}
                            
                            {aiPredictions.length === 0 && (
                              <TableCell colSpan={4} align="center">
                                <Typography variant="body2" color="text.secondary">
                                  Click "Get AI Price Predictions" to see AI-powered insights
                                </Typography>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {aiPredictions.length > 0 && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                      <Info fontSize="small" />
                      AI predictions powered by machine learning models trained on historical warehouse data. Price Category indicates market trend, Profit Outlook shows expected profitability, and Storage Duration estimates optimal storage period.
                    </Typography>
                  </Box>
                )}
              </>
            )}
            </CardContent>
          </Card>
        </Grid>

        {/* Market Insights */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
            <Typography variant="subtitle2" fontWeight="bold" color="success.main" gutterBottom>
              {t('market.highestPriceToday')}
            </Typography>
            {marketPrices.length > 0 ? (
              <>
                <Typography variant="h5" fontWeight="bold">
                  {marketPrices.reduce((max, p) => p.currentPrice > max.currentPrice ? p : max).grainType}
                </Typography>
                <Typography variant="h6" color="success.main">
                  ₹{marketPrices.reduce((max, p) => p.currentPrice > max.currentPrice ? p : max).currentPrice?.toLocaleString('en-IN')}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">{t('market.noData')}</Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200' }}>
            <Typography variant="subtitle2" fontWeight="bold" color="warning.main" gutterBottom>
              {t('market.mostVolatile')}
            </Typography>
            {marketPrices.length > 0 ? (
              <>
                <Typography variant="h5" fontWeight="bold">
                  {marketPrices.reduce((max, p) => {
                    const change = Math.abs(getPriceChange(p.currentPrice, p.previousPrice));
                    const maxChange = Math.abs(getPriceChange(max.currentPrice, max.previousPrice));
                    return change > maxChange ? p : max;
                  }).grainType}
                </Typography>
                <Typography variant="h6" color="warning.main">
                  ±{Math.abs(getPriceChange(
                    marketPrices.reduce((max, p) => {
                      const change = Math.abs(getPriceChange(p.currentPrice, p.previousPrice));
                      const maxChange = Math.abs(getPriceChange(max.currentPrice, max.previousPrice));
                      return change > maxChange ? p : max;
                    }).currentPrice,
                    marketPrices.reduce((max, p) => {
                      const change = Math.abs(getPriceChange(p.currentPrice, p.previousPrice));
                      const maxChange = Math.abs(getPriceChange(max.currentPrice, max.previousPrice));
                      return change > maxChange ? p : max;
                    }).previousPrice
                  ))}%
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">{t('market.noData')}</Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200' }}>
            <Typography variant="subtitle2" fontWeight="bold" color="info.main" gutterBottom>
              {t('market.yourGrainTypes')}
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              {customerGrains.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('market.differentGrainTypes')}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CustomerMarketPricesAndPredictions;
