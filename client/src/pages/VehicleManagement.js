import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  IconButton,
  Tooltip,
  Switch
} from '@mui/material';
import {
  LocalShipping,
  Add,
  ExitToApp,
  CallReceived,
  Grain,
  Scale
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const VehicleManagement = ({ onVehicleStatusChange }) => {
  const { user } = useAuth();
  const { addNotification } = useSocket();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Exit dialog
  const [exitDialog, setExitDialog] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [exitForm, setExitForm] = useState({
    exitWeight: '',
    actualBags: '',
    remarks: '',
    paymentStatus: 'pending'
  });

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/vehicles');
      setVehicles(response.data.vehicles || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setError('Failed to fetch vehicles');
    } finally {
      setLoading(false);
    }
  };

  const handleVehicleEntryRedirect = () => {
    // Redirect to weighbridge module's vehicle entry section
    navigate('/weigh-bridge');
  };

  const handleVehicleExit = async () => {
    try {
      setError('');
      setLoading(true);

      const exitData = {
        vehicleId: selectedVehicle._id,
        ...exitForm,
        exitTime: new Date()
      };

      await axios.post('/api/vehicles/grain-exit', exitData);
      
      setSuccess('Vehicle exit registered successfully!');
      addNotification({
        type: 'success',
        title: 'Vehicle Exit',
        message: `Vehicle ${selectedVehicle.vehicleNumber} exited successfully`,
        timestamp: new Date()
      });

      setExitDialog(false);
      setSelectedVehicle(null);
      setExitForm({ exitWeight: '', actualBags: '', remarks: '', paymentStatus: 'pending' });
      fetchVehicles();
      if (onVehicleStatusChange) {
        onVehicleStatusChange();
      }
    } catch (error) {
      console.error('Error registering vehicle exit:', error);
      setError(error.response?.data?.message || 'Failed to register vehicle exit');
    } finally {
      setLoading(false);
    }
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      inside:   { color: 'warning',  icon: <CallReceived fontSize="small" /> },
      entered:  { color: 'info',     icon: <CallReceived fontSize="small" /> },
      loaded:   { color: 'primary',  icon: <Scale fontSize="small" /> },
      weighed:  { color: 'success',  icon: <Scale fontSize="small" /> },
      exited:   { color: 'default',  icon: <ExitToApp fontSize="small" /> },
      weighing: { color: 'info',     icon: <Scale fontSize="small" /> }
    };
    const config = statusConfig[status] || { color: 'default', icon: null };
    return (
      <Chip label={status.toUpperCase()} color={config.color} size="small" icon={config.icon} />
    );
  };

  const vehicleVisitCounts = vehicles.reduce((accumulator, vehicle) => {
    const number = vehicle.vehicleNumber || 'UNKNOWN';
    accumulator[number] = (accumulator[number] || 0) + 1;
    return accumulator;
  }, {});

  const getReturnCount = (vehicleNumber) => {
    const visits = vehicleVisitCounts[vehicleNumber] || 0;
    return Math.max(visits - 1, 0);
  };

  const handleStatusToggle = async (vehicle, checked) => {
    try {
      setError('');
      const nextStatus = checked ? 'exited' : 'entered';
      await axios.put(`/api/vehicles/${vehicle._id}`, { status: nextStatus });

      setVehicles((previous) => previous.map((item) => (
        item._id === vehicle._id ? { ...item, status: nextStatus } : item
      )));

      if (onVehicleStatusChange) {
        onVehicleStatusChange();
      }

      addNotification({
        type: 'info',
        title: 'Vehicle Status Updated',
        message: `Vehicle ${vehicle.vehicleNumber} marked as ${nextStatus.toUpperCase()}`,
        timestamp: new Date()
      });
    } catch (updateError) {
      console.error('Error updating vehicle status:', updateError);
      setError(updateError.response?.data?.message || 'Failed to update vehicle status');
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          🚛 Vehicle Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleVehicleEntryRedirect}
          disabled={user?.role === 'customer'}
        >
          Vehicle Entry
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>{success}</Alert>
      )}

      {/* All Vehicles Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Vehicle Number</TableCell>
              <TableCell>Driver</TableCell>
              <TableCell>Grain Type</TableCell>
              <TableCell>Bags</TableCell>
              <TableCell>Weight (kg)</TableCell>
              <TableCell>Purpose</TableCell>
              <TableCell>Return Count</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Entered / Exited</TableCell>
              <TableCell>Entry Time</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {vehicles.map((vehicle) => (
              <TableRow key={vehicle._id}>
                <TableCell>
                  <Typography variant="subtitle2">{vehicle.vehicleNumber}</Typography>
                </TableCell>
                <TableCell>{vehicle.driverName}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Grain fontSize="small" sx={{ mr: 1 }} />
                    {vehicle.grainDetails?.grainType || 'N/A'}
                  </Box>
                </TableCell>
                <TableCell>{vehicle.grainDetails?.actualBags || 0}</TableCell>
                <TableCell>{vehicle.weighBridgeData?.netWeight || vehicle.grainDetails?.totalWeight || 0}</TableCell>
                <TableCell>
                  <Chip label={vehicle.grainDetails?.purpose || 'storage'} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  <Chip
                    label={getReturnCount(vehicle.vehicleNumber)}
                    size="small"
                    color={getReturnCount(vehicle.vehicleNumber) > 0 ? 'info' : 'default'}
                    variant={getReturnCount(vehicle.vehicleNumber) > 0 ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell>{getStatusChip(vehicle.status)}</TableCell>
                <TableCell>
                  <Switch
                    size="small"
                    checked={vehicle.status === 'exited'}
                    onChange={(event) => handleStatusToggle(vehicle, event.target.checked)}
                    disabled={user?.role === 'customer'}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {vehicle.status === 'exited' ? 'Exited' : 'Entered'}
                  </Typography>
                </TableCell>
                <TableCell>
                  {vehicle.entryTime ? new Date(vehicle.entryTime).toLocaleString() : 'N/A'}
                </TableCell>
                <TableCell>
                  {vehicle.status === 'inside' && (
                    <Tooltip title="Vehicle Exit">
                      <IconButton
                        size="small"
                        onClick={() => { setSelectedVehicle(vehicle); setExitDialog(true); }}
                        disabled={user?.role === 'customer'}
                      >
                        <ExitToApp />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {vehicles.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                  <LocalShipping sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">No vehicles found</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Vehicle Exit Dialog */}
      <Dialog open={exitDialog} onClose={() => setExitDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>🚛 Vehicle Exit - {selectedVehicle?.vehicleNumber}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Original Bags: {selectedVehicle?.grainDetails?.actualBags} | 
              Original Weight: {selectedVehicle?.grainDetails?.totalWeight} kg
            </Typography>
            <TextField
              fullWidth label="Exit Weight (kg)" type="number"
              value={exitForm.exitWeight}
              onChange={(e) => setExitForm(prev => ({...prev, exitWeight: e.target.value}))}
            />
            <TextField
              fullWidth label="Actual Bags at Exit" type="number"
              value={exitForm.actualBags}
              onChange={(e) => setExitForm(prev => ({...prev, actualBags: e.target.value}))}
            />
            <FormControl fullWidth>
              <InputLabel>Payment Status</InputLabel>
              <Select
                value={exitForm.paymentStatus}
                onChange={(e) => setExitForm(prev => ({...prev, paymentStatus: e.target.value}))}
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="partial">Partial</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth label="Remarks" multiline rows={3}
              value={exitForm.remarks}
              onChange={(e) => setExitForm(prev => ({...prev, remarks: e.target.value}))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExitDialog(false)}>Cancel</Button>
          <Button onClick={handleVehicleExit} variant="contained" color="success">Register Exit</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default VehicleManagement;