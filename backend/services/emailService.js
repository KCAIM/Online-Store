// backend/services/emailService.js (Example)
const transporter = require('../config/mailer');

async function sendOrderShippedEmail(userEmail, orderDetails, trackingNumber) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: `Your Order #${orderDetails.id || orderDetails.orderId} Has Shipped!`,
        html: `
            <h1>Your Order Has Shipped!</h1>
            <p>Hi ${orderDetails.userName || 'Customer'},</p>
            <p>Good news! Your order #${orderDetails.id || orderDetails.orderId} has been shipped.</p>
            ${trackingNumber ? `<p>You can track your package using this tracking number: <strong>${trackingNumber}</strong></p>` : ''}
            <p>Thank you for shopping with us!</p>
            <p>My Awesome Store</p>
        ` // Customize this template
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Shipped email sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending shipped email:', error);
        return false; // Indicate failure
    }
}

module.exports = { sendOrderShippedEmail };
