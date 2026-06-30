import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Avatar,
  Box,
  Tabs,
  Tab,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Divider,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Person,
  Edit,
  Save,
  Cancel,
  Lock,
  ContactSupport,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const TEN_DIGIT_PHONE_REGEX = /^\d{10}$/;

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const UserProfile = () => {
  const { user, loadUser } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    company: '',
    position: ''
  });
  const [customerTransactions, setCustomerTransactions] = useState([]);
  const [ownerDashboard, setOwnerDashboard] = useState(null);
  const [, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });
  const toggleShowPass = (field) => setShowPass(prev => ({ ...prev, [field]: !prev[field] }));
  const [contactForm, setContactForm] = useState({ subject: '', message: '' });
  const [contactSuccess, setContactSuccess] = useState('');

  // Razorpay / payment settings (owner only)
  const [rzpSettings, setRzpSettings] = useState({ keyId: '', secret: '', showSecret: false, transactionFee: 2.5, minPayment: 1 });
  const [rzpMsg, setRzpMsg]       = useState({ type: '', text: '' });
  const [savingRzp, setSavingRzp] = useState(false);

  const loadUserData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (user.role === 'customer') {
        const response = await axios.get('/api/transactions/my-transactions', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCustomerTransactions(response.data);
      } else if (user.role === 'owner') {
        const response = await axios.get('/api/warehouse/owner-dashboard', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOwnerDashboard(response.data);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        company: user.company || '',
        position: user.position || ''
      });
      loadUserData();
    }
  }, [user, loadUserData]);

  const handleInputChange = (e) => {
    const nextValue = e.target.name === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: nextValue
    });
  };

  const handleSaveProfile = async () => {
    try {
      if (formData.phone && !TEN_DIGIT_PHONE_REGEX.test(formData.phone)) {
        setError('Phone number must be exactly 10 digits');
        setTimeout(() => setError(''), 3000);
        return;
      }

      const token = localStorage.getItem('token');
      await axios.put('/api/auth/profile', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Reload user state from server so Navbar / context stays in sync
      await loadUser();
      setEditMode(false);
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(error.response?.data?.message || 'Failed to update profile');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      }, { headers: { Authorization: `Bearer ${token}` } });
      setPasswordSuccess('Password changed successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to change password');
    }
  };

  const handleContactSubmit = async () => {
    try {
      await axios.post('/api/contact', {
        name: user.name,
        email: user.email,
        subject: contactForm.subject,
        message: contactForm.message
      });
      setContactSuccess('Your message has been sent! We will get back to you soon.');
      setContactForm({ subject: '', message: '' });
      setTimeout(() => setContactSuccess(''), 5000);
    } catch (err) {
      setError('Failed to send message. Please try again.');
    }
  };

  // ── Razorpay settings helpers ───────────────────────────────────────
  const loadRazorpaySettings = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/auth/owner-settings', { headers: { Authorization: `Bearer ${token}` } });
      setRzpSettings(prev => ({
        ...prev,
        keyId:          res.data.razorpayKeyId   || '',
        transactionFee: res.data.transactionFee  ?? 2.5,
        minPayment:     res.data.minPaymentAmount ?? 1,
        // never pre-fill secret for security; just indicate whether it's set
        secret:         '',
        secretIsSet:    res.data.razorpaySecretSet,
      }));
    } catch { /* ignore - no settings yet */ }
  }, []);

  const handleSaveRazorpaySettings = async () => {
    setSavingRzp(true);
    setRzpMsg({ type: '', text: '' });
    try {
      const token = localStorage.getItem('token');
      await axios.put('/api/auth/owner-settings', {
        razorpayKeyId:     rzpSettings.keyId,
        razorpaySecret:    rzpSettings.secret,
        transactionFee:    rzpSettings.transactionFee,
        minPaymentAmount:  rzpSettings.minPayment,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setRzpMsg({ type: 'success', text: 'Razorpay keys saved! Payments will now use these credentials.' });
      setRzpSettings(prev => ({ ...prev, secret: '' }));
    } catch (err) {
      setRzpMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save Razorpay settings' });
    } finally {
      setSavingRzp(false);
    }
  };

  // Load Razorpay settings whenever owner switches to the Settings tab
  useEffect(() => {
    const ownerSettingsTabIndex = 3; // Personal Info | Change Password | Dashboard | Settings
    if (user?.role === 'owner' && tabValue === ownerSettingsTabIndex) {
      loadRazorpaySettings();
    }
  }, [tabValue, user?.role, loadRazorpaySettings]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'completed': return 'success';
      case 'overdue': return 'error';
      default: return 'default';
    }
  };

  if (!user) {
    return (
      <Container>
        <Alert severity="error">Please log in to view your profile</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* Profile Header */}
          <Grid item xs={12}>
            <Box display="flex" alignItems="center" gap={3}>
              <Avatar
                sx={{ width: 80, height: 80, bgcolor: 'primary.main' }}
              >
                <Person sx={{ fontSize: 40 }} />
              </Avatar>
              <Box>
                <Typography variant="h4" gutterBottom>
                  {user.name}
                </Typography>
                <Chip 
                  label={user.role.toUpperCase()} 
                  color="primary" 
                  size="large"
                />
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                  {user.email}
                </Typography>
              </Box>
              <Box sx={{ ml: 'auto' }}>
                {editMode ? (
                  <Box display="flex" gap={2}>
                    <Button
                      variant="contained"
                      startIcon={<Save />}
                      onClick={handleSaveProfile}
                    >
                      Save
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Cancel />}
                      onClick={() => setEditMode(false)}
                    >
                      Cancel
                    </Button>
                  </Box>
                ) : (
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => setEditMode(true)}
                  >
                    Edit Profile
                  </Button>
                )}
              </Box>
            </Box>
          </Grid>

          {/* Tabs */}
          <Grid item xs={12}>
            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
              <Tab label="Personal Info" />
              {user.role === 'customer' && <Tab label="Transactions" />}
              {user.role === 'customer' && <Tab label="Change Password" icon={<Lock fontSize="small" />} iconPosition="start" />}
              {user.role === 'customer' && <Tab label="Contact Us" icon={<ContactSupport fontSize="small" />} iconPosition="start" />}
              {user.role === 'owner' && <Tab label="Change Password" icon={<Lock fontSize="small" />} iconPosition="start" />}
              {user.role === 'owner' && <Tab label="Dashboard" />}
              {user.role === 'owner' && <Tab label="Settings" />}
            </Tabs>
          </Grid>
        </Grid>

        {/* Personal Information Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Full Name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={!editMode}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={!editMode}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={!editMode}
                  inputProps={{ maxLength: 10, inputMode: 'numeric', pattern: '[0-9]*' }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Position"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  disabled={!editMode}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  name="address"
                  multiline
                  rows={3}
                  value={formData.address}
                  onChange={handleInputChange}
                  disabled={!editMode}
                />
              </Grid>
              {user.role === 'customer' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Company"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    disabled={!editMode}
                  />
                </Grid>
              )}
            </Grid>
          </TabPanel>

        {/* Customer Transactions Tab */}
        {user.role === 'customer' && (
            <TabPanel value={tabValue} index={1}>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {customerTransactions.map((transaction) => (
                      <TableRow key={transaction._id}>
                        <TableCell>
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Chip label={transaction.type} size="small" />
                        </TableCell>
                        <TableCell>
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={transaction.status} 
                            color={getStatusColor(transaction.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{transaction.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>
          )}

        {/* Customer Change Password Tab */}
        {user.role === 'customer' && (
          <TabPanel value={tabValue} index={2}>
            <Grid container spacing={3} sx={{ maxWidth: 500 }}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  <Lock sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Change Password
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Enter your current password to verify your identity, then set a new password.
                </Typography>
              </Grid>
              {passwordError && (
                <Grid item xs={12}>
                  <Alert severity="error">{passwordError}</Alert>
                </Grid>
              )}
              {passwordSuccess && (
                <Grid item xs={12}>
                  <Alert severity="success">{passwordSuccess}</Alert>
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Current Password"
                  type={showPass.current ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => toggleShowPass('current')} edge="end">
                          {showPass.current ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="New Password"
                  type={showPass.new ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => toggleShowPass('new')} edge="end">
                          {showPass.new ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  helperText="Minimum 6 characters"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Confirm New Password"
                  type={showPass.confirm ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => toggleShowPass('confirm')} edge="end">
                          {showPass.confirm ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  error={passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword}
                  helperText={passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword ? 'Passwords do not match' : ''}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleChangePassword}
                  startIcon={<Lock />}
                  disabled={!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                  size="large"
                >
                  Update Password
                </Button>
              </Grid>
            </Grid>
          </TabPanel>
        )}

        {/* Customer Contact Us Tab */}
        {user.role === 'customer' && (
          <TabPanel value={tabValue} index={3}>
            <Grid container spacing={3} sx={{ maxWidth: 600 }}>
              {contactSuccess && (
                <Grid item xs={12}>
                  <Alert severity="success">{contactSuccess}</Alert>
                </Grid>
              )}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  <ContactSupport sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Get in Touch
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Have a question or issue? Send us a message and we'll respond as soon as possible.
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Subject"
                  value={contactForm.subject}
                  onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Message"
                  multiline
                  rows={5}
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleContactSubmit}
                  disabled={!contactForm.subject || !contactForm.message}
                >
                  Send Message
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Warehouse Contact Info</Typography>
                <Typography variant="body2">Email: support@warehouse.com</Typography>
                <Typography variant="body2">Phone: +91 9876543210</Typography>
                <Typography variant="body2">Address: Warehouse Management Office, Hyderabad, Telangana</Typography>
              </Grid>
            </Grid>
          </TabPanel>
        )}

        {/* Owner Change Password Tab — index 1 */}
        {user.role === 'owner' && (
          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={3} sx={{ maxWidth: 520 }}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  <Lock sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Change Password
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Enter your current password to verify your identity, then set a new password.
                </Typography>
              </Grid>
              {passwordError && <Grid item xs={12}><Alert severity="error">{passwordError}</Alert></Grid>}
              {passwordSuccess && <Grid item xs={12}><Alert severity="success">{passwordSuccess}</Alert></Grid>}
              <Grid item xs={12}>
                <TextField fullWidth label="Current Password"
                  type={showPass.current ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  InputProps={{ endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => toggleShowPass('current')} edge="end">
                        {showPass.current ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )}}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="New Password"
                  type={showPass.new ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  helperText="Minimum 6 characters"
                  InputProps={{ endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => toggleShowPass('new')} edge="end">
                        {showPass.new ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )}}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Confirm New Password"
                  type={showPass.confirm ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  error={!!passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword}
                  helperText={passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword ? 'Passwords do not match' : ''}
                  InputProps={{ endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => toggleShowPass('confirm')} edge="end">
                        {showPass.confirm ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )}}
                />
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" color="primary" size="large"
                  onClick={handleChangePassword} startIcon={<Lock />}
                  disabled={!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                >
                  Update Password
                </Button>
              </Grid>
            </Grid>
          </TabPanel>
        )}

        {/* Owner Dashboard Tab — index 2 */}
        {user.role === 'owner' && (
            <TabPanel value={tabValue} index={2}>
              {ownerDashboard ? (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Total Revenue
                        </Typography>
                        <Typography variant="h4" color="success.main">
                          {formatCurrency(ownerDashboard.totalRevenue || 0)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Total Customers
                        </Typography>
                        <Typography variant="h4" color="info.main">
                          {ownerDashboard.totalCustomers || 0}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              ) : (
                <Typography>Loading dashboard data...</Typography>
              )}
            </TabPanel>
          )}

        {/* Owner Settings Tab — index 3 */}
        {user.role === 'owner' && (
            <TabPanel value={tabValue} index={3}>
              <Grid container spacing={3}>

                {/* ── Change Password ── */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    <Lock sx={{ verticalAlign: 'middle', mr: 1 }} />
                    Change Password
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card sx={{ borderLeft: '4px solid #1976d2' }}>
                    <CardContent>
                      {passwordError   && <Alert severity="error"   sx={{ mb: 2 }}>{passwordError}</Alert>}
                      {passwordSuccess && <Alert severity="success" sx={{ mb: 2 }}>{passwordSuccess}</Alert>}
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <TextField fullWidth label="Current Password"
                            type={showPass.current ? 'text' : 'password'}
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                            InputProps={{ endAdornment: (
                              <InputAdornment position="end">
                                <IconButton onClick={() => toggleShowPass('current')} edge="end">
                                  {showPass.current ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                              </InputAdornment>
                            )}}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField fullWidth label="New Password"
                            type={showPass.new ? 'text' : 'password'}
                            value={passwordData.newPassword}
                            helperText="Minimum 6 characters"
                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                            InputProps={{ endAdornment: (
                              <InputAdornment position="end">
                                <IconButton onClick={() => toggleShowPass('new')} edge="end">
                                  {showPass.new ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                              </InputAdornment>
                            )}}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField fullWidth label="Confirm New Password"
                            type={showPass.confirm ? 'text' : 'password'}
                            value={passwordData.confirmPassword}
                            error={!!passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword}
                            helperText={passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword ? 'Passwords do not match' : ''}
                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                            InputProps={{ endAdornment: (
                              <InputAdornment position="end">
                                <IconButton onClick={() => toggleShowPass('confirm')} edge="end">
                                  {showPass.confirm ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                              </InputAdornment>
                            )}}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Button variant="contained" color="primary" size="large"
                            startIcon={<Lock />} onClick={handleChangePassword}
                            disabled={!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                          >
                            Update Password
                          </Button>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* ── Payment Gateway Settings ── */}
                <Grid item xs={12} sx={{ mt: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Payment Gateway Settings
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Razorpay Configuration
                      </Typography>
                      {rzpMsg.text && (
                        <Alert severity={rzpMsg.type} sx={{ mb: 2 }} onClose={() => setRzpMsg({ type: '', text: '' })}>
                          {rzpMsg.text}
                        </Alert>
                      )}
                      <Box sx={{ mb: 2 }}>
                        <TextField
                          fullWidth
                          label="Razorpay Key ID"
                          placeholder="rzp_live_... or rzp_test_..."
                          value={rzpSettings.keyId}
                          onChange={(e) => setRzpSettings(prev => ({ ...prev, keyId: e.target.value }))}
                          helperText="Starts with rzp_live_ (production) or rzp_test_ (testing)"
                          sx={{ mb: 2 }}
                        />
                        <TextField
                          fullWidth
                          label="Razorpay Secret Key"
                          type={rzpSettings.showSecret ? 'text' : 'password'}
                          placeholder={rzpSettings.secretIsSet ? 'Leave blank to keep existing secret' : 'Enter your Razorpay secret'}
                          value={rzpSettings.secret}
                          onChange={(e) => setRzpSettings(prev => ({ ...prev, secret: e.target.value }))}
                          helperText={rzpSettings.secretIsSet ? '✅ Secret is already saved — leave blank to keep it' : 'Required to process Razorpay payments'}
                          InputProps={{ endAdornment: (
                            <InputAdornment position="end">
                              <IconButton onClick={() => setRzpSettings(prev => ({ ...prev, showSecret: !prev.showSecret }))} edge="end">
                                {rzpSettings.showSecret ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          )}}
                          sx={{ mb: 2 }}
                        />
                        <Button variant="contained" color="primary"
                          onClick={handleSaveRazorpaySettings}
                          disabled={savingRzp || !rzpSettings.keyId}
                        >
                          {savingRzp ? 'Saving…' : 'Save Razorpay Keys'}
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Payment Settings
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Transaction Fee (%)"
                            type="number"
                            value={rzpSettings.transactionFee}
                            onChange={(e) => setRzpSettings(prev => ({ ...prev, transactionFee: e.target.value }))}
                            inputProps={{ step: 0.1, min: 0, max: 10 }}
                            sx={{ mb: 2 }}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Minimum Payment Amount (₹)"
                            type="number"
                            value={rzpSettings.minPayment}
                            onChange={(e) => setRzpSettings(prev => ({ ...prev, minPayment: e.target.value }))}
                            inputProps={{ min: 1 }}
                            sx={{ mb: 2 }}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Currency"
                            defaultValue="INR"
                            disabled
                            sx={{ mb: 2 }}
                          />
                        </Grid>
                      </Grid>
                      <Button variant="contained" color="primary"
                        onClick={handleSaveRazorpaySettings}
                        disabled={savingRzp}
                      >
                        {savingRzp ? 'Saving…' : 'Save Payment Settings'}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Payment Methods Status
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={3}>
                          <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
                            <Typography variant="h6">Cash</Typography>
                            <Chip label="Active" color="success" />
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
                            <Typography variant="h6">UPI</Typography>
                            <Chip label="Active" color="success" />
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
                            <Typography variant="h6">Razorpay</Typography>
                            <Chip label="Active" color="success" />
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
                            <Typography variant="h6">Bank Transfer</Typography>
                            <Chip label="Active" color="success" />
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

              </Grid>
            </TabPanel>
          )}
      </Paper>
    </Container>
  );
};

export default UserProfile;