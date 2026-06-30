import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Button,
  Grid,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Security, Report, CheckCircle } from '@mui/icons-material';
import axios from 'axios';

const SafetyComplianceChecker = () => {
  const [checklist, setChecklist] = useState({
    fireExtinguisher: false,
    emergencyExits: false,
    ppeAvailable: false,
    firstAidKit: false
  });
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [incident, setIncident] = useState({ type: '', description: '', severity: 'minor' });
  const [noIncidentDays, setNoIncidentDays] = useState(145);

  const handleChecklistChange = (item) => {
    setChecklist({ ...checklist, [item]: !checklist[item] });
  };

  const handleSubmitChecklist = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/workers/safety-checklist', {
        ...checklist,
        date: new Date()
      }, {
        headers: { 'x-auth-token': token }
      });
      alert('Safety checklist submitted!');
    } catch (err) {
      alert('Failed to submit checklist');
    }
  };

  const handleReportIncident = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/workers/report-incident', incident, {
        headers: { 'x-auth-token': token }
      });
      alert('Incident reported successfully!');
      setIncidentDialogOpen(false);
      setNoIncidentDays(0);
    } catch (err) {
      alert('Failed to report incident');
    }
  };

  const allChecked = Object.values(checklist).every(v => v);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        <Security sx={{ verticalAlign: 'middle', mr: 1 }} />
        Safety Compliance
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">No Incident Days</Typography>
              <Typography variant="h3" fontWeight="bold" color="success.main">{noIncidentDays}</Typography>
              <Typography variant="caption" color="textSecondary">Target: 365 days</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Compliance Score</Typography>
              <Typography variant="h3" fontWeight="bold" color="primary">98%</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">Daily Safety Checklist</Typography>
          <FormGroup>
            <FormControlLabel
              control={<Checkbox checked={checklist.fireExtinguisher} onChange={() => handleChecklistChange('fireExtinguisher')} />}
              label="Fire extinguisher check completed"
            />
            <FormControlLabel
              control={<Checkbox checked={checklist.emergencyExits} onChange={() => handleChecklistChange('emergencyExits')} />}
              label="Emergency exits are clear"
            />
            <FormControlLabel
              control={<Checkbox checked={checklist.ppeAvailable} onChange={() => handleChecklistChange('ppeAvailable')} />}
              label="PPE available and in good condition"
            />
            <FormControlLabel
              control={<Checkbox checked={checklist.firstAidKit} onChange={() => handleChecklistChange('firstAidKit')} />}
              label="First aid kit stocked"
            />
          </FormGroup>
          {allChecked && (
            <Alert severity="success" sx={{ mt: 2 }} icon={<CheckCircle />}>
              All safety checks completed!
            </Alert>
          )}
          <Button
            variant="contained"
            onClick={handleSubmitChecklist}
            disabled={!allChecked}
            fullWidth
            sx={{ mt: 2 }}
          >
            Submit Checklist
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">Incident Reporting</Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Report any safety incidents immediately
          </Alert>
          <Button
            variant="outlined"
            color="error"
            startIcon={<Report />}
            onClick={() => setIncidentDialogOpen(true)}
          >
            Report Incident
          </Button>
        </CardContent>
      </Card>

      <Dialog open={incidentDialogOpen} onClose={() => setIncidentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Report Safety Incident</DialogTitle>
        <DialogContent>
          <TextField
            label="Incident Type"
            value={incident.type}
            onChange={(e) => setIncident({ ...incident, type: e.target.value })}
            fullWidth
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            label="Description"
            value={incident.description}
            onChange={(e) => setIncident({ ...incident, description: e.target.value })}
            multiline
            rows={4}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            select
            label="Severity"
            value={incident.severity}
            onChange={(e) => setIncident({ ...incident, severity: e.target.value })}
            fullWidth
            SelectProps={{ native: true }}
          >
            <option value="minor">Minor</option>
            <option value="moderate">Moderate</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIncidentDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleReportIncident} variant="contained" color="error">
            Submit Report
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SafetyComplianceChecker;
