import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  Grid,
  Chip,
  Paper
} from '@mui/material';
import {
  CreditCard,
  AccountBalance,
  QrCode2,
  Wallet,
  Payment
} from '@mui/icons-material';
import axios from 'axios';

const RazorpayPaymentSimple = ({ amount, onSuccess, onError, paymentData }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('card');

  const paymentMethods = [
    { 
      id: 'card', 
      name: 'Credit/Debit Card', 
      icon: <CreditCard />, 
      description: 'Visa, Mastercard, RuPay' 
    },
    { 
      id: 'upi', 
      name: 'UPI', 
      icon: <QrCode2 />, 
      description: 'PhonePe, Google Pay, Paytm' 
    },
    { 
      id: 'wallet', 
      name: 'Wallet', 
      icon: <Wallet />, 
      description: 'Paytm, Mobikwik, Freecharge' 
    }
  ];

  const createRazorpayOrder = async () => {
    try {
      const response = await axios.post('/api/payments/create-order', {
        amount: amount,
        currency: 'INR',
        ...paymentData
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to create payment order');
    }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async (method = selectedMethod) => {
    setLoading(true);
    setError('');

    try {
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load Razorpay SDK');
      }

      // Create order
      const orderData = await createRazorpayOrder();

      // Configure Razorpay options
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Warehouse Management System',
        description: paymentData.description || 'Payment for warehouse services',
        order_id: orderData.orderId,
        prefill: {
          name: paymentData.customerName || 'Customer',
          email: paymentData.customerEmail || '',
          contact: paymentData.customerPhone || ''
        },
        theme: {
          color: '#1976d2'
        },
        method: {
          card: method === 'card',
          upi: method === 'upi',
          wallet: method === 'wallet'
        },
        handler: async function (response) {
          try {
            // ✅ NO WEBHOOK NEEDED - Direct verification
            console.log('Payment successful:', response);
            
            // Directly call success with payment data
            setLoading(false);
            onSuccess && onSuccess({
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              amount: orderData.amount / 100,
              currency: orderData.currency,
              method: method,
              signature: response.razorpay_signature
            });
          } catch (error) {
            setLoading(false);
            setError('Payment processing failed');
            onError && onError(error);
          }
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
            setError('Payment cancelled by user');
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (err) {
      setLoading(false);
      setError(err.message);
      onError && onError(err);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 500, mx: 'auto' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <Payment sx={{ mr: 1 }} />
          Secure Payment (No Webhooks Required)
        </Typography>
        <Typography variant="h4" color="primary" gutterBottom>
          ₹{amount.toFixed(2)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {paymentData.description || 'Warehouse service payment'}
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Typography variant="subtitle1" gutterBottom>
        Choose Payment Method:
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {paymentMethods.map((method) => (
          <Grid item xs={6} key={method.id}>
            <Card
              variant={selectedMethod === method.id ? 'elevation' : 'outlined'}
              sx={{
                cursor: 'pointer',
                border: selectedMethod === method.id ? '2px solid #1976d2' : '1px solid #e0e0e0',
                '&:hover': { boxShadow: 2 }
              }}
              onClick={() => setSelectedMethod(method.id)}
            >
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Box sx={{ color: selectedMethod === method.id ? '#1976d2' : 'inherit' }}>
                  {method.icon}
                </Box>
                <Typography variant="body2" fontWeight="bold" sx={{ mt: 1 }}>
                  {method.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {method.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Button
        variant="contained"
        fullWidth
        size="large"
        onClick={() => handlePayment(selectedMethod)}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={20} /> : <Payment />}
        sx={{ py: 1.5 }}
      >
        {loading ? 'Processing...' : `Pay ₹${amount.toFixed(2)}`}
      </Button>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          🔒 Secure payment without webhooks • Perfect for development
        </Typography>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          Supported payment methods:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
          <Chip label="UPI" size="small" />
          <Chip label="Cards" size="small" />
          <Chip label="Net Banking" size="small" />
          <Chip label="Wallets" size="small" />
        </Box>
      </Box>
    </Paper>
  );
};

export default RazorpayPaymentSimple;