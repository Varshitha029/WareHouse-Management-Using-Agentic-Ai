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
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Divider,
  Badge
} from '@mui/material';
import {
  Refresh,
  Payment,
  Receipt,
  Download,
  CalendarToday,
  CheckCircle,
  Warning,
  Schedule
} from '@mui/icons-material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent
} from '@mui/lab';
import axios from 'axios';

const PaymentTimeline = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [upcomingPayments, setUpcomingPayments] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [paymentStats, setPaymentStats] = useState(null);

  const fetchPaymentData = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      
      // Fetch upcoming payments
      const upcomingResponse = await axios.get('/api/transactions/upcoming', {
        headers: { 'x-auth-token': token }
      });
      setUpcomingPayments(upcomingResponse.data);
      
      // Fetch payment history
      const historyResponse = await axios.get('/api/transactions/my-history', {
        headers: { 'x-auth-token': token }
      });
      setRecentPayments(historyResponse.data);
      
      // Fetch payment stats
      const statsResponse = await axios.get('/api/transactions/my-stats', {
        headers: { 'x-auth-token': token }
      });
      setPaymentStats(statsResponse.data);
      
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch payment data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPaymentData();
  }, []);

  const handleRefresh = () => {
    fetchPaymentData();
  };

  const handlePayNow = (payment) => {
    window.location.href = `/payment-gateway?type=${payment.type}&id=${payment.referenceId}&amount=${payment.amount}`;
  };

  const handleDownloadReceipt = async (transactionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/transactions/${transactionId}/receipt`, {
        headers: { 'x-auth-token': token },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt_${transactionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download receipt:', err);
      alert('Failed to download receipt');
    }
  };

  const getPaymentTypeColor = (type) => {
    switch (type) {
      case 'rent':
        return '#1976d2';
      case 'loan':
        return '#9c27b0';
      case 'vehicle':
        return '#ff9800';
      default:
        return '#4caf50';
    }
  };

  const getPaymentTypeIcon = (type) => {
    switch (type) {
      case 'rent':
        return <Payment />;
      case 'loan':
        return <Payment />;
      default:
        return <Receipt />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
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

  const totalPending = upcomingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const overduePayments = upcomingPayments.filter(p => new Date(p.dueDate) < new Date());

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Payment sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Payment Timeline
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh} disabled={refreshing}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Overdue Alert */}
      {overduePayments.length > 0 && (
        <Alert severity="error" sx={{ mb: 3 }} icon={<Warning />}>
          <strong>You have {overduePayments.length} overdue payment{overduePayments.length > 1 ? 's' : ''}!</strong> Please make payment immediately to avoid penalties.
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Total Paid
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                ₹{paymentStats?.totalPaid?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Pending Payments
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                ₹{totalPending?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                This Month
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="primary">
                ₹{paymentStats?.thisMonth?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Last Payment
              </Typography>
              <Typography variant="h6" fontWeight="bold">
                {paymentStats?.lastPaymentDate 
                  ? new Date(paymentStats.lastPaymentDate).toLocaleDateString()
                  : 'N/A'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab 
            label={
              <Badge badgeContent={upcomingPayments.length} color="primary">
                <Box sx={{ px: 2 }}>Upcoming Payments</Box>
              </Badge>
            } 
          />
          <Tab label="Payment History" />
        </Tabs>
      </Card>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Box>
          {upcomingPayments.length > 0 ? (
            <Grid container spacing={3}>
              {upcomingPayments.map((payment, index) => {
                const dueDate = new Date(payment.dueDate);
                const isOverdue = dueDate < new Date();
                const daysUntilDue = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
                
                return (
                  <Grid item xs={12} md={6} key={index}>
                    <Card 
                      sx={{ 
                        border: isOverdue ? '2px solid #f44336' : daysUntilDue <= 3 ? '2px solid #ff9800' : 'none'
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getPaymentTypeIcon(payment.type)}
                            <Box>
                              <Typography variant="h6" fontWeight="bold">
                                {payment.type === 'rent' ? 'Storage Rent' : payment.type === 'loan' ? 'Loan EMI' : 'Other Payment'}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                Due: {dueDate.toLocaleDateString()}
                              </Typography>
                            </Box>
                          </Box>
                          <Chip 
                            label={isOverdue ? 'OVERDUE' : daysUntilDue <= 3 ? 'DUE SOON' : 'UPCOMING'}
                            color={isOverdue ? 'error' : daysUntilDue <= 3 ? 'warning' : 'default'}
                            size="small"
                          />
                        </Box>

                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="textSecondary">
                            Amount Due
                          </Typography>
                          <Typography variant="h4" fontWeight="bold" color="primary">
                            ₹{payment.amount?.toLocaleString()}
                          </Typography>
                        </Box>

                        {isOverdue && (
                          <Alert severity="error" sx={{ mb: 2 }}>
                            Overdue by {Math.abs(daysUntilDue)} days
                          </Alert>
                        )}

                        {!isOverdue && daysUntilDue <= 3 && (
                          <Alert severity="warning" sx={{ mb: 2 }}>
                            Due in {daysUntilDue} day{daysUntilDue !== 1 ? 's' : ''}
                          </Alert>
                        )}

                        <Button
                          variant="contained"
                          fullWidth
                          startIcon={<Payment />}
                          onClick={() => handlePayNow(payment)}
                          color={isOverdue ? 'error' : 'primary'}
                        >
                          Pay Now
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <Alert severity="success" icon={<CheckCircle />}>
              <Typography variant="body1">
                🎉 No pending payments! You're all caught up.
              </Typography>
            </Alert>
          )}
        </Box>
      )}

      {activeTab === 1 && (
        <Box>
          {recentPayments.length > 0 ? (
            <Box>
              {/* Timeline View */}
              <Timeline position="right">
                {recentPayments.slice(0, 5).map((payment, index) => (
                  <TimelineItem key={index}>
                    <TimelineOppositeContent color="textSecondary">
                      <Typography variant="body2">
                        {new Date(payment.date).toLocaleDateString()}
                      </Typography>
                      <Typography variant="caption">
                        {new Date(payment.date).toLocaleTimeString()}
                      </Typography>
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot 
                        sx={{ 
                          backgroundColor: getPaymentTypeColor(payment.type),
                          padding: 1
                        }}
                      >
                        {getPaymentTypeIcon(payment.type)}
                      </TimelineDot>
                      {index < recentPayments.slice(0, 5).length - 1 && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent>
                      <Paper sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body1" fontWeight="bold">
                            {payment.type === 'rent' ? 'Storage Rent' : payment.type === 'loan' ? 'Loan EMI' : 'Other Payment'}
                          </Typography>
                          <Chip 
                            label={payment.status}
                            color={getStatusColor(payment.status)}
                            size="small"
                          />
                        </Box>
                        <Typography variant="h6" fontWeight="bold" color="primary" gutterBottom>
                          ₹{payment.amount?.toLocaleString()}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" color="textSecondary">
                            {payment.method?.toUpperCase()} • {payment.transactionId}
                          </Typography>
                          <Tooltip title="Download Receipt">
                            <IconButton 
                              size="small"
                              onClick={() => handleDownloadReceipt(payment._id)}
                            >
                              <Download fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Paper>
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>

              <Divider sx={{ my: 3 }} />

              {/* Detailed Table */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    All Payment History
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell>Method</TableCell>
                          <TableCell>Transaction ID</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="center">Receipt</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {recentPayments.map((payment, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Typography variant="body2">
                                {new Date(payment.date).toLocaleDateString()}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {new Date(payment.date).toLocaleTimeString()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={payment.type}
                                size="small"
                                sx={{ backgroundColor: getPaymentTypeColor(payment.type), color: '#fff' }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body1" fontWeight="bold">
                                ₹{payment.amount?.toLocaleString()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {payment.method?.toUpperCase()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                {payment.transactionId}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={payment.status}
                                color={getStatusColor(payment.status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="Download Receipt">
                                <IconButton 
                                  size="small"
                                  onClick={() => handleDownloadReceipt(payment._id)}
                                >
                                  <Download />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Box>
          ) : (
            <Alert severity="info">
              No payment history available.
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
};

export default PaymentTimeline;
