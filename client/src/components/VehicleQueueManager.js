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
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Paper
} from '@mui/material';
import {
  Refresh,
  LocalShipping,
  Schedule,
  Timer,
  TrendingUp
} from '@mui/icons-material';
import axios from 'axios';

const VehicleQueueManager = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [queueData, setQueueData] = useState({
    waiting: [],
    processing: null,
    stats: {}
  });

  const fetchQueueData = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/workers/vehicle-queue', {
        headers: { 'x-auth-token': token }
      });
      setQueueData(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch queue data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
    const interval = setInterval(fetchQueueData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const calculateWaitTime = (arrivalTime) => {
    const minutes = Math.floor((new Date() - new Date(arrivalTime)) / 60000);
    return minutes;
  };

  const getWaitTimeColor = (minutes) => {
    if (minutes < 10) return 'success';
    if (minutes < 20) return 'warning';
    return 'error';
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

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LocalShipping sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Vehicle Queue
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchQueueData} disabled={refreshing}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Waiting Vehicles
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                {queueData.waiting?.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Avg Wait Time
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {queueData.stats?.averageWaitTime || 0} min
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Processed Today
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {queueData.stats?.processedToday || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Peak Hours
              </Typography>
              <Typography variant="h6" fontWeight="bold">
                {queueData.stats?.peakHours || '10 AM - 12 PM'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Currently Processing */}
      {queueData.processing && (
        <Card sx={{ mb: 3, border: '2px solid', borderColor: 'primary.main' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold" color="primary">
              <Timer sx={{ verticalAlign: 'middle', mr: 1 }} />
              Currently Processing
            </Typography>
            <Paper sx={{ p: 3, backgroundColor: 'primary.light', color: 'primary.contrastText' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2">Vehicle Number</Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {queueData.processing.vehicleNumber}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2">Purpose</Typography>
                  <Typography variant="h6">
                    {queueData.processing.purpose}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2">Started</Typography>
                  <Typography variant="h6">
                    {new Date(queueData.processing.startTime).toLocaleTimeString()}
                  </Typography>
                </Grid>
              </Grid>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">Estimated Completion</Typography>
                <Typography variant="h6" fontWeight="bold">
                  {queueData.processing.estimatedCompletion}
                </Typography>
              </Box>
            </Paper>
          </CardContent>
        </Card>
      )}

      {/* Waiting Queue */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            <Schedule sx={{ verticalAlign: 'middle', mr: 1 }} />
            Waiting Queue
          </Typography>
          {queueData.waiting?.length > 0 ? (
            <List>
              {queueData.waiting.map((vehicle, index) => {
                const waitTime = calculateWaitTime(vehicle.arrivalTime);
                return (
                  <React.Fragment key={vehicle._id}>
                    <ListItem
                      sx={{
                        backgroundColor: waitTime > 20 ? 'error.light' : waitTime > 10 ? 'warning.light' : 'transparent',
                        borderRadius: 1,
                        mb: 1
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                        <Typography variant="h6" fontWeight="bold" color="textSecondary">
                          #{index + 1}
                        </Typography>
                      </Box>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h6" fontWeight="bold">
                              {vehicle.vehicleNumber}
                            </Typography>
                            <Chip 
                              label={vehicle.purpose}
                              size="small"
                              color="primary"
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              Arrival: {new Date(vehicle.arrivalTime).toLocaleTimeString()}
                            </Typography>
                            {vehicle.customer && (
                              <Typography variant="body2" color="textSecondary">
                                Customer: {vehicle.customer}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <Box sx={{ textAlign: 'right' }}>
                        <Chip 
                          label={`${waitTime} min`}
                          color={getWaitTimeColor(waitTime)}
                          icon={<Timer />}
                        />
                        <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 0.5 }}>
                          Wait time
                        </Typography>
                      </Box>
                    </ListItem>
                    {index < queueData.waiting.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          ) : (
            <Alert severity="success">
              No vehicles waiting in queue
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default VehicleQueueManager;
