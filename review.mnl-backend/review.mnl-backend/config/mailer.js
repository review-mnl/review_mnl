
const SibApiV3Sdk = require('sib-api-v3-sdk');
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const SENDER_EMAIL = process.env.SENDER_EMAIL || 'review.mnl1@gmail.com';
const SENDER_NAME = process.env.SENDER_NAME || 'REVIEW.MNL';
const FRONTEND_URL = process.env.CLIENT_URL || 'https://review-mnl.vercel.app';

const sendVerificationEmail = async (toEmail, token, name) => {
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  const link = `${FRONTEND_URL}/verifyemail.html?token=${token}`;
  const sendSmtpEmail = {
    to: [{ email: toEmail, name }],
    sender: { email: SENDER_EMAIL, name: SENDER_NAME },
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
  const link = `${FRONTEND_URL}/resetpassword.html?token=${token}`;
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

const sendCenterStatusEmail = async (toEmail, name, status) => {
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  const isApproved = status === 'approved';
  const sendSmtpEmail = {
    to: [{ email: toEmail, name }],
    sender: { email: SENDER_EMAIL, name: 'REVIEW.MNL Admin' },
    subject: `Your REVIEW.MNL Application has been ${isApproved ? 'Approved ✅' : 'Rejected ❌'}`,
    htmlContent: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #eee;border-radius:10px;">
        <h2 style="color:#0d1b2a;">Hello, ${name}!</h2>
        <p>Your application status: <strong>${status.toUpperCase()}</strong></p>
        <p>${isApproved ? 'Congratulations! Your center is now live.' : 'Sorry, your application was not approved.'}</p>
      </div>
    `,
  };
  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendCenterStatusEmail };
