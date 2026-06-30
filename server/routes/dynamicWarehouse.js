const express = require('express');
const { body, validationResult } = require('express-validator');
const DynamicWarehouseLayout = require('../models/DynamicWarehouseLayout');
const StorageAllocation = require('../models/StorageAllocation');
const Vehicle = require('../models/Vehicle');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// @route   POST /api/dynamic-warehouse/layout
// @desc    Create dynamic warehouse layout with custom configuration
// @access  Private (Owner only)
router.post('/layout', [auth, authorize('owner')], [
  body('name').trim().notEmpty().withMessage('Warehouse name is required'),
  body('location').trim().notEmpty().withMessage('Warehouse location is required'),
  body('configuration.numberOfBuildings').isInt({ min: 1, max: 10 }).withMessage('Number of buildings must be between 1 and 10'),
  body('configuration.blocksPerBuilding').isInt({ min: 1, max: 26 }).withMessage('Blocks per building must be between 1 and 26'),
  body('configuration.rowsPerBlock').isInt({ min: 1, max: 20 }).withMessage('Rows per block must be between 1 and 20'),
  body('configuration.colsPerBlock').isInt({ min: 1, max: 20 }).withMessage('Columns per block must be between 1 and 20')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, location, configuration, pricing } = req.body;

    // Check if layout with same name exists for this owner
    const existingLayout = await DynamicWarehouseLayout.findOne({
      owner: req.user.id,
      name: name
    });

    if (existingLayout) {
      return res.status(400).json({
        message: 'Warehouse layout with this name already exists'
      });
    }

    const warehouse = new DynamicWarehouseLayout({
      owner: req.user.id,
      name,
      description,
      location,
      configuration,
      pricing: pricing || {
        baseRate: 100,
        ratePerDay: 50,
        ratePerKg: 2
      }
    });

    // Generate the layout based on configuration
    warehouse.generateLayout();
    await warehouse.save();

    // Generate JSON file
    const layoutJSON = {
      warehouseId: warehouse._id,
      name: warehouse.name,
      description: warehouse.description,
      location: warehouse.location,
      configuration: warehouse.configuration,
      totalSlots: warehouse.totalSlots,
      layout: warehouse.layout,
      generatedAt: new Date().toISOString()
    };

    const jsonFilePath = path.join(__dirname, '../uploads/warehouse-layouts', `${warehouse._id}.json`);
    await fs.writeFile(jsonFilePath, JSON.stringify(layoutJSON, null, 2));

    res.status(201).json({
      success: true,
      message: 'Warehouse layout created successfully',
      warehouse,
      jsonDownloadUrl: `/uploads/warehouse-layouts/${warehouse._id}.json`
    });

  } catch (error) {
    console.error('Error creating warehouse layout:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/dynamic-warehouse/layouts
// @desc    Get all warehouse layouts for owner
// @access  Private (Owner only)
router.get('/layouts', [auth, authorize('owner')], async (req, res) => {
  try {
    const layouts = await DynamicWarehouseLayout.find({
      owner: req.user.id,
      isActive: true
    }).sort({ createdAt: -1 });

    // Calculate occupancy stats for each layout
    const layoutsWithStats = layouts.map(layout => {
      const stats = layout.getOccupancyStats();
      return {
        ...layout.toObject(),
        occupancy: stats
      };
    });

    res.json({
      success: true,
      layouts: layoutsWithStats
    });

  } catch (error) {
    console.error('Error fetching layouts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/dynamic-warehouse/layout/:id
// @desc    Get specific warehouse layout
// @access  Private
router.get('/layout/:id', auth, async (req, res) => {
  try {
    const warehouse = await DynamicWarehouseLayout.findById(req.params.id)
      .populate('layout.blocks.slots.allocations.customer', 'username profile');

    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse layout not found' });
    }

    // Check if user has access
    if (warehouse.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const stats = warehouse.getOccupancyStats();

    res.json({
      success: true,
      warehouse,
      occupancy: stats
    });

  } catch (error) {
    console.error('Error fetching warehouse:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/dynamic-warehouse/inventory-summary
// @desc    Get comprehensive filled/empty space summary across all warehouses
// @access  Private (Owner only)
router.get('/inventory-summary', [auth, authorize('owner')], async (req, res) => {
  try {
    const layouts = await DynamicWarehouseLayout.find({
      owner: req.user.id,
      isActive: true
    });

    if (!layouts || layouts.length === 0) {
      return res.json({
        success: true,
        summary: {
          totalWarehouses: 0,
          totalSlots: 0,
          filledSlots: 0,
          partiallyFilledSlots: 0,
          emptySlots: 0,
          totalCapacityBags: 0,
          totalFilledBags: 0,
          overallUtilization: 0,
          warehouses: [],
          grainDistribution: {},
          customerDistribution: {}
        }
      });
    }

    let totalSlots = 0;
    let filledSlots = 0;
    let partiallyFilledSlots = 0;
    let emptySlots = 0;
    let totalCapacityBags = 0;
    let totalFilledBags = 0;
    const grainDistribution = {};
    const customerDistribution = {};
    const warehouseDetails = [];

    for (const layout of layouts) {
      const warehouseInfo = {
        id: layout._id,
        name: layout.name,
        buildings: [],
        totalSlots: layout.totalSlots,
        filledSlots: 0,
        partiallyFilledSlots: 0,
        emptySlots: 0,
        totalCapacityBags: 0,
        totalFilledBags: 0
      };

      for (const building of layout.layout) {
        const buildingInfo = {
          name: building.building,
          blocks: []
        };

        for (const block of building.blocks) {
          const blockInfo = {
            name: block.block,
            totalSlots: block.slots.length,
            filledSlots: [],
            partiallyFilledSlots: [],
            emptySlots: []
          };

          for (const slot of block.slots) {
            const slotInfo = {
              label: slot.slotLabel,
              capacity: slot.capacity,
              filledBags: slot.filledBags,
              status: slot.status,
              utilization: slot.capacity > 0 ? ((slot.filledBags / slot.capacity) * 100).toFixed(1) : 0,
              allocations: (slot.allocations || []).map(a => ({
                customerName: a.customerName || 'Unknown',
                bags: a.bags,
                grainType: a.grainType || 'Unknown',
                weight: a.weight,
                entryDate: a.entryDate
              }))
            };

            totalCapacityBags += slot.capacity;
            totalFilledBags += slot.filledBags;
            warehouseInfo.totalCapacityBags += slot.capacity;
            warehouseInfo.totalFilledBags += slot.filledBags;

            // Track grain distribution
            for (const alloc of (slot.allocations || [])) {
              const grain = alloc.grainType || 'Unknown';
              grainDistribution[grain] = (grainDistribution[grain] || 0) + (alloc.bags || 0);
              const custName = alloc.customerName || 'Unknown';
              customerDistribution[custName] = (customerDistribution[custName] || 0) + (alloc.bags || 0);
            }

            if (slot.status === 'full') {
              blockInfo.filledSlots.push(slotInfo);
              filledSlots++;
              warehouseInfo.filledSlots++;
            } else if (slot.status === 'partially-filled') {
              blockInfo.partiallyFilledSlots.push(slotInfo);
              partiallyFilledSlots++;
              warehouseInfo.partiallyFilledSlots++;
            } else {
              blockInfo.emptySlots.push(slotInfo);
              emptySlots++;
              warehouseInfo.emptySlots++;
            }
            totalSlots++;
          }

          buildingInfo.blocks.push(blockInfo);
        }

        warehouseInfo.buildings.push(buildingInfo);
      }

      warehouseDetails.push(warehouseInfo);
    }

    res.json({
      success: true,
      summary: {
        totalWarehouses: layouts.length,
        totalSlots,
        filledSlots,
        partiallyFilledSlots,
        emptySlots,
        totalCapacityBags,
        totalFilledBags,
        overallUtilization: totalCapacityBags > 0 ? ((totalFilledBags / totalCapacityBags) * 100).toFixed(1) : 0,
        warehouses: warehouseDetails,
        grainDistribution,
        customerDistribution
      }
    });

  } catch (error) {
    console.error('Error fetching inventory summary:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/dynamic-warehouse/layout/:id/download-json
// @desc    Download warehouse layout as JSON
// @access  Private (Owner only)
router.get('/layout/:id/download-json', [auth, authorize('owner')], async (req, res) => {
  try {
    const warehouse = await DynamicWarehouseLayout.findById(req.params.id);

    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse layout not found' });
    }

    if (warehouse.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const layoutJSON = {
      warehouseId: warehouse._id,
      name: warehouse.name,
      description: warehouse.description,
      configuration: warehouse.configuration,
      totalSlots: warehouse.totalSlots,
      occupiedSlots: warehouse.occupiedSlots,
      layout: warehouse.layout,
      occupancy: warehouse.getOccupancyStats(),
      generatedAt: new Date().toISOString()
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${warehouse.name.replace(/\s+/g, '_')}_layout.json"`);
    res.json(layoutJSON);

  } catch (error) {
    console.error('Error downloading JSON:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/dynamic-warehouse/layout/:id
// @desc    Update warehouse layout configuration
// @access  Private (Owner only)
router.put('/layout/:id', [auth, authorize('owner')], async (req, res) => {
  try {
    const warehouse = await DynamicWarehouseLayout.findById(req.params.id);

    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse layout not found' });
    }

    if (warehouse.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, description, location, pricing } = req.body;

    if (name) warehouse.name = name;
    if (description) warehouse.description = description;
    if (location) warehouse.location = location;
    if (pricing) warehouse.pricing = { ...warehouse.pricing, ...pricing };

    await warehouse.save();

    res.json({
      success: true,
      message: 'Warehouse layout updated successfully',
      warehouse
    });

  } catch (error) {
    console.error('Error updating warehouse:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/dynamic-warehouse/layout/:id
// @desc    Delete warehouse layout (soft delete)
// @access  Private (Owner only)
router.delete('/layout/:id', [auth, authorize('owner')], async (req, res) => {
  try {
    const warehouse = await DynamicWarehouseLayout.findById(req.params.id);

    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse layout not found' });
    }

    if (warehouse.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if there are any active allocations
    if (warehouse.occupiedSlots > 0) {
      return res.status(400).json({
        message: 'Cannot delete warehouse with active allocations'
      });
    }

    warehouse.isActive = false;
    await warehouse.save();

    res.json({
      success: true,
      message: 'Warehouse layout deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting warehouse:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/dynamic-warehouse/layout/:id/available-slots
// @desc    Get available slots in warehouse
// @access  Private
router.get('/layout/:id/available-slots', auth, async (req, res) => {
  try {
    const warehouse = await DynamicWarehouseLayout.findById(req.params.id);

    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse layout not found' });
    }

    const availableSlots = [];

    warehouse.layout.forEach(building => {
      building.blocks.forEach(block => {
        block.slots.forEach(slot => {
          if (!slot.isOccupied) {
            availableSlots.push({
              building: building.building,
              block: block.block,
              slotLabel: slot.slotLabel,
              row: slot.row,
              col: slot.col
            });
          }
        });
      });
    });

    res.json({
      success: true,
      availableSlots,
      count: availableSlots.length,
      totalSlots: warehouse.totalSlots
    });

  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/dynamic-warehouse/allocate-slot
// @desc    Allocate a specific slot to customer
// @access  Private (Owner)
router.post('/allocate-slot', [auth, authorize('owner')], [
  body('warehouseId').isMongoId().withMessage('Valid warehouse ID is required'),
  body('building').notEmpty().withMessage('Building is required'),
  body('block').notEmpty().withMessage('Block is required'),
  body('slotLabel').notEmpty().withMessage('Slot label is required'),
  body('customerId').isMongoId().withMessage('Valid customer ID is required'),
  body('grainDetails').notEmpty().withMessage('Grain details are required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { warehouseId, building, block, slotLabel, customerId, grainDetails, allocationId } = req.body;

    const warehouse = await DynamicWarehouseLayout.findById(warehouseId);

    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }

    // Allocate the slot
    warehouse.allocateSlot(building, block, slotLabel, customerId, grainDetails, allocationId);
    await warehouse.save();

    // Emit real-time update
    if (req.io) {
      req.io.emit('slot_allocated', {
        warehouse: warehouseId,
        building,
        block,
        slotLabel,
        customerId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Slot allocated successfully',
      slot: {
        building,
        block,
        slotLabel
      }
    });

  } catch (error) {
    console.error('Error allocating slot:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   POST /api/dynamic-warehouse/deallocate-slot
// @desc    Deallocate a specific slot
// @access  Private (Owner)
router.post('/deallocate-slot', [auth, authorize('owner')], [
  body('warehouseId').isMongoId().withMessage('Valid warehouse ID is required'),
  body('building').notEmpty().withMessage('Building is required'),
  body('block').notEmpty().withMessage('Block is required'),
  body('slotLabel').notEmpty().withMessage('Slot label is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { warehouseId, building, block, slotLabel } = req.body;

    const warehouse = await DynamicWarehouseLayout.findById(warehouseId);

    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }

    // Deallocate the slot
    warehouse.deallocateSlot(building, block, slotLabel);
    await warehouse.save();

    // Emit real-time update
    if (req.io) {
      req.io.emit('slot_deallocated', {
        warehouse: warehouseId,
        building,
        block,
        slotLabel,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Slot deallocated successfully'
    });

  } catch (error) {
    console.error('Error deallocating slot:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   POST /api/dynamic-warehouse/calculate-cost
// @desc    Calculate storage cost based on weight and duration
// @access  Public
router.post('/calculate-cost', async (req, res) => {
  try {
    const { weightInKg, entryDate, layoutId } = req.body;

    if (!weightInKg || !entryDate) {
      return res.status(400).json({ message: 'Weight and entry date are required' });
    }

    let pricing = {
      rentPerQuintalPerMonth: 7,
      maintenancePerMonth: 6,
      insurancePerYear: 5
    };

    // If layout ID provided, get pricing from that layout
    if (layoutId) {
      const layout = await DynamicWarehouseLayout.findById(layoutId);
      if (layout) {
        pricing = layout.pricing;
      }
    }

    const costDetails = DynamicWarehouseLayout.calculateStorageCost(
      weightInKg,
      entryDate,
      new Date(),
      pricing
    );

    res.json({
      success: true,
      costDetails
    });

  } catch (error) {
    console.error('Error calculating cost:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/dynamic-warehouse/allocate-bags
// @desc    Allocate bags to a specific slot for a customer
// @access  Private (Owner only)
router.post('/allocate-bags', [auth, authorize('owner')], async (req, res) => {
  try {
    const { layoutId, building, block, slotLabel, customerId, customerName, bags, grainType, weight, notes } = req.body;

    console.log('➕ Allocating bags:', { layoutId, building, block, slotLabel, customerId, customerName, bags });

    if (!layoutId || !building || !block || !slotLabel || !customerId || !bags) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const warehouse = await DynamicWarehouseLayout.findById(layoutId);
    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }

    // Find the slot
    const buildingObj = warehouse.layout.find(b => b.building === building);
    if (!buildingObj) {
      return res.status(404).json({ message: 'Building not found' });
    }

    const blockObj = buildingObj.blocks.find(bl => bl.block === block);
    if (!blockObj) {
      return res.status(404).json({ message: 'Block not found' });
    }

    const slot = blockObj.slots.find(s => s.slotLabel === slotLabel);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }

    console.log('📦 Slot before allocation:', { 
      slotLabel: slot.slotLabel, 
      capacity: slot.capacity,
      filledBags: slot.filledBags, 
      remainingCapacity: slot.capacity - slot.filledBags,
      status: slot.status,
      currentAllocations: slot.allocations.length 
    });

    // Check capacity
    const remainingCapacity = slot.capacity - slot.filledBags;
    if (bags > remainingCapacity) {
      console.log('❌ Insufficient capacity:', { available: remainingCapacity, requested: bags });
      return res.status(400).json({ 
        message: `Insufficient capacity. Available: ${remainingCapacity} bags, Requested: ${bags} bags` 
      });
    }

    // Add allocation
    slot.allocations.push({
      customer: customerId,
      customerName: customerName,
      bags: parseInt(bags),
      grainType: grainType || '',
      weight: parseFloat(weight) || 0,
      entryDate: new Date(),
      notes: notes || ''
    });

    slot.filledBags += bags;
    slot.isOccupied = true;

    // Update status
    if (slot.filledBags >= slot.capacity) {
      slot.status = 'full';
      console.log('🔴 Slot is now FULL');
    } else if (slot.filledBags > 0) {
      slot.status = 'partially-filled';
      console.log('🟡 Slot is now PARTIALLY FILLED');
    }

    console.log('📦 Slot after allocation:', { 
      slotLabel: slot.slotLabel, 
      filledBags: slot.filledBags, 
      remainingCapacity: slot.capacity - slot.filledBags,
      status: slot.status,
      isOccupied: slot.isOccupied,
      totalAllocations: slot.allocations.length 
    });

    await warehouse.save();

    // Create StorageAllocation entry for customer dashboard
    try {
      const allocation = new StorageAllocation({
        customer: customerId,
        warehouse: layoutId,
        owner: warehouse.owner,
        storage: {
          building: building,
          block: block,
          slot: slotLabel,
          capacity: slot.capacity,
          used: bags
        },
        grainDetails: {
          type: grainType || 'Not specified',
          quantity: bags,
          weight: parseFloat(weight) || 0,
          qualityGrade: 'A'
        },
        duration: {
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days default
        },
        status: 'active',
        notes: notes || ''
      });
      await allocation.save();
      console.log('✅ StorageAllocation created for customer dashboard');
    } catch (allocError) {
      console.error('⚠️ Error creating StorageAllocation:', allocError.message);
      // Don't fail the main operation if allocation creation fails
    }

    // Emit real-time update
    if (req.io) {
      req.io.emit('slot_allocated', {
        warehouse: layoutId,
        building,
        block,
        slotLabel,
        customer: customerName,
        bags,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Bags allocated successfully',
      slot: {
        slotLabel: slot.slotLabel,
        capacity: slot.capacity,
        filledBags: slot.filledBags,
        remainingCapacity: slot.capacity - slot.filledBags,
        status: slot.status
      }
    });

  } catch (error) {
    console.error('Error allocating bags:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/dynamic-warehouse/deallocate-bags
// @desc    Remove bags from a slot (partial or full deallocation)
// @access  Private (Owner only)
router.post('/deallocate-bags', [auth, authorize('owner')], async (req, res) => {
  try {
    let { layoutId, building, block, slotLabel, customerId, bags } = req.body;

    // Handle if customerId is an object (extract _id)
    if (typeof customerId === 'object' && customerId._id) {
      customerId = customerId._id;
    }

    console.log('🔄 Deallocating bags:', { layoutId, building, block, slotLabel, customerId, bags });

    const warehouse = await DynamicWarehouseLayout.findById(layoutId);
    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }

    const buildingObj = warehouse.layout.find(b => b.building === building);
    const blockObj = buildingObj?.blocks.find(bl => bl.block === block);
    const slot = blockObj?.slots.find(s => s.slotLabel === slotLabel);

    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }

    console.log('📦 Slot before deallocation:', { 
      slotLabel: slot.slotLabel, 
      filledBags: slot.filledBags, 
      capacity: slot.capacity,
      status: slot.status,
      allocationsCount: slot.allocations.length 
    });

    // Find customer allocation
    const allocationIndex = slot.allocations.findIndex(a => a.customer.toString() === customerId);
    if (allocationIndex === -1) {
      return res.status(404).json({ message: 'Customer allocation not found in this slot' });
    }

    const allocation = slot.allocations[allocationIndex];

    if (bags > allocation.bags) {
      return res.status(400).json({ 
        message: `Cannot deallocate ${bags} bags. Customer only has ${allocation.bags} bags in this slot` 
      });
    }

    // Update allocation
    if (bags === allocation.bags) {
      // Remove entire allocation
      console.log('🗑️ Removing entire allocation for customer:', customerId);
      slot.allocations.splice(allocationIndex, 1);
    } else {
      // Partial deallocation
      console.log(`📉 Partial deallocation: ${allocation.bags} -> ${allocation.bags - bags} bags`);
      allocation.bags -= bags;
    }

    slot.filledBags -= bags;

    // Update status
    if (slot.filledBags === 0) {
      slot.status = 'empty';
      slot.isOccupied = false;
      console.log('✅ Slot is now EMPTY and available for allocation');
    } else if (slot.filledBags < slot.capacity) {
      slot.status = 'partially-filled';
      console.log('⚠️ Slot is now PARTIALLY FILLED');
    }

    console.log('📦 Slot after deallocation:', { 
      slotLabel: slot.slotLabel, 
      filledBags: slot.filledBags, 
      capacity: slot.capacity,
      status: slot.status,
      isOccupied: slot.isOccupied,
      allocationsCount: slot.allocations.length 
    });

    await warehouse.save();

    // Emit real-time update
    if (req.io) {
      req.io.emit('slot_deallocated', {
        warehouse: layoutId,
        building,
        block,
        slotLabel,
        bags,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Bags deallocated successfully',
      slot: {
        slotLabel: slot.slotLabel,
        filledBags: slot.filledBags,
        remainingCapacity: slot.capacity - slot.filledBags,
        status: slot.status
      }
    });

  } catch (error) {
    console.error('Error deallocating bags:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/dynamic-warehouse/my-grain-locations
// @desc    Get customer's grain storage locations from dynamic warehouse
// @access  Private (Customer only)
router.get('/my-grain-locations', auth, async (req, res) => {
  // Allow both customers and owners to access
  if (!['customer', 'owner'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const customerId = req.user.id;
    
    // Find all warehouses that have allocations for this customer
    const warehouses = await DynamicWarehouseLayout.find({
      'layout.blocks.slots.allocations.customer': customerId,
      isActive: true
    }).populate('owner', 'username profile');

    const grainLocations = [];

    // Extract all allocations for this customer from all warehouses
    warehouses.forEach(warehouse => {
      warehouse.layout.forEach(building => {
        building.blocks.forEach(block => {
          block.slots.forEach(slot => {
            const customerAllocations = slot.allocations.filter(
              alloc => alloc.customer.toString() === customerId
            );

            customerAllocations.forEach(allocation => {
              grainLocations.push({
                warehouseName: warehouse.name,
                warehouseId: warehouse._id,
                owner: warehouse.owner,
                location: {
                  building: building.building,
                  block: block.block,
                  slotLabel: slot.slotLabel,
                  row: slot.row,
                  col: slot.col
                },
                allocation: {
                  bags: allocation.bags,
                  grainType: allocation.grainType,
                  weight: allocation.weight,
                  entryDate: allocation.entryDate,
                  notes: allocation.notes
                },
                slotInfo: {
                  capacity: slot.capacity,
                  filledBags: slot.filledBags,
                  status: slot.status
                }
              });
            });
          });
        });
      });
    });

    // Include paid inbound grain entries that are waiting for slot allocation.
    // This keeps customer dashboard data in sync right after payment.
    const pendingVehicles = await Vehicle.find({
      paymentStatus: 'paid',
      status: { $ne: 'exited' },
      $and: [
        {
          $or: [
            { customer: customerId },
            { customerId: customerId }
          ]
        },
        {
          $or: [
            { visitPurpose: 'grain_loading' },
            { 'grainDetails.purpose': 'storage' }
          ]
        }
      ]
    }).sort({ createdAt: -1 });

    const pendingEntries = pendingVehicles.map(vehicle => {
      const bags = Number(
        vehicle?.grainDetails?.actualBags ||
        vehicle?.grainDetails?.estimatedBags ||
        vehicle?.cargo?.quantity ||
        0
      );
      const weight = Number(
        vehicle?.grainDetails?.totalWeight ||
        vehicle?.weighBridgeData?.netWeight ||
        0
      );
      const grainType = String(
        vehicle?.grainDetails?.grainType ||
        vehicle?.cargo?.description ||
        'Not specified'
      );

      return {
        _id: `pending-${vehicle._id}`,
        warehouseName: vehicle?.destination?.warehouseSection || 'Pending Warehouse Allocation',
        warehouseId: null,
        owner: null,
        location: {
          building: 'Pending',
          block: 'Pending',
          slotLabel: `PENDING-${String(vehicle.vehicleNumber || vehicle._id).slice(-6)}`,
          row: '-',
          col: '-'
        },
        allocation: {
          bags,
          grainType,
          weight,
          entryDate: vehicle?.entryTime || vehicle?.createdAt,
          notes: `Payment completed for vehicle ${vehicle?.vehicleNumber || 'N/A'}. Awaiting slot assignment.`
        },
        slotInfo: {
          capacity: bags,
          filledBags: bags,
          status: 'pending-allocation'
        },
        storageDetails: {
          items: [{
            grainType,
            quantity: bags,
            weight
          }]
        },
        status: 'pending_allocation',
        source: 'vehicle'
      };
    });

    const existingSlotLabels = new Set(
      grainLocations
        .map(item => item?.location?.slotLabel)
        .filter(Boolean)
    );

    pendingEntries.forEach(entry => {
      if (!existingSlotLabels.has(entry.location.slotLabel)) {
        grainLocations.push(entry);
      }
    });

    res.json({
      success: true,
      grainLocations: grainLocations,
      totalAllocations: grainLocations.length
    });

  } catch (error) {
    console.error('Error fetching customer grain locations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/dynamic-warehouse/layout/:id/slot-details
// @desc    Get detailed information about a specific slot
// @access  Private
router.get('/layout/:id/slot-details', auth, async (req, res) => {
  try {
    const { building, block, slotLabel } = req.query;

    const warehouse = await DynamicWarehouseLayout.findById(req.params.id).populate('layout.blocks.slots.allocations.customer', 'profile.name email');
    
    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }

    const buildingObj = warehouse.layout.find(b => b.building === building);
    const blockObj = buildingObj?.blocks.find(bl => bl.block === block);
    const slot = blockObj?.slots.find(s => s.slotLabel === slotLabel);

    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }

    res.json({
      success: true,
      slot: {
        slotLabel: slot.slotLabel,
        row: slot.row,
        col: slot.col,
        capacity: slot.capacity,
        filledBags: slot.filledBags,
        remainingCapacity: slot.capacity - slot.filledBags,
        status: slot.status,
        allocations: slot.allocations,
        building,
        block
      }
    });

  } catch (error) {
    console.error('Error fetching slot details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
