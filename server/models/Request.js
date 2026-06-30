const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['vacate_warehouse', 'loan_approval'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  // For vacate requests
  allocationDetails: {
    building: String,
    block: String,
    slotLabel: String,
    grainType: String,
    bags: Number
  },
  // For loan requests
  loanDetails: {
    requestedAmount: Number,
    purpose: String,
    duration: Number, // in months
    collateral: String
  },
  message: {
    type: String,
    required: true
  },
  rejectionReason: String,
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: Date,
  // Loan created after approval
  createdLoan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Request', requestSchema);
