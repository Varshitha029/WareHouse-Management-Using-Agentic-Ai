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
  LinearProgress,
  Divider,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Refresh,
  Grain,
  CalendarToday,
  Scale,
  CurrencyRupee,
  Room,
  Payment,
  Warning,
  CheckCircle,
  Info
} from '@mui/icons-material';
import axios from 'axios';

const MyGrainsOverview = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [grains, setGrains] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedGrain, setSelectedGrain] = useState(null);

  const fetchGrains = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/warehouse/my-grains', {
        headers: { 'x-auth-token': token }
      });
      setGrains(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch grain data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGrains();
  }, []);

  const handleRefresh = () => {
    fetchGrains();
  };

  const handlePayRent = (grain) => {
    setSelectedGrain(grain);
    setPaymentDialogOpen(true);
  };

  const handleConfirmPayment = () => {
    // Redirect to payment gateway
    window.location.href = `/payment-gateway?type=rent&id=${selectedGrain._id}&amount=${selectedGrain.pricing.finalAmount}`;
  };

  const calculateDaysStored = (startDate) => {
    const start = new Date(startDate);
    const now = new Date();
    return Math.ceil((now - start) / (1000 * 60 * 60 * 24));
  };

  const calculateRemainingDays = (endDate) => {
    const end = new Date(endDate);
    const now = new Date();
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'expired':
        return 'error';
      case 'completed':
        return 'info';
      default:
        return 'default';
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'partial':
        return 'warning';
      case 'pending':
        return 'warning';
      case 'overdue':
        return 'error';
      default:
        return 'default';
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
          <Grain sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            My Grains Overview
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh} disabled={refreshing}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Summary Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: '#e3f2fd' }}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Total Grains Stored
            </Typography>
            <Typography variant="h4" fontWeight="bold" color="primary">
              {grains.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: '#e8f5e9' }}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Total Weight
            </Typography>
            <Typography variant="h4" fontWeight="bold" sx={{ color: '#4caf50' }}>
              {grains.reduce((sum, g) => sum + (g.storageDetails?.totalWeight || 0), 0).toLocaleString()} kg
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: '#fff3e0' }}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Total Value
            </Typography>
            <Typography variant="h4" fontWeight="bold" sx={{ color: '#ff9800' }}>
              ₹{grains.reduce((sum, g) => sum + (g.storageDetails?.totalValue || 0), 0).toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: '#f3e5f5' }}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Pending Payments
            </Typography>
            <Typography variant="h4" fontWeight="bold" sx={{ color: '#9c27b0' }}>
              {grains.filter(g => g.paymentStatus !== 'paid').length}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Grain Cards */}
      {grains.length > 0 ? (
        <Grid container spacing={3}>
          {grains.map((grain, index) => {
            const daysStored = calculateDaysStored(grain.duration?.startDate);
            const remainingDays = calculateRemainingDays(grain.duration?.endDate);
            const isExpiringSoon = remainingDays <= 7 && remainingDays > 0;
            const isExpired = remainingDays < 0;

            return (
              <Grid item xs={12} md={6} lg={4} key={index}>
                <Card 
                  sx={{ 
                    height: '100%',
                    border: isExpired ? '2px solid #f44336' : isExpiringSoon ? '2px solid #ff9800' : 'none',
                    position: 'relative'
                  }}
                >
                  {/* Status Badge */}
                  <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
                    <Chip 
                      label={grain.status}
                      color={getStatusColor(grain.status)}
                      size="small"
                    />
                  </Box>

                  <CardContent>
                    {/* Grain Type */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Grain sx={{ fontSize: 40, color: 'primary.main' }} />
                      <Box>
                        <Typography variant="h6" fontWeight="bold">
                          {grain.storageDetails?.items?.map(item => item.description).join(', ') || 'Unknown Grain'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Storage ID: {grain._id?.substring(0, 8)}
                        </Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {/* Storage Details */}
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Scale sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2" color="textSecondary">
                            Quantity
                          </Typography>
                        </Box>
                        <Typography variant="body1" fontWeight="bold">
                          {grain.storageDetails?.items?.reduce((sum, item) => sum + (item.quantity || 0), 0)} units
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Scale sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2" color="textSecondary">
                            Weight
                          </Typography>
                        </Box>
                        <Typography variant="body1" fontWeight="bold">
                          {grain.storageDetails?.totalWeight?.toLocaleString()} kg
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <CurrencyRupee sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2" color="textSecondary">
                            Value
                          </Typography>
                        </Box>
                        <Typography variant="body1" fontWeight="bold" color="primary">
                          ₹{grain.storageDetails?.totalValue?.toLocaleString()}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Room sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2" color="textSecondary">
                            Location
                          </Typography>
                        </Box>
                        <Typography variant="body2" fontWeight="bold">
                          {grain.allocation ? 
                            `${grain.allocation.building}-${grain.allocation.block}-${grain.allocation.wing}-${grain.allocation.box}` 
                            : 'N/A'}
                        </Typography>
                      </Grid>
                    </Grid>

                    <Divider sx={{ my: 2 }} />

                    {/* Timeline */}
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <CalendarToday sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2" color="textSecondary">
                          Storage Timeline
                        </Typography>
                      </Box>
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="textSecondary">
                          Entry: {new Date(grain.duration?.startDate).toLocaleDateString()}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" sx={{ mx: 1 }}>
                          •
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Expected Exit: {new Date(grain.duration?.endDate).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" fontWeight="bold" color={isExpired ? 'error' : 'textPrimary'}>
                          Days Stored: {daysStored}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          fontWeight="bold"
                          color={isExpired ? 'error' : isExpiringSoon ? 'warning.main' : 'textPrimary'}
                        >
                          Remaining: {remainingDays} days
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.min((daysStored / (daysStored + Math.max(remainingDays, 0))) * 100, 100)}
                        color={isExpired ? 'error' : isExpiringSoon ? 'warning' : 'primary'}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>

                    {/* Warning Messages */}
                    {isExpired && (
                      <Alert severity="error" sx={{ mt: 2 }} icon={<Warning />}>
                        Storage period expired! Please contact warehouse.
                      </Alert>
                    )}
                    {isExpiringSoon && (
                      <Alert severity="warning" sx={{ mt: 2 }} icon={<Info />}>
                        Storage expires in {remainingDays} days!
                      </Alert>
                    )}

                    <Divider sx={{ my: 2 }} />

                    {/* Rent Status */}
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" color="textSecondary">
                          Current Rent
                        </Typography>
                        <Typography variant="h6" fontWeight="bold" color="primary">
                          ₹{grain.pricing?.finalAmount?.toLocaleString() || 0}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="body2" color="textSecondary">
                          Payment Status
                        </Typography>
                        <Chip 
                          label={grain.paymentStatus?.toUpperCase()}
                          color={getPaymentStatusColor(grain.paymentStatus)}
                          size="small"
                        />
                      </Box>

                      {grain.paymentStatus !== 'paid' ? (
                        <Button 
                          variant="contained" 
                          color="primary" 
                          fullWidth
                          startIcon={<Payment />}
                          onClick={() => handlePayRent(grain)}
                        >
                          Pay Rent - ₹{grain.pricing?.finalAmount?.toLocaleString()}
                        </Button>
                      ) : (
                        <Button 
                          variant="outlined" 
                          color="success" 
                          fullWidth
                          startIcon={<CheckCircle />}
                          disabled
                        >
                          Rent Paid
                        </Button>
                      )}
                    </Box>

                    {/* Storage Type */}
                    <Box sx={{ mt: 2 }}>
                      <Chip 
                        label={`${grain.storageDetails?.type || 'Dry'} Storage`}
                        size="small"
                        color={grain.storageDetails?.type === 'cold' ? 'info' : 'default'}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <Alert severity="info">
          <Typography variant="body1">
            You don't have any grains stored at the moment. Contact the warehouse to start storing your grains.
          </Typography>
        </Alert>
      )}

      {/* Payment Confirmation Dialog */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)}>
        <DialogTitle>Confirm Payment</DialogTitle>
        <DialogContent dividers>
          {selectedGrain && (
            <Box>
              <Typography variant="body1" gutterBottom>
                You are about to pay rent for:
              </Typography>
              <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  Grain Type
                </Typography>
                <Typography variant="body1" fontWeight="bold" gutterBottom>
                  {selectedGrain.storageDetails?.items?.map(item => item.description).join(', ')}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Amount
                </Typography>
                <Typography variant="h5" fontWeight="bold" color="primary">
                  ₹{selectedGrain.pricing?.finalAmount?.toLocaleString()}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirmPayment} 
            variant="contained" 
            color="primary"
            startIcon={<Payment />}
          >
            Proceed to Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MyGrainsOverview;
