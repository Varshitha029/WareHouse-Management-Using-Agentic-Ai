import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  Chip,
  Box,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  Grain,
  MonetizationOn,
  Storage,
  Assessment,
  Add,
  Payment,
  Update,
  CheckCircle,
  Schedule,
  Warning
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`grain-tabpanel-${index}`}
      aria-labelledby={`grain-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const CustomerGrainManagement = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [grainDialog, setGrainDialog] = useState(false);
  const [loanDialog, setLoanDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [grainForm, setGrainForm] = useState({
    customerId: '',
    grainType: '',
    quantity: '',
    quality: 'A',
    storageType: 'rent',
    rentPerMonth: '',
    notes: ''
  });
  const [loanForm, setLoanForm] = useState({
    customerId: '',
    amount: '',
    interestRate: '',
    duration: '',
    purpose: '',
    collateral: ''
  });
  const [paymentForm, setPaymentForm] = useState({
    customerId: '',
    transactionType: 'rent',
    amount: '',
    description: ''
  });
  const [customerGrains, setCustomerGrains] = useState([]);
  const [customerLoans, setCustomerLoans] = useState([]);
  const [customerTransactions, setCustomerTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const grainTypes = ['Rice', 'Wheat', 'Maize', 'Barley', 'Oats', 'Millet'];
  const qualityGrades = ['A', 'B', 'C'];
  const storageTypes = ['rent', 'loan_collateral', 'processing'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get('/api/customers', {
        headers: { Authorization: `Bearer ${token}` }
      });

      setCustomers(response.data.customers || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      setError('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerDetails = async (customerId) => {
    try {
      const token = localStorage.getItem('token');
      
      const [grainsRes, loansRes, transactionsRes] = await Promise.all([
        axios.get(`/api/customers/${customerId}/grains`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`/api/customers/${customerId}/loans`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`/api/transactions/customer/${customerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setCustomerGrains(grainsRes.data || []);
      setCustomerLoans(loansRes.data || []);
      setCustomerTransactions(transactionsRes.data || []);
      
      const customer = customers.find(c => c._id === customerId);
      setSelectedCustomer(customer);
    } catch (error) {
      console.error('Error loading customer details:', error);
      setError('Failed to load customer details');
    }
  };

  const handleAddGrain = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/customers/${grainForm.customerId}/grains`, grainForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess('Grain storage added successfully');
      setGrainDialog(false);
      setGrainForm({
        customerId: '',
        grainType: '',
        quantity: '',
        quality: 'A',
        storageType: 'rent',
        rentPerMonth: '',
        notes: ''
      });
      
      if (selectedCustomer && selectedCustomer._id === grainForm.customerId) {
        loadCustomerDetails(grainForm.customerId);
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error adding grain:', error);
      setError(error.response?.data?.message || 'Failed to add grain');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleAddLoan = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/customers/${loanForm.customerId}/loans`, loanForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess('Loan created successfully');
      setLoanDialog(false);
      setLoanForm({
        customerId: '',
        amount: '',
        interestRate: '',
        duration: '',
        purpose: '',
        collateral: ''
      });
      
      if (selectedCustomer && selectedCustomer._id === loanForm.customerId) {
        loadCustomerDetails(loanForm.customerId);
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error creating loan:', error);
      setError(error.response?.data?.message || 'Failed to create loan');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleRecordPayment = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/transactions', {
        customer: paymentForm.customerId,
        type: paymentForm.transactionType,
        amount: parseFloat(paymentForm.amount),
        description: paymentForm.description,
        status: 'completed'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess('Payment recorded successfully');
      setPaymentDialog(false);
      setPaymentForm({
        customerId: '',
        transactionType: 'rent',
        amount: '',
        description: ''
      });
      
      if (selectedCustomer && selectedCustomer._id === paymentForm.customerId) {
        loadCustomerDetails(paymentForm.customerId);
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error recording payment:', error);
      setError(error.response?.data?.message || 'Failed to record payment');
      setTimeout(() => setError(''), 3000);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'completed': return 'success';
      case 'overdue': return 'error';
      case 'cleared': return 'info';
      default: return 'default';
    }
  };

  const getStorageTypeLabel = (type) => {
    const labels = {
      rent: 'Monthly Rent',
      loan_collateral: 'Loan Collateral',
      processing: 'Processing'
    };
    return labels[type] || type;
  };

  if (user?.role !== 'owner' && user?.role !== 'customer') {
    return (
      <Container>
        <Alert severity="error">Access denied. Owner or Customer access required.</Alert>
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
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" gutterBottom>
            Customer Grain Management
          </Typography>
          {user.role === 'owner' && (
            <Box>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setGrainDialog(true)}
                sx={{ mr: 2 }}
              >
                Add Grain
              </Button>
              <Button
                variant="outlined"
                startIcon={<MonetizationOn />}
                onClick={() => setLoanDialog(true)}
                sx={{ mr: 2 }}
              >
                Create Loan
              </Button>
              <Button
                variant="outlined"
                startIcon={<Payment />}
                onClick={() => setPaymentDialog(true)}
              >
                Record Payment
              </Button>
            </Box>
          )}
        </Box>

        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Customers Overview" />
          <Tab label="Customer Details" />
        </Tabs>

        {/* Customers Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Customer Name</TableCell>
                  <TableCell>Total Grain Storage</TableCell>
                  <TableCell>Monthly Rent</TableCell>
                  <TableCell>Active Loans</TableCell>
                  <TableCell>Payment Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer._id}>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2">
                          {customer.profile?.firstName} {customer.profile?.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {customer.username}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<Storage />}
                        label={`${customer.customerDetails?.totalGrainStorage || 0} bags`}
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="success.main">
                        {formatCurrency(customer.customerDetails?.monthlyRent || 0)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {customer.customerDetails?.activeLoans || 0} loans
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={customer.customerDetails?.paymentStatus || 'current'}
                        color={getStatusColor(customer.customerDetails?.paymentStatus)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() => {
                          loadCustomerDetails(customer._id);
                          setTabValue(1);
                        }}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Customer Details Tab */}
        <TabPanel value={tabValue} index={1}>
          {selectedCustomer ? (
            <Grid container spacing={3}>
              {/* Customer Info */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {selectedCustomer.profile?.firstName} {selectedCustomer.profile?.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedCustomer.email} | {selectedCustomer.profile?.phone}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Grain Storage */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Grain Storage
                    </Typography>
                    <List>
                      {customerGrains.map((grain, index) => (
                        <ListItem key={index} divider>
                          <ListItemIcon>
                            <Grain color="primary" />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="subtitle2">
                                  {grain.grainType} - {grain.quantity} bags
                                </Typography>
                                <Chip 
                                  size="small" 
                                  label={`Grade ${grain.quality}`} 
                                  color="primary"
                                  variant="outlined"
                                />
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography variant="body2" color="text.secondary">
                                  {getStorageTypeLabel(grain.storageType)} - 
                                  {formatCurrency(grain.rentPerMonth)}/month
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Stored: {new Date(grain.dateStored).toLocaleDateString()}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                      {customerGrains.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                          No grain storage records found
                        </Typography>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              {/* Loans */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Active Loans
                    </Typography>
                    <List>
                      {customerLoans.map((loan, index) => (
                        <ListItem key={index} divider>
                          <ListItemIcon>
                            <MonetizationOn color="warning" />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="subtitle2">
                                  {formatCurrency(loan.amount)}
                                </Typography>
                                <Chip 
                                  size="small" 
                                  label={loan.status} 
                                  color={getStatusColor(loan.status)}
                                />
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography variant="body2" color="text.secondary">
                                  {loan.interestRate}% interest - {loan.duration} months
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Purpose: {loan.purpose}
                                </Typography>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={(loan.paidAmount / loan.amount) * 100}
                                  sx={{ mt: 1 }}
                                />
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                      {customerLoans.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                          No active loans found
                        </Typography>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              {/* Recent Transactions */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Recent Transactions
                    </Typography>
                    <TableContainer>
                      <Table size="small">
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
                          {customerTransactions.slice(0, 10).map((transaction) => (
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
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">
              Select a customer from the overview tab to view detailed information.
            </Alert>
          )}
        </TabPanel>
      </Paper>

      {/* Add Grain Dialog */}
      <Dialog open={grainDialog} onClose={() => setGrainDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Grain Storage</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Customer</InputLabel>
                <Select
                  value={grainForm.customerId}
                  onChange={(e) => setGrainForm({ ...grainForm, customerId: e.target.value })}
                >
                  {customers.map((customer) => (
                    <MenuItem key={customer._id} value={customer._id}>
                      {customer.profile?.firstName} {customer.profile?.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Grain Type</InputLabel>
                <Select
                  value={grainForm.grainType}
                  onChange={(e) => setGrainForm({ ...grainForm, grainType: e.target.value })}
                >
                  {grainTypes.map((grain) => (
                    <MenuItem key={grain} value={grain}>
                      {grain}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Quantity (bags)"
                type="number"
                value={grainForm.quantity}
                onChange={(e) => setGrainForm({ ...grainForm, quantity: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Quality Grade</InputLabel>
                <Select
                  value={grainForm.quality}
                  onChange={(e) => setGrainForm({ ...grainForm, quality: e.target.value })}
                >
                  {qualityGrades.map((grade) => (
                    <MenuItem key={grade} value={grade}>
                      Grade {grade}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Storage Type</InputLabel>
                <Select
                  value={grainForm.storageType}
                  onChange={(e) => setGrainForm({ ...grainForm, storageType: e.target.value })}
                >
                  {storageTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {getStorageTypeLabel(type)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Rent per Month (₹)"
                type="number"
                value={grainForm.rentPerMonth}
                onChange={(e) => setGrainForm({ ...grainForm, rentPerMonth: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={2}
                value={grainForm.notes}
                onChange={(e) => setGrainForm({ ...grainForm, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGrainDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleAddGrain} 
            variant="contained"
            disabled={!grainForm.customerId || !grainForm.grainType || !grainForm.quantity}
          >
            Add Grain Storage
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Loan Dialog */}
      <Dialog open={loanDialog} onClose={() => setLoanDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Customer Loan</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Customer</InputLabel>
                <Select
                  value={loanForm.customerId}
                  onChange={(e) => setLoanForm({ ...loanForm, customerId: e.target.value })}
                >
                  {customers.map((customer) => (
                    <MenuItem key={customer._id} value={customer._id}>
                      {customer.profile?.firstName} {customer.profile?.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Loan Amount (₹)"
                type="number"
                value={loanForm.amount}
                onChange={(e) => setLoanForm({ ...loanForm, amount: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Interest Rate (%)"
                type="number"
                value={loanForm.interestRate}
                onChange={(e) => setLoanForm({ ...loanForm, interestRate: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Duration (months)"
                type="number"
                value={loanForm.duration}
                onChange={(e) => setLoanForm({ ...loanForm, duration: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Purpose"
                value={loanForm.purpose}
                onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Collateral"
                value={loanForm.collateral}
                onChange={(e) => setLoanForm({ ...loanForm, collateral: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoanDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleAddLoan} 
            variant="contained"
            disabled={!loanForm.customerId || !loanForm.amount || !loanForm.interestRate}
          >
            Create Loan
          </Button>
        </DialogActions>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Customer Payment</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Customer</InputLabel>
                <Select
                  value={paymentForm.customerId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, customerId: e.target.value })}
                >
                  {customers.map((customer) => (
                    <MenuItem key={customer._id} value={customer._id}>
                      {customer.profile?.firstName} {customer.profile?.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Payment Type</InputLabel>
                <Select
                  value={paymentForm.transactionType}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transactionType: e.target.value })}
                >
                  <MenuItem value="rent">Storage Rent</MenuItem>
                  <MenuItem value="loan_payment">Loan Payment</MenuItem>
                  <MenuItem value="processing_fee">Processing Fee</MenuItem>
                  <MenuItem value="clearance_fee">Clearance Fee</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Amount (₹)"
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={paymentForm.description}
                onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleRecordPayment} 
            variant="contained"
            disabled={!paymentForm.customerId || !paymentForm.amount}
          >
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CustomerGrainManagement;