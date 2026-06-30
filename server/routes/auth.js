const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const TEN_DIGIT_PHONE_REGEX = /^\d{10}$/;

const signAuthToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured. Set JWT_SECRET in .env file.');
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
};

// Middleware to check MongoDB connection
const checkDbConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ 
      message: 'Database is not connected. Please install and start MongoDB, or configure MONGODB_URI in .env file.',
      hint: 'Visit https://www.mongodb.com/try/download/community to download MongoDB'
    });
  }
  next();
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', checkDbConnection, [
  body('username').trim().isLength({ min: 3, max: 50 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['owner', 'customer']),
  body('profile.firstName').trim().notEmpty(),
  body('profile.lastName').trim().notEmpty(),
  body('profile.phone')
    .trim()
    .matches(TEN_DIGIT_PHONE_REGEX)
    .withMessage('Phone number must be exactly 10 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role, profile } = req.body;

    // Check if user already exists
    let existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'User already exists with this email or username' 
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      role,
      profile
    });

    await user.save();

    // Generate JWT token
    const payload = {
      user: {
        id: user._id,
        role: user.role,
        username: user.username
      }
    };

    const token = signAuthToken(payload);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: user.profile
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', checkDbConnection, [
  body('login').trim().notEmpty(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { login, password } = req.body;

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: login },
        { username: login }
      ]
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(400).json({ message: 'Account is deactivated' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const payload = {
      user: {
        id: user._id,
        role: user.role,
        username: user.username
      }
    };

    const token = signAuthToken(payload);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: user.profile,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, [
  body('profile.firstName').optional().trim().notEmpty(),
  body('profile.lastName').optional().trim().notEmpty(),
  body('profile.phone')
    .optional({ checkFalsy: true })
    .trim()
    .matches(TEN_DIGIT_PHONE_REGEX)
    .withMessage('Phone number must be exactly 10 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findById(req.user.id);
    
    if (req.body.profile) {
      user.profile = { ...user.profile, ...req.body.profile };
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change password
// @access  Private
router.post('/change-password', auth, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/verify-token
// @desc    Verify JWT token
// @access  Private
router.post('/verify-token', auth, (req, res) => {
  res.json({ 
    valid: true, 
    user: req.user 
  });
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .matches(TEN_DIGIT_PHONE_REGEX)
    .withMessage('Phone number must be exactly 10 digits'),
  body('address').optional().trim().isLength({ max: 500 }),
  body('company').optional().trim().isLength({ max: 100 }),
  body('position').optional().trim().isLength({ max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, address, company, position } = req.body;
    const userId = req.user.id;

    // Check if email is being changed and if it already exists
    if (email) {
      const existingUser = await User.findOne({ 
        email, 
        _id: { $ne: userId } 
      });
      if (existingUser) {
        return res.status(400).json({ 
          message: 'Email already in use by another user' 
        });
      }
    }

    const updateData = {};
    if (name) updateData['profile.firstName'] = name.split(' ')[0];
    if (name && name.split(' ').length > 1) {
      updateData['profile.lastName'] = name.split(' ').slice(1).join(' ');
    }
    if (email) updateData.email = email;
    if (phone) updateData['profile.phone'] = phone;
    if (address) updateData['profile.address'] = address;
    if (company) updateData['profile.company'] = company;
    if (position) updateData['profile.position'] = position;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    // Update the name field for easy access
    if (name) {
      user.name = name;
      await user.save();
    }

    res.json(user);

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', auth, [
  body('currentPassword').optional().isLength({ min: 6 }),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If not first-time password change, verify current password
    if (!user.needsPasswordChange && currentPassword) {
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
    }

    // Update password
    user.password = newPassword;
    user.needsPasswordChange = false;
    await user.save();

    res.json({ 
      message: 'Password changed successfully',
      needsPasswordChange: false
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/owner-settings
// @desc    Get owner Razorpay / payment settings
// @access  Private (owner only)
router.get('/owner-settings', auth, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Access denied' });
    }
    const user = await User.findById(req.user.id).select('ownerSettings');
    const s = user.ownerSettings || {};
    res.json({
      razorpayKeyId:      s.razorpayKeyId      || process.env.RAZORPAY_KEY_ID    || '',
      razorpaySecretSet:  !!(s.razorpaySecret  || process.env.RAZORPAY_KEY_SECRET),
      transactionFee:     s.transactionFee     ?? 2.5,
      minPaymentAmount:   s.minPaymentAmount   ?? 1,
    });
  } catch (error) {
    console.error('owner-settings GET error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/owner-settings
// @desc    Save owner Razorpay / payment settings
// @access  Private (owner only)
router.put('/owner-settings', auth, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { razorpayKeyId, razorpaySecret, transactionFee, minPaymentAmount } = req.body;
    const user = await User.findById(req.user.id);
    if (!user.ownerSettings) user.ownerSettings = {};
    if (razorpayKeyId !== undefined)  user.ownerSettings.razorpayKeyId  = razorpayKeyId.trim();
    // Only overwrite secret if a non-empty value is supplied
    if (razorpaySecret && razorpaySecret.trim()) {
      user.ownerSettings.razorpaySecret = razorpaySecret.trim();
    }
    if (transactionFee   !== undefined) user.ownerSettings.transactionFee   = Number(transactionFee);
    if (minPaymentAmount !== undefined) user.ownerSettings.minPaymentAmount = Number(minPaymentAmount);
    user.markModified('ownerSettings');
    await user.save();
    res.json({ message: 'Settings saved successfully' });
  } catch (error) {
    console.error('owner-settings PUT error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;