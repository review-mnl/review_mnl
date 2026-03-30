const { MailerSend, EmailParams, Sender, Recipient } = require('mailersend');
const mailerSend = new MailerSend({ apiKey: process.env.MAILERSEND_API_TOKEN });

const sendVerificationEmail = async (toEmail, token, name) => {
  const link = `${process.env.CLIENT_URL}/verifyemail.html?token=${token}`;
  const emailParams = new EmailParams()
    .setFrom(new Sender(process.env.MAIL_FROM, 'REVIEW.MNL'))
    .setTo([new Recipient(toEmail, name)])
    .setSubject('Verify Your REVIEW.MNL Account')
    .setHtml(`
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #eee;border-radius:10px;">
        <h2 style="color:#0d1b2a;">Hello, ${name}! 👋</h2>
        <p>Thanks for signing up at <strong>REVIEW.MNL</strong>. Please verify your email to get started.</p>
        <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#e8c468;color:#0d1b2a;text-decoration:none;border-radius:8px;font-weight:bold;">
          Verify Email
        </a>
        <p style="color:#888;font-size:12px;">If you didn't create this account, ignore this email.</p>
      </div>
    `);
  await mailerSend.email.send(emailParams);
};

const sendPasswordResetEmail = async (toEmail, token, name) => {
  const link = `${process.env.CLIENT_URL}/resetpassword.html?token=${token}`;
  const emailParams = new EmailParams()
    .setFrom(new Sender(process.env.MAIL_FROM, 'REVIEW.MNL'))
    .setTo([new Recipient(toEmail, name)])
    .setSubject('Reset Your REVIEW.MNL Password')
    .setHtml(`
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #eee;border-radius:10px;">
        <h2 style="color:#0d1b2a;">Hello, ${name}!</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#e8c468;color:#0d1b2a;text-decoration:none;border-radius:8px;font-weight:bold;">
          Reset Password
        </a>
        <p style="color:#888;font-size:12px;">If you didn't request this, ignore this email.</p>
      </div>
    `);
  await mailerSend.email.send(emailParams);
};

const sendCenterStatusEmail = async (toEmail, name, status) => {
  const isApproved = status === 'approved';
  const emailParams = new EmailParams()
    .setFrom(new Sender(process.env.MAIL_FROM, 'REVIEW.MNL Admin'))
    .setTo([new Recipient(toEmail, name)])
    .setSubject(`Your REVIEW.MNL Application has been ${isApproved ? 'Approved ✅' : 'Rejected ❌'}`)
    .setHtml(`
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #eee;border-radius:10px;">
        <h2 style="color:#0d1b2a;">Hello, ${name}!</h2>
        <p>Your application status: <strong>${status.toUpperCase()}</strong></p>
        <p>${isApproved ? 'Congratulations! Your center is now live.' : 'Sorry, your application was not approved.'}</p>
      </div>
    `);
  await mailerSend.email.send(emailParams);
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendCenterStatusEmail };
