const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const excelExportService = require('../utils/excelExportService');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const StorageAllocation = require('../models/StorageAllocation');
const Loan = require('../models/Loan');

const getOwnerScopedCustomerIds = async (ownerId) => {
    const [allocationCustomerIds, vehicleCustomerIds, loanCustomerIds] = await Promise.all([
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

    return [...new Set([
        ...allocationCustomerIds.map(String),
        ...vehicleCustomerIds.map(String),
        ...loanCustomerIds.map(String)
    ])];
};

// @route   GET /api/exports/transactions
// @desc    Export transactions to Excel
// @access  Private (Owner only)
router.get('/transactions', auth, authorize(['owner']), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let query = {};
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const transactions = await Transaction.find(query)
            .populate('customer', 'name email phone')
            .populate('vehicle')
            .sort({ createdAt: -1 });

        const result = await excelExportService.exportTransactions(transactions);

        res.json({
            success: true,
            message: 'Transactions exported successfully',
            ...result
        });

    } catch (error) {
        console.error('Transaction export error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export transactions'
        });
    }
});

// @route   GET /api/exports/customers
// @desc    Export customers to Excel
// @access  Private (Owner only)
router.get('/customers', auth, authorize(['owner']), async (req, res) => {
    try {
        const customers = await User.find({ role: 'customer' })
            .select('name email phone address company createdAt status')
            .sort({ createdAt: -1 });

        // Get additional stats for each customer
        const customersWithStats = await Promise.all(customers.map(async (customer) => {
            const totalTransactions = await Transaction.countDocuments({ customer: customer._id });
            const transactions = await Transaction.find({ customer: customer._id });
            const totalSpent = transactions.reduce((sum, t) => sum + (t.payment?.amount || 0), 0);
            
            return {
                ...customer.toObject(),
                totalTransactions,
                totalSpent
            };
        }));

        const result = await excelExportService.exportCustomers(customersWithStats);

        res.json({
            success: true,
            message: 'Customers exported successfully',
            ...result
        });

    } catch (error) {
        console.error('Customer export error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export customers'
        });
    }
});

// @route   GET /api/exports/vehicles
// @desc    Export vehicles to Excel
// @access  Private (Owner only)
router.get('/vehicles', auth, authorize(['owner']), async (req, res) => {
    try {
        const vehicles = await Vehicle.find()
            .sort({ createdAt: -1 });

        // Get additional stats for each vehicle
        const vehiclesWithStats = await Promise.all(vehicles.map(async (vehicle) => {
            const totalVisits = await Transaction.countDocuments({ vehicle: vehicle._id });
            const lastTransaction = await Transaction.findOne({ vehicle: vehicle._id })
                .sort({ createdAt: -1 });
            
            return {
                ...vehicle.toObject(),
                totalVisits,
                lastVisit: lastTransaction?.createdAt
            };
        }));

        const result = await excelExportService.exportVehicles(vehiclesWithStats);

        res.json({
            success: true,
            message: 'Vehicles exported successfully',
            ...result
        });

    } catch (error) {
        console.error('Vehicle export error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export vehicles'
        });
    }
});

// @route   GET /api/exports/storage-allocations
// @desc    Export storage allocations to Excel
// @access  Private (Owner only)
router.get('/storage-allocations', auth, authorize(['owner']), async (req, res) => {
    try {
        const { status } = req.query;
        
        let query = {};
        if (status) {
            query.status = status;
        }

        const allocations = await StorageAllocation.find(query)
            .populate('customer', 'name email phone')
            .populate('warehouse', 'name location')
            .sort({ createdAt: -1 });

        const result = await excelExportService.exportStorageAllocations(allocations);

        res.json({
            success: true,
            message: 'Storage allocations exported successfully',
            ...result
        });

    } catch (error) {
        console.error('Storage allocation export error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export storage allocations'
        });
    }
});

// @route   GET /api/exports/comprehensive-report
// @desc    Export comprehensive report with all data
// @access  Private (Owner only)
router.get('/comprehensive-report', auth, authorize(['owner']), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let dateQuery = {};
        if (startDate && endDate) {
            dateQuery.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Fetch all data
        const [transactions, customers, vehicles, allocations] = await Promise.all([
            Transaction.find(dateQuery)
                .populate('customer', 'name email phone')
                .populate('vehicle')
                .sort({ createdAt: -1 }),
            
            User.find({ role: 'customer' })
                .select('name email phone address company createdAt')
                .sort({ createdAt: -1 }),
            
            Vehicle.find()
                .sort({ createdAt: -1 }),
            
            StorageAllocation.find(dateQuery)
                .populate('customer', 'name')
                .populate('warehouse', 'name')
                .sort({ createdAt: -1 })
        ]);

        // Calculate total revenue
        const totalRevenue = transactions.reduce((sum, t) => sum + (t.payment?.amount || 0), 0);

        const data = {
            transactions,
            customers,
            vehicles,
            allocations,
            totalRevenue
        };

        const result = await excelExportService.exportComprehensiveReport(data);

        res.json({
            success: true,
            message: 'Comprehensive report exported successfully',
            ...result
        });

    } catch (error) {
        console.error('Comprehensive report export error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export comprehensive report'
        });
    }
});

// @route   GET /api/exports/daily-report
// @desc    Export daily report
// @access  Private (Owner only)
router.get('/daily-report', auth, authorize(['owner']), async (req, res) => {
    try {
        const { date } = req.query;
        const reportDate = date ? new Date(date) : new Date();
        
        // Set start and end of day
        const startOfDay = new Date(reportDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(reportDate);
        endOfDay.setHours(23, 59, 59, 999);

        const transactions = await Transaction.find({
            createdAt: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        })
        .populate('customer', 'name email phone')
        .populate('vehicle')
        .sort({ createdAt: -1 });

        // Calculate daily stats
        const dailyStats = {
            totalTransactions: transactions.length,
            totalRevenue: transactions.reduce((sum, t) => sum + (t.payment?.amount || 0), 0),
            completedPayments: transactions.filter(t => t.payment?.status === 'completed').length,
            pendingPayments: transactions.filter(t => t.payment?.status === 'pending').length,
            uniqueVehicles: [...new Set(transactions.map(t => t.vehicle?.vehicleNumber).filter(Boolean))].length,
            uniqueCustomers: [...new Set(transactions.map(t => t.customer?._id).filter(Boolean))].length
        };

        const result = await excelExportService.exportTransactions(transactions);
        
        res.json({
            success: true,
            message: `Daily report for ${reportDate.toDateString()} exported successfully`,
            dailyStats,
            ...result
        });

    } catch (error) {
        console.error('Daily report export error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export daily report'
        });
    }
});

// @route   POST /api/exports/custom
// @desc    Export custom data based on filters
// @access  Private (Owner only)
router.post('/custom', auth, authorize(['owner']), async (req, res) => {
    try {
        const { 
            exportType, // 'transactions', 'customers', 'vehicles', 'allocations'
            filters,
            dateRange 
        } = req.body;

        let query = {};
        
        // Apply date range if provided
        if (dateRange?.startDate && dateRange?.endDate) {
            query.createdAt = {
                $gte: new Date(dateRange.startDate),
                $lte: new Date(dateRange.endDate)
            };
        }

        // Apply additional filters
        if (filters) {
            Object.assign(query, filters);
        }

        let result;
        
        switch (exportType) {
            case 'transactions':
                const transactions = await Transaction.find(query)
                    .populate('customer', 'name email phone')
                    .populate('vehicle')
                    .sort({ createdAt: -1 });
                result = await excelExportService.exportTransactions(transactions);
                break;
                
            case 'customers':
                const customers = await User.find({ role: 'customer', ...query })
                    .select('name email phone address company createdAt');
                result = await excelExportService.exportCustomers(customers);
                break;
                
            case 'vehicles':
                const vehicles = await Vehicle.find(query);
                result = await excelExportService.exportVehicles(vehicles);
                break;
                
            case 'allocations':
                const allocations = await StorageAllocation.find(query)
                    .populate('customer', 'name')
                    .populate('warehouse', 'name');
                result = await excelExportService.exportStorageAllocations(allocations);
                break;
                
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid export type'
                });
        }

        res.json({
            success: true,
            message: `${exportType} exported successfully`,
            ...result
        });

    } catch (error) {
        console.error('Custom export error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export data'
        });
    }
});

// @route   GET /api/exports/users-excel
// @desc    Export all owners and customers to Excel with date joined and left date
// @access  Private (Owner only)
router.get('/users-excel', auth, authorize(['owner']), async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'WMS';
        workbook.created = new Date();

        // ----- Owners Sheet -----
        const ownersSheet = workbook.addWorksheet('Owners');
        ownersSheet.columns = [
            { header: 'Username', key: 'username', width: 20 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Phone', key: 'phone', width: 18 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Date Joined', key: 'dateJoined', width: 18 }
        ];
        ownersSheet.getRow(1).font = { bold: true };
        ownersSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        ownersSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        const owners = await User.find({ _id: req.user.id, role: 'owner' }).select('-password').sort({ createdAt: -1 });
        owners.forEach(owner => {
            ownersSheet.addRow({
                username: owner.username,
                name: `${owner.profile?.firstName || ''} ${owner.profile?.lastName || ''}`.trim(),
                email: owner.email,
                phone: owner.profile?.phone || 'N/A',
                status: owner.isActive ? 'Active' : 'Inactive',
                dateJoined: owner.createdAt ? new Date(owner.createdAt).toLocaleDateString('en-IN') : 'N/A'
            });
        });

        // ----- Customers Sheet -----
        const customersSheet = workbook.addWorksheet('Customers');
        customersSheet.columns = [
            { header: 'Username', key: 'username', width: 20 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Phone', key: 'phone', width: 18 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Date Joined', key: 'dateJoined', width: 18 },
            { header: 'Left Date', key: 'leftDate', width: 18 },
            { header: 'Total Spent (₹)', key: 'totalSpent', width: 18 }
        ];
        customersSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        customersSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };

        const ownerScopedCustomerIds = await getOwnerScopedCustomerIds(req.user.id);
        const customers = await User.find({ role: 'customer', _id: { $in: ownerScopedCustomerIds } }).select('-password').sort({ createdAt: -1 });
        
        // Get transaction totals for each customer
        const Transaction = require('../models/Transaction');
        const ownerVehicleIds = await Vehicle.distinct('_id', {
            $or: [
                { owner: req.user.id },
                { owner: { $exists: false }, entryBy: req.user.id }
            ]
        });
        const ownerAllocationIds = await StorageAllocation.distinct('_id', { owner: req.user.id });

        const customerTotals = await Transaction.aggregate([
            {
                $match: {
                    'payment.status': 'completed',
                    customer: { $in: customers.map(c => c._id) },
                    $or: [
                        { processedBy: req.user._id },
                        { vehicle: { $in: ownerVehicleIds } },
                        { storageAllocation: { $in: ownerAllocationIds } }
                    ]
                }
            },
            { $group: { _id: '$customer', totalSpent: { $sum: '$totalAmount' } } }
        ]);
        const totalsMap = {};
        customerTotals.forEach(ct => { totalsMap[ct._id?.toString()] = ct.totalSpent; });

        // Check for active storage allocations to determine if customer vacated
        const StorageAllocation = require('../models/StorageAllocation');
        const activeAllocations = await StorageAllocation.aggregate([
            { $match: { status: 'active', owner: req.user._id } },
            { $group: { _id: '$customer' } }
        ]);
        const activeCustomerIds = new Set(activeAllocations.map(a => a._id?.toString()));

        customers.forEach(customer => {
            const hasActive = activeCustomerIds.has(customer._id.toString());
            const isInactive = !customer.isActive;
            
            customersSheet.addRow({
                username: customer.username,
                name: `${customer.profile?.firstName || ''} ${customer.profile?.lastName || ''}`.trim(),
                email: customer.email,
                phone: customer.profile?.phone || 'N/A',
                status: customer.isActive ? 'Active' : 'Inactive',
                dateJoined: customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('en-IN') : 'N/A',
                leftDate: (isInactive && !hasActive) ? (customer.updatedAt ? new Date(customer.updatedAt).toLocaleDateString('en-IN') : 'N/A') : '-',
                totalSpent: totalsMap[customer._id.toString()] || 0
            });
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=users_${new Date().toISOString().split('T')[0]}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Users Excel export error:', error);
        res.status(500).json({ success: false, message: 'Failed to export users' });
    }
});

// @route   DELETE /api/exports/cleanup
// @desc    Clean old export files
// @access  Private (Owner only)
router.delete('/cleanup', auth, authorize(['owner']), async (req, res) => {
    try {
        await excelExportService.cleanOldExports();
        
        res.json({
            success: true,
            message: 'Old export files cleaned successfully'
        });

    } catch (error) {
        console.error('Export cleanup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clean export files'
        });
    }
});

module.exports = router;