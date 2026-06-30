import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Badge,
  Button,  MenuItem,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemButton,
  Grid
} from '@mui/material';
import {
  Refresh,
  Notifications,
  Error as ErrorIcon,
  Warning,
  Info,
  CheckCircle,  MarkEmailRead,
  Delete,
  Email as EmailIcon,
  Send,
  MailOutline,
  Psychology,
  AlarmOn
} from '@mui/icons-material';
import { useTranslation } from '../i18n/LanguageContext';
import axios from 'axios';

const AlertsCenter = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [refreshing, setRefreshing] = useState(false);  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [customersList, setCustomersList] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [emailData, setEmailData] = useState({
    alertType: 'info',
    subject: '',
    message: ''
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [loanDueAlerts, setLoanDueAlerts] = useState([]);
  const [loadingDueLoans, setLoadingDueLoans] = useState(false);

  const fetchAlerts = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      
      // Fetch both regular alerts and prediction alerts
      const [alertsResponse, predictionsResponse] = await Promise.all([
        axios.get('/api/analytics/owner/alerts', {
          headers: { 'x-auth-token': token }
        }),
        axios.get('/api/predictions/dashboard-predictions', {
          headers: { 'x-auth-token': token }
        }).catch(() => ({ data: { alerts: [] } })) // Fallback if predictions service is down
      ]);
      
      // Merge alerts from both sources
      const combinedAlerts = {
        ...alertsResponse.data,
        predictiveAlerts: predictionsResponse.data.alerts || [],
        marketAlerts: []
      };
      
      // Fetch market alerts
      try {
        const marketResponse = await axios.get('/api/predictions/market-alerts', {
          headers: { 'x-auth-token': token }
        });
        combinedAlerts.marketAlerts = marketResponse.data.alerts || [];
      } catch (err) {
        console.log('Market alerts unavailable');
      }
      
      setAlerts(combinedAlerts);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch alerts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCustomersList = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/analytics/owner/customers-list', {
        headers: { 'x-auth-token': token }
      });
      setCustomersList(response.data.customers || []);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    }
  };

  const handleOpenEmailDialog = () => {
    fetchCustomersList();
    setEmailDialogOpen(true);
    setEmailResult(null);
  };

  const handleOpenLoanReminderDialog = async () => {
    setLoadingDueLoans(true);
    setEmailResult(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/email/loan-due-customers', { headers: { 'x-auth-token': token } });
      const dueCusts = res.data.customers || [];
      if (dueCusts.length === 0) {
        alert('No customers have loans due within the next 7 days.');
        return;
      }
      // Build customersList with due-loan details
      setCustomersList(dueCusts.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        daysLeft: c.daysLeft,
        remainingAmount: c.remainingAmount,
        dueDate: c.dueDate
      })));
      setSelectedCustomers(dueCusts.map(c => c.id.toString()));
      setLoanDueAlerts(dueCusts);
      setEmailDialogOpen(true);
    } catch (err) {
      alert('Failed to fetch due loan customers.');
    } finally {
      setLoadingDueLoans(false);
    }
  };

  const handleAiGenerate = async () => {
    setAiGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const loanCustomers = customersList
        .filter(c => selectedCustomers.includes(c.id?.toString() || c.id))
        .map(c => ({
          name: c.name,
          email: c.email,
          remainingAmount: c.remainingAmount || 0,
          dueDate: c.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          daysLeft: c.daysLeft || 7
        }));
      const res = await axios.post('/api/email/ai-generate-reminder', { loanCustomers }, { headers: { 'x-auth-token': token } });
      setEmailData(prev => ({ ...prev, subject: res.data.subject || '', message: res.data.message || '' }));
    } catch (err) {
      alert('AI generation failed. Please write the message manually.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCloseEmailDialog = () => {
    setEmailDialogOpen(false);
    setSelectedCustomers([]);
    setEmailData({ alertType: 'info', subject: '', message: '' });
    setEmailResult(null);
  };

  const handleCustomerToggle = (customerId) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCustomers.length === customersList.filter(c => c.email).length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(customersList.filter(c => c.email).map(c => c.id));
    }
  };

  const handleSendEmail = async () => {
    if (!emailData.message.trim()) {
      alert('Please enter a message');
      return;
    }

    if (!emailData.subject.trim()) {
      alert('Please enter a subject');
      return;
    }

    if (selectedCustomers.length === 0) {
      alert('Please select at least one customer');
      return;
    }

    try {
      setSendingEmail(true);
      const token = localStorage.getItem('token');

      const recipients = customersList
        .filter(c => selectedCustomers.includes(c.id) && c.email)
        .map(c => ({ email: c.email, name: c.name || c.username }));

      if (selectedCustomers.length === 1) {
        // Single email
        const recipient = recipients[0];
        await axios.post('/api/email/send', {
          customerEmail: recipient.email,
          subject: emailData.subject,
          body: emailData.message
        }, {
          headers: { 'x-auth-token': token }
        });
        setEmailResult({ message: 'Email sent successfully', results: { successful: 1, failed: 0, total: 1, details: [{ customerName: recipient.name, email: recipient.email, success: true }] } });
      } else {
        // Bulk email
        const response = await axios.post('/api/email/send-bulk', {
          recipients,
          subject: emailData.subject,
          message: emailData.message
        }, {
          headers: { 'x-auth-token': token }
        });
        setEmailResult(response.data);
      }

      // Auto-close after 3 seconds if all successful
      setTimeout(() => {
        handleCloseEmailDialog();
      }, 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // fetch loan due customers for badge + inline alerts
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/email/loan-due-customers', { headers: { 'x-auth-token': token } });
        setLoanDueAlerts(res.data.customers || []);
      } catch (e) {}
    })();
  }, []);

  const handleRefresh = () => {
    fetchAlerts();
  };

  const handleMarkAsRead = async (alertId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `/api/analytics/owner/alerts/${alertId}/read`,
        {},
        { headers: { 'x-auth-token': token } }
      );
      fetchAlerts();
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  const handleDeleteAlert = async (alertId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/analytics/owner/alerts/${alertId}`, {
        headers: { 'x-auth-token': token }
      });
      fetchAlerts();
    } catch (err) {
      console.error('Failed to delete alert:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        '/api/analytics/owner/alerts/mark-all-read',
        {},
        { headers: { 'x-auth-token': token } }
      );
      fetchAlerts();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const getAlertIcon = (priority) => {
    switch (priority) {
      case 'critical':
        return <ErrorIcon sx={{ color: '#f44336' }} />;
      case 'warning':
        return <Warning sx={{ color: '#ff9800' }} />;
      case 'info':
        return <Info sx={{ color: '#2196f3' }} />;
      default:
        return <CheckCircle sx={{ color: '#4caf50' }} />;
    }
  };

  const getAlertColor = (priority) => {
    switch (priority) {
      case 'critical':
        return '#ffebee';
      case 'warning':
        return '#fff3e0';
      case 'info':
        return '#e3f2fd';
      default:
        return '#f5f5f5';
    }
  };

  const getAlertBorderColor = (priority) => {
    switch (priority) {
      case 'critical':
        return '#f44336';
      case 'warning':
        return '#ff9800';
      case 'info':
        return '#2196f3';
      default:
        return '#9e9e9e';
    }
  };

  const filterAlerts = (alertList, filter) => {
    if (!alertList) return [];
    if (filter === 'all') return alertList;
    return alertList.filter(alert => alert.priority === filter);
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

  if (!alerts) {
    return null;
  }

  const allAlerts = [...(alerts.critical || []), ...(alerts.warnings || []), ...(alerts.info || [])];
  const filteredAlerts = filterAlerts(allAlerts, activeTab);
  const unreadCount = allAlerts.filter(a => !a.read).length;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Badge badgeContent={unreadCount} color="error">
            <Notifications sx={{ fontSize: 32, color: 'primary.main' }} />
          </Badge>
          <Typography variant="h4" component="h1" fontWeight="bold">
            {t('alerts.title')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Send Email to Customers">
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<EmailIcon />}
              onClick={handleOpenEmailDialog}
            >
              Send Email
            </Button>
          </Tooltip>
          <Tooltip title="Send loan payment reminders to customers due within 7 days">
            <Badge badgeContent={loanDueAlerts.length} color="warning">
              <Button
                variant="contained"
                size="small"
                startIcon={loadingDueLoans ? <CircularProgress size={14} color="inherit" /> : <AlarmOn />}
                onClick={handleOpenLoanReminderDialog}
                disabled={loadingDueLoans}
                sx={{ background: 'linear-gradient(135deg, #e65100 0%, #ff9800 100%)' }}
              >
                Loan Reminders
              </Button>
            </Badge>
          </Tooltip>
          <Tooltip title={t('alerts.markAllReadTooltip')}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<MarkEmailRead />}
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0}
            >
              {t('alerts.markAllRead')}
            </Button>
          </Tooltip>
          <Tooltip title={t('common.refresh')}>
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Alert Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 2, flex: 1, minWidth: 200, backgroundColor: '#ffebee', borderLeft: '4px solid #f44336' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ErrorIcon sx={{ fontSize: 32, color: '#f44336' }} />
            <Box>
              <Typography variant="h4" fontWeight="bold" sx={{ color: '#f44336' }}>
                {alerts.critical?.length || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {t('alerts.criticalAlerts')}
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Paper sx={{ p: 2, flex: 1, minWidth: 200, backgroundColor: '#fff3e0', borderLeft: '4px solid #ff9800' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Warning sx={{ fontSize: 32, color: '#ff9800' }} />
            <Box>
              <Typography variant="h4" fontWeight="bold" sx={{ color: '#ff9800' }}>
                {alerts.warnings?.length || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {t('alerts.warnings')}
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Paper sx={{ p: 2, flex: 1, minWidth: 200, backgroundColor: '#e3f2fd', borderLeft: '4px solid #2196f3' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Info sx={{ fontSize: 32, color: '#2196f3' }} />
            <Box>
              <Typography variant="h4" fontWeight="bold" sx={{ color: '#2196f3' }}>
                {alerts.info?.length || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {t('alerts.information')}
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Paper sx={{ p: 2, flex: 1, minWidth: 200, backgroundColor: '#f3e5f5', borderLeft: '4px solid #9c27b0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Warning sx={{ fontSize: 32, color: '#9c27b0' }} />
            <Box>
              <Typography variant="h4" fontWeight="bold" sx={{ color: '#9c27b0' }}>
                {(alerts.predictiveAlerts?.length || 0) + (alerts.marketAlerts?.length || 0)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {t('alerts.mlPredictions')}
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Paper sx={{ p: 2, flex: 1, minWidth: 200, backgroundColor: '#fff3e0', borderLeft: '4px solid #e65100', cursor: loanDueAlerts.length > 0 ? 'pointer' : 'default' }} onClick={loanDueAlerts.length > 0 ? handleOpenLoanReminderDialog : undefined}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AlarmOn sx={{ fontSize: 32, color: '#e65100' }} />
            <Box>
              <Typography variant="h4" fontWeight="bold" sx={{ color: '#e65100' }}>
                {loanDueAlerts.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Loans Due (7 days)
              </Typography>
            </Box>
          </Box>
        </Paper>

      </Box>


      {/* Tabs for filtering */}
      <Card sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="fullWidth"
        >
          <Tab 
            label={
              <Badge badgeContent={allAlerts.length} color="primary">
                {t('alerts.allAlerts')}
              </Badge>
            } 
            value="all" 
          />
          <Tab 
            label={
              <Badge badgeContent={alerts.critical?.length || 0} color="error">
                {t('alerts.critical')}
              </Badge>
            } 
            value="critical" 
          />
          <Tab 
            label={
              <Badge badgeContent={alerts.warnings?.length || 0} color="warning">
                {t('alerts.warningsTab')}
              </Badge>
            } 
            value="warning" 
          />
          <Tab 
            label={
              <Badge badgeContent={alerts.info?.length || 0} color="info">
                {t('alerts.info')}
              </Badge>
            } 
            value="info" 
          />
        </Tabs>
      </Card>

      {/* Alerts List */}
      <Card>
        <CardContent>
          {filteredAlerts.length > 0 ? (
            <List>
              {filteredAlerts.map((alert, index) => (
                <React.Fragment key={index}>
                  <ListItem
                    sx={{
                      backgroundColor: getAlertColor(alert.priority),
                      borderLeft: '4px solid',
                      borderLeftColor: getAlertBorderColor(alert.priority),
                      mb: 2,
                      borderRadius: 1,
                      opacity: alert.read ? 0.6 : 1
                    }}
                    secondaryAction={
                      <Box>
                        {!alert.read && (
                          <Tooltip title={t('alerts.markAsRead')}>
                            <IconButton 
                              edge="end" 
                              size="small"
                              onClick={() => handleMarkAsRead(alert._id)}
                              sx={{ mr: 1 }}
                            >
                              <MarkEmailRead />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title={t('common.delete')}>
                          <IconButton 
                            edge="end" 
                            size="small"
                            onClick={() => handleDeleteAlert(alert._id)}
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    }
                  >
                    <ListItemIcon>
                      {getAlertIcon(alert.priority)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" fontWeight={alert.read ? 'normal' : 'bold'} component="div">
                            {alert.message}
                          </Typography>
                          {!alert.read && (
                            <Chip label={t('alerts.new')} color="error" size="small" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="textSecondary" component="span">
                            {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : 'Just now'}
                          </Typography>
                          {alert.category && (
                            <Chip 
                              label={alert.category}
                              size="small"
                              sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < filteredAlerts.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          ) : (
            <Alert severity="success">
              <Typography variant="body1">
                🎉 {t('alerts.noAlerts')}
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Loan Due Alerts Section */}
      {loanDueAlerts.length > 0 && (
        <Card sx={{ mt: 3, border: '2px solid #ff9800' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <AlarmOn sx={{ color: '#e65100', fontSize: 28 }} />
              <Typography variant="h6" fontWeight="bold" color="#e65100">
                Loan Payments Due — Next 7 Days
              </Typography>
              <Chip
                label={`${loanDueAlerts.length} customer${loanDueAlerts.length > 1 ? 's' : ''}`}
                color="warning"
                size="small"
              />
              <Button
                variant="contained"
                size="small"
                startIcon={<Send />}
                onClick={handleOpenLoanReminderDialog}
                disabled={loadingDueLoans}
                sx={{ ml: 'auto', background: 'linear-gradient(135deg, #e65100 0%, #ff9800 100%)' }}
              >
                Send Reminders
              </Button>
            </Box>
            <List disablePadding>
              {loanDueAlerts.map((customer, idx) => (
                <ListItem
                  key={idx}
                  sx={{
                    backgroundColor: customer.daysLeft <= 2 ? '#ffebee' : '#fff8e1',
                    borderLeft: `4px solid ${customer.daysLeft <= 2 ? '#f44336' : '#ff9800'}`,
                    mb: 1,
                    borderRadius: 1
                  }}
                >
                  <ListItemIcon>
                    <AlarmOn sx={{ color: customer.daysLeft <= 2 ? '#f44336' : '#ff9800' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1" fontWeight="bold">{customer.name}</Typography>
                        <Chip
                          label={customer.daysLeft <= 0 ? 'OVERDUE' : `${customer.daysLeft} day${customer.daysLeft === 1 ? '' : 's'} left`}
                          color={customer.daysLeft <= 0 ? 'error' : customer.daysLeft <= 2 ? 'error' : 'warning'}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" display="block">{customer.email}</Typography>
                        <Typography variant="body2" sx={{ mt: 0.25 }}>
                          Outstanding: <strong>Rs.{Number(customer.remainingAmount || 0).toLocaleString()}</strong>
                          {' '}— Due: <strong>{customer.dueDate ? new Date(customer.dueDate).toLocaleDateString() : 'N/A'}</strong>
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Email Alert Dialog */}
      <Dialog open={emailDialogOpen} onClose={handleCloseEmailDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmailIcon color="primary" />
            <Typography variant="h6">Send Email to Customers</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {emailResult ? (
            <Alert 
              severity={emailResult.results.failed === 0 ? 'success' : 'warning'}
              sx={{ mb: 2 }}
            >
              <Typography variant="body1" fontWeight="bold">
                {emailResult.message}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Successful: {emailResult.results.successful} | Failed: {emailResult.results.failed}
              </Typography>
              {emailResult.results.failed > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" fontWeight="bold">Failed Recipients:</Typography>
                  <List dense>
                    {emailResult.results.details
                      .filter(d => !d.success)
                      .map((detail, index) => (
                        <ListItem key={index}>
                          <ListItemText 
                            primary={detail.customerName}
                            secondary={`${detail.email} - ${detail.message}`}
                          />
                        </ListItem>
                      ))}
                  </List>
                </Box>
              )}
            </Alert>
          ) : (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>{t('alerts.alertType')}</InputLabel>
                    <Select
                      value={emailData.alertType}
                      onChange={(e) => setEmailData(prev => ({ ...prev, alertType: e.target.value }))}
                      label={t('alerts.alertType')}
                    >
                      <MenuItem value="critical">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ErrorIcon sx={{ color: '#f44336' }} />
                          {t('alerts.critical')}
                        </Box>
                      </MenuItem>
                      <MenuItem value="warning">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Warning sx={{ color: '#ff9800' }} />
                          {t('alerts.warning')}
                        </Box>
                      </MenuItem>
                      <MenuItem value="info">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Info sx={{ color: '#2196f3' }} />
                          {t('alerts.information')}
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, backgroundColor: 'grey.100' }}>
                    <Typography variant="caption" color="text.secondary">{t('alerts.selected')}</Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {selectedCustomers.length} {t('alerts.of')} {customersList.filter(c => c.email).length} {t('alerts.customers')}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <TextField
                fullWidth
                label="Subject"
                placeholder="Enter email subject"
                value={emailData.subject}
                onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                sx={{ mb: 2 }}
              />

              {/* AI Generate button */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  color="secondary"
                  startIcon={aiGenerating ? <CircularProgress size={14} /> : <Psychology />}
                  onClick={handleAiGenerate}
                  disabled={aiGenerating || selectedCustomers.length === 0}
                >
                  {aiGenerating ? 'Generating...' : 'AI Generate Subject & Message'}
                </Button>
                {emailData.subject && (
                  <Typography variant="caption" color="text.secondary">AI content ready — edit freely below</Typography>
                )}
              </Box>

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Email Message"
                placeholder="Click AI Generate above, or write your own message..."
                value={emailData.message}
                onChange={(e) => setEmailData(prev => ({ ...prev, message: e.target.value }))}
                sx={{ mb: 3 }}
              />

              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">{t('alerts.selectCustomers')}</Typography>
                <Button
                  size="small"
                  onClick={handleSelectAll}
                  startIcon={<CheckCircle />}
                >
                  {selectedCustomers.length === customersList.filter(c => c.email).length 
                    ? t('alerts.deselectAll') 
                    : t('alerts.selectAll')}
                </Button>
              </Box>

              <Paper sx={{ maxHeight: 300, overflow: 'auto' }}>
                <List>
                  {customersList.map((customer) => (
                    <ListItemButton
                      key={customer.id}
                      onClick={() => customer.email && handleCustomerToggle(customer.id?.toString() || customer.id)}
                      disabled={!customer.email}
                    >
                      <Checkbox
                        checked={selectedCustomers.includes(customer.id?.toString() || customer.id)}
                        disabled={!customer.email}
                      />
                      <ListItemIcon>
                        <MailOutline color={customer.email ? 'primary' : 'disabled'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={customer.name || customer.username}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block" color={customer.email ? 'success.main' : 'error'}>
                              {customer.email || 'No email address'}
                            </Typography>
                            {customer.daysLeft != null && (
                              <Typography variant="caption" display="block" color={customer.daysLeft <= 2 ? 'error' : 'warning.main'} fontWeight="bold">
                                ⏰ Due in {customer.daysLeft} day{customer.daysLeft === 1 ? '' : 's'} — Rs.{Number(customer.remainingAmount || 0).toLocaleString()} outstanding
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItemButton>
                  ))}
                </List>
                {customersList.length === 0 && (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('alerts.noCustomersFound')}
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEmailDialog}>
            {emailResult ? t('common.close') : t('common.cancel')}
          </Button>
          {!emailResult && (
            <Button
              variant="contained"
              onClick={handleSendEmail}
              disabled={sendingEmail || selectedCustomers.length === 0 || !emailData.message.trim() || !emailData.subject.trim()}
              startIcon={sendingEmail ? <CircularProgress size={20} /> : <Send />}
            >
              {sendingEmail ? t('alerts.sending') : `Send to ${selectedCustomers.length} customer(s)`}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AlertsCenter;
