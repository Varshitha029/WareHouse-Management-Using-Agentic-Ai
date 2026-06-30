import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Divider,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Chip,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Add,
  Warehouse,
  Download,
  Visibility,
  Delete,
  Edit,
  GridOn
} from '@mui/icons-material';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useTranslation } from '../i18n/LanguageContext';

const DynamicWarehouseLayoutManager = () => {
  const { t } = useTranslation();
  const grainTypeOptions = [
    'Rice',
    'Wheat',
    'Maize',
    'Barley',
    'Millet',
    'Sorghum',
    'Paddy',
    'Soybean',
    'Groundnut',
    'Tur Dal',
    'Chana'
  ];
  const indianStateOptions = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
    'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
    'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
    'Ladakh', 'Lakshadweep', 'Puducherry'
  ];
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  const [slotDetailsDialogOpen, setSlotDetailsDialogOpen] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  
  const [allocationForm, setAllocationForm] = useState({
    customerId: '',
    customerName: '',
    bags: '',
    grainType: '',
    weight: '',
    notes: ''
  });
  
  const [customers, setCustomers] = useState([]);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    description: '',
    location: ''
  });
  
  const [activeStep, setActiveStep] = useState(0);
  const steps = ['Basic Info', 'Configuration', 'Preview & Create'];
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    configuration: {
      numberOfBuildings: 2,
      blocksPerBuilding: 2,
      rowsPerBlock: 3,
      colsPerBlock: 4
    },
    pricing: {
      rentPerQuintalPerMonth: 7,
      maintenancePerMonth: 6,
      insurancePerYear: 5
    }
  });

  const { addNotification } = useSocket();

  useEffect(() => {
    fetchLayouts();
    fetchCustomers();
  }, []);
  
  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/customers', {
        headers: { 'x-auth-token': token }
      });
      console.log('Customers fetched:', response.data.customers);
      setCustomers(response.data.customers || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setError('Failed to load customers. Please try again.');
    }
  };

  const fetchLayouts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/dynamic-warehouse/layouts', {
        headers: { 'x-auth-token': token }
      });
      console.log('Fetched layouts:', response.data.layouts);
      setLayouts(response.data.layouts || []);
    } catch (error) {
      console.error('Error fetching layouts:', error);
      setError('Failed to load warehouse layouts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLayout = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/dynamic-warehouse/layout', formData, {
        headers: { 'x-auth-token': token }
      });
      
      setSuccess(`Warehouse layout "${formData.name}" created successfully!`);
      setCreateDialogOpen(false);
      resetForm();
      fetchLayouts();
      
      addNotification({
        type: 'success',
        title: 'Layout Created',
        message: `Warehouse layout "${formData.name}" has been created with ${response.data.warehouse.totalSlots} slots`,
        timestamp: new Date()
      });
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create warehouse layout');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadJSON = async (layoutId, layoutName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/dynamic-warehouse/layout/${layoutId}/download-json`, {
        responseType: 'blob',
        headers: { 'x-auth-token': token }
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${layoutName.replace(/\s+/g, '_')}_layout.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setSuccess('Layout JSON downloaded successfully!');
    } catch (error) {
      setError('Failed to download layout JSON');
    }
  };

  const handleViewLayout = async (layoutId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/dynamic-warehouse/layout/${layoutId}`, {
        headers: { 'x-auth-token': token }
      });
      setSelectedLayout(response.data);
      setViewDialogOpen(true);
    } catch (error) {
      setError('Failed to load layout details');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLayout = async (layoutId) => {
    if (window.confirm('Are you sure you want to delete this warehouse layout?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`/api/dynamic-warehouse/layout/${layoutId}`, {
          headers: { 'x-auth-token': token }
        });
        setSuccess('Warehouse layout deleted successfully!');
        fetchLayouts();
        
        addNotification({
          type: 'info',
          title: 'Layout Deleted',
          message: 'Warehouse layout has been removed',
          timestamp: new Date()
        });
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to delete warehouse layout');
      }
    }
  };

  const handleOpenEditLayout = (layout) => {
    setEditForm({
      id: layout._id,
      name: layout.name || '',
      description: layout.description || '',
      location: layout.location || ''
    });
    setEditDialogOpen(true);
  };

  const handleUpdateLayout = async () => {
    try {
      if (!editForm.name.trim()) {
        setError('Warehouse name is required');
        return;
      }
      if (!editForm.location.trim()) {
        setError('Warehouse location is required');
        return;
      }

      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.put(`/api/dynamic-warehouse/layout/${editForm.id}`,
        {
          name: editForm.name,
          description: editForm.description,
          location: editForm.location,
        },
        { headers: { 'x-auth-token': token } }
      );

      setSuccess('Warehouse details updated successfully!');
      setEditDialogOpen(false);
      fetchLayouts();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to update warehouse details');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      location: '',
      configuration: {
        numberOfBuildings: 2,
        blocksPerBuilding: 4,
        rowsPerBlock: 4,
        colsPerBlock: 3
      },
      pricing: {
        rentPerQuintalPerMonth: 7,
        maintenancePerMonth: 6,
        insurancePerYear: 5
      }
    });
    setActiveStep(0);
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!formData.name.trim()) {
        setError('Warehouse name is required');
        return;
      }
      if (!formData.location.trim()) {
        setError('Warehouse location is required');
        return;
      }
    }
    
    if (activeStep === steps.length - 1) {
      handleCreateLayout();
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };
  
  const handleSlotClick = (slot, building, block, layoutId) => {
    // If slot has allocations (occupied or partially filled), show details
    if (slot.allocations && slot.allocations.length > 0) {
      setSelectedSlot({
        ...slot,
        building: building.building,
        block: block.block,
        layoutId
      });
      setSlotDetailsDialogOpen(true);
    } else {
      // Empty slot - open allocation dialog
      setSelectedSlot({
        ...slot,
        building: building.building,
        block: block.block,
        layoutId
      });
      setAllocateDialogOpen(true);
      setAllocationForm({
        customerId: '',
        customerName: '',
        bags: '',
        grainType: '',
        weight: '',
        notes: ''
      });
      // Refresh customer list when opening allocation dialog
      fetchCustomers();
    }
  };
  
  const handleAllocateBags = async () => {
    try {
      if (!allocationForm.customerId || !allocationForm.bags) {
        setError('Please select a customer and enter bag quantity');
        return;
      }
      
      setLoading(true);
      const selectedCustomer = customers.find(c => c._id === allocationForm.customerId);
      const token = localStorage.getItem('token');
      
      await axios.post('/api/dynamic-warehouse/allocate-bags', {
        layoutId: selectedSlot.layoutId,
        building: selectedSlot.building,
        block: selectedSlot.block,
        slotLabel: selectedSlot.slotLabel,
        customerId: allocationForm.customerId,
        customerName: selectedCustomer?.profile?.name || selectedCustomer?.username || 'Unknown Customer',
        bags: parseInt(allocationForm.bags),
        grainType: allocationForm.grainType,
        weight: parseFloat(allocationForm.weight) * 100 || 0, // Convert quintals to kg for backend
        notes: allocationForm.notes
      }, {
        headers: { 'x-auth-token': token }
      });
      
      setSuccess(`Successfully allocated ${allocationForm.bags} bags to ${selectedSlot.slotLabel}`);
      setAllocateDialogOpen(false);
      handleViewLayout(selectedSlot.layoutId);
      fetchLayouts();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to allocate bags');
    } finally {
      setLoading(false);
    }
  };

  const handleDeallocateBags = async (customerId, customerName, bags) => {
    if (!window.confirm(`Are you sure you want to deallocate ${bags} bags from ${customerName}?`)) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post('/api/dynamic-warehouse/deallocate-bags', {
        layoutId: selectedSlot.layoutId,
        building: selectedSlot.building,
        block: selectedSlot.block,
        slotLabel: selectedSlot.slotLabel,
        customerId: customerId,
        bags: parseInt(bags)
      }, {
        headers: { 'x-auth-token': token }
      });

      setSuccess(`Successfully deallocated ${bags} bags from ${customerName}`);
      setSlotDetailsDialogOpen(false);
      handleViewLayout(selectedSlot.layoutId);
      fetchLayouts();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to deallocate bags');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalSlots = () => {
    const { numberOfBuildings, blocksPerBuilding, rowsPerBlock, colsPerBlock } = formData.configuration;
    return numberOfBuildings * blocksPerBuilding * rowsPerBlock * colsPerBlock;
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <TextField
              fullWidth
              label={t('warehouse.warehouseName')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="normal"
              required
            />
            <FormControl fullWidth margin="normal" required>
              <InputLabel>Warehouse Location (State)</InputLabel>
              <Select
                value={formData.location}
                label="Warehouse Location (State)"
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              >
                <MenuItem value="">
                  <em>-- Select state/UT --</em>
                </MenuItem>
                {indianStateOptions.map((state) => (
                  <MenuItem key={state} value={state}>{state}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label={t('common.description')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              margin="normal"
              multiline
              rows={3}
            />
          </Box>
        );
      
      case 1:
        return (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              {t('warehouse.configureStructure')}
            </Alert>
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('warehouse.numberOfBuildings')}
                  value={formData.configuration.numberOfBuildings}
                  onChange={(e) => setFormData({
                    ...formData,
                    configuration: {
                      ...formData.configuration,
                      numberOfBuildings: parseInt(e.target.value) || 1
                    }
                  })}
                  inputProps={{ min: 1, max: 10 }}
                  helperText={t('warehouse.maxBuildings')}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('warehouse.blocksPerBuildingLabel')}
                  value={formData.configuration.blocksPerBuilding}
                  onChange={(e) => setFormData({
                    ...formData,
                    configuration: {
                      ...formData.configuration,
                      blocksPerBuilding: parseInt(e.target.value) || 1
                    }
                  })}
                  inputProps={{ min: 1, max: 26 }}
                  helperText={t('warehouse.maxBlocks')}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('warehouse.rowsPerBlock')}
                  value={formData.configuration.rowsPerBlock}
                  onChange={(e) => setFormData({
                    ...formData,
                    configuration: {
                      ...formData.configuration,
                      rowsPerBlock: parseInt(e.target.value) || 1
                    }
                  })}
                  inputProps={{ min: 1, max: 20 }}
                  helperText={t('warehouse.numberOfRows')}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('warehouse.columnsPerBlock')}
                  value={formData.configuration.colsPerBlock}
                  onChange={(e) => setFormData({
                    ...formData,
                    configuration: {
                      ...formData.configuration,
                      colsPerBlock: parseInt(e.target.value) || 1
                    }
                  })}
                  inputProps={{ min: 1, max: 20 }}
                  helperText={t('warehouse.numberOfColumns')}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Pricing Configuration
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              <strong>Pricing Structure:</strong><br />
              • <strong>Monthly Rent:</strong> ₹7 per quintal per month (1 quintal = 100 kg)<br />
              • <strong>Maintenance:</strong> ₹6 per month (flat fee)<br />
              • <strong>Insurance:</strong> ₹5 per year (flat fee)
            </Alert>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Rent per Quintal/Month (₹)"
                  value={formData.pricing.rentPerQuintalPerMonth}
                  onChange={(e) => setFormData({
                    ...formData,
                    pricing: {
                      ...formData.pricing,
                      rentPerQuintalPerMonth: parseFloat(e.target.value) || 0
                    }
                  })}
                  helperText="Per 100kg per month"
                  inputProps={{ min: 0 }}
                />
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Maintenance/Month (₹)"
                  value={formData.pricing.maintenancePerMonth}
                  onChange={(e) => setFormData({
                    ...formData,
                    pricing: {
                      ...formData.pricing,
                      maintenancePerMonth: parseFloat(e.target.value) || 0
                    }
                  })}
                  helperText="Flat monthly charge"
                  inputProps={{ min: 0 }}
                />
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Insurance/Year (₹)"
                  value={formData.pricing.insurancePerYear}
                  onChange={(e) => setFormData({
                    ...formData,
                    pricing: {
                      ...formData.pricing,
                      insurancePerYear: parseFloat(e.target.value) || 0
                    }
                  })}
                  helperText="Annual flat fee"
                  inputProps={{ min: 0 }}
                />
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Example Calculation:</strong> For 500kg (5 quintals) stored for 1 year 2 months:<br />
                • Rent: ₹7 × 5 quintals × 14 months = ₹490<br />
                • Maintenance: ₹6 × 14 months = ₹84<br />
                • Insurance: ₹5 × 1 year = ₹5<br />
                • <strong>Total: ₹579</strong>
              </Typography>
            </Box>
          </Box>
        );
      
      case 2:
        const totalSlots = calculateTotalSlots();
        const slotsPerBlock = formData.configuration.rowsPerBlock * formData.configuration.colsPerBlock;
        
        return (
          <Box>
            <Alert severity="success" sx={{ mb: 3 }}>
              Review your warehouse configuration before creating
            </Alert>
            
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {formData.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {formData.description || 'No description provided'}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  <strong>Location:</strong> {formData.location}
                </Typography>
                
                <Divider sx={{ my: 2 }} />
                
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Buildings
                    </Typography>
                    <Typography variant="h6">
                      {formData.configuration.numberOfBuildings}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Blocks per Building
                    </Typography>
                    <Typography variant="h6">
                      {formData.configuration.blocksPerBuilding}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Grid per Block
                    </Typography>
                    <Typography variant="h6">
                      {formData.configuration.rowsPerBlock} × {formData.configuration.colsPerBlock}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Slots per Block
                    </Typography>
                    <Typography variant="h6">
                      {slotsPerBlock}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Total Storage Slots
                    </Typography>
                    <Typography variant="h4" color="primary">
                      {totalSlots}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Pricing Structure
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Rent / Quintal / Month
                    </Typography>
                    <Typography variant="h6">
                      ₹{formData.pricing.rentPerQuintalPerMonth ?? 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Maintenance / Month
                    </Typography>
                    <Typography variant="h6">
                      ₹{formData.pricing.maintenancePerMonth ?? 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Insurance / Year
                    </Typography>
                    <Typography variant="h6">
                      ₹{formData.pricing.insurancePerYear ?? 0}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Box>
        );
      
      default:
        return null;
    }
  };

  if (loading && layouts.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">
            <Warehouse sx={{ mr: 1, verticalAlign: 'middle' }} />
            {t('warehouse.dynamicLayouts')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateDialogOpen(true)}
          >
            {t('warehouse.createLayout')}
          </Button>
        </Box>

        {layouts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <GridOn sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {t('warehouse.noLayouts')}
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {t('warehouse.createFirstLayout')}
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              {t('warehouse.createLayout')}
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {layouts.map((layout) => (
              <Grid item xs={12} md={6} lg={4} key={layout._id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {layout.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {layout.description || t('common.noDescription')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      Location: {layout.location || 'Not set'}
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          {t('warehouse.totalSlots')}
                        </Typography>
                        <Typography variant="h6">
                          {layout.totalSlots}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          {t('warehouse.occupancy')}
                        </Typography>
                        <Typography variant="h6">
                          {layout.occupancy?.occupancyRate}%
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Chip
                            size="small"
                            label={`${layout.configuration.numberOfBuildings} ${t('warehouse.buildings')}`}
                            color="primary"
                            variant="outlined"
                          />
                          <Chip
                            size="small"
                            label={`${layout.configuration.blocksPerBuilding} ${t('warehouse.blocksPerBuilding')}`}
                            color="secondary"
                            variant="outlined"
                          />
                        </Box>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">
                          {t('warehouse.grid')}: {layout.configuration.rowsPerBlock} × {layout.configuration.colsPerBlock}
                        </Typography>
                      </Grid>
                    </Grid>

                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      <Tooltip title={t('warehouse.viewDetails')}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleViewLayout(layout._id)}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit warehouse details">
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => handleOpenEditLayout(layout)}
                        >
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('warehouse.downloadJSON')}>
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleDownloadJSON(layout._id, layout.name)}
                        >
                          <Download />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('warehouse.deleteLayout')}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteLayout(layout._id)}
                          disabled={layout.occupiedSlots > 0}
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      {/* Create Layout Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          resetForm();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Create Warehouse Layout
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {renderStepContent(activeStep)}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            resetForm();
          }}>
            Cancel
          </Button>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
          >
            Back
          </Button>
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={loading}
          >
            {activeStep === steps.length - 1 ? 'Create Layout' : 'Next'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Layout Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Warehouse Details</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Warehouse Name"
            value={editForm.name}
            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
            margin="normal"
            required
          />
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Warehouse Location (State)</InputLabel>
            <Select
              value={editForm.location}
              label="Warehouse Location (State)"
              onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
            >
              <MenuItem value="">
                <em>-- Select state/UT --</em>
              </MenuItem>
              {indianStateOptions.map((state) => (
                <MenuItem key={state} value={state}>{state}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Description"
            value={editForm.description}
            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
            margin="normal"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateLayout} disabled={loading}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Layout Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {selectedLayout?.warehouse?.name}
        </DialogTitle>
        <DialogContent>
          {selectedLayout && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Total Slots: {selectedLayout.warehouse.totalSlots} | 
                  Occupied: {selectedLayout.warehouse.occupiedSlots} | 
                  Available: {selectedLayout.warehouse.totalSlots - selectedLayout.warehouse.occupiedSlots} | 
                  Occupancy: {selectedLayout.occupancy.occupancyRate}%
                </Typography>
              </Alert>

              {selectedLayout.warehouse.layout.map((building, bIdx) => (
                <Box key={bIdx} sx={{ mb: 4 }}>
                  <Typography variant="h6" gutterBottom sx={{ bgcolor: 'primary.light', color: 'white', p: 1, borderRadius: 1 }}>
                    {building.building}
                  </Typography>
                  
                  {building.blocks.map((block, blIdx) => (
                    <Box key={blIdx} sx={{ mb: 3 }}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                            Block {block.block}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                            {block.rows} rows × {block.cols} columns | 
                            Occupied: {block.slots.filter(s => s.isOccupied).length} / {block.slots.length}
                          </Typography>
                          
                          {/* Slot Grid */}
                          <Box sx={{ 
                            display: 'grid', 
                            gridTemplateColumns: `repeat(${block.cols}, 1fr)`,
                            gap: 1,
                            mt: 2
                          }}>
                            {block.slots.map((slot, sIdx) => {
                              const fillPercentage = slot.capacity > 0 ? (slot.filledBags / slot.capacity) * 100 : 0;
                              const getSlotColor = () => {
                                if (slot.status === 'empty') return { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' };
                                if (slot.status === 'partially-filled') return { bg: '#fff3e0', border: '#ff9800', text: '#e65100' };
                                if (slot.status === 'full') return { bg: '#ffebee', border: '#f44336', text: '#c62828' };
                                return { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' };
                              };
                              const colors = getSlotColor();
                              
                              return (
                                <Box
                                  key={sIdx}
                                  onClick={() => handleSlotClick(slot, building, block, selectedLayout.warehouse._id)}
                                  sx={{
                                    border: 2,
                                    borderColor: colors.border,
                                    bgcolor: colors.bg,
                                    p: 1,
                                    textAlign: 'center',
                                    borderRadius: 1,
                                    minHeight: '90px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    position: 'relative',
                                    '&:hover': {
                                      transform: 'scale(1.05)',
                                      boxShadow: 3
                                    }
                                  }}
                                >
                                  <Typography variant="body2" fontWeight="bold" color={colors.text}>
                                    {slot.slotLabel}
                                  </Typography>
                                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                                    R{slot.row}C{slot.col}
                                  </Typography>
                                  
                                  <Box sx={{ mt: 0.5 }}>
                                    <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 'bold', color: colors.text }}>
                                      {slot.filledBags || 0}/{slot.capacity || 2000}
                                    </Typography>
                                    <Box sx={{ 
                                      width: '100%', 
                                      height: 4, 
                                      bgcolor: 'grey.300', 
                                      borderRadius: 1,
                                      mt: 0.5,
                                      overflow: 'hidden'
                                    }}>
                                      <Box sx={{ 
                                        width: `${fillPercentage}%`, 
                                        height: '100%', 
                                        bgcolor: colors.border,
                                        transition: 'width 0.3s'
                                      }} />
                                    </Box>
                                  </Box>
                                  
                                  <Typography variant="caption" sx={{ fontSize: '0.58rem', color: colors.text, fontWeight: 'bold', mt: 0.5 }}>
                                    {slot.status?.toUpperCase() || 'EMPTY'}
                                  </Typography>
                                  
                                  {slot.allocations && slot.allocations.length > 0 && (
                                    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.secondary', mt: 0.3 }}>
                                      {slot.allocations.length} customer{slot.allocations.length > 1 ? 's' : ''}
                                    </Typography>
                                  )}
                                </Box>
                              );
                            })}
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Slot Details Dialog - Show customers in filled slots */}
      <Dialog 
        open={slotDetailsDialogOpen} 
        onClose={() => setSlotDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {t('warehouse.slot')} {selectedSlot?.slotLabel} - {t('warehouse.customerDetails')}
        </DialogTitle>
        <DialogContent>
          {selectedSlot && (
            <>
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2" component="div">
                  <strong>{t('grainLocations.location')}:</strong> {selectedSlot.building} - {selectedSlot.block} - {t('grainLocations.row')} {selectedSlot.row}, {t('grainLocations.col')} {selectedSlot.col}
                </Typography>
                <Typography variant="body2" component="div">
                  <strong>{t('grainLocations.totalCapacity')}:</strong> {selectedSlot.capacity || 2000} {t('grainLocations.bags')}
                </Typography>
                <Typography variant="body2" component="div">
                  <strong>{t('grainLocations.filled')}:</strong> {selectedSlot.filledBags || 0} {t('grainLocations.bags')} ({((selectedSlot.filledBags || 0) / (selectedSlot.capacity || 2000) * 100).toFixed(1)}%)
                </Typography>
                <Typography variant="body2" component="div">
                  <strong>{t('grainLocations.available')}:</strong> {(selectedSlot.capacity || 2000) - (selectedSlot.filledBags || 0)} {t('grainLocations.bags')}
                </Typography>
                <Typography variant="body2" component="div">
                  <strong>{t('warehouse.status')}:</strong> <Chip size="small" label={selectedSlot.status === 'full' ? t('warehouse.full').toUpperCase() : selectedSlot.status === 'partially-filled' ? t('warehouse.partiallyFilled').toUpperCase() : t('warehouse.empty').toUpperCase()} 
                    color={selectedSlot.status === 'full' ? 'error' : selectedSlot.status === 'partially-filled' ? 'warning' : 'success'} 
                  />
                </Typography>
              </Alert>

              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                {t('warehouse.customersInSlot')}
              </Typography>

              {selectedSlot.allocations && selectedSlot.allocations.length > 0 ? (
                <Grid container spacing={2}>
                  {selectedSlot.allocations.map((allocation, idx) => (
                    <Grid item xs={12} key={idx}>
                      <Card variant="outlined" sx={{ 
                        borderLeft: 4, 
                        borderColor: 'primary.main',
                        '&:hover': { boxShadow: 3 }
                      }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                            <Box>
                              <Typography variant="h6" color="primary">
                                {allocation.customerName || 'Unknown Customer'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {t('warehouse.allocatedOn')}: {allocation.entryDate ? new Date(allocation.entryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : t('warehouse.dateNotAvailable')}
                              </Typography>
                            </Box>
                            <Chip 
                              label={`${allocation.bags} ${t('grainLocations.bags')}`} 
                              color="primary" 
                              sx={{ fontWeight: 'bold' }}
                            />
                          </Box>

                          <Divider sx={{ my: 1.5 }} />

                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="body2" color="text.secondary">
                                <strong>{t('warehouse.numberOfBags')}:</strong>
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                {allocation.bags} {t('grainLocations.bags')}
                              </Typography>
                            </Grid>

                            {allocation.grainType && (
                              <Grid item xs={12} sm={6}>
                                <Typography variant="body2" color="text.secondary">
                                  <strong>{t('grainLocations.grainType')}:</strong>
                                </Typography>
                                <Typography variant="body1">
                                  {allocation.grainType}
                                </Typography>
                              </Grid>
                            )}

                            {allocation.weight && allocation.weight > 0 && (
                              <Grid item xs={12} sm={6}>
                                <Typography variant="body2" color="text.secondary">
                                  <strong>{t('grainLocations.weight')}:</strong>
                                </Typography>
                                <Typography variant="body1">
                                  {(allocation.weight / 100).toFixed(2)} {t('warehouse.quintals')}
                                </Typography>
                              </Grid>
                            )}

                            <Grid item xs={12} sm={6}>
                              <Typography variant="body2" color="text.secondary">
                                <strong>{t('warehouse.customerId')}:</strong>
                              </Typography>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                {allocation.customerId}
                              </Typography>
                            </Grid>

                            {allocation.notes && (
                              <Grid item xs={12}>
                                <Typography variant="body2" color="text.secondary">
                                  <strong>{t('warehouse.notes')}:</strong>
                                </Typography>
                                <Typography variant="body2" sx={{ 
                                  bgcolor: 'grey.100', 
                                  p: 1.5, 
                                  borderRadius: 1,
                                  fontStyle: 'italic'
                                }}>
                                  {allocation.notes}
                                </Typography>
                              </Grid>
                            )}
                          </Grid>

                          <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              onClick={() => handleDeallocateBags(
                                allocation.customer._id || allocation.customer, 
                                allocation.customerName, 
                                allocation.bags
                              )}
                            >
                              {t('warehouse.deallocateAll')} ({allocation.bags} {t('grainLocations.bags')})
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Alert severity="info">
                  {t('warehouse.noAllocations')}
                </Alert>
              )}

              {selectedSlot.status !== 'full' && (
                <Box sx={{ mt: 3 }}>
                  <Alert severity="success">
                    <Typography variant="body2">
                      <strong>{t('warehouse.availableSpace')}:</strong> {(selectedSlot.capacity || 2000) - (selectedSlot.filledBags || 0)} {t('grainLocations.bags')} {t('warehouse.stillAvailable')}
                    </Typography>
                  </Alert>
                  <Button
                    fullWidth
                    variant="outlined"
                    color="primary"
                    sx={{ mt: 2 }}
                    onClick={() => {
                      setSlotDetailsDialogOpen(false);
                      setAllocateDialogOpen(true);
                      setAllocationForm({
                        customerId: '',
                        customerName: '',
                        bags: '',
                        grainType: '',
                        weight: '',
                        notes: ''
                      });
                      fetchCustomers();
                    }}
                  >
                    {t('warehouse.addMoreBags')}
                  </Button>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSlotDetailsDialogOpen(false)}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Allocation Dialog */}
      <Dialog 
        open={allocateDialogOpen} 
        onClose={() => setAllocateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Allocate Bags to Slot {selectedSlot?.slotLabel}
        </DialogTitle>
        <DialogContent>
          {selectedSlot && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Current Capacity:</strong> {selectedSlot.filledBags || 0} / {selectedSlot.capacity || 2000} bags
              </Typography>
              <Typography variant="body2">
                <strong>Available Space:</strong> {(selectedSlot.capacity || 2000) - (selectedSlot.filledBags || 0)} bags
              </Typography>
              <Typography variant="body2">
                <strong>Status:</strong> {selectedSlot.status?.toUpperCase() || 'EMPTY'}
              </Typography>
              <Typography variant="body2">
                <strong>Location:</strong> {selectedSlot.building} - {selectedSlot.block} - Row {selectedSlot.row}, Col {selectedSlot.col}
              </Typography>
            </Alert>
          )}

          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Customer *</InputLabel>
            <Select
              value={allocationForm.customerId}
              onChange={(e) => {
                const customer = customers.find(c => c._id === e.target.value);
                setAllocationForm({
                  ...allocationForm,
                  customerId: e.target.value,
                  customerName: customer ? customer.profile?.name || customer.username : ''
                });
              }}
              label="Select Customer *"
            >
              <MenuItem value="">
                <em>-- Select a customer --</em>
              </MenuItem>
              {customers.map((customer) => (
                <MenuItem key={customer._id} value={customer._id}>
                  {customer.profile?.name || customer.username} ({customer.email})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Number of Bags *"
            type="number"
            value={allocationForm.bags}
            onChange={(e) => {
              const bags = e.target.value;
              const bagsNum = parseInt(bags, 10);
              const autoWeightQuintals = Number.isFinite(bagsNum) && bagsNum > 0
                ? (bagsNum * 50) / 100
                : '';

              setAllocationForm({
                ...allocationForm,
                bags,
                // 1 bag = 50 kg = 0.5 quintal
                weight: autoWeightQuintals === '' ? '' : autoWeightQuintals.toString()
              });
            }}
            sx={{ mt: 2 }}
            inputProps={{ 
              min: 1, 
              max: selectedSlot ? (selectedSlot.capacity || 2000) - (selectedSlot.filledBags || 0) : 2000 
            }}
            helperText={`Maximum: ${selectedSlot ? (selectedSlot.capacity || 2000) - (selectedSlot.filledBags || 0) : 2000} bags available`}
          />

          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Grain Type</InputLabel>
            <Select
              value={allocationForm.grainType}
              label="Grain Type"
              onChange={(e) => setAllocationForm({ ...allocationForm, grainType: e.target.value })}
            >
              <MenuItem value="">
                <em>-- Select grain type --</em>
              </MenuItem>
              {grainTypeOptions.map((grain) => (
                <MenuItem key={grain} value={grain}>
                  {grain}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Weight (quintals)"
            type="number"
            value={allocationForm.weight}
            sx={{ mt: 2 }}
            inputProps={{ min: 0, step: 0.01, readOnly: true }}
            helperText="Auto-calculated: 1 bag = 50 kg = 0.5 quintal"
          />

          <TextField
            fullWidth
            label="Notes"
            multiline
            rows={3}
            value={allocationForm.notes}
            onChange={(e) => setAllocationForm({ ...allocationForm, notes: e.target.value })}
            sx={{ mt: 2 }}
            placeholder="Any additional information..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAllocateDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleAllocateBags}
            disabled={!allocationForm.customerId || !allocationForm.bags || allocationForm.bags <= 0}
          >
            Allocate Bags
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DynamicWarehouseLayoutManager;
