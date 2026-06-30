import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Chip,
  Alert,
  MenuItem
} from '@mui/material';
import { CheckCircle, Science } from '@mui/icons-material';
import axios from 'axios';

const QualityInspectionForm = () => {
  const [formData, setFormData] = useState({
    grainType: '',
    customer: '',
    moistureContent: '',
    foreignMaterial: '',
    damagedGrains: '',
    color: '',
    notes: ''
  });
  const [grade, setGrade] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const calculatedGrade = calculateGrade();
    setGrade(calculatedGrade);
    
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/workers/quality-inspection', {
        ...formData,
        grade: calculatedGrade,
        inspectionDate: new Date()
      }, {
        headers: { 'x-auth-token': token }
      });
      alert('Inspection recorded successfully!');
    } catch (err) {
      alert('Failed to record inspection');
    }
  };

  const calculateGrade = () => {
    const moisture = parseFloat(formData.moistureContent) || 0;
    const foreign = parseFloat(formData.foreignMaterial) || 0;
    const damaged = parseFloat(formData.damagedGrains) || 0;
    
    if (moisture < 12 && foreign < 1 && damaged < 1) return 'A';
    if (moisture < 14 && foreign < 2 && damaged < 3) return 'B';
    return 'C';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Science sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" fontWeight="bold">
          Quality Inspection
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Grain Type"
                  value={formData.grainType}
                  onChange={(e) => setFormData({ ...formData, grainType: e.target.value })}
                  required
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Customer"
                  value={formData.customer}
                  onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  required
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Moisture Content (%)"
                  type="number"
                  value={formData.moistureContent}
                  onChange={(e) => setFormData({ ...formData, moistureContent: e.target.value })}
                  required
                  fullWidth
                  helperText="Good: <14%"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Foreign Material (%)"
                  type="number"
                  value={formData.foreignMaterial}
                  onChange={(e) => setFormData({ ...formData, foreignMaterial: e.target.value })}
                  required
                  fullWidth
                  helperText="Good: <2%"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Damaged Grains (%)"
                  type="number"
                  value={formData.damagedGrains}
                  onChange={(e) => setFormData({ ...formData, damagedGrains: e.target.value })}
                  required
                  fullWidth
                  helperText="Good: <3%"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  select
                  label="Color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  required
                  fullWidth
                >
                  <MenuItem value="Golden">Golden</MenuItem>
                  <MenuItem value="Yellow">Yellow</MenuItem>
                  <MenuItem value="Brown">Brown</MenuItem>
                  <MenuItem value="Mixed">Mixed</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  multiline
                  rows={3}
                  fullWidth
                />
              </Grid>
              {grade && (
                <Grid item xs={12}>
                  <Alert severity={grade === 'A' ? 'success' : grade === 'B' ? 'warning' : 'error'}>
                    <Typography variant="h6">
                      Overall Grade: <Chip label={grade} color={grade === 'A' ? 'success' : grade === 'B' ? 'warning' : 'error'} />
                    </Typography>
                  </Alert>
                </Grid>
              )}
              <Grid item xs={12}>
                <Button type="submit" variant="contained" size="large" fullWidth startIcon={<CheckCircle />}>
                  Submit Inspection
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default QualityInspectionForm;
