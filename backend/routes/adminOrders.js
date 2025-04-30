// backend/routes/adminOrders.js
const express = require('express');
const router = express.Router();
const path = require('path'); // Needed to resolve db path
const sqlite3 = require('sqlite3').verbose(); // Import sqlite3
const jwt = require('jsonwebtoken'); // Needed for local authenticateToken

// --- Database Connection ---
// !! Recommendation: Avoid creating a new DB connection here. !!
// !! Instead, initialize 'db' once in server.js and pass it to this route module, !!
// !! or export the 'db' instance from a dedicated db setup file and import it here. !!
const dbPath = path.resolve(__dirname, '../database.db'); // Go up one level from 'routes'
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database from adminOrders.js:", err.message);
        // Consider more robust error handling if the DB connection fails here.
        // The application might be in an unusable state for these routes.
    } else {
        console.log("AdminOrders route connected to the SQLite database.");
        // Enable foreign keys again for this connection instance
        db.run("PRAGMA foreign_keys = ON;", (pragmaErr) => {
            if (pragmaErr) console.error("AdminOrders: Failed to enable foreign key support:", pragmaErr.message);
        });
    }
});
// --- End Database Connection ---


// --- Middleware Definitions ---
// !! Recommendation: Avoid redefining middleware here. !!
// !! Import authenticateToken and isAdmin from server.js or a shared middleware file !!
// !! to ensure consistency and avoid bugs like the previous isAdmin check. !!
// Example (if exported from server.js or a middleware file):
// const { authenticateToken, isAdmin } = require('../middleware/auth'); // Adjust path as needed

// --- Using local definitions for now (ensure they match server.js) ---
const JWT_SECRET = process.env.JWT_SECRET || 'mySimpleTestSecret123!';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1]; // Format: "Bearer TOKEN"

    if (!token) {
        console.log("AdminOrders/Auth: No token provided.");
        return res.status(401).json({ message: 'Authentication token required.' });
    }

    jwt.verify(token, JWT_SECRET, (err, userPayload) => {
        if (err) {
             if (err.name === 'TokenExpiredError') {
                console.log("AdminOrders/Auth: Token expired.");
                return res.status(401).json({ message: 'Token has expired. Please log in again.' });
            }
            console.log("AdminOrders/Auth: Invalid token.", err.message);
            return res.status(403).json({ message: 'Invalid token.' });
        }
        req.user = userPayload; // Attach user payload { userId, email, name, is_admin }
        console.log("AdminOrders/Auth: Token verified for user:", userPayload.email, "Admin:", userPayload.is_admin === 1);
        next();
    });
}

// --- CORRECTED isAdmin Middleware ---
function isAdmin(req, res, next) {
    // Check if user exists on req AND if their is_admin flag is exactly 1
    if (req.user && req.user.is_admin === 1) { // <-- *** FIXED: Check is_admin === 1 ***
        console.log(`AdminOrders/isAdmin: Access GRANTED for user ${req.user.email}.`);
        next(); // User is admin, proceed
    } else {
        if (!req.user) {
            console.warn("AdminOrders/isAdmin: Access DENIED. Reason: req.user not found.");
        } else if (req.user.is_admin !== 1) {
            console.warn(`AdminOrders/isAdmin: Access DENIED for user ${req.user.email}. Reason: is_admin flag is not 1 (Value: ${req.user.is_admin}).`);
        } else {
             console.warn(`AdminOrders/isAdmin: Access DENIED for user ${req.user?.email || 'Unknown'}. Reason: General authorization failure.`);
        }
        res.status(403).json({ message: 'Forbidden: Requires admin privileges.' });
    }
}
// --- End Middleware Definitions ---


// --- Service Imports (Adjust path if needed) ---
// Assuming services is in a 'services' folder at the same level as 'routes'
// Make sure emailService.js exists and exports sendOrderShippedEmail
let sendOrderShippedEmail = async (email, details, tracking) => { // Dummy function if service doesn't exist
    console.warn(`WARN: Email service not fully implemented or imported. Would send 'Shipped' email to ${email} for order ${details.id} with tracking ${tracking}`);
};
try {
    const emailService = require('../services/emailService');
    sendOrderShippedEmail = emailService.sendOrderShippedEmail;
    console.log("Email service loaded successfully.");
} catch (e) {
    console.warn("Could not load emailService. Using dummy function. Error:", e.message);
}
// --- End Service Imports ---


// --- Route to Update Order Status ---
// PUT /api/admin/orders/:orderId/status
router.put('/:orderId/status', authenticateToken, isAdmin, async (req, res) => { // Added async here is fine
    const { orderId } = req.params;
    const { status, trackingNumber } = req.body; // trackingNumber can be optional

    // Validate orderId format
    if (isNaN(parseInt(orderId, 10))) {
        return res.status(400).json({ message: "Invalid order ID format." });
    }

    // Validate status
    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid or missing status value. Must be one of: ${validStatuses.join(', ')}` });
    }

    // Validate trackingNumber if status is 'Shipped' (optional, but good practice)
    if (status === 'Shipped' && (trackingNumber === undefined || trackingNumber === null || String(trackingNumber).trim() === '')) {
         console.warn(`Updating order ${orderId} to 'Shipped' without a tracking number.`);
        // Decide if this should be an error or just a warning
        // return res.status(400).json({ message: 'Tracking number is required when status is "Shipped".' });
    }


    // Use Promises for cleaner async flow with the database
    const getOrderPromise = () => new Promise((resolve, reject) => {
        // --- MODIFIED: Use LEFT JOIN to fetch guest orders too ---
        const sql = `
            SELECT o.*, u.email as userEmail, u.name as userName
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.id = ?
        `;
        // --- END MODIFICATION ---
        db.get(sql, [orderId], (err, order) => {
            if (err) {
                console.error(`Error fetching order ${orderId} for status update:`, err.message);
                reject(new Error('Failed to retrieve order details.'));
            } else if (!order) {
                reject({ status: 404, message: 'Order not found.' }); // Custom error object
            } else {
                resolve(order);
            }
        });
    });

    const updateOrderPromise = (currentOrder) => new Promise((resolve, reject) => {
        const sql = `
            UPDATE orders
            SET status = ?,
                tracking_number = ?
            WHERE id = ?
        `;
        // Use provided trackingNumber, fallback to existing if not provided for update
        const effectiveTrackingNumber = (trackingNumber !== undefined) ? trackingNumber : currentOrder.tracking_number;
        const params = [status, effectiveTrackingNumber, orderId];

        db.run(sql, params, function (err) { // Use function() for this.changes
            if (err) {
                console.error(`Error updating order ${orderId} status:`, err.message);
                reject(new Error('Failed to update order status.'));
            } else if (this.changes === 0) {
                // Should not happen if getOrderPromise succeeded, but check anyway
                reject({ status: 404, message: 'Order not found during update attempt.' });
            } else {
                console.log(`Order ${orderId} status updated to ${status}. Tracking: ${effectiveTrackingNumber ?? 'N/A'}`);
                resolve({ previousStatus: currentOrder.status, effectiveTrackingNumber }); // Pass needed info
            }
        });
    });

    try {
        const currentOrder = await getOrderPromise();
        const { previousStatus, effectiveTrackingNumber } = await updateOrderPromise(currentOrder);

        // --- Trigger Email Notification ---
        // Only send if userEmail exists (i.e., not a guest order)
        if (currentOrder.userEmail && status === 'Shipped' && previousStatus !== 'Shipped') {
            const emailOrderDetails = {
                id: currentOrder.id,
                userName: currentOrder.userName,
                // Add other details if needed by the email template
            };
            try {
                // Use await, but don't block the response if email fails (log instead)
                await sendOrderShippedEmail(currentOrder.userEmail, emailOrderDetails, effectiveTrackingNumber);
            } catch (emailError) {
                console.error(`Error sending 'Shipped' email for order ${orderId}:`, emailError);
                // Don't fail the API request, just log the email error
            }
        }
        // --- End Email Notification ---

        res.status(200).json({ message: 'Order status updated successfully.' });

    } catch (error) {
        // Handle errors from promises (both DB errors and custom 404 errors)
        if (error.status) {
            res.status(error.status).json({ message: error.message });
        } else {
            res.status(500).json({ message: error.message || 'An unexpected error occurred while updating order status.' });
        }
    }
});


// --- Route to Get All Orders (Admin) ---
// GET /api/admin/orders
router.get('/', authenticateToken, isAdmin, (req, res) => {
    // --- Pagination ---
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15; // Default limit
    const offset = (page - 1) * limit;

    // --- Filtering ---
    const statusFilter = req.query.status; // e.g., ?status=Pending

    // --- Build Queries ---
    let params = [];
    let countParams = [];
    let whereClauses = [];

    // Base queries
    // --- MODIFICATION: Use LEFT JOIN to include guest orders ---
    let baseSql = `FROM orders o LEFT JOIN users u ON o.user_id = u.id`;
    // --- END MODIFICATION ---
    let dataSql = `SELECT o.*, u.email as userEmail ${baseSql}`;
    let countSql = `SELECT COUNT(*) as count ${baseSql}`; // Count should also use LEFT JOIN if filters depend on user table

    // Add filters
    if (statusFilter) {
        whereClauses.push(`o.status = ?`);
        params.push(statusFilter);
        countParams.push(statusFilter);
    }
    // Add more filters here if needed (e.g., date range, user email)
    // If filtering by user email, need to handle NULLs carefully, e.g., WHERE (u.email = ? OR (u.email IS NULL AND ? = 'guest'))

    // Append WHERE clause if filters exist
    if (whereClauses.length > 0) {
        const whereString = ` WHERE ${whereClauses.join(' AND ')}`;
        dataSql += whereString;
        countSql += whereString;
    }

    // Add ORDER BY and LIMIT/OFFSET to data query
    dataSql += ` ORDER BY o.order_date DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // --- Execute Queries using Promises ---
    const getCountPromise = new Promise((resolve, reject) => {
        db.get(countSql, countParams, (err, row) => {
            if (err) {
                console.error("Error counting admin orders:", err.message);
                reject(new Error("Failed to count orders."));
            } else {
                resolve(row ? row.count : 0);
            }
        });
    });

    const getOrdersPromise = new Promise((resolve, reject) => {
        db.all(dataSql, params, (err, rows) => {
            if (err) {
                console.error("Error fetching admin orders:", err.message);
                reject(new Error("Failed to retrieve orders."));
            } else {
                resolve(rows || []);
            }
        });
    });

    // Run concurrently
    Promise.all([getCountPromise, getOrdersPromise])
        .then(([totalOrders, orders]) => {
            const totalPages = Math.ceil(totalOrders / limit);
            res.status(200).json({
                orders: orders,
                totalPages: totalPages,
                currentPage: page,
                totalOrders: totalOrders
            });
        })
        .catch(error => {
            // Errors are logged within the promises
            res.status(500).json({ message: error.message || "An unexpected error occurred while fetching orders." });
        });
});


module.exports = router;



