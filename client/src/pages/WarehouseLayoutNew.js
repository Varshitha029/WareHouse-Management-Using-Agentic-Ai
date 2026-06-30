import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  Paper,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Warehouse,
  Person,
  Inventory,
  TrendingUp,
  Add,
  Edit,
  Delete
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const WarehouseLayoutNew = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Warehouse capacity data
  const [warehouseData, setWarehouseData] = useState({
    totalCapacity: 0,        // in kg or cubic meters
    filledSpace: 0,          // in kg or cubic meters
    emptySpace: 0,           // in kg or cubic meters
    occupancyRate: 0,        // percentage
    totalCustomers: 0,
    activeAllocations: 0
  });

  // Customer location mapping
  const [customerLocations, setCustomerLocations] = useState([]);
  
  // Dialogs
  const [capacityDialog, setCapacityDialog] = useState(false);
  const [allocationDialog, setAllocationDialog] = useState(false);
  
  // Forms
  const [capacityForm, setCapacityForm] = useState({
    totalCapacity: ''
  });

  const [allocationForm, setAllocationForm] = useState({
    customer: '',
    location: '',
    grainType: '',
    quantity: '',
    weight: ''
  });

  const { user } = useAuth();

  useEffect(() => {
    fetchWarehouseData();
  }, []);

  const fetchWarehouseData = async () => {
    try {
      setLoading(true);
      
      // Fetch warehouse capacity
      const capacityRes = await axios.get('/api/warehouse/capacity');
      
      // Fetch customer allocations
      const allocationsRes = await axios.get('/api/warehouse/allocations');
      
      // Calculate totals
      const allocations = allocationsRes.data.allocations || [];
      const totalCapacity = capacityRes.data.totalCapacity || 100000; // Default 100 tons
      
      const filledSpace = allocations.reduce((sum, alloc) => {
        return sum + (alloc.storageDetails?.totalWeight || 0);
      }, 0);
      
      const emptySpace = totalCapacity - filledSpace;
      const occupancyRate = totalCapacity > 0 ? (filledSpace / totalCapacity) * 100 : 0;
      
      setWarehouseData({
        totalCapacity,
        filledSpace,
        emptySpace,
        occupancyRate: occupancyRate.toFixed(2),
        totalCustomers: new Set(allocations.map(a => a.customer?._id || a.customer)).size,
        activeAllocations: allocations.filter(a => a.status === 'active').length
      });
      
      // Map customer locations
      const locations = allocations.map(alloc => ({
        id: alloc._id,
        customerName: alloc.customer?.profile?.name || alloc.customer?.name || 'Unknown',
        customerId: alloc.customer?._id || alloc.customer,
        location: `${alloc.allocation?.building || 'N/A'}-${alloc.allocation?.block || 'N/A'}-${alloc.allocation?.wing || 'N/A'}-${alloc.allocation?.box || 'N/A'}`,
        grainType: alloc.storageDetails?.items?.map(i => i.description).join(', ') || 'N/A',
        quantity: alloc.storageDetails?.items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0,
        weight: alloc.storageDetails?.totalWeight || 0,
        status: alloc.status || 'active',
        entryDate: alloc.duration?.startDate ? new Date(alloc.duration.startDate).toLocaleDateString() : 'N/A'
      }));
      
      setCustomerLocations(locations);
      
    } catch (error) {
      console.error('Error fetching warehouse data:', error);
      setError('Failed to load warehouse data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCapacity = async () => {
    try {
      setLoading(true);
      
      await axios.post('/api/warehouse/capacity', {
        totalCapacity: parseFloat(capacityForm.totalCapacity)
      });
      
      setSuccess('Warehouse capacity updated successfully!');
      setCapacityDialog(false);
      fetchWarehouseData();
      
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to update capacity');
    } finally {
      setLoading(false);
    }
  };

  const getOccupancyColor = (rate) => {
    if (rate < 50) return 'success';
    if (rate < 80) return 'warning';
    return 'error';
  };

  if (loading && customerLocations.length === 0) {
    return (
      <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          <Warehouse sx={{ mr: 1, verticalAlign: 'middle' }} />
          Warehouse Layout & Capacity
        </Typography>
        
        {user?.role === 'owner' && (
          <Button
            variant="contained"
            startIcon={<Edit />}
            onClick={() => {
              setCapacityForm({ totalCapacity: warehouseData.totalCapacity });
              setCapacityDialog(true);
            }}
          >
            Update Capacity
          </Button>
        )}
      </Box>

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

      {/* Capacity Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%', bgcolor: 'primary.50', borderLeft: '4px solid', borderColor: 'primary.main' }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Capacity
              </Typography>
              <Typography variant="h4" color="primary.main">
                {warehouseData.totalCapacity.toLocaleString()} kg
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Maximum storage capacity
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%', bgcolor: 'success.50', borderLeft: '4px solid', borderColor: 'success.main' }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Filled Space
              </Typography>
              <Typography variant="h4" color="success.main">
                {warehouseData.filledSpace.toLocaleString()} kg
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Currently occupied
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%', bgcolor: 'warning.50', borderLeft: '4px solid', borderColor: 'warning.main' }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Empty Space
              </Typography>
              <Typography variant="h4" color="warning.main">
                {warehouseData.emptySpace.toLocaleString()} kg
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Available for allocation
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%', bgcolor: 'info.50', borderLeft: '4px solid', borderColor: 'info.main' }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Occupancy Rate
              </Typography>
              <Typography variant="h4" color="info.main">
                {warehouseData.occupancyRate}%
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {warehouseData.totalCustomers} active customers
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Visual Capacity Bar */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Capacity Utilization
        </Typography>
        <Box sx={{ mb: 2 }}>
          <LinearProgress 
            variant="determinate" 
            value={parseFloat(warehouseData.occupancyRate)} 
            color={getOccupancyColor(parseFloat(warehouseData.occupancyRate))}
            sx={{ height: 30, borderRadius: 2 }}
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            0 kg
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            {warehouseData.filledSpace.toLocaleString()} kg / {warehouseData.totalCapacity.toLocaleString()} kg
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {warehouseData.totalCapacity.toLocaleString()} kg
          </Typography>
        </Box>
      </Paper>

      {/* Customer Location Mapping Table */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Customer Storage Locations
        </Typography>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Customer Name</strong></TableCell>
                <TableCell><strong>Location</strong></TableCell>
                <TableCell><strong>Grain Type</strong></TableCell>
                <TableCell align="right"><strong>Quantity (units)</strong></TableCell>
                <TableCell align="right"><strong>Weight (kg)</strong></TableCell>
                <TableCell><strong>Entry Date</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customerLocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary" sx={{ py: 3 }}>
                      No storage allocations found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                customerLocations.map((location) => (
                  <TableRow key={location.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Person sx={{ mr: 1, color: 'primary.main' }} />
                        {location.customerName}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={location.location} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{location.grainType}</TableCell>
                    <TableCell align="right">{location.quantity}</TableCell>
                    <TableCell align="right">{location.weight.toLocaleString()}</TableCell>
                    <TableCell>{location.entryDate}</TableCell>
                    <TableCell>
                      <Chip 
                        label={location.status} 
                        size="small"
                        color={location.status === 'active' ? 'success' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Update Capacity Dialog */}
      <Dialog open={capacityDialog} onClose={() => setCapacityDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Update Warehouse Capacity</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Total Capacity (kg)"
              type="number"
              value={capacityForm.totalCapacity}
              onChange={(e) => setCapacityForm({ totalCapacity: e.target.value })}
              helperText="Enter the total storage capacity in kilograms"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCapacityDialog(false)}>Cancel</Button>
          <Button onClick={handleUpdateCapacity} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default WarehouseLayoutNew;
