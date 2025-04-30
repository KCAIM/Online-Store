// backend/config/mailer.js (Example)
const nodemailer = require('nodemailer');
require('dotenv').config(); // Use environment variables

const transporter = nodemailer.createTransport({
    service: 'gmail', // Or your email provider
    auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS  // Your email password or app-specific password
    }
});

module.exports = transporter;
