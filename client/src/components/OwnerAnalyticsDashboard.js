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
  Button,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  TrendingUp,
  People,
  AccountBalance,
  Grain,
  Refresh,
  Download,
  LocationOn,
  Timeline,
  Inventory,
  Business
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  AreaChart,
  Area
} from 'recharts';
import axios from 'axios';

const COLORS = ['#1976d2', '#dc004e', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#e91e63', '#3f51b5'];

const OwnerAnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  
  // New analytics data states
  const [storageDurationData, setStorageDurationData] = useState(null);
  const [customerAnalytics, setCustomerAnalytics] = useState(null);
  const [warehouseCapacity, setWarehouseCapacity] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      
      // Fetch main dashboard data
      const response = await axios.get('/api/analytics/owner/dashboard', {
        headers: { 'x-auth-token': token }
      });
      setDashboardData(response.data);
      
      // Fetch new analytics data
      const [storageRes, customerRes, capacityRes] = await Promise.all([
        axios.get('/api/analytics/owner/storage-duration-analytics', { headers: { 'x-auth-token': token } }),
        axios.get('/api/analytics/owner/customer-analytics', { headers: { 'x-auth-token': token } }),
        axios.get('/api/analytics/owner/warehouse-capacity-viz', { headers: { 'x-auth-token': token } })
      ]);
      
      setStorageDurationData(storageRes.data);
      setCustomerAnalytics(customerRes.data);
      setWarehouseCapacity(capacityRes.data);
      
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/analytics/owner/export', {
        headers: { 'x-auth-token': token },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analytics_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
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

  if (!dashboardData) {
    return null;
  }

  const { revenue, customers, loans, inventory, monthlyTrends } = dashboardData;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Analytics & Revenue Dashboard
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={refreshing} sx={{ mr: 1 }}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={handleExport}
          >
            Export Report
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Revenue Card */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                    Total Revenue
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold', mb: 1 }}>
                    ₹{revenue?.total?.toLocaleString() || 0}
                  </Typography>
                  <Chip
                    label={`+${revenue?.growth || 0}% this month`}
                    size="small"
                    sx={{ 
                      backgroundColor: 'rgba(76, 175, 80, 0.2)', 
                      color: '#4caf50',
                      fontWeight: 'bold'
                    }}
                  />
                </Box>
                <TrendingUp sx={{ fontSize: 48, color: 'rgba(255,255,255,0.3)' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Customers Card */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                    Total Customers
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold', mb: 1 }}>
                    {customers?.total || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    {customers?.active || 0} active
                  </Typography>
                </Box>
                <People sx={{ fontSize: 48, color: 'rgba(255,255,255,0.3)' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Active Loans Card */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                    Active Loans
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold', mb: 1 }}>
                    ₹{loans?.totalActive?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    {loans?.count || 0} loans
                  </Typography>
                </Box>
                <AccountBalance sx={{ fontSize: 48, color: 'rgba(255,255,255,0.3)' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Grain Inventory Card */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                    Grain Stored
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold', mb: 1 }}>
                    {inventory?.totalWeight?.toLocaleString() || 0} kg
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    ₹{inventory?.totalValue?.toLocaleString() || 0}
                  </Typography>
                </Box>
                <Grain sx={{ fontSize: 48, color: 'rgba(255,255,255,0.3)' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Monthly Revenue Trends */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Monthly Revenue Trends
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTrends || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <RechartsTooltip 
                    formatter={(value) => `₹${value.toLocaleString()}`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#1976d2" 
                    strokeWidth={3}
                    dot={{ fill: '#1976d2', r: 5 }}
                    name="Revenue"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="profit" 
                    stroke="#4caf50" 
                    strokeWidth={2}
                    dot={{ fill: '#4caf50', r: 4 }}
                    name="Profit"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Revenue Breakdown */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Revenue Sources
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={revenue?.breakdown || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ₹${entry.value.toLocaleString()}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(revenue?.breakdown || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Customer Analytics & Loan Portfolio */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Top Customers */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Top Customers by Revenue
              </Typography>
              {customers?.topCustomers?.length > 0 ? (
                <Box>
                  {customers.topCustomers.map((customer, index) => (
                    <Paper 
                      key={index} 
                      sx={{ 
                        p: 2, 
                        mb: 2, 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: index === 0 ? '#fff3e0' : 'transparent'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Chip 
                          label={`#${index + 1}`} 
                          color={index === 0 ? 'primary' : 'default'}
                          size="small"
                        />
                        <Box>
                          <Typography variant="body1" fontWeight="bold">
                            {customer.name}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {customer.grainStored} kg stored
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="h6" color="primary" fontWeight="bold">
                        ₹{customer.totalSpent?.toLocaleString()}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No customer data available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Loan Portfolio Stats */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Loan Portfolio Overview
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: '#e3f2fd' }}>
                    <Typography variant="body2" color="textSecondary">
                      Total Issued
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="primary">
                      {loans?.totalIssued || 0}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: '#f3e5f5' }}>
                    <Typography variant="body2" color="textSecondary">
                      Pending Approvals
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="secondary">
                      {loans?.pendingApprovals || 0}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: '#e8f5e9' }}>
                    <Typography variant="body2" color="textSecondary">
                      Interest Earned
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" sx={{ color: '#4caf50' }}>
                      ₹{loans?.interestEarned?.toLocaleString() || 0}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: '#fff3e0' }}>
                    <Typography variant="body2" color="textSecondary">
                      At Risk
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" sx={{ color: '#ff9800' }}>
                      {loans?.atRisk || 0}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Loan-to-Value Ratio
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ flex: 1, height: 10, backgroundColor: '#e0e0e0', borderRadius: 5, overflow: 'hidden' }}>
                    <Box 
                      sx={{ 
                        height: '100%', 
                        width: `${(loans?.loanToValueRatio || 0) * 100}%`,
                        backgroundColor: '#1976d2',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </Box>
                  <Typography variant="body2" fontWeight="bold">
                    {((loans?.loanToValueRatio || 0) * 100).toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Analytics Tabs Section */}
      <Box sx={{ mb: 4 }}>
        <Paper>
          <Tabs 
            value={tabValue} 
            onChange={(e, newValue) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab icon={<Timeline />} label="Overview" />
            <Tab icon={<Timeline />} label="Storage Duration" />
            <Tab icon={<People />} label="Customer Analytics" />
            <Tab icon={<Business />} label="Warehouse Capacity" />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {/* Tab 0: Overview (existing charts) */}
            {tabValue === 0 && (
              <>
                {/* Monthly Revenue Trends */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  <Grid item xs={12} lg={8}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom fontWeight="bold">
                          Monthly Revenue Trends
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={monthlyTrends || []}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <RechartsTooltip 
                              formatter={(value) => `₹${value.toLocaleString()}`}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="revenue" stroke="#1976d2" strokeWidth={2} name="Revenue" />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom fontWeight="bold">
                          Revenue Breakdown
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Storage Rent', value: revenue?.rentCollected || 0 },
                                { name: 'Loan Interest', value: revenue?.loanInterest || 0 },
                                { name: 'Vehicle Charges', value: revenue?.vehicleCharges || 0 },
                                { name: 'Other', value: revenue?.otherCharges || 0 }
                              ]}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {COLORS.map((color, index) => (
                                <Cell key={`cell-${index}`} fill={color} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </>
            )}

            {/* Tab 1: Storage Duration Analytics */}
            {tabValue === 1 && storageDurationData && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Storage Duration Analytics
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={4}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e3f2fd' }}>
                        <Typography variant="body2" color="textSecondary">Currently Storing</Typography>
                        <Typography variant="h4" fontWeight="bold" color="primary">
                          {storageDurationData.stats.activeCount}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f3e5f5' }}>
                        <Typography variant="body2" color="textSecondary">Previously Stored</Typography>
                        <Typography variant="h4" fontWeight="bold" color="secondary">
                          {storageDurationData.stats.completedCount}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e8f5e9' }}>
                        <Typography variant="body2" color="textSecondary">Avg. Duration</Typography>
                        <Typography variant="h4" fontWeight="bold" sx={{ color: '#4caf50' }}>
                          {storageDurationData.stats.averageDuration} days
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Grid>

                {/* Duration Distribution */}
                <Grid item xs={12} lg={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Storage Duration Distribution
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={Object.keys(storageDurationData.durationRanges).map(range => ({
                          range,
                          count: storageDurationData.durationRanges[range]
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="range" angle={-15} textAnchor="end" height={80} />
                          <YAxis />
                          <RechartsTooltip />
                          <Bar dataKey="count" fill="#1976d2" name="Number of Storages" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Currently Storing Timeline */}
                <Grid item xs={12} lg={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Current Storage Timeline (Top 10)
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart 
                          data={(storageDurationData.currentlyStoring || []).slice(0, 10)}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="customer" type="category" width={100} />
                          <RechartsTooltip formatter={(value) => `${value} days`} />
                          <Bar dataKey="daysStored" fill="#ff9800" name="Days Stored" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Currently Storing Table */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Currently Storing - Details
                      </Typography>
                      <TableContainer sx={{ maxHeight: 400 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell><strong>Customer</strong></TableCell>
                              <TableCell><strong>Grain Types</strong></TableCell>
                              <TableCell align="right"><strong>Weight (kg)</strong></TableCell>
                              <TableCell align="right"><strong>Days Stored</strong></TableCell>
                              <TableCell><strong>Location</strong></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(storageDurationData.currentlyStoring || []).slice(0, 20).map((item, index) => (
                              <TableRow key={index}>
                                <TableCell>{item.customer}</TableCell>
                                <TableCell>{item.grainTypes}</TableCell>
                                <TableCell align="right">{item.weight.toLocaleString()}</TableCell>
                                <TableCell align="right">
                                  <Chip 
                                    label={item.daysStored} 
                                    size="small" 
                                    color={item.daysStored > 90 ? "warning" : "primary"}
                                  />
                                </TableCell>
                                <TableCell>{item.location}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}

            {/* Tab 2: Customer Analytics */}
            {tabValue === 2 && customerAnalytics && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Customer Analytics
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e8f5e9' }}>
                        <Typography variant="body2" color="textSecondary">Current Customers</Typography>
                        <Typography variant="h3" fontWeight="bold" sx={{ color: '#4caf50' }}>
                          {customerAnalytics.currentCustomers.count}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fff3e0' }}>
                        <Typography variant="body2" color="textSecondary">Previous Customers</Typography>
                        <Typography variant="h3" fontWeight="bold" sx={{ color: '#ff9800' }}>
                          {customerAnalytics.previousCustomers.count}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Grid>

                {/* Customer In/Out Flow Line Chart */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Customer In/Out Flow (Last 12 Months)
                      </Typography>
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={customerAnalytics.customerFlow || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <RechartsTooltip />
                          <Legend />
                          <Line type="monotone" dataKey="in" stroke="#4caf50" strokeWidth={2} name="Customers IN" />
                          <Line type="monotone" dataKey="out" stroke="#f44336" strokeWidth={2} name="Customers OUT" />
                          <Line type="monotone" dataKey="net" stroke="#1976d2" strokeWidth={2} strokeDasharray="5 5" name="Net Change" />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Customer Segmentation Bubble Chart */}
                <Grid item xs={12} lg={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Customer Segmentation (Bubble Chart)
                      </Typography>
                      <ResponsiveContainer width="100%" height={400}>
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            type="number" 
                            dataKey="transactionCount" 
                            name="Transactions" 
                            label={{ value: 'Number of Transactions', position: 'bottom' }}
                          />
                          <YAxis 
                            type="number" 
                            dataKey="totalSpent" 
                            name="Total Spent" 
                            label={{ value: 'Total Spent (₹)', angle: -90, position: 'left' }}
                          />
                          <ZAxis 
                            type="number" 
                            dataKey="avgTransactionValue" 
                            range={[50, 400]} 
                            name="Avg Value"
                          />
                          <RechartsTooltip 
                            cursor={{ strokeDasharray: '3 3' }}
                            formatter={(value, name) => {
                              if (name === 'Total Spent' || name === 'Avg Value') return `₹${value.toLocaleString()}`;
                              return value;
                            }}
                          />
                          <Legend />
                          <Scatter 
                            name="Active Customers" 
                            data={(customerAnalytics.segmentation || []).filter(c => c.status === 'active')} 
                            fill="#4caf50"
                          />
                          <Scatter 
                            name="Inactive Customers" 
                            data={(customerAnalytics.segmentation || []).filter(c => c.status === 'inactive')} 
                            fill="#ff9800"
                          />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Customer Lifetime Value Bar Chart */}
                <Grid item xs={12} lg={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Top 10 Customer Lifetime Value
                      </Typography>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart 
                          data={(customerAnalytics.customerLifetimeValue || []).slice(0, 10)}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={120} />
                          <RechartsTooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                          <Bar dataKey="totalSpent" fill="#1976d2" name="Total Spent (₹)">
                            {(customerAnalytics.customerLifetimeValue || []).slice(0, 10).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.status === 'active' ? '#4caf50' : '#ff9800'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Customer Location Map Visualization */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Customer Locations
                      </Typography>
                      <TableContainer sx={{ maxHeight: 400 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell><strong>Customer Name</strong></TableCell>
                              <TableCell><strong>Location</strong></TableCell>
                              <TableCell align="right"><strong>Total Spent (₹)</strong></TableCell>
                              <TableCell align="right"><strong>Transactions</strong></TableCell>
                              <TableCell align="center"><strong>Status</strong></TableCell>
                              <TableCell><strong>Phone</strong></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(customerAnalytics.customerLifetimeValue || []).map((customer, index) => (
                              <TableRow key={index}>
                                <TableCell>{customer.name}</TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <LocationOn fontSize="small" color="action" />
                                    {customer.location}
                                  </Box>
                                </TableCell>
                                <TableCell align="right">₹{customer.totalSpent.toLocaleString()}</TableCell>
                                <TableCell align="right">{customer.transactionCount}</TableCell>
                                <TableCell align="center">
                                  <Chip 
                                    label={customer.status} 
                                    size="small" 
                                    color={customer.status === 'active' ? 'success' : 'default'}
                                  />
                                </TableCell>
                                <TableCell>{customer.phone}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}

            {/* Tab 3: Warehouse Capacity Visualization */}
            {tabValue === 3 && warehouseCapacity && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Warehouse Capacity Visualization - Block-wise Grain Storage
                  </Typography>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Total Blocks: {warehouseCapacity.summary.totalBlocks} | 
                    Average Occupancy: {warehouseCapacity.summary.averageOccupancy}%
                  </Alert>
                </Grid>

                {/* Block Occupancy Chart */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Block-wise Occupancy Rate
                      </Typography>
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={warehouseCapacity.capacityData || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="blockName" angle={-45} textAnchor="end" height={100} />
                          <YAxis />
                          <RechartsTooltip />
                          <Legend />
                          <Bar dataKey="occupiedBoxes" stackId="a" fill="#4caf50" name="Occupied Boxes" />
                          <Bar dataKey="availableBoxes" stackId="a" fill="#e0e0e0" name="Available Boxes" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Block Capacity Grid */}
                {(warehouseCapacity.capacityData || []).map((block, index) => (
                  <Grid item xs={12} sm={6} lg={4} key={index}>
                    <Card sx={{ height: '100%', border: `2px solid ${parseFloat(block.occupancyRate) > 80 ? '#f44336' : '#4caf50'}` }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {block.blockName}
                          </Typography>
                          <Chip 
                            label={`${block.occupancyRate}%`} 
                            color={parseFloat(block.occupancyRate) > 80 ? 'error' : parseFloat(block.occupancyRate) > 50 ? 'warning' : 'success'}
                            size="small"
                          />
                        </Box>
                        
                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="textSecondary">Occupied:</Typography>
                            <Typography variant="body2" fontWeight="bold">{block.occupiedBoxes}/{block.totalBoxes} boxes</Typography>
                          </Box>
                          <Box sx={{ height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
                            <Box 
                              sx={{ 
                                height: '100%', 
                                width: `${block.occupancyRate}%`,
                                backgroundColor: parseFloat(block.occupancyRate) > 80 ? '#f44336' : '#4caf50',
                                transition: 'width 0.3s ease'
                              }}
                            />
                          </Box>
                        </Box>

                        <Box sx={{ mb: 1 }}>
                          <Typography variant="body2" color="textSecondary" gutterBottom>
                            Total Weight: <strong>{block.totalWeight.toLocaleString()} kg</strong>
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Customers: <strong>{block.customerCount}</strong>
                          </Typography>
                        </Box>

                        {block.grains.length > 0 && (
                          <>
                            <Typography variant="body2" fontWeight="bold" sx={{ mt: 2, mb: 1 }}>
                              Stored Grains:
                            </Typography>
                            {block.grains.map((grain, gIndex) => (
                              <Chip 
                                key={gIndex}
                                label={`${grain.type}: ${grain.weight.toLocaleString()}kg`}
                                size="small"
                                sx={{ mr: 0.5, mb: 0.5 }}
                                color="primary"
                                variant="outlined"
                              />
                            ))}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default OwnerAnalyticsDashboard;
