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
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Button
} from '@mui/material';
import {
  Refresh,
  Grain,
  TrendingUp,
  Warning,
  Download,
  Inventory
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import axios from 'axios';

const COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];

const GrainInventoryView = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInventoryData = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/analytics/owner/grain-inventory', {
        headers: { 'x-auth-token': token }
      });
      setInventoryData(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch grain inventory data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const handleRefresh = () => {
    fetchInventoryData();
  };

  const handleExportInventory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/exports/inventory-excel', {
        headers: { 'x-auth-token': token },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `grain_inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export inventory:', err);
      alert('Failed to export inventory report');
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

  if (!inventoryData) {
    return null;
  }

  const { 
    totalWeight, 
    totalValue, 
    grainTypes, 
    averageStorageDuration,
    expiringGrains,
    grainDistribution,
    storageTypeDistribution
  } = inventoryData;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Grain sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Grain Inventory Management
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={handleExportInventory}
          >
            Export Inventory
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Expiring Grains Alert */}
      {expiringGrains?.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <strong>⚠️ {expiringGrains.length} grain storage{expiringGrains.length > 1 ? 's are' : ' is'} expiring soon!</strong> Review the table below for details.
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                    Total Weight
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" sx={{ color: '#fff', mb: 1 }}>
                    {totalWeight?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    kilograms
                  </Typography>
                </Box>
                <Inventory sx={{ fontSize: 48, color: 'rgba(255,255,255,0.3)' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                    Total Value
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" sx={{ color: '#fff', mb: 1 }}>
                    ₹{totalValue?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    market value
                  </Typography>
                </Box>
                <TrendingUp sx={{ fontSize: 48, color: 'rgba(255,255,255,0.3)' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', backgroundColor: '#e8f5e9' }}>
            <CardContent>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                Grain Types
              </Typography>
              <Typography variant="h3" fontWeight="bold" sx={{ color: '#4caf50', mb: 1 }}>
                {grainTypes?.length || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                different varieties
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', backgroundColor: '#fff3e0' }}>
            <CardContent>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                Avg Storage Duration
              </Typography>
              <Typography variant="h3" fontWeight="bold" sx={{ color: '#ff9800', mb: 1 }}>
                {averageStorageDuration || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                days
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Grain Type Breakdown */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Grain Distribution by Type
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={grainDistribution || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.weight} kg`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="weight"
                  >
                    {(grainDistribution || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Grain Value by Type
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={grainDistribution || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                  <Bar dataKey="value" fill="#1976d2" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Grain Inventory Table */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Grain Inventory Details
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Grain Type</TableCell>
                  <TableCell align="right">Quantity (units)</TableCell>
                  <TableCell align="right">Weight (kg)</TableCell>
                  <TableCell align="right">Value (₹)</TableCell>
                  <TableCell align="right">Customers</TableCell>
                  <TableCell align="right">Avg Days Stored</TableCell>
                  <TableCell>Storage Type</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {grainTypes?.map((grain, index) => (
                  <TableRow 
                    key={index}
                    sx={{ '&:hover': { backgroundColor: '#f5f5f5' } }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box 
                          sx={{ 
                            width: 12, 
                            height: 12, 
                            borderRadius: '50%', 
                            backgroundColor: COLORS[index % COLORS.length] 
                          }} 
                        />
                        <Typography variant="body1" fontWeight="bold">
                          {grain.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {grain.quantity?.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body1" fontWeight="bold">
                        {grain.weight?.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body1" fontWeight="bold" color="primary">
                        ₹{grain.value?.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={grain.customers || 0}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {grain.avgDaysStored} days
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={grain.storageType || 'Dry'}
                        size="small"
                        color={grain.storageType === 'cold' ? 'info' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Expiring Grains */}
      {expiringGrains?.length > 0 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Warning sx={{ fontSize: 28, color: '#ff9800' }} />
              <Typography variant="h6" fontWeight="bold">
                Grains Expiring Soon (Next 7 Days)
              </Typography>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Customer</TableCell>
                    <TableCell>Grain Type</TableCell>
                    <TableCell align="right">Weight (kg)</TableCell>
                    <TableCell align="right">Value (₹)</TableCell>
                    <TableCell>Entry Date</TableCell>
                    <TableCell>Exit Date</TableCell>
                    <TableCell align="center">Days Remaining</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expiringGrains.map((grain, index) => (
                    <TableRow 
                      key={index}
                      sx={{ 
                        backgroundColor: grain.daysRemaining <= 3 ? '#ffebee' : '#fff3e0',
                        '&:hover': { backgroundColor: grain.daysRemaining <= 3 ? '#ffcdd2' : '#ffe0b2' }
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {grain.customerName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {grain.grainType}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {grain.weight?.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          ₹{grain.value?.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {new Date(grain.entryDate).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {new Date(grain.exitDate).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={`${grain.daysRemaining} days`}
                          color={grain.daysRemaining <= 3 ? 'error' : 'warning'}
                          size="small"
                          icon={<Warning />}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Storage Type Distribution */}
      {storageTypeDistribution && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Storage Type Distribution
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(storageTypeDistribution).map(([type, data], index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      {type.charAt(0).toUpperCase() + type.slice(1)} Storage
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="primary">
                      {data.weight?.toLocaleString()} kg
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      ₹{data.value?.toLocaleString()}
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={(data.weight / totalWeight) * 100} 
                      sx={{ mt: 1, height: 8, borderRadius: 4 }}
                    />
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                      {((data.weight / totalWeight) * 100).toFixed(1)}% of total
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default GrainInventoryView;
