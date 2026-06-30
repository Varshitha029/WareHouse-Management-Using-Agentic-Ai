const express = require('express');
const { body, validationResult } = require('express-validator');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');
const Transaction = require('../models/Transaction');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const WarehouseLayout = require('../models/WarehouseLayout');
const DynamicWarehouseLayout = require('../models/DynamicWarehouseLayout');
const QRCode = require('qrcode');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const emailService = require('../utils/emailService');

// Static fallback Razorpay instance (used if owner has no DB-stored keys)
let _staticRazorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  _staticRazorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

/**
 * Returns { instance, keyId, keySecret } using the owner's DB-stored
 * Razorpay credentials, falling back to process.env values.
 */
async function getOwnerRazorpay() {
  try {
    const owner = await User.findOne({ role: 'owner' }).select('ownerSettings').lean();
    const keyId  = owner?.ownerSettings?.razorpayKeyId  || process.env.RAZORPAY_KEY_ID;
    const secret = owner?.ownerSettings?.razorpaySecret || process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !secret) return { instance: null, keyId: null, keySecret: null };
    return {
      instance: new Razorpay({ key_id: keyId, key_secret: secret }),
      keyId,
      keySecret: secret,
    };
  } catch {
    // DB lookup failed — use env vars
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
      return { instance: null, keyId: null, keySecret: null };
    return {
      instance: _staticRazorpay,
      keyId:    process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET,
    };
  }
}

const router = express.Router();

// @route   POST /api/payments/generate-upi-qr
// @desc    Generate UPI QR code for payment
// @access  Private
router.post('/generate-upi-qr', auth, async (req, res) => {
  try {
    const { upiString, amount, vehicleNumber } = req.body;

    if (!upiString) {
      return res.status(400).json({ message: 'UPI string is required' });
    }

    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(upiString, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    res.json({
      success: true,
      qrCode,
      amount,
      vehicleNumber
    });

  } catch (error) {
    console.error('QR code generation error:', error);
    res.status(500).json({ message: 'Failed to generate QR code', error: error.message });
  }
});

// @route   POST /api/payments/create-order
// @desc    Create Razorpay payment order
// @access  Private
router.post('/create-order', auth, [
  body('amount').isNumeric(),
  body('currency').optional().isIn(['INR']),
  body('type').isIn(['weigh_bridge', 'storage', 'loading', 'unloading', 'penalty'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Load owner's Razorpay credentials (DB first, .env fallback)
    const { instance: rpay, keyId: rpayKeyId } = await getOwnerRazorpay();
    if (!rpay) {
      return res.status(503).json({ 
        success: false,
        message: 'Payment gateway not configured. Please add Razorpay credentials in Settings > Payment Gateway.' 
      });
    }

    const { amount, currency = 'INR', type, vehicle, storageAllocation, description } = req.body;

    // Create Razorpay order
    const order = await rpay.orders.create({
      amount: Math.round(amount * 100), // Amount in paise
      currency: currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId: req.user.id,
        type,
        vehicleId: vehicle || '',
        storageAllocationId: storageAllocation || '',
        description: description || ''
      }
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: rpayKeyId
    });

  } catch (error) {
    console.error('Razorpay error:', error);
    res.status(500).json({ message: 'Payment order creation failed', error: error.message });
  }
});

// @route   POST /api/payments/create
// @desc    Create payment transaction
// @access  Private
router.post('/create', auth, [
  body('type').isIn(['weigh_bridge', 'storage', 'loading', 'unloading', 'penalty', 'weighbridge_fee']),
  body('amount.baseAmount').isNumeric(),
  body('payment.method').isIn(['cash', 'upi', 'card', 'cheque'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      type,
      customer,
      vehicle,
      storageAllocation,
      amount,
      payment,
      description
    } = req.body;

    // Map old type names to Transaction model enum values
    const typeMapping = {
      'weigh_bridge': 'weighbridge_fee',
      'storage': 'grain_storage_rent',
      'loading': 'weighbridge_fee',
      'unloading': 'weighbridge_fee',
      'penalty': 'weighbridge_fee',
      'weighbridge_fee': 'weighbridge_fee'
    };

    const mappedType = typeMapping[type] || 'weighbridge_fee';

    // Generate transaction ID
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Get customer from vehicle if not provided
    let customerId = customer;
    if (!customerId && vehicle) {
      const vehicleDoc = await Vehicle.findById(vehicle);
      if (vehicleDoc && vehicleDoc.customer) {
        customerId = vehicleDoc.customer;
      }
    }

    // If still no customer, use the logged-in user if they're a customer
    if (!customerId && req.user.role === 'customer') {
      customerId = req.user.id;
    }

    const transaction = new Transaction({
      transactionId,
      type: mappedType,
      customer: customerId,
      vehicle,
      storageAllocation,
      amount,
      payment,
      description,
      processedBy: req.user.id
    });

    await transaction.save();

    // Generate invoice number
    transaction.generateInvoiceNumber();
    await transaction.save();

    // Handle different payment methods
    if (payment.method === 'upi') {
      // Generate UPI QR code for local payments
      const upiString = `upi://pay?pa=${process.env.UPI_ID || 'merchant@paytm'}&pn=Warehouse&am=${amount.totalAmount}&cu=INR&tn=Payment for ${transaction.transactionId}`;
      
      try {
        const qrCode = await QRCode.toDataURL(upiString);
        transaction.payment.upiDetails = {
          qrCode,
          vpa: process.env.UPI_ID || 'merchant@paytm',
          transactionRef: transaction.transactionId
        };
        await transaction.save();
      } catch (qrError) {
        console.error('QR Code generation error:', qrError);
      }
    } else if (payment.method === 'card') {
      // Card payments are no longer supported - only Razorpay and UPI
      return res.status(400).json({ 
        message: 'Card payments are not supported. Please use UPI or Razorpay.' 
      });
    }

    // Emit real-time update
    req.io.emit('payment_created', {
      transaction,
      message: `Payment created: ${transaction.transactionId}`
    });

    // Notify owner to allocate storage when inbound grain payment is completed.
    if (vehicle && mappedType === 'weighbridge_fee') {
      const vehicleDoc = await Vehicle.findById(vehicle).populate('customer', 'username profile');
      if (vehicleDoc && vehicleDoc.visitPurpose === 'grain_loading') {
        const customerName = vehicleDoc.customer
          ? `${vehicleDoc.customer.profile?.firstName || ''} ${vehicleDoc.customer.profile?.lastName || ''}`.trim() || vehicleDoc.customer.username || 'Customer'
          : 'Customer';

        req.io.emit('allocation_request_created', {
          vehicleId: vehicleDoc._id,
          vehicleNumber: vehicleDoc.vehicleNumber,
          customerId: vehicleDoc.customer?._id || customerId || null,
          customerName,
          amount: amount?.totalAmount || amount?.baseAmount || 0,
          transactionId: transaction._id,
          timestamp: new Date(),
          message: `Payment received for vehicle ${vehicleDoc.vehicleNumber}. Storage allocation is pending.`
        });
      }
    }

    res.status(201).json({
      message: 'Payment transaction created successfully',
      transaction
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/payments/:id/process
// @desc    Process payment
// @access  Private (Owner)
router.post('/:id/process', [auth, authorize('owner')], async (req, res) => {
  try {
    const { gatewayTransactionId, gatewayResponse } = req.body;

    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.payment.status === 'completed') {
      return res.status(400).json({ message: 'Payment already completed' });
    }

    // Update payment status
    transaction.payment.status = 'completed';
    transaction.payment.paidAt = new Date();
    transaction.payment.gatewayTransactionId = gatewayTransactionId;
    transaction.payment.gatewayResponse = gatewayResponse;

    await transaction.save();

    // Update related entities
    if (transaction.vehicle) {
      const vehicle = await Vehicle.findById(transaction.vehicle);
      if (vehicle) {
        vehicle.paymentStatus = 'paid';
        await vehicle.save();
      }
    }

    // Emit real-time update
    req.io.emit('payment_received', {
      transaction,
      message: `Payment received for ${transaction.transactionId}`
    });

    res.json({
      message: 'Payment processed successfully',
      transaction
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/payments
// @desc    Get payments
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type, startDate, endDate } = req.query;
    
    let query = {};

    // Filter by user role
    if (req.user.role === 'customer') {
      query.customer = req.user.id;
    }

    if (status) {
      query['payment.status'] = status;
    }

    if (type) {
      query.type = type;
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const transactions = await Transaction.find(query)
      .populate('customer', 'username email profile')
      .populate('vehicle', 'vehicleNumber driverName visitPurpose')
      .populate('processedBy', 'username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/payments/pending
// @desc    Get pending payments
// @access  Private
router.get('/pending', auth, async (req, res) => {
  try {
    let query = { 'payment.status': 'pending' };

    // Filter by user role
    if (req.user.role === 'customer') {
      query.customer = req.user.id;
    }

    const pendingPayments = await Transaction.find(query)
      .populate('customer', 'username email profile')
      .populate('vehicle', 'vehicleNumber driverName visitPurpose')
      .populate('processedBy', 'username')
      .sort({ createdAt: -1 });

    res.json(pendingPayments);

  } catch (error) {
    console.error('Error fetching pending payments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/payments/history
// @desc    Get payment history (completed payments)
// @access  Private
router.get('/history', auth, async (req, res) => {
  try {
    let query = { 'payment.status': 'completed' };

    // Filter by user role
    if (req.user.role === 'customer') {
      query.customer = req.user.id;
    }

    const paymentHistory = await Transaction.find(query)
      .populate('customer', 'username email profile')
      .populate('vehicle', 'vehicleNumber driverName visitPurpose')
      .populate('processedBy', 'username')
      .sort({ createdAt: -1 })
      .limit(50); // Limit to last 50 completed payments

    res.json(paymentHistory);

  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/payments/:id
// @desc    Get payment details
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('customer', 'username email profile')
      .populate('vehicle', 'vehicleNumber driverName vehicleType')
      .populate('storageAllocation')
      .populate('processedBy', 'username profile');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Check access permissions
    if (req.user.role === 'customer' && transaction.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(transaction);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/payments/:id/refund
// @desc    Process refund
// @access  Private (Owner only)
router.post('/:id/refund', [auth, authorize('owner')], [
  body('amount').isNumeric(),
  body('reason').trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, reason } = req.body;
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.payment.status !== 'completed') {
      return res.status(400).json({ message: 'Can only refund completed payments' });
    }

    const totalRefunded = transaction.refunds.reduce((sum, refund) => sum + refund.amount, 0);
    
    if (totalRefunded + amount > transaction.amount.totalAmount) {
      return res.status(400).json({ message: 'Refund amount exceeds paid amount' });
    }

    transaction.addRefund(amount, reason, req.user.id);
    await transaction.save();

    res.json({
      message: 'Refund processed successfully',
      transaction
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/payments/stats/dashboard
// @desc    Get payment statistics
// @access  Private (Owner only)
router.get('/stats/dashboard', [auth, authorize('owner')], async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const stats = await Transaction.aggregate([
      {
        $facet: {
          todayStats: [
            { $match: { createdAt: { $gte: startOfDay, $lte: endOfDay } } },
            {
              $group: {
                _id: null,
                totalAmount: { $sum: "$amount.totalAmount" },
                totalTransactions: { $sum: 1 },
                completedPayments: {
                  $sum: { $cond: [{ $eq: ["$payment.status", "completed"] }, 1, 0] }
                }
              }
            }
          ],
          monthlyStats: [
            { $match: { createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
            {
              $group: {
                _id: null,
                totalAmount: { $sum: "$amount.totalAmount" },
                totalTransactions: { $sum: 1 }
              }
            }
          ],
          paymentMethods: [
            {
              $group: {
                _id: "$payment.method",
                count: { $sum: 1 },
                amount: { $sum: "$amount.totalAmount" }
              }
            }
          ],
          pendingPayments: [
            { $match: { "payment.status": "pending" } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                amount: { $sum: "$amount.totalAmount" }
              }
            }
          ]
        }
      }
    ]);

    const result = {
      todayRevenue: stats[0].todayStats[0]?.totalAmount || 0,
      todayTransactions: stats[0].todayStats[0]?.totalTransactions || 0,
      todayCompletedPayments: stats[0].todayStats[0]?.completedPayments || 0,
      monthlyRevenue: stats[0].monthlyStats[0]?.totalAmount || 0,
      monthlyTransactions: stats[0].monthlyStats[0]?.totalTransactions || 0,
      paymentMethodBreakdown: stats[0].paymentMethods,
      pendingPayments: {
        count: stats[0].pendingPayments[0]?.count || 0,
        amount: stats[0].pendingPayments[0]?.amount || 0
      }
    };

    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/payments/verify-payment
// @desc    Verify Razorpay payment
// @access  Private
router.post('/verify-payment', auth, [
  body('razorpay_order_id').notEmpty(),
  body('razorpay_payment_id').notEmpty(),
  body('razorpay_signature').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify payment signature using owner's stored secret (or env fallback)
    const { keySecret: rzpSecret } = await getOwnerRazorpay();
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", rzpSecret || process.env.RAZORPAY_KEY_SECRET || '')
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      // Payment is valid
      console.log('Payment verified successfully:', razorpay_payment_id);
      
      // Update transaction status
      const transaction = await Transaction.findOne({ 
        'payment.gatewayTransactionId': razorpay_order_id 
      }).populate('customer', 'name email phone');
      
      if (transaction) {
        transaction.payment.status = 'completed';
        transaction.payment.paidAt = new Date();
        transaction.payment.razorpayPaymentId = razorpay_payment_id;
        transaction.payment.razorpaySignature = razorpay_signature;
        await transaction.save();

        // Send email receipt if customer email is available
        if (transaction.customer && transaction.customer.email) {
          try {
            const paymentData = {
              receiptNumber: transaction.receiptNumber,
              date: transaction.payment.paidAt,
              vehicleNumber: transaction.vehicle?.vehicleNumber || 'N/A',
              customerName: transaction.customer.name,
              paymentMethod: 'Razorpay (Online)',
              paymentId: razorpay_payment_id,
              amount: transaction.payment.amount
            };

            await emailService.sendPaymentReceipt(transaction.customer.email, paymentData);
            console.log('Receipt email sent successfully to:', transaction.customer.email);
          } catch (emailError) {
            console.error('Failed to send receipt email:', emailError);
            // Don't fail the payment verification if email fails
          }
        }
      }

      res.json({
        success: true,
        message: 'Payment verified successfully',
        paymentId: razorpay_payment_id
      });
    } else {
      console.log('Payment verification failed');
      res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Payment verification failed',
      error: error.message 
    });
  }
});

// @route   POST /api/payments/razorpay-webhook
// @desc    Handle Razorpay webhooks (Development Mode - No Signature Verification)
// @access  Public (Razorpay only)
router.post('/razorpay-webhook', require('express').json(), (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  // ⚠️ DEVELOPMENT MODE: Optional signature verification
  if (secret && signature) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        console.warn('⚠️ Webhook signature verification failed - continuing anyway (dev mode)');
        // Don't return error in development - just log warning
      } else {
        console.log('✅ Webhook signature verified successfully');
      }
    } catch (error) {
      console.warn('⚠️ Webhook signature verification error:', error.message);
    }
  } else {
    console.log('ℹ️ Webhook running without signature verification (development mode)');
  }

  const event = req.body.event;
  const payload = req.body.payload;

  // Handle the event
  switch (event) {
    case 'payment.captured':
      const payment = payload.payment.entity;
      console.log('Payment captured:', payment.id);
      
      // Update transaction status
      Transaction.findOne({ 
        'payment.gatewayTransactionId': payment.order_id 
      })
        .then(transaction => {
          if (transaction) {
            transaction.payment.status = 'completed';
            transaction.payment.paidAt = new Date();
            transaction.payment.razorpayPaymentId = payment.id;
            transaction.save();
          }
        })
        .catch(err => console.error('Error updating transaction:', err));
      
      break;
    
    case 'payment.failed':
      const failedPayment = payload.payment.entity;
      console.log('Payment failed:', failedPayment.id);
      
      // Update transaction status
      Transaction.findOne({ 
        'payment.gatewayTransactionId': failedPayment.order_id 
      })
        .then(transaction => {
          if (transaction) {
            transaction.payment.status = 'failed';
            transaction.save();
          }
        })
        .catch(err => console.error('Error updating transaction:', err));
      
      break;
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// @route   POST /api/payments/storage-rent
// @desc    Create storage rent payment transaction
// @access  Private
router.post('/storage-rent', auth, [
  body('allocationId').notEmpty().withMessage('Allocation ID is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('method').isIn(['cash', 'upi', 'razorpay']).withMessage('Invalid payment method')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { allocationId, amount, method, reference, notes } = req.body;

    // Create transaction record for storage rent
    const transaction = new Transaction({
      transactionId: `RENT-${allocationId}-${Date.now()}`,
      type: 'grain_storage_rent',
      customer: req.user.id,
      amount: {
        baseAmount: parseFloat(amount),
        totalAmount: parseFloat(amount)
      },
      payment: {
        method,
        status: 'completed',
        reference: reference || '',
        date: new Date()
      },
      metadata: {
        allocationId,
        notes: notes || `Storage rent payment - ₹${parseFloat(amount)}`
      }
    });

    await transaction.save();

    res.json({
      success: true,
      message: 'Storage rent payment recorded successfully',
      transaction
    });

  } catch (error) {
    console.error('Error recording storage rent payment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/payments/customer-payment
// @desc    Process customer payment (weighbridge, rent, loan, custom)
// @access  Private (Customer only)
router.post('/customer-payment', [auth, authorize('customer')], [
  body('type').isIn(['weighbridge', 'rent', 'loan', 'custom']),
  body('amount').isNumeric().isFloat({ min: 0 }),
  body('method').isIn(['cash', 'upi', 'razorpay', 'card'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      type, 
      amount, 
      method, 
      description, 
      loanId, 
      allocationId,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature
    } = req.body;

    const customerId = req.user.id;

    // Verify Razorpay signature if payment method is Razorpay
    if (method === 'razorpay') {
      if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
        return res.status(400).json({ message: 'Razorpay payment details missing' });
      }

      const text = razorpayOrderId + '|' + razorpayPaymentId;
      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(text)
        .digest('hex');

      if (generated_signature !== razorpaySignature) {
        return res.status(400).json({ message: 'Payment verification failed' });
      }
    }

    // Map payment type to transaction type enum
    let transactionType;
    switch(type) {
      case 'weighbridge':
        transactionType = 'weighbridge_fee';
        break;
      case 'rent':
        transactionType = 'grain_storage_rent';
        break;
      case 'loan':
        transactionType = 'loan_repayment';
        break;
      case 'custom':
        transactionType = 'grain_release';
        break;
      default:
        transactionType = 'grain_storage_rent';
    }

    const transactionId = razorpayPaymentId || `${method.toUpperCase()}_${Date.now()}`;
    const amountValue = parseFloat(amount);

    // Create transaction record
    const transaction = new Transaction({
      transactionId: transactionId,
      customer: customerId,
      type: transactionType,
      amount: {
        baseAmount: amountValue,
        totalAmount: amountValue
      },
      payment: {
        method: method,
        status: 'completed',
        gatewayTransactionId: razorpayPaymentId,
        paidAt: new Date()
      }
    });

    await transaction.save();

    // Update related models based on payment type
    if (type === 'loan' && loanId) {
      const Loan = require('../models/Loan');
      const loan = await Loan.findById(loanId);
      
      if (loan && loan.customer.toString() === customerId) {
        loan.payments.push({
          amount: parseFloat(amount),
          method: method,
          type: 'principal',
          transactionId: razorpayPaymentId || transaction._id
        });
        
        loan.paidAmount = (loan.paidAmount || 0) + parseFloat(amount);
        loan.remainingAmount = loan.totalAmount - loan.paidAmount;
        
        if (loan.remainingAmount <= 0) {
          loan.status = 'completed';
          loan.remainingAmount = 0;
        }
        
        await loan.save();
      }
    }

    if (type === 'rent' && allocationId) {
      const StorageAllocation = require('../models/StorageAllocation');
      const allocation = await StorageAllocation.findById(allocationId);
      
      if (allocation && allocation.customer.toString() === customerId) {
        allocation.rentDetails = allocation.rentDetails || {};
        allocation.rentDetails.paidRent = (allocation.rentDetails.paidRent || 0) + parseFloat(amount);
        allocation.rentDetails.dueRent = Math.max(0, (allocation.rentDetails.totalRent || 0) - allocation.rentDetails.paidRent);
        
        await allocation.save();
      }
    }

    // Update customer's payment history
    const User = require('../models/User');
    const customer = await User.findByIdAndUpdate(customerId, {
      $push: {
        'customerGrainDetails.paymentHistory': {
          date: new Date(),
          type: type === 'weighbridge' ? 'weighbridge' : type,
          amount: parseFloat(amount),
          description: description || `${type} payment`,
          transactionId: razorpayPaymentId || transaction._id.toString()
        }
      }
    }, { new: true });

    // Emit real-time notification to owner
    if (req.io) {
      req.io.emit('payment_received', {
        customerId: customerId,
        customerName: customer?.name || 'Unknown Customer',
        amount: parseFloat(amount),
        type: type,
        method: method,
        transactionId: transaction._id,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} payment recorded successfully`,
      transaction: {
        _id: transaction._id,
        amount: transaction.amount.totalAmount,
        type: transaction.type,
        method: transaction.payment.method,
        date: transaction.createdAt
      }
    });

  } catch (error) {
    console.error('Error processing customer payment:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while processing payment', 
      error: error.message 
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// BILL GENERATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

// Helper: draw rupees symbol
const rupee = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;

// Helper: number to words (for bill)
const ones = ['', 'One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
               'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
               'Seventeen','Eighteen','Nineteen'];
const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
function numToWords(n) {
  n = Math.round(n);
  if (n === 0) return 'Zero';
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '');
  if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + numToWords(n%100) : '');
  if (n < 100000) return numToWords(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + numToWords(n%1000) : '');
  if (n < 10000000) return numToWords(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + numToWords(n%100000) : '');
  return numToWords(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' ' + numToWords(n%10000000) : '');
}

const resolveReceiptNumber = (txn) =>
  txn.invoice?.number ||
  txn.invoiceNumber ||
  txn.receiptNumber ||
  txn.transactionId ||
  txn._id.toString().slice(-8).toUpperCase();

const getDisplayName = (user) => {
  if (!user) return 'N/A';
  const firstName = user.profile?.firstName || '';
  const lastName = user.profile?.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || user.name || user.username || 'N/A';
};

const fitTextToWidth = (text, maxWidth, font, size) => {
  const value = String(text || '');
  if (!value) return '';
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  const suffix = '...';
  let trimmed = value;
  while (trimmed.length > 0 && font.widthOfTextAtSize(`${trimmed}${suffix}`, size) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed ? `${trimmed}${suffix}` : suffix;
};

// @route  GET /api/payments/bill/weighbridge/:transactionId
// @desc   Download weighbridge payment bill as PDF
// @access Private
router.get('/bill/weighbridge/:transactionId', auth, async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.transactionId)
      .populate('vehicle')
      .populate('customer', 'username name email profile')
      .populate('processedBy', 'username name profile');

    if (!txn) return res.status(404).json({ message: 'Transaction not found' });

    // ── Fetch warehouse info from owner's layout ───────────────────────────────
    const ownerUser = txn.processedBy || await User.findOne({ role: 'owner' }).select('username name profile').lean();
    const ownerId = ownerUser?._id || txn.processedBy?._id || txn.processedBy;
    let warehouseLayout = ownerId
      ? (await DynamicWarehouseLayout.findOne({ owner: ownerId }).select('name')) ||
        (await WarehouseLayout.findOne({ owner: ownerId }).select('name'))
      : null;
    const ownerProfile  = ownerUser?.profile || {};
    const warehouseName = (warehouseLayout?.name || 'FARMERS WAREHOUSE').toUpperCase();
    const ownerPhone    = ownerProfile.phone || '-';
    const addrParts     = [
      ownerProfile.address?.street,
      ownerProfile.address?.city,
      ownerProfile.address?.state
    ].filter(Boolean);
    const warehouseAddr = addrParts.length ? addrParts.join(', ').toUpperCase() : 'INDIA';

    const vehicle   = txn.vehicle || {};
    const amount    = txn.amount?.totalAmount || txn.amount?.baseAmount || 0;
    const paidAt    = txn.payment?.paidAt  || txn.createdAt || new Date();
    const method    = (txn.payment?.method || 'cash').toUpperCase();
    const inTime    = vehicle.entryTime ? new Date(vehicle.entryTime) : new Date(txn.createdAt);
    const outTime   = new Date(paidAt);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([594, 420]);
    const W = 594;
    const H = 420;
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const cBg = rgb(0.05, 0.08, 0.14);
    const cPanel = rgb(0.13, 0.18, 0.28);
    const cPanelAlt = rgb(0.10, 0.15, 0.24);
    const cAccent = rgb(0.98, 0.43, 0.13);
    const cText = rgb(0.90, 0.93, 0.98);
    const cMuted = rgb(0.66, 0.73, 0.84);

    const fmtDate = (d) => {
      const dt = d ? new Date(d) : null;
      return dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleDateString('en-IN') : '-';
    };
    const fmtTime = (d) => {
      const dt = d ? new Date(d) : null;
      return dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-';
    };

    const receiptNum = resolveReceiptNumber(txn);
    const gross = Number(vehicle.weighBridgeData?.grossWeight || 0);
    const tare = Number(vehicle.weighBridgeData?.tareWeight || 0);
    const net = Number(vehicle.weighBridgeData?.netWeight || (gross - tare));
    const toQuintal = (kgValue) => Number(kgValue || 0) / 100;
    const grossQtl = toQuintal(gross);
    const tareQtl = toQuintal(tare);
    const netQtl = toQuintal(net);
    const operatorName = getDisplayName(ownerUser);
    const customerName = getDisplayName(txn.customer);

    const margin = 18;
    const contentX = margin;
    const contentW = W - margin * 2;

    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: cBg });
    page.drawRectangle({ x: 8, y: 8, width: W - 16, height: H - 16, borderColor: cAccent, borderWidth: 1.3, color: cBg });

    const headerH = 72;
    const headerY = H - margin - headerH;
    page.drawRectangle({ x: contentX, y: headerY, width: contentW, height: headerH, color: cPanel });
    page.drawLine({ start: { x: contentX, y: headerY + headerH - 2 }, end: { x: contentX + contentW, y: headerY + headerH - 2 }, thickness: 2, color: cAccent });

    const rightBoxW = 196;
    const rightBoxX = contentX + contentW - rightBoxW;
    page.drawRectangle({ x: rightBoxX, y: headerY, width: rightBoxW, height: headerH, color: cPanelAlt, borderColor: rgb(0.22, 0.29, 0.4), borderWidth: 0.8 });

    page.drawText(fitTextToWidth(warehouseName, contentW - rightBoxW - 28, bold, 17), {
      x: contentX + 14,
      y: headerY + 43,
      size: 17,
      font: bold,
      color: cText
    });
    page.drawText('WEIGHBRIDGE PAYMENT BILL', {
      x: contentX + 14,
      y: headerY + 28,
      size: 9,
      font: bold,
      color: cMuted
    });
    page.drawText(fitTextToWidth(`ADDRESS: ${warehouseAddr}`, contentW - rightBoxW - 28, font, 8), {
      x: contentX + 14,
      y: headerY + 14,
      size: 8,
      font,
      color: cMuted
    });

    page.drawText(fitTextToWidth(`RECEIPT: ${receiptNum}`, rightBoxW - 20, bold, 9), { x: rightBoxX + 10, y: headerY + 50, size: 9, font: bold, color: cText });
    page.drawText(`DATE: ${fmtDate(paidAt)}`, { x: rightBoxX + 10, y: headerY + 35, size: 8, font, color: cMuted });
    page.drawText(`TIME: ${fmtTime(paidAt)}`, { x: rightBoxX + 10, y: headerY + 23, size: 8, font, color: cMuted });
    page.drawText(fitTextToWidth(`HELPDESK: ${ownerPhone}`, rightBoxW - 20, font, 8), { x: rightBoxX + 10, y: headerY + 11, size: 8, font, color: cText });

    const detailsH = 120;
    const detailsY = headerY - 10 - detailsH;
    page.drawRectangle({ x: contentX, y: detailsY, width: contentW, height: detailsH, color: cPanelAlt, borderColor: rgb(0.2, 0.26, 0.35), borderWidth: 0.8 });

    const rowH = 18;
    const leftColX = contentX + 10;
    const rightColX = contentX + contentW / 2 + 6;
    const colValueOffset = 95;

    const leftRows = [
      ['Vehicle No', vehicle.vehicleNumber || 'N/A'],
      ['In Date', fmtDate(inTime)],
      ['In Time', fmtTime(inTime)],
      ['Out Date', fmtDate(outTime)],
      ['Out Time', fmtTime(outTime)],
      ['Payment', method],
    ];

    const rightRows = [
      ['Customer', customerName],
      ['Operator', operatorName],
      ['Txn ID', txn.transactionId || txn._id?.toString() || '-'],
      ['Gross (QTL)', grossQtl.toFixed(2)],
      ['Tare (QTL)', tareQtl.toFixed(2)],
      ['Net (QTL)', netQtl.toFixed(2)],
    ];

    let ry = detailsY + detailsH - 16;
    leftRows.forEach(([label, value], index) => {
      if (index % 2 === 0) {
        page.drawRectangle({ x: contentX + 4, y: ry - 12, width: contentW / 2 - 8, height: rowH, color: cPanel });
      }
      page.drawText(label, { x: leftColX, y: ry - 5, size: 8, font: bold, color: cMuted });
      page.drawText(fitTextToWidth(value, contentW / 2 - colValueOffset - 20, font, 9), { x: leftColX + colValueOffset, y: ry - 5, size: 9, font, color: cText });
      ry -= rowH;
    });

    ry = detailsY + detailsH - 16;
    rightRows.forEach(([label, value], index) => {
      if (index % 2 === 0) {
        page.drawRectangle({ x: contentX + contentW / 2 + 2, y: ry - 12, width: contentW / 2 - 6, height: rowH, color: cPanel });
      }
      page.drawText(label, { x: rightColX, y: ry - 5, size: 8, font: bold, color: cMuted });
      page.drawText(fitTextToWidth(value, contentW / 2 - colValueOffset - 24, font, 9), { x: rightColX + colValueOffset, y: ry - 5, size: 9, font, color: cText });
      ry -= rowH;
    });

    const cardsH = 64;
    const cardsY = detailsY - 12 - cardsH;
    const gap = 10;
    const cardW = (contentW - gap * 2) / 3;
    const weightCards = [
      ['GROSS', grossQtl],
      ['TARE', tareQtl],
      ['NET', netQtl],
    ];

    weightCards.forEach(([label, value], idx) => {
      const x = contentX + idx * (cardW + gap);
      page.drawRectangle({ x, y: cardsY, width: cardW, height: cardsH, color: cPanel, borderColor: cAccent, borderWidth: 0.9 });
      page.drawText(label, { x: x + 10, y: cardsY + 45, size: 10, font: bold, color: cMuted });
      page.drawText(`${Number(value).toFixed(2)} QTL`, { x: x + 10, y: cardsY + 21, size: 14, font: bold, color: cText });
      page.drawText(fitTextToWidth(`${numToWords(value)} quintals`, cardW - 20, font, 7.5), { x: x + 10, y: cardsY + 8, size: 7.5, font, color: cMuted });
    });

    const amountH = 34;
    const amountY = cardsY - 12 - amountH;
    page.drawRectangle({ x: contentX, y: amountY, width: contentW, height: amountH, color: cAccent });
    page.drawText('AMOUNT RECEIVED', { x: contentX + 12, y: amountY + 12, size: 10.5, font: bold, color: rgb(1, 1, 1) });
    page.drawText(rupee(amount), { x: contentX + contentW - 130, y: amountY + 9, size: 16, font: bold, color: rgb(1, 1, 1) });

    page.drawText(fitTextToWidth(`IN WORDS: ${numToWords(amount)} only`, contentW - 4, font, 8.2), {
      x: contentX + 2,
      y: amountY - 14,
      size: 8.2,
      font,
      color: cMuted
    });

    const signLineY = 28;
    page.drawLine({ start: { x: contentX + 6, y: signLineY }, end: { x: contentX + 180, y: signLineY }, thickness: 0.7, color: rgb(0.34, 0.41, 0.53) });
    page.drawLine({ start: { x: contentX + contentW - 180, y: signLineY }, end: { x: contentX + contentW - 6, y: signLineY }, thickness: 0.7, color: rgb(0.34, 0.41, 0.53) });
    page.drawText('Customer Signature', { x: contentX + 6, y: 16, size: 8.5, font, color: cMuted });
    page.drawText('Operator Signature', { x: contentX + contentW - 108, y: 16, size: 8.5, font, color: cMuted });

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=weighbridge_bill_${vehicle.vehicleNumber || 'receipt'}_${Date.now()}.pdf`);
    res.send(Buffer.from(pdfBytes));

  } catch (err) {
    console.error('Weighbridge bill error:', err);
    res.status(500).json({ message: 'Failed to generate bill', error: err.message });
  }
});


// @route  GET /api/payments/bill/storage/:transactionId
// @desc   Download storage rent / loan repayment payment receipt as PDF
// @access Private
router.get('/bill/storage/:transactionId', auth, async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.transactionId)
      .populate('storageAllocation')
      .populate('customer', 'username name email profile')
      .populate('processedBy', 'username name profile');

    if (!txn) return res.status(404).json({ message: 'Transaction not found' });

    // ── Fetch warehouse info from owner's layout ───────────────────────────────
    const ownerUser = txn.processedBy || await User.findOne({ role: 'owner' }).select('username name profile').lean();
    const ownerId = ownerUser?._id || txn.processedBy?._id || txn.processedBy;
    let warehouseLayout = ownerId
      ? (await DynamicWarehouseLayout.findOne({ owner: ownerId }).select('name')) ||
        (await WarehouseLayout.findOne({ owner: ownerId }).select('name'))
      : null;
    const ownerProfile  = ownerUser?.profile || {};
    const warehouseName = (warehouseLayout?.name || 'Farmers Warehouse');
    const ownerPhone    = ownerProfile.phone || '-';
    const addrParts     = [
      ownerProfile.address?.street,
      ownerProfile.address?.city,
      ownerProfile.address?.state
    ].filter(Boolean);
    const warehouseAddr = addrParts.length ? addrParts.join(', ') : 'India';

    const amount   = txn.amount?.totalAmount || txn.amount?.baseAmount || 0;
    const paidAt   = txn.payment?.paidAt || txn.createdAt || new Date();
    const method   = (txn.payment?.method || 'cash').toUpperCase();
    const custName = getDisplayName(txn.customer);
    const custPhone= txn.customer?.profile?.phone || 'N/A';
    const receiptNum = resolveReceiptNumber(txn);

    const typeLabels = {
      grain_storage_rent: 'Storage Rent',
      loan_repayment:     'Loan Repayment',
      weighbridge_fee:    'Weighbridge Fee',
      grain_release:      'Grain Release',
    };
    const txnTypeLabel = typeLabels[txn.type] || txn.type || 'Payment';

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([420, 594]);
    const W = 420;
    const H = 594;
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const cBg = rgb(0.96, 0.98, 0.97);
    const cPrimary = rgb(0.06, 0.23, 0.40);
    const cAccent = rgb(0.00, 0.54, 0.38);
    const cLine = rgb(0.83, 0.87, 0.89);
    const cText = rgb(0.16, 0.21, 0.24);
    const cMuted = rgb(0.37, 0.45, 0.49);

    const operatorName = getDisplayName(ownerUser);

    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: cBg });
    page.drawRectangle({ x: 12, y: 12, width: W - 24, height: H - 24, color: rgb(1, 1, 1), borderColor: cLine, borderWidth: 1 });

    const headerY = H - 96;
    page.drawRectangle({ x: 12, y: headerY, width: W - 24, height: 64, color: cPrimary });
    page.drawRectangle({ x: 12, y: headerY - 22, width: W - 24, height: 22, color: cAccent });

    page.drawText(fitTextToWidth(warehouseName.toUpperCase(), W - 190, bold, 14), { x: 22, y: headerY + 38, size: 14, font: bold, color: rgb(1, 1, 1) });
    page.drawText(fitTextToWidth(warehouseAddr, W - 44, font, 8), { x: 22, y: headerY + 24, size: 8, font, color: rgb(0.83, 0.89, 0.97) });
    page.drawText(fitTextToWidth(`CONTACT: ${ownerPhone}`, W - 44, font, 8), { x: 22, y: headerY - 14, size: 8, font, color: rgb(0.90, 1, 0.96) });

    page.drawRectangle({ x: W - 144, y: headerY + 8, width: 122, height: 24, color: rgb(1, 1, 1) });
    page.drawText('PAYMENT RECEIPT', { x: W - 132, y: headerY + 17, size: 8.5, font: bold, color: cAccent });

    const rows = [
      ['Receipt Number', receiptNum],
      ['Date & Time', new Date(paidAt).toLocaleString('en-IN')],
      ['Customer Name', custName],
      ['Customer Contact', custPhone],
      ['Payment For', txnTypeLabel],
      ['Payment Method', method],
      ['Transaction ID', txn.transactionId || txn._id?.toString() || '-'],
      ['Processed By', operatorName],
    ];

    if (txn.storageAllocation) {
      const alloc = txn.storageAllocation;
      rows.push(['Storage Reference', alloc.boxNumber || alloc._id?.toString().slice(-6) || 'N/A']);
      rows.push(['Grain Type', alloc.grainType || 'N/A']);
    }

    if (txn.description) {
      rows.push(['Description', txn.description]);
    }

    let y = headerY - 38;
    page.drawText('Receipt Details', { x: 22, y, size: 11.5, font: bold, color: cPrimary });
    y -= 12;
    page.drawLine({ start: { x: 22, y }, end: { x: W - 22, y }, thickness: 0.9, color: cLine });
    y -= 16;

    const rowHeight = 19;
    rows.forEach(([label, value], index) => {
      const isStripe = index % 2 === 0;
      if (isStripe) {
        page.drawRectangle({ x: 20, y: y - 6, width: W - 40, height: rowHeight, color: rgb(0.97, 0.99, 0.99) });
      }
      page.drawText(label, { x: 26, y, size: 8.4, font: bold, color: cMuted });
      page.drawText(fitTextToWidth(value, W - 176, font, 8.8), { x: 148, y, size: 8.8, font, color: cText });
      y -= rowHeight;
    });

    y -= 6;
    page.drawRectangle({ x: 20, y: y - 52, width: W - 40, height: 60, color: cPrimary });
    page.drawText('TOTAL PAID', { x: 30, y: y - 8, size: 10, font: bold, color: rgb(0.78, 0.9, 1) });
    page.drawText(rupee(amount), { x: 30, y: y - 33, size: 22, font: bold, color: rgb(1, 1, 1) });
    y -= 72;

    page.drawRectangle({ x: 20, y: y - 24, width: W - 40, height: 26, color: rgb(0.94, 0.98, 0.96), borderColor: cLine, borderWidth: 0.6 });
    page.drawText(fitTextToWidth(`In words: ${numToWords(amount)} rupees only`, W - 60, font, 8.2), { x: 26, y: y - 14, size: 8.2, font, color: rgb(0.30, 0.39, 0.36) });
    y -= 40;

    page.drawLine({ start: { x: 20, y }, end: { x: W - 20, y }, thickness: 0.7, color: cLine });
    y -= 14;
    page.drawText('Computer-generated receipt. Valid for customer and warehouse records.', {
      x: 22,
      y,
      size: 7.3,
      font,
      color: rgb(0.44, 0.50, 0.53)
    });

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=payment_receipt_${receiptNum}.pdf`);
    res.send(Buffer.from(pdfBytes));

  } catch (err) {
    console.error('Storage bill error:', err);
    res.status(500).json({ message: 'Failed to generate receipt', error: err.message });
  }
});

module.exports = router;

