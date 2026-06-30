import React, { useState, useEffect } from 'react';
import { Paper, Typography, Box, Alert, CircularProgress, Grid, Chip } from '@mui/material';
import { ShowChart, TrendingUp, TrendingDown, Psychology } from '@mui/icons-material';
import axios from 'axios';

const AIPricePredictions = ({ grainTypes, customerId }) => {
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (grainTypes?.length > 0 || customerId) {
      fetchPredictions();
    }
  }, [grainTypes, customerId]);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/ai/market/predict', {
        grain_types: grainTypes || [],
        customer_id: customerId
      });
      setPredictions(response.data);
    } catch (err) {
      console.log('AI Price predictions unavailable');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2 }}>
        <CircularProgress size={20} />
        <Typography variant="body2">Loading AI price predictions...</Typography>
      </Box>
    );
  }

  if (!predictions) return null;

  return (
    <Paper sx={{ p: 2, mt: 2, border: '1px solid', borderColor: 'success.light', bgcolor: 'success.50' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Psychology color="success" />
        <Typography variant="subtitle1" fontWeight="bold">AI Price Predictions</Typography>
      </Box>
      <Grid container spacing={2}>
        {predictions.predictions?.map((pred, idx) => (
          <Grid item xs={12} sm={6} key={idx}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2" fontWeight="bold">{pred.grain_type}</Typography>
                {pred.trend === 'up' ? (
                  <TrendingUp color="success" />
                ) : pred.trend === 'down' ? (
                  <TrendingDown color="error" />
                ) : (
                  <ShowChart color="info" />
                )}
              </Box>
              <Typography variant="h6" fontWeight="bold" 
                color={pred.trend === 'up' ? 'success.main' : pred.trend === 'down' ? 'error.main' : 'info.main'}>
                ₹{pred.predicted_price?.toLocaleString() || 'N/A'}/quintal
              </Typography>
              <Chip 
                label={pred.recommendation || (pred.trend === 'up' ? 'HOLD' : 'SELL NOW')} 
                color={pred.trend === 'up' ? 'success' : 'warning'} 
                size="small" 
                sx={{ mt: 1 }}
              />
              {pred.change_percent && (
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                  Expected change: {pred.change_percent > 0 ? '+' : ''}{pred.change_percent}% in {pred.period || '30 days'}
                </Typography>
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>
      {predictions.overall_advice && (
        <Alert severity="info" sx={{ mt: 2 }} icon={<Psychology />}>
          {predictions.overall_advice}
        </Alert>
      )}
    </Paper>
  );
};

export default AIPricePredictions;
