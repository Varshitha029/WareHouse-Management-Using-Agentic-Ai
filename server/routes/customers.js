const express = require('express');
const User = require('../models/User');
const StorageAllocation = require('../models/StorageAllocation');
const Transaction = require('../models/Transaction');
const Loan = require('../models/Loan');
const Vehicle = require('../models/Vehicle');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');

const router = express.Router();

const getOwnerCustomerIds = async (ownerId) => {
  const [allocationCustomers, vehicleCustomers, loanCustomers] = await Promise.all([
    StorageAllocation.distinct('customer', { owner: ownerId }),
    Vehicle.distinct('customer', { owner: ownerId, customer: { $ne: null } }),
    Loan.distinct('customer', { createdBy: ownerId })
  ]);

  return [...new Set([
    ...allocationCustomers.map(String),
    ...vehicleCustomers.map(String),
    ...loanCustomers.map(String)
  ])];
};

// @route   GET /api/customers
// @desc    Get all customers
// @access  Private (Owner only)
router.get('/', [auth, authorize('owner')], async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const ownerCustomerIds = await getOwnerCustomerIds(req.user.id);
    
    let query = { role: 'customer', isActive: true };

    query._id = { $in: ownerCustomerIds };
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } },
        { 'profile.phone': { $regex: search, $options: 'i' } }
      ];
    }

    const customers = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    // Get additional stats for each customer
    const customersWithStats = await Promise.all(
      customers.map(async (customer) => {
        const allocations = await StorageAllocation.find({ customer: customer._id, owner: req.user.id });
        const ownerVehicleIds = await Vehicle.distinct('_id', { owner: req.user.id });
        const ownerAllocationIds = await StorageAllocation.distinct('_id', { owner: req.user.id });
        const transactions = await Transaction.find({
          customer: customer._id,
          $or: [
            { processedBy: req.user.id },
            { vehicle: { $in: ownerVehicleIds } },
            { storageAllocation: { $in: ownerAllocationIds } }
          ]
        });
        
        const totalSpent = transactions.reduce((sum, t) => sum + (t.amount.totalAmount || 0), 0);
        const activeAllocations = allocations.filter(a => a.status === 'active').length;
        const pendingPayments = transactions
          .filter(t => t.payment.status === 'pending')
          .reduce((sum, t) => sum + (t.amount.totalAmount || 0), 0);

        return {
          ...customer.toJSON(),
          stats: {
            totalSpent,
            activeAllocations,
            pendingPayments,
            totalTransactions: transactions.length
          }
        };
      })
    );

    res.json({
      customers: customersWithStats,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/customers/:id
// @desc    Get customer details
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    if (req.user.role === 'owner') {
      const ownerCustomerIds = await getOwnerCustomerIds(req.user.id);
      if (!ownerCustomerIds.includes(req.params.id)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const customer = await User.findById(req.params.id).select('-password');
    
    if (!customer || customer.role !== 'customer') {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Get customer allocations and transactions
    const allocations = await StorageAllocation.find({
      customer: req.params.id,
      ...(req.user.role === 'owner' ? { owner: req.user.id } : {})
    })
      .populate('warehouse', 'name')
      .populate('owner', 'username profile')
      .sort({ createdAt: -1 });

    const ownerVehicleIds = req.user.role === 'owner'
      ? await Vehicle.distinct('_id', { owner: req.user.id })
      : [];
    const ownerAllocationIds = req.user.role === 'owner'
      ? await StorageAllocation.distinct('_id', { owner: req.user.id })
      : [];

    const transactions = await Transaction.find({
      customer: req.params.id,
      ...(req.user.role === 'owner'
        ? {
            $or: [
              { processedBy: req.user.id },
              { vehicle: { $in: ownerVehicleIds } },
              { storageAllocation: { $in: ownerAllocationIds } }
            ]
          }
        : {})
    })
      .populate('vehicle', 'vehicleNumber')
      .sort({ createdAt: -1 });

    const stats = {
      totalSpent: transactions.reduce((sum, t) => sum + (t.amount.totalAmount || 0), 0),
      activeAllocations: allocations.filter(a => a.status === 'active').length,
      pendingPayments: transactions
        .filter(t => t.payment.status === 'pending')
        .reduce((sum, t) => sum + (t.amount.totalAmount || 0), 0),
      totalTransactions: transactions.length,
      totalAllocations: allocations.length
    };

    res.json({
      customer,
      allocations,
      transactions,
      stats
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/customers/stats/dashboard
// @desc    Get customer dashboard statistics
// @access  Private (Customer only)
router.get('/stats/dashboard', [auth, authorize('customer')], async (req, res) => {
  try {
    const customerId = req.user.id;

    // Get active allocations
    const activeAllocations = await StorageAllocation.find({
      customer: customerId,
      status: 'active'
    }).populate('warehouse', 'name');

    // Get all transactions
    const transactions = await Transaction.find({ customer: customerId });

    // Get pending payments
    const pendingPayments = transactions
      .filter(t => t.payment.status === 'pending')
      .reduce((sum, t) => sum + (t.amount.totalAmount || 0), 0);

    // Get total spent
    const totalSpent = transactions
      .filter(t => t.payment.status === 'completed')
      .reduce((sum, t) => sum + (t.amount.totalAmount || 0), 0);

    // Get vehicles (assuming customer has vehicles)
    const totalVehicles = await Transaction.find({
      customer: customerId,
      type: 'weigh_bridge'
    }).distinct('vehicle').then(vehicles => vehicles.length);

    // Expiring allocations (within 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expiringAllocations = activeAllocations.filter(allocation => {
      const expiryDate = allocation.duration.extendedDate || allocation.duration.endDate;
      return expiryDate && expiryDate <= sevenDaysFromNow;
    });

    const stats = {
      activeStorage: activeAllocations.length,
      totalSpent,
      totalVehicles,
      pendingPayments,
      expiringAllocations: expiringAllocations.length,
      allocations: activeAllocations.map(allocation => ({
        id: allocation._id,
        warehouse: allocation.warehouse.name,
        location: `Building ${allocation.allocation.building}, Block ${allocation.allocation.block}, ${allocation.allocation.wing} wing, Box ${allocation.allocation.box}`,
        expiryDate: allocation.duration.extendedDate || allocation.duration.endDate,
        remainingDays: allocation.getRemainingDays(),
        isExpired: allocation.isExpired()
      }))
    };

    res.json(stats);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/customers/:id/loans
// @desc    Create a new loan for customer
// @access  Private (Owner only)
router.post('/:id/loans', [auth, authorize('owner')], async (req, res) => {
  try {
    const { amount, interestRate, duration, purpose, collateral } = req.body;

    // Validate customer exists
    const customer = await User.findById(req.params.id);
    if (!customer || customer.role !== 'customer') {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const loan = new Loan({
      customer: req.params.id,
      amount,
      interestRate,
      duration,
      purpose,
      collateral,
      createdBy: req.user.id
    });

    await loan.save();
    await loan.populate('customer', 'username email profile');

    res.status(201).json({
      message: 'Loan created successfully',
      loan
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/customers/:id/loans
// @desc    Get all loans for a customer
// @access  Private (Owner, Customer - own loans)
router.get('/:id/loans', auth, async (req, res) => {
  try {
    // Check authorization
    if (req.user.role !== 'owner' && req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const loans = await Loan.find({
      customer: req.params.id,
      ...(req.user.role === 'owner' ? { createdBy: req.user.id } : {})
    })
      .populate('customer', 'username email profile')
      .populate('createdBy', 'username')
      .populate('approvedBy', 'username')
      .sort({ createdAt: -1 });

    res.json(loans);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/customers/:id/loans/:loanId/approve
// @desc    Approve a loan
// @access  Private (Owner only)
router.put('/:id/loans/:loanId/approve', [auth, authorize('owner')], async (req, res) => {
  try {
    const loan = await Loan.findOne({ 
      _id: req.params.loanId, 
      customer: req.params.id,
      createdBy: req.user.id
    });

    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    if (loan.status !== 'pending') {
      return res.status(400).json({ message: 'Loan is not pending approval' });
    }

    loan.status = 'approved';
    loan.approvedBy = req.user.id;
    loan.approvedDate = new Date();
    loan.disbursementDate = new Date();
    
    // Calculate due date (last payment date)
    const dueDate = new Date(loan.disbursementDate);
    dueDate.setMonth(dueDate.getMonth() + loan.duration);
    loan.dueDate = dueDate;

    await loan.save();
    await loan.populate(['customer', 'createdBy', 'approvedBy']);

    res.json({
      message: 'Loan approved successfully',
      loan
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/customers/:id/loans/:loanId/payments
// @desc    Record a loan payment
// @access  Private (Owner only)
router.post('/:id/loans/:loanId/payments', [auth, authorize('owner')], async (req, res) => {
  try {
    const { amount, type = 'principal', method = 'cash', reference, notes } = req.body;

    const loan = await Loan.findOne({ 
      _id: req.params.loanId, 
      customer: req.params.id 
    });

    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    if (loan.status !== 'approved' && loan.status !== 'active') {
      return res.status(400).json({ message: 'Cannot record payment for this loan status' });
    }

    // Add payment to loan
    loan.payments.push({
      amount,
      type,
      method,
      reference,
      notes
    });

    // Update paid amount and remaining amount
    loan.paidAmount += amount;
    loan.remainingAmount = loan.totalAmount - loan.paidAmount;

    // Update status if fully paid
    if (loan.remainingAmount <= 0) {
      loan.status = 'completed';
    } else if (loan.status === 'approved') {
      loan.status = 'active';
    }

    await loan.save();
    await loan.populate(['customer', 'createdBy', 'approvedBy']);

    // Create transaction record
    const transaction = new Transaction({
      customer: req.params.id,
      type: 'loan_payment',
      description: `Loan payment - ${loan.purpose}`,
      amount: {
        totalAmount: amount
      },
      payment: {
        method,
        status: 'completed',
        reference
      },
      createdBy: req.user.id
    });

    await transaction.save();

    res.json({
      message: 'Payment recorded successfully',
      loan,
      transaction
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/customers/:id/loans/summary
// @desc    Get loan summary for customer
// @access  Private (Owner, Customer - own summary)
router.get('/:id/loans/summary', auth, async (req, res) => {
  try {
    // Check authorization
    if (req.user.role !== 'owner' && req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const summary = await Loan.getCustomerSummary(req.params.id);
    res.json(summary);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;