import React from 'react';
import { Container, Typography, Box, Paper } from '@mui/material';
import PaymentModule from '../components/PaymentModule';
import { useAuth } from '../contexts/AuthContext';

const PaymentManagement = () => {
  const { user } = useAuth();

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          💰 Payment Management
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage all payment transactions, view payment history, and track financial records
        </Typography>
      </Paper>

      <Box>
        <PaymentModule userRole={user?.role || 'owner'} />
      </Box>
    </Container>
  );
};

export default PaymentManagement;
