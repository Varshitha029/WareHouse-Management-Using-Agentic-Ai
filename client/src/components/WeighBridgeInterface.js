import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Scale,
  Refresh,
  Save,
  LocalShipping
} from '@mui/icons-material';
import axios from 'axios';

const WeighBridgeInterface = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [formData, setFormData] = useState({
    vehicleNumber: '',
    grossWeight: '',
    tareWeight: '',
    notes: ''
  });
  const [netWeight, setNetWeight] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const gross = parseFloat(formData.grossWeight) || 0;
    const tare = parseFloat(formData.tareWeight) || 0;
    setNetWeight(gross - tare);
  }, [formData.grossWeight, formData.tareWeight]);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/workers/weighbridge-stats', {
        headers: { 'x-auth-token': token }
      });
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch stats');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/workers/record-weight', {
        ...formData,
        netWeight,
        timestamp: new Date()
      }, {
        headers: { 'x-auth-token': token }
      });

      setSuccess('Weight recorded successfully!');
      setFormData({
        vehicleNumber: '',
        grossWeight: '',
        tareWeight: '',
        notes: ''
      });
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record weight');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Scale sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Weigh Bridge
          </Typography>
        </Box>
        <Tooltip title="Refresh Stats">
          <IconButton onClick={fetchStats}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">
                Today's Weighings
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {stats?.dailyWeighings || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">
                Total Weight (kg)
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {stats?.totalGrainWeighed?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">
                Accuracy Score
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                {stats?.accuracyScore || 98}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">
                Avg Processing Time
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {stats?.avgProcessingTime || 15} min
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            <LocalShipping sx={{ verticalAlign: 'middle', mr: 1 }} />
            Record Vehicle Weight
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  label="Vehicle Number"
                  value={formData.vehicleNumber}
                  onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
                  required
                  fullWidth
                  placeholder="e.g., MH12AB1234"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  label="Gross Weight (tons)"
                  type="number"
                  value={formData.grossWeight}
                  onChange={(e) => setFormData({ ...formData, grossWeight: e.target.value })}
                  required
                  fullWidth
                  InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                  helperText="Vehicle + Grain weight in tons"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  label="Tare Weight (tons)"
                  type="number"
                  value={formData.tareWeight}
                  onChange={(e) => setFormData({ ...formData, tareWeight: e.target.value })}
                  required
                  fullWidth
                  InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                  helperText="Empty vehicle weight in tons"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  label="Net Weight (tons)"
                  value={netWeight.toFixed(2)}
                  fullWidth
                  disabled
                  helperText="Automatically calculated"
                  sx={{ '& .MuiInputBase-input': { fontWeight: 'bold', fontSize: '1.2rem' } }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Notes (Optional)"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  multiline
                  rows={2}
                  fullWidth
                  placeholder="Add any observations..."
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  startIcon={<Save />}
                  disabled={loading || !formData.vehicleNumber || !formData.grossWeight || !formData.tareWeight}
                >
                  {loading ? <CircularProgress size={24} /> : 'Record Weight'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default WeighBridgeInterface;
