import React, { useState, useEffect } from 'react';
import { Paper, Typography, Box, Alert, Button, CircularProgress, Grid, Chip } from '@mui/material';
import { Psychology, Inventory, TrendingUp } from '@mui/icons-material';
import axios from 'axios';

const AIStorageOptimization = ({ grainType, quantity, currentDuration }) => {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (grainType && quantity) {
      fetchPredictions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grainType, quantity, currentDuration]);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/ai/predict-duration', {
        grain_type: grainType,
        total_bags: Math.max(Number(quantity) || 1, 1),
        total_weight_kg: Math.max((Number(quantity) || 1) * 100, 100),
        monthly_rent_per_bag: 50
      });
      if (response.data?.success) {
        setPrediction(response.data.prediction || null);
      } else {
        setPrediction(null);
      }
    } catch (err) {
      console.log('AI Storage optimization unavailable');
      setPrediction(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2 }}>
        <CircularProgress size={20} />
        <Typography variant="body2">Loading AI storage predictions...</Typography>
      </Box>
    );
  }

  if (!prediction) return null;

  const optimalMonths = Number(prediction.optimal_months || prediction.optimalMonths || 0);
  const confidencePercent = Number(prediction.confidence_percent || prediction.confidencePercent || 0);
  const durationLabel = optimalMonths > 0 ? `${optimalMonths} months` : 'N/A';
  const strategy = prediction.best_action || prediction.price_trend || 'hold';

  return (
    <Paper sx={{ p: 2, mt: 2, border: '1px solid', borderColor: 'info.light', bgcolor: 'info.50' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Psychology color="info" />
        <Typography variant="subtitle1" fontWeight="bold">AI Storage Optimization</Typography>
      </Box>
      <Alert severity="info" sx={{ mb: 1 }} icon={<TrendingUp />}>
        <Typography variant="body2">
          <strong>{String(grainType || '').toUpperCase()}:</strong> Expected storage duration: {durationLabel}
        </Typography>
      </Alert>
      <Grid container spacing={1}>
        <Grid item>
          <Chip label={`Confidence: ${confidencePercent.toFixed(0)}%`} color="success" size="small" />
        </Grid>
        <Grid item>
          <Chip label={`Strategy: ${String(strategy).replace('_', ' ')}`} color="info" size="small" />
        </Grid>
      </Grid>
    </Paper>
  );
};

export default AIStorageOptimization;
