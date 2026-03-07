const SibApiV3Sdk = require('@getbrevo/brevo');
require('dotenv').config();

// Check if Brevo API key is configured
const isMailConfigured = !!process.env.BREVO_API_KEY;

let apiInstance = null;
if (isMailConfigured) {
  apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
}

const FRONTEND_URL = 'https://reviewmnl.netlify.app';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@reviewmnl.com';
const FROM_NAME = 'REVIEW.MNL';

const sendVerificationEmail = async (toEmail, token, name) => {
  if (!apiInstance) {
    console.error('Mail not configured: BREVO_API_KEY missing');
    throw new Error('Email service not configured');
  }
  const link = `${FRONTEND_URL}/verifyemail.html?token=${token}`;
  
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = 'Verify Your REVIEW.MNL Account';
  sendSmtpEmail.htmlContent = `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #eee;border-radius:10px;">
      <h2 style="color:#0043CF;">Hello, ${name}!</h2>
      <p>Thanks for signing up at <strong>REVIEW.MNL</strong>. Please verify your email to get started.</p>
      <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#0043CF;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
        Verify My Email
      </a>
      <p style="color:#888;font-size:12px;">This link expires in 24 hours. If you didn't create this account, ignore this email.</p>
    </div>
  `;
  sendSmtpEmail.sender = { name: FROM_NAME, email: FROM_EMAIL };
  sendSmtpEmail.to = [{ email: toEmail, name: name }];

  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

const sendPasswordResetEmail = async (toEmail, token, name) => {
  if (!apiInstance) {
    console.error('Mail not configured: BREVO_API_KEY missing');
    throw new Error('Email service not configured');
  }
  const link = `${FRONTEND_URL}/resetpassword.html?token=${token}`;
  
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = 'Reset Your REVIEW.MNL Password';
  sendSmtpEmail.htmlContent = `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #eee;border-radius:10px;">
      <h2 style="color:#0043CF;">Password Reset Request</h2>
      <p>Hi ${name}, we received a request to reset your REVIEW.MNL password.</p>
      <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#0043CF;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
        Reset My Password
      </a>
      <p style="color:#888;font-size:12px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    </div>
  `;
  sendSmtpEmail.sender = { name: FROM_NAME, email: FROM_EMAIL };
  sendSmtpEmail.to = [{ email: toEmail, name: name }];

  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

const sendCenterStatusEmail = async (toEmail, name, status) => {
  if (!apiInstance) {
    console.error('Mail not configured: BREVO_API_KEY missing');
    throw new Error('Email service not configured');
  }
  const isApproved = status === 'approved';
  
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = `Your REVIEW.MNL Application has been ${isApproved ? 'Approved' : 'Rejected'}`;
  sendSmtpEmail.htmlContent = `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #eee;border-radius:10px;">
      <h2 style="color:#0d1b2a;">Hello, ${name}!</h2>
      ${isApproved
        ? `<p>Your review center application has been <strong style="color:green;">approved</strong>. You can now log in!</p>
           <a href="${FRONTEND_URL}/login.html" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#e8c468;color:#0d1b2a;text-decoration:none;border-radius:8px;font-weight:bold;">Go to Login</a>`
        : `<p>Unfortunately, your application has been <strong style="color:red;">rejected</strong>. Please ensure your documents are valid and resubmit.</p>`
      }
      <p style="color:#888;font-size:12px;">REVIEW.MNL Team</p>
    </div>
  `;
  sendSmtpEmail.sender = { name: `${FROM_NAME} Admin`, email: FROM_EMAIL };
  sendSmtpEmail.to = [{ email: toEmail, name: name }];

  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendCenterStatusEmail };
