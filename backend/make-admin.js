// backend/make-admin.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// --- Configuration ---
// !! Replace with the email of the user you want to make admin !!
const userEmailToMakeAdmin = 'sharonstone@gmail.com';
// Set this to true if you used the is_admin=1 approach, false if using role='admin'
const useIsAdminFlag = true; // <-- CHANGE THIS if you used is_admin=1
// --- End Configuration ---


// --- Database Connection ---
const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
        process.exit(1); // Exit if DB can't be opened
    }
    console.log("Connected to the SQLite database.");
    makeUserAdmin(); // Call the function to perform the update
});

// --- Function to Update User Role/Flag ---
function makeUserAdmin() {
    if (!userEmailToMakeAdmin || userEmailToMakeAdmin === 'admin_email@example.com') {
        console.error("Please edit this script and set 'userEmailToMakeAdmin' to the correct email address.");
        db.close();
        process.exit(1);
    }

    let sql;
    let params;

    if (useIsAdminFlag) {
        // Using is_admin = 1
        sql = `UPDATE users SET is_admin = 1 WHERE email = ?`;
        params = [userEmailToMakeAdmin];
        console.log(`Attempting to set is_admin = 1 for user: ${userEmailToMakeAdmin}`);
    } else {
        // Using role = 'admin'
        sql = `UPDATE users SET role = 'admin' WHERE email = ?`;
        params = [userEmailToMakeAdmin];
        console.log(`Attempting to set role = 'admin' for user: ${userEmailToMakeAdmin}`);
    }

    db.run(sql, params, function (err) { // Use function() to get this.changes
        if (err) {
            console.error("Error updating user:", err.message);
        } else if (this.changes === 0) {
            console.log(`User with email '${userEmailToMakeAdmin}' not found.`);
        } else {
            console.log(`Successfully updated user '${userEmailToMakeAdmin}' to admin status.`);
        }

        // Close the database connection
        db.close((closeErr) => {
            if (closeErr) {
                console.error('Error closing the database connection:', closeErr.message);
            } else {
                console.log('Database connection closed.');
            }
        });
    });
}
