/**
 * SMS Service Utility
 * 
 * This module provides SMS sending functionality.
 * Currently configured for demonstration - integrate with Twilio, AWS SNS, or other SMS provider.
 */

/**
 * Send SMS to a single recipient
 * @param {string} phoneNumber - Recipient phone number (with country code)
 * @param {string} message - SMS message content
 * @returns {Promise<Object>} - Result object with success status
 */
const sendSMS = async (phoneNumber, message) => {
  try {
    // Validate inputs
    if (!phoneNumber || !message) {
      throw new Error('Phone number and message are required');
    }

    // Format phone number (ensure it starts with +91 for India)
    const formattedPhone = phoneNumber.startsWith('+') 
      ? phoneNumber 
      : `+91${phoneNumber}`;

    // Log SMS for demonstration
    console.log('\n=== SMS SENT ===');
    console.log('To:', formattedPhone);
    console.log('Message:', message);
    console.log('Timestamp:', new Date().toLocaleString());
    console.log('================\n');

    /**
     * TODO: Integrate with actual SMS service provider
     * 
     * Example integrations:
     * 
     * 1. Twilio:
     * const twilio = require('twilio');
     * const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
     * await client.messages.create({
     *   body: message,
     *   from: process.env.TWILIO_PHONE_NUMBER,
     *   to: formattedPhone
     * });
     * 
     * 2. AWS SNS:
     * const AWS = require('aws-sdk');
     * const sns = new AWS.SNS();
     * await sns.publish({
     *   Message: message,
     *   PhoneNumber: formattedPhone
     * }).promise();
     * 
     * 3. MSG91 (Popular in India):
     * const axios = require('axios');
     * await axios.post('https://api.msg91.com/api/v5/flow/', {
     *   authkey: process.env.MSG91_API_KEY,
     *   mobiles: formattedPhone,
     *   message: message
     * });
     */

    return {
      success: true,
      message: 'SMS sent successfully (demonstration mode)',
      recipient: formattedPhone,
      timestamp: new Date()
    };

  } catch (error) {
    console.error('SMS sending error:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};

/**
 * Send SMS to multiple recipients
 * @param {Array<Object>} recipients - Array of {phone, message} objects
 * @returns {Promise<Object>} - Results summary
 */
const sendBulkSMS = async (recipients) => {
  try {
    const results = {
      total: recipients.length,
      successful: 0,
      failed: 0,
      details: []
    };

    for (const recipient of recipients) {
      const result = await sendSMS(recipient.phone, recipient.message);
      
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
      }
      
      results.details.push({
        phone: recipient.phone,
        success: result.success,
        message: result.message
      });
    }

    return results;

  } catch (error) {
    console.error('Bulk SMS sending error:', error);
    throw error;
  }
};

/**
 * Send alert notification via SMS
 * @param {Object} customer - Customer object with profile.phone
 * @param {string} alertType - Type of alert (critical/warning/info)
 * @param {string} alertMessage - Alert message content
 * @returns {Promise<Object>} - Result object
 */
const sendAlertSMS = async (customer, alertType, alertMessage) => {
  try {
    const phoneNumber = customer.profile?.phone;
    
    if (!phoneNumber) {
      throw new Error('Customer phone number not available');
    }

    // Format message with warehouse branding
    const formattedMessage = `
[WMS Alert - ${alertType.toUpperCase()}]
Dear ${customer.profile?.firstName || 'Customer'},
${alertMessage}

Contact us for assistance.
- Warehouse Management System
    `.trim();

    return await sendSMS(phoneNumber, formattedMessage);

  } catch (error) {
    console.error('Alert SMS sending error:', error);
    throw error;
  }
};

module.exports = {
  sendSMS,
  sendBulkSMS,
  sendAlertSMS
};
