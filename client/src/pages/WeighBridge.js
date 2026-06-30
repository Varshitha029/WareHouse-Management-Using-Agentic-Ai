import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Divider,
  Chip,
  CircularProgress,
  Tabs,
  Tab,  InputAdornment,
  IconButton,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  LocalShipping,
  Scale,
  Payment,
  Receipt,
  QrCode,  Info,
  MonetizationOn,
  CheckCircle,
  Person,
  Phone,  Inventory,
  Badge,
  DirectionsCar,
  Close,
  SmartToy
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';
import { useTranslation } from '../i18n/LanguageContext';
import AnomalyDetectionAlert from '../components/AnomalyDetectionAlert';
import axios from 'axios';

const TEN_DIGIT_PHONE_REGEX = /^\d{10}$/;

const WeighBridge = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [vehicles, setVehicles] = useState([]);  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
    const pendingBillTabRef = useRef(null);
  
  // AI Anomaly Detection
  const [anomalyVehicle, setAnomalyVehicle] = useState(null);
  const [showAnomalyAlert, setShowAnomalyAlert] = useState(false);

  // AI Anomaly Check Manual
  const [aiAnomalyLoading, setAiAnomalyLoading] = useState(false);
  const [aiAnomalyResult, setAiAnomalyResult] = useState(null);
  const [aiAnomalyError, setAiAnomalyError] = useState('');
  const [aiAnomalyVehicleId, setAiAnomalyVehicleId] = useState(null);

  // Vehicle Entry Form
  const [vehicleForm, setVehicleForm] = useState({
    vehicleNumber: '',
    vehicleType: 'truck',
    driverName: '',
    driverPhone: '',
    driverLicense: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    visitPurpose: '', // 'weighing_only' or 'grain_loading'
    weighingOption: 'loaded_now',
    emptyWeight: '', // Weight if vehicle is empty now
    loadedWeight: '', // Weight when vehicle is loaded
    emptyWeightForLoaded: '', // Empty vehicle weight (for loaded_now and will_return)
    grainWeight: '', // Calculated grain weight
    capacity: {
      weight: '',
      volume: ''
    },
    cargo: {
      description: '',
      quantity: '',
      unit: 'kg'
    }
  });

  // Payment Form
  const [paymentForm, setPaymentForm] = useState({
    weighingFee: 100, // Fixed fee for weighing
    paymentMethod: 'cash', // 'cash' or 'upi'
    weight: '' // weight input when paying-to-weigh from active vehicles list
  });

  const [weighMode, setWeighMode] = useState(false); // true when weigh button triggers payment

  const [paymentDialog, setPaymentDialog] = useState(false);
  const [upiQrDialog, setUpiQrDialog] = useState(false);
  const [upiQrCode, setUpiQrCode] = useState('');
  const [registeredVehicle, setRegisteredVehicle] = useState(null);
  const [lastTransactionId, setLastTransactionId] = useState(null); // for bill download
  const { addNotification } = useSocket();

  const openBillInTab = async ({ tab, type, transactionId, onError }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/payments/bill/${type}/${transactionId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
        timeout: 20000
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      tab.location.href = url;
      setTimeout(() => window.URL.revokeObjectURL(url), 300000);
    } catch (err) {
      try { tab.close(); } catch (_) {}
      if (onError) onError(err);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  // Calculate grain weight automatically
  useEffect(() => {
    if (vehicleForm.loadedWeight && vehicleForm.emptyWeightForLoaded) {
      const loaded = parseFloat(vehicleForm.loadedWeight) || 0;
      const empty = parseFloat(vehicleForm.emptyWeightForLoaded) || 0;
      const grain = loaded - empty;
      setVehicleForm(prev => ({
        ...prev,
        grainWeight: grain > 0 ? grain.toFixed(2) : ''
      }));
    } else {
      setVehicleForm(prev => ({
        ...prev,
        grainWeight: ''
      }));
    }
  }, [vehicleForm.loadedWeight, vehicleForm.emptyWeightForLoaded]);

  // Debug: Log form state changes
  useEffect(() => {
    console.log('Vehicle Form State Updated:', {
      visitPurpose: vehicleForm.visitPurpose,
      weighingOption: vehicleForm.weighingOption,
      customerName: vehicleForm.customerName,
      customerEmail: vehicleForm.customerEmail
    });
  }, [vehicleForm.visitPurpose, vehicleForm.weighingOption, vehicleForm.customerName, vehicleForm.customerEmail]);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/vehicles');
      setVehicles(response.data.vehicles || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setError('Failed to fetch vehicles');
    } finally {
      setLoading(false);
    }
  };

  const handleVehicleFormChange = (e) => {
    const { name, value } = e.target;
    const normalizedValue = (name === 'driverPhone' || name === 'customerPhone')
      ? value.replace(/\D/g, '').slice(0, 10)
      : value;
    
    console.log('Form field changed:', name, '=', value);
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setVehicleForm(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: normalizedValue
        }
      }));
    } else {
      setVehicleForm(prev => {
        const newState = {
          ...prev,
          [name]: normalizedValue
        };
        console.log('New form state:', newState);
        return newState;
      });
    }
  };

  const handleAiAnomalyCheck = async (vehicle) => {
    try {
      setAiAnomalyLoading(true);
      setAiAnomalyVehicleId(vehicle._id);
      setAiAnomalyResult(null);
      setAiAnomalyError('');
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/ai/anomaly/detect', {
        vehicle_number: vehicle.vehicleNumber,
        gross_weight: vehicle.weighBridgeData?.grossWeight || 0,
        tare_weight: vehicle.weighBridgeData?.tareWeight || 0,
        net_weight: vehicle.weighBridgeData?.netWeight || 0,
        vehicle_type: vehicle.vehicleType || 'truck',
        timestamp: new Date().toISOString()
      }, { headers: { 'x-auth-token': token } });
      setAiAnomalyResult(response.data);
    } catch (err) {
      console.error('AI Anomaly Check error:', err);
      setAiAnomalyError(err.response?.data?.error || err.response?.data?.detail || 'Failed to run anomaly check. Is the AI Engine running?');
    } finally {
      setAiAnomalyLoading(false);
    }
  };

  const handleVehicleEntry = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate required fields before sending
      if (!vehicleForm.visitPurpose) {
        setError(t('vehicles.selectVisitPurpose'));
        setLoading(false);
        return;
      }
      
      if (vehicleForm.visitPurpose === 'grain_loading') {
        if (!vehicleForm.customerName || !vehicleForm.customerPhone || !vehicleForm.customerEmail) {
          setError(t('vehicles.customerDetailsRequired'));
          setLoading(false);
          return;
        }
      }

      if (!TEN_DIGIT_PHONE_REGEX.test(vehicleForm.driverPhone)) {
        setError('Driver phone must be exactly 10 digits');
        setLoading(false);
        return;
      }

      if (vehicleForm.customerPhone && !TEN_DIGIT_PHONE_REGEX.test(vehicleForm.customerPhone)) {
        setError('Customer phone must be exactly 10 digits');
        setLoading(false);
        return;
      }

      // Prepare vehicle data
      const vehicleData = {
        ...vehicleForm,
        weighingOption: vehicleForm.weighingOption || 'loaded_now',
      };

      console.log('Sending vehicle data:', vehicleData);

      // If empty weight is provided, add it to weighBridgeData
      if (vehicleForm.weighingOption === 'empty_now' && vehicleForm.emptyWeight) {
        vehicleData.weighBridgeData = {
          tareWeight: parseFloat(vehicleForm.emptyWeight),
          firstWeighTime: new Date()
        };
        vehicleData.weighingStatus = 'partial';
      } else if (vehicleForm.weighingOption === 'loaded_now' && vehicleForm.loadedWeight && vehicleForm.emptyWeightForLoaded) {
        vehicleData.weighBridgeData = {
          grossWeight: parseFloat(vehicleForm.loadedWeight),
          tareWeight: parseFloat(vehicleForm.emptyWeightForLoaded),
          netWeight: parseFloat(vehicleForm.grainWeight),
          firstWeighTime: new Date(),
          secondWeighTime: new Date()
        };
        vehicleData.weighingStatus = 'completed';
      } else if (vehicleForm.weighingOption === 'will_return' && vehicleForm.loadedWeight && vehicleForm.emptyWeightForLoaded) {
        vehicleData.weighBridgeData = {
          grossWeight: parseFloat(vehicleForm.loadedWeight),
          tareWeight: parseFloat(vehicleForm.emptyWeightForLoaded),
          netWeight: parseFloat(vehicleForm.grainWeight),
          firstWeighTime: new Date(),
          secondWeighTime: new Date()
        };
        vehicleData.weighingStatus = 'completed';
      } else if (vehicleForm.weighingOption === 'loaded_now' || vehicleForm.weighingOption === 'will_return') {
        vehicleData.weighingStatus = 'not_started';
      }

      const response = await axios.post('/api/vehicles/entry', vehicleData);
      
      let successMessage = 'Vehicle entry registered successfully!';
      if (response.data.customerInfo) {
        successMessage += ` ${response.data.customerInfo.message}`;
      }
      
      setSuccess(successMessage);
      addNotification({
        type: 'success',
        title: 'Vehicle Entry',
        message: `Vehicle ${vehicleForm.vehicleNumber} registered successfully`,
        timestamp: new Date()
      });

      // Show payment dialog for weighing_only vehicles
      if (response.data.visitPurpose === 'weighing_only') {
        setRegisteredVehicle(response.data.vehicle);
        setPaymentDialog(true);
      } else {
        setSuccess('Vehicle added to loading queue successfully!');
      }

      // Reset form
      setVehicleForm({
        vehicleNumber: '',
        vehicleType: 'truck',
        driverName: '',
        driverPhone: '',
        driverLicense: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        visitPurpose: '',
        weighingOption: 'loaded_now',
        emptyWeight: '',
        loadedWeight: '',
        emptyWeightForLoaded: '',
        grainWeight: '',
        capacity: { weight: '', volume: '' },
        cargo: { description: '', quantity: '', unit: 'kg' }
      });

      fetchVehicles();
      
    } catch (error) {
      console.error('Vehicle entry error:', error.response?.data);
      if (error.response?.data?.errors) {
        // Validation errors from express-validator
        const errorMessages = error.response.data.errors.map(err => `${err.param}: ${err.msg}`).join(', ');
        setError(`Validation Error: ${errorMessages}`);
      } else {
        setError(error.response?.data?.message || 'Failed to register vehicle entry');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWeighVehicle = async (vehicle) => {
    // Instead of a bare prompt, open the payment dialog with weight entry
    setWeighMode(true);
    setRegisteredVehicle(vehicle);
    setPaymentForm(prev => ({ ...prev, weight: '', paymentMethod: 'cash' }));
    setPaymentDialog(true);
  };

  const handlePayment = async () => {
    if (!registeredVehicle) return;

    // Validate weight when in weigh mode
    if (weighMode && (!paymentForm.weight || isNaN(paymentForm.weight) || parseFloat(paymentForm.weight) <= 0)) {
      setError('Please enter a valid weight in kg.');
      return;
    }

    setLoading(true);
    setError('');

    // Open tab synchronously on user click to avoid popup blocking after async work.
    if (paymentForm.paymentMethod === 'cash') {
      const newTab = window.open('about:blank', '_blank');
      if (!newTab) {
        setLoading(false);
        setError('Popup blocked. Please allow popups for this site and try again.');
        return;
      }
      pendingBillTabRef.current = newTab;
    }
    
    try {
      const weighingFee = parseFloat(paymentForm.weighingFee) || 100;

      // For UPI, use Razorpay checkout
      if (paymentForm.paymentMethod === 'upi') {
        await initiateRazorpayPayment(weighingFee);
        return;
      }

      // For cash, process payment immediately
      if (paymentForm.paymentMethod === 'cash') {
        await processPayment(weighingFee, 'cash');
      }
      
    } catch (error) {
      if (pendingBillTabRef.current) {
        try { pendingBillTabRef.current.close(); } catch (_) {}
        pendingBillTabRef.current = null;
      }
      console.error('Payment error:', error);
      setError(error.response?.data?.message || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const initiateRazorpayPayment = async (amount) => {
    try {
      // Try Razorpay first (real payment gateway)
      const orderRes = await axios.post('/api/payments/create-order', {
        amount,
        type: 'weigh_bridge',
        vehicle: registeredVehicle._id,
        description: `Weighbridge fee for ${registeredVehicle.vehicleNumber}`
      });

      if (!orderRes.data.success || !orderRes.data.keyId) {
        throw new Error('Razorpay not configured');
      }

      const { orderId, keyId } = orderRes.data;

      const options = {
        key: keyId,
        amount: Math.round(amount * 100),
        currency: 'INR',
        name: 'Warehouse Management System',
        description: `Weighbridge Fee - ${registeredVehicle.vehicleNumber}`,
        order_id: orderId,
        handler: async (response) => {
          setLoading(true);
          try {
            // Verify payment signature on backend
            await axios.post('/api/payments/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            await processPayment(amount, 'upi', response.razorpay_payment_id);
          } catch (err) {
            setError('Payment verification failed. Please contact support.');
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: registeredVehicle.driverName || '',
          contact: registeredVehicle.driverPhone || ''
        },
        notes: { vehicleNumber: registeredVehicle.vehicleNumber },
        theme: { color: '#1976d2' },
        method: { upi: true, card: false, wallet: false, emi: false },
        modal: { ondismiss: () => { setLoading(false); } }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => { setError('Payment failed. Please try again.'); setLoading(false); });
      setPaymentDialog(false);
      setLoading(false);
      rzp.open();

    } catch (err) {
      // Razorpay not configured — fall back to static UPI QR
      console.warn('Razorpay not available, falling back to static UPI QR:', err.message);
      await generateStaticUPIQR(amount);
    }
  };

  const generateStaticUPIQR = async (amount) => {
    try {
      const upiString = `upi://pay?pa=${process.env.REACT_APP_UPI_ID || 'warehouse@paytm'}&pn=Warehouse+Management+System&am=${amount}&cu=INR&tn=Weighbridge+Fee+-+${registeredVehicle.vehicleNumber}`;
      const response = await axios.post('/api/payments/generate-upi-qr', {
        upiString, amount, vehicleNumber: registeredVehicle.vehicleNumber
      });
      setUpiQrCode(response.data.qrCode);
      setUpiQrDialog(true);
      setPaymentDialog(false);
      setLoading(false);
    } catch (error) {
      console.error('QR generation error:', error);
      setError('Failed to generate UPI QR code');
      setLoading(false);
    }
  };

  // kept for static UPI fallback dialog

  const confirmUPIPayment = async () => {
    const weighingFee = parseFloat(paymentForm.weighingFee) || 100;
    setLoading(true);
    try {
      // UPI-confirm button click is a direct user gesture, so pre-open tab here too.
      const newTab = window.open('about:blank', '_blank');
      if (!newTab) {
        setLoading(false);
        setError('Popup blocked. Please allow popups for this site and try again.');
        return;
      }
      pendingBillTabRef.current = newTab;

      await processPayment(weighingFee, 'upi');
      setUpiQrDialog(false);
    } catch (error) {
      if (pendingBillTabRef.current) {
        try { pendingBillTabRef.current.close(); } catch (_) {}
        pendingBillTabRef.current = null;
      }
      setError('Failed to confirm payment');
    } finally {
      setLoading(false);
    }
  };

  const processPayment = async (amount, paymentMethod, gatewayPaymentId = null) => {
    try {
      // Create payment transaction
      const paymentData = {
        type: 'weigh_bridge',
        customer: registeredVehicle.customer?._id || null,
        vehicle: registeredVehicle._id,
        amount: {
          baseAmount: amount,
          totalAmount: amount
        },
        payment: {
          method: paymentMethod,
          status: 'completed',
          transactionDate: new Date(),
          ...(gatewayPaymentId && { gatewayTransactionId: gatewayPaymentId })
        },
        description: `Weighbridge charges for vehicle ${registeredVehicle.vehicleNumber}`,
        items: [{
          description: 'Weighbridge Fee',
          quantity: 1,
          unitPrice: amount,
          totalPrice: amount
        }]
      };

      const response = await axios.post('/api/payments/create', paymentData);
      const newTxnId = response.data.transaction?._id;
      setLastTransactionId(newTxnId);
      // Note: cannot auto-open popup here (deep inside async chain = blocked by browser)
      // If a tab was opened during the user click, reuse it so popup is never blocked.
      if (pendingBillTabRef.current) {
        const tab = pendingBillTabRef.current;
        pendingBillTabRef.current = null;
        openBillInTab({
          tab,
          type: 'weighbridge',
          transactionId: newTxnId,
          onError: (billErr) => {
            console.error('Auto-open bill error:', billErr);
            setError('Payment succeeded, but receipt open timed out. Use "View Bill Again".');
          }
        });
      }

      // Update vehicle payment status
      await axios.put(`/api/vehicles/${registeredVehicle._id}`, {
        paymentStatus: 'paid',
        paymentAmount: amount,
        paymentMethod: paymentMethod,
        paymentDate: new Date()
      });

      setSuccess(`Payment of ₹${amount} received via ${paymentMethod.toUpperCase()}! Receipt opened in a new tab.`);
      setPaymentDialog(false);

      // If this was a weigh-mode payment, now record the weight
      if (weighMode && paymentForm.weight) {
        const weightKg = parseFloat(paymentForm.weight);
        const isSecondWeigh = registeredVehicle.weighingStatus === 'partial';
        try {
          const weighRes = await axios.put(`/api/vehicles/${registeredVehicle._id}/weigh`, {
            weight: weightKg,
            weighType: isSecondWeigh ? 'gross' : 'tare'
          });
          const isPartial = weighRes.data.vehicle?.weighingStatus === 'partial';
          addNotification({
            type: 'success',
            title: 'Vehicle Weighed',
            message: isPartial
              ? `Empty weight recorded: ${weightKg} kg`
              : `Net weight: ${weighRes.data.vehicle?.weighBridgeData?.netWeight} kg`,
            timestamp: new Date()
          });
          if (!isPartial && weighRes.data.vehicle?.weighingStatus === 'completed') {
            setAnomalyVehicle(weighRes.data.vehicle);
            setShowAnomalyAlert(true);
          }
        } catch (weighErr) {
          console.error('Weight record error:', weighErr);
        }
      }
      setWeighMode(false);
      setPaymentForm(prev => ({ ...prev, weight: '' }));
      
      // Notify via socket
      addNotification({
        type: 'success',
        title: 'Payment Completed',
        message: `Weighbridge payment of ₹${amount} received for vehicle ${registeredVehicle.vehicleNumber}`,
        timestamp: new Date()
      });

      // Reset
      setRegisteredVehicle(null);
      setUpiQrCode('');
      await fetchVehicles();
      
    } catch (error) {
      console.error('Payment processing error:', error);
      throw error;
    }
  };

  // Open bill PDF in a new tab.
  // window.open MUST be called synchronously before any await so the browser
  // treats it as a direct user-gesture popup (otherwise it gets blocked).
  const openBill = async (type, transactionId) => {
    // 1. Open blank tab synchronously — still inside user-gesture call stack
    const newTab = window.open('about:blank', '_blank');
    if (!newTab) {
      setError('Popup blocked. Please allow popups for this site and try again.');
      return;
    }
    await openBillInTab({
      tab: newTab,
      type,
      transactionId,
      onError: (err) => {
        console.error('Bill open error:', err);
        setError('Failed to open bill. Please try again.');
      }
    });
  };

  const VehicleList = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {t('vehicles.activeVehicles')}
        </Typography>
        
        {/* AI Anomaly Detection Alert */}
        {showAnomalyAlert && anomalyVehicle && (
          <AnomalyDetectionAlert 
            vehicleData={anomalyVehicle}
            onClose={() => {
              setShowAnomalyAlert(false);
              setAnomalyVehicle(null);
            }}
          />
        )}

        {/* AI Anomaly Check Result */}
        {aiAnomalyResult && (
          <Paper sx={{ p: 2, mb: 2, border: 2, borderColor: aiAnomalyResult.anomaly_detected ? 'error.main' : 'success.main', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SmartToy color={aiAnomalyResult.anomaly_detected ? 'error' : 'success'} />
                <Typography variant="h6" fontWeight="bold">
                  AI Anomaly Check Result
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => { setAiAnomalyResult(null); setAiAnomalyVehicleId(null); }}>
                <Close />
              </IconButton>
            </Box>
            
            <Alert severity={aiAnomalyResult.anomaly_detected ? 'error' : 'success'} sx={{ mb: 2, fontWeight: 600, fontSize: '1rem' }}>
              {aiAnomalyResult.anomaly_detected ? '⚠️ ANOMALY DETECTED' : '✅ No Anomaly - All Clear'}
            </Alert>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: aiAnomalyResult.anomaly_detected ? 'error.50' : 'success.50' }}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Typography variant="h6" fontWeight="bold" color={aiAnomalyResult.anomaly_detected ? 'error.main' : 'success.main'}>
                    {aiAnomalyResult.anomaly_detected ? 'ALERT' : 'CLEAN'}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'warning.50' }}>
                  <Typography variant="caption" color="text.secondary">Severity</Typography>
                  <Typography variant="h6" fontWeight="bold">{aiAnomalyResult.severity || 'N/A'}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'info.50' }}>
                  <Typography variant="caption" color="text.secondary">Confidence</Typography>
                  <Typography variant="h6" fontWeight="bold">{typeof aiAnomalyResult.confidence === 'number' ? `${(aiAnomalyResult.confidence * 100).toFixed(1)}%` : (aiAnomalyResult.confidence || 'N/A')}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'grey.100' }}>
                  <Typography variant="caption" color="text.secondary">Vehicle</Typography>
                  <Typography variant="body2" fontWeight="bold">{aiAnomalyResult.vehicle_number || 'N/A'}</Typography>
                </Paper>
              </Grid>
            </Grid>

            {aiAnomalyResult.issues && aiAnomalyResult.issues.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Issues Found:</Typography>
                {aiAnomalyResult.issues.map((issue, idx) => (
                  <Alert key={idx} severity="warning" sx={{ mb: 0.5, py: 0 }}>{issue}</Alert>
                ))}
              </Box>
            )}
            {aiAnomalyResult.recommendations && aiAnomalyResult.recommendations.length > 0 && (
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Recommendations:</Typography>
                {aiAnomalyResult.recommendations.map((rec, idx) => (
                  <Alert key={idx} severity="info" sx={{ mb: 0.5, py: 0 }}>{rec}</Alert>
                ))}
              </Box>
            )}
          </Paper>
        )}
        {aiAnomalyError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAiAnomalyError('')}>{aiAnomalyError}</Alert>
        )}
        
        {loading && <CircularProgress />}
        
        {vehicles.length === 0 && !loading && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {t('vehicles.noVehiclesRegistered')}
          </Alert>
        )}
        
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>{t('vehicles.vehicleNumber')}</strong></TableCell>
                <TableCell><strong>{t('vehicles.type')}</strong></TableCell>
                <TableCell><strong>{t('vehicles.driver')}</strong></TableCell>
                <TableCell><strong>{t('vehicles.purpose')}</strong></TableCell>
                <TableCell><strong>{t('vehicles.weighingStatus')}</strong></TableCell>
                <TableCell><strong>{t('vehicles.weightInfo')}</strong></TableCell>
                <TableCell><strong>{t('vehicles.payment')}</strong></TableCell>
                <TableCell><strong>{t('common.actions')}</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vehicles.filter(v => v.status !== 'exited').map((vehicle) => (
                <TableRow key={vehicle._id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="600">
                      {vehicle.vehicleNumber}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(vehicle.entryTime).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={vehicle.vehicleType} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{vehicle.driverName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {vehicle.driverPhone}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={vehicle.visitPurpose === 'weighing_only' ? t('vehicles.weighingOnly') : t('vehicles.grainLoading')}
                      color={vehicle.visitPurpose === 'weighing_only' ? 'info' : 'primary'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={
                        vehicle.weighingStatus === 'completed' ? t('vehicles.completed') :
                        vehicle.weighingStatus === 'partial' ? t('vehicles.partial') :
                        t('vehicles.notStarted')
                      }
                      color={
                        vehicle.weighingStatus === 'completed' ? 'success' :
                        vehicle.weighingStatus === 'partial' ? 'warning' :
                        'default'
                      }
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {vehicle.weighBridgeData?.tareWeight && (
                      <Typography variant="caption" display="block">
                        {t('vehicles.empty')}: {(vehicle.weighBridgeData.tareWeight).toFixed(2)} tons
                      </Typography>
                    )}
                    {vehicle.weighBridgeData?.grossWeight && (
                      <Typography variant="caption" display="block">
                        {t('vehicles.loaded')}: {(vehicle.weighBridgeData.grossWeight).toFixed(2)} tons
                      </Typography>
                    )}
                    {vehicle.weighBridgeData?.netWeight && (
                      <Typography variant="caption" display="block" fontWeight="600" color="primary">
                        {t('vehicles.net')}: {(vehicle.weighBridgeData.netWeight).toFixed(2)} tons
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={vehicle.paymentStatus === 'paid' ? t('vehicles.paid') : t('vehicles.pending')}
                      color={vehicle.paymentStatus === 'paid' ? 'success' : 'error'}
                      size="small"
                      icon={vehicle.paymentStatus === 'paid' ? <CheckCircle /> : <Payment />}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {vehicle.weighingStatus !== 'completed' && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Scale />}
                          onClick={() => handleWeighVehicle(vehicle)}
                        >
                          {vehicle.weighingStatus === 'partial' ? t('vehicles.secondWeigh') : t('vehicles.weigh')}
                        </Button>
                      )}
                      
                      {vehicle.paymentStatus !== 'paid' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="warning"
                          startIcon={<Payment />}
                          onClick={() => {
                            setRegisteredVehicle(vehicle);
                            setPaymentDialog(true);
                          }}
                        >
                          {t('vehicles.pay')}
                        </Button>
                      )}

                      {vehicle.weighBridgeData?.grossWeight && vehicle.weighBridgeData?.tareWeight && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          startIcon={aiAnomalyLoading && aiAnomalyVehicleId === vehicle._id ? <CircularProgress size={16} /> : <SmartToy />}
                          onClick={() => handleAiAnomalyCheck(vehicle)}
                          disabled={aiAnomalyLoading && aiAnomalyVehicleId === vehicle._id}
                          sx={{ fontWeight: 600 }}
                        >
                          🤖 AI Anomaly Check
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Scale fontSize="large" color="primary" />
          {t('vehicles.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('vehicles.description')}
        </Typography>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          onClose={() => { setSuccess(''); setLastTransactionId(null); }}
          action={
            lastTransactionId && (
              <Button
                size="small"
                variant="contained"
                color="success"
                onClick={() => openBill('weighbridge', lastTransactionId)}
                startIcon={<Receipt />}
              >
                View Bill Again
              </Button>
            )
          }
        >
          {success}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label={t('vehicles.vehicleEntry')} icon={<LocalShipping />} iconPosition="start" />
          <Tab label={t('vehicles.activeVehicles')} icon={<Inventory />} iconPosition="start" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <LocalShipping sx={{ mr: 1, verticalAlign: 'middle' }} />
              {t('vehicles.registerNewVehicle')}
            </Typography>
            
            <Box component="form" onSubmit={handleVehicleEntry} sx={{ mt: 3 }}>
              <Grid container spacing={3}>
                {/* Vehicle Information */}
                <Grid item xs={12}>
                  <Paper elevation={2} sx={{ p: 3, bgcolor: '#f5f5f5' }}>
                    <Typography variant="subtitle1" fontWeight="600" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DirectionsCar color="primary" />
                      {t('vehicles.vehicleInformation')}
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          required
                          label={t('vehicles.vehicleNumber')}
                          name="vehicleNumber"
                          value={vehicleForm.vehicleNumber}
                          onChange={handleVehicleFormChange}
                          placeholder="e.g., AP09AB1234"
                          inputProps={{ style: { textTransform: 'uppercase' } }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <DirectionsCar color="action" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth required>
                          <InputLabel>{t('vehicles.vehicleType')}</InputLabel>
                          <Select
                            name="vehicleType"
                            value={vehicleForm.vehicleType}
                            label="Vehicle Type"
                            onChange={handleVehicleFormChange}
                          >
                            <MenuItem value="truck">🚛 Truck</MenuItem>
                            <MenuItem value="trailer">🚚 Trailer</MenuItem>
                            <MenuItem value="container">📦 Container</MenuItem>
                            <MenuItem value="van">🚐 Van</MenuItem>
                            <MenuItem value="other">🚗 Other</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>

                {/* Driver Information */}
                <Grid item xs={12}>
                  <Paper elevation={2} sx={{ p: 3, bgcolor: '#f5f5f5' }}>
                    <Typography variant="subtitle1" fontWeight="600" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Person color="primary" />
                      {t('vehicles.driverInformation')}
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          required
                          label={t('vehicles.driverName')}
                          name="driverName"
                          value={vehicleForm.driverName}
                          onChange={handleVehicleFormChange}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Person color="action" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          required
                          label={t('vehicles.driverPhone')}
                          name="driverPhone"
                          value={vehicleForm.driverPhone}
                          onChange={handleVehicleFormChange}
                          inputProps={{ maxLength: 10, inputMode: 'numeric', pattern: '[0-9]*' }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Phone color="action" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          label={t('vehicles.driverLicense')}
                          name="driverLicense"
                          value={vehicleForm.driverLicense}
                          onChange={handleVehicleFormChange}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Badge color="action" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>

                {/* Purpose and Weighing Options */}
                <Grid item xs={12}>
                  <Paper elevation={2} sx={{ p: 3, bgcolor: '#f5f5f5' }}>
                    <Typography variant="subtitle1" fontWeight="600" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Info color="primary" />
                      {t('vehicles.visitPurposeWeighingDetails')}
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <FormControl component="fieldset" required>
                          <FormLabel component="legend">{t('vehicles.purposeOfVisit')}</FormLabel>
                          <RadioGroup
                            row
                            name="visitPurpose"
                            value={vehicleForm.visitPurpose}
                            onChange={handleVehicleFormChange}
                          >
                            <FormControlLabel 
                              value="weighing_only" 
                              control={<Radio />} 
                              label={t('vehicles.weighingOnly')} 
                            />
                            <FormControlLabel 
                              value="grain_loading" 
                              control={<Radio />} 
                              label={t('vehicles.grainLoading')} 
                            />
                          </RadioGroup>
                        </FormControl>
                      </Grid>

                      {/* Show weighing options for all visit purposes */}
                      {vehicleForm.visitPurpose && (
                        <>
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary">
                              Vehicle current status is auto-set during entry.
                            </Typography>
                          </Grid>

                          {vehicleForm.weighingOption === 'empty_now' && (
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                required
                                type="number"
                                label={t('vehicles.emptyVehicleWeight')}
                                name="emptyWeight"
                                value={vehicleForm.emptyWeight}
                                onChange={handleVehicleFormChange}
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <Scale color="action" />
                                    </InputAdornment>
                                  ),
                                  endAdornment: (
                                    <InputAdornment position="end">tons</InputAdornment>
                                  ),
                                }}
                                helperText={t('vehicles.emptyWeightHelper')}
                              />
                            </Grid>
                          )}

                          {(vehicleForm.weighingOption === 'loaded_now' || vehicleForm.weighingOption === 'will_return') && (
                            <>
                              <Grid item xs={12} md={4}>
                                <TextField
                                  fullWidth
                                  required
                                  type="number"
                                  label={t('vehicles.loadedVehicleWeight')}
                                  name="loadedWeight"
                                  value={vehicleForm.loadedWeight}
                                  onChange={handleVehicleFormChange}
                                  InputProps={{
                                    startAdornment: (
                                      <InputAdornment position="start">
                                        <Scale color="action" />
                                      </InputAdornment>
                                    ),
                                    endAdornment: (
                                      <InputAdornment position="end">tons</InputAdornment>
                                    ),
                                  }}
                                  helperText={t('vehicles.loadedWeightHelper')}
                                />
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <TextField
                                  fullWidth
                                  required
                                  type="number"
                                  label={t('vehicles.emptyVehicleWeight')}
                                  name="emptyWeightForLoaded"
                                  value={vehicleForm.emptyWeightForLoaded}
                                  onChange={handleVehicleFormChange}
                                  InputProps={{
                                    startAdornment: (
                                      <InputAdornment position="start">
                                        <Scale color="action" />
                                      </InputAdornment>
                                    ),
                                    endAdornment: (
                                      <InputAdornment position="end">tons</InputAdornment>
                                    ),
                                  }}
                                  helperText={t('vehicles.emptyWeightHelper')}
                                />
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <TextField
                                  fullWidth
                                  type="number"
                                  label={t('vehicles.grainWeight')}
                                  name="grainWeight"
                                  value={(parseFloat(vehicleForm.grainWeight) * 10 || 0).toFixed(2)}
                                  disabled
                                  InputProps={{
                                    startAdornment: (
                                      <InputAdornment position="start">
                                        <Inventory color="action" />
                                      </InputAdornment>
                                    ),
                                    endAdornment: (
                                      <InputAdornment position="end">quintals</InputAdornment>
                                    ),
                                  }}
                                  helperText="Automatically calculated (1 ton = 10 quintals)"
                                  sx={{
                                    '& .MuiInputBase-input': {
                                      fontWeight: 'bold',
                                      fontSize: '1.1rem',
                                      color: 'primary.main'
                                    }
                                  }}
                                />
                              </Grid>
                            </>
                          )}
                        </>
                      )}
                    </Grid>
                  </Paper>
                </Grid>

                {/* Customer Information */}
                {vehicleForm.visitPurpose && (
                  <Grid item xs={12}>
                    <Paper elevation={2} sx={{ p: 3, bgcolor: '#f5f5f5' }}>
                      <Typography variant="subtitle1" fontWeight="600" gutterBottom>
                        {t('vehicles.customerInformation')} {vehicleForm.visitPurpose === 'grain_loading' && <span style={{ color: 'red' }}>*</span>}
                      </Typography>
                      {vehicleForm.visitPurpose === 'grain_loading' && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                          {t('vehicles.customerDetailsRequiredAlert')}
                        </Alert>
                      )}
                      <Divider sx={{ mb: 2 }} />
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <TextField
                            fullWidth
                            required={vehicleForm.visitPurpose === 'grain_loading'}
                            label={t('vehicles.customerName')}
                            name="customerName"
                            value={vehicleForm.customerName}
                            onChange={handleVehicleFormChange}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            fullWidth
                            required={vehicleForm.visitPurpose === 'grain_loading'}
                            label={t('vehicles.customerPhone')}
                            name="customerPhone"
                            value={vehicleForm.customerPhone}
                            onChange={handleVehicleFormChange}
                            inputProps={{ maxLength: 10, inputMode: 'numeric', pattern: '[0-9]*' }}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            fullWidth
                            required={vehicleForm.visitPurpose === 'grain_loading'}
                            label={t('vehicles.customerEmail')}
                            name="customerEmail"
                            type="email"
                            value={vehicleForm.customerEmail}
                            onChange={handleVehicleFormChange}
                          />
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button 
                      type="submit" 
                      variant="contained" 
                      size="large"
                      disabled={loading}
                      startIcon={<CheckCircle />}
                    >
                      {loading ? <CircularProgress size={24} /> : t('vehicles.registerVehicle')}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </CardContent>
        </Card>
      )}

      {activeTab === 1 && <VehicleList />}

      {/* Payment Dialog */}
      <Dialog 
        open={paymentDialog} 
        onClose={() => setPaymentDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Payment color="primary" />
              <Typography variant="h6">
                {weighMode
                  ? (registeredVehicle?.weighingStatus === 'partial' ? 'Second Weigh — Pay & Record' : 'Weigh Vehicle — Pay & Record')
                  : t('vehicles.weighbridgePayment')}
              </Typography>
            </Box>
            <IconButton onClick={() => { setPaymentDialog(false); setWeighMode(false); }} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {registeredVehicle && (
            <Box sx={{ mb: 3 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('vehicles.vehicle')}: <strong>{registeredVehicle.vehicleNumber}</strong>
              </Alert>
              
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {t('vehicles.weighingFee')}
                </Typography>
                <Typography variant="h4" color="primary" fontWeight="600">
                  ₹{paymentForm.weighingFee}
                </Typography>
              </Paper>

              {/* Weight input — shown only when triggered from active vehicles weigh button */}
              {weighMode && (
                <TextField
                  label={registeredVehicle?.weighingStatus === 'partial' ? 'Loaded Weight (kg)' : 'Empty Weight (kg)'}
                  type="number"
                  fullWidth
                  required
                  value={paymentForm.weight}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, weight: e.target.value }))}
                  inputProps={{ min: 0, step: 0.01 }}
                  sx={{ mb: 3 }}
                  helperText={registeredVehicle?.weighingStatus === 'partial'
                    ? 'Enter the gross (loaded) weight. Net = Gross − Tare will be calculated.'
                    : 'Enter the tare (empty) weight of the vehicle.'}
                />
              )}

              <FormControl component="fieldset" fullWidth>
                <FormLabel component="legend">{t('vehicles.selectPaymentMethod')}</FormLabel>
                <RadioGroup
                  name="paymentMethod"
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                >
                  <FormControlLabel 
                    value="cash" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MonetizationOn color="success" />
                        <Typography>{t('vehicles.cashPayment')}</Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel 
                    value="upi" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <QrCode color="primary" />
                        <Typography>{t('vehicles.upiPayment')}</Typography>
                      </Box>
                    }
                  />
                </RadioGroup>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => { setPaymentDialog(false); setWeighMode(false); setPaymentForm(prev => ({ ...prev, weight: '' })); }} variant="outlined">
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handlePayment} 
            variant="contained" 
            disabled={loading}
            startIcon={paymentForm.paymentMethod === 'cash' ? <CheckCircle /> : <QrCode />}
          >
            {loading ? <CircularProgress size={24} /> : 
             paymentForm.paymentMethod === 'cash' ? t('vehicles.paymentReceived') : t('vehicles.generateUPIQR')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* UPI QR Code Dialog */}
      <Dialog 
        open={upiQrDialog} 
        onClose={() => setUpiQrDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <QrCode color="primary" />
            <Typography variant="h6">{t('vehicles.scanQRForPayment')}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 3 }}>
            {upiQrCode && (
              <Box>
                <img src={upiQrCode} alt="UPI QR Code" style={{ maxWidth: '300px', width: '100%' }} />
                <Typography variant="h5" sx={{ mt: 3, mb: 1 }} color="primary" fontWeight="600">
                  ₹{paymentForm.weighingFee}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('vehicles.scanWithUPIApp')}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setUpiQrDialog(false)} variant="outlined">
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={confirmUPIPayment} 
            variant="contained" 
            color="success"
            disabled={loading}
            startIcon={<CheckCircle />}
          >
            {loading ? <CircularProgress size={24} /> : t('vehicles.paymentDoneConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default WeighBridge;
