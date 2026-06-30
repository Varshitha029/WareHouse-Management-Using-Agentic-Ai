import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  Paper,
  CircularProgress,
  Alert,
  Button
} from '@mui/material';
import {
  LocalShipping,
  Warehouse,
  CurrencyRupee,
  TrendingUp,
  TrendingDown,
  Grain,
  Scale
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const StatCard = ({ title, value, icon, color, trend, trendValue }) => (
  <Card sx={{ height: '100%', bgcolor: `${color}.50`, borderLeft: `4px solid`, borderColor: `${color}.main` }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography color="text.secondary" gutterBottom variant="h6">
            {title}
          </Typography>
          <Typography variant="h4" component="div" color={`${color}.main`}>
            {value}
          </Typography>
          {trend && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              {trend === 'up' ? (
                <TrendingUp color="success" fontSize="small" />
              ) : (
                <TrendingDown color="error" fontSize="small" />
              )}
              <Typography variant="body2" color={trend === 'up' ? 'success.main' : 'error.main'} sx={{ ml: 0.5 }}>
                {trendValue}
              </Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ color: `${color}.main`, opacity: 0.7 }}>
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect based on user role
  useEffect(() => {
    if (user) {
      if (user.role === 'owner') {
        navigate('/owner-dashboard', { replace: true });
      } else if (user.role === 'customer') {
        navigate('/customer-dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  const fetchDashboardStats = useCallback(async () => {
    try {
      setLoading(true);
      let endpoint = '/api/vehicles/stats/dashboard';
      
      if (user?.role === 'customer') {
        endpoint = '/api/customers/stats/dashboard';
      }
      
      const response = await axios.get(endpoint);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  const renderOwnerDashboard = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Total Vehicles"
          value={stats?.totalVehicles || 0}
          icon={<LocalShipping fontSize="large" />}
          color="primary"
          trend="up"
          trendValue="+12%"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Currently Inside"
          value={stats?.currentlyInside || 0}
          icon={<Warehouse fontSize="large" />}
          color="warning"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Today's Entries"
          value={stats?.todayEntries || 0}
          icon={<TrendingUp fontSize="large" />}
          color="success"
          trend="up"
          trendValue="+5"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Revenue Today"
          value={`₹${stats?.todayRevenue || 0}`}
          icon={<CurrencyRupee fontSize="large" />}
          color="info"
          trend="up"
          trendValue="+8%"
        />
      </Grid>
      
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, height: 400 }}>
          <Typography variant="h6" gutterBottom>
            Vehicle Status Breakdown
          </Typography>
          {/* Add chart component here */}
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80%' }}>
            <Typography color="text.secondary">Chart will be implemented</Typography>
          </Box>
        </Paper>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, height: 400 }}>
          <Typography variant="h6" gutterBottom>
            Recent Activities
          </Typography>
          <Box sx={{ mt: 2 }}>
            {/* Add recent activities list here */}
            <Typography color="text.secondary">Recent activities will be shown here</Typography>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );

  const renderCustomerDashboard = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Active Storage"
          value={stats?.activeStorage || 0}
          icon={<Warehouse fontSize="large" />}
          color="primary"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Total Spent"
          value={`₹${stats?.totalSpent || 0}`}
          icon={<CurrencyRupee fontSize="large" />}
          color="success"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Vehicles"
          value={stats?.totalVehicles || 0}
          icon={<LocalShipping fontSize="large" />}
          color="info"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Pending Payments"
          value={`₹${stats?.pendingPayments || 0}`}
          icon={<CurrencyRupee fontSize="large" />}
          color="warning"
        />
      </Grid>
      
      <Grid item xs={12}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            My Storage Allocations
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography color="text.secondary">Storage details will be shown here</Typography>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );



  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* System Updates Banner */}
      <Alert severity="info" sx={{ mb: 3, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          🚀 System Updated - New Features Available!
        </Typography>
        <Typography variant="body2">
          • <strong>🌾 Grain Storage System:</strong> Warehouse layout now supports grain bag allocation instead of generic boxes<br/>
          • <strong>⚖️ Simplified WeighBridge:</strong> Payment system focused on ₹100 weighing fee transactions<br/>
          • <strong>📊 Visual Warehouse Layout:</strong> Cinema-style section visualization for grain storage allocation
        </Typography>
      </Alert>

      <Typography variant="h4" gutterBottom>
        Welcome, {user?.profile?.firstName || user?.username}!
      </Typography>
      
      <Typography variant="h6" color="text.secondary" gutterBottom>
        {user?.role === 'owner' ? 'Owner Dashboard' : 'Customer Dashboard'}
      </Typography>

      {/* Quick Access to Updated Features */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.paper' }}>
        <Typography variant="h6" gutterBottom>
          🎯 Quick Access to Updated Features
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Grain />}
              onClick={() => navigate('/warehouse-layout')}
              sx={{ py: 1.5 }}
            >
              Grain Storage Layout
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Scale />}
              onClick={() => navigate('/weigh-bridge')}
              sx={{ py: 1.5 }}
            >
              Simplified WeighBridge
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<LocalShipping />}
              onClick={() => navigate('/vehicles')}
              sx={{ py: 1.5 }}
            >
              Vehicle Management
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {user?.role === 'owner' && renderOwnerDashboard()}
      {user?.role === 'customer' && renderCustomerDashboard()}
    </Container>
  );
};

export default Dashboard;