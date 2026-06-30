import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Payment,
  Receipt,
  Refresh,
  Print
} from '@mui/icons-material';
import axios from 'axios';

const PaymentCollectionInterface = () => {
  const [loading, setLoading] = useState(false);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [todayCollection, setTodayCollection] = useState(null);
  const [formData, setFormData] = useState({
    paymentId: '',
    amount: '',
    method: 'cash',
    reference: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [paymentsRes, statsRes] = await Promise.all([
        axios.get('/api/workers/pending-payments', {
          headers: { 'x-auth-token': token }
        }),
        axios.get('/api/workers/collection-stats', {
          headers: { 'x-auth-token': token }
        })
      ]);
      setPendingPayments(paymentsRes.data);
      setTodayCollection(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch data');
    }
  };

  const handleCollect = async (payment) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/workers/collect-payment', {
        paymentId: payment._id,
        amount: payment.amount,
        method: formData.method,
        reference: formData.reference
      }, {
        headers: { 'x-auth-token': token }
      });
      alert('Payment collected successfully!');
      fetchData();
    } catch (err) {
      alert('Failed to collect payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Payment sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight="bold">
            Payment Collection
          </Typography>
        </Box>
        <IconButton onClick={fetchData}>
          <Refresh />
        </IconButton>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Cash</Typography>
              <Typography variant="h5" fontWeight="bold">
                ₹{todayCollection?.cash?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">UPI</Typography>
              <Typography variant="h5" fontWeight="bold">
                ₹{todayCollection?.upi?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Bank Transfer</Typography>
              <Typography variant="h5" fontWeight="bold">
                ₹{todayCollection?.bankTransfer?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Total Today</Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">
                ₹{todayCollection?.total?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Pending Payments
          </Typography>
          {pendingPayments.map((payment) => (
            <Card key={payment._id} sx={{ mb: 2, p: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <Typography variant="body1" fontWeight="bold">
                    {payment.customer}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {payment.type}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="h6" fontWeight="bold" color="primary">
                    ₹{payment.amount?.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    select
                    label="Method"
                    value={formData.method}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                    size="small"
                    fullWidth
                  >
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="upi">UPI</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => handleCollect(payment)}
                    disabled={loading}
                  >
                    Collect
                  </Button>
                </Grid>
              </Grid>
            </Card>
          ))}
          {pendingPayments.length === 0 && (
            <Alert severity="success">No pending payments</Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default PaymentCollectionInterface;
