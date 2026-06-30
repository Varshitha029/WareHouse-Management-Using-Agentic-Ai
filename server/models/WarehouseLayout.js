const mongoose = require('mongoose');

const warehouseLayoutSchema = new mongoose.Schema({
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
  dimensions: {
    buildings: {
      type: Number,
      required: true,
      min: 1,
      max: 10
    },
    blocksPerBuilding: {
      type: Number,
      required: true,
      min: 1,
      max: 20
    },
    wingsPerBlock: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
      default: 2
    },
    sectionsPerWing: {
      type: Number,
      required: true,
      min: 1,
      max: 50,
      default: 10
    }
  },
  layout: [{
    buildingNumber: Number,
    blockNumber: Number,
    wings: {
      A: [{
        sectionNumber: Number,
        isOccupied: { type: Boolean, default: false },
        customer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        grainDetails: {
          grainType: {
            type: String,
            enum: ['rice', 'wheat', 'maize', 'barley', 'millet', 'sorghum', 'other'],
            default: 'rice'
          },
          numberOfBags: { type: Number, default: 0 },
          bagWeight: { type: Number, default: 50 }, // kg per bag
          totalWeight: { type: Number, default: 0 },
          qualityGrade: {
            type: String,
            enum: ['A', 'B', 'C'],
            default: 'A'
          }
        },
        allocatedDate: Date,
        rentDetails: {
          monthlyRentPerBag: { type: Number, default: 10 },
          totalRentPaid: { type: Number, default: 0 },
          lastPaymentDate: Date,
          dueAmount: { type: Number, default: 0 }
        },
        loanDetails: {
          loanAmount: { type: Number, default: 0 },
          interestRate: { type: Number, default: 12 }, // annual %
          loanDate: Date,
          dueDate: Date,
          repaidAmount: { type: Number, default: 0 },
          outstandingAmount: { type: Number, default: 0 }
        },
        storageType: {
          type: String,
          enum: ['dry', 'cold', 'frozen'],
          default: 'dry'
        },
        capacity: {
          maxBags: { type: Number, default: 100 },
          maxWeight: { type: Number, default: 5000 } // kg
        }
      }],
      B: [{
        sectionNumber: Number,
        isOccupied: { type: Boolean, default: false },
        customer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        grainDetails: {
          grainType: {
            type: String,
            enum: ['rice', 'wheat', 'maize', 'barley', 'millet', 'sorghum', 'other'],
            default: 'rice'
          },
          numberOfBags: { type: Number, default: 0 },
          bagWeight: { type: Number, default: 50 }, // kg per bag
          totalWeight: { type: Number, default: 0 },
          qualityGrade: {
            type: String,
            enum: ['A', 'B', 'C'],
            default: 'A'
          }
        },
        allocatedDate: Date,
        rentDetails: {
          monthlyRentPerBag: { type: Number, default: 10 },
          totalRentPaid: { type: Number, default: 0 },
          lastPaymentDate: Date,
          dueAmount: { type: Number, default: 0 }
        },
        loanDetails: {
          loanAmount: { type: Number, default: 0 },
          interestRate: { type: Number, default: 12 }, // annual %
          loanDate: Date,
          dueDate: Date,
          repaidAmount: { type: Number, default: 0 },
          outstandingAmount: { type: Number, default: 0 }
        },
        storageType: {
          type: String,
          enum: ['dry', 'cold', 'frozen'],
          default: 'dry'
        },
        capacity: {
          maxBags: { type: Number, default: 100 },
          maxWeight: { type: Number, default: 5000 } // kg
        }
      }],
      C: [{
        sectionNumber: Number,
        isOccupied: { type: Boolean, default: false },
        customer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        grainDetails: {
          grainType: {
            type: String,
            enum: ['rice', 'wheat', 'maize', 'barley', 'millet', 'sorghum', 'other'],
            default: 'rice'
          },
          numberOfBags: { type: Number, default: 0 },
          bagWeight: { type: Number, default: 50 }, // kg per bag
          totalWeight: { type: Number, default: 0 },
          qualityGrade: {
            type: String,
            enum: ['A', 'B', 'C'],
            default: 'A'
          }
        },
        allocatedDate: Date,
        rentDetails: {
          monthlyRentPerBag: { type: Number, default: 10 },
          totalRentPaid: { type: Number, default: 0 },
          lastPaymentDate: Date,
          dueAmount: { type: Number, default: 0 }
        },
        loanDetails: {
          loanAmount: { type: Number, default: 0 },
          interestRate: { type: Number, default: 12 }, // annual %
          loanDate: Date,
          dueDate: Date,
          repaidAmount: { type: Number, default: 0 },
          outstandingAmount: { type: Number, default: 0 }
        },
        storageType: {
          type: String,
          enum: ['dry', 'cold', 'frozen'],
          default: 'dry'
        },
        capacity: {
          maxBags: { type: Number, default: 100 },
          maxWeight: { type: Number, default: 5000 } // kg
        }
      }],
      D: [{
        sectionNumber: Number,
        isOccupied: { type: Boolean, default: false },
        customer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        grainDetails: {
          grainType: {
            type: String,
            enum: ['rice', 'wheat', 'maize', 'barley', 'millet', 'sorghum', 'other'],
            default: 'rice'
          },
          numberOfBags: { type: Number, default: 0 },
          bagWeight: { type: Number, default: 50 }, // kg per bag
          totalWeight: { type: Number, default: 0 },
          qualityGrade: {
            type: String,
            enum: ['A', 'B', 'C'],
            default: 'A'
          }
        },
        allocatedDate: Date,
        rentDetails: {
          monthlyRentPerBag: { type: Number, default: 10 },
          totalRentPaid: { type: Number, default: 0 },
          lastPaymentDate: Date,
          dueAmount: { type: Number, default: 0 }
        },
        loanDetails: {
          loanAmount: { type: Number, default: 0 },
          interestRate: { type: Number, default: 12 }, // annual %
          loanDate: Date,
          dueDate: Date,
          repaidAmount: { type: Number, default: 0 },
          outstandingAmount: { type: Number, default: 0 }
        },
        storageType: {
          type: String,
          enum: ['dry', 'cold', 'frozen'],
          default: 'dry'
        },
        capacity: {
          maxBags: { type: Number, default: 100 },
          maxWeight: { type: Number, default: 5000 } // kg
        }
      }]
    }
  }],
  totalCapacity: {
    sections: Number,
    maxBags: Number,
    maxWeight: Number // kg
  },
  occupiedCapacity: {
    sections: Number,
    occupiedBags: Number,
    occupiedWeight: Number // kg
  },
  settings: {
    sectionCapacity: {
      maxBags: { type: Number, default: 100 },
      maxWeight: { type: Number, default: 5000 } // kg
    },
    pricing: {
      baseRentPerBag: { type: Number, default: 10 }, // monthly rent per bag
      loanInterestRate: { type: Number, default: 12 }, // annual %
      ratePerCubicMeter: Number,
      minimumCharge: Number
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Initialize layout when dimensions change
warehouseLayoutSchema.methods.initializeLayout = function() {
  this.layout = [];
  this.totalCapacity = {
    sections: 0,
    maxBags: 0,
    maxWeight: 0
  };

  for (let building = 1; building <= this.dimensions.buildings; building++) {
    for (let block = 1; block <= this.dimensions.blocksPerBuilding; block++) {
      const layoutBlock = {
        buildingNumber: building,
        blockNumber: block,
        wings: {
          A: [],
          B: [],
          C: [],
          D: []
        }
      };

      // Each wing has sections for grain storage
      ['A', 'B', 'C', 'D'].forEach(wing => {
        for (let section = 1; section <= this.dimensions.sectionsPerWing; section++) {
          const sectionData = {
            sectionNumber: section,
            isOccupied: false,
            customer: null,
            grainDetails: {
              grainType: 'rice',
              numberOfBags: 0,
              bagWeight: 50,
              totalWeight: 0,
              qualityGrade: 'A'
            },
            allocatedDate: null,
            rentDetails: {
              monthlyRentPerBag: 10,
              totalRentPaid: 0,
              lastPaymentDate: null,
              dueAmount: 0
            },
            loanDetails: {
              loanAmount: 0,
              interestRate: 12,
              loanDate: null,
              dueDate: null,
              repaidAmount: 0,
              outstandingAmount: 0
            },
            storageType: 'dry',
            capacity: {
              maxBags: 100,
              maxWeight: 5000
            }
          };

          layoutBlock.wings[wing].push(sectionData);
          this.totalCapacity.sections += 1;
          this.totalCapacity.maxBags += 100;
          this.totalCapacity.maxWeight += 5000;
        }
      });

      this.layout.push(layoutBlock);
    }
  }
};

// Get available sections
warehouseLayoutSchema.methods.getAvailableSections = function() {
  const available = [];
  
  this.layout.forEach(block => {
    ['A', 'B', 'C', 'D'].forEach(wing => {
      block.wings[wing].forEach(section => {
        if (!section.isOccupied) {
          available.push({
            building: block.buildingNumber,
            block: block.blockNumber,
            wing,
            section: section.sectionNumber,
            capacity: section.capacity
          });
        }
      });
    });
  });
  
  return available;
};

// Update occupancy statistics
warehouseLayoutSchema.methods.updateOccupancy = function() {
  let occupiedSections = 0;
  let occupiedBags = 0;
  let occupiedWeight = 0;

  this.layout.forEach(block => {
    ['A', 'B', 'C', 'D'].forEach(wing => {
      block.wings[wing].forEach(section => {
        if (section.isOccupied) {
          occupiedSections++;
          occupiedBags += section.grainDetails.numberOfBags || 0;
          occupiedWeight += section.grainDetails.totalWeight || 0;
        }
      });
    });
  });

  this.occupiedCapacity = {
    sections: occupiedSections,
    bags: occupiedBags,
    weight: occupiedWeight
  };
};

module.exports = mongoose.model('WarehouseLayout', warehouseLayoutSchema);