import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Warehouse,
  Person,
  Grain,
  LocalShipping
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const WarehouseLayout = () => {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allocationDialog, setAllocationDialog] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [allocationForm, setAllocationForm] = useState({
    customerId: '',
    grainType: 'rice',
    numberOfBags: '',
    bagWeight: '50',
    qualityGrade: 'A',
    monthlyRentPerBag: '10'
  });

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const response = await axios.get('/api/warehouse/layouts');
      setWarehouses(response.data.layouts || []);
      if (response.data.layouts && response.data.layouts.length > 0) {
        setSelectedWarehouse(response.data.layouts[0]);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      setError('Failed to load warehouse data');
    } finally {
      setLoading(false);
    }
  };

  const getSectionColor = (section) => {
    if (!section.isOccupied) return '#e8f5e8'; // Light green for empty
    
    const bagPercentage = (section.grainDetails?.numberOfBags || 0) / (section.capacity?.maxBags || 100);
    if (bagPercentage >= 0.9) return '#ffebee'; // Light red for nearly full
    if (bagPercentage >= 0.6) return '#fff3e0'; // Light orange for moderately full
    return '#f3e5f5'; // Light purple for occupied but not full
  };

  const getSectionIcon = (section) => {
    if (!section.isOccupied) return null;
    return <Grain fontSize="small" />;
  };

  const handleSectionClick = (building, block, wing, sectionIndex) => {
    if (user?.role !== 'owner') return;
    
    const section = selectedWarehouse.layout
      .find(l => l.buildingNumber === building && l.blockNumber === block)
      ?.wings[wing][sectionIndex];
    
    if (section && !section.isOccupied) {
      setSelectedSection({ building, block, wing, sectionIndex, section });
      setAllocationDialog(true);
    }
  };

  const handleAllocateStorage = async () => {
    try {
      const allocationData = {
        warehouseId: selectedWarehouse._id,
        customerId: allocationForm.customerId,
        location: {
          building: selectedSection.building,
          block: selectedSection.block,
          wing: selectedSection.wing,
          section: selectedSection.sectionIndex + 1
        },
        grainDetails: {
          grainType: allocationForm.grainType,
          numberOfBags: parseInt(allocationForm.numberOfBags),
          bagWeight: parseInt(allocationForm.bagWeight),
          qualityGrade: allocationForm.qualityGrade
        },
        rentDetails: {
          monthlyRentPerBag: parseFloat(allocationForm.monthlyRentPerBag)
        }
      };

      await axios.post('/api/warehouse/allocate-grain-storage', allocationData);
      setAllocationDialog(false);
      fetchWarehouses();
      setAllocationForm({
        customerId: '',
        grainType: 'rice',
        numberOfBags: '',
        bagWeight: '50',
        qualityGrade: 'A',
        monthlyRentPerBag: '10'
      });
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to allocate storage');
    }
  };

  const renderWarehouseLayout = () => {
    if (!selectedWarehouse) return null;

    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          {selectedWarehouse.name} - Layout Visualization
        </Typography>
        
        {selectedWarehouse.layout.map((layoutItem) => (
          <Box key={`${layoutItem.buildingNumber}-${layoutItem.blockNumber}`} sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Building {layoutItem.buildingNumber} - Block {layoutItem.blockNumber}
            </Typography>
            
            {['A', 'B', 'C', 'D'].map((wing) => (
              <Box key={wing} sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Wing {wing}
                </Typography>
                
                <Grid container spacing={1}>
                  {(layoutItem.wings[wing] || []).map((section, sectionIndex) => (
                    <Grid item key={sectionIndex}>
                      <Tooltip
                        title={
                          section.isOccupied
                            ? `${section.grainDetails?.grainType || 'Unknown'} - ${section.grainDetails?.numberOfBags || 0} bags - Customer: ${section.customer?.name || 'Unknown'}`
                            : 'Available for allocation'
                        }
                      >
                        <Card
                          sx={{
                            width: 80,
                            height: 60,
                            backgroundColor: getSectionColor(section),
                            cursor: user?.role === 'owner' && !section.isOccupied ? 'pointer' : 'default',
                            border: section.isOccupied ? '2px solid #4caf50' : '1px solid #ddd',
                            '&:hover': {
                              backgroundColor: user?.role === 'owner' && !section.isOccupied ? '#c8e6c9' : undefined
                            }
                          }}
                          onClick={() => handleSectionClick(
                            layoutItem.buildingNumber,
                            layoutItem.blockNumber,
                            wing,
                            sectionIndex
                          )}
                        >
                          <CardContent sx={{ p: 1, textAlign: 'center' }}>
                            <Typography variant="caption" display="block">
                              S{sectionIndex + 1}
                            </Typography>
                            {getSectionIcon(section)}
                            {section.isOccupied && (
                              <Typography variant="caption" display="block">
                                {section.grainDetails?.numberOfBags || 0}B
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      </Tooltip>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    );
  };

  if (loading) return <Typography>Loading warehouse layout...</Typography>;

  return (
    <Container maxWidth="xl">
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <Warehouse sx={{ mr: 2 }} />
        Warehouse Layout
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Warehouse Selector */}
      {warehouses.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel>Select Warehouse</InputLabel>
            <Select
              value={selectedWarehouse?._id || ''}
              onChange={(e) => {
                const warehouse = warehouses.find(w => w._id === e.target.value);
                setSelectedWarehouse(warehouse);
              }}
            >
              {warehouses.map((warehouse) => (
                <MenuItem key={warehouse._id} value={warehouse._id}>
                  {warehouse.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Legend */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Legend</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip label="Available" sx={{ backgroundColor: '#e8f5e8' }} />
          <Chip label="Partially Full" sx={{ backgroundColor: '#f3e5f5' }} />
          <Chip label="Moderately Full" sx={{ backgroundColor: '#fff3e0' }} />
          <Chip label="Nearly Full" sx={{ backgroundColor: '#ffebee' }} />
        </Box>
      </Paper>

      {/* Warehouse Layout Visualization */}
      {renderWarehouseLayout()}

      {/* Storage Allocation Dialog */}
      <Dialog open={allocationDialog} onClose={() => setAllocationDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Allocate Grain Storage</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Customer ID or Email"
                value={allocationForm.customerId}
                onChange={(e) => setAllocationForm(prev => ({ ...prev, customerId: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Grain Type</InputLabel>
                <Select
                  value={allocationForm.grainType}
                  onChange={(e) => setAllocationForm(prev => ({ ...prev, grainType: e.target.value }))}
                >
                  <MenuItem value="rice">Rice</MenuItem>
                  <MenuItem value="wheat">Wheat</MenuItem>
                  <MenuItem value="maize">Maize</MenuItem>
                  <MenuItem value="barley">Barley</MenuItem>
                  <MenuItem value="millet">Millet</MenuItem>
                  <MenuItem value="sorghum">Sorghum</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Number of Bags"
                type="number"
                value={allocationForm.numberOfBags}
                onChange={(e) => setAllocationForm(prev => ({ ...prev, numberOfBags: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Weight per Bag (kg)"
                type="number"
                value={allocationForm.bagWeight}
                onChange={(e) => setAllocationForm(prev => ({ ...prev, bagWeight: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Quality Grade</InputLabel>
                <Select
                  value={allocationForm.qualityGrade}
                  onChange={(e) => setAllocationForm(prev => ({ ...prev, qualityGrade: e.target.value }))}
                >
                  <MenuItem value="A">Grade A</MenuItem>
                  <MenuItem value="B">Grade B</MenuItem>
                  <MenuItem value="C">Grade C</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Monthly Rent per Bag (₹)"
                type="number"
                value={allocationForm.monthlyRentPerBag}
                onChange={(e) => setAllocationForm(prev => ({ ...prev, monthlyRentPerBag: e.target.value }))}
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

export default WarehouseLayout;