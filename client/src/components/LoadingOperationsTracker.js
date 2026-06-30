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
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Refresh,
  LocalShipping as Truck,
  Timer,
  CheckCircle,
  Schedule
} from '@mui/icons-material';
import axios from 'axios';

const LoadingOperationsTracker = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [operations, setOperations] = useState([]);
  const [stats, setStats] = useState(null);

  const fetchOperations = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/workers/loading-operations', {
        headers: { 'x-auth-token': token }
      });
      setOperations(response.data.operations);
      setStats(response.data.stats);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch operations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOperations();
    const interval = setInterval(fetchOperations, 60000);
    return () => clearInterval(interval);
  }, []);

  const calculateProgress = (loaded, target) => {
    return (loaded / target) * 100;
  };

  const calculateElapsedTime = (startTime) => {
    const elapsed = Math.floor((new Date() - new Date(startTime)) / 60000);
    return elapsed;
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

  const activeOps = operations.filter(op => op.status === 'active');
  const completedOps = operations.filter(op => op.status === 'completed');

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Truck sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Loading Operations
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchOperations} disabled={refreshing}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">
                Active Operations
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                {activeOps.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">
                Completed Today
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {stats?.completedToday || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">
                Pending
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {stats?.pending || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">
                Avg Completion Time
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {stats?.avgCompletionTime || 45} min
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Active Operations */}
      {activeOps.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold" color="warning.main">
              <Timer sx={{ verticalAlign: 'middle', mr: 1 }} />
              Active Operations
            </Typography>
            <List>
              {activeOps.map((operation, index) => {
                const progress = calculateProgress(operation.loadedWeight, operation.targetWeight);
                const elapsed = calculateElapsedTime(operation.startTime);
                
                return (
                  <React.Fragment key={operation._id}>
                    <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Box>
                          <Typography variant="h6" fontWeight="bold">
                            {operation.type} - {operation.grainType}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Customer: {operation.customer}
                          </Typography>
                        </Box>
                        <Chip 
                          label={`${elapsed} min`}
                          icon={<Timer />}
                          color="warning"
                        />
                      </Box>
                      
                      <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2">
                            Progress: {operation.loadedWeight} / {operation.targetWeight} kg
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {progress.toFixed(1)}%
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={progress} 
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>

                      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                        <Typography variant="caption" color="textSecondary">
                          <strong>Location:</strong> {operation.location}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          <strong>Workers:</strong> {operation.workersAssigned}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          <strong>Est. Completion:</strong> {operation.estimatedCompletion}
                        </Typography>
                      </Box>
                    </ListItem>
                    {index < activeOps.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Completed Operations */}
      {completedOps.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold" color="success.main">
              <CheckCircle sx={{ verticalAlign: 'middle', mr: 1 }} />
              Completed Today
            </Typography>
            <List>
              {completedOps.map((operation, index) => (
                <React.Fragment key={operation._id}>
                  <ListItem>
                    <ListItemText
                      primary={
                        <Typography variant="body1" fontWeight="bold">
                          {operation.type} - {operation.grainType}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            {operation.customer} • {operation.loadedWeight} kg
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Completed: {new Date(operation.completedAt).toLocaleTimeString()}
                          </Typography>
                        </Box>
                      }
                    />
                    <Chip 
                      label="Completed"
                      color="success"
                      size="small"
                      icon={<CheckCircle />}
                    />
                  </ListItem>
                  {index < completedOps.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {operations.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Schedule sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="textSecondary">
              No loading operations scheduled
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default LoadingOperationsTracker;
