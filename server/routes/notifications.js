const express = require('express');
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');
const User = require('../models/User');

const router = express.Router();

const defaultPreferences = {
  email: true,
  sms: false,
  push: true,
  paymentReminders: true,
  loanAlerts: true,
  grainExpiry: true,
  priceAlerts: true,
  general: true
};

router.get('/my-notifications', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to update notification' });
  }
});

router.put('/mark-all-read', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Failed to update notifications' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const deleted = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Failed to delete notification' });
  }
});

router.get('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('notificationPreferences');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ ...defaultPreferences, ...(user.notificationPreferences || {}) });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ message: 'Failed to fetch preferences' });
  }
});

router.put('/preferences', auth, async (req, res) => {
  try {
    const payload = req.body || {};
    const preferences = {
      ...defaultPreferences,
      ...Object.fromEntries(
        Object.entries(payload).map(([key, value]) => [key, Boolean(value)])
      )
    };

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { notificationPreferences: preferences },
      { new: true, runValidators: true }
    ).select('notificationPreferences');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.notificationPreferences || defaultPreferences);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ message: 'Failed to update preferences' });
  }
});

module.exports = router;
