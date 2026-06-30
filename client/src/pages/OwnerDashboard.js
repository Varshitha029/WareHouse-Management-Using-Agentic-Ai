import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Collapse,
  LinearProgress,
  IconButton
} from '@mui/material';
import {
  Add,
  Warehouse,
  People,
  LocalShipping,
  CurrencyRupee,
  Analytics,
  GridView,
  Download,
  Visibility,
  Home,
  Inventory,
  Scale,
  MonetizationOn,
  SmartToy,
  Psychology,
  Security,
  Shield,
  CheckCircle,
  Refresh,
  ExpandMore,
  ExpandLess,
  Warning,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useTranslation } from '../i18n/LanguageContext';
import axios from 'axios';

// Import new dashboard components
import CombinedAnalytics from '../components/CombinedAnalytics';
import LoanPortfolioManager from '../components/LoanPortfolioManager';
import AlertsCenter from '../components/AlertsCenter';
import DynamicWarehouseLayoutManager from '../components/DynamicWarehouseLayoutManager';
import UserManagementPanel from '../components/UserManagementPanel';
import VehicleManagement from './VehicleManagement';
import PredictionsTab from '../components/PredictionsTab';

const OwnerDashboard = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data states
  const [stats, setStats] = useState(null);
  const [customers, setCustomers] = useState([]);

  // Dialog states
  const [allocationDialog, setAllocationDialog] = useState(false);

  // AI Inventory Analysis states
  const [aiInventoryDialog, setAiInventoryDialog] = useState(false);
  const [aiInventoryLoading, setAiInventoryLoading] = useState(false);
  const [aiInventoryResult, setAiInventoryResult] = useState(null);
  const [aiInventoryError, setAiInventoryError] = useState('');
  const [aiInventorySummary, setAiInventorySummary] = useState(null);

  // Form states
  const [allocationForm, setAllocationForm] = useState({
    customerId: '',
    warehouseId: '',
    allocation: {
      building: 1,
      block: 1,
      wing: 'left',
      box: 1
    },
    storageDetails: {
      type: 'dry',
      totalWeight: 0,
      totalVolume: 0
    },
    duration: {
      endDate: ''
    },
    pricing: {
      baseRate: 100,
      ratePerDay: 50
    }
  });

  useAuth();
  const { addNotification, socket } = useSocket();

  useEffect(() => {
    fetchDashboardData();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // dummy re-init to keep socket listener (real effect below)
  useEffect(() => {
    if (socket) {
      socket.on('payment_received', (data) => {
        console.log('Payment received notification:', data);
        
        // Show notification
        addNotification({
          type: 'payment',
          title: 'Payment Received',
          message: `₹${data.amount} received from ${data.customerName} for ${data.type}`,
          timestamp: new Date(data.timestamp)
        });
        
        // Optionally refresh dashboard data
        fetchDashboardData();
      });

      socket.on('allocation_request_created', (data) => {
        console.log('Allocation request notification:', data);

        addNotification({
          type: 'warning',
          title: 'Storage Allocation Pending',
          message: `${data.customerName || 'Customer'} paid for vehicle ${data.vehicleNumber || 'N/A'}. Please allocate storage now.`,
          timestamp: new Date(data.timestamp)
        });

        fetchDashboardData();
      });
    }
    
    return () => {
      if (socket) {
        socket.off('payment_received');
        socket.off('allocation_request_created');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const [
        vehicleStatsRes,
        customersRes
      ] = await Promise.all([
        axios.get('/api/vehicles/stats/dashboard'),
        axios.get('/api/customers')
      ]);

      setStats(vehicleStatsRes.data);
      setCustomers(customersRes.data.customers);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };



  const handleAllocateStorage = async () => {
    try {
      await axios.post('/api/warehouse/allocate', allocationForm);
      
      setSuccess('Storage allocated successfully!');
      setAllocationDialog(false);
      fetchDashboardData();
      
      addNotification({
        type: 'success',
        title: 'Storage Allocated',
        message: 'Storage space allocated to customer',
        timestamp: new Date()
      });
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to allocate storage');
    }
  };

  const handleAiInventoryAnalysis = async () => {
    try {
      setAiInventoryLoading(true);
      setAiInventoryError('');
      setAiInventoryResult(null);
      setAiInventorySummary(null);

      // Step 1: Fetch warehouse inventory summary from server
      const token = localStorage.getItem('token');
      const summaryRes = await axios.get('/api/dynamic-warehouse/inventory-summary', {
        headers: { 'x-auth-token': token }
      });

      const summary = summaryRes.data.summary;
      setAiInventorySummary(summary);

      // Step 2: Send summary to AI engine via backend (routed through n8n)
      const token2 = localStorage.getItem('token');
      const aiResponse = await axios.post('/api/ai/inventory/analyze', {
        action: 'analyze'
      }, {
        headers: { 'x-auth-token': token2 }
      });
      setAiInventoryResult(aiResponse.data);
    } catch (err) {
      console.error('AI Inventory Analysis error:', err);
      setAiInventoryError(err.response?.data?.message || err.response?.data?.detail || 'Failed to fetch warehouse data. Please make sure the server is running.');
    } finally {
      setAiInventoryLoading(false);
    }
  };



  const handleExportData = async (type) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/exports/${type}`);
      
      if (response.data.success) {
        // Create download link for the generated Excel file
        const link = document.createElement('a');
        link.href = response.data.url;
        link.setAttribute('download', response.data.filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        
        setSuccess(`${type.replace('-', ' ')} exported successfully! (${response.data.recordCount} records)`);
      } else {
        setError('Failed to export data');
      }
    } catch (error) {
      console.error('Export error:', error);
      setError(error.response?.data?.message || 'Failed to export data');
    } finally {
      setLoading(false);
    }
  };





  const handleComprehensiveReport = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/exports/comprehensive-report');
      
      if (response.data.success) {
        const link = document.createElement('a');
        link.href = response.data.url;
        link.setAttribute('download', response.data.filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        
        setSuccess(`Comprehensive report exported successfully! (${response.data.totalRecords} total records)`);
      }
    } catch (error) {
      setError('Failed to export comprehensive report');
    } finally {
      setLoading(false);
    }
  };

  const handleDailyReport = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const response = await axios.get(`/api/exports/daily-report?date=${today}`);
      
      if (response.data.success) {
        const link = document.createElement('a');
        link.href = response.data.url;
        link.setAttribute('download', response.data.filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        
        setSuccess(`Daily report exported successfully!`);
      }
    } catch (error) {
      setError('Failed to export daily report');
    } finally {
      setLoading(false);
    }
  };

  const StatsCards = () => (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ borderLeft: '4px solid #1976d2' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <LocalShipping color="primary" sx={{ fontSize: 40, mr: 2 }} />
              <Box>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  {t('dashboard.totalVehicles')}
                </Typography>
                <Typography variant="h4">
                  {stats?.totalVehicles || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Loading / Unloading / Weighing
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ borderLeft: '4px solid #ed6c02' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Warehouse color="warning" sx={{ fontSize: 40, mr: 2 }} />
              <Box>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  {t('dashboard.currentlyInside')}
                </Typography>
                <Typography variant="h4">
                  {stats?.currentlyInside || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Vehicles for Loading / Unloading
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ borderLeft: '4px solid #0288d1' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <People color="info" sx={{ fontSize: 40, mr: 2 }} />
              <Box>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  {t('dashboard.totalCustomers')}
                </Typography>
                <Typography variant="h4">
                  {customers?.length || stats?.totalCustomers || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Available Customers Till Date
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ borderLeft: '4px solid #2e7d32' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CurrencyRupee color="success" sx={{ fontSize: 40, mr: 2 }} />
              <Box>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  {t('dashboard.totalEntries')}
                </Typography>
                <Typography variant="h4">
                  {stats?.totalEntries || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total In & Out Entries
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );





  const WarehouseTransactions = () => {
    const [transactions, setTransactions] = useState([]);
    const [transactionFilter, setTransactionFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('today');
    const [viewDialogOpen, setViewDialogOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    // Anomaly scan state
    const [anomalyScanLoading, setAnomalyScanLoading] = useState(false);
    const [anomalyScanResults, setAnomalyScanResults] = useState(null);
    const [anomalyScanError, setAnomalyScanError] = useState(null);
    const [anomalyPanelOpen, setAnomalyPanelOpen] = useState(true);

    useEffect(() => {
      fetchTransactions();
      runAnomalyScan();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transactionFilter, dateFilter]);

    const runAnomalyScan = async () => {
      try {
        setAnomalyScanLoading(true);
        setAnomalyScanError(null);
        setAnomalyPanelOpen(true);
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/ai/anomaly/alerts', {
          headers: { 'x-auth-token': token }
        });
        const data = response.data;
        const alerts = data?.data?.alerts || data?.alerts || data?.data || data || [];
        setAnomalyScanResults(Array.isArray(alerts) ? alerts : (alerts ? [alerts] : []));
      } catch (err) {
        setAnomalyScanError(err.response?.data?.message || 'Anomaly scan failed. Ensure AI engine and n8n are running.');
        setAnomalyScanResults([]);
      } finally {
        setAnomalyScanLoading(false);
      }
    };

    const handleViewTransaction = (transaction) => {
      setSelectedTransaction(transaction);
      setViewDialogOpen(true);
    };

    const handleCloseDialog = () => {
      setViewDialogOpen(false);
      setSelectedTransaction(null);
    };

    const formatDateTime = (date) => {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    };

    const getDateRange = () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (dateFilter) {
        case 'today':
          return {
            startDate: today.toISOString(),
            endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
          };
        case 'yesterday':
          const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
          return {
            startDate: yesterday.toISOString(),
            endDate: today.toISOString()
          };
        case 'last_week':
          const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          return {
            startDate: lastWeek.toISOString(),
            endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
          };
        case 'last_month':
          const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          return {
            startDate: lastMonth.toISOString(),
            endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
          };
        case 'all':
          return null;
        default:
          return {
            startDate: today.toISOString(),
            endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
          };
      }
    };

    const fetchTransactions = async () => {
      try {
        const params = new URLSearchParams();
        if (transactionFilter !== 'all') params.append('type', transactionFilter);
        
        const dateRange = getDateRange();
        if (dateRange) {
          params.append('startDate', dateRange.startDate);
          params.append('endDate', dateRange.endDate);
        }
        
        const response = await axios.get(`/api/transactions?${params}`);
        setTransactions(response.data.transactions || []);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setTransactions([]); // Set empty array as fallback
      }
    };

    const getTransactionIcon = (type) => {
      switch (type) {
        case 'weighbridge_fee': return <Scale />;
        case 'loan_repayment': return <MonetizationOn />;
        case 'grain_storage_rent': return <Home />;
        case 'grain_loan': return <MonetizationOn />;
        case 'grain_release': return <Inventory />;
        default: return <CurrencyRupee />;
      }
    };

    const getTransactionColor = (type) => {
      switch (type) {
        case 'weighbridge_fee': return 'primary';
        case 'loan_repayment': return 'success';
        case 'grain_storage_rent': return 'warning';
        case 'grain_loan': return 'info';
        case 'grain_release': return 'secondary';
        default: return 'default';
      }
    };

    return (
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            <CurrencyRupee sx={{ mr: 1 }} />
            Warehouse Transactions
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Tooltip title="Run AI fraud & anomaly scan across all transactions">
              <Button
                variant="outlined"
                size="small"
                startIcon={anomalyScanLoading ? <CircularProgress size={16} /> : <Security />}
                onClick={runAnomalyScan}
                disabled={anomalyScanLoading}
                sx={{ borderColor: '#795548', color: '#795548', '&:hover': { borderColor: '#5d4037', backgroundColor: '#efebe9' } }}
              >
                {anomalyScanLoading ? 'Scanning...' : 'Anomaly Scan'}
              </Button>
            </Tooltip>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Date Range</InputLabel>
              <Select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                label="Date Range"
              >
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="yesterday">Yesterday</MenuItem>
                <MenuItem value="last_week">Last 7 Days</MenuItem>
                <MenuItem value="last_month">Last 30 Days</MenuItem>
                <MenuItem value="all">All Time</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Filter</InputLabel>
              <Select
                value={transactionFilter}
                onChange={(e) => setTransactionFilter(e.target.value)}
                label="Filter"
              >
                <MenuItem value="all">All Transactions</MenuItem>
                <MenuItem value="weighbridge_fee">Weighbridge Fees</MenuItem>
                <MenuItem value="loan_repayment">Loan Repayments</MenuItem>
                <MenuItem value="grain_storage_rent">Storage Rent</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => handleExportData('transactions')}
            >
              Export
            </Button>
          </Box>
        </Box>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary">
                  ₹{transactions.reduce((sum, t) => sum + (t.amount?.totalAmount || t.amount?.baseAmount || t.amount || 0), 0).toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Revenue Today
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="success.main">
                  {transactions.filter(t => t.type === 'weighbridge_fee').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Weighbridge Transactions
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="warning.main">
                  {transactions.filter(t => t.type === 'loan_repayment').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Loan Repayments
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="info.main">
                  {transactions.filter(t => t.type === 'grain_storage_rent').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Storage Rent Payments
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* ── AI Anomaly Detection Panel ── */}
        <Paper
          sx={{
            mb: 3,
            border: '1px solid',
            borderColor: anomalyScanLoading ? '#bdbdbd'
              : anomalyScanError ? '#f44336'
              : anomalyScanResults && anomalyScanResults.length > 0 ? '#ff9800'
              : anomalyScanResults !== null ? '#4caf50'
              : '#795548',
            overflow: 'hidden'
          }}
        >
          <Box
            sx={{
              px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
              background: anomalyScanLoading ? 'linear-gradient(135deg,#546e7a 0%,#795548 100%)'
                : anomalyScanError ? 'linear-gradient(135deg,#c62828 0%,#b71c1c 100%)'
                : anomalyScanResults && anomalyScanResults.length > 0 ? 'linear-gradient(135deg,#e65100 0%,#ff9800 100%)'
                : anomalyScanResults !== null ? 'linear-gradient(135deg,#2e7d32 0%,#388e3c 100%)'
                : 'linear-gradient(135deg,#37474f 0%,#795548 100%)',
              color: '#fff'
            }}
            onClick={() => setAnomalyPanelOpen(p => !p)}
          >
            {anomalyScanLoading
              ? <CircularProgress size={20} sx={{ color: '#fff' }} />
              : anomalyScanError ? <ErrorIcon fontSize="small" />
              : anomalyScanResults && anomalyScanResults.length > 0 ? <Warning fontSize="small" />
              : <Shield fontSize="small" />}
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', flex: 1 }}>
              {anomalyScanLoading
                ? 'AI Anomaly Detection — Scanning transactions...'
                : anomalyScanError
                  ? 'AI Anomaly Detection — Scan failed'
                  : anomalyScanResults && anomalyScanResults.length > 0
                    ? `⚠️ AI Anomaly Detection — ${anomalyScanResults.length} suspicious pattern${anomalyScanResults.length > 1 ? 's' : ''} found`
                    : '✅ AI Anomaly Detection — No anomalies detected'}
            </Typography>
            <Chip label="n8n + Gemini AI" size="small" sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.7rem' }} />
            <Tooltip title="Re-scan">
              <IconButton size="small" sx={{ color: '#fff' }} onClick={e => { e.stopPropagation(); runAnomalyScan(); }} disabled={anomalyScanLoading}>
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
            {anomalyPanelOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </Box>
          {anomalyScanLoading && <LinearProgress color="warning" />}
          <Collapse in={anomalyPanelOpen}>
            <Box sx={{ p: 2 }}>
              {anomalyScanLoading && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
                  <CircularProgress size={24} sx={{ color: '#795548' }} />
                  <Typography variant="body2" color="text.secondary">
                    Analysing transaction patterns, payment anomalies and fraud indicators...
                  </Typography>
                </Box>
              )}
              {!anomalyScanLoading && anomalyScanError && (
                <Alert severity="error" action={<Button size="small" onClick={runAnomalyScan}>Retry</Button>}>
                  {anomalyScanError}
                </Alert>
              )}
              {!anomalyScanLoading && !anomalyScanError && anomalyScanResults !== null && anomalyScanResults.length === 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CheckCircle sx={{ color: '#4caf50' }} />
                  <Typography variant="body2" color="text.secondary">
                    All transactions look normal. No suspicious patterns or fraud indicators detected.
                  </Typography>
                </Box>
              )}
              {!anomalyScanLoading && !anomalyScanError && anomalyScanResults && anomalyScanResults.length > 0 && (
                <Grid container spacing={2}>
                  {anomalyScanResults.map((item, idx) => {
                    const sev = (item.severity || item.priority || item.level || '').toLowerCase();
                    const muiSev = ['critical','high','error'].includes(sev) ? 'error' : ['medium','warning'].includes(sev) ? 'warning' : 'info';
                    const borderColor = muiSev === 'error' ? '#f44336' : muiSev === 'warning' ? '#ff9800' : '#2196f3';
                    const bgColor = muiSev === 'error' ? '#ffebee' : muiSev === 'warning' ? '#fff3e0' : '#e3f2fd';
                    return (
                      <Grid item xs={12} md={6} key={idx}>
                        <Paper sx={{ p: 2, borderLeft: `4px solid ${borderColor}`, backgroundColor: bgColor }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {item.title || item.type || item.category || `Anomaly #${idx + 1}`}
                            </Typography>
                            {sev && <Chip label={sev.toUpperCase()} size="small" color={muiSev === 'error' ? 'error' : muiSev === 'warning' ? 'warning' : 'info'} />}
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {item.message || item.description || item.summary || JSON.stringify(item)}
                          </Typography>
                          {item.details && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                              {typeof item.details === 'string' ? item.details : JSON.stringify(item.details)}
                            </Typography>
                          )}
                          <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {item.entity && <Chip label={`Entity: ${item.entity}`} size="small" variant="outlined" />}
                            {item.transactionId && <Chip label={`TXN: ${item.transactionId}`} size="small" variant="outlined" color="warning" />}
                            {item.confidence != null && <Chip label={`Confidence: ${item.confidence}%`} size="small" variant="outlined" />}
                          </Box>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </Box>
          </Collapse>
        </Paper>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction._id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Chip
                        icon={getTransactionIcon(transaction.type)}
                        label={transaction.type?.replace('_', ' ').toUpperCase()}
                        color={getTransactionColor(transaction.type)}
                        size="small"
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {transaction.customer?.profile?.firstName} {transaction.customer?.profile?.lastName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {transaction.customer?.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      ₹{(transaction.amount?.totalAmount || transaction.amount?.baseAmount || transaction.amount || 0).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDateTime(transaction.createdAt || transaction.payment?.date)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={(transaction.payment?.status || transaction.status || 'pending').toUpperCase()}
                      color={(transaction.payment?.status || transaction.status) === 'completed' ? 'success' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="small" 
                      startIcon={<Visibility />}
                      onClick={() => handleViewTransaction(transaction)}
                      variant="outlined"
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {transactions.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CurrencyRupee sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No transactions found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Transactions will appear here as customers make payments
            </Typography>
          </Box>
        )}

        {/* Transaction Details Dialog */}
        <Dialog open={viewDialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h6">Transaction Details</Typography>
              {selectedTransaction && selectedTransaction.type && (
                <Chip
                  icon={getTransactionIcon(selectedTransaction.type)}
                  label={selectedTransaction.type.replace(/_/g, ' ').toUpperCase()}
                  color={getTransactionColor(selectedTransaction.type)}
                />
              )}
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            {selectedTransaction && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                    <Typography variant="caption" color="text.secondary">Transaction ID</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {selectedTransaction.transactionId || selectedTransaction._id}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                    <Typography variant="caption" color="text.secondary">Date & Time</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {formatDateTime(selectedTransaction.createdAt || selectedTransaction.payment?.date)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                    <Typography variant="caption" color="text.secondary">Customer</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {selectedTransaction.customer?.profile?.firstName} {selectedTransaction.customer?.profile?.lastName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedTransaction.customer?.email}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        label={(selectedTransaction.payment?.status || selectedTransaction.status || 'pending').toUpperCase()}
                        color={(selectedTransaction.payment?.status || selectedTransaction.status) === 'completed' ? 'success' : 'warning'}
                        size="small"
                      />
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, backgroundColor: 'success.50' }}>
                    <Typography variant="caption" color="text.secondary">Base Amount</Typography>
                    <Typography variant="h6" color="success.main" fontWeight="bold">
                      ₹{(selectedTransaction.amount?.baseAmount || selectedTransaction.amount || 0).toLocaleString()}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, backgroundColor: 'primary.50' }}>
                    <Typography variant="caption" color="text.secondary">Total Amount</Typography>
                    <Typography variant="h6" color="primary.main" fontWeight="bold">
                      ₹{(selectedTransaction.amount?.totalAmount || selectedTransaction.amount?.baseAmount || selectedTransaction.amount || 0).toLocaleString()}
                    </Typography>
                  </Paper>
                </Grid>
                {selectedTransaction.payment?.method && (
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                      <Typography variant="caption" color="text.secondary">Payment Method</Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {selectedTransaction.payment.method.toUpperCase()}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
                {selectedTransaction.payment?.reference && (
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                      <Typography variant="caption" color="text.secondary">Payment Reference</Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {selectedTransaction.payment.reference}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
                {selectedTransaction.metadata?.notes && (
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                      <Typography variant="caption" color="text.secondary">Notes</Typography>
                      <Typography variant="body2">
                        {selectedTransaction.metadata.notes}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Close</Button>
          </DialogActions>
        </Dialog>
      </Paper>
    );
  };

  // eslint-disable-next-line no-unused-vars
  const ReportsAnalytics = () => (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Reports & Analytics
      </Typography>
      
      <Grid container spacing={3}>
        {/* Quick Export Section */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2, mb: 2 }}>
            📊 Quick Data Exports
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Download />}
                onClick={() => handleExportData('transactions')}
                disabled={loading}
              >
                Export Transactions
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Download />}
                onClick={() => handleExportData('customers')}
                disabled={loading}
              >
                Export Customers
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Download />}
                onClick={() => handleExportData('vehicles')}
                disabled={loading}
              >
                Export Vehicles
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Download />}
                onClick={() => handleExportData('storage-allocations')}
                disabled={loading}
              >
                Export Storage
              </Button>
            </Grid>
          </Grid>
        </Grid>

        {/* Special Reports Section */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 3, mb: 2 }}>
            📈 Special Reports
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                color="primary"
                startIcon={<Analytics />}
                onClick={handleDailyReport}
                disabled={loading}
              >
                Today's Report
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                startIcon={<Analytics />}
                onClick={handleComprehensiveReport}
                disabled={loading}
              >
                Comprehensive Report
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                color="info"
                startIcon={<Download />}
                onClick={() => {
                  const startDate = new Date();
                  startDate.setDate(startDate.getDate() - 7);
                  const endDate = new Date();
                  const start = startDate.toISOString().split('T')[0];
                  const end = endDate.toISOString().split('T')[0];
                  handleExportData(`transactions?startDate=${start}&endDate=${end}`);
                }}
                disabled={loading}
              >
                Weekly Report
              </Button>
            </Grid>
          </Grid>
        </Grid>

        {/* Analytics Cards */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 3, mb: 2 }}>
            📊 Analytics Overview
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <LocalShipping color="primary" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h6" color="primary">
                    {stats?.totalVehicles || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Vehicles
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <People color="success" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h6" color="success.main">
                    {customers?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Customers
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <CurrencyRupee color="info" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h6" color="info.main">
                    ₹{stats?.totalRevenue || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Revenue
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* File Management */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 3, mb: 2 }}>
            📁 File Management
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            All files are stored locally in the ./uploads directory. Export files are automatically cleaned after 24 hours.
          </Alert>
          <Button
            variant="text"
            color="warning"
            onClick={() => {
              axios.delete('/api/exports/cleanup')
                .then(() => setSuccess('Old export files cleaned successfully'))
                .catch(() => setError('Failed to clean export files'));
            }}
          >
            🗑️ Clean Old Export Files
          </Button>
        </Grid>
      </Grid>
    </Paper>
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
      <Typography variant="h4" gutterBottom>
        {t('dashboard.ownerDashboard')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <StatsCards />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} variant="scrollable" scrollButtons="auto">
          <Tab label={t('dashboard.warehouseLayoutManager')} />
          <Tab label={t('dashboard.userManagement')} />
          <Tab label={t('dashboard.vehicleManagement')} />
          <Tab label={t('dashboard.transactions')} />
          <Tab label={t('dashboard.analytics')} />
          <Tab label={t('dashboard.predictions')} />
          <Tab label={t('dashboard.loanPortfolio')} />
          <Tab label={t('dashboard.alertsCenter')} />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<SmartToy />}
              onClick={() => setAiInventoryDialog(true)}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                fontWeight: 600,
                '&:hover': { background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4299 100%)' }
              }}
            >
              🤖 AI Inventory Analysis
            </Button>
          </Box>
          <DynamicWarehouseLayoutManager />
        </>
      )}
      {activeTab === 1 && <UserManagementPanel />}
      {activeTab === 2 && <VehicleManagement onVehicleStatusChange={fetchDashboardData} />}
      {activeTab === 3 && <WarehouseTransactions />}
      {activeTab === 4 && <CombinedAnalytics />}
      {activeTab === 5 && <PredictionsTab />}
      {activeTab === 6 && <LoanPortfolioManager />}
      {activeTab === 7 && <AlertsCenter />}

      {/* AI Inventory Analysis Dialog */}
      <Dialog open={aiInventoryDialog} onClose={() => { setAiInventoryDialog(false); setAiInventoryResult(null); setAiInventoryError(''); setAiInventorySummary(null); }} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <SmartToy />
          <Box component="span" sx={{ fontWeight: 700, fontSize: '1.2rem' }}>AI Warehouse Inventory Analysis</Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {/* Auto-analyze button */}
          {!aiInventorySummary && !aiInventoryLoading && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                Click below to analyze your warehouse spaces. The AI will scan all warehouses and show you filled, partially filled, and empty slots.
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={handleAiInventoryAnalysis}
                startIcon={<Psychology />}
                sx={{ px: 4, py: 1.5, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontWeight: 600 }}
              >
                Scan All Warehouses
              </Button>
            </Box>
          )}

          {aiInventoryLoading && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={48} sx={{ color: '#667eea' }} />
              <Typography variant="body1" sx={{ mt: 2, color: 'text.secondary' }}>Scanning warehouse spaces...</Typography>
            </Box>
          )}

          {aiInventoryError && (
            <Alert severity="error" sx={{ mb: 2 }}>{aiInventoryError}</Alert>
          )}

          {/* Warehouse Summary Data */}
          {aiInventorySummary && (
            <Box>
              {/* Overall Stats Cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e3f2fd', borderRadius: 2 }}>
                    <Warehouse sx={{ fontSize: 32, color: '#1565c0' }} />
                    <Typography variant="h4" fontWeight="bold" color="#1565c0">{aiInventorySummary.totalSlots}</Typography>
                    <Typography variant="caption" color="text.secondary">Total Slots</Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fce4ec', borderRadius: 2 }}>
                    <Inventory sx={{ fontSize: 32, color: '#c62828' }} />
                    <Typography variant="h4" fontWeight="bold" color="#c62828">{aiInventorySummary.filledSlots}</Typography>
                    <Typography variant="caption" color="text.secondary">Full Slots</Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fff3e0', borderRadius: 2 }}>
                    <GridView sx={{ fontSize: 32, color: '#e65100' }} />
                    <Typography variant="h4" fontWeight="bold" color="#e65100">{aiInventorySummary.partiallyFilledSlots}</Typography>
                    <Typography variant="caption" color="text.secondary">Partially Filled</Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e8f5e9', borderRadius: 2 }}>
                    <Add sx={{ fontSize: 32, color: '#2e7d32' }} />
                    <Typography variant="h4" fontWeight="bold" color="#2e7d32">{aiInventorySummary.emptySlots}</Typography>
                    <Typography variant="caption" color="text.secondary">Empty Slots</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Overall Utilization Bar */}
              <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold">Overall Utilization</Typography>
                  <Typography variant="subtitle1" fontWeight="bold" color={parseFloat(aiInventorySummary.overallUtilization) > 80 ? 'error.main' : parseFloat(aiInventorySummary.overallUtilization) > 50 ? 'warning.main' : 'success.main'}>
                    {aiInventorySummary.overallUtilization}%
                  </Typography>
                </Box>
                <Box sx={{ width: '100%', bgcolor: '#e0e0e0', borderRadius: 2, height: 20, overflow: 'hidden' }}>
                  <Box sx={{
                    width: `${aiInventorySummary.overallUtilization}%`,
                    bgcolor: parseFloat(aiInventorySummary.overallUtilization) > 80 ? '#c62828' : parseFloat(aiInventorySummary.overallUtilization) > 50 ? '#e65100' : '#2e7d32',
                    height: '100%',
                    borderRadius: 2,
                    transition: 'width 0.5s ease'
                  }} />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {aiInventorySummary.totalFilledBags.toLocaleString()} / {aiInventorySummary.totalCapacityBags.toLocaleString()} bags filled
                </Typography>
              </Paper>

              {/* Grain Distribution */}
              {Object.keys(aiInventorySummary.grainDistribution).length > 0 && (
                <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Grain Distribution</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {Object.entries(aiInventorySummary.grainDistribution).map(([grain, bags]) => (
                      <Chip
                        key={grain}
                        label={`${grain}: ${bags.toLocaleString()} bags`}
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    ))}
                  </Box>
                </Paper>
              )}

              {/* Customer Distribution */}
              {Object.keys(aiInventorySummary.customerDistribution).length > 0 && (
                <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Customer Storage</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {Object.entries(aiInventorySummary.customerDistribution).map(([name, bags]) => (
                      <Chip
                        key={name}
                        label={`${name}: ${bags.toLocaleString()} bags`}
                        color="secondary"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    ))}
                  </Box>
                </Paper>
              )}

              {/* Per-Warehouse Breakdown */}
              {aiInventorySummary.warehouses.map((wh, whIdx) => (
                <Paper key={whIdx} sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid #e0e0e0' }}>
                  <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
                    {wh.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                    <Chip size="small" label={`Total: ${wh.totalSlots}`} />
                    <Chip size="small" label={`Full: ${wh.filledSlots}`} color="error" />
                    <Chip size="small" label={`Partial: ${wh.partiallyFilledSlots}`} color="warning" />
                    <Chip size="small" label={`Empty: ${wh.emptySlots}`} color="success" />
                    <Chip size="small" label={`${wh.totalFilledBags.toLocaleString()} / ${wh.totalCapacityBags.toLocaleString()} bags`} variant="outlined" />
                  </Box>

                  {wh.buildings.map((bld, bldIdx) => (
                    <Box key={bldIdx} sx={{ ml: 1, mb: 1 }}>
                      <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>
                        📦 {bld.name}
                      </Typography>
                      {bld.blocks.map((blk, blkIdx) => (
                        <Box key={blkIdx} sx={{ ml: 2, mb: 1 }}>
                          <Typography variant="caption" fontWeight="bold" color="text.secondary">
                            Block {blk.name} ({blk.totalSlots} slots)
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                            {/* Show filled slots */}
                            {blk.filledSlots.map((slot, sIdx) => (
                              <Tooltip key={`f-${sIdx}`} title={
                                <Box>
                                  <div><strong>{slot.label}</strong> — FULL</div>
                                  <div>{slot.filledBags}/{slot.capacity} bags ({slot.utilization}%)</div>
                                  {slot.allocations.map((a, ai) => (
                                    <div key={ai}>{a.customerName}: {a.bags} bags ({a.grainType})</div>
                                  ))}
                                </Box>
                              }>
                                <Box sx={{
                                  width: 36, height: 36, borderRadius: 1,
                                  bgcolor: '#c62828', color: 'white',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer'
                                }}>
                                  {slot.label}
                                </Box>
                              </Tooltip>
                            ))}
                            {/* Show partially filled slots */}
                            {blk.partiallyFilledSlots.map((slot, sIdx) => (
                              <Tooltip key={`p-${sIdx}`} title={
                                <Box>
                                  <div><strong>{slot.label}</strong> — PARTIAL</div>
                                  <div>{slot.filledBags}/{slot.capacity} bags ({slot.utilization}%)</div>
                                  {slot.allocations.map((a, ai) => (
                                    <div key={ai}>{a.customerName}: {a.bags} bags ({a.grainType})</div>
                                  ))}
                                </Box>
                              }>
                                <Box sx={{
                                  width: 36, height: 36, borderRadius: 1,
                                  bgcolor: '#ff9800', color: 'white',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer'
                                }}>
                                  {slot.label}
                                </Box>
                              </Tooltip>
                            ))}
                            {/* Show empty slots */}
                            {blk.emptySlots.map((slot, sIdx) => (
                              <Tooltip key={`e-${sIdx}`} title={`${slot.label} — EMPTY (0/${slot.capacity} bags)`}>
                                <Box sx={{
                                  width: 36, height: 36, borderRadius: 1,
                                  bgcolor: '#e8f5e9', color: '#2e7d32',
                                  border: '1px solid #a5d6a7',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer'
                                }}>
                                  {slot.label}
                                </Box>
                              </Tooltip>
                            ))}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  ))}
                </Paper>
              ))}

              {/* AI Insights */}
              {aiInventoryResult?.data && (
                <Paper sx={{ p: 2, borderRadius: 2, bgcolor: '#f3e5f5', border: '1px solid #ce93d8' }}>
                  <Typography variant="subtitle1" fontWeight="bold" color="#6a1b9a" gutterBottom>
                    🤖 AI Insights
                  </Typography>
                  {aiInventoryResult.data.healthScore != null && (
                    <Chip label={`Health Score: ${aiInventoryResult.data.healthScore}/100`} color="primary" sx={{ mb: 1, mr: 1, fontWeight: 700 }} />
                  )}
                  {aiInventoryResult.data.utilization != null && (
                    <Chip label={`AI Est. Utilization: ${aiInventoryResult.data.utilization}%`} color="secondary" sx={{ mb: 1, mr: 1, fontWeight: 700 }} />
                  )}
                  {aiInventoryResult.data.insights && aiInventoryResult.data.insights.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" fontWeight="bold" gutterBottom>Insights:</Typography>
                      {aiInventoryResult.data.insights.map((insight, idx) => (
                        <Alert key={idx} severity="info" sx={{ mb: 0.5, py: 0 }}>{insight}</Alert>
                      ))}
                    </Box>
                  )}
                  {aiInventoryResult.data.recommendations && aiInventoryResult.data.recommendations.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" fontWeight="bold" gutterBottom>Recommendations:</Typography>
                      {aiInventoryResult.data.recommendations.map((rec, idx) => (
                        <Alert key={idx} severity="success" sx={{ mb: 0.5, py: 0 }}>{rec}</Alert>
                      ))}
                    </Box>
                  )}
                  {aiInventoryResult.data.alerts && aiInventoryResult.data.alerts.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" fontWeight="bold" gutterBottom>Alerts:</Typography>
                      {aiInventoryResult.data.alerts.map((alert, idx) => (
                        <Alert key={idx} severity="warning" sx={{ mb: 0.5, py: 0 }}>{alert}</Alert>
                      ))}
                    </Box>
                  )}
                </Paper>
              )}

              {/* Re-scan button */}
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={handleAiInventoryAnalysis}
                  disabled={aiInventoryLoading}
                  startIcon={aiInventoryLoading ? <CircularProgress size={16} /> : <Psychology />}
                >
                  Re-scan Warehouses
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAiInventoryDialog(false); setAiInventoryResult(null); setAiInventoryError(''); setAiInventorySummary(null); }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Storage Allocation Dialog */}
      <Dialog open={allocationDialog} onClose={() => setAllocationDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Allocate Storage Space</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Customer</InputLabel>
                <Select
                  value={allocationForm.customerId}
                  label="Customer"
                  onChange={(e) => setAllocationForm(prev => ({ ...prev, customerId: e.target.value }))}
                >
                  {customers.map((customer) => (
                    <MenuItem key={customer._id} value={customer._id}>
                      {customer.profile?.firstName} {customer.profile?.lastName} (@{customer.username})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Building"
                value={allocationForm.allocation.building}
                onChange={(e) => setAllocationForm(prev => ({
                  ...prev,
                  allocation: { ...prev.allocation, building: parseInt(e.target.value) }
                }))}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Block"
                value={allocationForm.allocation.block}
                onChange={(e) => setAllocationForm(prev => ({
                  ...prev,
                  allocation: { ...prev.allocation, block: parseInt(e.target.value) }
                }))}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Wing</InputLabel>
                <Select
                  value={allocationForm.allocation.wing}
                  label="Wing"
                  onChange={(e) => setAllocationForm(prev => ({
                    ...prev,
                    allocation: { ...prev.allocation, wing: e.target.value }
                  }))}
                >
                  <MenuItem value="left">Left</MenuItem>
                  <MenuItem value="right">Right</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Box"
                value={allocationForm.allocation.box}
                onChange={(e) => setAllocationForm(prev => ({
                  ...prev,
                  allocation: { ...prev.allocation, box: parseInt(e.target.value) }
                }))}
                inputProps={{ min: 1, max: 6 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="date"
                label="End Date"
                value={allocationForm.duration.endDate}
                onChange={(e) => setAllocationForm(prev => ({
                  ...prev,
                  duration: { ...prev.duration, endDate: e.target.value }
                }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAllocationDialog(false)}>Cancel</Button>
          <Button onClick={handleAllocateStorage} variant="contained">
            Allocate Storage
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default OwnerDashboard;