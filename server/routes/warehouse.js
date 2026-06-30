const express = require('express');
const { body, validationResult } = require('express-validator');
const WarehouseLayout = require('../models/WarehouseLayout');
const StorageAllocation = require('../models/StorageAllocation');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/warehouse/layout
// @desc    Create warehouse layout
// @access  Private (Owner only)
router.post('/layout', [auth, authorize('owner')], [
  body('name').trim().notEmpty(),
  body('dimensions.buildings').isInt({ min: 1, max: 10 }),
  body('dimensions.blocksPerBuilding').isInt({ min: 1, max: 10 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, dimensions, settings } = req.body;

    // Check if layout with same name exists for this owner
    const existingLayout = await WarehouseLayout.findOne({
      owner: req.user.id,
      name: name
    });

    if (existingLayout) {
      return res.status(400).json({
        message: 'Warehouse layout with this name already exists'
      });
    }

    const warehouse = new WarehouseLayout({
      owner: req.user.id,
      name,
      description,
      dimensions,
      settings: {
        boxCapacity: {
          weight: settings?.boxCapacity?.weight || 1000,
          volume: settings?.boxCapacity?.volume || 100
        },
        pricing: settings?.pricing || {}
      }
    });

    // Initialize the layout structure
    warehouse.initializeLayout();
    await warehouse.save();

    res.status(201).json({
      message: 'Warehouse layout created successfully',
      warehouse
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/warehouse/layouts
// @desc    Get all warehouse layouts for owner
// @access  Private (Owner only)
router.get('/layouts', [auth, authorize('owner')], async (req, res) => {
  try {
    const layouts = await WarehouseLayout.find({
      owner: req.user.id,
      isActive: true
    }).sort({ createdAt: -1 });

    res.json(layouts);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/warehouse/layout/:id
// @desc    Get specific warehouse layout
// @access  Private
router.get('/layout/:id', auth, async (req, res) => {
  try {
    const warehouse = await WarehouseLayout.findById(req.params.id)
      .populate('layout.wings.left.customer', 'username profile')
      .populate('layout.wings.right.customer', 'username profile');

    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse layout not found' });
    }

    // Check if user has access
    if (warehouse.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    warehouse.updateOccupancy();
    await warehouse.save();

    res.json(warehouse);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/warehouse/allocate
// @desc    Allocate storage space to customer
// @access  Private (Owner only)
router.post('/allocate', [auth, authorize('owner')], [
  body('customerId').isMongoId().withMessage('Valid customer ID is required'),
  body('warehouseId').isMongoId().withMessage('Valid warehouse ID is required'),
  body('allocation.building').isInt({ min: 1 }).withMessage('Building number must be at least 1'),
  body('allocation.block').isInt({ min: 1 }).withMessage('Block number must be at least 1'),
  body('allocation.wing').isIn(['left', 'right']).withMessage('Wing must be left or right'),
  body('allocation.box').isInt({ min: 1, max: 6 }).withMessage('Box number must be between 1 and 6'),
  body('duration.endDate').isISO8601().withMessage('Valid end date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      customerId,
      warehouseId,
      allocation,
      storageDetails = { type: 'dry', totalWeight: 0, totalVolume: 0 },
      duration,
      pricing = { baseRate: 100, ratePerDay: 50 }
    } = req.body;

    console.log('Allocation request:', { customerId, warehouseId, allocation, storageDetails, duration, pricing });

    // Get warehouse layout
    const warehouse = await WarehouseLayout.findById(warehouseId);
    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }

    if (warehouse.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Verify customer exists
    const customer = await User.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (customer.role !== 'customer') {
      return res.status(400).json({ message: 'Selected user is not a customer' });
    }

    // Find the specific section
    const block = warehouse.layout.find(
      b => b.buildingNumber === allocation.building && b.blockNumber === allocation.block
    );

    if (!block) {
      console.error('Block not found:', { building: allocation.building, block: allocation.block });
      return res.status(404).json({ message: `Block not found for Building ${allocation.building}, Block ${allocation.block}` });
    }

    // Convert wing from left/right to A/B for compatibility
    const wingKey = allocation.wing === 'left' ? 'A' : 'B';
    
    if (!block.wings[wingKey]) {
      console.error('Wing not found:', wingKey, 'Available wings:', Object.keys(block.wings));
      return res.status(404).json({ message: `Wing ${wingKey} not found` });
    }

    const section = block.wings[wingKey].find(s => s.sectionNumber === allocation.box);
    if (!section) {
      console.error('Section not found:', allocation.box, 'Available sections:', block.wings[wingKey].map(s => s.sectionNumber));
      return res.status(404).json({ message: `Section ${allocation.box} not found in Wing ${wingKey}` });
    }

    if (section.isOccupied) {
      return res.status(400).json({ message: 'Section is already occupied' });
    }

    // Create storage allocation
    const storageAllocation = new StorageAllocation({
      customer: customerId,
      warehouse: warehouseId,
      owner: req.user.id,
      allocation,
      storageDetails,
      duration,
      pricing,
      createdBy: req.user.id
    });

    await storageAllocation.save();

    // Update warehouse layout section
    section.isOccupied = true;
    section.customer = customerId;
    section.allocatedDate = new Date();
    
    // Update grain details if provided
    if (storageDetails.grainType) {
      section.grainDetails = {
        grainType: storageDetails.grainType || 'rice',
        numberOfBags: storageDetails.numberOfBags || 0,
        bagWeight: storageDetails.bagWeight || 50,
        totalWeight: storageDetails.totalWeight || 0,
        qualityGrade: storageDetails.qualityGrade || 'A'
      };
    }

    // Update rent details
    section.rentDetails = {
      monthlyRentPerBag: pricing.ratePerDay || 50,
      totalRentPaid: 0,
      dueAmount: 0
    };

    warehouse.updateOccupancy();
    await warehouse.save();

    // Emit real-time update
    req.io.emit('storage_allocated', {
      allocation: storageAllocation,
      warehouse: warehouse._id,
      message: `Storage allocated to ${customer.profile.firstName} ${customer.profile.lastName} in Building ${allocation.building}, Block ${allocation.block}, Wing ${wingKey}, Section ${allocation.box}`
    });

    res.status(201).json({
      message: 'Storage allocated successfully',
      allocation: storageAllocation
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/warehouse/allocations
// @desc    Get storage allocations
// @access  Private
router.get('/allocations', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    let query = {};
    
    if (req.user.role === 'owner') {
      query.owner = req.user.id;
    } else if (req.user.role === 'customer') {
      query.customer = req.user.id;
    }

    if (status) {
      query.status = status;
    }

    const allocations = await StorageAllocation.find(query)
      .populate('customer', 'username email profile')
      .populate('warehouse', 'name')
      .populate('owner', 'username profile')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await StorageAllocation.countDocuments(query);

    res.json({
      allocations,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/warehouse/available-boxes/:warehouseId
// @desc    Get available boxes in warehouse
// @access  Private (Owner only)
router.get('/available-boxes/:warehouseId', [auth, authorize('owner')], async (req, res) => {
  try {
    const warehouse = await WarehouseLayout.findById(req.params.warehouseId);
    
    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }

    if (warehouse.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const availableBoxes = warehouse.getAvailableBoxes();

    res.json({
      availableBoxes,
      totalAvailable: availableBoxes.length,
      totalCapacity: warehouse.totalCapacity.boxes
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/warehouse/allocation/:id/extend
// @desc    Extend storage period
// @access  Private (Owner/Customer)
router.put('/allocation/:id/extend', auth, [
  body('newEndDate').isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const allocation = await StorageAllocation.findById(req.params.id);

    if (!allocation) {
      return res.status(404).json({ message: 'Allocation not found' });
    }

    // Check access permissions
    if (req.user.role === 'customer' && allocation.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 'owner' && allocation.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    allocation.duration.extendedDate = new Date(req.body.newEndDate);
    allocation.calculatePricing(); // Recalculate pricing
    
    await allocation.save();

    res.json({
      message: 'Storage period extended successfully',
      allocation
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/warehouse/allocate-grain-storage
// @desc    Allocate grain storage section
// @access  Private (Owner only)
router.post('/allocate-grain-storage', [auth, authorize('owner')], async (req, res) => {
  try {
    const { warehouseId, customerId, location, grainDetails, rentDetails } = req.body;

    // Find the warehouse
    const warehouse = await WarehouseLayout.findById(warehouseId);
    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }

    // Check if user owns the warehouse
    if (warehouse.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Find the customer
    const customer = await require('../models/User').findOne({
      $or: [
        { _id: customerId },
        { email: customerId },
        { username: customerId }
      ]
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Find the specific section
    const layoutItem = warehouse.layout.find(
      l => l.buildingNumber === location.building && l.blockNumber === location.block
    );

    if (!layoutItem) {
      return res.status(404).json({ message: 'Building/Block not found' });
    }

    const section = layoutItem.wings[location.wing][location.section - 1];
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    if (section.isOccupied) {
      return res.status(400).json({ message: 'Section is already occupied' });
    }

    // Allocate the section
    section.isOccupied = true;
    section.customer = customer._id;
    section.allocatedDate = new Date();
    section.grainDetails = {
      grainType: grainDetails.grainType,
      numberOfBags: grainDetails.numberOfBags,
      bagWeight: grainDetails.bagWeight,
      totalWeight: grainDetails.numberOfBags * grainDetails.bagWeight,
      qualityGrade: grainDetails.qualityGrade
    };
    section.rentDetails = {
      monthlyRentPerBag: rentDetails.monthlyRentPerBag,
      totalRentPaid: 0,
      dueAmount: grainDetails.numberOfBags * rentDetails.monthlyRentPerBag
    };

    // Update warehouse occupancy
    warehouse.occupiedCapacity = warehouse.occupiedCapacity || {};
    warehouse.occupiedCapacity.sections = (warehouse.occupiedCapacity.sections || 0) + 1;
    warehouse.occupiedCapacity.occupiedBags = (warehouse.occupiedCapacity.occupiedBags || 0) + grainDetails.numberOfBags;
    warehouse.occupiedCapacity.occupiedWeight = (warehouse.occupiedCapacity.occupiedWeight || 0) + (grainDetails.numberOfBags * grainDetails.bagWeight);

    await warehouse.save();

    // Update customer grain details
    customer.customerGrainDetails = customer.customerGrainDetails || {};
    customer.customerGrainDetails.totalBagsStored = (customer.customerGrainDetails.totalBagsStored || 0) + grainDetails.numberOfBags;
    customer.customerGrainDetails.outstandingRent = (customer.customerGrainDetails.outstandingRent || 0) + section.rentDetails.dueAmount;
    
    customer.customerGrainDetails.storageHistory = customer.customerGrainDetails.storageHistory || [];
    customer.customerGrainDetails.storageHistory.push({
      grainType: grainDetails.grainType,
      numberOfBags: grainDetails.numberOfBags,
      qualityGrade: grainDetails.qualityGrade,
      storageLocation: location
    });

    await customer.save();

    res.status(201).json({
      message: 'Grain storage allocated successfully',
      allocation: {
        warehouse: warehouse.name,
        customer: customer.username,
        location,
        grainDetails,
        rentDetails: section.rentDetails
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/warehouse/occupancy
// @desc    Get warehouse occupancy statistics
// @access  Private (Owner)
router.get('/occupancy', [auth, authorize('owner')], async (req, res) => {
  try {
    const warehouses = await WarehouseLayout.find({ owner: req.user.id });
    
    let totalSections = 0;
    let occupiedSections = 0;
    let totalBags = 0;
    let totalWeight = 0;

    warehouses.forEach(warehouse => {
      warehouse.layout.forEach(block => {
        ['A', 'B', 'C', 'D'].forEach(wing => {
          if (block.wings[wing]) {
            block.wings[wing].forEach(section => {
              totalSections++;
              if (section.isOccupied) {
                occupiedSections++;
                totalBags += section.grainDetails?.numberOfBags || 0;
                totalWeight += section.grainDetails?.totalWeight || 0;
              }
            });
          }
        });
      });
    });

    const occupancyPercentage = totalSections > 0 ? (occupiedSections / totalSections) * 100 : 0;

    res.json({
      totalSections,
      occupiedSections,
      totalBags,
      totalWeight,
      occupancyPercentage: Math.round(occupancyPercentage)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/warehouse/owner-dashboard
// @desc    Get owner dashboard statistics
// @access  Private (Owner only)
router.get('/owner-dashboard', [auth, authorize('owner')], async (req, res) => {
  try {
    const User = require('../models/User');
    const Transaction = require('../models/Transaction');

    // Get total revenue from transactions
    const revenueResult = await Transaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    // Get total customers count
    const totalCustomers = await User.countDocuments({ 
      role: 'customer', 
      isActive: true 
    });

    // Get today's transactions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayTransactions = await Transaction.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // Get pending payments
    const pendingPayments = await Transaction.countDocuments({
      status: 'pending'
    });

    res.json({
      totalRevenue,
      totalCustomers,
      todayTransactions,
      pendingPayments
    });

  } catch (error) {
    console.error('Error fetching owner dashboard:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/warehouse/allocations/my-locations
// @desc    Get customer's grain storage locations with detailed warehouse position
// @access  Private (Customer only)
router.get('/allocations/my-locations', [auth, authorize('customer')], async (req, res) => {
  try {
    const customerId = req.user.id;

    // Get all storage allocations for this customer
    const allocations = await StorageAllocation.find({
      customer: customerId
    })
      .populate('warehouse', 'name description')
      .populate('owner', 'username profile')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      allocations: allocations
    });

  } catch (error) {
    console.error('Error fetching customer grain locations:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching grain locations' 
    });
  }
});

module.exports = router;