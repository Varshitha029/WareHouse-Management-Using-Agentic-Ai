import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Checkbox,
  FormControlLabel,
  Divider,
  CircularProgress,
  LinearProgress,
  InputAdornment
} from '@mui/material';
import {
  Send,
  CheckCircle,
  Cancel,
  Pending,
  Warehouse,
  AccountBalance,
  Info,
  CloudUpload,
  PictureAsPdf,
  InsertDriveFile,
  DeleteOutline
} from '@mui/icons-material';
import axios from 'axios';

const CustomerRequestForm = () => {
  const [requestType, setRequestType] = useState('');
  const [message, setMessage] = useState('');
  // Vacate warehouse state
  const [myAllocations, setMyAllocations] = useState([]);
  const [selectedAllocations, setSelectedAllocations] = useState([]);
  const [vacateReason, setVacateReason] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  // Loan state
  const [loanAmount, setLoanAmount] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [loanDuration, setLoanDuration] = useState('');
  const [collateral, setCollateral] = useState('');
  const [loanEligibility, setLoanEligibility] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  // General state
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allocationsLoading, setAllocationsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const fetchLoanEligibility = useCallback(async () => {
    try {
      setEligibilityLoading(true);
      const response = await axios.get('/api/loans/eligibility');
      const data = response.data;
      const parsed = {
        totalGrainValue: parseFloat(data.totalGrainValue) || 0,
        maxLoanAmount: parseFloat(data.maxLoanAmount) || 0,
        availableLoanAmount: parseFloat(data.availableLoanAmount) || 0,
        grainDetails: data.grainDetails || [],
      };
      setLoanEligibility(parsed);
      // Auto-fill with available loan amount
      if (parsed.availableLoanAmount > 0) {
        setLoanAmount(String(Math.floor(parsed.availableLoanAmount)));
      }
    } catch (err) {
      console.error('Error fetching loan eligibility:', err);
    } finally {
      setEligibilityLoading(false);
    }
  }, []);

  // Fetch allocations when vacate_warehouse is selected
  const fetchVacateAllocations = useCallback(async () => {
    try {
      setAllocationsLoading(true);
      const response = await axios.get('/api/warehouse/allocations/my-locations');
      const allocations = response.data.allocations || [];
      // Only show active allocations
      setMyAllocations(allocations.filter(a => a.status === 'active'));
    } catch (error) {
      console.error('Error fetching allocations:', error);
      // Fallback to dynamic-warehouse endpoint
      try {
        const fallback = await axios.get('/api/dynamic-warehouse/my-grain-locations');
        setMyAllocations(fallback.data.grainLocations || []);
      } catch (err) {
        console.error('Fallback also failed:', err);
      }
    } finally {
      setAllocationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (requestType === 'vacate_warehouse' || requestType === 'loan_approval') {
      fetchVacateAllocations();
    }
    if (requestType === 'loan_approval') {
      fetchLoanEligibility();
    }
  }, [requestType, fetchVacateAllocations, fetchLoanEligibility]);

  const fetchMyRequests = async () => {
    try {
      const response = await axios.get('/api/requests/my-requests');
      setMyRequests(response.data || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  // Toggle allocation selection (checkbox multi-select)
  const handleToggleAllocation = (allocation) => {
    const allocationId = allocation._id || allocation.slotLabel;
    setSelectedAllocations((prev) => {
      const exists = prev.find(a => (a._id || a.slotLabel) === allocationId);
      if (exists) {
        return prev.filter(a => (a._id || a.slotLabel) !== allocationId);
      }
      return [...prev, allocation];
    });
  };

  const isAllocationSelected = (allocation) => {
    const allocationId = allocation._id || allocation.slotLabel;
    return selectedAllocations.some(a => (a._id || a.slotLabel) === allocationId);
  };

  // Calculate estimated pending charges for selected allocations
  const calculateEstimatedCharges = () => {
    let totalCharges = 0;
    selectedAllocations.forEach((alloc) => {
      if (alloc.pricing?.finalAmount) {
        totalCharges += alloc.pricing.finalAmount;
      } else if (alloc.pricing?.totalCalculated) {
        totalCharges += alloc.pricing.totalCalculated;
      } else {
        // Estimate based on weight and days if pricing not pre-calculated
        const weight = alloc.storageDetails?.totalWeight || 0;
        const startDate = alloc.duration?.startDate ? new Date(alloc.duration.startDate) : new Date();
        const days = Math.ceil(Math.abs(new Date() - startDate) / (1000 * 60 * 60 * 24));
        const ratePerDay = alloc.pricing?.ratePerDay || 2; // default ₹2/day
        totalCharges += ratePerDay * days + (weight * (alloc.pricing?.ratePerKg || 0));
      }
    });
    return totalCharges;
  };

  // Get display info for an allocation
  const getAllocationDisplayInfo = (alloc) => {
    const building = alloc.allocation?.building || alloc.building || '-';
    const block = alloc.allocation?.block || alloc.block || '-';
    const wing = alloc.allocation?.wing || '';
    const box = alloc.allocation?.box || '';
    const slotLabel = alloc.slotLabel || `B${building}-Blk${block}${wing ? `-${wing}` : ''}${box ? `-Box${box}` : ''}`;

    const items = alloc.storageDetails?.items || [];
    const grainType = items.length > 0
      ? items.map(i => i.description).join(', ')
      : (alloc.grainType || 'N/A');

    const totalWeight = alloc.storageDetails?.totalWeight || items.reduce((s, i) => s + (i.weight || 0), 0) || 0;
    const bags = alloc.bags || items.reduce((s, i) => s + (i.quantity || 0), 0) || 0;

    const startDate = alloc.duration?.startDate
      ? new Date(alloc.duration.startDate).toLocaleDateString()
      : '-';

    return { building, block, wing, box, slotLabel, grainType, totalWeight, bags, startDate };
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload an image (JPEG, PNG, GIF, WebP) or PDF file.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }

    setPaymentProofFile(file);

    // Generate preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPaymentProofPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPaymentProofPreview(null); // PDF - no image preview
    }
  };

  // Remove selected file
  const handleRemoveFile = () => {
    setPaymentProofFile(null);
    setPaymentProofPreview(null);
    setUploadedFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Upload file to server
  const uploadPaymentProof = async () => {
    if (!paymentProofFile) return null;

    const formData = new FormData();
    formData.append('file', paymentProofFile);

    try {
      setUploading(true);
      const response = await axios.post('/api/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const fileName = response.data.file?.filename || response.data.file?.url || '';
      setUploadedFileName(fileName);
      return fileName;
    } catch (err) {
      console.error('File upload error:', err);
      throw new Error('Failed to upload payment proof. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitRequest = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      if (!requestType) {
        setError('Please select a request type');
        return;
      }

      if (!message.trim()) {
        setError('Please enter a message');
        return;
      }

      const requestData = {
        type: requestType,
        message
      };

      if (requestType === 'vacate_warehouse') {
        if (selectedAllocations.length === 0) {
          setError('Please select at least one grain allocation to vacate');
          return;
        }

        if (!vacateReason.trim()) {
          setError('Please provide a reason for vacating');
          return;
        }

        // Upload payment proof if provided
        let paymentProofUrl = '';
        if (paymentProofFile) {
          try {
            paymentProofUrl = await uploadPaymentProof();
          } catch (uploadErr) {
            setError(uploadErr.message);
            return;
          }
        }

        const estimatedCharges = calculateEstimatedCharges();

        requestData.allocationDetails = selectedAllocations.map((alloc) => {
          const info = getAllocationDisplayInfo(alloc);
          return {
            allocationId: alloc._id || null,
            building: info.building,
            block: info.block,
            wing: info.wing,
            box: info.box,
            slotLabel: info.slotLabel,
            grainType: info.grainType,
            totalWeight: info.totalWeight,
            bags: info.bags
          };
        });
        requestData.vacateReason = vacateReason;
        requestData.estimatedCharges = estimatedCharges;
        requestData.paymentProof = paymentProofUrl;
        requestData.selectedAllocationIds = selectedAllocations
          .map(a => a._id)
          .filter(Boolean);

      } else if (requestType === 'loan_approval') {
        if (!loanAmount || !loanPurpose || !loanDuration) {
          setError('Please fill all loan details');
          return;
        }

        requestData.loanDetails = {
          requestedAmount: parseFloat(loanAmount),
          purpose: loanPurpose,
          duration: parseInt(loanDuration),
          collateral
        };
      }

      await axios.post('/api/requests', requestData);

      setSuccess('Request submitted successfully! The warehouse owner will review your request shortly.');
      resetForm();
      fetchMyRequests();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setRequestType('');
    setMessage('');
    setSelectedAllocations([]);
    setVacateReason('');
    setPaymentProofFile(null);
    setPaymentProofPreview(null);
    setUploadedFileName('');
    setLoanAmount('');
    setLoanPurpose('');
    setLoanDuration('');
    setCollateral('');
    setLoanEligibility(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Pending />;
      case 'approved': return <CheckCircle />;
      case 'rejected': return <Cancel />;
      default: return null;
    }
  };

  const estimatedCharges = selectedAllocations.length > 0 ? calculateEstimatedCharges() : 0;

  return (
    <Box>
      <Paper sx={{ p: { xs: 2, md: 4 }, mb: 3, width: '100%' }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Send color="primary" />
          Submit Request to Owner
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Request Type Selection */}
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Request Type</InputLabel>
              <Select
                value={requestType}
                label="Request Type"
                onChange={(e) => {
                  setRequestType(e.target.value);
                  setSelectedAllocations([]);
                  setVacateReason('');
                  setLoanAmount('');
                  setLoanEligibility(null);
                  handleRemoveFile();
                }}
              >
                <MenuItem value="vacate_warehouse">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Warehouse fontSize="small" />
                    Vacate Warehouse
                  </Box>
                </MenuItem>
                <MenuItem value="loan_approval">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccountBalance fontSize="small" />
                    Loan Approval
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* ===== COMMON MESSAGE FIELD ===== */}
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="Message to Owner"
              multiline
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain your request in detail..."
            />
          </Grid>

          {/* ===== VACATE WAREHOUSE SECTION ===== */}
          {requestType === 'vacate_warehouse' && (
            <>
              {/* Grain Allocations Multi-Select */}
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                  Select Grains to Vacate
                </Typography>
                {allocationsLoading ? (
                  <Box sx={{ py: 2 }}>
                    <LinearProgress />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Loading your grain allocations...
                    </Typography>
                  </Box>
                ) : myAllocations.length === 0 ? (
                  <Alert severity="info">
                    No active grain allocations found. You may not have any stored grains currently.
                  </Alert>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {myAllocations.map((alloc, index) => {
                      const info = getAllocationDisplayInfo(alloc);
                      const checked = isAllocationSelected(alloc);
                      return (
                        <Card
                          key={alloc._id || index}
                          variant="outlined"
                          sx={{
                            cursor: 'pointer',
                            border: checked ? '2px solid' : '1px solid',
                            borderColor: checked ? 'primary.main' : 'divider',
                            bgcolor: checked ? 'primary.50' : 'background.paper',
                            transition: 'all 0.2s',
                            '&:hover': { borderColor: 'primary.light', bgcolor: checked ? 'primary.50' : 'action.hover' }
                          }}
                          onClick={() => handleToggleAllocation(alloc)}
                        >
                          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Checkbox
                                checked={checked}
                                color="primary"
                                sx={{ p: 0.5 }}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => handleToggleAllocation(alloc)}
                              />
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                  <Chip
                                    label={info.grainType}
                                    size="small"
                                    color="primary"
                                    variant={checked ? 'filled' : 'outlined'}
                                  />
                                  <Typography variant="body2" color="text.secondary">
                                    Location: Building {info.building}, Block {info.block}
                                    {info.wing ? `, ${info.wing} wing` : ''}
                                    {info.box ? `, Box ${info.box}` : ''}
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 3, mt: 0.5 }}>
                                  <Typography variant="body2">
                                    <strong>Weight:</strong> {info.totalWeight} kg
                                  </Typography>
                                  {info.bags > 0 && (
                                    <Typography variant="body2">
                                      <strong>Bags:</strong> {info.bags}
                                    </Typography>
                                  )}
                                  <Typography variant="body2">
                                    <strong>Stored since:</strong> {info.startDate}
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                )}
              </Grid>

              {/* Estimated Charges Display */}
              {selectedAllocations.length > 0 && (
                <Grid item xs={12}>
                  <Card sx={{ bgcolor: 'warning.light', border: '1px solid', borderColor: 'warning.main' }}>
                    <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="subtitle2" color="warning.dark" gutterBottom>
                        Estimated Pending Charges
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="body2" color="warning.dark">
                            {selectedAllocations.length} allocation{selectedAllocations.length > 1 ? 's' : ''} selected
                          </Typography>
                          {selectedAllocations.map((alloc, i) => {
                            const info = getAllocationDisplayInfo(alloc);
                            const charge = alloc.pricing?.finalAmount || alloc.pricing?.totalCalculated || 0;
                            return (
                              <Typography key={i} variant="body2" color="text.secondary">
                                {info.grainType} ({info.totalWeight} kg) — ₹{charge.toFixed(2)}
                              </Typography>
                            );
                          })}
                        </Box>
                        <Typography variant="h5" color="warning.dark" sx={{ fontWeight: 700 }}>
                          ₹{estimatedCharges.toFixed(2)}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        * Actual charges may be adjusted by the warehouse owner upon approval.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Reason for Vacating */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Reason for Vacating"
                  multiline
                  rows={2}
                  value={vacateReason}
                  onChange={(e) => setVacateReason(e.target.value)}
                  placeholder="e.g., Selling grain, moving to another warehouse, season ended..."
                  required
                />
              </Grid>

              {/* Payment Proof Upload */}
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                  Payment Proof (Optional)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  If you have already paid any outstanding dues, upload a receipt or payment proof below.
                </Typography>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />

                {!paymentProofFile ? (
                  <Button
                    variant="outlined"
                    startIcon={<CloudUpload />}
                    onClick={() => fileInputRef.current?.click()}
                    sx={{ textTransform: 'none' }}
                  >
                    Upload Payment Proof (Image / PDF)
                  </Button>
                ) : (
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {/* Preview */}
                      {paymentProofPreview ? (
                        <Box
                          component="img"
                          src={paymentProofPreview}
                          alt="Payment proof preview"
                          sx={{
                            width: 80,
                            height: 80,
                            objectFit: 'cover',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider'
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: 80,
                            height: 80,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'error.light',
                            borderRadius: 1
                          }}
                        >
                          <PictureAsPdf sx={{ fontSize: 40, color: 'error.dark' }} />
                        </Box>
                      )}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {paymentProofFile.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {(paymentProofFile.size / 1024).toFixed(1)} KB
                        </Typography>
                      </Box>
                      <Tooltip title="Remove file">
                        <IconButton color="error" onClick={handleRemoveFile} size="small">
                          <DeleteOutline />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    {uploading && <LinearProgress sx={{ mt: 1 }} />}
                  </Card>
                )}
              </Grid>
            </>
          )}

          {/* ===== LOAN APPROVAL SECTION ===== */}
          {requestType === 'loan_approval' && (
            <>
              {/* Eligibility Summary Banner */}
              <Grid item xs={12}>
                {eligibilityLoading ? (
                  <Box sx={{ py: 1 }}><LinearProgress /><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Calculating your loan eligibility...</Typography></Box>
                ) : loanEligibility ? (
                  <Card sx={{ bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="subtitle2" color="success.dark" gutterBottom>
                        Your Loan Eligibility
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="text.secondary">Grain Value</Typography>
                          <Typography variant="body1" fontWeight="bold">₹{loanEligibility.totalGrainValue.toLocaleString('en-IN')}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="text.secondary">Max Loan (60%)</Typography>
                          <Typography variant="body1" fontWeight="bold" color="success.main">₹{loanEligibility.maxLoanAmount.toLocaleString('en-IN')}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="text.secondary">Active Loans</Typography>
                          <Typography variant="body1" fontWeight="bold">₹{(loanEligibility.maxLoanAmount - loanEligibility.availableLoanAmount).toLocaleString('en-IN')}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="text.secondary">Available Now</Typography>
                          <Typography variant="body1" fontWeight="bold" color="primary.main">₹{loanEligibility.availableLoanAmount.toLocaleString('en-IN')}</Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ) : null}
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Requested Amount (₹)"
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  required
                  helperText={loanEligibility ? `Max eligible: ₹${loanEligibility.availableLoanAmount.toLocaleString('en-IN')} (auto-filled — modify if needed)` : ''}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Duration (months)"
                  type="number"
                  value={loanDuration}
                  onChange={(e) => setLoanDuration(e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Purpose of Loan"
                  multiline
                  rows={2}
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                  placeholder="Describe what the loan will be used for..."
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Grain as Collateral (Your Warehouse Grains)</InputLabel>
                  <Select
                    value={collateral}
                    label="Grain as Collateral (Your Warehouse Grains)"
                    onChange={(e) => setCollateral(e.target.value)}
                  >
                    <MenuItem value="">
                      <em>None (No collateral)</em>
                    </MenuItem>
                    {eligibilityLoading && (
                      <MenuItem disabled><em>Loading your grains...</em></MenuItem>
                    )}
                    {!eligibilityLoading && (!loanEligibility?.grainDetails || loanEligibility.grainDetails.length === 0) && (
                      <MenuItem disabled><em>No grains currently stored in warehouse</em></MenuItem>
                    )}
                    {(loanEligibility?.grainDetails || []).map((grain, idx) => (
                      <MenuItem
                        key={idx}
                        value={`${grain.grainType} - ${grain.weightKg}kg at ${grain.location || grain.warehouseName}`}
                      >
                        {grain.grainType} — {grain.weightKg} kg &nbsp;|&nbsp; {grain.location || grain.warehouseName} &nbsp;|&nbsp; Value: ₹{parseFloat(grain.value).toLocaleString('en-IN')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}

          {/* Submit Button */}
          <Grid item xs={12}>
            <Button
              variant="contained"
              startIcon={loading || uploading ? <CircularProgress size={20} color="inherit" /> : <Send />}
              onClick={handleSubmitRequest}
              disabled={loading || uploading || !requestType}
              fullWidth
              size="large"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* ===== REQUEST HISTORY ===== */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          My Request History
        </Typography>

        {myRequests.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Info sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography color="text.secondary">
              No requests submitted yet
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {myRequests.map((request) => (
                  <TableRow key={request._id}>
                    <TableCell>
                      <Chip
                        icon={request.type === 'vacate_warehouse' ? <Warehouse /> : <AccountBalance />}
                        label={request.type.replace('_', ' ').toUpperCase()}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {request.type === 'vacate_warehouse' && request.allocationDetails && (
                        <Typography variant="body2">
                          {Array.isArray(request.allocationDetails)
                            ? `${request.allocationDetails.length} allocation(s) — ${request.allocationDetails.map(a => a.grainType).join(', ')}`
                            : `${request.allocationDetails.building} - ${request.allocationDetails.block} - ${request.allocationDetails.slotLabel}`
                          }
                        </Typography>
                      )}
                      {request.type === 'loan_approval' && request.loanDetails && (
                        <Typography variant="body2">
                          ₹{request.loanDetails.requestedAmount} for {request.loanDetails.duration} months
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(request.status)}
                        label={request.status.toUpperCase()}
                        color={getStatusColor(request.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(request.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedRequest(request);
                            setDetailsDialog(true);
                          }}
                        >
                          <Info />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ===== REQUEST DETAILS DIALOG ===== */}
      <Dialog open={detailsDialog} onClose={() => setDetailsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Request Details</DialogTitle>
        <DialogContent sx={{ minHeight: 360 }}>
          {selectedRequest && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">Type</Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {selectedRequest.type.replace('_', ' ').toUpperCase()}
              </Typography>

              <Typography variant="subtitle2" color="text.secondary">Status</Typography>
              <Chip
                icon={getStatusIcon(selectedRequest.status)}
                label={selectedRequest.status.toUpperCase()}
                color={getStatusColor(selectedRequest.status)}
                size="small"
                sx={{ mb: 2 }}
              />

              <Typography variant="subtitle2" color="text.secondary">Message</Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {selectedRequest.message}
              </Typography>

              {/* Vacate-specific details */}
              {selectedRequest.type === 'vacate_warehouse' && (
                <>
                  {selectedRequest.vacateReason && (
                    <>
                      <Typography variant="subtitle2" color="text.secondary">Reason for Vacating</Typography>
                      <Typography variant="body1" sx={{ mb: 2 }}>
                        {selectedRequest.vacateReason}
                      </Typography>
                    </>
                  )}
                  {selectedRequest.estimatedCharges > 0 && (
                    <>
                      <Typography variant="subtitle2" color="text.secondary">Estimated Charges</Typography>
                      <Typography variant="body1" sx={{ mb: 2 }}>
                        ₹{selectedRequest.estimatedCharges.toFixed(2)}
                      </Typography>
                    </>
                  )}
                  {selectedRequest.paymentProof && (
                    <>
                      <Typography variant="subtitle2" color="text.secondary">Payment Proof</Typography>
                      <Chip
                        icon={<InsertDriveFile />}
                        label="Uploaded"
                        size="small"
                        color="success"
                        sx={{ mb: 2 }}
                      />
                    </>
                  )}
                  {Array.isArray(selectedRequest.allocationDetails) && (
                    <>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Allocations to Vacate
                      </Typography>
                      {selectedRequest.allocationDetails.map((ad, i) => (
                        <Box key={i} sx={{ mb: 1, pl: 1, borderLeft: '3px solid', borderColor: 'primary.main' }}>
                          <Typography variant="body2">
                            <strong>{ad.grainType}</strong> — {ad.totalWeight} kg
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Building {ad.building}, Block {ad.block}
                            {ad.wing ? `, ${ad.wing} wing` : ''}
                          </Typography>
                        </Box>
                      ))}
                    </>
                  )}
                </>
              )}

              {selectedRequest.rejectionReason && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="subtitle2" color="error">Rejection Reason</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedRequest.rejectionReason}
                  </Typography>
                </>
              )}

              {selectedRequest.createdLoan && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="subtitle2" color="success.main">Loan Created</Typography>
                  <Typography variant="body1">
                    Amount: ₹{selectedRequest.createdLoan.amount}
                  </Typography>
                  <Typography variant="body1">
                    Interest Rate: {selectedRequest.createdLoan.interestRate}%
                  </Typography>
                  <Typography variant="body1">
                    Duration: {selectedRequest.createdLoan.duration} months
                  </Typography>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomerRequestForm;
