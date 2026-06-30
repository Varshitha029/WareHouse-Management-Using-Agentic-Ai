import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import { Build, Warning, CheckCircle } from '@mui/icons-material';
import axios from 'axios';

const EquipmentManagementPanel = () => {
  const [equipment, setEquipment] = useState([]);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [issueReport, setIssueReport] = useState({ equipment: '', issue: '', priority: 'medium' });

  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/workers/equipment-status', {
          headers: { 'x-auth-token': token }
        });
        setEquipment(response.data);
      } catch (err) {
        console.error('Failed to fetch equipment');
      }
    };
    fetchEquipment();
  }, []);

  const handleReportIssue = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/workers/report-equipment-issue', issueReport, {
        headers: { 'x-auth-token': token }
      });
      alert('Issue reported successfully!');
      setReportDialogOpen(false);
    } catch (err) {
      alert('Failed to report issue');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          <Build sx={{ verticalAlign: 'middle', mr: 1 }} />
          Equipment Management
        </Typography>
        <Button variant="contained" onClick={() => setReportDialogOpen(true)}>
          Report Issue
        </Button>
      </Box>

      <Grid container spacing={3}>
        {equipment.map((item) => (
          <Grid item xs={12} md={6} key={item._id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" fontWeight="bold">{item.name}</Typography>
                  <Chip
                    label={item.status}
                    color={item.status === 'Operational' ? 'success' : 'error'}
                    icon={item.status === 'Operational' ? <CheckCircle /> : <Warning />}
                  />
                </Box>
                <Typography variant="body2" color="textSecondary">
                  Last Maintenance: {new Date(item.lastMaintenance).toLocaleDateString()}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Next Maintenance: {new Date(item.nextMaintenance).toLocaleDateString()}
                </Typography>
                {item.fuelLevel && (
                  <Typography variant="body2" color="textSecondary">
                    Fuel Level: {item.fuelLevel}%
                  </Typography>
                )}
                {item.issue && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {item.issue}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={reportDialogOpen} onClose={() => setReportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Report Equipment Issue</DialogTitle>
        <DialogContent>
          <TextField
            label="Equipment"
            value={issueReport.equipment}
            onChange={(e) => setIssueReport({ ...issueReport, equipment: e.target.value })}
            fullWidth
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            label="Issue Description"
            value={issueReport.issue}
            onChange={(e) => setIssueReport({ ...issueReport, issue: e.target.value })}
            multiline
            rows={4}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            select
            label="Priority"
            value={issueReport.priority}
            onChange={(e) => setIssueReport({ ...issueReport, priority: e.target.value })}
            fullWidth
            SelectProps={{ native: true }}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleReportIssue} variant="contained">
            Submit Report
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EquipmentManagementPanel;
