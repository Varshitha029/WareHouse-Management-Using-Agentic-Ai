import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  Refresh,
  People,
  TrendingUp,
  Star,
  Email,
  Phone,
  Visibility,
  Edit,
  Block
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import axios from 'axios';

const CustomerInsights = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customersData, setCustomersData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const fetchCustomersData = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/analytics/owner/customers', {
        headers: { 'x-auth-token': token }
      });
      setCustomersData(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch customer data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCustomersData();
  }, []);

  const handleRefresh = () => {
    fetchCustomersData();
  };

  const handleViewDetails = async (customerId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/customers/${customerId}`, {
        headers: { 'x-auth-token': token }
      });
      setSelectedCustomer(response.data);
      setDetailsDialogOpen(true);
    } catch (err) {
      console.error('Failed to fetch customer details:', err);
    }
  };

  const handleCloseDialog = () => {
    setDetailsDialogOpen(false);
    setSelectedCustomer(null);
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

  if (!customersData) {
    return null;
  }

  const { 
    totalCustomers, 
    activeCustomers, 
    inactiveCustomers, 
    premiumCustomers,
    topCustomers,
    customerGrowth,
    lifetimeValue,
    retentionRate
  } = customersData;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <People sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Customer Insights & Analytics
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh} disabled={refreshing}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <People sx={{ fontSize: 40, color: 'rgba(255,255,255,0.9)' }} />
                <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  Total Customers
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" sx={{ color: '#fff' }}>
                {totalCustomers}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <TrendingUp sx={{ color: '#4caf50', fontSize: 18 }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  +{customerGrowth}% this month
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', backgroundColor: '#e8f5e9' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <People sx={{ fontSize: 40, color: '#4caf50' }} />
                <Typography variant="h6" color="textPrimary">
                  Active Customers
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" sx={{ color: '#4caf50' }}>
                {activeCustomers}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                {((activeCustomers / totalCustomers) * 100).toFixed(1)}% of total
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', backgroundColor: '#fff3e0' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Star sx={{ fontSize: 40, color: '#ff9800' }} />
                <Typography variant="h6" color="textPrimary">
                  Premium Customers
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" sx={{ color: '#ff9800' }}>
                {premiumCustomers}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                High-value customers
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', backgroundColor: '#f3e5f5' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <TrendingUp sx={{ fontSize: 40, color: '#9c27b0' }} />
                <Typography variant="h6" color="textPrimary">
                  Retention Rate
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" sx={{ color: '#9c27b0' }}>
                {retentionRate}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={retentionRate} 
                sx={{ mt: 1, height: 8, borderRadius: 4 }}
                color="secondary"
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Customer Growth Chart */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Customer Acquisition & Activity Trends
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={customersData.monthlyTrends || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="newCustomers" fill="#1976d2" name="New Customers" />
                  <Bar dataKey="activeCustomers" fill="#4caf50" name="Active Customers" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Customer Status
              </Typography>
              <Box sx={{ mt: 3 }}>
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Active</Typography>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      {activeCustomers}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={(activeCustomers / totalCustomers) * 100} 
                    color="success"
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Inactive</Typography>
                    <Typography variant="body2" fontWeight="bold" color="error.main">
                      {inactiveCustomers}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={(inactiveCustomers / totalCustomers) * 100} 
                    color="error"
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Premium</Typography>
                    <Typography variant="body2" fontWeight="bold" color="warning.main">
                      {premiumCustomers}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={(premiumCustomers / totalCustomers) * 100} 
                    color="warning"
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Top Customers by Lifetime Value */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Top Customers by Lifetime Value
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Rank</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell align="right">Grain Stored (kg)</TableCell>
                  <TableCell align="right">Active Loans</TableCell>
                  <TableCell align="right">Total Revenue</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topCustomers?.map((customer, index) => (
                  <TableRow 
                    key={index}
                    sx={{ 
                      backgroundColor: index === 0 ? '#fff3e0' : 'transparent',
                      '&:hover': { backgroundColor: '#f5f5f5' }
                    }}
                  >
                    <TableCell>
                      <Chip 
                        label={`#${index + 1}`}
                        color={index === 0 ? 'primary' : index === 1 ? 'secondary' : 'default'}
                        size="small"
                        icon={index === 0 ? <Star /> : undefined}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: COLORS[index % COLORS.length] }}>
                          {customer.name?.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body1" fontWeight="bold">
                            {customer.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Member since {new Date(customer.joinDate).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Email sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="caption">{customer.email}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Phone sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="caption">{customer.phone}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="bold">
                        {customer.grainStored?.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={customer.activeLoans || 0}
                        color={customer.activeLoans > 0 ? 'info' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body1" fontWeight="bold" color="primary">
                        ₹{customer.totalRevenue?.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={customer.isActive ? 'Active' : 'Inactive'}
                        color={customer.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton 
                          size="small" 
                          onClick={() => handleViewDetails(customer._id)}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small">
                          <Edit />
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

      {/* Customer Details Dialog */}
      <Dialog 
        open={detailsDialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
              {selectedCustomer?.profile?.name?.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="h6">{selectedCustomer?.profile?.name}</Typography>
              <Typography variant="body2" color="textSecondary">
                {selectedCustomer?.email}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedCustomer && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">Phone</Typography>
                <Typography variant="body1">{selectedCustomer.profile?.phone}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                <Chip 
                  label={selectedCustomer.isActive ? 'Active' : 'Inactive'}
                  color={selectedCustomer.isActive ? 'success' : 'default'}
                  size="small"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">Address</Typography>
                <Typography variant="body1">
                  {selectedCustomer.profile?.address?.street}, {selectedCustomer.profile?.address?.city}, {selectedCustomer.profile?.address?.state} - {selectedCustomer.profile?.address?.pincode}
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const COLORS = ['#1976d2', '#dc004e', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4'];

export default CustomerInsights;
