import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  AlertTitle,
  Stack,
  Chip,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Grid,
  IconButton,
  Tooltip,
  Badge
} from '@mui/material';
import {
  NotificationsActive,
  Warning,
  CalendarToday,
  Payment,
  Email,
  Sms,
  CheckCircle,
  ErrorOutline,
  Info,
  Close
} from '@mui/icons-material';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useTranslation } from '../i18n/LanguageContext';

const CustomerLoanAlerts = () => {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [aiRiskAssessment, setAiRiskAssessment] = useState(null);
  const [aiRiskLoading, setAiRiskLoading] = useState(false);
  const [customerGrains, setCustomerGrains] = useState([]);
  const { socket } = useSocket();

  useEffect(() => {
    fetchLoanAlerts();
    fetchCustomerGrains();
    
    // Refresh alerts every 5 minutes
    const interval = setInterval(fetchLoanAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Listen for loan approval notifications
    socket.on('loan_approved', (data) => {
      console.log('Loan approved notification:', data);
      
      // Show alert notification
      const newAlert = {
        _id: `new-${Date.now()}`,
        loanAmount: data.loanAmount,
        interestRate: data.interestRate,
        duration: data.duration,
        monthlyEMI: data.monthlyEMI,
        startDate: data.startDate,
        endDate: data.endDate,
        daysUntilDue: 999, // Large number to mark as new
        isOverdue: false,
        notificationsSent: [],
        type: 'new_approval'
      };
      
      setAlerts(prev => [newAlert, ...prev]);
      
      // Refresh data
      fetchLoanAlerts();
    });

    return () => {
      socket.off('loan_approved');
    };
  }, [socket]);

  const fetchLoanAlerts = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await axios.get('/api/loans/repayment-alerts');
      setAlerts(response.data.alerts || []);
    } catch (err) {
      console.error('Error fetching loan alerts:', err);
      setError(err.response?.data?.message || t('loans.errorFetchingAlerts'));
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerGrains = async () => {
    try {
      const response = await axios.get('/api/warehouse/allocations/my-locations');
      const allocations = response.data.allocations || [];
      
      // Extract grain types from allocations
      const grains = [];
      allocations.forEach(allocation => {
        if (allocation.storageDetails?.items) {
          allocation.storageDetails.items.forEach(item => {
            if (item.description && !grains.some(g => g.name === item.description)) {
              grains.push({
                name: item.description,
                weight: item.weight || 0,
                quantity: item.quantity || 0
              });
            }
          });
        }
      });
      
      setCustomerGrains(grains);
    } catch (err) {
      console.error('Error fetching customer grains:', err);
    }
  };

  const fetchAIRiskAssessment = async () => {
    if (customerGrains.length === 0) {
      setError('No grain data available for risk assessment');
      return;
    }

    try {
      setAiRiskLoading(true);
      setError('');

      // Use the first grain for risk assessment (or aggregate if multiple)
      const primaryGrain = customerGrains[0];
      const response = await axios.post('/api/ai/predict-profit', {
        grain_type: primaryGrain.name,
        total_bags: primaryGrain.quantity || 100,
        total_weight_kg: primaryGrain.weight || 5000,
        monthly_rent_per_bag: 50
      });

      if (response.data.success) {
        setAiRiskAssessment(response.data.prediction);
      }
    } catch (err) {
      console.error('Error fetching AI risk assessment:', err);
      setError(err.response?.data?.message || 'Failed to fetch AI risk assessment');
    } finally {
      setAiRiskLoading(false);
    }
  };

  const dismissAlert = (alertId) => {
    setDismissedAlerts([...dismissedAlerts, alertId]);
  };

  const getAlertSeverity = (daysUntilDue) => {
    if (daysUntilDue < 0) return 'error';
    if (daysUntilDue <= 3) return 'error';
    if (daysUntilDue <= 7) return 'warning';
    if (daysUntilDue <= 14) return 'info';
    return 'success';
  };

  const getAlertIcon = (daysUntilDue) => {
    if (daysUntilDue < 0) return <ErrorOutline />;
    if (daysUntilDue <= 3) return <Warning />;
    if (daysUntilDue <= 7) return <NotificationsActive />;
    return <Info />;
  };

  const getAlertTitle = (daysUntilDue, isOverdue) => {
    if (isOverdue) return 'OVERDUE - Immediate Action Required';
    if (daysUntilDue <= 3) return 'URGENT - Payment Due Soon';
    if (daysUntilDue <= 7) return 'Reminder - Payment Due This Week';
    if (daysUntilDue <= 14) return 'Upcoming Payment';
    return 'Payment Scheduled';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString('en-IN') || 0}`;
  };

  const visibleAlerts = alerts.filter(alert => !dismissedAlerts.includes(alert.loanId));
  const urgentAlerts = visibleAlerts.filter(alert => alert.daysUntilDue <= 7);

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Badge badgeContent={urgentAlerts.length} color="error">
            <NotificationsActive sx={{ fontSize: 32, color: 'primary.main' }} />
          </Badge>
          <Box>
            <Typography variant="h5" fontWeight="bold">
              Loan Repayment Alerts
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Stay on top of your loan repayments
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={fetchLoanAlerts}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Alert Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, bgcolor: 'error.50', border: '1px solid', borderColor: 'error.200' }}>
            <Typography variant="caption" color="text.secondary">
              Overdue Payments
            </Typography>
            <Typography variant="h4" fontWeight="bold" color="error.main">
              {visibleAlerts.filter(a => a.isOverdue).length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200' }}>
            <Typography variant="caption" color="text.secondary">
              Due This Week
            </Typography>
            <Typography variant="h4" fontWeight="bold" color="warning.main">
              {visibleAlerts.filter(a => !a.isOverdue && a.daysUntilDue <= 7).length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200' }}>
            <Typography variant="caption" color="text.secondary">
              Upcoming (14 days)
            </Typography>
            <Typography variant="h4" fontWeight="bold" color="info.main">
              {visibleAlerts.filter(a => !a.isOverdue && a.daysUntilDue > 7 && a.daysUntilDue <= 14).length}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* AI Risk Assessment */}
      <Card sx={{ mb: 3, bgcolor: 'primary.50', border: '2px solid', borderColor: 'primary.main' }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <Info color="primary" />
              <Typography variant="h6" fontWeight="bold" color="primary.main">
                AI-Powered Loan Risk Assessment
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={fetchAIRiskAssessment}
              disabled={aiRiskLoading || customerGrains.length === 0}
            >
              {aiRiskLoading ? 'Analyzing...' : 'Get AI Assessment'}
            </Button>
            </Box>

            {customerGrains.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.paper' }}>
                <Info sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No grain data available. Please add grains to your warehouse to get AI-powered loan risk assessment.
                </Typography>
              </Paper>
            ) : aiRiskAssessment ? (
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, bgcolor: aiRiskAssessment.predicted_category === 'Profit' ? 'success.50' : 'error.50', border: '1px solid', borderColor: aiRiskAssessment.predicted_category === 'Profit' ? 'success.main' : 'error.main' }}>
                    <Typography variant="caption" color="text.secondary">
                      Profit Outlook
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color={aiRiskAssessment.predicted_category === 'Profit' ? 'success.main' : 'error.main'}>
                      {aiRiskAssessment.predicted_category}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.main' }}>
                    <Typography variant="caption" color="text.secondary">
                      AI Confidence Score
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="info.main">
                      {((aiRiskAssessment.confidence || 0) * 100).toFixed(0)}%
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.main' }}>
                    <Typography variant="caption" color="text.secondary">
                      Loan Risk Level
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="warning.main">
                      {aiRiskAssessment.predicted_category === 'Profit' ? 'LOW' : 'MODERATE'}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <Alert severity={aiRiskAssessment.predicted_category === 'Profit' ? 'success' : 'warning'}>
                    <AlertTitle>AI Recommendation</AlertTitle>
                    {aiRiskAssessment.predicted_category === 'Profit' ? (
                      <Typography variant="body2">
                        <strong>Favorable Conditions:</strong> Based on grain type, weight, and market analysis, AI predicts profitable outcomes. 
                        You may be eligible for better loan terms with lower interest rates.
                      </Typography>
                    ) : (
                      <Typography variant="body2">
                        <strong>Caution Advised:</strong> AI analysis suggests potential challenges. Consider reviewing storage duration 
                        and market conditions before taking additional loans. Contact our financial advisor for personalized guidance.
                      </Typography>
                    )}
                  </Alert>
                </Grid>
              </Grid>
            ) : (
              <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.paper' }}>
                <Info sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Click "Get AI Assessment" to analyze your loan eligibility and risk profile based on your stored grains
                </Typography>
              </Paper>
            )}
          </CardContent>
        </Card>

      {/* Alert List */}
      {visibleAlerts.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Pending Loan Payments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You're all caught up! No loan repayments are due at this time.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {visibleAlerts.map((alert) => {
            // Special handling for newly approved loans
            if (alert.type === 'new_approval') {
              return (
                <Alert
                  key={alert._id}
                  severity="success"
                  icon={<CheckCircle />}
                  action={
                    <IconButton
                      aria-label="dismiss"
                      color="inherit"
                      size="small"
                      onClick={() => dismissAlert(alert._id)}
                    >
                      <Close fontSize="inherit" />
                    </IconButton>
                  }
                >
                  <AlertTitle sx={{ fontWeight: 'bold' }}>
                    Loan Approved Successfully!
                  </AlertTitle>
                  
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} md={6}>
                      <Stack spacing={1}>
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Loan Amount:
                          </Typography>
                          <Typography variant="body1" fontWeight="bold" color="success.main">
                            ₹{alert.loanAmount?.toLocaleString('en-IN')}
                          </Typography>
                        </Box>
                        
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Interest Rate:
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {alert.interestRate}%
                          </Typography>
                        </Box>

                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Duration:
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {alert.duration} months
                          </Typography>
                        </Box>
                      </Stack>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Stack spacing={1}>
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Monthly EMI:
                          </Typography>
                          <Typography variant="body1" fontWeight="bold">
                            ₹{parseFloat(alert.monthlyEMI).toLocaleString('en-IN')}
                          </Typography>
                        </Box>

                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Start Date:
                          </Typography>
                          <Chip
                            icon={<CalendarToday />}
                            label={formatDate(alert.startDate)}
                            size="small"
                            color="success"
                          />
                        </Box>

                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            End Date:
                          </Typography>
                          <Chip
                            icon={<CalendarToday />}
                            label={formatDate(alert.endDate)}
                            size="small"
                            color="info"
                          />
                        </Box>
                      </Stack>
                    </Grid>
                  </Grid>
                </Alert>
              );
            }

            // Regular alert handling
            const severity = getAlertSeverity(alert.daysUntilDue);
            const icon = getAlertIcon(alert.daysUntilDue);
            const title = getAlertTitle(alert.daysUntilDue, alert.isOverdue);

            return (
              <Alert
                key={alert.loanId}
                severity={severity}
                icon={icon}
                action={
                  <IconButton
                    aria-label="dismiss"
                    color="inherit"
                    size="small"
                    onClick={() => dismissAlert(alert.loanId)}
                  >
                    <Close fontSize="inherit" />
                  </IconButton>
                }
              >
                <AlertTitle sx={{ fontWeight: 'bold' }}>
                  {title}
                </AlertTitle>
                
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} md={6}>
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Loan ID:
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          #{alert.loanId?.slice(-8).toUpperCase()}
                        </Typography>
                      </Box>
                      
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Due Date:
                        </Typography>
                        <Chip
                          icon={<CalendarToday />}
                          label={formatDate(alert.dueDate)}
                          size="small"
                          color={alert.isOverdue ? 'error' : 'default'}
                        />
                      </Box>

                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Days Until Due:
                        </Typography>
                        <Typography 
                          variant="body2" 
                          fontWeight="bold"
                          color={alert.isOverdue ? 'error.main' : 'text.primary'}
                        >
                          {alert.isOverdue 
                            ? `${Math.abs(alert.daysUntilDue)} days overdue` 
                            : `${alert.daysUntilDue} days`}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Amount Due:
                        </Typography>
                        <Typography variant="body1" fontWeight="bold" color="error.main">
                          {formatCurrency(alert.amountDue)}
                        </Typography>
                      </Box>

                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Total Remaining:
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(alert.remainingAmount)}
                        </Typography>
                      </Box>

                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Monthly EMI:
                        </Typography>
                        <Typography variant="body2">
                          {formatCurrency(alert.monthlyPayment)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                </Grid>

                {/* Notification Status */}
                <Divider sx={{ my: 2 }} />
                <Box display="flex" gap={2} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    Notifications sent:
                  </Typography>
                  {alert.emailSent && (
                    <Tooltip title="Email notification sent">
                      <Chip
                        icon={<Email />}
                        label="Email"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    </Tooltip>
                  )}
                  {alert.smsSent && (
                    <Tooltip title="SMS notification sent">
                      <Chip
                        icon={<Sms />}
                        label="SMS"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    </Tooltip>
                  )}
                  {!alert.emailSent && !alert.smsSent && (
                    <Typography variant="caption" color="text.secondary">
                      No notifications sent yet
                    </Typography>
                  )}
                </Box>

                {/* Action Button */}
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Payment />}
                    color={alert.isOverdue ? 'error' : 'primary'}
                    href={`#payment-section`} // This would navigate to payment section
                  >
                    {alert.isOverdue ? 'Pay Now' : 'Make Payment'}
                  </Button>
                </Box>
              </Alert>
            );
          })}
        </Stack>
      )}

      {/* Info Box */}
      <Paper sx={{ p: 2, mt: 3, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200' }}>
        <Typography variant="subtitle2" fontWeight="bold" color="info.main" gutterBottom>
          <Info sx={{ fontSize: 18, mr: 1, verticalAlign: 'middle' }} />
          Alert Notifications
        </Typography>
        <Typography variant="body2" color="text.secondary">
          You will receive email and SMS notifications:
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 30 }}>
              <CheckCircle fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="14 days before payment due date"
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 30 }}>
              <CheckCircle fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="7 days before payment due date"
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 30 }}>
              <CheckCircle fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="3 days before payment due date"
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 30 }}>
              <CheckCircle fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="On the payment due date"
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItem>
        </List>
      </Paper>
    </Box>
  );
};

export default CustomerLoanAlerts;
