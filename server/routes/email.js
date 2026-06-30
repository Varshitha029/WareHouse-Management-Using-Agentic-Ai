const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const axios = require('axios');
const User = require('../models/User');
const Loan = require('../models/Loan');

// Create SMTP transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || ''
    }
  });
};

// POST /api/email/send - Send email to customer
router.post('/send', auth, authorize('owner'), async (req, res) => {
  try {
    const { customerId, subject, body, customerEmail } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ message: 'Subject and body are required' });
    }

    let recipientEmail = customerEmail;

    // If customerId provided, fetch email from database
    if (customerId && !recipientEmail) {
      const customer = await User.findById(customerId);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      recipientEmail = customer.email;
    }

    if (!recipientEmail) {
      return res.status(400).json({ message: 'Recipient email is required' });
    }

    const transporter = createTransporter();

    const mailOptions = {
      from: `"Warehouse Management System" <${process.env.EMAIL_USER || 'noreply@warehouse.com'}>`,
      to: recipientEmail,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1976d2, #42a5f5); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">Warehouse Management System</h1>
          </div>
          <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #333;">${subject}</h2>
            <div style="color: #555; line-height: 1.6;">
              ${body.replace(/\n/g, '<br/>')}
            </div>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">
              This is an automated message from Warehouse Management System.<br/>
              Please do not reply directly to this email.
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ 
      success: true, 
      message: `Email sent successfully to ${recipientEmail}` 
    });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ 
      message: 'Failed to send email', 
      error: error.message,
      tip: 'Make sure EMAIL_USER and EMAIL_PASS are set in .env file'
    });
  }
});

// POST /api/email/send-reminder - Send payment/loan reminder
router.post('/send-reminder', auth, authorize('owner'), async (req, res) => {
  try {
    const { customerId, reminderType, amount, dueDate, description } = req.body;

    const customer = await User.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const transporter = createTransporter();

    const subjectMap = {
      loan_repayment: 'Loan Repayment Reminder',
      storage_payment: 'Storage Payment Reminder',
      general: 'Payment Reminder'
    };

    const mailOptions = {
      from: `"Warehouse Management System" <${process.env.EMAIL_USER || 'noreply@warehouse.com'}>`,
      to: customer.email,
      subject: subjectMap[reminderType] || 'Payment Reminder',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #d32f2f, #f44336); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">Payment Reminder</h1>
          </div>
          <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Dear ${customer.profile?.firstName || customer.username},</p>
            <p>${description || 'This is a reminder for your pending payment.'}</p>
            ${amount ? `<p style="font-size: 24px; color: #d32f2f; font-weight: bold;">Amount Due: ₹${amount}</p>` : ''}
            ${dueDate ? `<p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString('en-IN')}</p>` : ''}
            <p>Please make the payment at your earliest convenience to avoid any penalties.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">
              Warehouse Management System<br/>
              Contact: support@warehouse.com
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ 
      success: true, 
      message: `Reminder email sent to ${customer.email}` 
    });
  } catch (error) {
    console.error('Reminder email error:', error);
    res.status(500).json({ message: 'Failed to send reminder email', error: error.message });
  }
});

// GET /api/email/customers - Get customers list for email selection
router.get('/customers', auth, authorize('owner'), async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer', isActive: true })
      .select('username email profile')
      .sort({ 'profile.firstName': 1 });
    
    res.json({ customers });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch customers' });
  }
});

// POST /api/email/send-bulk - Send email to multiple customers
router.post('/send-bulk', auth, authorize('owner'), async (req, res) => {
  try {
    const { recipients, subject, message } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: 'Recipients are required' });
    }
    if (!subject || !message) {
      return res.status(400).json({ message: 'Subject and message are required' });
    }

    const transporter = createTransporter();
    const results = { successful: 0, failed: 0, total: recipients.length, details: [] };

    for (const recipient of recipients) {
      try {
        const mailOptions = {
          from: `"Warehouse Management System" <${process.env.EMAIL_USER || 'noreply@warehouse.com'}>`,
          to: recipient.email,
          subject: subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #1976d2, #42a5f5); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0;">${subject}</h1>
              </div>
              <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 8px 8px;">
                <p>Dear ${recipient.name || 'Customer'},</p>
                <p>${message.replace(/\n/g, '<br/>')}</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
                <p style="color: #999; font-size: 12px;">
                  Warehouse Management System<br/>
                  This is an automated notification.
                </p>
              </div>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        results.successful++;
        results.details.push({ customerName: recipient.name, email: recipient.email, success: true });
      } catch (emailErr) {
        results.failed++;
        results.details.push({ customerName: recipient.name, email: recipient.email, success: false, message: emailErr.message });
      }
    }

    res.json({
      message: `Emails sent: ${results.successful} successful, ${results.failed} failed`,
      results
    });
  } catch (error) {
    console.error('Bulk email error:', error);
    res.status(500).json({ message: 'Failed to send bulk emails', error: error.message });
  }
});

// GET /api/email/loan-due-customers - Customers with loans due within next 7 days
router.get('/loan-due-customers', auth, authorize('owner'), async (req, res) => {
  try {
    const now = new Date();
    const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const dueLoans = await Loan.find({
      status: { $in: ['active', 'approved'] },
      dueDate: { $gte: now, $lte: oneWeekLater }
    }).populate('customer', 'username email profile');

    const customers = dueLoans
      .filter(loan => loan.customer && loan.customer.email)
      .map(loan => {
        const c = loan.customer;
        const name = c.profile?.firstName
          ? `${c.profile.firstName} ${c.profile.lastName || ''}`.trim()
          : c.username;
        const daysLeft = Math.ceil((new Date(loan.dueDate) - now) / (1000 * 60 * 60 * 24));
        return {
          id: c._id,
          name,
          email: c.email,
          loanId: loan._id,
          amount: loan.amount,
          remainingAmount: loan.remainingAmount || loan.amount,
          dueDate: loan.dueDate,
          daysLeft
        };
      });

    res.json({ customers, total: customers.length });
  } catch (error) {
    console.error('loan-due-customers error:', error);
    res.status(500).json({ message: 'Failed to fetch due loan customers', error: error.message });
  }
});

// POST /api/email/ai-generate-reminder - AI-generated subject + message for loan reminders
router.post('/ai-generate-reminder', auth, authorize('owner'), async (req, res) => {
  const { loanCustomers = [] } = req.body;

  const customerLines = loanCustomers.map(c =>
    `• ${c.name}: Rs.${Number(c.remainingAmount || c.amount).toLocaleString()} due on ${new Date(c.dueDate).toLocaleDateString('en-IN')} (${c.daysLeft} day${c.daysLeft === 1 ? '' : 's'} left)`
  ).join('\n');

  const prompt = `You are an email assistant for a grain warehouse management system in India.
Write a professional, warm loan payment reminder email for the following customers whose loans are due within 7 days:

${customerLines}

Return ONLY valid JSON (no markdown, no extra text) with exactly:
{
  "subject": "concise professional subject line",
  "message": "polite 3-paragraph reminder body mentioning the 7-day window, outstanding amount context, and a request to contact if they need help. Sign off as Warehouse Management Team. Do not use placeholder names — write for a general audience."
}`;

  try {
    const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8001';
    const aiResponse = await axios.post(`${aiEngineUrl}/chat`, {
      message: prompt,
      session_id: `email-gen-${Date.now()}`
    }, { timeout: 20000 });

    const raw = aiResponse.data?.response || aiResponse.data?.message || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.subject && parsed.message) {
        return res.json({ subject: parsed.subject, message: parsed.message, source: 'ai' });
      }
    }
  } catch (err) {
    console.error('AI generate reminder error:', err.message);
  }

  // Fallback template
  const firstDue = loanCustomers[0];
  res.json({
    subject: `Loan Payment Reminder — Action Required Within ${firstDue?.daysLeft ?? 7} Days`,
    message: `Dear Customer,\n\nThis is a friendly reminder from Warehouse Management System that your loan payment is due within the next 7 days. Please ensure the outstanding amount is settled before the due date to avoid late payment penalties.\n\nIf you have already made the payment, kindly ignore this message. For any questions or to request an extension, please visit our office or contact us directly.\n\nThank you for your continued trust in our services.\n\nWarm regards,\nWarehouse Management Team`,
    source: 'template'
  });
});

module.exports = router;
