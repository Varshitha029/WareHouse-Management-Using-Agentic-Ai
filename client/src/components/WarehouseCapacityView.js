import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress
} from '@mui/material';
import {
  Refresh,
  ViewModule,
  Storage,
  CheckCircle,
  Warning,
  Error as ErrorIcon
} from '@mui/icons-material';
import axios from 'axios';

const WarehouseCapacityView = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [capacityData, setCapacityData] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchCapacityData = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/analytics/owner/capacity', {
        headers: { 'x-auth-token': token }
      });
      setCapacityData(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch capacity data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCapacityData();
  }, []);

  const handleRefresh = () => {
    fetchCapacityData();
  };

  const getBoxColor = (status) => {
    switch (status) {
      case 'available':
        return '#4caf50'; // Green
      case 'partial':
        return '#ff9800'; // Orange
      case 'full':
        return '#f44336'; // Red
      case 'reserved':
        return '#2196f3'; // Blue
      default:
        return '#9e9e9e'; // Gray
    }
  };

  const getOccupancyColor = (percentage) => {
    if (percentage >= 90) return 'error';
    if (percentage >= 75) return 'warning';
    return 'success';
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

  if (!capacityData) {
    return null;
  }

  const { totalBoxes, occupiedBoxes, availableBoxes, occupancyRate, buildings } = capacityData;

  const filteredBuildings = selectedBuilding === 'all' 
    ? buildings 
    : buildings.filter(b => b.name === selectedBuilding);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ViewModule sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Warehouse Capacity Management
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Building</InputLabel>
            <Select
              value={selectedBuilding}
              label="Building"
              onChange={(e) => setSelectedBuilding(e.target.value)}
            >
              <MenuItem value="all">All Buildings</MenuItem>
              {buildings?.map((building) => (
                <MenuItem key={building.name} value={building.name}>
                  {building.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Overall Capacity Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%', backgroundColor: '#e3f2fd' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Storage sx={{ fontSize: 40, color: '#1976d2' }} />
                <Typography variant="h6" fontWeight="bold">
                  Total Capacity
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color="primary">
                {totalBoxes}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Storage boxes
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%', backgroundColor: '#f3e5f5' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <CheckCircle sx={{ fontSize: 40, color: '#9c27b0' }} />
                <Typography variant="h6" fontWeight="bold">
                  Occupied
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" sx={{ color: '#9c27b0' }}>
                {occupiedBoxes}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {((occupiedBoxes / totalBoxes) * 100).toFixed(1)}% occupied
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%', backgroundColor: '#e8f5e9' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <CheckCircle sx={{ fontSize: 40, color: '#4caf50' }} />
                <Typography variant="h6" fontWeight="bold">
                  Available
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" sx={{ color: '#4caf50' }}>
                {availableBoxes}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {((availableBoxes / totalBoxes) * 100).toFixed(1)}% available
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%', backgroundColor: '#fff3e0' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                {occupancyRate >= 90 ? (
                  <ErrorIcon sx={{ fontSize: 40, color: '#f44336' }} />
                ) : occupancyRate >= 75 ? (
                  <Warning sx={{ fontSize: 40, color: '#ff9800' }} />
                ) : (
                  <CheckCircle sx={{ fontSize: 40, color: '#4caf50' }} />
                )}
                <Typography variant="h6" fontWeight="bold">
                  Occupancy Rate
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={getOccupancyColor(occupancyRate)}>
                {occupancyRate.toFixed(1)}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={occupancyRate} 
                color={getOccupancyColor(occupancyRate)}
                sx={{ mt: 1, height: 8, borderRadius: 4 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Occupancy Alert */}
      {occupancyRate >= 90 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <strong>Critical:</strong> Warehouse capacity is at {occupancyRate.toFixed(1)}%! Consider expanding or optimizing storage.
        </Alert>
      )}
      {occupancyRate >= 75 && occupancyRate < 90 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <strong>Warning:</strong> Warehouse capacity is at {occupancyRate.toFixed(1)}%. Plan for additional capacity soon.
        </Alert>
      )}

      {/* Building-wise Capacity Breakdown */}
      <Grid container spacing={3}>
        {filteredBuildings?.map((building, buildingIndex) => (
          <Grid item xs={12} key={buildingIndex}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      {building.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {building.blocks?.length || 0} blocks • {building.occupied}/{building.total} boxes occupied
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Chip 
                      label={`${((building.occupied / building.total) * 100).toFixed(1)}% Full`}
                      color={getOccupancyColor((building.occupied / building.total) * 100)}
                    />
                    <Typography variant="h6" fontWeight="bold">
                      {building.total - building.occupied} Available
                    </Typography>
                  </Box>
                </Box>

                {/* Blocks Grid */}
                <Grid container spacing={2}>
                  {building.blocks?.map((block, blockIndex) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={blockIndex}>
                      <Paper 
                        sx={{ 
                          p: 2, 
                          border: '2px solid',
                          borderColor: block.occupied === block.total ? '#f44336' : '#e0e0e0',
                          backgroundColor: block.occupied === block.total ? '#ffebee' : 'transparent'
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="body1" fontWeight="bold">
                            {block.name}
                          </Typography>
                          <Chip 
                            label={`${block.occupied}/${block.total}`}
                            size="small"
                            color={block.occupied === block.total ? 'error' : 'default'}
                          />
                        </Box>

                        {/* Wings Display */}
                        <Grid container spacing={1}>
                          {block.wings?.map((wing, wingIndex) => (
                            <Grid item xs={6} key={wingIndex}>
                              <Paper 
                                sx={{ 
                                  p: 1, 
                                  textAlign: 'center',
                                  backgroundColor: wing.status === 'full' ? '#ffcdd2' : 
                                                   wing.status === 'partial' ? '#fff9c4' : 
                                                   '#c8e6c9'
                                }}
                              >
                                <Typography variant="caption" fontWeight="bold" display="block">
                                  Wing {wing.name}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {wing.occupied}/{wing.boxes} boxes
                                </Typography>
                                
                                {/* Box Grid Visualization */}
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5, mt: 1 }}>
                                  {Array.from({ length: wing.boxes }, (_, i) => (
                                    <Box
                                      key={i}
                                      sx={{
                                        width: 20,
                                        height: 20,
                                        backgroundColor: i < wing.occupied ? getBoxColor('full') : getBoxColor('available'),
                                        borderRadius: 0.5,
                                        border: '1px solid #fff'
                                      }}
                                    />
                                  ))}
                                </Box>
                              </Paper>
                            </Grid>
                          ))}
                        </Grid>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Legend */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Status Legend
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 24, height: 24, backgroundColor: getBoxColor('available'), borderRadius: 1 }} />
              <Typography variant="body2">Available</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 24, height: 24, backgroundColor: getBoxColor('partial'), borderRadius: 1 }} />
              <Typography variant="body2">Partially Filled</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 24, height: 24, backgroundColor: getBoxColor('full'), borderRadius: 1 }} />
              <Typography variant="body2">Fully Occupied</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 24, height: 24, backgroundColor: getBoxColor('reserved'), borderRadius: 1 }} />
              <Typography variant="body2">Reserved</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default WarehouseCapacityView;
