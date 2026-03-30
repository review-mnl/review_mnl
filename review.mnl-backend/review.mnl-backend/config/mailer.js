const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendVerificationEmail = async (toEmail, token, name) => {
  const link = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  await transporter.sendMail({
    from: `"REVIEW.MNL" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Verify Your REVIEW.MNL Account',
    htmlContent: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #eee;border-radius:10px;">
        <h2 style="color:#0d1b2a;">Hello, ${name}! 👋</h2>
        <p>Thanks for signing up at <strong>REVIEW.MNL</strong>. Please verify your email to get started.</p>
        <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#e8c468;color:#0d1b2a;text-decoration:none;border-radius:8px;font-weight:bold;">
          Verify Email
        </a>
        <p style="color:#888;font-size:12px;">If you didn't create this account, ignore this email.</p>
      </div>
    `,
  };
  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

const sendPasswordResetEmail = async (toEmail, token, name) => {
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  const link = `${process.env.CLIENT_URL}/resetpassword.html?token=${token}`;
  const sendSmtpEmail = {
    to: [{ email: toEmail, name }],
    sender: { email: SENDER_EMAIL, name: SENDER_NAME },
    subject: 'Reset Your REVIEW.MNL Password',
    htmlContent: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #eee;border-radius:10px;">
        <h2 style="color:#0d1b2a;">Hello, ${name}!</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#e8c468;color:#0d1b2a;text-decoration:none;border-radius:8px;font-weight:bold;">
          Reset Password
        </a>
        <p style="color:#888;font-size:12px;">If you didn't request this, ignore this email.</p>
      </div>
    `,
  };
  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

const sendPasswordResetEmail = async (toEmail, token, name) => {
  const link = `${process.env.CLIENT_URL}/resetpassword.html?token=${token}`;
  await transporter.sendMail({
    from: `"REVIEW.MNL" <${process.env.MAIL_USER}>`,
    to: toEmail,
    subject: 'Reset Your REVIEW.MNL Password',
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #eee;border-radius:10px;">
        <h2 style="color:#0d1b2a;">Hello, ${name}! 🔐</h2>
        <p>We received a request to reset your <strong>REVIEW.MNL</strong> password. Click the button below to set a new password.</p>
        <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#e8c468;color:#0d1b2a;text-decoration:none;border-radius:8px;font-weight:bold;">
          Reset Password
        </a>
        <p style="color:#888;font-size:12px;">This link expires in 1 hour. If you didn't request a password reset, ignore this email.</p>
      </div>
    `,
  });
};

const sendCenterStatusEmail = async (toEmail, name, status) => {
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  const isApproved = status === 'approved';
  await transporter.sendMail({
    from: `"REVIEW.MNL Admin" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Your REVIEW.MNL Application has been ${isApproved ? 'Approved ✅' : 'Rejected ❌'}`,
    htmlContent: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #eee;border-radius:10px;">
        <h2 style="color:#0d1b2a;">Hello, ${name}!</h2>
        ${isApproved
          ? `<p>🎉 Your review center application has been <strong style="color:green;">approved</strong>. You can now log in!</p>
             <a href="${process.env.CLIENT_URL}/login" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#e8c468;color:#0d1b2a;text-decoration:none;border-radius:8px;font-weight:bold;">Go to Login</a>`
          : `<p>Unfortunately, your application has been <strong style="color:red;">rejected</strong>. Please ensure your documents are valid and resubmit.</p>`
        }
        <p style="color:#888;font-size:12px;">REVIEW.MNL Team</p>
      </div>
    `,
  };
  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

module.exports = { sendVerificationEmail, sendCenterStatusEmail };
