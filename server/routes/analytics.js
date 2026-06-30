const express = require('express');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const StorageAllocation = require('../models/StorageAllocation');
const Loan = require('../models/Loan');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const mongoose = require('mongoose');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
let sendAlertSMS, sendBulkSMS;
try {
  ({ sendAlertSMS, sendBulkSMS } = require('../utils/smsService'));
} catch(e) {
  sendAlertSMS = () => {};
  sendBulkSMS = () => {};
}

const router = express.Router();

const getOwnerScope = async (ownerId) => {
  const [vehicleIds, allocationIds, allocCustomers, vehicleCustomers, loanCustomers] = await Promise.all([
    Vehicle.distinct('_id', {
      $or: [
        { owner: ownerId },
        { owner: { $exists: false }, entryBy: ownerId }
      ]
    }),
    StorageAllocation.distinct('_id', { owner: ownerId }),
    StorageAllocation.distinct('customer', { owner: ownerId }),
    Vehicle.distinct('customer', {
      customer: { $ne: null },
      $or: [
        { owner: ownerId },
        { owner: { $exists: false }, entryBy: ownerId }
      ]
    }),
    Loan.distinct('customer', { createdBy: ownerId })
  ]);

  const customerIds = [...new Set([
    ...allocCustomers.map(String),
    ...vehicleCustomers.map(String),
    ...loanCustomers.map(String)
  ])].map(id => new mongoose.Types.ObjectId(id));

  return { ownerId, vehicleIds, allocationIds, customerIds };
};

const getOwnerTransactionMatch = (scope) => ({
  $or: [
    { processedBy: scope.ownerId },
    { vehicle: { $in: scope.vehicleIds } },
    { storageAllocation: { $in: scope.allocationIds } }
  ]
});

// @route   GET /api/analytics/owner/dashboard
// @desc    Get comprehensive analytics for owner dashboard
// @access  Private (Owner only)
router.get('/owner/dashboard', auth, authorize('owner'), async (req, res) => {
  try {
    const scope = await getOwnerScope(req.user.id);
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);

    // Revenue breakdown
    const transactions = await Transaction.find({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      ...getOwnerTransactionMatch(scope)
    });

    const rentRevenue = transactions
      .filter(t => t.type === 'grain_storage_rent')
      .reduce((sum, t) => sum + (t.amount.totalAmount || 0), 0);

    const loanInterest = await Loan.aggregate([
      { $match: { status: { $in: ['active', 'completed'] }, createdBy: new mongoose.Types.ObjectId(req.user.id) } },
      { $group: { _id: null, total: { $sum: '$totalInterest' } } }
    ]);

    const vehicleCharges = transactions
      .filter(t => t.type === 'weighbridge_fee')
      .reduce((sum, t) => sum + (t.amount.totalAmount || 0), 0);

    const otherCharges = transactions
      .filter(t => ['loading', 'unloading', 'penalty'].includes(t.type))
      .reduce((sum, t) => sum + (t.amount.totalAmount || 0), 0);

    // Monthly revenue trend (last 6 months)
    const monthlyRevenue = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) },
          ...getOwnerTransactionMatch(scope)
        }
      },
      {
        $group: {
          _id: { 
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$amount.totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Customer analytics
    const totalCustomers = await User.countDocuments({ role: 'customer', _id: { $in: scope.customerIds } });
    const activeCustomers = await StorageAllocation.distinct('customer', { status: 'active', owner: req.user.id });
    
    const customerLifetimeValue = await Transaction.aggregate([
      { $match: { customer: { $in: scope.customerIds }, ...getOwnerTransactionMatch(scope) } },
      { $group: { _id: '$customer', totalSpent: { $sum: '$amount.totalAmount' } } },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 }
    ]);

    // Populate customer names
    const topCustomers = await Promise.all(
      customerLifetimeValue.map(async (c) => {
        const customer = await User.findById(c._id).select('profile.firstName profile.lastName');
        return {
          name: customer ? `${customer?.profile?.firstName || ''} ${customer?.profile?.lastName || ''}`.trim() : 'Unknown Customer',
          totalSpent: c.totalSpent,
          customerId: c._id
        };
      })
    );

    // Loan portfolio
    const loans = await Loan.find({ createdBy: req.user.id });
    const activeLoanAmount = loans
      .filter(l => l.status === 'active')
      .reduce((sum, l) => sum + l.remainingAmount, 0);
    
    const pendingApprovals = loans.filter(l => l.status === 'pending').length;
    const defaultedLoans = loans.filter(l => l.status === 'defaulted').length;
    const interestEarned = loanInterest[0]?.total || 0;
    
    const healthyLoans = loans.filter(l => l.status === 'active' && !l.isOverdue()).length;
    const atRiskLoans = loans.filter(l => l.status === 'active' && l.isOverdue()).length;

    // Grain inventory
    const allocations = await StorageAllocation.find({ status: 'active', owner: req.user.id }).populate('customer', 'profile');
    
    const grainInventory = {};
    let totalGrainValue = 0;
    let totalDays = 0;
    let allocationCount = 0;
    const expiringGrains = [];

    allocations.forEach(allocation => {
      allocation.storageDetails.items.forEach(item => {
        const grainType = item.description;
        if (!grainInventory[grainType]) {
          grainInventory[grainType] = { quantity: 0, weight: 0, customers: new Set() };
        }
        grainInventory[grainType].quantity += item.quantity || 0;
        grainInventory[grainType].weight += item.weight || 0;
        grainInventory[grainType].customers.add(allocation.customer._id.toString());
      });

      totalGrainValue += allocation.storageDetails.totalValue || 0;
      const days = allocation.getDaysStored();
      totalDays += days;
      allocationCount++;

      // Check expiring grains
      const remainingDays = allocation.getRemainingDays();
      if (remainingDays !== null && remainingDays <= 7 && remainingDays >= 0) {
        expiringGrains.push({
          customer: `${allocation.customer.profile?.firstName || ''} ${allocation.customer.profile?.lastName || ''}`,
          grainType: allocation.storageDetails.items.map(i => i.description).join(', '),
          daysRemaining: remainingDays
        });
      }
    });

    // Convert Set to count for customers
    Object.keys(grainInventory).forEach(grain => {
      grainInventory[grain].customers = grainInventory[grain].customers.size;
    });

    const averageStorageDuration = allocationCount > 0 ? Math.round(totalDays / allocationCount) : 0;

    // ── Format monthlyTrends for charts (month name + revenue/expenses/profit) ──
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthlyTrends = monthlyRevenue.map(item => {
      const rev = item.revenue || 0;
      // Fixed operating expenses estimate (no expense model exists yet)
      const exp = Math.round(rev * 0.12);
      return {
        month: MONTH_NAMES[(item._id.month || 1) - 1] + ' ' + item._id.year,
        revenue: rev,
        expenses: exp,
        profit: rev - exp
      };
    });

    // ── Grain inventory summary for summary cards ──────────────────────────────
    const totalBags = Object.values(grainInventory).reduce((s, g) => s + (g.quantity || 0), 0);
    const WAREHOUSE_CAPACITY_BAGS = 10000; // configurable
    const inventoryUtilization = WAREHOUSE_CAPACITY_BAGS > 0
      ? Math.min(100, Math.round((totalBags / WAREHOUSE_CAPACITY_BAGS) * 100))
      : 0;

    // ── Active loans count ─────────────────────────────────────────────────────
    const activeLoansCount = loans.filter(l => l.status === 'active').length;

    res.json({
      revenue: {
        // Fields the CombinedAnalytics component reads directly:
        total: rentRevenue + interestEarned + vehicleCharges + otherCharges,
        storage:    rentRevenue,
        weighbridge: vehicleCharges,
        loans:      interestEarned,
        other:      otherCharges,
        growth:     0,        // future: compare to prior period
        // Legacy fields kept for backward compatibility:
        rentCollected: rentRevenue,
        loanInterest:  interestEarned,
        vehicleCharges,
        otherCharges
      },
      monthlyTrends,          // ← CombinedAnalytics reads this for all 3 charts
      monthlyRevenue,         // kept for legacy consumers
      customers: {
        total: totalCustomers,
        active: activeCustomers.length,
        topCustomers
      },
      loans: {
        active: activeLoansCount,             // ← summary card reads this
        totalAmount: activeLoanAmount,         // ← summary card reads this
        totalIssued: loans.length,
        activeLoanAmount,
        pendingApprovals,
        defaultedLoans,
        interestEarned,
        riskMetrics: { healthyLoans, atRiskLoans }
      },
      inventory: {
        total:       totalBags,               // ← summary card reads this
        utilization: inventoryUtilization,    // ← summary card reads this
        grainTypes:  Object.keys(grainInventory).length,
        totalValue:  totalGrainValue
      },
      grainInventory,
      totalGrainValue,
      averageStorageDuration,
      expiringGrains
    });

  } catch (error) {
    console.error('Error fetching owner analytics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/analytics/owner/capacity
// @desc    Get warehouse capacity analytics
// @access  Private (Owner only)
router.get('/owner/capacity', auth, authorize('owner'), async (req, res) => {
  try {
    const allocations = await StorageAllocation.find({ status: 'active', owner: req.user.id });
    
    // Calculate total boxes based on warehouse layouts
    // Assuming standard configuration: buildings × blocks × wings × boxes
    const totalBoxes = 2 * 3 * 2 * 6; // 72 boxes (configurable)
    const occupiedBoxes = allocations.length;
    const availableBoxes = totalBoxes - occupiedBoxes;
    const occupancyRate = ((occupiedBoxes / totalBoxes) * 100).toFixed(2);

    // Breakdown by building
    const warehouseMap = {};
    allocations.forEach(allocation => {
      const building = `building${allocation.allocation.building}`;
      if (!warehouseMap[building]) {
        warehouseMap[building] = { occupied: 0, total: 36 }; // 3×2×6 per building
      }
      warehouseMap[building].occupied++;
    });

    res.json({
      totalBoxes,
      occupiedBoxes,
      availableBoxes,
      occupancyRate: parseFloat(occupancyRate),
      warehouseMap
    });

  } catch (error) {
    console.error('Error fetching capacity analytics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/analytics/owner/financial-summary
// @desc    Get financial summary with expenses
// @access  Private (Owner only)
router.get('/owner/financial-summary', auth, authorize('owner'), async (req, res) => {
  try {
    const scope = await getOwnerScope(req.user.id);
    const { period = 'month' } = req.query;
    
    let startDate;
    const endDate = new Date();

    switch(period) {
      case 'day':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(endDate.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    }

    const transactions = await Transaction.find({
      createdAt: { $gte: startDate, $lte: endDate },
      ...getOwnerTransactionMatch(scope)
    });

    const income = {
      rentCollected: transactions
        .filter(t => t.type === 'grain_storage_rent')
        .reduce((sum, t) => sum + (t.amount.totalAmount || 0), 0),
      loanInterest: 0, // Would need separate tracking
      vehicleCharges: transactions
        .filter(t => t.type === 'weighbridge_fee')
        .reduce((sum, t) => sum + (t.amount.totalAmount || 0), 0),
      otherCharges: transactions
        .filter(t => ['loading', 'unloading', 'penalty'].includes(t.type))
        .reduce((sum, t) => sum + (t.amount.totalAmount || 0), 0)
    };

    income.total = income.rentCollected + income.loanInterest + income.vehicleCharges + income.otherCharges;

    // Expenses (mock data - would need expense tracking system)
    const expenses = {
      maintenance: 10000,
      utilities: 8000,
      total: 18000
    };

    const netProfit = income.total - expenses.total;
    const profitMargin = income.total > 0 ? ((netProfit / income.total) * 100).toFixed(2) : 0;

    // ── Monthly trends for financial charts (last 6 months) ──────────────────
    const MONTH_NAMES_FIN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyAgg = await Transaction.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, ...getOwnerTransactionMatch(scope) } },
      { $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$amount.totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    const monthlyTrends = monthlyAgg.map(item => {
      const rev = item.revenue || 0;
      const exp = Math.round(rev * 0.12);
      return {
        month: MONTH_NAMES_FIN[(item._id.month || 1) - 1] + ' ' + item._id.year,
        revenue: rev,
        expenses: exp,
        profit: rev - exp
      };
    });

    // ── Breakdown arrays for pie charts ───────────────────────────────────────
    const incomeBreakdown = [
      { name: 'Storage Rent',    value: income.rentCollected    || 0 },
      { name: 'Loan Interest',   value: income.loanInterest     || 0 },
      { name: 'Vehicle Charges', value: income.vehicleCharges   || 0 },
      { name: 'Other',           value: income.otherCharges     || 0 }
    ].filter(d => d.value > 0);

    const expenseBreakdown = [
      { name: 'Maintenance', value: expenses.maintenance || 0 },
      { name: 'Utilities',   value: expenses.utilities   || 0 }
    ].filter(d => d.value > 0);

    res.json({
      period,
      income: { ...income, growth: 0 },
      expenses: { ...expenses, growth: 0 },
      netProfit,
      profitMargin: parseFloat(profitMargin),
      monthlyTrends,
      incomeBreakdown,
      expenseBreakdown
    });

  } catch (error) {
    console.error('Error fetching financial summary:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/analytics/owner/alerts
// @desc    Get priority-based alerts
// @access  Private (Owner only)
router.get('/owner/alerts', auth, authorize('owner'), async (req, res) => {
  try {
    const scope = await getOwnerScope(req.user.id);
    const alerts = {
      critical: [],
      warnings: [],
      info: []
    };

    // Check overdue loans
    const overdueLoans = await Loan.find({ status: 'active', createdBy: req.user.id }).populate('customer', 'profile');
    overdueLoans.forEach(loan => {
      if (loan.isOverdue()) {
        const daysOverdue = loan.getDaysOverdue();
        if (daysOverdue > 30) {
          alerts.critical.push({
            _id: `loan-overdue-${loan._id}`,
            priority: 'critical',
            category: 'Loan',
            message: `Loan payment overdue by ${daysOverdue} days - ${loan.customer.profile?.firstName} ${loan.customer.profile?.lastName}`,
            timestamp: new Date(),
            read: false
          });
        }
      }
    });

    // Check unpaid rent
    const unpaidRent = await StorageAllocation.find({ 
      paymentStatus: { $in: ['pending', 'overdue'] },
      owner: req.user.id
    }).populate('customer', 'profile');

    unpaidRent.forEach(allocation => {
      if (allocation.paymentStatus === 'overdue') {
        alerts.critical.push({
          _id: `rent-overdue-${allocation._id}`,
          priority: 'critical',
          category: 'Storage',
          message: `Storage rent unpaid - ${allocation.customer.profile?.firstName} ${allocation.customer.profile?.lastName}`,
          timestamp: new Date(),
          read: false
        });
      }
    });

    // Check warehouse capacity
    const allocations = await StorageAllocation.countDocuments({ status: 'active', owner: req.user.id });
    const totalBoxes = 72; // Configurable
    const occupancyRate = (allocations / totalBoxes) * 100;

    if (occupancyRate >= 90) {
      alerts.warnings.push({
        _id: `capacity-warning-${Date.now()}`,
        priority: 'warning',
        category: 'Capacity',
        message: `Warehouse capacity at ${occupancyRate.toFixed(0)}%`,
        timestamp: new Date(),
        read: false
      });
    }

    // Check expiring grains
    const allAllocations = await StorageAllocation.find({ status: 'active', owner: req.user.id }).populate('customer', 'profile');
    allAllocations.forEach(allocation => {
      const remainingDays = allocation.getRemainingDays();
      if (remainingDays !== null && remainingDays <= 3 && remainingDays >= 0) {
        alerts.warnings.push({
          _id: `expiry-warning-${allocation._id}`,
          priority: 'warning',
          category: 'Grain Expiry',
          message: `Grain expiry in ${remainingDays} days - ${allocation.customer.profile?.firstName} ${allocation.customer.profile?.lastName}`,
          timestamp: new Date(),
          read: false
        });
      }
    });

    // Check pending loan approvals
    const pendingLoans = await Loan.countDocuments({ status: 'pending', createdBy: req.user.id });
    if (pendingLoans > 0) {
      alerts.warnings.push({
        _id: `pending-loans-${Date.now()}`,
        priority: 'warning',
        category: 'Loan Approval',
        message: `Loan approval pending - ${pendingLoans} requests`,
        timestamp: new Date(),
        read: false
      });
    }

    // Recent activities
    const recentCustomers = await User.find({ 
      role: 'customer',
      _id: { $in: scope.customerIds },
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    if (recentCustomers.length > 0) {
      alerts.info.push({
        _id: `new-customers-${Date.now()}`,
        priority: 'info',
        category: 'New Registration',
        message: `${recentCustomers.length} new customer registration(s)`,
        timestamp: new Date(),
        read: false
      });
    }

    const recentPayments = await Transaction.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      'payment.status': 'completed',
      ...getOwnerTransactionMatch(scope)
    });

    if (recentPayments.length > 0) {
      alerts.info.push({
        _id: `recent-payments-${Date.now()}`,
        priority: 'info',
        category: 'Payments',
        message: `${recentPayments.length} payment(s) received today`,
        timestamp: new Date(),
        read: false
      });
    }

    res.json(alerts);

  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/analytics/owner/loan-portfolio
// @desc    Get loan portfolio analytics
// @access  Private (Owner only)
router.get('/owner/loan-portfolio', auth, authorize('owner'), async (req, res) => {
  try {
    const loans = await Loan.find({ createdBy: req.user.id });
    
    const totalIssued = loans.length;
    const activeLoans = loans.filter(l => l.status === 'active').length;
    const completedLoans = loans.filter(l => l.status === 'completed').length;
    const defaultedLoans = loans.filter(l => l.status === 'defaulted').length;
    
    const totalAmount = loans.reduce((sum, l) => sum + l.amount, 0);
    const activeAmount = loans
      .filter(l => l.status === 'active')
      .reduce((sum, l) => sum + l.remainingAmount, 0);
    
    const interestEarned = loans.reduce((sum, l) => sum + (l.totalInterest || 0), 0);
    
    // Calculate loan-to-value ratio
    const activeLoansWithValue = await Promise.all(
      loans.filter(l => l.status === 'active').map(async (loan) => {
        const allocations = await StorageAllocation.find({
          customer: loan.customer,
          status: 'active',
          owner: req.user.id
        });
        const grainValue = allocations.reduce((sum, a) => sum + (a.storageDetails.totalValue || 0), 0);
        return { loanAmount: loan.amount, grainValue };
      })
    );
    
    const avgLoanToValue = activeLoansWithValue.length > 0
      ? activeLoansWithValue.reduce((sum, l) => sum + (l.grainValue > 0 ? l.loanAmount / l.grainValue : 0), 0) / activeLoansWithValue.length
      : 0;
    
    // Check for at-risk loans (overdue)
    const atRiskLoans = loans.filter(l => {
      if (l.status !== 'active') return false;
      try {
        return l.isOverdue && l.isOverdue();
      } catch {
        // If isOverdue method doesn't exist, check dueDate manually
        return l.dueDate && new Date(l.dueDate) < new Date();
      }
    }).length;
    
    const healthyLoans = activeLoans - atRiskLoans;

    res.json({
      totalIssued,
      activeLoans,
      completedLoans,
      defaultedLoans,
      totalAmount,
      activeAmount,
      interestEarned,
      loanToValueRatio: avgLoanToValue,
      atRiskLoans,
      healthyLoans
    });

  } catch (error) {
    console.error('Error fetching loan portfolio:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/analytics/owner/send-alert-sms
// @desc    Send SMS alert to customer(s)
// @access  Private (Owner only)
router.post('/owner/send-alert-sms', auth, authorize('owner'), async (req, res) => {
  try {
    const scope = await getOwnerScope(req.user.id);
    const { customerId, customerIds, alertType, message } = req.body;

    // Validate required fields
    if (!message) {
      return res.status(400).json({ message: 'Alert message is required' });
    }

    if (!alertType || !['critical', 'warning', 'info'].includes(alertType)) {
      return res.status(400).json({ message: 'Valid alert type is required (critical/warning/info)' });
    }

    let results = {
      total: 0,
      successful: 0,
      failed: 0,
      details: []
    };

    // Send to single customer
    if (customerId) {
      if (!scope.customerIds.map(String).includes(String(customerId))) {
        return res.status(403).json({ message: 'Access denied' });
      }
      const customer = await User.findById(customerId);
      
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      if (!customer.profile?.phone) {
        return res.status(400).json({ message: 'Customer phone number not available' });
      }

      const result = await sendAlertSMS(customer, alertType, message);
      
      results.total = 1;
      results.successful = result.success ? 1 : 0;
      results.failed = result.success ? 0 : 1;
      results.details.push({
        customerId: customer._id,
        customerName: `${customer.profile?.firstName} ${customer.profile?.lastName}`,
        phone: customer.profile?.phone,
        success: result.success,
        message: result.message
      });
    }
    // Send to multiple customers
    else if (customerIds && Array.isArray(customerIds) && customerIds.length > 0) {
      const allowedIds = customerIds.filter(id => scope.customerIds.map(String).includes(String(id)));
      const customers = await User.find({ _id: { $in: allowedIds } });
      
      if (customers.length === 0) {
        return res.status(404).json({ message: 'No customers found' });
      }

      results.total = customers.length;

      for (const customer of customers) {
        if (!customer.profile?.phone) {
          results.failed++;
          results.details.push({
            customerId: customer._id,
            customerName: `${customer.profile?.firstName} ${customer.profile?.lastName}`,
            phone: 'N/A',
            success: false,
            message: 'Phone number not available'
          });
          continue;
        }

        try {
          const result = await sendAlertSMS(customer, alertType, message);
          
          if (result.success) {
            results.successful++;
          } else {
            results.failed++;
          }

          results.details.push({
            customerId: customer._id,
            customerName: `${customer.profile?.firstName} ${customer.profile?.lastName}`,
            phone: customer.profile?.phone,
            success: result.success,
            message: result.message
          });
        } catch (error) {
          results.failed++;
          results.details.push({
            customerId: customer._id,
            customerName: `${customer.profile?.firstName} ${customer.profile?.lastName}`,
            phone: customer.profile?.phone,
            success: false,
            message: error.message
          });
        }
      }
    }
    // Send to all customers
    else {
      const allCustomers = await User.find({ 
        role: 'customer',
        _id: { $in: scope.customerIds },
        isActive: true 
      });

      if (allCustomers.length === 0) {
        return res.status(404).json({ message: 'No active customers found' });
      }

      results.total = allCustomers.length;

      for (const customer of allCustomers) {
        if (!customer.profile?.phone) {
          results.failed++;
          results.details.push({
            customerId: customer._id,
            customerName: `${customer.profile?.firstName} ${customer.profile?.lastName}`,
            phone: 'N/A',
            success: false,
            message: 'Phone number not available'
          });
          continue;
        }

        try {
          const result = await sendAlertSMS(customer, alertType, message);
          
          if (result.success) {
            results.successful++;
          } else {
            results.failed++;
          }

          results.details.push({
            customerId: customer._id,
            customerName: `${customer.profile?.firstName} ${customer.profile?.lastName}`,
            phone: customer.profile?.phone,
            success: result.success,
            message: result.message
          });
        } catch (error) {
          results.failed++;
          results.details.push({
            customerId: customer._id,
            customerName: `${customer.profile?.firstName} ${customer.profile?.lastName}`,
            phone: customer.profile?.phone,
            success: false,
            message: error.message
          });
        }
      }
    }

    res.json({
      message: `SMS sent to ${results.successful} of ${results.total} customer(s)`,
      results
    });

  } catch (error) {
    console.error('Error sending alert SMS:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/analytics/owner/customers-list
// @desc    Get list of all customers with contact info (for SMS sending)
// @access  Private (Owner only)
router.get('/owner/customers-list', auth, authorize('owner'), async (req, res) => {
  try {
    const scope = await getOwnerScope(req.user.id);
    const customers = await User.find({ 
      role: 'customer',
      _id: { $in: scope.customerIds },
      isActive: true 
    }).select('_id username email profile');

    const customerList = customers.map(customer => ({
      id: customer._id,
      username: customer.username,
      email: customer.email,
      name: `${customer.profile?.firstName || ''} ${customer.profile?.lastName || ''}`.trim(),
      phone: customer.profile?.phone || 'N/A',
      hasPhone: !!customer.profile?.phone
    }));

    res.json({
      total: customerList.length,
      customers: customerList
    });

  } catch (error) {
    console.error('Error fetching customers list:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/analytics/owner/grain-analytics
// @desc    Get grain-based analytics (current grains in warehouse)
// @access  Private (Owner only)
router.get('/owner/grain-analytics', auth, authorize('owner'), async (req, res) => {
  try {
    const allocations = await StorageAllocation.find({ status: 'active', owner: req.user.id }).populate('customer', 'profile');
    
    const grainData = {};
    const blockGrainMapping = {};
    
    allocations.forEach(allocation => {
      allocation.storageDetails.items.forEach(item => {
        const grainType = item.description;
        const blockKey = `B${allocation.allocation.building}-Block${allocation.allocation.block}`;
        
        // Grain totals
        if (!grainData[grainType]) {
          grainData[grainType] = {
            totalWeight: 0,
            totalQuantity: 0,
            totalValue: 0,
            customers: new Set(),
            blocks: new Set()
          };
        }
        
        grainData[grainType].totalWeight += item.weight || 0;
        grainData[grainType].totalQuantity += item.quantity || 0;
        grainData[grainType].totalValue += item.value || 0;
        grainData[grainType].customers.add(allocation.customer._id.toString());
        grainData[grainType].blocks.add(blockKey);
        
        // Block-wise grain mapping
        if (!blockGrainMapping[blockKey]) {
          blockGrainMapping[blockKey] = [];
        }
        blockGrainMapping[blockKey].push({
          grainType,
          weight: item.weight || 0,
          quantity: item.quantity || 0,
          customerName: `${allocation.customer.profile?.firstName || ''} ${allocation.customer.profile?.lastName || ''}`.trim()
        });
      });
    });
    
    // Convert Sets to counts
    const grainAnalytics = Object.keys(grainData).map(grain => ({
      grainType: grain,
      totalWeight: grainData[grain].totalWeight,
      totalQuantity: grainData[grain].totalQuantity,
      totalValue: grainData[grain].totalValue,
      customerCount: grainData[grain].customers.size,
      blockCount: grainData[grain].blocks.size
    }));
    
    res.json({
      grainAnalytics,
      blockGrainMapping,
      totalGrainTypes: grainAnalytics.length
    });
    
  } catch (error) {
    console.error('Error fetching grain analytics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/analytics/owner/storage-duration-analytics
// @desc    Get storage duration analytics (stored/storing grains)
// @access  Private (Owner only)
router.get('/owner/storage-duration-analytics', auth, authorize('owner'), async (req, res) => {
  try {
    const activeAllocations = await StorageAllocation.find({ status: 'active', owner: req.user.id })
      .populate('customer', 'profile');
    const completedAllocations = await StorageAllocation.find({ status: 'completed', owner: req.user.id })
      .populate('customer', 'profile')
      .sort({ 'duration.actualEndDate': -1 })
      .limit(50);
    
    const currentlyStoring = activeAllocations.map(allocation => {
      const startDate = new Date(allocation.duration.startDate);
      const daysStored = Math.floor((Date.now() - startDate) / (1000 * 60 * 60 * 24));
      
      return {
        customer: `${allocation.customer.profile?.firstName || ''} ${allocation.customer.profile?.lastName || ''}`.trim(),
        grainTypes: allocation.storageDetails.items.map(i => i.description).join(', '),
        weight: allocation.storageDetails.totalWeight || 0,
        daysStored,
        startDate: allocation.duration.startDate,
        expectedEndDate: allocation.duration.endDate,
        location: `B${allocation.allocation.building}-Block${allocation.allocation.block}-${allocation.allocation.wing}-Box${allocation.allocation.box}`
      };
    });
    
    const previouslyStored = completedAllocations.map(allocation => {
      const startDate = new Date(allocation.duration.startDate);
      const endDate = new Date(allocation.duration.actualEndDate);
      const daysStored = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
      
      return {
        customer: `${allocation.customer.profile?.firstName || ''} ${allocation.customer.profile?.lastName || ''}`.trim(),
        grainTypes: allocation.storageDetails.items.map(i => i.description).join(', '),
        weight: allocation.storageDetails.totalWeight || 0,
        daysStored,
        startDate: allocation.duration.startDate,
        endDate: allocation.duration.actualEndDate
      };
    });
    
    // Duration distribution
    const durationRanges = {
      '0-30 days': 0,
      '31-60 days': 0,
      '61-90 days': 0,
      '91-180 days': 0,
      '180+ days': 0
    };
    
    [...currentlyStoring, ...previouslyStored].forEach(item => {
      if (item.daysStored <= 30) durationRanges['0-30 days']++;
      else if (item.daysStored <= 60) durationRanges['31-60 days']++;
      else if (item.daysStored <= 90) durationRanges['61-90 days']++;
      else if (item.daysStored <= 180) durationRanges['91-180 days']++;
      else durationRanges['180+ days']++;
    });
    
    res.json({
      currentlyStoring,
      previouslyStored,
      durationRanges,
      stats: {
        activeCount: currentlyStoring.length,
        completedCount: previouslyStored.length,
        averageDuration: currentlyStoring.length > 0 
          ? Math.round(currentlyStoring.reduce((sum, item) => sum + item.daysStored, 0) / currentlyStoring.length)
          : 0
      }
    });
    
  } catch (error) {
    console.error('Error fetching storage duration analytics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/analytics/owner/customer-analytics
// @desc    Get customer analytics (previous and current customers)
// @access  Private (Owner only)
router.get('/owner/customer-analytics', auth, authorize('owner'), async (req, res) => {
  try {
    const scope = await getOwnerScope(req.user.id);

    const activeAllocations = await StorageAllocation.find({ status: 'active', owner: req.user.id })
      .populate('customer', 'profile createdAt');
    const allTransactions = await Transaction.find({ ...getOwnerTransactionMatch(scope) }).populate('customer', 'profile');
    
    // Current customers (with active storage)
    const activeCustomerIds = new Set(activeAllocations.map(a => a.customer._id.toString()));
    
    // Previous customers (no active storage but have history)
    const allCustomers = await User.find({ role: 'customer', _id: { $in: scope.customerIds } }).select('profile createdAt');
    const previousCustomers = allCustomers.filter(c => !activeCustomerIds.has(c._id.toString()));
    
    // Customer lifetime value
    const customerLTV = await Transaction.aggregate([
      { $match: { customer: { $in: scope.customerIds }, ...getOwnerTransactionMatch(scope) } },
      { $group: { 
        _id: '$customer', 
        totalSpent: { $sum: '$amount.totalAmount' },
        transactionCount: { $sum: 1 }
      }},
      { $sort: { totalSpent: -1 } }
    ]);
    
    const ltvWithDetails = await Promise.all(
      customerLTV.map(async (ltv) => {
        const customer = await User.findById(ltv._id).select('profile');
        const hasActiveStorage = ltv._id ? activeCustomerIds.has(ltv._id.toString()) : false;
        
        return {
          customerId: ltv._id,
          name: customer ? `${customer?.profile?.firstName || ''} ${customer?.profile?.lastName || ''}`.trim() : 'Unknown',
          totalSpent: ltv.totalSpent,
          transactionCount: ltv.transactionCount,
          status: hasActiveStorage ? 'active' : 'inactive',
          phone: customer?.profile?.phone || 'N/A',
          location: customer?.profile?.address?.city || 'N/A'
        };
      })
    );
    
    // Customer flow over time (last 12 months)
    const customerFlow = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const inCount = await StorageAllocation.countDocuments({
        owner: req.user.id,
        'duration.startDate': { $gte: monthStart, $lte: monthEnd }
      });
      
      const outCount = await StorageAllocation.countDocuments({
        owner: req.user.id,
        'duration.actualEndDate': { $gte: monthStart, $lte: monthEnd }
      });
      
      customerFlow.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        in: inCount,
        out: outCount,
        net: inCount - outCount
      });
    }
    
    // Customer segmentation (for bubble chart)
    const segmentation = ltvWithDetails.map(customer => ({
      name: customer.name,
      totalSpent: customer.totalSpent,
      transactionCount: customer.transactionCount,
      avgTransactionValue: customer.transactionCount > 0 ? customer.totalSpent / customer.transactionCount : 0,
      status: customer.status
    }));
    
    res.json({
      currentCustomers: {
        count: activeCustomerIds.size,
        list: ltvWithDetails.filter(c => c.status === 'active')
      },
      previousCustomers: {
        count: previousCustomers.length,
        list: ltvWithDetails.filter(c => c.status === 'inactive').slice(0, 20)
      },
      customerLifetimeValue: ltvWithDetails.slice(0, 10),
      customerFlow,
      segmentation: segmentation.slice(0, 20)
    });
    
  } catch (error) {
    console.error('Error fetching customer analytics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/analytics/owner/warehouse-capacity-viz
// @desc    Get warehouse capacity visualization (block-wise grain storage)
// @access  Private (Owner only)
router.get('/owner/warehouse-capacity-viz', auth, authorize('owner'), async (req, res) => {
  try {
    const allocations = await StorageAllocation.find({ status: 'active', owner: req.user.id })
      .populate('customer', 'profile');
    
    const capacityMap = {};
    
    // Initialize all blocks
    for (let building = 1; building <= 2; building++) {
      for (let block = 1; block <= 3; block++) {
        const blockKey = `Building ${building} - Block ${block}`;
        capacityMap[blockKey] = {
          totalBoxes: 12, // 2 wings × 6 boxes
          occupiedBoxes: 0,
          grains: [],
          totalWeight: 0,
          customers: new Set()
        };
      }
    }
    
    // Fill with actual data
    allocations.forEach(allocation => {
      const blockKey = `Building ${allocation.allocation.building} - Block ${allocation.allocation.block}`;
      
      if (capacityMap[blockKey]) {
        capacityMap[blockKey].occupiedBoxes++;
        capacityMap[blockKey].totalWeight += allocation.storageDetails.totalWeight || 0;
        capacityMap[blockKey].customers.add(allocation.customer._id.toString());
        
        allocation.storageDetails.items.forEach(item => {
          const existingGrain = capacityMap[blockKey].grains.find(g => g.type === item.description);
          if (existingGrain) {
            existingGrain.weight += item.weight || 0;
            existingGrain.quantity += item.quantity || 0;
          } else {
            capacityMap[blockKey].grains.push({
              type: item.description,
              weight: item.weight || 0,
              quantity: item.quantity || 0
            });
          }
        });
      }
    });
    
    // Convert to array and calculate percentages
    const capacityData = Object.keys(capacityMap).map(blockKey => {
      const block = capacityMap[blockKey];
      return {
        blockName: blockKey,
        totalBoxes: block.totalBoxes,
        occupiedBoxes: block.occupiedBoxes,
        availableBoxes: block.totalBoxes - block.occupiedBoxes,
        occupancyRate: ((block.occupiedBoxes / block.totalBoxes) * 100).toFixed(1),
        grains: block.grains,
        totalWeight: block.totalWeight,
        customerCount: block.customers.size
      };
    });
    
    res.json({
      capacityData,
      summary: {
        totalBlocks: capacityData.length,
        totalBoxes: capacityData.reduce((sum, b) => sum + b.totalBoxes, 0),
        totalOccupied: capacityData.reduce((sum, b) => sum + b.occupiedBoxes, 0),
        averageOccupancy: (capacityData.reduce((sum, b) => sum + parseFloat(b.occupancyRate), 0) / capacityData.length).toFixed(1)
      }
    });
    
  } catch (error) {
    console.error('Error fetching warehouse capacity visualization:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/analytics/export-pdf
// @desc    Generate PDF report with analytics data
// @access  Private (Owner only)
router.get('/export-pdf', auth, authorize('owner'), async (req, res) => {
  try {
    const scope = await getOwnerScope(req.user.id);
    const { period = 'month' } = req.query;
    
    // Calculate date ranges
    const now = new Date();
    let startDate;
    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Fetch data
    const transactions = await Transaction.find({ createdAt: { $gte: startDate }, ...getOwnerTransactionMatch(scope) })
      .populate('customer', 'name')
      .sort({ createdAt: -1 })
      .limit(100);
    
    const allocations = await StorageAllocation.find({ createdAt: { $gte: startDate }, owner: req.user.id })
      .populate('customer', 'name');
    
    const loans = await Loan.find({ createdAt: { $gte: startDate }, createdBy: req.user.id })
      .populate('customer', 'name');
    
    const totalCustomers = await User.countDocuments({ role: 'customer', _id: { $in: scope.customerIds } });
    
    // Calculate metrics
    const totalRevenue = transactions
      .filter(t => ['grain_storage_rent', 'weighbridge_fee', 'processing_fee'].includes(t.type))
      .reduce((sum, t) => sum + (t.amount?.totalAmount || t.amount?.baseAmount || 0), 0);
    
    const totalExpenses = transactions
      .filter(t => ['refund', 'maintenance', 'operational'].includes(t.type))
      .reduce((sum, t) => sum + (t.amount?.totalAmount || t.amount?.baseAmount || 0), 0);
    
    const profit = totalRevenue - totalExpenses;
    
    const totalGrainIn = allocations.reduce((sum, a) => sum + (a.allocation?.weight || 0), 0);
    const activeAllocations = allocations.filter(a => a.status === 'active');
    
    const pendingLoans = loans.filter(l => l.status === 'pending').length;
    const activeLoans = loans.filter(l => l.status === 'active').length;
    const totalLoanAmount = loans.reduce((sum, l) => sum + (l.amount || 0), 0);

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Page 1 - Summary
    let page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    let y = height - 50;
    
    // Title
    page.drawText('Warehouse Analytics Report', { x: 50, y, size: 24, font: boldFont, color: rgb(0.1, 0.2, 0.5) });
    y -= 25;
    page.drawText(`Period: ${period.charAt(0).toUpperCase() + period.slice(1)} | Generated: ${now.toLocaleDateString('en-IN')}`, { x: 50, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 40;
    
    // Revenue Section
    page.drawText('Revenue & Financial Summary', { x: 50, y, size: 16, font: boldFont, color: rgb(0.1, 0.4, 0.2) });
    y -= 25;
    const financials = [
      ['Total Revenue', `Rs. ${totalRevenue.toLocaleString('en-IN')}`],
      ['Total Expenses', `Rs. ${totalExpenses.toLocaleString('en-IN')}`],
      ['Net Profit/Loss', `Rs. ${profit.toLocaleString('en-IN')}`],
      ['Total Transactions', String(transactions.length)]
    ];
    for (const [label, value] of financials) {
      page.drawText(`${label}:`, { x: 70, y, size: 11, font: boldFont });
      page.drawText(value, { x: 250, y, size: 11, font, color: profit >= 0 ? rgb(0, 0.5, 0) : rgb(0.7, 0, 0) });
      y -= 18;
    }
    y -= 20;
    
    // Grain Analytics
    page.drawText('Grain Analytics', { x: 50, y, size: 16, font: boldFont, color: rgb(0.5, 0.3, 0) });
    y -= 25;
    const grainMetrics = [
      ['Total Grain Stored (kg)', totalGrainIn.toLocaleString('en-IN')],
      ['Active Allocations', String(activeAllocations.length)],
      ['Total Allocations', String(allocations.length)]
    ];
    for (const [label, value] of grainMetrics) {
      page.drawText(`${label}:`, { x: 70, y, size: 11, font: boldFont });
      page.drawText(value, { x: 250, y, size: 11, font });
      y -= 18;
    }
    y -= 20;
    
    // Customer & Loan Summary
    page.drawText('Customer & Loan Summary', { x: 50, y, size: 16, font: boldFont, color: rgb(0.4, 0.1, 0.5) });
    y -= 25;
    const customerMetrics = [
      ['Total Customers', String(totalCustomers)],
      ['Pending Loans', String(pendingLoans)],
      ['Active Loans', String(activeLoans)],
      ['Total Loan Amount', `Rs. ${totalLoanAmount.toLocaleString('en-IN')}`]
    ];
    for (const [label, value] of customerMetrics) {
      page.drawText(`${label}:`, { x: 70, y, size: 11, font: boldFont });
      page.drawText(value, { x: 250, y, size: 11, font });
      y -= 18;
    }
    y -= 30;

    // Page 2 - Recent Transactions Table
    page = pdfDoc.addPage([595, 842]);
    y = height - 50;
    page.drawText('Recent Transactions', { x: 50, y, size: 16, font: boldFont, color: rgb(0.1, 0.2, 0.5) });
    y -= 30;
    
    // Table header
    const cols = [50, 150, 270, 370, 470];
    const headers = ['Date', 'Customer', 'Type', 'Amount', 'Status'];
    headers.forEach((h, i) => {
      page.drawText(h, { x: cols[i], y, size: 10, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    });
    y -= 5;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
    y -= 15;
    
    // Transaction rows (up to 30)
    const topTransactions = transactions.slice(0, 30);
    for (const t of topTransactions) {
      if (y < 50) {
        page = pdfDoc.addPage([595, 842]);
        y = height - 50;
      }
      const date = new Date(t.createdAt).toLocaleDateString('en-IN');
      const customer = t.customer?.name || 'N/A';
      const type = (t.type || '').replace(/_/g, ' ');
      const amount = `Rs. ${(t.amount?.totalAmount || t.amount?.baseAmount || 0).toLocaleString('en-IN')}`;
      const status = t.status || 'N/A';
      
      page.drawText(date.substring(0, 12), { x: cols[0], y, size: 9, font });
      page.drawText(customer.substring(0, 18), { x: cols[1], y, size: 9, font });
      page.drawText(type.substring(0, 15), { x: cols[2], y, size: 9, font });
      page.drawText(amount, { x: cols[3], y, size: 9, font });
      page.drawText(status, { x: cols[4], y, size: 9, font });
      y -= 16;
    }

    // Footer on last page
    page.drawText('Generated by Warehouse Management System - AI Analytics Engine', {
      x: 50, y: 30, size: 8, font, color: rgb(0.5, 0.5, 0.5)
    });

    // Serialize and send
    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=analytics_report_${period}_${now.toISOString().split('T')[0]}.pdf`);
    res.send(Buffer.from(pdfBytes));
    
  } catch (error) {
    console.error('Error generating analytics PDF:', error);
    res.status(500).json({ message: 'Failed to generate PDF', error: error.message });
  }
});

module.exports = router;
