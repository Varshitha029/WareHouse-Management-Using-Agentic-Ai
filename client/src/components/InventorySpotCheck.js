import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  Chip,
  Alert
} from '@mui/material';
import { Inventory, Camera, CheckCircle } from '@mui/icons-material';
import axios from 'axios';

const InventorySpotCheck = () => {
  const [spotChecks, setSpotChecks] = useState([]);
  const [verificationData, setVerificationData] = useState({
    recordedWeight: '',
    actualWeight: '',
    notes: ''
  });

  useEffect(() => {
    const fetchSpotChecks = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/workers/assigned-spot-checks', {
          headers: { 'x-auth-token': token }
        });
        setSpotChecks(response.data);
      } catch (err) {
        console.error('Failed to fetch spot checks');
      }
    };
    fetchSpotChecks();
  }, []);

  const handleSubmitVerification = async (checkId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/workers/spot-check/${checkId}/verify`, verificationData, {
        headers: { 'x-auth-token': token }
      });
      alert('Verification submitted!');
    } catch (err) {
      alert('Failed to submit verification');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        <Inventory sx={{ verticalAlign: 'middle', mr: 1 }} />
        Inventory Spot Check
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Assigned Checks</Typography>
              <Typography variant="h4" fontWeight="bold">{spotChecks.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Completed Today</Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">3</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Accuracy Rate</Typography>
              <Typography variant="h4" fontWeight="bold" color="primary">100%</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {spotChecks.map((check) => (
        <Card key={check._id} sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'between', mb: 2 }}>
              <Typography variant="h6" fontWeight="bold">
                Location: {check.location}
              </Typography>
              <Chip label={check.status} color={check.status === 'pending' ? 'warning' : 'success'} />
            </Box>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Customer: {check.customer} • Grain: {check.grainType}
            </Typography>
            <Typography variant="body2" gutterBottom>
              Recorded Weight: {check.recordedWeight} kg
            </Typography>

            {check.status === 'pending' && (
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Actual Weight (kg)"
                    type="number"
                    value={verificationData.actualWeight}
                    onChange={(e) => setVerificationData({ ...verificationData, actualWeight: e.target.value })}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Notes"
                    value={verificationData.notes}
                    onChange={(e) => setVerificationData({ ...verificationData, notes: e.target.value })}
                    multiline
                    rows={2}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<CheckCircle />}
                    onClick={() => handleSubmitVerification(check._id)}
                  >
                    Submit Verification
                  </Button>
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      ))}

      {spotChecks.length === 0 && (
        <Alert severity="info">No spot checks assigned</Alert>
      )}
    </Box>
  );
};

export default InventorySpotCheck;
