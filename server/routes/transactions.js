const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Get all transactions (Owner only)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'customer') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { page = 1, limit = 100, status, customerId, startDate, endDate, type } = req.query;

    // Build filter query
    const filter = {};
    if (status) filter.status = status;
    if (customerId) filter.customer = customerId;
    if (type) filter.type = type;
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lt: new Date(endDate)
      };
    }

    const transactions = await Transaction.find(filter)
      .populate('customer', 'username email profile')
      .populate('vehicle', 'vehicleNumber type')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(filter);

    res.json({
      success: true,
      transactions,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get customer's transactions
router.get('/customer/:customerId', auth, async (req, res) => {
  try {
    const { customerId } = req.params;

    // Check permissions - Customer can only view their own transactions
    if (req.user.role === 'customer' && req.user._id.toString() !== customerId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const transactions = await Transaction.find({ customerId })
      .populate('vehicleId', 'vehicleNumber type')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      transactions
    });
  } catch (error) {
    console.error('Error fetching customer transactions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get transaction by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('customerId', 'username email profile')
      .populate('vehicleId', 'vehicleNumber type');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Check permissions
    if (req.user.role === 'customer' && req.user._id.toString() !== transaction.customerId._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      success: true,
      transaction
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new transaction
router.post('/', [
  auth,
  body('customerId').isMongoId().withMessage('Valid customer ID is required'),
  body('vehicleId').isMongoId().withMessage('Valid vehicle ID is required'),
  body('type').isIn(['entry', 'exit']).withMessage('Type must be entry or exit'),
  body('weights.gross').optional().isNumeric().withMessage('Gross weight must be a number'),
  body('weights.tare').optional().isNumeric().withMessage('Tare weight must be a number'),
  body('payment.method').isIn(['cash', 'upi', 'card']).withMessage('Invalid payment method'),
  body('payment.amount').isNumeric().withMessage('Payment amount is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const transactionData = {
      ...req.body,
      createdBy: req.user._id
    };

    // Calculate net weight if both gross and tare are provided
    if (req.body.weights?.gross && req.body.weights?.tare) {
      transactionData.weights.net = req.body.weights.gross - req.body.weights.tare;
    }

    const transaction = new Transaction(transactionData);
    await transaction.save();

    await transaction.populate([
      { path: 'customerId', select: 'username email profile' },
      { path: 'vehicleId', select: 'vehicleNumber type' }
    ]);

    // Emit real-time update
    if (req.io) {
      req.io.emit('transaction_created', {
        transaction: transaction.toObject(),
        timestamp: new Date()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      transaction
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update transaction
router.put('/:id', [
  auth,
  body('status').optional().isIn(['pending', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('weights.gross').optional().isNumeric().withMessage('Gross weight must be a number'),
  body('weights.tare').optional().isNumeric().withMessage('Tare weight must be a number'),
  body('payment.amount').optional().isNumeric().withMessage('Payment amount must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Only owner can update transactions
    if (req.user.role === 'customer') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (key === 'weights' && req.body.weights) {
        transaction.weights = { ...transaction.weights, ...req.body.weights };
        
        // Recalculate net weight if needed
        if (transaction.weights.gross && transaction.weights.tare) {
          transaction.weights.net = transaction.weights.gross - transaction.weights.tare;
        }
      } else {
        transaction[key] = req.body[key];
      }
    });

    transaction.updatedAt = new Date();
    await transaction.save();

    await transaction.populate([
      { path: 'customerId', select: 'username email profile' },
      { path: 'vehicleId', select: 'vehicleNumber type' }
    ]);

    // Emit real-time update
    if (req.io) {
      req.io.emit('transaction_updated', {
        transaction: transaction.toObject(),
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      transaction
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete transaction (Owner only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const transaction = await Transaction.findByIdAndDelete(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get transaction statistics
router.get('/stats/summary', auth, async (req, res) => {
  try {
    if (req.user.role === 'customer') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { startDate, endDate } = req.query;
    const dateFilter = {};

    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const stats = await Transaction.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalRevenue: { $sum: '$payment.amount' },
          completedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          averageAmount: { $avg: '$payment.amount' }
        }
      }
    ]);

    const paymentMethodStats = await Transaction.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$payment.method',
          count: { $sum: 1 },
          revenue: { $sum: '$payment.amount' }
        }
      }
    ]);

    const dailyStats = await Transaction.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$payment.amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      stats: {
        overview: stats[0] || {
          totalTransactions: 0,
          totalRevenue: 0,
          completedTransactions: 0,
          averageAmount: 0
        },
        paymentMethods: paymentMethodStats,
        dailyTrends: dailyStats
      }
    });
  } catch (error) {
    console.error('Error fetching transaction statistics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;