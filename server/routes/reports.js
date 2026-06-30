const express = require('express');
const ExcelJS = require('exceljs');
const Vehicle = require('../models/Vehicle');
const Transaction = require('../models/Transaction');
const StorageAllocation = require('../models/StorageAllocation');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/reports/export/excel
// @desc    Export data to Excel
// @access  Private (Owner only)
router.get('/export/excel', [auth, authorize('owner')], async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Warehouse Management System';
    workbook.lastModifiedBy = 'WMS';
    workbook.created = new Date();

    let query = {};
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (type === 'vehicles' || !type) {
      // Vehicles Sheet
      const vehiclesSheet = workbook.addWorksheet('Vehicles');
      vehiclesSheet.columns = [
        { header: 'Vehicle Number', key: 'vehicleNumber', width: 15 },
        { header: 'Vehicle Type', key: 'vehicleType', width: 12 },
        { header: 'Driver Name', key: 'driverName', width: 20 },
        { header: 'Driver Phone', key: 'driverPhone', width: 15 },
        { header: 'Owner Name', key: 'ownerName', width: 20 },
        { header: 'Entry Time', key: 'entryTime', width: 20 },
        { header: 'Exit Time', key: 'exitTime', width: 20 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Gross Weight', key: 'grossWeight', width: 12 },
        { header: 'Tare Weight', key: 'tareWeight', width: 12 },
        { header: 'Net Weight', key: 'netWeight', width: 12 },
        { header: 'Total Charges', key: 'totalCharges', width: 15 },
        { header: 'Payment Status', key: 'paymentStatus', width: 15 }
      ];

      const vehicles = await Vehicle.find(query).populate('customer', 'username profile');

      vehicles.forEach(vehicle => {
        vehiclesSheet.addRow({
          vehicleNumber: vehicle.vehicleNumber,
          vehicleType: vehicle.vehicleType,
          driverName: vehicle.driverName,
          driverPhone: vehicle.driverPhone,
          ownerName: vehicle.ownerName,
          entryTime: vehicle.entryTime,
          exitTime: vehicle.exitTime,
          status: vehicle.status,
          grossWeight: vehicle.weighBridgeData?.grossWeight || '',
          tareWeight: vehicle.weighBridgeData?.tareWeight || '',
          netWeight: vehicle.weighBridgeData?.netWeight || '',
          totalCharges: vehicle.charges?.total || 0,
          paymentStatus: vehicle.paymentStatus
        });
      });

      // Style the header
      vehiclesSheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };
      });
    }

    if (type === 'transactions' || !type) {
      // Transactions Sheet
      const transactionsSheet = workbook.addWorksheet('Transactions');
      transactionsSheet.columns = [
        { header: 'Transaction ID', key: 'transactionId', width: 20 },
        { header: 'Type', key: 'type', width: 15 },
        { header: 'Customer', key: 'customer', width: 20 },
        { header: 'Vehicle Number', key: 'vehicleNumber', width: 15 },
        { header: 'Base Amount', key: 'baseAmount', width: 12 },
        { header: 'Tax', key: 'tax', width: 10 },
        { header: 'Total Amount', key: 'totalAmount', width: 15 },
        { header: 'Payment Method', key: 'paymentMethod', width: 15 },
        { header: 'Payment Status', key: 'paymentStatus', width: 15 },
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Invoice Number', key: 'invoiceNumber', width: 20 }
      ];

      const transactions = await Transaction.find(query)
        .populate('customer', 'username profile')
        .populate('vehicle', 'vehicleNumber');

      transactions.forEach(transaction => {
        const totalTax = (transaction.amount.tax?.cgst || 0) + 
                        (transaction.amount.tax?.sgst || 0) + 
                        (transaction.amount.tax?.igst || 0) + 
                        (transaction.amount.tax?.cess || 0);

        transactionsSheet.addRow({
          transactionId: transaction.transactionId,
          type: transaction.type,
          customer: transaction.customer?.username || '',
          vehicleNumber: transaction.vehicle?.vehicleNumber || '',
          baseAmount: transaction.amount.baseAmount,
          tax: totalTax,
          totalAmount: transaction.amount.totalAmount,
          paymentMethod: transaction.payment.method,
          paymentStatus: transaction.payment.status,
          date: transaction.createdAt,
          invoiceNumber: transaction.invoice?.number || ''
        });
      });

      // Style the header
      transactionsSheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };
      });
    }

    if (type === 'storage' || !type) {
      // Storage Allocations Sheet
      const storageSheet = workbook.addWorksheet('Storage Allocations');
      storageSheet.columns = [
        { header: 'Customer', key: 'customer', width: 20 },
        { header: 'Warehouse', key: 'warehouse', width: 20 },
        { header: 'Building', key: 'building', width: 10 },
        { header: 'Block', key: 'block', width: 10 },
        { header: 'Wing', key: 'wing', width: 10 },
        { header: 'Box', key: 'box', width: 10 },
        { header: 'Storage Type', key: 'storageType', width: 15 },
        { header: 'Start Date', key: 'startDate', width: 15 },
        { header: 'End Date', key: 'endDate', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Total Weight (kg)', key: 'totalWeight', width: 15 },
        { header: 'Final Amount', key: 'finalAmount', width: 15 },
        { header: 'Payment Status', key: 'paymentStatus', width: 15 }
      ];

      const allocations = await StorageAllocation.find(query)
        .populate('customer', 'username profile')
        .populate('warehouse', 'name');

      allocations.forEach(allocation => {
        storageSheet.addRow({
          customer: allocation.customer?.username || '',
          warehouse: allocation.warehouse?.name || '',
          building: allocation.allocation.building,
          block: allocation.allocation.block,
          wing: allocation.allocation.wing,
          box: allocation.allocation.box,
          storageType: allocation.storageDetails.type,
          startDate: allocation.duration.startDate,
          endDate: allocation.duration.endDate,
          status: allocation.status,
          totalWeight: allocation.storageDetails.totalWeight || 0,
          finalAmount: allocation.pricing?.finalAmount || 0,
          paymentStatus: allocation.paymentStatus
        });
      });

      // Style the header
      storageSheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };
      });
    }

    if (type === 'customers' || !type) {
      // Customers Sheet
      const customersSheet = workbook.addWorksheet('Customers');
      customersSheet.columns = [
        { header: 'Username', key: 'username', width: 20 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'First Name', key: 'firstName', width: 15 },
        { header: 'Last Name', key: 'lastName', width: 15 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Registration Date', key: 'registrationDate', width: 20 },
        { header: 'Active Allocations', key: 'activeAllocations', width: 18 },
        { header: 'Total Spent', key: 'totalSpent', width: 15 },
        { header: 'Status', key: 'status', width: 12 }
      ];

      const customers = await User.find({ ...query, role: 'customer' });

      for (const customer of customers) {
        const allocations = await StorageAllocation.find({ customer: customer._id });
        const transactions = await Transaction.find({ customer: customer._id });
        
        const activeAllocations = allocations.filter(a => a.status === 'active').length;
        const totalSpent = transactions
          .filter(t => t.payment.status === 'completed')
          .reduce((sum, t) => sum + (t.amount.totalAmount || 0), 0);

        customersSheet.addRow({
          username: customer.username,
          email: customer.email,
          firstName: customer.profile?.firstName || '',
          lastName: customer.profile?.lastName || '',
          phone: customer.profile?.phone || '',
          registrationDate: customer.createdAt,
          activeAllocations,
          totalSpent,
          status: customer.isActive ? 'Active' : 'Inactive'
        });
      }

      // Style the header
      customersSheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };
      });
    }

    // Set response headers for file download
    const fileName = `warehouse_report_${type || 'all'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error generating Excel report' });
  }
});

// @route   GET /api/reports/summary
// @desc    Get reports summary
// @access  Private (Owner only)
router.get('/summary', [auth, authorize('owner')], async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateQuery = {};
    if (startDate && endDate) {
      dateQuery = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    const summary = await Promise.all([
      // Total vehicles
      Vehicle.countDocuments(dateQuery),
      
      // Total transactions
      Transaction.countDocuments(dateQuery),
      
      // Total revenue
      Transaction.aggregate([
        { $match: { ...dateQuery, 'payment.status': 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount.totalAmount' } } }
      ]),
      
      // Active storage allocations
      StorageAllocation.countDocuments({ status: 'active' }),
      
      // Total customers
      User.countDocuments({ role: 'customer', isActive: true }),
      
      // Pending payments
      Transaction.aggregate([
        { $match: { 'payment.status': 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount.totalAmount' } } }
      ])
    ]);

    const result = {
      totalVehicles: summary[0],
      totalTransactions: summary[1],
      totalRevenue: summary[2][0]?.total || 0,
      activeAllocations: summary[3],
      totalCustomers: summary[4],
      pendingPayments: summary[5][0]?.total || 0,
      reportGenerated: new Date(),
      period: startDate && endDate ? `${startDate} to ${endDate}` : 'All time'
    };

    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;