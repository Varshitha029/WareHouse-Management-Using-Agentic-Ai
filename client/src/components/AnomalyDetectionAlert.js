import React, { useState, useEffect } from 'react';
import { Paper, Typography, Box, Alert, Chip, Button, CircularProgress } from '@mui/material';
import { Warning, Security, CheckCircle } from '@mui/icons-material';
import axios from 'axios';

const AnomalyDetectionAlert = ({ vehicleData, weighbridgeData }) => {
  const [anomaly, setAnomaly] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (weighbridgeData?.grossWeight && weighbridgeData?.tareWeight) {
      analyzeWeighbridge();
    }
  }, [weighbridgeData]);

  const analyzeWeighbridge = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/ai/weighbridge/analyze', {
        vehicle_number: vehicleData?.vehicleNumber,
        gross_weight: weighbridgeData?.grossWeight,
        tare_weight: weighbridgeData?.tareWeight,
        net_weight: weighbridgeData?.netWeight,
        grain_type: weighbridgeData?.grainType,
        vehicle_type: vehicleData?.vehicleType
      });
      setAnomaly(response.data);
    } catch (err) {
      console.log('Weighbridge AI analysis unavailable');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="caption" color="text.secondary">AI analyzing weights...</Typography>
      </Box>
    );
  }

  if (!anomaly) return null;

  if (anomaly.is_anomaly) {
    return (
      <Alert severity="warning" icon={<Warning />} sx={{ my: 1 }}>
        <Typography variant="subtitle2" fontWeight="bold">
          ⚠️ AI Fraud Detection Alert
        </Typography>
        <Typography variant="body2">{anomaly.message || 'Suspicious weight pattern detected. Please verify manually.'}</Typography>
        {anomaly.details && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {anomaly.details}
          </Typography>
        )}
        <Chip label={`Confidence: ${anomaly.confidence || 'N/A'}%`} color="warning" size="small" sx={{ mt: 1 }} />
      </Alert>
    );
  }

  return (
    <Alert severity="success" icon={<CheckCircle />} sx={{ my: 1 }}>
      <Typography variant="body2">✅ AI Analysis: Weight patterns appear normal.</Typography>
    </Alert>
  );
};

export default AnomalyDetectionAlert;
