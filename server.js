require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.get('/', (req, res) => res.render('index'));
app.use(express.static(path.join(__dirname)));

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function mailWrapper(headerSub, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#FAFBFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFBFC;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="background-color:#1A1D23;border-radius:8px 8px 0 0;padding:28px 32px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#2563EB;letter-spacing:-0.3px;">Alexander Atanasov</p>
          <p style="margin:4px 0 0;font-size:13px;color:#9CA3AF;">${headerSub}</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="background-color:#FFFFFF;padding:32px;">
          ${bodyHtml}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background-color:#F3F4F6;border-radius:0 0 8px 8px;padding:16px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#5A6170;">info@alexander-atanasov.de &nbsp;·&nbsp; alexander-atanasov.de</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function notificationHtml(name, email, message) {
  const safeMessage = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = `
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1A1D23;">Neue Kontaktanfrage</h2>
    <hr style="border:none;border-top:3px solid #2563EB;margin:0 0 24px;">

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:4px 16px 4px 0;font-size:13px;font-weight:600;color:#5A6170;white-space:nowrap;">Name</td>
        <td style="padding:4px 0;font-size:15px;color:#1A1D23;">${name}</td>
      </tr>
      <tr>
        <td style="padding:4px 16px 4px 0;font-size:13px;font-weight:600;color:#5A6170;white-space:nowrap;">E-Mail</td>
        <td style="padding:4px 0;font-size:15px;color:#1A1D23;">${email}</td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#5A6170;">Nachricht</p>
    <div style="background-color:#F8FAFF;border-left:4px solid #2563EB;border-radius:0 4px 4px 0;padding:16px 20px;">
      <p style="margin:0;font-size:15px;color:#1A1D23;line-height:1.6;white-space:pre-wrap;">${safeMessage}</p>
    </div>
  `;
  return mailWrapper('Portfolio Kontaktformular', body);
}

function confirmationHtml(name) {
  const body = `
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1A1D23;">Vielen Dank, ${name}!</h2>
    <hr style="border:none;border-top:3px solid #2563EB;margin:0 0 24px;">

    <p style="margin:0 0 12px;font-size:15px;color:#1A1D23;line-height:1.6;">
      Deine Nachricht ist bei mir angekommen. Ich melde mich so schnell wie möglich bei dir.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#5A6170;line-height:1.6;">
      In der Regel antworte ich innerhalb von 1–2 Werktagen.
    </p>

    <p style="margin:0;font-size:15px;color:#1A1D23;">Bis bald,<br>
      <strong style="color:#2563EB;">Alexander Atanasov</strong>
    </p>
  `;
  return mailWrapper('Portfolio Kontaktformular', body);
}

app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Alle Felder sind erforderlich.' });
  }

  try {
    await transporter.sendMail({
      from: `"Portfolio Kontaktformular" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      replyTo: email,
      subject: `Neue Kontaktanfrage von ${name}`,
      text: `Name: ${name}\nE-Mail: ${email}\n\nNachricht:\n${message}`,
      html: notificationHtml(name, email, message),
    });

    await transporter.sendMail({
      from: `"Alexander Atanasov" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Vielen Dank für deine Nachricht',
      text: `Hallo ${name},\n\nvielen Dank für deine Nachricht! Ich habe deine Anfrage erhalten und melde mich so schnell wie möglich bei dir.\n\nBis bald,\nAlexander Atanasov`,
      html: confirmationHtml(name),
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Mail error:', err);
    res.status(500).json({ error: 'E-Mail konnte nicht gesendet werden.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
