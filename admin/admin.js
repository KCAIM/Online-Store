// admin/admin.js
import { getAuthToken, createAuthHeaders } from '../js/cart-utils.js'; // Adjust path

const API_BASE_URL = 'http://127.0.0.1:3000/api'; // Use your actual API URL

// --- DOM Elements ---
// Corrected IDs to match admin.html
const ordersContainer = document.getElementById('admin-orders-table-container');
const statusFilter = document.getElementById('status-filter');
// Removed applyFiltersButton as filtering happens on select change
const paginationControls = document.getElementById('admin-pagination-controls');
const adminLogoutButton = document.getElementById('admin-logout-button');
// New elements for product management
const productList = document.getElementById('admin-product-list');
const newProductForm = document.getElementById('new-product-form');
const newProductErrorMessage = document.getElementById('new-product-error-message');
// Add with other DOM element variables
const editProductSection = document.getElementById('edit-product-section');
const editProductForm = document.getElementById('edit-product-form');
const editProductErrorMessage = document.getElementById('edit-product-error-message');
const cancelEditButton = document.getElementById('cancel-edit-button');

// --- State ---
let currentPage = 1;
let totalPages = 1;
let currentStatusFilter = '';
const ORDERS_PER_PAGE = 15; // Match backend limit or remove if backend controls limit

// --- Possible Order Statuses (Match Backend) ---
const ORDER_STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];

// --- Helper Functions ---
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    // Consistent formatting
    return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
}

// --- Initial Check & Load ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Basic Auth & Admin Check ---
    const token = getAuthToken();
    if (!token) {
        console.warn("No auth token found. Redirecting to login.");
        window.location.replace('../login.html');
        return;
    }

    try {
        const userInfoString = localStorage.getItem('userInfo');
        if (!userInfoString) throw new Error("User info not found in localStorage.");

        const userInfo = JSON.parse(userInfoString);
        // Check the is_admin flag (assuming it's 1 for admin)
        if (userInfo.is_admin !== 1) {
            console.warn("User is not an admin. Redirecting.");
            alert("Access Denied: You do not have permission to view this page.");
            window.location.replace('../index.html'); // Redirect non-admins to homepage
            return;
        }
        // If admin, proceed
        console.log("Admin user confirmed via localStorage. Loading orders...");
        loadOrders();
        loadProducts();
        setupEventListeners();

    } catch (error) {
        console.error("Error checking admin status from localStorage:", error);
        // Clear potentially invalid stored data and redirect
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        alert("An error occurred verifying your permissions. Please log in again.");
        window.location.replace('../login.html');
        return;
    }
    // --- End Basic Auth & Admin Check ---
});

// Removed fetchUserInfoAndCheckRole as basic check is done above using localStorage

// --- Setup Event Listeners ---
function setupEventListeners() {
    // --- Filter on Select Change ---
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            currentPage = 1; // Reset to first page when filters change
            currentStatusFilter = statusFilter.value;
            loadOrders();
        });
    } else {
        console.warn("Status filter select element not found.");
    }
    // --- End Filter ---

    // Use event delegation for status update buttons
    if (ordersContainer) {
        ordersContainer.addEventListener('click', async (event) => {
            const updateButton = event.target.closest('.btn-update-status');
            if (updateButton) {
                const orderId = updateButton.dataset.orderId;
                // Find elements within the same row (closest 'tr')
                const row = updateButton.closest('tr');
                if (!row) return;

                const statusSelect = row.querySelector(`select.status-select[data-order-id="${orderId}"]`);
                // Get tracking input from the same row
                const trackingInput = row.querySelector(`input.tracking-input[data-order-id="${orderId}"]`);

                if (orderId && statusSelect && trackingInput) { // Ensure tracking input exists
                    const newStatus = statusSelect.value;
                    const trackingValue = trackingInput.value; // Get value from input
                    await updateOrderStatus(orderId, newStatus, trackingValue, updateButton); // Pass tracking value
                } else {
                    console.error("Could not find required elements for update in row for order:", orderId);
                }
            }
        });
    } else {
        console.warn("Orders container element not found.");
    }


    // Logout
    if (adminLogoutButton) {
        adminLogoutButton.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userInfo');
            window.location.replace('../login.html');
        });
    } else {
        console.warn("Admin logout button not found.");
    }
}

// New: Add event listener for new product form submission
if (newProductForm) {
    newProductForm.addEventListener('submit', handleNewProductSubmit);
} else {
    console.warn("New product form not found.");
}

// Replace the existing productList event listener block inside setupEventListeners
if (productList) {
    productList.addEventListener('click', async (event) => {
        const editButton = event.target.closest('.btn-edit-product'); // Look for edit button
        if (editButton) {
            const productId = editButton.dataset.productId;
            await handleEditProductClick(productId); // Call edit handler
        }
    });
 } else{
    console.warn("Product list container not found.");
 }

 // Add listener for the edit form submission
 if (editProductForm) {
     editProductForm.addEventListener('submit', handleEditProductSubmit);
 } else {
     console.warn("Edit product form not found.");
 }

 // Add listener for the cancel edit button
 if (cancelEditButton) {
     cancelEditButton.addEventListener('click', () => {
         if(editProductSection) editProductSection.classList.add('hidden');
         if(editProductErrorMessage) editProductErrorMessage.classList.add('hidden');
     });
 } else {
      console.warn("Cancel edit button not found.");
 }

// --- Load Orders from API ---
async function loadOrders() {
    if (!ordersContainer) return; // Check if container exists
    ordersContainer.innerHTML = '<p class="loading-message">Loading orders...</p>';
    paginationControls.innerHTML = ''; // Clear old pagination

    // Construct query parameters
    const params = new URLSearchParams({
        page: currentPage,
        limit: ORDERS_PER_PAGE // Ensure backend uses this limit
    });
    if (currentStatusFilter) {
        params.append('status', currentStatusFilter);
    }

    try {
        // Use the correct admin endpoint
        const response = await fetch(`${API_BASE_URL}/admin/orders?${params.toString()}`, {
            headers: createAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) { // Unauthorized or Forbidden
                alert("Access Denied. You might not be logged in or lack permissions.");
                // Use handleAuthError if available and preferred
                localStorage.removeItem('authToken');
                localStorage.removeItem('userInfo');
                window.location.replace('../login.html');
                return;
            }
            // Try to parse error message from backend
            const errorData = await response.json().catch(() => ({ message: `API error! Status: ${response.status}` }));
            throw new Error(errorData.message || `API error! Status: ${response.status}`);
        }

        const result = await response.json(); // Expect { orders: [], totalPages: X, currentPage: Y }
        const orders = result.orders;
        totalPages = result.totalPages || 1;
        currentPage = result.currentPage || 1;

        if (!orders || orders.length === 0) {
            ordersContainer.innerHTML = '<p class="no-orders-message">No orders found matching the criteria.</p>';
        } else {
            renderOrdersTable(orders);
            renderPagination(); // Call after rendering table
        }

    } catch (error) {
        console.error("Failed to load orders:", error);
        ordersContainer.innerHTML = `<p class="error-message">Could not load orders: ${error.message}</p>`;
    }
}

// --- Render Orders Table ---
function renderOrdersTable(orders) {
    const table = document.createElement('table');
    table.classList.add('admin-orders-table');

    // Table Header - Added Tracking #
    table.innerHTML = `
        <thead>
            <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>User Email</th>
                <th>Total</th>
                <th>Status</th>
                <th>Tracking #</th>
                <th>Actions</th>
            </tr>
        </thead>
    `;

    // Table Body
    const tbody = document.createElement('tbody');
    orders.forEach(order => {
        const tr = document.createElement('tr');
        const orderId = order.id; // Assuming backend sends 'id'
        // Corrected property names based on adminOrders.js response
        tr.innerHTML = `
            <td>#${orderId}</td>
            <td>${formatDate(order.order_date)}</td>
            <td>${order.userEmail || 'Guest'}</td> <!-- MODIFICATION: Display 'Guest' if email is null -->
            <td>$${Number(order.total_amount).toFixed(2)}</td>
            <td>
                ${createStatusDropdown(orderId, order.status)}
            </td>
            <td>
                <input type="text" class="tracking-input" value="${order.tracking_number || ''}" placeholder="Enter tracking #" data-order-id="${orderId}">
            </td>
            <td>
                <button class="btn btn-primary btn-small btn-update-status" data-order-id="${orderId}">Update</button>
                <!-- Add View Details button later if needed -->
                <!-- <a href="../order-details.html?id=${orderId}" target="_blank" class="btn btn-secondary btn-small">Details</a> -->
            </td>
        `;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    ordersContainer.innerHTML = ''; // Clear loading/error message
    ordersContainer.appendChild(table);
}

// --- Create Status Dropdown ---
function createStatusDropdown(orderId, currentStatus) {
    let optionsHTML = ORDER_STATUSES.map(status =>
        // Corrected HTML entities
        `<option value="${status}" ${status === currentStatus ? 'selected' : ''}>${status}</option>`
    ).join('');
    // Corrected HTML entities
    return `<select class="status-select" data-order-id="${orderId}">${optionsHTML}</select>`;
}

// --- Update Order Status ---
// Modified to accept trackingValue from input
async function updateOrderStatus(orderId, newStatus, trackingValue, button) {
    console.log(`Updating order ${orderId} to status ${newStatus} with tracking ${trackingValue || 'N/A'}`);
    button.disabled = true;
    button.textContent = 'Updating...';

    // Construct data payload including tracking number
    const updateData = {
        status: newStatus,
        trackingNumber: trackingValue // Send value from input
    };

    try {
        // Use the correct admin endpoint
        const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: createAuthHeaders(),
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            // Try parsing error from backend
            const errorData = await response.json().catch(() => ({ message: `API error! Status: ${response.status}` }));
             if (response.status === 401 || response.status === 403) {
                 // Use handleAuthError if available and preferred
                 localStorage.removeItem('authToken');
                 localStorage.removeItem('userInfo');
                 alert("Authentication failed. Please log in again.");
                 window.location.replace('../login.html');
                 return; // Stop further execution
             }
            throw new Error(errorData.message || `API error! Status: ${response.status}`);
        }

        // No need to parse JSON on success if backend sends 200 OK with simple message or 204 No Content
        console.log(`Order ${orderId} status updated successfully.`);
        alert(`Order #${orderId} status updated successfully!`);

        // Refresh the list to show updated status and tracking
        // Alternatively, update the specific row's display directly for better UX
        loadOrders(); // Reloads the current view

    } catch (error) {
        console.error(`Failed to update status for order ${orderId}:`, error);
        alert(`Error updating status: ${error.message}`);
        // Re-enable button on error only if it still exists
        if (document.body.contains(button)) {
            button.disabled = false;
            button.textContent = 'Update';
        }
    }
}

// --- Render Pagination Controls ---
// Simplified using innerHTML
function renderPagination() {
    if (!paginationControls) return; // Check if element exists
    paginationControls.innerHTML = ''; // Clear previous controls

    if (totalPages <= 1) return; // No pagination needed for single page

    let paginationHTML = '';

    // Previous Button
    paginationHTML += `
        <button class="btn btn-secondary btn-small" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
            &laquo; Previous
        </button>
    `;

    // Page Info
    paginationHTML += `<span style="margin: 0 10px;"> Page ${currentPage} of ${totalPages} </span>`;

    // Next Button
    paginationHTML += `
        <button class="btn btn-secondary btn-small" data-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>
            Next &raquo;
        </button>
    `;

    paginationControls.innerHTML = paginationHTML;

    // Add event listeners after setting innerHTML (or use delegation on the container)
    paginationControls.querySelectorAll('button[data-page]').forEach(button => {
        button.addEventListener('click', (e) => {
            if (e.target.disabled) return;
            const page = parseInt(e.target.dataset.page, 10);
            if (!isNaN(page)) {
                currentPage = page; // Update state directly
                loadOrders();
            }
        });
    });
}

// Handle New Product Submit
async function handleNewProductSubmit(event) {
    event.preventDefault(); // Prevent page reload
    if (newProductErrorMessage) newProductErrorMessage.classList.add('hidden'); // Hide previous errors

    const name = document.getElementById('product-name').value;
    const description = document.getElementById('product-description').value;
    const price = document.getElementById('product-price').value;
    const imageUrl = document.getElementById('product-image-url').value;
    const category = document.getElementById('product-category').value;
    const stockQuantity = document.getElementById('product-stock-quantity').value;

    // Basic Frontend Validation (optional but recommended)
    if (!name || !price || !category || !stockQuantity) {
         if (newProductErrorMessage) {
            newProductErrorMessage.textContent = 'Please fill in all required fields (Name, Price, Category, Stock).';
            newProductErrorMessage.classList.remove('hidden');
         } else {
             alert('Please fill in all required fields (Name, Price, Category, Stock).');
         }
        return;
    }

    // Create the data payload
    const newProductData = {
        name: name,
        description: description,
        price: price, // Backend handles number conversion/validation
        image_url: imageUrl,
        category: category,
        stock_quantity: stockQuantity // Backend handles number conversion/validation
    };

    // Ensure we are using correct auth headers
    const authHeaders = createAuthHeaders();

    // --- ADD THIS LINE FOR DEBUGGING ---
console.log('Token from localStorage right before check:', localStorage.getItem('authToken'));
// --- END OF DEBUG LINE ---

if (!authHeaders.has('Authorization')) { // Use .has() method here!
    alert("Authentication error. Please log in again.");
    window.location.replace('../login.html');
    return;
}


    try {
        const response = await fetch(`${API_BASE_URL}/admin/products`, {
            method: 'POST',
            headers: authHeaders, // Use existing auth headers
            body: JSON.stringify(newProductData)
        });

        const result = await response.json(); // Always try to parse JSON

        if (!response.ok) {
            // Use message from backend if available, otherwise provide default
            throw new Error(result.message || `API error! Status: ${response.status}`);
        }

        // Check backend success flag if it exists, otherwise assume ok response means success
        if (result.success !== false) { // Check for explicit false if backend sends it
            console.log('New product created:', result);
            alert('New product created successfully!');
            if (newProductForm) newProductForm.reset();
            loadProducts(); // Reload products list
        } else {
            // Handle cases where backend responds 2xx but indicates failure in JSON
             throw new Error(result.message || 'Failed to create product.');
        }

    } catch (error) {
        console.error('Failed to create new product:', error);
        if (newProductErrorMessage) {
            newProductErrorMessage.textContent = `Error creating new product: ${error.message}`;
            newProductErrorMessage.classList.remove('hidden');
        } else {
            alert(`Error creating new product: ${error.message}`);
        }
    }
}

// Fetch Products
async function loadProducts() {
    if (!productList) return;
    productList.innerHTML = '<p class="loading-message">Loading products...</p>';

    try {
        // Use the public endpoint to get all products
        const response = await fetch(`${API_BASE_URL}/products`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `API error! Status: ${response.status}` }));
            throw new Error(errorData.message || `API error! Status: ${response.status}`);
        }
        const products = await response.json();
        renderProducts(products);
    } catch (error) {
        console.error('Failed to load products:', error);
        productList.innerHTML = `<p class="error-message">Could not load products: ${error.message}</p>`;
    }
}

// Render Products List (Corrected Version with Edit Button)
function renderProducts(products) {
    if (!productList) return;
    productList.innerHTML = ''; // Clear loading/error message

    if (!products || products.length === 0) {
        productList.innerHTML = '<p>No products found.</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.classList.add('admin-product-items'); // Add a class for styling if needed

    products.forEach(product => {
        const li = document.createElement('li');
        // --- Use the version with the Edit button ---
        li.innerHTML = `
            <span>
                <strong>${product.name}</strong> (ID: ${product.id}) - $${Number(product.price).toFixed(2)} - Stock: ${product.stock_quantity}
            </span>
            <button class="btn btn-secondary btn-small btn-edit-product" data-product-id="${product.id}">Edit</button>
        `;
        // --- End of change ---
        ul.appendChild(li);
    });

    productList.appendChild(ul);
}

// NEW: Show and Populate Edit Form
async function handleEditProductClick(productId) {
    console.log(`Editing product ID: ${productId}`);
    if (!editProductSection || !editProductForm || !editProductErrorMessage) {
        console.error("Edit form elements not found.");
        return;
    }
    editProductErrorMessage.classList.add('hidden'); // Hide previous errors

    try {
        // Fetch current product data
        const response = await fetch(`${API_BASE_URL}/products/${productId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch product data (Status: ${response.status})`);
        }
        const product = await response.json();

        // Populate the edit form
        document.getElementById('edit-product-id').value = product.id;
        document.getElementById('edit-product-name').value = product.name || '';
        document.getElementById('edit-product-description').value = product.description || '';
        document.getElementById('edit-product-price').value = product.price || '';
        document.getElementById('edit-product-image-url').value = product.image_url || '';
        document.getElementById('edit-product-category').value = product.category || '';
        document.getElementById('edit-product-stock-quantity').value = product.stock_quantity ?? ''; // Use ?? for 0

        // Show the edit form section
        editProductSection.classList.remove('hidden');
        // Optional: scroll to the edit form
        editProductSection.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error(`Error preparing edit form for product ${productId}:`, error);
        alert(`Could not load product data for editing: ${error.message}`);
    }
}

// NEW: Handle Edit Product Form Submission
async function handleEditProductSubmit(event) {
    event.preventDefault();
    if (!editProductForm || !editProductErrorMessage) return;
    editProductErrorMessage.classList.add('hidden');

    const productId = document.getElementById('edit-product-id').value;
    if (!productId) {
        alert("Error: Product ID is missing from the edit form.");
        return;
    }

    // Get updated data from form
    const updatedProductData = {
        name: document.getElementById('edit-product-name').value,
        description: document.getElementById('edit-product-description').value,
        price: document.getElementById('edit-product-price').value,
        image_url: document.getElementById('edit-product-image-url').value,
        category: document.getElementById('edit-product-category').value,
        stock_quantity: document.getElementById('edit-product-stock-quantity').value
    };

    // Basic Frontend Validation (similar to create form)
    if (!updatedProductData.name || !updatedProductData.price || !updatedProductData.category || updatedProductData.stock_quantity === '') {
         editProductErrorMessage.textContent = 'Please fill in all required fields (Name, Price, Category, Stock).';
         editProductErrorMessage.classList.remove('hidden');
        return;
    }

    const authHeaders = createAuthHeaders();
    if (!authHeaders.has('Authorization')) {
         alert("Authentication error. Please log in again.");
         window.location.replace('../login.html');
         return;
     }

    console.log(`Submitting update for product ID: ${productId}`);
    const submitButton = editProductForm.querySelector('button[type="submit"]');
    if(submitButton) submitButton.disabled = true; // Disable button

    try {
        // IMPORTANT: Assumes backend endpoint PUT /api/admin/products/:id exists
        const response = await fetch(`${API_BASE_URL}/admin/products/${productId}`, {
            method: 'PUT', // Use PUT for updates
            headers: authHeaders,
            body: JSON.stringify(updatedProductData)
        });

        const result = await response.json(); // Try to parse JSON

        if (!response.ok) {
            throw new Error(result.message || `API error! Status: ${response.status}`);
        }

        if (result.success !== false) {
            console.log('Product update successful:', result);
            alert('Product updated successfully!');
            if(editProductSection) editProductSection.classList.add('hidden'); // Hide form on success
            loadProducts(); // Refresh the product list
        } else {
             throw new Error(result.message || 'Failed to update product.');
        }

    } catch (error) {
        console.error(`Failed to update product ${productId}:`, error);
        editProductErrorMessage.textContent = `Error updating product: ${error.message}`;
        editProductErrorMessage.classList.remove('hidden');
    } finally {
         if(submitButton) submitButton.disabled = false; // Re-enable button
    }
}
