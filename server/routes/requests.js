const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Request = require('../models/Request');
const DynamicWarehouseLayout = require('../models/DynamicWarehouseLayout');
const Loan = require('../models/Loan');
const User = require('../models/User');
const StorageAllocation = require('../models/StorageAllocation');
const Vehicle = require('../models/Vehicle');

const getOwnerCustomerIds = async (ownerId) => {
  const [allocationCustomers, vehicleCustomers, loanCustomers] = await Promise.all([
    StorageAllocation.distinct('customer', { owner: ownerId }),
    Vehicle.distinct('customer', { owner: ownerId, customer: { $ne: null } }),
    Loan.distinct('customer', { createdBy: ownerId })
  ]);

  return [...new Set([
    ...allocationCustomers.map(String),
    ...vehicleCustomers.map(String),
    ...loanCustomers.map(String)
  ])];
};

// Customer: Create a new request
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ message: 'Only customers can create requests' });
    }

    const { type, message, allocationDetails, loanDetails } = req.body;

    const request = new Request({
      customer: req.user.id,
      type,
      message,
      allocationDetails,
      loanDetails
    });

    await request.save();
    await request.populate('customer', 'username email profile');

    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ message: 'Failed to create request', error: error.message });
  }
});

// Customer: Get my requests
router.get('/my-requests', auth, async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ message: 'Only customers can view their requests' });
    }

    const requests = await Request.find({ customer: req.user.id })
      .populate('processedBy', 'name')
      .populate('createdLoan')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Failed to fetch requests', error: error.message });
  }
});

// Owner: Get all pending requests
router.get('/pending', auth, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owners can view requests' });
    }

    const ownerCustomerIds = await getOwnerCustomerIds(req.user.id);

    const requests = await Request.find({
      status: 'pending',
      customer: { $in: ownerCustomerIds }
    })
      .populate('customer', 'username email profile')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ message: 'Failed to fetch requests', error: error.message });
  }
});

// Owner: Get all requests (with filter options)
router.get('/all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owners can view all requests' });
    }

    const { status, type } = req.query;
    const ownerCustomerIds = await getOwnerCustomerIds(req.user.id);
    const filter = { customer: { $in: ownerCustomerIds } };
    
    if (status) filter.status = status;
    if (type) filter.type = type;

    const requests = await Request.find(filter)
      .populate('customer', 'username email profile')
      .populate('processedBy', 'username')
      .populate('createdLoan')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Failed to fetch requests', error: error.message });
  }
});

// Owner: Approve/Reject request
router.put('/:requestId/process', auth, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owners can process requests' });
    }

    const { requestId } = req.params;
    const { action, rejectionReason, loanData } = req.body;

    const ownerCustomerIds = await getOwnerCustomerIds(req.user.id);

    const request = await Request.findById(requestId).populate('customer', 'username email profile');
    
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (!ownerCustomerIds.includes(request.customer._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    if (action === 'approve') {
      request.status = 'approved';
      request.processedBy = req.user.id;
      request.processedAt = new Date();

      // Handle vacate warehouse request
      if (request.type === 'vacate_warehouse') {
        const { building, block, slotLabel } = request.allocationDetails;

        const layout = await DynamicWarehouseLayout.findOne({
          owner: req.user.id,
          'layout.blocks.slots.allocations.customer': request.customer._id
        });

        if (layout) {
          let changed = false;
          for (const buildingItem of layout.layout) {
            for (const blockItem of buildingItem.blocks) {
              for (const slot of blockItem.slots) {
                const isTargetLocation =
                  (!building || String(buildingItem.building) === String(building)) &&
                  (!block || String(blockItem.block) === String(block)) &&
                  (!slotLabel || String(slot.slotLabel) === String(slotLabel));

                if (!isTargetLocation) continue;

                const originalLength = slot.allocations.length;
                slot.allocations = slot.allocations.filter(
                  (allocation) => allocation.customer.toString() !== request.customer._id.toString()
                );

                if (slot.allocations.length !== originalLength) {
                  slot.filledBags = slot.allocations.reduce((sum, allocation) => sum + (allocation.bags || 0), 0);
                  slot.isOccupied = slot.allocations.length > 0;

                  if (slot.filledBags <= 0) {
                    slot.status = 'empty';
                  } else if (slot.filledBags >= slot.capacity) {
                    slot.status = 'full';
                  } else {
                    slot.status = 'partially-filled';
                  }
                  changed = true;
                }
              }
            }
          }

          if (changed) {
            await layout.save();
          }
        }
      }

      // Handle loan approval request
      if (request.type === 'loan_approval' && loanData) {
        const loan = new Loan({
          customer: request.customer._id,
          amount: loanData.amount,
          interestRate: loanData.interestRate,
          duration: loanData.duration,
          purpose: request.loanDetails?.purpose || request.message || 'Loan request',
          collateral: loanData.collateral || request.loanDetails?.collateral || 'Not specified',
          status: 'active',
          disbursementDate: loanData.startDate ? new Date(loanData.startDate) : new Date(),
          dueDate: loanData.endDate ? new Date(loanData.endDate) : new Date(Date.now() + loanData.duration * 30 * 24 * 60 * 60 * 1000),
          createdBy: req.user.id,
          approvedBy: req.user.id,
          approvedDate: new Date()
        });

        await loan.save();
        request.createdLoan = loan._id;
        
        // Send real-time notification to customer
        if (req.io) {
          req.io.emit('loan_approved', {
            customerId: request.customer._id.toString(),
            customerName: request.customer.name,
            loanAmount: loanData.amount,
            interestRate: loanData.interestRate,
            duration: loanData.duration,
            startDate: loanData.startDate,
            endDate: loanData.endDate,
            monthlyEMI: loan.monthlyPayment,
            timestamp: new Date()
          });
        }
      }

      await request.save();
      await request.populate('createdLoan');

      res.json({ 
        message: 'Request approved successfully', 
        request,
        loan: request.createdLoan 
      });
    } else if (action === 'reject') {
      request.status = 'rejected';
      request.rejectionReason = rejectionReason || 'No reason provided';
      request.processedBy = req.user.id;
      request.processedAt = new Date();

      await request.save();

      res.json({ message: 'Request rejected', request });
    } else {
      res.status(400).json({ message: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ message: 'Failed to process request', error: error.message });
  }
});

module.exports = router;
