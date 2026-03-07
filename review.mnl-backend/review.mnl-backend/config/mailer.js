const { Resend } = require('resend');
require('dotenv').config();

// Check if Resend API key is configured
const isMailConfigured = !!process.env.RESEND_API_KEY;
const resend = isMailConfigured ? new Resend(process.env.RESEND_API_KEY) : null;

const FRONTEND_URL = 'https://reviewmnl.netlify.app';
// Use Resend's test domain or your verified domain
const FROM_EMAIL = process.env.FROM_EMAIL || 'REVIEW.MNL <onboarding@resend.dev>';

const sendVerificationEmail = async (toEmail, token, name) => {
  if (!resend) {
    console.error('Mail not configured: RESEND_API_KEY missing');
    throw new Error('Email service not configured');
  }
  const link = `${FRONTEND_URL}/verifyemail.html?token=${token}`;
  await resend.emails.send({
    from: FROM_EMAIL,
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
  if (!resend) {
    console.error('Mail not configured: RESEND_API_KEY missing');
    throw new Error('Email service not configured');
  }
  const link = `${FRONTEND_URL}/resetpassword.html?token=${token}`;
  await resend.emails.send({
    from: FROM_EMAIL,
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
  if (!resend) {
    console.error('Mail not configured: RESEND_API_KEY missing');
    throw new Error('Email service not configured');
  }
  const isApproved = status === 'approved';
  await resend.emails.send({
    from: FROM_EMAIL,
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
