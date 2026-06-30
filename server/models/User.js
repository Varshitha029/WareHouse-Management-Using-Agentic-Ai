const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const TEN_DIGIT_PHONE_REGEX = /^\d{10}$/;

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['owner', 'customer', 'admin'],
    default: 'customer'
  },
  profile: {
    firstName: String,
    lastName: String,
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [TEN_DIGIT_PHONE_REGEX, 'Phone number must be exactly 10 digits']
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: 'India' }
    },
    avatar: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  needsPasswordChange: {
    type: Boolean,
    default: false
  },
  preferredLanguage: {
    type: String,
    enum: ['en', 'te', 'hi', 'ta', 'kn', 'ur'],
    default: 'en'
  },
  notificationPreferences: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: true },
    paymentReminders: { type: Boolean, default: true },
    loanAlerts: { type: Boolean, default: true },
    grainExpiry: { type: Boolean, default: true },
    priceAlerts: { type: Boolean, default: true },
    general: { type: Boolean, default: true }
  },
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastLogin: Date,
  // Owner payment gateway settings
  ownerSettings: {
    razorpayKeyId:      { type: String, default: '' },
    razorpaySecret:     { type: String, default: '' },
    transactionFee:     { type: Number, default: 2.5 },
    minPaymentAmount:   { type: Number, default: 1 },
  },
  // Customer-specific fields for grain storage
  customerGrainDetails: {
    totalBagsStored: { type: Number, default: 0 },
    totalRentPaid: { type: Number, default: 0 },
    totalLoanTaken: { type: Number, default: 0 },
    totalLoanRepaid: { type: Number, default: 0 },
    outstandingRent: { type: Number, default: 0 },
    outstandingLoan: { type: Number, default: 0 },
    storageHistory: [{
      date: { type: Date, default: Date.now },
      grainType: String,
      numberOfBags: Number,
      qualityGrade: String,
      storageLocation: {
        building: Number,
        block: Number,
        wing: String,
        section: Number
      },
      isActive: { type: Boolean, default: true }
    }],
    paymentHistory: [{
      date: { type: Date, default: Date.now },
      type: { type: String, enum: ['rent', 'loan', 'weighbridge'], default: 'rent' },
      amount: Number,
      description: String,
      transactionId: String
    }]
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.verificationToken;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpires;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);