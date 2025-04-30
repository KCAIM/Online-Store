// backend/server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');

// --- Import Admin Routes ---
const adminOrderRoutes = require('./routes/adminOrders'); // Import the admin routes

const app = express();
const port = 3000;
const saltRounds = 10;

// --- JWT Configuration ---
const JWT_SECRET = process.env.JWT_SECRET || 'mySimpleTestSecret123!'; // Change this!
console.log("Using JWT_SECRET:", JWT_SECRET);
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1h';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'your_insecure_development_secret_key') {
    console.error("FATAL ERROR: JWT_SECRET is not set or is using the insecure default in production.");
    process.exit(1);
}

// --- Database Setup ---
const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
        process.exit(1);
    }
    console.log("Connected to the SQLite database.");

    // Enable foreign key support for SQLite
    db.run("PRAGMA foreign_keys = ON;", (pragmaErr) => {
        if (pragmaErr) {
            console.error("Failed to enable foreign key support:", pragmaErr.message);
        } else {
            console.log("Foreign key support enabled.");
        }
    });


    // Use serialize to ensure table creations happen sequentially
    db.serialize(() => {
        // Create users table (Original definition)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )`, (err) => {
            if (err) console.error("Error creating users table:", err.message);
            else console.log("Users table checked/created successfully.");
        });

        // --- Add is_admin column if it doesn't exist --- (Changed from 'role')
        db.run("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0", (alterErr) => {
            if (alterErr) {
                // Ignore error if column already exists, log other errors
                if (!alterErr.message.includes("duplicate column name: is_admin")) {
                    console.error("Error adding is_admin column:", alterErr.message);
                } else {
                    // console.log("Column is_admin already exists."); // Less verbose
                }
            } else {
                console.log("Column is_admin added successfully with default 0.");
            }
        });
        // --- End change ---

        // Create products table
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            image_url TEXT,
            category TEXT,
            stock_quantity INTEGER DEFAULT 0
        )`, (err) => {
            if (err) console.error("Error creating products table:", err.message);
            else {
                console.log("Products table checked/created successfully.");
                seedInitialProducts(); // Seed after table creation
            }
        });

        // --- Cart Tables ---
        // (Cart table definitions remain the same)
        db.run(`CREATE TABLE IF NOT EXISTS carts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )`, (err) => {
            if (err) console.error("Error creating carts table:", err.message);
            else console.log("Carts table checked/created successfully.");
        });
        db.run(`CREATE TABLE IF NOT EXISTS cart_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cart_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cart_id) REFERENCES carts (id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
            UNIQUE (cart_id, product_id)
        )`, (err) => {
            if (err) console.error("Error creating cart_items table:", err.message);
            else console.log("Cart_items table checked/created successfully.");
        });

        // --- Order Tables ---
        // --- MODIFIED: Allow user_id to be NULL ---
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, -- Removed NOT NULL
            order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            total_amount REAL NOT NULL,
            status TEXT DEFAULT 'Pending',
            shipping_address TEXT NOT NULL,
            billing_address TEXT,
            shipping_method TEXT,
            tracking_number TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL -- Optional: Keep order if user deleted
        )`, (err) => {
            if (err) console.error("Error creating orders table:", err.message);
            else console.log("Orders table checked/created successfully (user_id allows NULL).");
        });
        // --- END MODIFICATION ---

        db.run(`CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            price_at_purchase REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL -- Optional: Keep item if product deleted
        )`, (err) => {
            if (err) console.error("Error creating order_items table:", err.message);
            else console.log("Order_items table checked/created successfully.");
        });

    }); // End db.serialize
});
// --- END OF DATABASE SETUP ---


// --- Function to Seed Initial Products ---
// (seedInitialProducts function remains the same)
function seedInitialProducts() {
    const sampleProducts = [
        { name: "Laptop Pro", description: "High-performance laptop for professionals.", price: 1299.99, image_url: "/images/laptop.jpg", category: "Electronics", stock: 50 },
        { name: "Wireless Mouse", description: "Ergonomic wireless mouse.", price: 25.50, image_url: "/images/mouse.jpg", category: "Accessories", stock: 200 },
        { name: "Mechanical Keyboard", description: "RGB Mechanical Keyboard for gaming.", price: 75.00, image_url: "/images/keyboard.jpg", category: "Accessories", stock: 100 },
        { name: "4K Monitor", description: "27-inch 4K UHD Monitor.", price: 349.99, image_url: "/images/monitor.jpg", category: "Electronics", stock: 30 },
        { name: "Webcam HD", description: "1080p HD Webcam with microphone.", price: 49.99, image_url: "/images/webcam.jpg", category: "Accessories", stock: 150 }
    ];

    db.get("SELECT COUNT(*) as count FROM products", [], (err, row) => {
        if (err) {
            console.error("Error checking product count:", err.message);
            return;
        }

        if (row.count === 0) {
            console.log("Products table is empty, seeding initial data...");
            const insertSql = `INSERT INTO products (name, description, price, image_url, category, stock_quantity) VALUES (?, ?, ?, ?, ?, ?)`;
            const stmt = db.prepare(insertSql);

            db.serialize(() => {
                sampleProducts.forEach(product => {
                    stmt.run(product.name, product.description, product.price, product.image_url, product.category, product.stock, (err) => {
                        if (err) {
                            console.error("Error inserting product:", product.name, err.message);
                        }
                    });
                });

                stmt.finalize((err) => {
                    if (err) {
                        console.error("Error finalizing product insert statement:", err.message);
                    } else {
                        console.log("Finished seeding initial products.");
                    }
                });
            });
        } else {
            // console.log("Products table already contains data, skipping seeding."); // Less verbose
        }
    });
}
// --- End Seed Function ---


// --- Middleware ---
const allowedOrigins = ['http://127.0.0.1:5500', 'http://localhost:5500', 'https://store-frontend-kqjx.onrender.com']; // Add your local dev frontend URL(s)
const frontendURL = process.env.FRONTEND_URL; // We'll set this in Render env vars

if (frontendURL) {
  allowedOrigins.push(frontendURL);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));
app.use(express.json());

// --- JWT Verification Middleware ---
// (authenticateToken function remains the same)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        console.log("Auth middleware: No token provided.");
        return res.status(401).json({ message: 'Authentication token required.' });
    }

    jwt.verify(token, JWT_SECRET, (err, userPayload) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                console.log("Auth middleware: Token expired.");
                return res.status(401).json({ message: 'Token has expired. Please log in again.' });
            }
            console.log("Auth middleware: Invalid token.", err.message);
            return res.status(403).json({ message: 'Invalid token.' });
        }
        req.user = userPayload; // Attach user payload { userId, email, name, is_admin }
        console.log("Auth middleware: Token verified successfully for user:", userPayload.email);
        next();
    });
}
// --- END OF JWT Verification Middleware ---

// --- Admin Check Middleware --- (Changed to check is_admin)
function isAdmin(req, res, next) {
    // Assumes is_admin is included in the JWT payload attached by authenticateToken
    if (req.user && req.user.is_admin === 1) { // Check if is_admin is 1 (true)
        console.log("Admin middleware: User is admin.");
        next(); // User is admin, proceed
    } else {
        console.warn("Admin middleware: User is NOT admin or is_admin flag missing/not 1.");
        res.status(403).json({ message: 'Forbidden: Requires admin privileges.' }); // Forbidden
    }
}
// --- END OF Admin Check Middleware ---


// --- Basic Routes ---
app.get('/', (req, res) => {
    res.send('Hello from the Online Store Backend!');
});

// --- API Endpoints ---

// POST /api/register - User Registration
// (Registration remains the same, default is_admin is 0 via ALTER TABLE)
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        // Insert without is_admin, it will get default 0
        const sql = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;

        db.run(sql, [name, email, hashedPassword], function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('UNIQUE constraint failed: users.email')) {
                    console.error("Registration error - Duplicate email:", email);
                    return res.status(409).json({ message: 'Email already exists.' });
                }
                console.error("Database error during registration:", err.message);
                return res.status(500).json({ message: 'Failed to register user due to a server error.' });
            }
            console.log(`User registered successfully with ID: ${this.lastID}`);
            res.status(201).json({
                message: 'User registered successfully!',
                userId: this.lastID
            });
        });
    } catch (error) {
        console.error("Error during registration process (e.g., hashing):", error);
        res.status(500).json({ message: 'An internal error occurred during registration.' });
    }
});

// POST /api/login - User Login (Changed to use is_admin)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Include 'is_admin' in the SELECT statement
    const sql = `SELECT id, name, email, password, is_admin FROM users WHERE email = ?`; // Changed 'role' to 'is_admin'

    db.get(sql, [email], async (err, user) => {
        if (err) {
            console.error("Database error during login query:", err.message);
            return res.status(500).json({ message: 'An internal error occurred during login.' });
        }

        const invalidCredentialsResponse = () => res.status(401).json({ message: 'Invalid credentials.' });

        if (!user) {
            console.log(`Login attempt failed: User not found for email ${email}`);
            return invalidCredentialsResponse();
        }

        try {
            const match = await bcrypt.compare(password, user.password);

            if (match) {
                console.log(`User logged in successfully: ${user.email} (ID: ${user.id}, Admin: ${user.is_admin === 1})`); // Log admin status
                // Include 'is_admin' in the JWT payload
                const payload = { userId: user.id, email: user.email, name: user.name, is_admin: user.is_admin }; // Changed 'role' to 'is_admin'
                const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
                res.status(200).json({
                    message: 'Login successful!',
                    token: token,
                    // Include is_admin in the user object returned to frontend
                    user: { id: user.id, name: user.name, email: user.email, is_admin: user.is_admin } // Changed 'role' to 'is_admin'
                });
            } else {
                console.log(`Login attempt failed: Incorrect password for email ${email}`);
                return invalidCredentialsResponse();
            }
        } catch (compareError) {
            console.error("Error comparing passwords:", compareError);
            res.status(500).json({ message: 'An internal error occurred during login.' });
        }
    });
});

// --- Product API Endpoints ---
// (Product endpoints remain the same)
app.get('/api/products', (req, res) => {
    const sql = "SELECT * FROM products";
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error fetching products:", err.message);
            res.status(500).json({ message: "Failed to retrieve products." });
            return;
        }
        res.status(200).json(rows);
    });
});
app.get('/api/products/:id', (req, res) => {
    const productId = req.params.id;
    const sql = "SELECT * FROM products WHERE id = ?";
    db.get(sql, [productId], (err, row) => {
        if (err) {
            console.error("Error fetching product by ID:", err.message);
            res.status(500).json({ message: "Failed to retrieve product." });
            return;
        }
        if (row) {
            res.status(200).json(row);
        } else {
            res.status(404).json({ message: "Product not found." });
        }
    });
});
// --- END OF Product API Endpoints ---

// --- New Product Creation Endpoint (Protected) ---
app.post('/api/admin/products', authenticateToken, isAdmin, async (req, res) => {
    console.log('--- Received POST /api/admin/products ---'); // Log entry point
    const { name, description, price, image_url, category, stock_quantity } = req.body;
    console.log('Request Body:', req.body); // Log the data received

    // Validate the input
    if (!name || !price || !category || stock_quantity === undefined) {
        console.log('Validation failed: Missing required fields.'); // Log validation failure
        return res.status(400).json({
            success: false,
            message: 'Name, price, category, and stock_quantity are required.'
        });
    }

    // Ensure stock_quantity and price are numbers
    const numericPrice = Number(price);
    const numericStockQuantity = Number(stock_quantity);
    if (isNaN(numericPrice) || isNaN(numericStockQuantity)){
        console.log('Validation failed: Price or stock quantity is not a number.'); // Log validation failure
        return res.status(400).json({
            success: false,
            message: 'Price and stock quantity must be numbers.'
         });
    }
    console.log('Validation passed. Preparing SQL.'); // Log validation success

    try {
        // Insert the new product into the database
        const sql = `
            INSERT INTO products (name, description, price, image_url, category, stock_quantity)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const params = [name, description, numericPrice, image_url, category, numericStockQuantity];
        console.log('Executing SQL:', sql, 'with params:', params); // Log SQL execution

        // Use a Promise wrapper for db.run to handle async/await better within the try block
        await new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) {
                    console.error('!!! Database Error during INSERT !!!:', err.message); // Log DB error explicitly
                    reject(err); // Reject the promise to trigger the outer catch block
                } else {
                    console.log(`Database insert successful. New product ID: ${this.lastID}`); // Log DB success
                    resolve(this.lastID); // Resolve the promise with the new ID
                }
            });
        }).then(lastID => {
            // This .then() block runs ONLY if the db.run was successful
            console.log('Sending success response (201).'); // Log before sending success
            res.status(201).json({
                success: true,
                message: 'New product created successfully!',
                productId: lastID
            });
        });
        // Note: If db.run fails, the promise rejects, and execution jumps to the catch block below

    } catch (error) { // This catch block handles promise rejections (like DB errors) and other sync errors
        console.error('!!! Error caught in /api/admin/products catch block !!!:', error); // Log any caught error
        // Ensure a JSON response even in the catch block
        res.status(500).json({
          success: false,
          message: error.message || 'An internal error occurred during product creation.'
          // error: error.message // Optionally include error details in development
        });
    }
});
// --- End of New Product Creation ---

// --- ADD UPDATE PRODUCT ENDPOINT ---
app.put('/api/admin/products/:id', authenticateToken, isAdmin, async (req, res) => {
    console.log(`--- Received PUT /api/admin/products/${req.params.id} ---`);
    const productId = req.params.id;
    const { name, description, price, image_url, category, stock_quantity } = req.body;
    console.log('Request Body:', req.body);

    // Validate ID
    if (!productId || isNaN(Number(productId))) {
        console.log('Validation failed: Invalid Product ID.');
        return res.status(400).json({ success: false, message: 'Invalid Product ID provided.' });
    }

    // Validate required fields from body
    if (!name || price === undefined || category === undefined || stock_quantity === undefined) {
        console.log('Validation failed: Missing required fields in body.');
        return res.status(400).json({
            success: false,
            message: 'Name, price, category, and stock_quantity are required.'
        });
    }

    // Ensure numeric types
    const numericPrice = Number(price);
    const numericStockQuantity = Number(stock_quantity);
    if (isNaN(numericPrice) || isNaN(numericStockQuantity)) {
        console.log('Validation failed: Price or stock quantity is not a number.');
        return res.status(400).json({
            success: false,
            message: 'Price and stock quantity must be numbers.'
        });
    }
    console.log('Validation passed. Preparing SQL UPDATE.');

    try {
        const sql = `
            UPDATE products
            SET name = ?, description = ?, price = ?, image_url = ?, category = ?, stock_quantity = ?
            WHERE id = ?
        `;
        const params = [name, description, numericPrice, image_url, category, numericStockQuantity, productId];
        console.log('Executing SQL:', sql, 'with params:', params);

        await new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) {
                    console.error('!!! Database Error during UPDATE !!!:', err.message);
                    reject(err);
                } else if (this.changes === 0) {
                    console.log(`Product ID ${productId} not found for update.`);
                    // Reject or resolve differently if not found should be an error
                    reject(new Error(`Product with ID ${productId} not found.`)); // Treat not found as error
                } else {
                    console.log(`Database update successful for Product ID: ${productId}`);
                    resolve(); // Resolve on success
                }
            });
        });

        // If promise resolved (update successful)
        console.log('Sending success response (200).');
        res.status(200).json({
            success: true,
            message: `Product ID ${productId} updated successfully.`
        });

    } catch (error) {
        console.error('!!! Error caught in PUT /api/admin/products/:id catch block !!!:', error);
        // Handle specific "not found" error from the promise rejection
        if (error.message.includes('not found')) {
             res.status(404).json({ success: false, message: error.message });
        } else {
             res.status(500).json({
               success: false,
               message: error.message || 'An internal error occurred during product update.'
             });
        }
    }
});
// --- END UPDATE PRODUCT ENDPOINT ---

// --- Cart API Endpoints (Protected) ---
// (Cart helper and endpoints remain the same)
function findOrCreateCart(userId, callback) {
    const findSql = `SELECT id FROM carts WHERE user_id = ?`;
    db.get(findSql, [userId], (err, cart) => {
        if (err) {
            console.error("Error finding cart:", err.message);
            return callback(err, null);
        }
        if (cart) {
            return callback(null, cart.id);
        } else {
            const createSql = `INSERT INTO carts (user_id) VALUES (?)`;
            db.run(createSql, [userId], function (createErr) {
                if (createErr) {
                    if (createErr.code === 'SQLITE_CONSTRAINT' && createErr.message.includes('UNIQUE constraint failed: carts.user_id')) {
                         console.warn(`Cart creation conflict for user ${userId}, retrying find...`);
                         db.get(findSql, [userId], (retryErr, retryCart) => {
                             if (retryErr) return callback(retryErr, null);
                             if (retryCart) return callback(null, retryCart.id);
                             else return callback(new Error("Failed to find or create cart after conflict."), null);
                         });
                    } else {
                        console.error("Error creating cart:", createErr.message);
                        return callback(createErr, null);
                    }
                } else {
                    console.log(`Created new cart with ID ${this.lastID} for user ${userId}`);
                    return callback(null, this.lastID);
                }
            });
        }
    });
}
app.get('/api/cart', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    findOrCreateCart(userId, (err, cartId) => {
        if (err) return res.status(500).json({ message: "Error accessing cart." });
        const sql = `
            SELECT ci.id as cartItemId, ci.quantity, p.id as productId, p.name, p.price, p.image_url as image
            FROM cart_items ci JOIN products p ON ci.product_id = p.id
            WHERE ci.cart_id = ?`;
        db.all(sql, [cartId], (cartErr, items) => {
            if (cartErr) return res.status(500).json({ message: "Failed to retrieve cart items." });
            res.status(200).json(items || []);
        });
    });
});
app.post('/api/cart/items', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const { productId, quantity } = req.body;
    if (!productId || quantity === undefined || typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ message: "Valid productId and positive quantity are required." });
    }
    const intQuantity = Math.floor(quantity);
    findOrCreateCart(userId, (cartErr, cartId) => {
        if (cartErr) return res.status(500).json({ message: "Error accessing cart." });
        db.get("SELECT id, name, stock_quantity FROM products WHERE id = ?", [productId], (prodErr, product) => {
            if (prodErr) return res.status(500).json({ message: "Error validating product." });
            if (!product) return res.status(404).json({ message: "Product not found." });
            const insertSql = `INSERT INTO cart_items (cart_id, product_id, quantity, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
            db.run(insertSql, [cartId, productId, intQuantity], function (insertErr) {
                if (insertErr) {
                    if (insertErr.code === 'SQLITE_CONSTRAINT' && insertErr.message.includes('UNIQUE constraint failed: cart_items.cart_id, cart_items.product_id')) {
                        const updateSql = `UPDATE cart_items SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE cart_id = ? AND product_id = ?`;
                        db.run(updateSql, [intQuantity, cartId, productId], (updateErr) => {
                            if (updateErr) return res.status(500).json({ message: "Failed to update item quantity in cart." });
                            fetchAndReturnUpdatedItem(res, cartId, productId, "Item quantity updated in cart.");
                        });
                    } else {
                        return res.status(500).json({ message: "Failed to add item to cart.", error: insertErr.message });
                    }
                } else {
                    fetchAndReturnUpdatedItem(res, cartId, productId, "Item added to cart.", 201, this.lastID);
                }
            });
        });
    });
});
function fetchAndReturnUpdatedItem(res, cartId, productId, successMessage, statusCode = 200, cartItemId = null) {
    const selectItemSql = `
        SELECT ci.id as cartItemId, ci.quantity, p.id as productId, p.name, p.price, p.image_url as image
        FROM cart_items ci JOIN products p ON ci.product_id = p.id
        WHERE ci.cart_id = ? AND ci.product_id = ?`;
    db.get(selectItemSql, [cartId, productId], (itemErr, updatedItem) => {
        if (itemErr || !updatedItem) {
            console.error("Error fetching updated/added cart item:", itemErr?.message);
            // Avoid sending sensitive error details to client
            return res.status(statusCode).json({ message: successMessage });
        }
        const responsePayload = { message: successMessage, item: updatedItem };
        if (cartItemId !== null) responsePayload.cartItemId = cartItemId;
        res.status(statusCode).json(responsePayload);
    });
}
app.delete('/api/cart/items/:productId', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const productIdToRemove = parseInt(req.params.productId, 10);
    if (isNaN(productIdToRemove)) return res.status(400).json({ message: "Invalid product ID." });
    findOrCreateCart(userId, (cartErr, cartId) => {
        if (cartErr) return res.status(500).json({ message: "Error accessing cart." });
        const deleteSql = `DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?`;
        db.run(deleteSql, [cartId, productIdToRemove], function (deleteErr) {
            if (deleteErr) return res.status(500).json({ message: "Failed to remove item from cart." });
            if (this.changes > 0) res.status(200).json({ message: "Item removed successfully." });
            else res.status(404).json({ message: "Item not found in cart." });
        });
    });
});
app.put('/api/cart/items/:productId', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const productIdToUpdate = parseInt(req.params.productId, 10);
    const { quantity } = req.body;
    if (isNaN(productIdToUpdate)) return res.status(400).json({ message: "Invalid product ID." });
    if (quantity === undefined || typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ message: "Valid positive quantity is required." });
    }
    const newQuantity = Math.floor(quantity);
    findOrCreateCart(userId, (cartErr, cartId) => {
        if (cartErr) return res.status(500).json({ message: "Error accessing cart." });
        const updateSql = `UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE cart_id = ? AND product_id = ?`;
        db.run(updateSql, [newQuantity, cartId, productIdToUpdate], function (updateErr) {
            if (updateErr) return res.status(500).json({ message: "Failed to update item quantity." });
            if (this.changes > 0) fetchAndReturnUpdatedItem(res, cartId, productIdToUpdate, "Item quantity updated successfully.");
            else res.status(404).json({ message: "Item not found in cart to update." });
        });
    });
});
// --- END OF Cart API Endpoints ---

// --- Place Order Endpoint (Now Optionally Authenticated) ---
app.post('/api/orders', async (req, res) => { // Removed authenticateToken middleware here
    // Expecting shipping_address, billing_address (optional), shipping_method
    // AND items: [{ productId, quantity, price }] if guest
    const { shipping_address, billing_address, shipping_method, items: guestCartItems } = req.body;
    let userId = null; // Default to null for guest

    // --- Optional Authentication ---
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (token) {
        try {
            // Verify token synchronously (or use async/await with util.promisify if preferred)
            const userPayload = jwt.verify(token, JWT_SECRET);
            userId = userPayload.userId; // Assign userId if token is valid
            console.log(`Order placement attempt by authenticated user: ${userId}`);
        } catch (err) {
            // Handle invalid/expired token specifically for order placement
            if (err.name === 'TokenExpiredError') {
                console.log("Order placement failed: Token expired.");
                return res.status(401).json({ message: 'Token has expired. Please log in again to place order.' });
            }
            console.log("Order placement failed: Invalid token provided.", err.message);
            return res.status(403).json({ message: 'Invalid token provided.' });
        }
    } else {
        console.log("Order placement attempt by guest.");
    }
    // --- End Optional Authentication ---

    if (!shipping_address) {
        return res.status(400).json({ message: "Shipping address is required." });
    }

    // --- Database Promise Helpers (Keep these) ---
    const runAsync = (sql, params = []) => new Promise((resolve, reject) => { // Added default empty array for params
        db.run(sql, params, function(err) { if (err) reject(err); else resolve(this); });
    });
    const getAsync = (sql, params = []) => new Promise((resolve, reject) => { // Added default empty array for params
        db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
    });
    const allAsync = (sql, params = []) => new Promise((resolve, reject) => { // Added default empty array for params
        db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
    });
    // --- End Promise Helpers ---

    try {
        let cartItems = [];
        let cartId = null; // Only relevant for logged-in users

        if (userId) {
            // --- Logged-in User: Fetch cart from DB ---
            const cart = await getAsync(`SELECT id FROM carts WHERE user_id = ?`, [userId]);
            if (!cart) {
                // Should not happen if user interacted with cart, but handle defensively
                return res.status(404).json({ message: "User cart not found." });
            }
            cartId = cart.id;
            cartItems = await allAsync(`
                SELECT ci.product_id, ci.quantity, p.price
                FROM cart_items ci JOIN products p ON ci.product_id = p.id
                WHERE ci.cart_id = ?`, [cartId]);
        } else {
            // --- Guest User: Use items from request body ---
            if (!Array.isArray(guestCartItems) || guestCartItems.length === 0) {
                return res.status(400).json({ message: "Cart items are required for guest checkout." });
            }
            // Basic validation of guest cart items
            cartItems = guestCartItems.map(item => ({
                product_id: item.productId || item.id, // Allow both keys from frontend
                quantity: parseInt(item.quantity, 10),
                price: parseFloat(item.price) // Use price sent from frontend for guest
            }));
            if (cartItems.some(item => !item.product_id || isNaN(item.quantity) || item.quantity <= 0 || isNaN(item.price))) {
                 return res.status(400).json({ message: "Invalid cart item data provided for guest checkout." });
            }
            console.log("Processing guest order with items:", cartItems);
        }

        if (cartItems.length === 0) {
            return res.status(400).json({ message: "Cannot place order with an empty cart." });
        }

        // Calculate Total Amount (using price from DB for logged-in, price from body for guest)
        const totalAmount = cartItems.reduce((sum, item) => {
            // Ensure price and quantity are numbers
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;
            return sum + (price * quantity);
        }, 0);

        // Begin Transaction
        await runAsync("BEGIN TRANSACTION;");

        // Insert into 'orders' table (userId can be NULL)
        const orderSql = `
            INSERT INTO orders (user_id, total_amount, status, shipping_address, billing_address, shipping_method)
            VALUES (?, ?, ?, ?, ?, ?)`;
        const orderResult = await runAsync(orderSql, [
            userId, // This can be NULL now
            totalAmount,
            'Pending',
            shipping_address,
            billing_address || shipping_address,
            shipping_method || 'standard'
        ]);
        const newOrderId = orderResult.lastID;
        console.log(`Inserted into orders table, new order ID: ${newOrderId} (User ID: ${userId || 'Guest'})`);

        // Insert into 'order_items' table
        const itemSql = `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)`;
        const itemStmt = db.prepare(itemSql);
        for (const item of cartItems) {
            await new Promise((resolve, reject) => {
                // Ensure price_at_purchase is a number
                const priceAtPurchase = Number(item.price) || 0;
                itemStmt.run([newOrderId, item.product_id, item.quantity, priceAtPurchase], (itemErr) => {
                    if (itemErr) reject(itemErr); else resolve();
                });
            });
        }
        await new Promise((resolve, reject) => { itemStmt.finalize(err => { if (err) reject(err); else resolve(); }); });
        console.log(`Inserted ${cartItems.length} items into order_items for order ID: ${newOrderId}`);

        // Clear the user's cart ONLY IF they are logged in
        if (userId && cartId) {
            const clearCartSql = `DELETE FROM cart_items WHERE cart_id = ?`;
            const clearResult = await runAsync(clearCartSql, [cartId]);
            console.log(`Cleared ${clearResult.changes} items from cart ID: ${cartId} for user ${userId}`);
        } else {
            console.log(`Skipping DB cart clearing for guest order ${newOrderId}.`);
        }

        // Commit Transaction
        await runAsync("COMMIT;");

        // Send Success Response
        res.status(201).json({
            message: "Order placed successfully!",
            orderId: newOrderId
        });

    } catch (error) {
        console.error("Error placing order:", error.message);
        try { await runAsync("ROLLBACK;"); console.log("Transaction rolled back."); }
        catch (rollbackError) { console.error("Error rolling back transaction:", rollbackError.message); }
        res.status(500).json({ message: "Failed to place order due to a server error." });
    }
});
// --- END Place Order Endpoint ---

// --- Order History Endpoint (Protected) ---
app.get('/api/orders/my-orders', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    // SQL to get orders for the specific user, joining with items and products
    // This query can get complex; consider optimizing or fetching items separately if needed
    const sql = `
        SELECT
            o.id as orderId,
            o.order_date,
            o.total_amount,
            o.status,
            o.shipping_address,
            oi.id as orderItemId,
            oi.quantity,
            oi.price_at_purchase,
            p.id as productId,
            p.name as productName,
            p.image_url as productImage
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id -- Use LEFT JOIN in case product was deleted
        WHERE o.user_id = ?
        ORDER BY o.order_date DESC, o.id DESC, oi.id ASC;
    `;

    db.all(sql, [userId], (err, rows) => {
        if (err) {
            console.error(`Error fetching order history for user ${userId}:`, err.message);
            return res.status(500).json({ message: "Failed to retrieve order history." });
        }

        // Group rows by orderId to structure the response
        const orders = {};
        rows.forEach(row => {
            if (!orders[row.orderId]) {
                orders[row.orderId] = {
                    id: row.orderId,
                    order_date: row.order_date,
                    total_amount: row.total_amount,
                    status: row.status,
                    shipping_address: row.shipping_address,
                    items: []
                };
            }
            // Add item details if they exist (product might be null if deleted)
            if (row.orderItemId) {
                 orders[row.orderId].items.push({
                     orderItemId: row.orderItemId,
                     productId: row.productId,
                     productName: row.productName || 'Product Unavailable', // Handle deleted products
                     productImage: row.productImage || 'images/placeholder.png',
                     quantity: row.quantity,
                     price_at_purchase: row.price_at_purchase
                 });
            }
        });

        // Convert the orders object back to an array
        const ordersArray = Object.values(orders);

        res.status(200).json(ordersArray);
    });
});
// --- END Order History Endpoint ---

// --- Example Protected Route ---
// (Remains the same)
app.get('/api/account', authenticateToken, (req, res) => {
    console.log("Accessing protected /api/account route for user:", req.user.email);
    res.status(200).json({
        message: `This is your protected account data, ${req.user.name}!`,
        user: {
            id: req.user.userId,
            name: req.user.name,
            email: req.user.email
            // Note: is_admin is in req.user but not explicitly sent back here
        }
    });
});

app.put('/api/account', authenticateToken, async (req, res) => {
    const userId = req.user.userId; // Get user ID from JWT payload
    const { name, email } = req.body; // Example fields to update

    if (!name || !email) {
        return res.status(400).json({ message: 'Name and email are required.' });
    }

    try {
        const sql = 'UPDATE users SET name = ?, email = ? WHERE id = ?';
        await new Promise((resolve, reject) => {
            db.run(sql, [name, email, userId], function(err) {
                if (err) {
                    console.error('Database error updating profile:', err.message);
                    reject(err);
                } else if (this.changes === 0) {
                    reject(new Error('User not found or no changes made.'));
                } else {
                    resolve();
                }
            });
        });

        // Fetch updated user data (optional, but good practice)
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT id, name, email FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.status(200).json({ message: 'Profile updated successfully!', user }); // Send JSON response
    } catch (error) {
        console.error('Error updating profile:', error.message);
        res.status(500).json({ message: 'Failed to update profile: ' + error.message });
    }
});

// --- Mount Admin Routes ---
// (Remains the same)
app.use('/api/admin/orders', authenticateToken, isAdmin, adminOrderRoutes); // Apply middleware here
// --- End Mount Admin Routes ---


// --- Start the Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server listening at http://localhost:${PORT}`);
});

// --- Graceful Shutdown ---
// (Remains the same)
process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server and DB connection.');
    db.close((err) => {
        if (err) console.error('Error closing the database connection:', err.message);
        else console.log('Database connection closed.');
        process.exit(err ? 1 : 0);
    });
});
