import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Tabs,
  Tab,
  Badge,
  Switch,
  FormControlLabel,
  FormGroup
} from '@mui/material';
import {
  Notifications,
  Refresh,
  Delete,
  CheckCircle,
  Warning,
  Info,
  Error,
  Payment,
  Grain,
  Receipt,
  Settings
} from '@mui/icons-material';
import axios from 'axios';

const CustomerNotificationsPanel = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState({
    email: true,
    sms: false,
    push: true,
    paymentReminders: true,
    loanAlerts: true,
    grainExpiry: true,
    priceAlerts: true,
    general: true
  });

  const fetchNotifications = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/notifications/my-notifications', {
        headers: { 'x-auth-token': token }
      });
      setNotifications(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/notifications/preferences', {
        headers: { 'x-auth-token': token }
      });
      setPreferences(response.data);
    } catch (err) {
      console.error('Failed to fetch preferences:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchPreferences();
  }, []);

  const handleRefresh = () => {
    fetchNotifications();
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/notifications/${notificationId}/read`, {}, {
        headers: { 'x-auth-token': token }
      });
      fetchNotifications();
    } catch (err) {
      alert('Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put('/api/notifications/mark-all-read', {}, {
        headers: { 'x-auth-token': token }
      });
      fetchNotifications();
    } catch (err) {
      alert('Failed to mark all notifications as read');
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/notifications/${notificationId}`, {
        headers: { 'x-auth-token': token }
      });
      fetchNotifications();
    } catch (err) {
      alert('Failed to delete notification');
    }
  };

  const handlePreferenceChange = async (key) => {
    const newPreferences = { ...preferences, [key]: !preferences[key] };
    setPreferences(newPreferences);

    try {
      const token = localStorage.getItem('token');
      await axios.put('/api/notifications/preferences', newPreferences, {
        headers: { 'x-auth-token': token }
      });
    } catch (err) {
      alert('Failed to update preferences');
      // Revert on error
      setPreferences(preferences);
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'payment':
        return <Payment sx={{ color: '#1976d2' }} />;
      case 'loan':
        return <Receipt sx={{ color: '#9c27b0' }} />;
      case 'grain':
        return <Grain sx={{ color: '#2e7d32' }} />;
      case 'general':
        return <Info sx={{ color: '#0288d1' }} />;
      default:
        return <Notifications />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'default';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'critical':
        return <Error sx={{ color: '#d32f2f' }} />;
      case 'high':
        return <Warning sx={{ color: '#ed6c02' }} />;
      case 'medium':
        return <Info sx={{ color: '#0288d1' }} />;
      default:
        return <CheckCircle sx={{ color: '#2e7d32' }} />;
    }
  };

  const filterNotifications = (category) => {
    if (category === 'all') return notifications;
    return notifications.filter(n => n.category === category);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const paymentNotifications = filterNotifications('payment');
  const loanNotifications = filterNotifications('loan');
  const grainNotifications = filterNotifications('grain');
  const generalNotifications = filterNotifications('general');

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

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Badge badgeContent={unreadCount} color="error">
            <Notifications sx={{ fontSize: 32, color: 'primary.main' }} />
          </Badge>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Notifications
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
          >
            Mark All Read
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Unread
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="error.main">
                {unreadCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Payment
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {paymentNotifications.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Loan
              </Typography>
              <Typography variant="h4" fontWeight="bold" sx={{ color: '#9c27b0' }}>
                {loanNotifications.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Grain
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {grainNotifications.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label={<Badge badgeContent={unreadCount} color="error">All</Badge>} />
          <Tab label={`Payment (${paymentNotifications.length})`} />
          <Tab label={`Loan (${loanNotifications.length})`} />
          <Tab label={`Grain (${grainNotifications.length})`} />
          <Tab label={`General (${generalNotifications.length})`} />
          <Tab label={<Settings />} />
        </Tabs>
      </Card>

      {/* Tab Content */}
      {activeTab <= 4 ? (
        <Card>
          <CardContent>
            {(() => {
              let filteredNotifications;
              switch (activeTab) {
                case 0:
                  filteredNotifications = notifications;
                  break;
                case 1:
                  filteredNotifications = paymentNotifications;
                  break;
                case 2:
                  filteredNotifications = loanNotifications;
                  break;
                case 3:
                  filteredNotifications = grainNotifications;
                  break;
                case 4:
                  filteredNotifications = generalNotifications;
                  break;
                default:
                  filteredNotifications = [];
              }

              if (filteredNotifications.length === 0) {
                return (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                    <Typography variant="h6" color="textSecondary">
                      No notifications in this category
                    </Typography>
                  </Box>
                );
              }

              return (
                <List>
                  {filteredNotifications.map((notification, index) => (
                    <React.Fragment key={notification._id}>
                      <ListItem
                        sx={{
                          backgroundColor: notification.isRead ? 'transparent' : 'action.hover',
                          borderLeft: !notification.isRead ? '4px solid' : 'none',
                          borderColor: !notification.isRead ? 'primary.main' : 'transparent'
                        }}
                      >
                        <Box sx={{ mr: 2 }}>
                          {getPriorityIcon(notification.priority)}
                        </Box>
                        <Box sx={{ mr: 2 }}>
                          {getCategoryIcon(notification.category)}
                        </Box>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1" fontWeight={notification.isRead ? 'normal' : 'bold'}>
                                {notification.title}
                              </Typography>
                              {!notification.isRead && (
                                <Chip label="NEW" size="small" color="primary" />
                              )}
                              <Chip 
                                label={notification.category}
                                size="small"
                                color={getPriorityColor(notification.priority)}
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                                {notification.message}
                              </Typography>
                              <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                                {new Date(notification.createdAt).toLocaleString()}
                              </Typography>
                            </Box>
                          }
                        />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {!notification.isRead && (
                            <Tooltip title="Mark as Read">
                              <IconButton
                                size="small"
                                onClick={() => handleMarkAsRead(notification._id)}
                              >
                                <CheckCircle />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(notification._id)}
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </ListItem>
                      {index < filteredNotifications.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              );
            })()}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Notification Preferences
            </Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              Customize how and when you receive notifications
            </Alert>

            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ mt: 3 }}>
              Delivery Methods
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.email}
                    onChange={() => handlePreferenceChange('email')}
                  />
                }
                label="Email Notifications"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.sms}
                    onChange={() => handlePreferenceChange('sms')}
                  />
                }
                label="SMS Notifications"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.push}
                    onChange={() => handlePreferenceChange('push')}
                  />
                }
                label="Push Notifications"
              />
            </FormGroup>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Notification Categories
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.paymentReminders}
                    onChange={() => handlePreferenceChange('paymentReminders')}
                  />
                }
                label="Payment Reminders"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.loanAlerts}
                    onChange={() => handlePreferenceChange('loanAlerts')}
                  />
                }
                label="Loan Alerts"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.grainExpiry}
                    onChange={() => handlePreferenceChange('grainExpiry')}
                  />
                }
                label="Grain Expiry Alerts"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.priceAlerts}
                    onChange={() => handlePreferenceChange('priceAlerts')}
                  />
                }
                label="Market Price Alerts"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.general}
                    onChange={() => handlePreferenceChange('general')}
                  />
                }
                label="General Announcements"
              />
            </FormGroup>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default CustomerNotificationsPanel;
