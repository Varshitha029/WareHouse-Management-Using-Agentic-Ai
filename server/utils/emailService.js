const nodemailer = require('nodemailer');

// Create email transporter (only if email is configured)
const createEmailTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('ℹ️ Email not configured - skipping email functionality');
    return null;
  }

  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Send payment receipt email
const sendPaymentReceipt = async (customerEmail, paymentDetails) => {
  const transporter = createEmailTransporter();
  
  if (!transporter) {
    console.log('⚠️ Email not configured - receipt not sent');
    return { success: false, message: 'Email not configured' };
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: customerEmail,
      subject: `Payment Receipt - Warehouse Management System`,
      html: `
        <h2>Payment Receipt</h2>
        <p>Dear Customer,</p>
        <p>Your payment has been processed successfully.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
          <h3>Payment Details:</h3>
          <p><strong>Payment ID:</strong> ${paymentDetails.paymentId}</p>
          <p><strong>Amount:</strong> ₹${paymentDetails.amount}</p>
          <p><strong>Method:</strong> ${paymentDetails.method.toUpperCase()}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        
        <p>Thank you for using our Warehouse Management System!</p>
        
        <hr>
        <p style="font-size: 12px; color: #666;">
          This is an automated email. Please do not reply.
        </p>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Payment receipt sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

// Send system notification email  
const sendSystemNotification = async (adminEmail, notificationData) => {
  const transporter = createEmailTransporter();
  
  if (!transporter) return { success: false, message: 'Email not configured' };

  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: adminEmail,
      subject: `System Alert - ${notificationData.title}`,
      html: `
        <h2>System Notification</h2>
        <p><strong>Alert:</strong> ${notificationData.title}</p>
        <p><strong>Message:</strong> ${notificationData.message}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        
        <p>Please check your warehouse management system for more details.</p>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Notification email failed:', error);
    return { success: false, error: error.message };
  }
};

// Send welcome email to new users
const sendWelcomeEmail = async (userEmail, userName, userRole) => {
  const transporter = createEmailTransporter();
  
  if (!transporter) return { success: false, message: 'Email not configured' };

  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: 'Welcome to Warehouse Management System',
      html: `
        <h2>Welcome to Warehouse Management System!</h2>
        <p>Hello ${userName},</p>
        
        <p>Your account has been created successfully with the role: <strong>${userRole}</strong></p>
        
        <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px;">
          <h3>Getting Started:</h3>
          <ul>
            <li>Login to your dashboard</li>
            <li>Complete your profile information</li>
            <li>Explore the features available to you</li>
          </ul>
        </div>
        
        <p>If you have any questions, please contact our support team.</p>
        
        <p>Best regards,<br>Warehouse Management System Team</p>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Welcome email failed:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPaymentReceipt,
  sendSystemNotification,
  sendWelcomeEmail
};