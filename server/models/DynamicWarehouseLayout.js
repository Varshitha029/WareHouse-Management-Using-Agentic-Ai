const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  slotLabel: {
    type: String,
    required: true
  },
  row: {
    type: Number,
    required: true
  },
  col: {
    type: Number,
    required: true
  },
  capacity: {
    type: Number,
    default: 1500, // Maximum bags per slot
    required: true
  },
  filledBags: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['empty', 'partially-filled', 'full'],
    default: 'empty'
  },
  allocations: [{
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    customerName: String,
    bags: {
      type: Number,
      required: true
    },
    grainType: String,
    weight: Number,
    entryDate: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],
  isOccupied: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const blockSchema = new mongoose.Schema({
  block: {
    type: String,
    required: true
  },
  rows: {
    type: Number,
    required: true
  },
  cols: {
    type: Number,
    required: true
  },
  slots: [slotSchema]
}, { _id: false });

const buildingSchema = new mongoose.Schema({
  building: {
    type: String,
    required: true
  },
  blocks: [blockSchema]
}, { _id: false });

const dynamicWarehouseLayoutSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  location: {
    type: String,
    trim: true,
    default: 'Telangana'
  },
  configuration: {
    numberOfBuildings: {
      type: Number,
      required: true,
      min: 1,
      max: 10
    },
    blocksPerBuilding: {
      type: Number,
      required: true,
      min: 1,
      max: 26 // A-Z
    },
    rowsPerBlock: {
      type: Number,
      required: true,
      min: 1,
      max: 20
    },
    colsPerBlock: {
      type: Number,
      required: true,
      min: 1,
      max: 20
    }
  },
  layout: [buildingSchema],
  totalSlots: {
    type: Number,
    default: 0
  },
  occupiedSlots: {
    type: Number,
    default: 0
  },
  pricing: {
    rentPerQuintalPerMonth: {
      type: Number,
      default: 7,
      required: true
    },
    maintenancePerMonth: {
      type: Number,
      default: 6,
      required: true
    },
    insurancePerYear: {
      type: Number,
      default: 5,
      required: true
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Method to generate layout based on configuration
dynamicWarehouseLayoutSchema.methods.generateLayout = function() {
  const layout = [];
  const config = this.configuration;
  const blockLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  
  let globalBlockIndex = 0; // Track block index across all buildings
  
  for (let b = 1; b <= config.numberOfBuildings; b++) {
    const building = {
      building: `Building ${b}`,
      blocks: []
    };
    
    for (let bl = 0; bl < config.blocksPerBuilding; bl++) {
      const blockLabel = blockLabels[globalBlockIndex]; // Use global index for unique labels
      const block = {
        block: blockLabel,
        rows: config.rowsPerBlock,
        cols: config.colsPerBlock,
        slots: []
      };
      
      let slotNumber = 1;
      for (let r = 1; r <= config.rowsPerBlock; r++) {
        for (let c = 1; c <= config.colsPerBlock; c++) {
          block.slots.push({
            slotLabel: `${blockLabel}${slotNumber}`,
            row: r,
            col: c,
            capacity: 1500,
            filledBags: 0,
            status: 'empty',
            allocations: [],
            isOccupied: false
          });
          slotNumber++;
        }
      }
      
      building.blocks.push(block);
      globalBlockIndex++; // Increment for next block across all buildings
    }
    
    layout.push(building);
  }
  
  this.layout = layout;
  this.totalSlots = config.numberOfBuildings * config.blocksPerBuilding * 
                    config.rowsPerBlock * config.colsPerBlock;
  this.occupiedSlots = 0;
};

// Method to get occupancy statistics
dynamicWarehouseLayoutSchema.methods.getOccupancyStats = function() {
  let occupied = 0;
  
  this.layout.forEach(building => {
    building.blocks.forEach(block => {
      block.slots.forEach(slot => {
        if (slot.isOccupied) {
          occupied++;
        }
      });
    });
  });
  
  this.occupiedSlots = occupied;
  
  return {
    total: this.totalSlots,
    occupied: this.occupiedSlots,
    available: this.totalSlots - this.occupiedSlots,
    occupancyRate: ((this.occupiedSlots / this.totalSlots) * 100).toFixed(2)
  };
};

// Method to find available slot
dynamicWarehouseLayoutSchema.methods.findAvailableSlot = function() {
  for (const building of this.layout) {
    for (const block of building.blocks) {
      for (const slot of block.slots) {
        if (!slot.isOccupied) {
          return {
            building: building.building,
            block: block.block,
            slotLabel: slot.slotLabel,
            row: slot.row,
            col: slot.col
          };
        }
      }
    }
  }
  return null;
};

// Method to allocate a specific slot
dynamicWarehouseLayoutSchema.methods.allocateSlot = function(buildingName, blockLabel, slotLabel, customerId, grainDetails, allocationId) {
  const building = this.layout.find(b => b.building === buildingName);
  if (!building) {
    throw new Error('Building not found');
  }
  
  const block = building.blocks.find(bl => bl.block === blockLabel);
  if (!block) {
    throw new Error('Block not found');
  }
  
  const slot = block.slots.find(s => s.slotLabel === slotLabel);
  if (!slot) {
    throw new Error('Slot not found');
  }
  
  if (slot.isOccupied) {
    throw new Error('Slot is already occupied');
  }
  
  slot.isOccupied = true;
  slot.customer = customerId;
  slot.grainDetails = grainDetails;
  slot.allocationId = allocationId;
  
  this.occupiedSlots++;
};

// Method to deallocate a slot
dynamicWarehouseLayoutSchema.methods.deallocateSlot = function(buildingName, blockLabel, slotLabel) {
  const building = this.layout.find(b => b.building === buildingName);
  if (!building) {
    throw new Error('Building not found');
  }
  
  const block = building.blocks.find(bl => bl.block === blockLabel);
  if (!block) {
    throw new Error('Block not found');
  }
  
  const slot = block.slots.find(s => s.slotLabel === slotLabel);
  if (!slot) {
    throw new Error('Slot not found');
  }
  
  slot.isOccupied = false;
  slot.customer = undefined;
  slot.grainDetails = undefined;
  slot.allocationId = undefined;
  
  this.occupiedSlots--;
};

// Static method to calculate storage period in years, months, days
dynamicWarehouseLayoutSchema.statics.calculateStoragePeriod = function(entryDate, currentDate = new Date()) {
  const start = new Date(entryDate);
  const end = new Date(currentDate);
  
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();
  
  if (days < 0) {
    months--;
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
  }
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  return { years, months, days };
};

// Static method to calculate total storage cost
dynamicWarehouseLayoutSchema.statics.calculateStorageCost = function(weightInKg, entryDate, currentDate = new Date(), pricing) {
  const period = this.calculateStoragePeriod(entryDate, currentDate);
  const quintals = weightInKg / 100; // 1 quintal = 100 kg
  const totalMonths = (period.years * 12) + period.months + (period.days > 0 ? 1 : 0); // Round up days to full month
  const totalYears = period.years + (period.months > 0 || period.days > 0 ? 1 : 0); // Round up to full year for insurance
  
  const rentCost = pricing.rentPerQuintalPerMonth * quintals * totalMonths;
  const maintenanceCost = pricing.maintenancePerMonth * totalMonths;
  const insuranceCost = pricing.insurancePerYear * totalYears;
  
  return {
    period: `${period.years > 0 ? period.years + ' year' + (period.years > 1 ? 's' : '') + ' ' : ''}${period.months > 0 ? period.months + ' month' + (period.months > 1 ? 's' : '') + ' ' : ''}${period.days > 0 ? period.days + ' day' + (period.days > 1 ? 's' : '') : ''}`.trim(),
    periodBreakdown: period,
    quintals: quintals.toFixed(2),
    totalMonths,
    totalYears,
    rentCost: rentCost.toFixed(2),
    maintenanceCost: maintenanceCost.toFixed(2),
    insuranceCost: insuranceCost.toFixed(2),
    totalCost: (rentCost + maintenanceCost + insuranceCost).toFixed(2),
    breakdown: {
      rent: `₹${pricing.rentPerQuintalPerMonth} × ${quintals.toFixed(2)} quintals × ${totalMonths} months = ₹${rentCost.toFixed(2)}`,
      maintenance: `₹${pricing.maintenancePerMonth} × ${totalMonths} months = ₹${maintenanceCost.toFixed(2)}`,
      insurance: `₹${pricing.insurancePerYear} × ${totalYears} year(s) = ₹${insuranceCost.toFixed(2)}`
    }
  };
};

// Pre-save middleware
dynamicWarehouseLayoutSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('DynamicWarehouseLayout', dynamicWarehouseLayoutSchema);
