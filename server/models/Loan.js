const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  interestRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100 // percentage
  },
  duration: {
    type: Number,
    required: true,
    min: 1 // in months
  },
  purpose: {
    type: String,
    required: true,
    trim: true
  },
  collateral: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'active', 'completed', 'defaulted', 'rejected'],
    default: 'pending'
  },
  disbursementDate: Date,
  dueDate: Date,
  monthlyPayment: {
    type: Number,
    default: 0
  },
  totalInterest: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  remainingAmount: {
    type: Number,
    default: 0
  },
  payments: [{
    date: {
      type: Date,
      default: Date.now
    },
    amount: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['principal', 'interest', 'penalty'],
      default: 'principal'
    },
    method: {
      type: String,
      enum: ['cash', 'upi', 'card'],
      default: 'cash'
    },
    reference: String,
    notes: String
  }],
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedDate: Date,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedDate: Date,
  rejectionReason: String
}, {
  timestamps: true
});

// Calculate loan details before saving
loanSchema.pre('save', function(next) {
  if (this.isModified('amount') || this.isModified('interestRate') || this.isModified('duration')) {
    // Calculate monthly payment using EMI formula
    const principal = this.amount;
    const monthlyRate = this.interestRate / (12 * 100);
    const numberOfPayments = this.duration;
    
    if (this.interestRate === 0) {
      this.monthlyPayment = principal / numberOfPayments;
      this.totalInterest = 0;
    } else {
      this.monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
                            (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
      this.totalInterest = (this.monthlyPayment * numberOfPayments) - principal;
    }
    
    this.totalAmount = principal + this.totalInterest;
    this.remainingAmount = this.totalAmount - this.paidAmount;
  }
  
  next();
});

// Instance method to calculate remaining balance
loanSchema.methods.getRemainingBalance = function() {
  return this.totalAmount - this.paidAmount;
};

// Instance method to check if loan is overdue
loanSchema.methods.isOverdue = function() {
  if (!this.dueDate || this.status !== 'active') return false;
  return new Date() > this.dueDate;
};

// Instance method to get next payment due date
loanSchema.methods.getNextPaymentDate = function() {
  if (!this.disbursementDate) return null;
  
  const paymentsMade = this.payments.length;
  const nextPaymentDate = new Date(this.disbursementDate);
  nextPaymentDate.setMonth(nextPaymentDate.getMonth() + paymentsMade + 1);
  
  return nextPaymentDate;
};

// Instance method to calculate days overdue
loanSchema.methods.getDaysOverdue = function() {
  if (!this.isOverdue()) return 0;
  
  const today = new Date();
  const diffTime = today - this.dueDate;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Static method to get loans summary for a customer
loanSchema.statics.getCustomerSummary = async function(customerId) {
  const loans = await this.find({ customer: customerId });
  
  return {
    totalLoans: loans.length,
    activeLoans: loans.filter(l => l.status === 'active').length,
    totalBorrowed: loans.reduce((sum, l) => sum + l.amount, 0),
    totalOwed: loans.reduce((sum, l) => sum + l.getRemainingBalance(), 0),
    overdueLoans: loans.filter(l => l.isOverdue()).length
  };
};

module.exports = mongoose.model('Loan', loanSchema);