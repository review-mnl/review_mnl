const nodemailer = require('nodemailer');
require('dotenv').config();

// Check if Brevo SMTP credentials are configured
const isMailConfigured = !!process.env.BREVO_SMTP_KEY;

const transporter = isMailConfigured ? nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_LOGIN || process.env.FROM_EMAIL,
    pass: process.env.BREVO_SMTP_KEY,
  },
}) : null;

const FRONTEND_URL = 'https://reviewmnl.netlify.app';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@reviewmnl.com';
const FROM_NAME = 'REVIEW.MNL';

const sendVerificationEmail = async (toEmail, token, name) => {
  if (!transporter) {
    console.error('Mail not configured: BREVO_SMTP_KEY missing');
    throw new Error('Email service not configured');
  }
  const link = `${FRONTEND_URL}/verifyemail.html?token=${token}`;
  
  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: toEmail,
    subject: 'Verify Your REVIEW.MNL Account',
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #eee;border-radius:10px;">
        <h2 style="color:#0043CF;">Hello, ${name}!</h2>
        <p>Thanks for signing up at <strong>REVIEW.MNL</strong>. Please verify your email to get started.</p>
        <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#0043CF;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
          Verify My Email
        </a>
        <p style="color:#888;font-size:12px;">This link expires in 24 hours. If you didn't create this account, ignore this email.</p>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async (toEmail, token, name) => {
  if (!transporter) {
    console.error('Mail not configured: BREVO_SMTP_KEY missing');
    throw new Error('Email service not configured');
  }
  const link = `${FRONTEND_URL}/resetpassword.html?token=${token}`;
  
  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: toEmail,
    subject: 'Reset Your REVIEW.MNL Password',
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #eee;border-radius:10px;">
        <h2 style="color:#0043CF;">Password Reset Request</h2>
        <p>Hi ${name}, we received a request to reset your REVIEW.MNL password.</p>
        <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#0043CF;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
          Reset My Password
        </a>
        <p style="color:#888;font-size:12px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
};

const sendCenterStatusEmail = async (toEmail, name, status) => {
  if (!transporter) {
    console.error('Mail not configured: BREVO_SMTP_KEY missing');
    throw new Error('Email service not configured');
  }
  const isApproved = status === 'approved';
  
  await transporter.sendMail({
    from: `"${FROM_NAME} Admin" <${FROM_EMAIL}>`,
    to: toEmail,
    subject: `Your REVIEW.MNL Application has been ${isApproved ? 'Approved' : 'Rejected'}`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #eee;border-radius:10px;">
        <h2 style="color:#0d1b2a;">Hello, ${name}!</h2>
        ${isApproved
          ? `<p>Your review center application has been <strong style="color:green;">approved</strong>. You can now log in!</p>
             <a href="${FRONTEND_URL}/login.html" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#e8c468;color:#0d1b2a;text-decoration:none;border-radius:8px;font-weight:bold;">Go to Login</a>`
          : `<p>Unfortunately, your application has been <strong style="color:red;">rejected</strong>. Please ensure your documents are valid and resubmit.</p>`
        }
        <p style="color:#888;font-size:12px;">REVIEW.MNL Team</p>
      </div>
    `,
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendCenterStatusEmail };
