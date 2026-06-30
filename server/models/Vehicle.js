const mongoose = require('mongoose');
const TEN_DIGIT_PHONE_REGEX = /^\d{10}$/;

const vehicleSchema = new mongoose.Schema({
  vehicleNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  vehicleType: {
    type: String,
    enum: ['truck', 'mini-truck', 'tractor', 'trailer', 'container', 'van', 'other'],
    required: true
  },
  driverName: {
    type: String,
    required: true,
    trim: true
  },
  driverPhone: {
    type: String,
    required: true,
    trim: true,
    match: [TEN_DIGIT_PHONE_REGEX, 'Driver phone must be exactly 10 digits']
  },
  driverLicense: String,
  ownerName: {
    type: String,
    required: false
  },
  ownerPhone: {
    type: String,
    trim: true,
    match: [TEN_DIGIT_PHONE_REGEX, 'Owner phone must be exactly 10 digits']
  },
  capacity: {
    weight: Number, // in tons
    volume: Number  // in cubic meters
  },
  entryTime: {
    type: Date,
    default: Date.now
  },
  exitTime: Date,
  weighBridgeData: {
    grossWeight: Number,
    tareWeight: Number,
    netWeight: Number,
    firstWeighTime: Date,
    secondWeighTime: Date,
    weighBridgeOperator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  weighingStatus: {
    type: String,
    enum: ['not_started', 'partial', 'completed'],
    default: 'not_started'
  },
  status: {
    type: String,
    enum: ['entered', 'loaded', 'weighed', 'exited', 'inside'],
    default: 'entered'
  },
  visitPurpose: {
    type: String,
    enum: ['weighing_only', 'grain_loading'],
    default: 'weighing_only'
  },
  weighingOption: {
    type: String,
    enum: ['empty_now', 'loaded_now', 'will_return'],
    default: 'will_return'
  },
  // New grain-specific fields
  grainDetails: {
    grainType: {
      type: String,
      enum: ['rice', 'wheat', 'maize', 'barley', 'millet', 'sorghum'],
      default: 'rice'
    },
    isIncoming: {
      type: Boolean,
      default: true
    },
    estimatedBags: Number,
    actualBags: Number,
    avgBagWeight: {
      type: Number,
      default: 50
    },
    totalWeight: Number,
    qualityGrade: {
      type: String,
      enum: ['A', 'B', 'C'],
      default: 'A'
    },
    purpose: {
      type: String,
      enum: ['storage', 'delivery', 'pickup', 'processing'],
      default: 'storage'
    }
  },
  destination: {
    warehouseSection: String,
    customerName: String,
    customerEmail: String,
    customerPhone: {
      type: String,
      trim: true,
      match: [TEN_DIGIT_PHONE_REGEX, 'Customer phone must be exactly 10 digits']
    }
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  exitDetails: {
    exitWeight: Number,
    actualBags: Number,
    remarks: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'partial'],
      default: 'pending'
    }
  },
  entryBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  exitBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cargo: {
    description: String,
    quantity: Number,
    unit: String
  },
  documents: [{
    name: String,
    url: String,
    uploadDate: Date
  }],
  charges: {
    weighBridgeCharge: Number,
    storageCharge: Number,
    loadingCharge: Number,
    otherCharges: Number,
    total: Number
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Calculate total charges before saving
vehicleSchema.pre('save', function(next) {
  if (this.charges) {
    this.charges.total = (this.charges.weighBridgeCharge || 0) + 
                        (this.charges.storageCharge || 0) + 
                        (this.charges.loadingCharge || 0) + 
                        (this.charges.otherCharges || 0);
  }
  next();
});

module.exports = mongoose.model('Vehicle', vehicleSchema);