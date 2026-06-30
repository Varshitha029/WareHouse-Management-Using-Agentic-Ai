const mongoose = require('mongoose');

const storageAllocationSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WarehouseLayout',
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  allocation: {
    building: {
      type: Number,
      required: true
    },
    block: {
      type: Number,
      required: true
    },
    wing: {
      type: String,
      enum: ['left', 'right'],
      required: true
    },
    box: {
      type: Number,
      required: true
    }
  },
  storageDetails: {
    type: {
      type: String,
      enum: ['dry', 'cold', 'frozen', 'hazardous'],
      default: 'dry'
    },
    items: [{
      description: String,
      quantity: Number,
      weight: Number,
      value: Number,
      entryDate: { type: Date, default: Date.now },
      expiryDate: Date
    }],
    totalWeight: Number,
    totalVolume: Number,
    totalValue: Number
  },
  duration: {
    startDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    endDate: Date,
    extendedDate: Date,
    actualEndDate: Date
  },
  pricing: {
    baseRate: Number,
    ratePerDay: Number,
    ratePerKg: Number,
    minimumCharge: Number,
    totalCalculated: Number,
    discounts: [{
      type: String,
      amount: Number,
      percentage: Number,
      reason: String
    }],
    finalAmount: Number
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'terminated', 'completed'],
    default: 'active'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue'],
    default: 'pending'
  },
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadDate: Date
  }],
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Calculate pricing before saving
storageAllocationSchema.pre('save', function(next) {
  if (this.isModified('storageDetails') || this.isModified('duration') || this.isModified('pricing')) {
    this.calculatePricing();
  }
  next();
});

// Method to calculate pricing
storageAllocationSchema.methods.calculatePricing = function() {
  const days = this.getDaysStored();
  const weight = this.storageDetails.totalWeight || 0;
  
  let totalAmount = 0;
  
  // Base rate calculation
  if (this.pricing.baseRate) {
    totalAmount += this.pricing.baseRate;
  }
  
  // Daily rate calculation
  if (this.pricing.ratePerDay) {
    totalAmount += this.pricing.ratePerDay * days;
  }
  
  // Weight-based calculation
  if (this.pricing.ratePerKg && weight > 0) {
    totalAmount += this.pricing.ratePerKg * weight;
  }
  
  // Apply minimum charge
  if (this.pricing.minimumCharge && totalAmount < this.pricing.minimumCharge) {
    totalAmount = this.pricing.minimumCharge;
  }
  
  this.pricing.totalCalculated = totalAmount;
  
  // Apply discounts
  let finalAmount = totalAmount;
  if (this.pricing.discounts && this.pricing.discounts.length > 0) {
    this.pricing.discounts.forEach(discount => {
      if (discount.percentage) {
        finalAmount -= (finalAmount * discount.percentage / 100);
      } else if (discount.amount) {
        finalAmount -= discount.amount;
      }
    });
  }
  
  this.pricing.finalAmount = Math.max(0, finalAmount);
};

// Get number of days stored
storageAllocationSchema.methods.getDaysStored = function() {
  const endDate = this.duration.actualEndDate || 
                  this.duration.extendedDate || 
                  this.duration.endDate || 
                  new Date();
  
  const startDate = this.duration.startDate;
  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

// Check if storage is expired
storageAllocationSchema.methods.isExpired = function() {
  const currentDate = new Date();
  const expiryDate = this.duration.extendedDate || this.duration.endDate;
  
  return expiryDate && currentDate > expiryDate;
};

// Get remaining days
storageAllocationSchema.methods.getRemainingDays = function() {
  const currentDate = new Date();
  const expiryDate = this.duration.extendedDate || this.duration.endDate;
  
  if (!expiryDate) return null;
  
  const diffTime = expiryDate - currentDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : 0;
};

module.exports = mongoose.model('StorageAllocation', storageAllocationSchema);