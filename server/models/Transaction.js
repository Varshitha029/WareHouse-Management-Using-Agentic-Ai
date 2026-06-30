const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    unique: true,
    required: true
  },
  type: {
    type: String,
    enum: ['weighbridge_fee', 'grain_storage_rent', 'grain_loan', 'loan_repayment', 'grain_release'],
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false  // Optional for weighbridge-only transactions
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  storageAllocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StorageAllocation'
  },
  weighbridgeDetails: {
    vehicleNumber: String,
    driverName: String,
    tareWeight: Number,
    grossWeight: Number,
    netWeight: Number,
    weighingFee: { type: Number, default: 100 } // Fixed fee for weighing
  },
  grainDetails: {
    grainType: {
      type: String,
      enum: ['rice', 'wheat', 'maize', 'barley', 'millet', 'sorghum', 'other']
    },
    numberOfBags: Number,
    bagWeight: Number,
    totalWeight: Number,
    qualityGrade: {
      type: String,
      enum: ['A', 'B', 'C']
    },
    moistureContent: Number,
    storageLocation: {
      building: Number,
      block: Number,
      wing: String,
      section: Number
    }
  },
  rentDetails: {
    monthlyRentPerBag: Number,
    numberOfMonths: Number,
    totalRentAmount: Number,
    paidAmount: Number,
    dueAmount: Number
  },
  loanDetails: {
    loanAmount: Number,
    interestRate: Number,
    loanDuration: Number, // months
    monthlyEMI: Number,
    repaidAmount: Number,
    outstandingAmount: Number,
    collateralBags: Number
  },
  amount: {
    baseAmount: {
      type: Number,
      required: true
    },
    tax: {
      cgst: Number,
      sgst: Number,
      igst: Number
    },
    totalAmount: {
      type: Number,
      required: true
    }
  },
  payment: {
    method: {
      type: String,
      enum: ['cash', 'upi', 'card', 'cheque'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    gatewayTransactionId: String,
    gatewayResponse: Object,
    paidAt: Date,
    upiDetails: {
      qrCode: String,
      vpa: String,
      transactionRef: String
    },
    cardDetails: {
      last4: String,
      brand: String,
      network: String
    }
  },
  invoice: {
    number: String,
    generatedAt: Date,
    pdfUrl: String,
    emailSent: Boolean,
    printedAt: Date
  },
  description: String,
  notes: String,
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  refunds: [{
    amount: Number,
    reason: String,
    processedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    refundTransactionId: String
  }]
}, {
  timestamps: true
});

// Generate unique transaction ID
transactionSchema.pre('save', async function(next) {
  if (!this.transactionId) {
    const prefix = this.type.toUpperCase().substring(0, 2);
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.transactionId = `${prefix}${timestamp}${random}`;
  }
  
  // Calculate total amount
  if (this.isModified('amount')) {
    let total = this.amount.baseAmount;
    
    // Add taxes
    if (this.amount.tax) {
      total += (this.amount.tax.cgst || 0) + 
               (this.amount.tax.sgst || 0) + 
               (this.amount.tax.igst || 0) + 
               (this.amount.tax.cess || 0);
    }
    
    // Apply discount
    if (this.amount.discount) {
      if (this.amount.discount.percentage) {
        total -= (total * this.amount.discount.percentage / 100);
      } else if (this.amount.discount.amount) {
        total -= this.amount.discount.amount;
      }
    }
    
    this.amount.totalAmount = Math.max(0, total);
  }
  
  next();
});

// Generate invoice number
transactionSchema.methods.generateInvoiceNumber = function() {
  const year = new Date().getFullYear();
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  this.invoice.number = `INV${year}${month}${random}`;
  this.invoice.generatedAt = new Date();
};

// Check if payment is overdue
transactionSchema.methods.isOverdue = function(days = 30) {
  if (this.payment.status === 'completed') return false;
  
  const dueDate = new Date(this.createdAt);
  dueDate.setDate(dueDate.getDate() + days);
  
  return new Date() > dueDate;
};

// Add refund
transactionSchema.methods.addRefund = function(amount, reason, processedBy) {
  this.refunds.push({
    amount,
    reason,
    processedAt: new Date(),
    processedBy,
    refundTransactionId: `REF${Date.now()}`
  });
  
  const totalRefunded = this.refunds.reduce((sum, refund) => sum + refund.amount, 0);
  
  if (totalRefunded >= this.amount.totalAmount) {
    this.payment.status = 'refunded';
  }
};

module.exports = mongoose.model('Transaction', transactionSchema);