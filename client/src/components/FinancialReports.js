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
  Button,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Chip
} from '@mui/material';
import {
  Refresh,
  Download,
  TrendingUp,
  TrendingDown,
  AccountBalance,
  Receipt,
  CurrencyRupee
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
  ResponsiveContainer
} from 'recharts';
import axios from 'axios';

const COLORS = ['#4caf50', '#2196f3', '#ff9800', '#f44336', '#9c27b0', '#00bcd4'];

const FinancialReports = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [financialData, setFinancialData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  const fetchFinancialData = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/analytics/owner/financial-summary?period=${selectedPeriod}`, {
        headers: { 'x-auth-token': token }
      });
      setFinancialData(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch financial data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, [selectedPeriod]);

  const handleRefresh = () => {
    fetchFinancialData();
  };

  const handleExportPDF = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/reports/financial-pdf?period=${selectedPeriod}`, {
        headers: { 'x-auth-token': token },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `financial_report_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to export report');
    }
  };

  const handleExportExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/exports/financial-excel?period=${selectedPeriod}`, {
        headers: { 'x-auth-token': token },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `financial_report_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('Failed to export report');
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

  if (!financialData) {
    return null;
  }

  const { 
    period, 
    income, 
    expenses, 
    netProfit, 
    profitMargin,
    monthlyTrends,
    incomeBreakdown,
    expenseBreakdown
  } = financialData;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AccountBalance sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Financial Reports & Analysis
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={selectedPeriod}
              label="Period"
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              <MenuItem value="week">This Week</MenuItem>
              <MenuItem value="month">This Month</MenuItem>
              <MenuItem value="quarter">This Quarter</MenuItem>
              <MenuItem value="year">This Year</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleExportPDF}
          >
            PDF
          </Button>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleExportExcel}
          >
            Excel
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                    Total Income
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" sx={{ color: '#fff', mb: 1 }}>
                    ₹{income?.total?.toLocaleString() || 0}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUp sx={{ color: '#4caf50' }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      +{income?.growth || 0}% vs last period
                    </Typography>
                  </Box>
                </Box>
                <CurrencyRupee sx={{ fontSize: 48, color: 'rgba(255,255,255,0.3)' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                    Total Expenses
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" sx={{ color: '#fff', mb: 1 }}>
                    ₹{expenses?.total?.toLocaleString() || 0}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingDown sx={{ color: '#4caf50' }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      -{expenses?.reduction || 0}% vs last period
                    </Typography>
                  </Box>
                </Box>
                <Receipt sx={{ fontSize: 48, color: 'rgba(255,255,255,0.3)' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                    Net Profit
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" sx={{ color: '#fff', mb: 1 }}>
                    ₹{netProfit?.toLocaleString() || 0}
                  </Typography>
                  <Chip 
                    label={`${profitMargin?.toFixed(1)}% Profit Margin`}
                    sx={{ 
                      backgroundColor: 'rgba(76, 175, 80, 0.2)', 
                      color: '#fff',
                      fontWeight: 'bold'
                    }}
                  />
                </Box>
                <TrendingUp sx={{ fontSize: 48, color: 'rgba(255,255,255,0.3)' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Income vs Expenses Trend */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Income vs Expenses Trend
          </Typography>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={monthlyTrends || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <RechartsTooltip formatter={(value) => `₹${value.toLocaleString()}`} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="income" 
                stroke="#4caf50" 
                strokeWidth={3}
                dot={{ fill: '#4caf50', r: 5 }}
                name="Income"
              />
              <Line 
                type="monotone" 
                dataKey="expenses" 
                stroke="#f44336" 
                strokeWidth={3}
                dot={{ fill: '#f44336', r: 5 }}
                name="Expenses"
              />
              <Line 
                type="monotone" 
                dataKey="profit" 
                stroke="#2196f3" 
                strokeWidth={2}
                dot={{ fill: '#2196f3', r: 4 }}
                name="Profit"
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Income & Expense Breakdown */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Income Breakdown
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={incomeBreakdown || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ₹${entry.value.toLocaleString()}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(incomeBreakdown || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              
              <Divider sx={{ my: 2 }} />
              
              <Box>
                {incomeBreakdown?.map((item, index) => (
                  <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box 
                        sx={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: '50%', 
                          backgroundColor: COLORS[index % COLORS.length] 
                        }} 
                      />
                      <Typography variant="body2">{item.name}</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight="bold">
                      ₹{item.value.toLocaleString()} ({((item.value / income.total) * 100).toFixed(1)}%)
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Expense Breakdown
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={expenseBreakdown || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <RechartsTooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                  <Bar dataKey="value" fill="#f44336" />
                </BarChart>
              </ResponsiveContainer>
              
              <Divider sx={{ my: 2 }} />
              
              <Box>
                {expenseBreakdown?.map((item, index) => (
                  <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">{item.name}</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      ₹{item.value.toLocaleString()} ({((item.value / expenses.total) * 100).toFixed(1)}%)
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Financial Insights */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Financial Insights & Recommendations
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {profitMargin >= 60 && (
              <Grid item xs={12}>
                <Alert severity="success">
                  <strong>Excellent Performance!</strong> Your profit margin of {profitMargin.toFixed(1)}% is well above industry average. Consider reinvesting profits in warehouse expansion or technology upgrades.
                </Alert>
              </Grid>
            )}
            {profitMargin < 40 && profitMargin >= 20 && (
              <Grid item xs={12}>
                <Alert severity="warning">
                  <strong>Moderate Performance:</strong> Profit margin is {profitMargin.toFixed(1)}%. Look for opportunities to reduce expenses or increase revenue through premium services.
                </Alert>
              </Grid>
            )}
            {profitMargin < 20 && (
              <Grid item xs={12}>
                <Alert severity="error">
                  <strong>Action Required:</strong> Low profit margin of {profitMargin.toFixed(1)}%. Review expenses and pricing strategy immediately.
                </Alert>
              </Grid>
            )}
            
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  Top Revenue Source
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="primary">
                  {incomeBreakdown?.[0]?.name || 'N/A'}
                </Typography>
                <Typography variant="body2">
                  ₹{incomeBreakdown?.[0]?.value.toLocaleString() || 0} ({((incomeBreakdown?.[0]?.value / income.total) * 100).toFixed(1)}%)
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  Highest Expense
                </Typography>
                <Typography variant="h6" fontWeight="bold" sx={{ color: '#f44336' }}>
                  {expenseBreakdown?.[0]?.name || 'N/A'}
                </Typography>
                <Typography variant="body2">
                  ₹{expenseBreakdown?.[0]?.value.toLocaleString() || 0} ({((expenseBreakdown?.[0]?.value / expenses.total) * 100).toFixed(1)}%)
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default FinancialReports;
