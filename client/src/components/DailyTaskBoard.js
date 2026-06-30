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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  LinearProgress
} from '@mui/material';
import {
  Refresh,
  CheckCircle,
  Schedule,
  Assignment,
  PlayArrow,
  Done,
  Close
} from '@mui/icons-material';
import axios from 'axios';

const DailyTaskBoard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [dailyStats, setDailyStats] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');

  const fetchTaskData = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      
      // Fetch today's tasks
      const tasksResponse = await axios.get('/api/workers/my-tasks', {
        headers: { 'x-auth-token': token }
      });
      setTasks(tasksResponse.data);
      
      // Fetch today's stats
      const statsResponse = await axios.get('/api/workers/daily-stats', {
        headers: { 'x-auth-token': token }
      });
      setDailyStats(statsResponse.data);
      
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch task data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTaskData();
  }, []);

  const handleRefresh = () => {
    fetchTaskData();
  };

  const handleStartTask = async (taskId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/workers/tasks/${taskId}/start`, {}, {
        headers: { 'x-auth-token': token }
      });
      fetchTaskData();
    } catch (err) {
      alert('Failed to start task');
    }
  };

  const handleCompleteTask = (task) => {
    setSelectedTask(task);
    setTaskDialogOpen(true);
  };

  const handleSubmitCompletion = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/workers/tasks/${selectedTask._id}/complete`, {
        notes: completionNotes
      }, {
        headers: { 'x-auth-token': token }
      });
      
      setTaskDialogOpen(false);
      setCompletionNotes('');
      setSelectedTask(null);
      fetchTaskData();
    } catch (err) {
      alert('Failed to complete task');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in-progress':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'info';
    }
  };

  const filteredTasks = filterStatus === 'all' 
    ? tasks 
    : tasks.filter(task => task.status === filterStatus);

  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

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
          <Assignment sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Daily Task Board
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh} disabled={refreshing}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Today's date: {new Date().toLocaleDateString()} • Complete your assigned tasks to maintain productivity
      </Alert>

      {/* Today's Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Vehicles Processed
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {dailyStats?.vehiclesProcessed || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Grains Handled
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {dailyStats?.grainsHandled || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Payments Collected
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                ₹{dailyStats?.paymentsCollected?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Shift Hours
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {dailyStats?.shiftHours || 0}h
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Task Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Schedule sx={{ fontSize: 40, color: 'text.secondary' }} />
                <Box>
                  <Typography variant="h3" fontWeight="bold">
                    {pendingTasks}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Pending Tasks
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PlayArrow sx={{ fontSize: 40, color: 'warning.main' }} />
                <Box>
                  <Typography variant="h3" fontWeight="bold" color="warning.main">
                    {inProgressTasks}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    In Progress
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CheckCircle sx={{ fontSize: 40, color: 'success.main' }} />
                <Box>
                  <Typography variant="h3" fontWeight="bold" color="success.main">
                    {completedTasks}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Completed
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Completion Rate
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
              {tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0}% Complete
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Filter */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            select
            label="Filter by Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">All Tasks ({tasks.length})</MenuItem>
            <MenuItem value="pending">Pending ({pendingTasks})</MenuItem>
            <MenuItem value="in-progress">In Progress ({inProgressTasks})</MenuItem>
            <MenuItem value="completed">Completed ({completedTasks})</MenuItem>
          </TextField>
        </CardContent>
      </Card>

      {/* Tasks List */}
      {filteredTasks.length > 0 ? (
        <Grid container spacing={3}>
          {filteredTasks.map((task) => (
            <Grid item xs={12} md={6} key={task._id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        {task.type}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <Chip 
                          label={task.status}
                          color={getStatusColor(task.status)}
                          size="small"
                        />
                        <Chip 
                          label={task.priority}
                          color={getPriorityColor(task.priority)}
                          size="small"
                        />
                      </Box>
                    </Box>
                  </Box>

                  {task.description && (
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      {task.description}
                    </Typography>
                  )}

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ mb: 2 }}>
                    {task.vehicleNumber && (
                      <Typography variant="body2">
                        <strong>Vehicle:</strong> {task.vehicleNumber}
                      </Typography>
                    )}
                    {task.customer && (
                      <Typography variant="body2">
                        <strong>Customer:</strong> {task.customer}
                      </Typography>
                    )}
                    {task.location && (
                      <Typography variant="body2">
                        <strong>Location:</strong> {task.location}
                      </Typography>
                    )}
                    {task.assignedAt && (
                      <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 1 }}>
                        Assigned: {new Date(task.assignedAt).toLocaleString()}
                      </Typography>
                    )}
                  </Box>

                  {task.status === 'pending' && (
                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<PlayArrow />}
                      onClick={() => handleStartTask(task._id)}
                    >
                      Start Task
                    </Button>
                  )}

                  {task.status === 'in-progress' && (
                    <Button
                      variant="contained"
                      color="success"
                      fullWidth
                      startIcon={<CheckCircle />}
                      onClick={() => handleCompleteTask(task)}
                    >
                      Complete Task
                    </Button>
                  )}

                  {task.status === 'completed' && (
                    <Box>
                      <Alert severity="success" icon={<CheckCircle />}>
                        Completed at {new Date(task.completedAt).toLocaleString()}
                      </Alert>
                      {task.completionNotes && (
                        <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                          Notes: {task.completionNotes}
                        </Typography>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" color="textSecondary">
              {filterStatus === 'all' 
                ? 'No tasks assigned today' 
                : `No ${filterStatus} tasks`}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Task Completion Dialog */}
      <Dialog open={taskDialogOpen} onClose={() => setTaskDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle />
            <Typography variant="h6">Complete Task</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedTask && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Mark task "<strong>{selectedTask.type}</strong>" as completed
              </Alert>
              <TextField
                label="Completion Notes (Optional)"
                multiline
                rows={4}
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                fullWidth
                placeholder="Add any notes about task completion..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskDialogOpen(false)} startIcon={<Close />}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmitCompletion} 
            variant="contained"
            color="success"
            startIcon={<Done />}
          >
            Mark as Complete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DailyTaskBoard;
