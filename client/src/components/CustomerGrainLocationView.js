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
  Button
} from '@mui/material';
import {
  LocationOn,
  Warehouse,
  Grain,
  Info,
  CheckCircle,
  Schedule,
  Refresh,
  AccountBalance
} from '@mui/icons-material';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useTranslation } from '../i18n/LanguageContext';
import AIStorageOptimization from './AIStorageOptimization';

const CustomerGrainLocationView = () => {
  const { t } = useTranslation();
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marketPrices, setMarketPrices] = useState({});
  const [aiDurationPredictions, setAiDurationPredictions] = useState({});
  const [aiPredictionsLoading, setAiPredictionsLoading] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState(null);
  const { socket } = useSocket();

  useEffect(() => {
    fetchGrainLocations();
    fetchMarketPrices();
    
    // Listen for real-time grain allocation updates
    if (socket) {
      socket.on('slot_allocated', (data) => {
        console.log('Grain allocated update received:', data);
        fetchGrainLocations(); // Refresh data when new allocation is made
      });
      
      socket.on('allocationUpdated', (data) => {
        console.log('Allocation updated:', data);
        fetchGrainLocations(); // Refresh data when allocation is updated
      });
      
      socket.on('slot_deallocated', (data) => {
        console.log('Slot deallocated:', data);
        fetchGrainLocations(); // Refresh data when slot is deallocated
      });
    }
    
    return () => {
      if (socket) {
        socket.off('slot_allocated');
        socket.off('allocationUpdated');
        socket.off('slot_deallocated');
      }
    };
  }, [socket]);

  const fetchGrainLocations = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Try the dynamic warehouse endpoint first
      const response = await axios.get('/api/dynamic-warehouse/my-grain-locations');
      console.log('Grain locations response:', response.data);
      setAllocations(response.data.grainLocations || []);
    } catch (err) {
      console.error('Error fetching grain locations:', err);
      setError(err.response?.data?.message || t('grainLocations.errorFetchingLocations') || 'Failed to fetch grain locations');
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketPrices = async () => {
    try {
      const response = await axios.get('/api/market/live-prices');
      console.log('Market prices response:', response.data);
      const pricesMap = {};
      const pricesArray = response.data.prices || response.data;
      pricesArray.forEach(price => {
        pricesMap[price.grainType.toLowerCase()] = price.currentPrice;
      });
      console.log('Processed market prices map:', pricesMap);
      setMarketPrices(pricesMap);
    } catch (err) {
      console.error('Error fetching market prices:', err);
    }
  };

  const fetchAIDurationPredictions = async () => {
    if (allocations.length === 0) return;

    try {
      setAiPredictionsLoading(true);
      const predictions = {};

      // Fetch predictions for each allocation
      const predictionPromises = allocations.map(async (item, index) => {
        if (!item.allocation?.grainType || !item.allocation?.weight) return null;

        try {
          const response = await axios.post('/api/ai/predict-duration', {
            grain_type: item.allocation.grainType,
            total_bags: item.allocation.bags || 100,
            total_weight_kg: item.allocation.weight || 5000,
            monthly_rent_per_bag: 50
          });

          if (response.data.success) {
            const rawPrediction = response.data.prediction || {};
            const optimalMonths = Number(rawPrediction.optimal_months || rawPrediction.optimalMonths || 0);
            const confidencePercent = Number(rawPrediction.confidence_percent || rawPrediction.confidencePercent || 0);

            const predictedCategory =
              optimalMonths > 6 ? 'Long-term' :
              optimalMonths >= 3 ? 'Medium-term' :
              optimalMonths > 0 ? 'Short-term' :
              'N/A';

            predictions[index] = {
              ...rawPrediction,
              predicted_category: predictedCategory,
              confidence: Math.min(Math.max(confidencePercent / 100, 0), 1)
            };
          }
        } catch (err) {
          console.error(`Error fetching prediction for allocation ${index}:`, err);
        }
      });

      await Promise.all(predictionPromises);
      setAiDurationPredictions(predictions);
    } catch (err) {
      console.error('Error fetching AI duration predictions:', err);
    } finally {
      setAiPredictionsLoading(false);
    }
  };

  const calculateLoanEligibility = (grainType, weightKg) => {
    const grainTypeLower = grainType?.toLowerCase() || '';
    const pricePerQuintal = marketPrices[grainTypeLower] || 0;
    const weightQuintals = weightKg / 100; // Convert kg to quintals
    const grainValue = weightQuintals * pricePerQuintal;
    const maxLoan = grainValue * 0.60; // 60% of grain value
    
    return {
      weightQuintals: weightQuintals.toFixed(2),
      pricePerQuintal: pricePerQuintal,
      grainValue: grainValue.toFixed(2),
      maxLoan: maxLoan.toFixed(2)
    };
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'success',
      expired: 'error',
      extended: 'warning',
      pending: 'info'
    };
    return colors[status] || 'default';
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const calculateDaysRemaining = (endDate) => {
    if (!endDate) return null;
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LocationOn sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h5" fontWeight="bold">
            {t('grainLocations.title')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Get AI storage duration predictions">
            <Button
              variant="contained"
              size="small"
              onClick={fetchAIDurationPredictions}
              disabled={aiPredictionsLoading || allocations.length === 0}
            >
              {aiPredictionsLoading ? 'Loading AI...' : 'AI Duration Predictions'}
            </Button>
          </Tooltip>
          <Tooltip title={t('grainLocations.refreshTooltip')}>
            <IconButton onClick={fetchGrainLocations} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* AI Storage Optimization - Show if allocation selected */}
      {selectedAllocation && (
        <Box sx={{ mb: 3 }}>
          <AIStorageOptimization 
            grainType={selectedAllocation.storageDetails?.items?.[0]?.grainType || 'Rice'}
            quantity={selectedAllocation.storageDetails?.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0}
            currentDuration={selectedAllocation.storageDuration || 30}
          />
        </Box>
      )}

      {allocations.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Warehouse sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            {t('grainLocations.noAllocations')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('grainLocations.contactOwner')}
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {allocations.map((item, index) => (
              <Grid item xs={12} key={index}>
                <Card elevation={3}>
                  <CardContent>
                    <Grid container spacing={2}>
                      {/* Header */}
                      <Grid item xs={12}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Box display="flex" alignItems="center" gap={2}>
                            <Grain sx={{ fontSize: 32, color: 'primary.main' }} />
                            <Box>
                              <Typography variant="h6" fontWeight="bold">
                                {item.warehouseName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {t('grainLocations.slot')}: {item.location?.slotLabel}
                              </Typography>
                            </Box>
                          </Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<CheckCircle />}
                              onClick={() => setSelectedAllocation(selectedAllocation?._id === item._id ? null : item)}
                              color={selectedAllocation?._id === item._id ? 'success' : 'primary'}
                            >
                              {selectedAllocation?._id === item._id ? 'Hide AI Insights' : 'AI Optimization'}
                            </Button>
                            <Chip
                              label={item.slotInfo?.status || 'active'}
                              color={item.slotInfo?.status === 'full' ? 'error' : item.slotInfo?.status === 'partially-filled' ? 'warning' : 'success'}
                              sx={{ textTransform: 'capitalize' }}
                            />
                          </Stack>
                        </Box>
                      </Grid>

                      <Grid item xs={12}>
                        <Divider />
                      </Grid>

                      {/* Location */}
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2, bgcolor: 'primary.50' }}>
                          <Typography variant="subtitle2" color="primary.main" fontWeight="bold">
                            <LocationOn sx={{ mr: 1, verticalAlign: 'middle' }} />
                            {t('grainLocations.location')}
                          </Typography>
                          <Stack spacing={1} sx={{ mt: 2 }}>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">{t('grainLocations.building')}:</Typography>
                              <Typography variant="body2" fontWeight="bold">{item.location?.building}</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">{t('grainLocations.block')}:</Typography>
                              <Typography variant="body2" fontWeight="bold">{item.location?.block}</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">{t('grainLocations.slot')}:</Typography>
                              <Typography variant="body2" fontWeight="bold">{item.location?.slotLabel}</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">{t('grainLocations.position')}:</Typography>
                              <Typography variant="body2" fontWeight="bold">{t('grainLocations.row')} {item.location?.row}, {t('grainLocations.col')} {item.location?.col}</Typography>
                            </Box>
                          </Stack>
                        </Paper>
                      </Grid>

                      {/* Storage Info */}
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2, bgcolor: 'success.50' }}>
                          <Typography variant="subtitle2" color="success.main" fontWeight="bold">
                            <Grain sx={{ mr: 1, verticalAlign: 'middle' }} />
                            {t('grainLocations.storageDetails')}
                          </Typography>
                          <Stack spacing={1} sx={{ mt: 2 }}>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">{t('grainLocations.bags')}:</Typography>
                              <Typography variant="body2" fontWeight="bold">{item.allocation?.bags} {t('grainLocations.bags').toLowerCase()}</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">{t('grainLocations.grainType')}:</Typography>
                              <Typography variant="body2" fontWeight="bold">{item.allocation?.grainType || t('grainLocations.notSpecified')}</Typography>
                            </Box>
                            {item.allocation?.weight > 0 && (
                              <Box display="flex" justifyContent="space-between">
                                <Typography variant="body2">{t('grainLocations.weight')}:</Typography>
                                <Typography variant="body2" fontWeight="bold">{(item.allocation?.weight / 100).toFixed(2)} {t('grainLocations.quintals')}</Typography>
                              </Box>
                            )}
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">{t('grainLocations.entryDate')}:</Typography>
                              <Typography variant="body2" fontWeight="bold">{formatDate(item.allocation?.entryDate)}</Typography>
                            </Box>
                          </Stack>
                        </Paper>
                      </Grid>

                      {/* AI Storage Duration Prediction */}
                      {aiDurationPredictions[index] && (
                        <Grid item xs={12}>
                          <Paper sx={{ p: 2, bgcolor: 'info.50', border: '2px solid', borderColor: 'info.main' }}>
                            <Typography variant="subtitle2" color="info.main" fontWeight="bold" gutterBottom>
                              <Schedule sx={{ mr: 1, verticalAlign: 'middle' }} />
                              AI Storage Duration Prediction
                            </Typography>
                            <Grid container spacing={2} sx={{ mt: 0.5 }}>
                              <Grid item xs={12} md={4}>
                                <Box>
                                  <Typography variant="caption" color="text.secondary">
                                    Predicted Duration Category
                                  </Typography>
                                  <Typography variant="h6" fontWeight="bold" color="info.main">
                                    {aiDurationPredictions[index].predicted_category || 'N/A'}
                                  </Typography>
                                </Box>
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <Box>
                                  <Typography variant="caption" color="text.secondary">
                                    AI Confidence Score
                                  </Typography>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <Typography variant="h6" fontWeight="bold" color="success.main">
                                      {((aiDurationPredictions[index].confidence || 0) * 100).toFixed(0)}%
                                    </Typography>
                                  </Box>
                                </Box>
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Storage Strategy
                                  </Typography>
                                  <Chip
                                    label={
                                      aiDurationPredictions[index].predicted_category === 'Short-term' ? 'Quick Turnaround' :
                                      aiDurationPredictions[index].predicted_category === 'Medium-term' ? 'Strategic Hold' :
                                      'Extended Storage'
                                    }
                                    color={
                                      aiDurationPredictions[index].predicted_category === 'Short-term' ? 'success' :
                                      aiDurationPredictions[index].predicted_category === 'Medium-term' ? 'warning' :
                                      'error'
                                    }
                                    size="small"
                                    sx={{ mt: 1, alignSelf: 'flex-start' }}
                                  />
                                </Box>
                              </Grid>
                              <Grid item xs={12}>
                                <Alert severity="info" sx={{ mt: 1 }}>
                                  <Typography variant="caption">
                                    <strong>AI Insight:</strong> Based on grain type and quantity, optimal storage duration is predicted as {aiDurationPredictions[index].predicted_category}. 
                                    {aiDurationPredictions[index].predicted_category === 'Short-term' && ' Consider quick turnover for best returns.'}
                                    {aiDurationPredictions[index].predicted_category === 'Medium-term' && ' Strategic holding recommended for market optimization.'}
                                    {aiDurationPredictions[index].predicted_category === 'Long-term' && ' Extended storage may be suitable - monitor market conditions.'}
                                    {aiDurationPredictions[index].predicted_category === 'N/A' && ' AI model could not estimate a reliable duration for this allocation.'}
                                  </Typography>
                                </Alert>
                              </Grid>
                            </Grid>
                          </Paper>
                        </Grid>
                      )}

                      {/* Loan Eligibility */}
                      {item.allocation?.weight > 0 && item.allocation?.grainType && (
                        <Grid item xs={12}>
                          <Paper sx={{ p: 2, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.main' }}>
                            <Typography variant="subtitle2" color="warning.main" fontWeight="bold">
                              <AccountBalance sx={{ mr: 1, verticalAlign: 'middle' }} />
                              {t('grainLocations.loanEligibility')}
                            </Typography>
                            <Grid container spacing={2} sx={{ mt: 0.5 }}>
                              {(() => {
                                const loanInfo = calculateLoanEligibility(item.allocation.grainType, item.allocation.weight);
                                return (
                                  <>
                                    <Grid item xs={6} md={3}>
                                      <Typography variant="caption" color="text.secondary">{t('grainLocations.marketPrice')}</Typography>
                                      <Typography variant="body2" fontWeight="bold">
                                        ₹{loanInfo.pricePerQuintal.toLocaleString('en-IN')}/{t('grainLocations.quintal')}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6} md={3}>
                                      <Typography variant="caption" color="text.secondary">{t('grainLocations.grainValue')}</Typography>
                                      <Typography variant="body2" fontWeight="bold">
                                        ₹{parseFloat(loanInfo.grainValue).toLocaleString('en-IN')}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6} md={3}>
                                      <Typography variant="caption" color="text.secondary">{t('grainLocations.weightQuintals')}</Typography>
                                      <Typography variant="body2" fontWeight="bold">
                                        {loanInfo.weightQuintals} {t('grainLocations.quintals')}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6} md={3}>
                                      <Typography variant="caption" color="text.secondary">{t('grainLocations.maxLoanAvailable')}</Typography>
                                      <Typography variant="h6" fontWeight="bold" color="success.main">
                                        ₹{parseFloat(loanInfo.maxLoan).toLocaleString('en-IN')}
                                      </Typography>
                                    </Grid>
                                  </>
                                );
                              })()}
                            </Grid>
                          </Paper>
                        </Grid>
                      )}

                      {/* Slot Capacity */}
                      <Grid item xs={12}>
                        <Paper sx={{ p: 2, bgcolor: 'info.50' }}>
                          <Typography variant="subtitle2" color="info.main" fontWeight="bold">
                            {t('grainLocations.slotCapacityStatus')}
                          </Typography>
                          <Grid container spacing={2} sx={{ mt: 0.5 }}>
                            <Grid item xs={4}>
                              <Typography variant="caption">{t('grainLocations.totalCapacity')}</Typography>
                              <Typography variant="body2" fontWeight="bold">{item.slotInfo?.capacity} {t('grainLocations.bags').toLowerCase()}</Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="caption">{t('grainLocations.filled')}</Typography>
                              <Typography variant="body2" fontWeight="bold">{item.slotInfo?.filledBags} {t('grainLocations.bags').toLowerCase()}</Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="caption">{t('grainLocations.available')}</Typography>
                              <Typography variant="body2" fontWeight="bold">{item.slotInfo?.capacity - item.slotInfo?.filledBags} {t('grainLocations.bags').toLowerCase()}</Typography>
                            </Grid>
                          </Grid>
                        </Paper>
                      </Grid>

                      {item.allocation?.notes && (
                        <Grid item xs={12}>
                          <Alert severity="info">
                            <Typography variant="body2"><strong>{t('warehouse.notes')}:</strong> {item.allocation.notes}</Typography>
                          </Alert>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            ))}
        </Grid>
      )}
    </Box>
  );
};

export default CustomerGrainLocationView;
