const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Vehicle = require('../models/Vehicle');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');

const router = express.Router();
const TEN_DIGIT_PHONE_REGEX = /^\d{10}$/;

// @route   POST /api/vehicles/entry
// @desc    Register vehicle entry
// @access  Private (Owner)
router.post('/entry', [auth, authorize('owner')], [
  body('vehicleNumber').trim().notEmpty().withMessage('Vehicle number is required'),
  body('vehicleType').isIn(['truck', 'mini-truck', 'tractor', 'trailer', 'container', 'van', 'other']).withMessage('Invalid vehicle type'),
  body('driverName').trim().notEmpty().withMessage('Driver name is required'),
  body('driverPhone')
    .trim()
    .matches(TEN_DIGIT_PHONE_REGEX)
    .withMessage('Driver phone must be exactly 10 digits'),
  body('visitPurpose').isIn(['weighing_only', 'grain_loading']).withMessage('Visit purpose is required'),
  body('weighingOption').isIn(['empty_now', 'loaded_now', 'will_return']).withMessage('Weighing option is required'),
  body('customerName').optional({ checkFalsy: true }).trim(),
  body('customerPhone')
    .optional({ checkFalsy: true })
    .trim()
    .matches(TEN_DIGIT_PHONE_REGEX)
    .withMessage('Customer phone must be exactly 10 digits'),
  body('customerEmail').optional({ checkFalsy: true }).custom((value) => {
    // Only validate email format if value is provided
    if (value && value.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error('Valid email is required');
      }
    }
    return true;
  })
], async (req, res) => {
  try {
    console.log('Received vehicle entry request:', {
      visitPurpose: req.body.visitPurpose,
      weighingOption: req.body.weighingOption,
      customerName: req.body.customerName,
      vehicleNumber: req.body.vehicleNumber
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', JSON.stringify(errors.array(), null, 2));
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      vehicleNumber,
      vehicleType,
      driverName,
      driverPhone,
      driverLicense,
      customerName,
      customerPhone,
      customerEmail,
      visitPurpose,
      weighingOption,
      weighBridgeData,
      weighingStatus,
      capacity,
      cargo
    } = req.body;

    // Validate customer details are provided for grain_loading
    if (visitPurpose === 'grain_loading') {
      if (!customerName?.trim() || !customerPhone?.trim() || !customerEmail?.trim()) {
        return res.status(400).json({
          message: 'Customer details (name, phone, email) are required for grain loading/unloading operations'
        });
      }
    }

    // Check if vehicle already exists and is active
    const existingVehicle = await Vehicle.findOne({
      vehicleNumber: vehicleNumber.toUpperCase(),
      status: { $in: ['entered', 'loaded', 'weighed'] }
    });

    if (existingVehicle) {
      return res.status(400).json({
        message: 'Vehicle is already in the warehouse',
        vehicle: existingVehicle
      });
    }

    // Find or create customer
    let customer = null;
    let customerCreatedNow = false;
    
    if (customerEmail && customerName && customerPhone) {
      customer = await User.findOne({ email: customerEmail.toLowerCase() });
      
      if (!customer) {
        // Generate temporary password (customer can change later)
        const tempPassword = `TEMP${Math.random().toString(36).slice(-8).toUpperCase()}`;
        
        // Create new customer account
        customer = new User({
          username: customerEmail.split('@')[0] + Math.random().toString(36).slice(-4),
          email: customerEmail.toLowerCase(),
          password: tempPassword, // Will be hashed by User model pre-save hook
          role: 'customer',
          profile: {
            firstName: customerName.split(' ')[0],
            lastName: customerName.split(' ').slice(1).join(' ') || '',
            phone: customerPhone
          },
          isActive: true,
          needsPasswordChange: true // Flag to indicate temp password
        });

        await customer.save();
        customerCreatedNow = true;
        
        console.log(`✅ New customer created: ${customer.email} with temp password: ${tempPassword}`);
        console.log(`📧 Customer Email: ${customer.email}`);
        console.log(`🔑 Temporary Password: ${tempPassword}`);
        console.log(`📞 Phone: ${customerPhone}`);
        
        // In production, you would email this to the customer
      } else {
        console.log(`✅ Existing customer found: ${customer.email}`);
      }
    }

    const vehicle = new Vehicle({
      vehicleNumber: vehicleNumber.toUpperCase(),
      vehicleType,
      driverName,
      driverPhone,
      driverLicense,
      ownerName: customerName || driverName,
      ownerPhone: customerPhone || driverPhone,
      visitPurpose: visitPurpose || 'weighing_only',
      weighingOption,
      weighBridgeData: weighBridgeData || undefined,
      weighingStatus: weighingStatus || 'not_started',
      capacity,
      cargo,
      customer: customer?._id || null,
      owner: req.user.id,
      entryTime: new Date(),
      status: visitPurpose === 'grain_loading' ? 'inside' : 'entered'
    });

    await vehicle.save();

    // Emit real-time update
    const updateType = visitPurpose === 'grain_loading' ? 'vehicle_loading' : 'vehicle_entry';
    req.io.emit(updateType, {
      vehicle,
      message: visitPurpose === 'grain_loading' 
        ? `Vehicle ${vehicleNumber} added to loading queue` 
        : `Vehicle ${vehicleNumber} entered for weighing`
    });

    res.status(201).json({
      message: 'Vehicle entry registered successfully',
      vehicle,
      customerCreated: customerCreatedNow,
      customerEmail: customer?.email || null,
      visitPurpose,
      customerInfo: customerCreatedNow ? {
        email: customer.email,
        message: 'New customer account created. Temporary password sent to customer.'
      } : customer ? {
        email: customer.email,
        message: 'Linked to existing customer account.'
      } : null
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/vehicles
// @desc    Get all vehicles
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    
    const query = {};

    if (req.user.role === 'owner') {
      query.$or = [
        { owner: req.user.id },
        { owner: { $exists: false }, entryBy: req.user.id }
      ];
    } else if (req.user.role === 'customer') {
      query.customer = req.user.id;
    }
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // Search by vehicle number or driver name
    if (search) {
      query.$or = [
        { vehicleNumber: { $regex: search, $options: 'i' } },
        { driverName: { $regex: search, $options: 'i' } },
        { ownerName: { $regex: search, $options: 'i' } }
      ];
    }

    const vehicles = await Vehicle.find(query)
      .populate('customer', 'username email profile')
      .populate('weighBridgeData.weighBridgeOperator', 'username')
      .sort({ entryTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Vehicle.countDocuments(query);

    res.json({
      vehicles,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/vehicles/:id
// @desc    Get vehicle by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)
      .populate('customer', 'username email profile')
      .populate('weighBridgeData.weighBridgeOperator', 'username profile');

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    const ownerHasAccess = req.user.role === 'owner' && (
      vehicle.owner?.toString() === req.user.id ||
      (!vehicle.owner && vehicle.entryBy?.toString() === req.user.id)
    );

    if (req.user.role === 'owner' && !ownerHasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 'customer' && vehicle.customer?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(vehicle);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/vehicles/:id
// @desc    Update vehicle details (payment status, etc.)
// @access  Private (Owner)
router.put('/:id', [auth, authorize('owner')], async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    if (!(vehicle.owner?.toString() === req.user.id || (!vehicle.owner && vehicle.entryBy?.toString() === req.user.id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update only the fields provided in the request body
    const allowedUpdates = ['paymentStatus', 'paymentAmount', 'paymentMethod', 'paymentDate', 'status'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        vehicle[field] = req.body[field];
      }
    });

    if (req.body.status === 'exited') {
      vehicle.exitTime = new Date();
    }

    if (req.body.status === 'entered' || req.body.status === 'inside') {
      vehicle.exitTime = undefined;
    }

    await vehicle.save();

    res.json({
      message: 'Vehicle updated successfully',
      vehicle
    });

  } catch (error) {
    console.error('Vehicle update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/vehicles/:id/weigh
// @desc    Update weigh bridge data
// @access  Private (Owner)
router.put('/:id/weigh', [auth, authorize('owner')], [
  body('weight').isNumeric(),
  body('weighType').isIn(['tare', 'gross'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { weight, weighType } = req.body;
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    if (!(vehicle.owner?.toString() === req.user.id || (!vehicle.owner && vehicle.entryBy?.toString() === req.user.id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Initialize weighBridgeData if it doesn't exist
    if (!vehicle.weighBridgeData) {
      vehicle.weighBridgeData = {};
    }

    if (weighType === 'tare') {
      // First weighing - empty vehicle
      vehicle.weighBridgeData.tareWeight = parseFloat(weight);
      vehicle.weighBridgeData.firstWeighTime = new Date();
      vehicle.weighingStatus = 'partial';
      vehicle.status = 'weighed';
    } else {
      // Second weighing - loaded vehicle
      vehicle.weighBridgeData.grossWeight = parseFloat(weight);
      vehicle.weighBridgeData.secondWeighTime = new Date();
      
      // Calculate net weight if both weights are available
      if (vehicle.weighBridgeData.tareWeight) {
        vehicle.weighBridgeData.netWeight = vehicle.weighBridgeData.grossWeight - vehicle.weighBridgeData.tareWeight;
      }
      
      vehicle.weighingStatus = 'completed';
      vehicle.status = 'weighed';
    }
    
    vehicle.weighBridgeData.weighBridgeOperator = req.user.id;
    await vehicle.save();

    // Emit real-time update
    req.io.emit('vehicle_weighed', {
      vehicle,
      message: weighType === 'tare' 
        ? `Vehicle ${vehicle.vehicleNumber} - First weighing completed`
        : `Vehicle ${vehicle.vehicleNumber} - Both weighings completed`
    });

    res.json({
      message: weighType === 'tare' 
        ? 'First weighing recorded. Vehicle can return for second weighing.' 
        : 'Weighing completed successfully!',
      vehicle
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/vehicles/:id/exit
// @desc    Process vehicle exit
// @access  Private (Owner)
router.put('/:id/exit', [auth, authorize('owner')], async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    if (!(vehicle.owner?.toString() === req.user.id || (!vehicle.owner && vehicle.entryBy?.toString() === req.user.id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (vehicle.paymentStatus !== 'paid') {
      return res.status(400).json({
        message: 'Cannot process exit. Payment is pending.'
      });
    }

    vehicle.status = 'exited';
    vehicle.exitTime = new Date();
    await vehicle.save();

    // Emit real-time update
    req.io.emit('vehicle_exit', {
      vehicle,
      message: `Vehicle ${vehicle.vehicleNumber} has exited`
    });

    res.json({
      message: 'Vehicle exit processed successfully',
      vehicle
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/vehicles/:id/charges
// @desc    Update vehicle charges
// @access  Private (Owner)
router.put('/:id/charges', [auth, authorize('owner')], [
  body('weighBridgeCharge').optional().isNumeric(),
  body('storageCharge').optional().isNumeric(),
  body('loadingCharge').optional().isNumeric(),
  body('otherCharges').optional().isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    if (!(vehicle.owner?.toString() === req.user.id || (!vehicle.owner && vehicle.entryBy?.toString() === req.user.id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    vehicle.charges = {
      ...vehicle.charges,
      ...req.body
    };

    await vehicle.save();

    res.json({
      message: 'Vehicle charges updated successfully',
      vehicle
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/vehicles/stats/dashboard
// @desc    Get vehicle statistics for dashboard
// @access  Private (Owner)
router.get('/stats/dashboard', [auth, authorize('owner')], async (req, res) => {
  try {
    const ownerObjectId = new mongoose.Types.ObjectId(req.user.id);
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const stats = await Vehicle.aggregate([
      {
        $match: {
          $or: [
            { owner: ownerObjectId },
            { owner: { $exists: false }, entryBy: ownerObjectId }
          ]
        }
      },
      {
        $facet: {
          totalVehicles: [{ $count: "count" }],
          todayEntries: [
            { $match: { entryTime: { $gte: startOfDay, $lte: endOfDay } } },
            { $count: "count" }
          ],
          currentlyInside: [
            { $match: { status: { $in: ['inside', 'entered', 'loaded', 'weighed'] } } },
            { $count: "count" }
          ],
          totalExited: [
            { $match: { status: 'exited' } },
            { $count: "count" }
          ],
          byStatus: [
            { $group: { _id: "$status", count: { $sum: 1 } } }
          ],
          byVehicleType: [
            { $group: { _id: "$vehicleType", count: { $sum: 1 } } }
          ]
        }
      }
    ]);

    // Total customers till date
    const totalCustomers = await User.countDocuments({
      role: 'customer',
      _id: {
        $in: await Vehicle.distinct('customer', {
          customer: { $ne: null },
          $or: [
            { owner: req.user.id },
            { owner: { $exists: false }, entryBy: req.user.id }
          ]
        })
      }
    });

    const totalVehicles = stats[0].totalVehicles[0]?.count || 0;
    const totalExited = stats[0].totalExited[0]?.count || 0;
    const currentlyInside = stats[0].currentlyInside[0]?.count || 0;

    const result = {
      totalVehicles: totalVehicles, // All vehicles that came for loading, unloading, weighing
      todayEntries: stats[0].todayEntries[0]?.count || 0,
      currentlyInside: currentlyInside, // Only vehicles currently inside for loading/unloading
      totalEntries: totalVehicles + totalExited, // Total in + out count
      totalCustomers: totalCustomers, // Cumulative customers till date
      statusBreakdown: stats[0].byStatus,
      vehicleTypeBreakdown: stats[0].byVehicleType
    };

    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/vehicles/grain-entry
// @desc    Register vehicle entry with grain details
// @access  Private (Owner)
router.post('/grain-entry', [auth, authorize('owner')], [
  body('vehicleNumber').trim().notEmpty().withMessage('Vehicle number is required'),
  body('vehicleType').isIn(['truck', 'mini-truck', 'tractor', 'trailer']).withMessage('Invalid vehicle type'),
  body('driverName').trim().notEmpty().withMessage('Driver name is required'),
  body('driverPhone')
    .trim()
    .matches(TEN_DIGIT_PHONE_REGEX)
    .withMessage('Driver phone must be exactly 10 digits'),
  body('grainDetails.grainType').isIn(['rice', 'wheat', 'maize', 'barley', 'millet', 'sorghum']).withMessage('Invalid grain type'),
  body('grainDetails.actualBags').isInt({ min: 1 }).withMessage('Number of bags must be at least 1'),
  body('grainDetails.purpose').isIn(['storage', 'delivery', 'pickup', 'processing']).withMessage('Invalid purpose'),
  body('destination.customerName').trim().notEmpty().withMessage('Customer name is required'),
  body('destination.customerEmail').trim().notEmpty().withMessage('Customer email is required')
    .isEmail().withMessage('Please enter a valid email address'),
  body('destination.customerPhone')
    .trim()
    .matches(TEN_DIGIT_PHONE_REGEX)
    .withMessage('Customer phone must be exactly 10 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array().map(e => e.msg).join('. '),
        errors: errors.array() 
      });
    }

    const vehicleData = {
      ...req.body,
      vehicleNumber: req.body.vehicleNumber.toUpperCase(),
      status: 'inside',
      entryTime: new Date(),
      entryBy: req.user.id,
      owner: req.user.id
    };

    // Check if vehicle already inside
    const existingVehicle = await Vehicle.findOne({
      vehicleNumber: vehicleData.vehicleNumber,
      status: 'inside'
    });

    if (existingVehicle) {
      return res.status(400).json({
        message: 'Vehicle is already inside the warehouse'
      });
    }

    const vehicle = new Vehicle(vehicleData);
    await vehicle.save();

    // If purpose is storage, create or link customer account
    let customerId = req.user.id;
    if (req.body.grainDetails.purpose === 'storage') {
      const { customerName, customerEmail, customerPhone } = req.body.destination;
      
      // Check if customer exists by email or phone
      let customer = await User.findOne({
        $or: [
          { email: customerEmail.toLowerCase() },
          { 'profile.phone': customerPhone }
        ],
        role: 'customer'
      });

      if (!customer) {
        // Create new customer account
        const nameParts = customerName.trim().split(' ');
        const username = customerEmail.split('@')[0] + Math.random().toString(36).substr(2, 4);
        
        customer = new User({
          username,
          email: customerEmail.toLowerCase(),
          password: Math.random().toString(36).slice(-8) + 'A1!', // Random temp password
          role: 'customer',
          profile: {
            firstName: nameParts[0] || customerName,
            lastName: nameParts.slice(1).join(' ') || '',
            phone: customerPhone
          },
          isActive: true,
          needsPasswordChange: true
        });
        await customer.save();
        
        // Note: In production, send email with login credentials
      }
      
      customerId = customer._id;
      
      // Link customer to vehicle
      vehicle.customerId = customerId;
      await vehicle.save();
    }

    // Create transaction record for weighbridge fee
    const transactionId = `WB-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const transaction = new Transaction({
      transactionId,
      type: 'weighbridge_fee',
      customer: customerId,
      vehicle: vehicle._id,
      weighbridgeDetails: {
        vehicleNumber: vehicle.vehicleNumber,
        driverName: vehicle.driverName,
        weighingFee: 100
      },
      amount: {
        baseAmount: 100,
        totalAmount: 100
      },
      payment: {
        method: 'cash',
        status: 'pending'
      }
    });
    await transaction.save();

    res.status(201).json({
      message: 'Vehicle entry registered successfully',
      vehicle,
      transaction
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/vehicles/grain-exit
// @desc    Register vehicle exit with grain tracking
// @access  Private (Owner)
router.post('/grain-exit', [auth, authorize('owner')], [
  body('vehicleId').notEmpty(),
  body('exitWeight').optional().isNumeric(),
  body('actualBags').optional().isNumeric(),
  body('paymentStatus').isIn(['pending', 'paid', 'partial'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vehicleId, exitWeight, actualBags, remarks, paymentStatus } = req.body;

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle || vehicle.status !== 'inside') {
      return res.status(404).json({
        message: 'Vehicle not found or not currently inside'
      });
    }

    if (!(vehicle.owner?.toString() === req.user.id || (!vehicle.owner && vehicle.entryBy?.toString() === req.user.id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update vehicle with exit details
    vehicle.status = 'exited';
    vehicle.exitTime = new Date();
    vehicle.exitBy = req.user.id;
    vehicle.exitDetails = {
      exitWeight: exitWeight || vehicle.grainDetails?.totalWeight,
      actualBags: actualBags || vehicle.grainDetails?.actualBags,
      remarks,
      paymentStatus
    };

    await vehicle.save();

    // Update transaction payment status
    await Transaction.findOneAndUpdate(
      { vehicleId: vehicle._id, type: 'weighbridge_fee' },
      { 
        paymentMethod: paymentStatus === 'paid' ? 'cash' : 'pending',
        status: paymentStatus === 'paid' ? 'completed' : 'pending',
        paidAt: paymentStatus === 'paid' ? new Date() : null
      }
    );

    res.json({
      message: 'Vehicle exit registered successfully',
      vehicle
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
