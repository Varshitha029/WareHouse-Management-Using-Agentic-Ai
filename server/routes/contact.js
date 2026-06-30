const express = require('express');
const router = express.Router();
const emailService = require('../utils/emailService');
const TEN_DIGIT_PHONE_REGEX = /^\d{10}$/;

// @route   POST /api/contact/customer-message
// @desc    Send message from customer to owner
// @access  Public
router.post('/customer-message', async (req, res) => {
    try {
        const { customerName, customerEmail, phone, message, subject } = req.body;

        // Validation
        if (!customerName || !customerEmail || !message) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and message are required'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        if (phone && !TEN_DIGIT_PHONE_REGEX.test(phone.trim())) {
            return res.status(400).json({
                success: false,
                message: 'Phone number must be exactly 10 digits'
            });
        }

        // Send email
        const result = await emailService.sendCustomerMessage(
            customerEmail,
            customerName,
            message,
            phone
        );

        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Your message has been sent successfully. We will get back to you soon.'
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.message || 'Failed to send message. Please try again.'
            });
        }

    } catch (error) {
        console.error('Customer message error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
});

// @route   POST /api/contact/send-receipt
// @desc    Send payment receipt via email
// @access  Private (used internally)
router.post('/send-receipt', async (req, res) => {
    try {
        const { customerEmail, paymentData } = req.body;

        if (!customerEmail || !paymentData) {
            return res.status(400).json({
                success: false,
                message: 'Customer email and payment data are required'
            });
        }

        const result = await emailService.sendPaymentReceipt(customerEmail, paymentData);

        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Receipt sent successfully',
                messageId: result.messageId
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.message || 'Failed to send receipt'
            });
        }

    } catch (error) {
        console.error('Receipt sending error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/contact/notify-owner
// @desc    Send notification to owner
// @access  Private (used internally)
router.post('/notify-owner', async (req, res) => {
    try {
        const { subject, message, customerData } = req.body;

        if (!subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Subject and message are required'
            });
        }

        const result = await emailService.notifyOwner(subject, message, customerData || {});

        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Notification sent successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.message || 'Failed to send notification'
            });
        }

    } catch (error) {
        console.error('Owner notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;