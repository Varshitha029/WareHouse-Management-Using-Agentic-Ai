const express = require('express');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Loan = require('../models/Loan');
const StorageAllocation = require('../models/StorageAllocation');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const DynamicWarehouseLayout = require('../models/DynamicWarehouseLayout');

const router = express.Router();

// @route   GET /api/loans/eligibility
// @desc    Calculate loan eligibility based on stored grain value
// @access  Private (Customer)
router.get('/eligibility', auth, async (req, res) => {
  try {
    const customerId = req.user.id;

    // Get grain locations from dynamic warehouse system
    const DynamicWarehouseLayout = require('../models/DynamicWarehouseLayout');
    const warehouses = await DynamicWarehouseLayout.find({
      'layout.blocks.slots.allocations.customer': customerId,
      isActive: true
    });

    // Get market prices for grain valuation
    const marketPrices = {
      'Wheat': 2500,
      'Rice': 3200,
      'Corn': 1800,
      'Barley': 2200,
      'Sorghum': 2000,
      'Millet': 1900
    };

    let totalGrainValue = 0;
    const grainDetails = [];

    // Calculate total grain value from all customer's allocations
    warehouses.forEach(warehouse => {
      warehouse.layout.forEach(building => {
        building.blocks.forEach(block => {
          block.slots.forEach(slot => {
            const customerAllocations = slot.allocations.filter(
              alloc => alloc.customer.toString() === customerId
            );

            customerAllocations.forEach(allocation => {
              const grainType = allocation.grainType || 'Rice';
              const weightKg = allocation.weight || 0;
              const weightQuintals = weightKg / 100;
              const pricePerQuintal = marketPrices[grainType] || 2000;
              const grainValue = weightQuintals * pricePerQuintal;

              totalGrainValue += grainValue;

              grainDetails.push({
                warehouseName: warehouse.name,
                location: slot.slotLabel,
                grainType: grainType,
                weightKg: weightKg,
                weightQuintals: weightQuintals.toFixed(2),
                pricePerQuintal: pricePerQuintal,
                value: grainValue.toFixed(2)
              });
            });
          });
        });
      });
    });

    // Maximum loan = 60% of grain value
    const maxLoanAmount = totalGrainValue * 0.60;

    // Get existing active loans
    const activeLoans = await Loan.find({
      customer: customerId,
      status: { $in: ['pending', 'approved', 'active'] }
    });

    const totalActiveLoanAmount = activeLoans.reduce((sum, loan) => {
      return sum + loan.amount;
    }, 0);

    const availableLoanAmount = Math.max(0, maxLoanAmount - totalActiveLoanAmount);

    res.json({
      totalGrainValue: totalGrainValue.toFixed(2),
      maxLoanAmount: maxLoanAmount.toFixed(2),
      totalActiveLoanAmount: totalActiveLoanAmount.toFixed(2),
      availableLoanAmount: availableLoanAmount.toFixed(2),
      grainDetails,
      loanToValueRatio: 0.60,
      eligibilityStatus: availableLoanAmount > 0 ? 'eligible' : 'not_eligible',
      message: availableLoanAmount > 0 
        ? `You can request a loan up to ₹${availableLoanAmount.toFixed(2)}`
        : 'You have reached your maximum loan limit based on stored grain value'
    });

  } catch (error) {
    console.error('Error calculating loan eligibility:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/loans/request
// @desc    Request a new loan
// @access  Private (Customer)
router.post('/request', auth, [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('duration').isInt({ min: 1, max: 120 }).withMessage('Duration must be between 1-120 months'),
  body('purpose').trim().notEmpty().withMessage('Purpose is required'),
  body('interestRate').isNumeric().withMessage('Interest rate must be a number'),
  body('collateral').trim().notEmpty().withMessage('Collateral information is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, duration, purpose, interestRate, collateral } = req.body;
    const customerId = req.user.id;

    // Check eligibility
    const allocations = await StorageAllocation.find({
      customer: customerId,
      status: 'active'
    });

    const totalGrainValue = allocations.reduce((sum, a) => sum + (a.storageDetails.totalValue || 0), 0);
    const maxLoanAmount = totalGrainValue * 0.60;

    if (parseFloat(amount) > maxLoanAmount) {
      return res.status(400).json({
        message: `Loan amount exceeds 60% of grain collateral value. Maximum allowed: ₹${maxLoanAmount.toFixed(2)}`
      });
    }

    // Create loan
    const loan = new Loan({
      customer: customerId,
      amount: parseFloat(amount),
      interestRate: parseFloat(interestRate),
      duration: parseInt(duration),
      purpose,
      collateral,
      status: 'pending',
      createdBy: customerId
    });

    await loan.save();

    // Emit real-time notification
    if (req.io) {
      req.io.emit('loan_request', {
        customerId,
        loanId: loan._id,
        amount: loan.amount,
        status: 'pending'
      });
    }

    res.status(201).json({
      message: 'Loan request submitted successfully',
      loan
    });

  } catch (error) {
    console.error('Error creating loan request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/loans/my-loans
// @desc    Get customer's loans with payment history
// @access  Private (Customer)
router.get('/my-loans', auth, async (req, res) => {
  try {
    const loans = await Loan.find({ customer: req.user.id })
      .sort({ createdAt: -1 })
      .populate('approvedBy', 'profile.firstName profile.lastName');

    const loansWithDetails = loans.map(loan => ({
      ...loan.toObject(),
      remainingBalance: loan.getRemainingBalance(),
      isOverdue: loan.isOverdue(),
      nextPaymentDate: loan.getNextPaymentDate(),
      daysOverdue: loan.getDaysOverdue(),
      paymentHistory: loan.payments.slice(-5) // Last 5 payments
    }));

    res.json({ loans: loansWithDetails });

  } catch (error) {
    console.error('Error fetching customer loans:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/loans/:id/approve
// @desc    Approve a loan (Owner only)
// @access  Private (Owner)
router.put('/:id/approve', auth, authorize('owner'), async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);

    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    if (loan.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending loans can be approved' });
    }

    loan.status = 'approved';
    loan.approvedBy = req.user.id;
    loan.approvedDate = new Date();
    loan.disbursementDate = new Date();
    loan.dueDate = new Date();
    loan.dueDate.setMonth(loan.dueDate.getMonth() + loan.duration);

    await loan.save();

    // Emit real-time notification
    if (req.io) {
      req.io.to(`customer_${loan.customer}`).emit('loan_approved', {
        loanId: loan._id,
        amount: loan.amount,
        monthlyPayment: loan.monthlyPayment
      });
    }

    res.json({
      message: 'Loan approved successfully',
      loan
    });

  } catch (error) {
    console.error('Error approving loan:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/loans/:id/payment
// @desc    Make a loan payment
// @access  Private (Customer)
router.post('/:id/payment', auth, [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('method').isIn(['cash', 'upi', 'card']).withMessage('Invalid payment method'),
  body('reference').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, method, reference, notes } = req.body;
    const loan = await Loan.findById(req.params.id);

    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    if (loan.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (loan.status !== 'active' && loan.status !== 'approved') {
      return res.status(400).json({ message: 'Loan is not active' });
    }

    // Add payment
    loan.payments.push({
      date: new Date(),
      amount: parseFloat(amount),
      type: 'principal', // Could be calculated based on interest/principal split
      method,
      reference: reference || '',
      notes: notes || ''
    });

    loan.paidAmount += parseFloat(amount);
    loan.remainingAmount = loan.totalAmount - loan.paidAmount;

    // Update status if fully paid
    if (loan.remainingAmount <= 0) {
      loan.status = 'completed';
    } else if (loan.status === 'approved') {
      loan.status = 'active';
    }

    await loan.save();

    // Create transaction record for loan repayment
    const transaction = new Transaction({
      transactionId: `LOAN-${loan._id}-${Date.now()}`,
      type: 'loan_repayment',
      customer: loan.customer,
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
        loanId: loan._id,
        notes: notes || `Loan repayment - ₹${parseFloat(amount)}`,
        remainingBalance: loan.remainingAmount
      }
    });

    await transaction.save();

    // Emit real-time notification
    if (req.io) {
      req.io.emit('payment_received', {
        type: 'loan',
        loanId: loan._id,
        amount: parseFloat(amount),
        customerId: loan.customer
      });
    }

    res.json({
      message: 'Payment recorded successfully',
      loan: {
        ...loan.toObject(),
        remainingBalance: loan.getRemainingBalance()
      }
    });

  } catch (error) {
    console.error('Error recording loan payment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/loans/pending-approvals
// @desc    Get all pending loan approvals (Owner only)
// @access  Private (Owner)
router.get('/pending-approvals', auth, authorize('owner'), async (req, res) => {
  try {
    const pendingLoans = await Loan.find({ status: 'pending' })
      .populate('customer', 'profile email')
      .sort({ createdAt: -1 });

    // Get grain value for each customer
    const loansWithGrainValue = await Promise.all(
      pendingLoans.map(async (loan) => {
        const allocations = await StorageAllocation.find({
          customer: loan.customer._id,
          status: 'active'
        });

        const totalGrainValue = allocations.reduce((sum, a) => sum + (a.storageDetails.totalValue || 0), 0);
        const maxLoanAmount = totalGrainValue * 0.60;

        return {
          ...loan.toObject(),
          grainValue: totalGrainValue,
          maxLoanAmount,
          loanToValueRatio: totalGrainValue > 0 ? (loan.amount / totalGrainValue) : 0
        };
      })
    );

    res.json({ loans: loansWithGrainValue });

  } catch (error) {
    console.error('Error fetching pending loans:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/loans/all-customer-loans
// @desc    Get all customer loans with grain details (Owner only)
// @access  Private (Owner)
router.get('/all-customer-loans', auth, authorize('owner'), async (req, res) => {
  try {
    const loans = await Loan.find({ status: { $in: ['active', 'approved', 'completed'] } })
      .populate('customer', 'profile email')
      .sort({ createdAt: -1 });

    // Load all active warehouse layouts once (avoid N+1 queries)
    const warehouses = await DynamicWarehouseLayout.find({ isActive: true });

    const marketPrices = {
      'Wheat': 2500, 'Rice': 3200, 'Corn': 1800, 'Barley': 2200,
      'Sorghum': 2000, 'Millet': 1900, 'Maize': 1800, 'Paddy': 1600,
      'Jowar': 1700, 'Bajra': 1650, 'Cotton': 6500, 'Soybean': 4200,
      'Groundnut': 5500, 'Sunflower': 5000, 'Sesame': 12000,
      'Red Gram': 6600, 'Bengal Gram': 5440, 'Tur Dal': 6600,
      'Chana': 5440
    };

    const loansWithDetails = loans.map((loan) => {
      const customerId = loan.customer._id.toString();

      let totalBags = 0;
      let totalWeightKg = 0;
      let grainTypes = {};

      // Scan all warehouse slots for this customer's allocations
      warehouses.forEach(warehouse => {
        (warehouse.layout || []).forEach(building => {
          (building.blocks || []).forEach(block => {
            (block.slots || []).forEach(slot => {
              (slot.allocations || []).forEach(alloc => {
                if (alloc.customer && alloc.customer.toString() === customerId) {
                  totalBags += alloc.bags || 0;
                  totalWeightKg += alloc.weight || 0;
                  const gt = alloc.grainType || 'Rice';
                  grainTypes[gt] = (grainTypes[gt] || 0) + (alloc.bags || 0);
                }
              });
            });
          });
        });
      });

      // Pick dominant grain type for pricing
      const dominantGrain = Object.keys(grainTypes).sort((a, b) => grainTypes[b] - grainTypes[a])[0] || 'Rice';
      const pricePerQuintal = marketPrices[dominantGrain] || 2000;
      const quintals = totalWeightKg / 100;
      const grainValue = quintals * pricePerQuintal;

      return {
        ...loan.toObject(),
        grainDetails: {
          numberOfBags: totalBags,
          bagWeight: totalBags > 0 ? totalWeightKg / totalBags : 50,
          totalWeightKg,
          quintals: parseFloat(quintals.toFixed(2)),
          grainType: dominantGrain,
          marketValue: pricePerQuintal,
          totalValue: parseFloat(grainValue.toFixed(2))
        }
      };
    });

    res.json({ loans: loansWithDetails });

  } catch (error) {
    console.error('Error fetching customer loans:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/loans/:id/reject
// @desc    Reject a loan (Owner only)
// @access  Private (Owner)
router.put('/:id/reject', auth, authorize('owner'), async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);

    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    if (loan.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending loans can be rejected' });
    }

    loan.status = 'rejected';
    loan.rejectedBy = req.user.id;
    loan.rejectedDate = new Date();
    loan.rejectionReason = req.body.reason || 'Not specified';

    await loan.save();

    // Emit real-time notification
    if (req.io) {
      req.io.to(`customer_${loan.customer}`).emit('loan_rejected', {
        loanId: loan._id,
        reason: loan.rejectionReason
      });
    }

    res.json({
      message: 'Loan rejected successfully',
      loan
    });

  } catch (error) {
    console.error('Error rejecting loan:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/loans/repayment-alerts
// @desc    Get repayment alerts for customer's active loans
// @access  Private (Customer)
router.get('/repayment-alerts', auth, async (req, res) => {
  try {
    const customerId = req.user.id;
    
    // Get all active loans for the customer
    const loans = await Loan.find({
      customer: customerId,
      status: 'active',
      remainingAmount: { $gt: 0 }
    });

    const alerts = [];
    const today = new Date();

    for (const loan of loans) {
      if (loan.dueDate) {
        const dueDate = new Date(loan.dueDate);
        const diffTime = dueDate - today;
        const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Create alerts for loans due within 14 days or overdue
        if (daysUntilDue <= 14) {
          const isOverdue = daysUntilDue < 0;
          
          // Determine if notifications were sent (based on days until due)
          const emailSent = daysUntilDue <= 7;
          const smsSent = daysUntilDue <= 3 || isOverdue;
          
          alerts.push({
            loanId: loan._id,
            dueDate: loan.dueDate,
            daysUntilDue,
            isOverdue,
            amountDue: loan.monthlyPayment || loan.remainingAmount,
            remainingAmount: loan.remainingAmount,
            monthlyPayment: loan.monthlyPayment,
            emailSent,
            smsSent,
            loanAmount: loan.amount,
            interestRate: loan.interestRate
          });
        }
      }
    }

    // Sort alerts by urgency (overdue first, then closest due date)
    alerts.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return a.daysUntilDue - b.daysUntilDue;
    });

    res.json({
      success: true,
      alerts,
      count: alerts.length
    });

  } catch (error) {
    console.error('Error fetching repayment alerts:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching repayment alerts', 
      error: error.message 
    });
  }
});

module.exports = router;

