const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const axios = require('axios');

// Predictions endpoint that uses the Python ML service
router.get('/grain-price/:customerId', auth, async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Get customer grain storage data
    const Transaction = require('../models/Transaction');
    const User = require('../models/User');
    
    const customer = await User.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Get storage allocation data
    const StorageAllocation = require('../models/StorageAllocation');
    const allocations = await StorageAllocation.find({ customer: customerId, isActive: true });
    
    if (allocations.length === 0) {
      return res.json({ 
        prediction: null, 
        message: 'No active storage allocations found for this customer' 
      });
    }

    // Prepare features for prediction (average across all allocations)
    const features = {
      grain_type: allocations[0].grainType || 'wheat',
      total_bags: allocations.reduce((sum, a) => sum + (a.totalBags || 0), 0),
      total_weight_kg: allocations.reduce((sum, a) => sum + (a.totalWeight || 0), 0),
      storage_duration_days: allocations.reduce((sum, a) => {
        const start = new Date(a.startDate);
        const now = new Date();
        return sum + Math.floor((now - start) / (1000 * 60 * 60 * 24));
      }, 0) / allocations.length,
      monthly_rent_per_bag: allocations[0].rentPerBag || 50,
      total_rent_paid: allocations.reduce((sum, a) => sum + (a.totalRentPaid || 0), 0),
      activity_status: 'active',
      sold_status: 'not_sold'
    };

    // Call Python ML service (dashboard_app.py should be running)
    try {
      const mlResponse = await axios.post('http://localhost:8050/api/predict/price', features, {
        timeout: 5000
      });
      
      return res.json({
        prediction: mlResponse.data.predicted_price,
        confidence: mlResponse.data.confidence,
        features: features,
        customerId: customerId
      });
    } catch (mlError) {
      console.error('ML service error:', mlError.message);
      // Fallback to simple calculation if ML service is not available
      const avgPrice = 25; // Default avg price per kg
      const predictedPrice = avgPrice + (features.storage_duration_days * 0.1);
      
      return res.json({
        prediction: predictedPrice,
        confidence: 'low',
        features: features,
        customerId: customerId,
        note: 'ML service unavailable, using fallback calculation'
      });
    }

  } catch (error) {
    console.error('Price prediction error:', error);
    res.status(500).json({ message: 'Error generating price prediction', error: error.message });
  }
});

// Profit/Loss classification
router.get('/profit-loss/:customerId', auth, async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const StorageAllocation = require('../models/StorageAllocation');
    const Transaction = require('../models/Transaction');
    
    const allocations = await StorageAllocation.find({ customer: customerId, isActive: true });
    
    if (allocations.length === 0) {
      return res.json({ 
        prediction: null, 
        message: 'No active storage allocations' 
      });
    }

    // Calculate profit/loss based on transactions
    const transactions = await Transaction.find({ customer: customerId });
    const totalRevenue = transactions
      .filter(t => t.type === 'grain_sale' || t.type === 'grain_release')
      .reduce((sum, t) => sum + (t.amount?.totalAmount || 0), 0);
    
    const totalCost = allocations.reduce((sum, a) => sum + (a.totalRentPaid || 0), 0);
    const profitLoss = totalRevenue - totalCost;

    // Prepare features
    const features = {
      grain_type: allocations[0].grainType || 'wheat',
      total_bags: allocations.reduce((sum, a) => sum + (a.totalBags || 0), 0),
      total_weight_kg: allocations.reduce((sum, a) => sum + (a.totalWeight || 0), 0),
      storage_duration_days: allocations.reduce((sum, a) => {
        const start = new Date(a.startDate);
        const now = new Date();
        return sum + Math.floor((now - start) / (1000 * 60 * 60 * 24));
      }, 0) / allocations.length,
      monthly_rent_per_bag: allocations[0].rentPerBag || 50,
      total_rent_paid: totalCost,
      activity_status: 'active'
    };

    try {
      const mlResponse = await axios.post('http://localhost:8050/api/predict/profit', features, {
        timeout: 5000
      });
      
      return res.json({
        prediction: mlResponse.data.is_profitable,
        probability: mlResponse.data.probability,
        current_profit_loss: profitLoss,
        features: features,
        customerId: customerId
      });
    } catch (mlError) {
      // Fallback classification
      const isProfitable = profitLoss > 0;
      
      return res.json({
        prediction: isProfitable,
        probability: isProfitable ? 0.7 : 0.3,
        current_profit_loss: profitLoss,
        features: features,
        customerId: customerId,
        note: 'ML service unavailable, using actual profit/loss data'
      });
    }

  } catch (error) {
    console.error('Profit/loss prediction error:', error);
    res.status(500).json({ message: 'Error generating profit/loss prediction', error: error.message });
  }
});

// Storage duration prediction
router.get('/storage-duration/:customerId', auth, async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const StorageAllocation = require('../models/StorageAllocation');
    const allocations = await StorageAllocation.find({ customer: customerId, isActive: true });
    
    if (allocations.length === 0) {
      return res.json({ 
        prediction: null, 
        message: 'No active storage allocations' 
      });
    }

    const features = {
      grain_type: allocations[0].grainType || 'wheat',
      total_bags: allocations.reduce((sum, a) => sum + (a.totalBags || 0), 0),
      total_weight_kg: allocations.reduce((sum, a) => sum + (a.totalWeight || 0), 0),
      monthly_rent_per_bag: allocations[0].rentPerBag || 50,
      activity_status: 'active'
    };

    try {
      const mlResponse = await axios.post('http://localhost:8050/api/predict/duration', features, {
        timeout: 5000
      });
      
      const currentDuration = Math.floor((new Date() - new Date(allocations[0].startDate)) / (1000 * 60 * 60 * 24));
      const predictedDuration = mlResponse.data.predicted_duration;
      const remainingDays = Math.max(0, predictedDuration - currentDuration);
      
      return res.json({
        predicted_duration: predictedDuration,
        current_duration: currentDuration,
        remaining_days: remainingDays,
        features: features,
        customerId: customerId
      });
    } catch (mlError) {
      // Fallback: average storage duration
      const avgDuration = 180; // 6 months default
      const currentDuration = Math.floor((new Date() - new Date(allocations[0].startDate)) / (1000 * 60 * 60 * 24));
      
      return res.json({
        predicted_duration: avgDuration,
        current_duration: currentDuration,
        remaining_days: Math.max(0, avgDuration - currentDuration),
        features: features,
        customerId: customerId,
        note: 'ML service unavailable, using average duration'
      });
    }

  } catch (error) {
    console.error('Duration prediction error:', error);
    res.status(500).json({ message: 'Error generating duration prediction', error: error.message });
  }
});

// Get all predictions for dashboard
router.get('/dashboard-predictions', auth, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const User = require('../models/User');
    const StorageAllocation = require('../models/StorageAllocation');
    
    // Get all active customers with storage
    const activeAllocations = await StorageAllocation.find({ isActive: true })
      .populate('customer', 'username email profile')
      .limit(50);

    const predictions = [];
    const alerts = [];
    
    // Return empty data if no allocations found
    if (!activeAllocations || activeAllocations.length === 0) {
      return res.json({
        predictions: [],
        alerts: [],
        totalCustomers: 0,
        profitableCount: 0,
        atRiskCount: 0,
        message: 'No active storage allocations found'
      });
    }

    for (const allocation of activeAllocations) {
      try {
        if (!allocation.customer) continue;

        const customerId = allocation.customer._id;
        
        // Simple profit/loss estimation
        const totalCost = allocation.totalRentPaid || 0;
        const avgPrice = 25; // ₹25/kg average
        const estimatedRevenue = (allocation.totalWeight || 0) * avgPrice;
        const profitLoss = estimatedRevenue - totalCost;
        const isProfitable = profitLoss > 0;
        
        // Safely get customer name
        let customerName = 'Unknown Customer';
        if (allocation.customer.profile) {
          const firstName = allocation.customer.profile.firstName || '';
          const lastName = allocation.customer.profile.lastName || '';
          customerName = `${firstName} ${lastName}`.trim() || allocation.customer.username || customerName;
        } else if (allocation.customer.username) {
          customerName = allocation.customer.username;
        }

        predictions.push({
          customerId: customerId,
          customerName: customerName,
          email: allocation.customer.email || 'N/A',
          grainType: allocation.grainType || 'Unknown',
          totalBags: allocation.totalBags || 0,
          totalWeight: allocation.totalWeight || 0,
          storageDuration: Math.floor((new Date() - new Date(allocation.startDate)) / (1000 * 60 * 60 * 24)),
          predictedPrice: avgPrice + ((allocation.totalBags || 0) * 0.01),
          isProfitable: isProfitable,
          profitLoss: profitLoss,
          totalRentPaid: totalCost
        });

        // Generate alerts for at-risk customers
        if (!isProfitable && totalCost > 5000) {
          alerts.push({
            type: 'warning',
            severity: 'high',
            title: 'Potential Loss Alert',
            message: `Customer ${customerName} may incur losses. Current estimated loss: ₹${Math.abs(profitLoss).toFixed(2)}`,
            customerId: customerId,
            customerName: customerName,
            timestamp: new Date()
          });
        }

        // Alert for long storage duration
        const duration = Math.floor((new Date() - new Date(allocation.startDate)) / (1000 * 60 * 60 * 24));
        if (duration > 180) {
          alerts.push({
            type: 'info',
            severity: 'medium',
            title: 'Long Storage Duration',
            message: `Customer ${customerName} has stored grain for ${duration} days`,
            customerId: customerId,
            customerName: customerName,
            timestamp: new Date()
          });
        }
      } catch (innerError) {
        console.error('Error processing allocation:', innerError.message);
        continue;
      }
    }

    res.json({
      predictions: predictions.slice(0, 20), // Top 20
      alerts: alerts,
      totalCustomers: activeAllocations.length,
      profitableCount: predictions.filter(p => p.isProfitable).length,
      atRiskCount: predictions.filter(p => !p.isProfitable).length
    });

  } catch (error) {
    console.error('Dashboard predictions error:', error);
    res.status(500).json({ message: 'Error generating dashboard predictions', error: error.message });
  }
});

// Market trend alerts
router.get('/market-alerts', auth, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Simulated market alerts (in production, this would come from real market data)
    const alerts = [
      {
        type: 'market',
        severity: 'high',
        title: 'Wheat Price Declining',
        message: 'Wheat prices have dropped 5% in the last week. Consider alerting customers holding wheat to sell soon.',
        grain: 'wheat',
        priceChange: -5,
        timestamp: new Date()
      },
      {
        type: 'market',
        severity: 'medium',
        title: 'Rice Demand Increasing',
        message: 'Rice demand is up 8%. Good time for rice sales.',
        grain: 'rice',
        priceChange: 8,
        timestamp: new Date()
      }
    ];

    res.json({ alerts });

  } catch (error) {
    console.error('Market alerts error:', error);
    res.status(500).json({ message: 'Error fetching market alerts', error: error.message });
  }
});

// @route   POST /api/predictions/grain-prices
// @desc    Get ML predictions for customer's stored grains
// @access  Private (Customer)
router.post('/grain-prices', auth, async (req, res) => {
  try {
    const { grains } = req.body;
    
    if (!grains || !Array.isArray(grains) || grains.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Grains array is required' 
      });
    }

    const predictions = [];
    
    // Generate predictions for each grain type
    for (const grain of grains) {
      const { type, weight, storageDuration } = grain;
      
      // Mock ML prediction logic (replace with actual ML service call)
      // In production, this would call the Python ML service
      const basePrice = getBasePrice(type);
      const priceFactor = calculatePriceFactor(storageDuration);
      const predictedPrice = Math.round(basePrice * priceFactor);
      const currentPrice = basePrice;
      const priceChange = ((predictedPrice - currentPrice) / currentPrice * 100).toFixed(2);
      
      // Recommendation logic
      let recommendation = 'hold';
      if (priceChange > 5) recommendation = 'wait';
      if (priceChange > -5 && priceChange <= 5) recommendation = 'hold';
      if (priceChange < -5 || storageDuration > 120) recommendation = 'sell_now';
      
      // Confidence calculation
      const confidence = storageDuration < 30 ? 0.9 : storageDuration < 90 ? 0.75 : 0.6;
      
      predictions.push({
        grainType: type,
        currentPrice,
        predictedPrice,
        priceChange: parseFloat(priceChange),
        recommendation,
        confidence,
        storageDays: storageDuration,
        optimalSellDate: calculateOptimalSellDate(storageDuration, priceChange)
      });
    }

    res.json({
      success: true,
      predictions
    });

  } catch (error) {
    console.error('Error generating grain price predictions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error generating predictions', 
      error: error.message 
    });
  }
});

// Helper functions for prediction
function getBasePrice(grainType) {
  const prices = {
    'Rice': 3200,
    'Wheat': 2500,
    'Corn': 1800,
    'Barley': 2200,
    'Sorghum': 2000,
    'Millet': 1900,
    'Maize': 1800,
    'Pulses': 4500
  };
  
  // Find case-insensitive match
  const matchedType = Object.keys(prices).find(
    key => key.toLowerCase() === grainType?.toLowerCase()
  );
  
  return prices[matchedType] || 2000; // Default price
}

function calculatePriceFactor(storageDuration) {
  // Price typically increases for first 60 days, then stabilizes or decreases
  if (storageDuration < 30) return 1.02; // 2% increase expected
  if (storageDuration < 60) return 1.05; // 5% increase expected
  if (storageDuration < 90) return 1.03; // 3% increase
  if (storageDuration < 120) return 1.0; // Stable
  return 0.97; // Slight decrease due to quality degradation
}

function calculateOptimalSellDate(storageDuration, priceChange) {
  if (priceChange > 5) {
    // Price is expected to rise, wait 30 days
    const optimalDate = new Date();
    optimalDate.setDate(optimalDate.getDate() + 30);
    return optimalDate.toISOString().split('T')[0];
  } else if (priceChange < -5) {
    // Price is falling, sell immediately
    return new Date().toISOString().split('T')[0];
  } else {
    // Stable price, sell within 15 days
    const optimalDate = new Date();
    optimalDate.setDate(optimalDate.getDate() + 15);
    return optimalDate.toISOString().split('T')[0];
  }
}

module.exports = router;

