import React from 'react';
import { Container, Typography } from '@mui/material';

const PaymentGateway = () => {
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Payment Gateway
      </Typography>
      <Typography>
        Payment Gateway - Payment processing, QR code generation, and transaction management.
      </Typography>
    </Container>
  );
};

export default PaymentGateway;