// js/account.js

// --- ADD IMPORTS FROM cart-utils.js ---
import {
    getAuthToken,
    createAuthHeaders,
    addItemToCart, // Needed for 'Buy Again'
    handleAuthError // Import error handler if needed (e.g., for return request)
    // Add other cart-utils imports if needed by order actions
} from './cart-utils.js';
// --- END IMPORTS ---

// Define the base URL for your API
const API_BASE_URL = 'http://localhost:3000/api'; // Or your actual backend URL

// --- API Interaction Functions ---

async function fetchUserProfile() {
  const token = getAuthToken();
  if (!token) {
    console.error('No auth token found in localStorage.');
    // Handle case where user is not logged in (e.g., redirect to login)
    // Consider redirecting or showing a message here
    // window.location.href = 'login.html';
    return null;
  }

  try {
    // *** Use the full URL ***
    const response = await fetch(`${API_BASE_URL}/account`, { // Changed URL
      method: 'GET', // Explicitly GET
      headers: createAuthHeaders() // Use helper for headers
    });

    // Handle potential authentication errors first
    if (response.status === 401 || response.status === 403) {
        console.error('Authentication error fetching profile.');
        handleAuthError(); // Use the imported handler
        return null; // Stop processing
    }

    // Attempt to parse JSON regardless of status for error messages
    // Need to handle potential non-JSON responses (like HTML 404 pages) gracefully
    let data;
    try {
        data = await response.json();
    } catch (jsonError) {
        // If JSON parsing fails, check if the response was actually OK
        if (response.ok) {
            // Unexpected: Response was OK but not valid JSON
            console.error('Response was OK but not valid JSON:', jsonError);
            throw new Error('Received invalid data from server.');
        } else {
            // Likely an HTML error page for 404, 500 etc.
            console.error('Failed to parse JSON response (likely HTML error page):', jsonError);
            throw new Error(`Server returned status ${response.status}. Check server logs.`);
        }
    }


    if (!response.ok) {
      // Use message from parsed JSON if available
      throw new Error(data?.message || `Failed to fetch profile. Status: ${response.status}`);
    }

    // Ensure the user object exists in the response
    if (!data || !data.user) {
        console.error("User data structure missing in API response:", data);
        throw new Error("Received invalid user data structure from server.");
    }

    console.log("Fetched user profile data:", data.user);
    return data.user; // Return the user object nested in the response

  } catch (error) {
    console.error('Error fetching user profile:', error);
    // Display error message on the page (ensure element exists)
    const errorParagraph = document.getElementById('profile-error');
    if(errorParagraph) errorParagraph.textContent = `Error loading profile: ${error.message}`;
    return null;
  }
}


async function updateProfile(userData) {
  const token = getAuthToken();
  if (!token) {
    console.error('No auth token found in localStorage.');
    // Handle case where user is not logged in (shouldn't happen on account page if protected)
    return { success: false, message: 'Authentication token not found.' };
  }

  try {
    // *** Use the full URL ***
    const response = await fetch(`${API_BASE_URL}/account`, { // Changed URL
      method: 'PUT', // Use PUT to update the resource
      headers: createAuthHeaders(), // Use helper for headers
      body: JSON.stringify(userData)
    });

    // Handle potential authentication errors first
    if (response.status === 401 || response.status === 403) {
        console.error('Authentication error updating profile.');
        handleAuthError(); // Use the imported handler
        return { success: false, message: 'Authentication failed. Please log in again.' }; // Stop processing
    }

    // Attempt to parse JSON regardless of status
    let data;
     try {
        data = await response.json();
    } catch (jsonError) {
        if (response.ok) {
            // If PUT returns 204 No Content, response.json() will fail. Handle this.
            if (response.status === 204) {
                console.log('Profile updated successfully (204 No Content).');
                // Fetch the user data again to return it, as 204 has no body
                const updatedUser = await fetchUserProfile(); // Re-fetch
                return { success: true, user: updatedUser, message: "Profile updated successfully!" };
            }
            // Otherwise, it's an unexpected JSON error on a successful response
            console.error('Update response was OK but not valid JSON:', jsonError);
            throw new Error('Received invalid data from server after update.');
        } else {
            console.error('Failed to parse JSON response from update (likely HTML error page):', jsonError);
            throw new Error(`Server returned status ${response.status} during update. Check server logs.`);
        }
    }

    if (!response.ok) {
      // Throw error with message from backend if available
      throw new Error(data?.message || `Failed to update profile. Status: ${response.status}`);
    }

    console.log('Profile updated successfully:', data);
    // Return success status and the updated user data
    return { success: true, user: data?.user, message: data?.message || "Update successful" }; // Safely access user/message

  } catch (error) {
    console.error('Error updating profile:', error);
    // Return failure status and the error message
    return { success: false, message: error.message };
  }
}

// --- Order History Functions (Added these back) ---

async function fetchAndDisplayOrders() {
    const orderHistoryContainer = document.getElementById('order-history-container'); // Get container
    if (!orderHistoryContainer) {
        console.error("Order history container not found.");
        return; // Exit if container missing
    }
    orderHistoryContainer.innerHTML = '<p class="loading-message">Loading your orders...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/orders/my-orders`, { // Use the order history endpoint
             headers: createAuthHeaders() // Use imported function
        });

        if (!response.ok) {
             if (response.status === 401 || response.status === 403) {
                 // Redirect to login if auth fails
                 console.warn(`Auth error (${response.status}) fetching orders. Redirecting.`);
                 handleAuthError(); // Use the imported handler
                 return; // Stop processing
             }
             // Handle other errors
             const errorData = await response.json().catch(() => ({})); // Attempt to parse error JSON
             throw new Error(errorData.message || `API error! Status: ${response.status}`);
        }

        const orders = await response.json();

        if (!Array.isArray(orders) || orders.length === 0) {
            orderHistoryContainer.innerHTML = '<p class="no-orders-message">You have no past orders.</p>';
            return;
        }

        orderHistoryContainer.innerHTML = ''; // Clear loading message
        orders.forEach(order => {
            const orderCard = document.createElement('div');
            orderCard.className = 'order-card';

            // Format date nicely
            const orderDate = new Date(order.order_date).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            // Status class for styling (handle spaces in status)
            const statusClass = `status-${order.status?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}`;

            let itemsHTML = '<p>No item details available.</p>';
            if (order.items && order.items.length > 0) {
                itemsHTML = order.items.map(item => `
                    <div class="order-item">
                        <div class="order-item-image">
                            <img src="${item.productImage || 'images/placeholder.png'}" alt="${item.productName || 'Product'}" loading="lazy" width="60" height="60">
                        </div>
                        <div class="order-item-details">
                            <p class="item-name">${item.productName || 'Product Unavailable'}</p>
                            <p>Quantity: ${item.quantity}</p>
                            <p>Price: $${Number(item.price_at_purchase).toFixed(2)}</p>
                        </div>
                    </div>
                `).join('');
            }

            orderCard.innerHTML = `
                <div class="order-header">
                    <span>Order ID: #${order.id}</span>
                    <span>Placed on: ${orderDate}</span>
                    <span>Total: $${Number(order.total_amount).toFixed(2)}</span>
                    <span class="order-status ${statusClass}">${order.status || 'Unknown'}</span>
                </div>
                <div class="order-items-list">
                    ${itemsHTML}
                </div>
                <div class="order-actions">
                    ${generateOrderActionButtons(order)}
                </div>
            `;
            orderHistoryContainer.appendChild(orderCard);
        });

         // Add delegated event listeners after rendering all orders
         addOrderActionListeners(); // Call the listener setup function

    } catch (error) {
        console.error("Failed to load order history:", error);
        orderHistoryContainer.innerHTML = `<p class="error-message">Could not load order history: ${error.message}. Please try again later.</p>`;
    }
}

function generateOrderActionButtons(order) {
    let buttonsHTML = '';
    const orderId = order.id; // Use consistent ID
    // Example: Add buttons based on status
    if (order.status === 'Delivered') {
        // Store order data as JSON string for Buy Again
        const orderDataString = JSON.stringify(order);
        buttonsHTML += ` <button class="btn btn-secondary btn-small btn-buy-again" data-order-id="${orderId}" data-order='${orderDataString.replace(/'/g, "&apos;")}'>Buy Again</button>`; // Store order data
        buttonsHTML += ` <button class="btn btn-secondary btn-small btn-request-return" data-order-id="${orderId}">Request Return</button>`;
    }
    if (order.status === 'Shipped' && order.tracking_number) {
         // Example tracking link (replace with actual provider if known)
         const trackingUrl = `https://www.google.com/search?q=track+package+${encodeURIComponent(order.tracking_number)}`;
         buttonsHTML += ` <a href="${trackingUrl}" target="_blank" class="btn btn-secondary btn-small">Track Shipment</a>`;
    }
    // Add more conditions for other statuses if needed
    return buttonsHTML;
}

function addOrderActionListeners() {
    const orderHistoryContainer = document.getElementById('order-history-container');
    if (!orderHistoryContainer) return;

    orderHistoryContainer.addEventListener('click', (event) => {
        const buyAgainButton = event.target.closest('.btn-buy-again');
        const returnButton = event.target.closest('.btn-request-return');

        if (buyAgainButton) {
            const orderId = buyAgainButton.dataset.orderId;
            console.log("Buy Again clicked for order:", orderId);
            try {
                // Retrieve and parse order data stored on the button
                const orderData = JSON.parse(buyAgainButton.dataset.order.replace(/&apos;/g, "'"));
                handleBuyAgain(orderData); // Pass the parsed data
            } catch (e) {
                console.error("Failed to parse order data for Buy Again:", e);
                alert("Could not retrieve order details to add items to cart.");
                // Fallback: fetch details if parsing fails?
                // fetchOrderDetailsAndBuyAgain(orderId);
            }

        } else if (returnButton) {
            const orderId = returnButton.dataset.orderId;
            handleReturnRequest(orderId, returnButton); // Pass button for UI feedback
        }
        // Add more listeners for other actions if needed
    });
}

// handleBuyAgain function (requires orderData with items)
async function handleBuyAgain(orderData) {
    // This function remains largely the same as before, but needs the order items passed in.
    if (!orderData || !orderData.items || orderData.items.length === 0) {
        alert("Could not retrieve items for this order to add to cart.");
        console.error("handleBuyAgain called without valid order items:", orderData);
        return;
    }
    const orderId = orderData.id;
    console.log(`Adding items to cart from order ${orderId}`);
    let allAddedSuccessfully = true;
    const addPromises = orderData.items.map(item => {
        // Ensure the item structure matches what addItemToCart expects
        const productData = {
            id: item.productId,
            name: item.productName || 'Product',
            price: item.price_at_purchase,
            image: item.productImage || 'images/placeholder.png'
        };
        const quantity = Number(item.quantity) || 1;
        // Use the imported addItemToCart
        return addItemToCart(productData, quantity)
            .then(success => { if (!success) allAddedSuccessfully = false; return success; })
            .catch(err => { console.error(`Failed to add item ${item.productId} from order:`, err); allAddedSuccessfully = false; return false; });
    });
    await Promise.allSettled(addPromises); // Wait for all add attempts
    if (allAddedSuccessfully) {
        alert("Items from your previous order have been added to your cart!");
        window.location.href = 'cart.html'; // Redirect to cart
    } else {
        alert("Some items could not be added to the cart. Please check your cart.");
        // Optionally still redirect, or stay on account page
        // window.location.href = 'cart.html';
    }
}

// handleReturnRequest function
async function handleReturnRequest(orderId, button) {
    if (!confirm("Are you sure you want to request a return for this order?")) return;

    console.log(`Requesting return for order ${orderId}`);
    if (button) { // Disable button if provided
        button.disabled = true;
        button.textContent = 'Requesting...';
    }

    try {
        // !! IMPORTANT: You need a backend endpoint for this !!
        // Example: POST /api/orders/:id/return
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}/return`, {
             method: 'POST',
             headers: createAuthHeaders()
        });

        if (!response.ok) {
            // Handle auth errors specifically if the endpoint is protected
             if (response.status === 401 || response.status === 403) {
                 handleAuthError(); // Use the imported handler
                 return; // Stop processing
             }
            const errorData = await response.json().catch(() => ({ message: 'Unknown error occurred.' }));
            throw new Error(errorData.message || `API error! status: ${response.status}`);
        }

        const result = await response.json().catch(() => ({ message: 'Return requested.' })); // Provide default message
        alert(result.message || "Return requested successfully!");

        // Refresh the order list to show updated status (if backend changes it)
        await fetchAndDisplayOrders();

    } catch (error) {
        console.error("Failed to request return:", error);
        alert(`Error requesting return: ${error.message}`);
         // Re-enable button on error if it still exists
         if (button && document.body.contains(button)) {
             button.disabled = false;
             button.textContent = 'Request Return';
         }
    }
}

// --- End Order History Functions ---


// --- DOM Interaction ---

document.addEventListener('DOMContentLoaded', async () => {
  // --- Element selections ---
  const profileForm = document.getElementById('profile-form');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const messageParagraph = document.getElementById('profile-message');
  const errorParagraph = document.getElementById('profile-error');
  const welcomeMessage = document.getElementById('welcome-message');

  // --- Authentication Check ---
  const authToken = getAuthToken();
   if (!authToken) {
       console.log("User not logged in on account page. Redirecting to login.");
       window.location.replace('login.html'); // Use replace
       return; // Stop further execution
   }
   // --- End Auth Check ---


  // Ensure profile form elements exist before proceeding
  if (!profileForm || !nameInput || !emailInput || !messageParagraph || !errorParagraph) {
      console.error("One or more profile form elements are missing from the page.");
      if(errorParagraph) errorParagraph.textContent = "Error: Page elements missing. Cannot load profile form.";
      // Allow order history to load even if profile form is broken
  }

  // --- Load Profile and Order History Concurrently ---
  console.log("Initializing account page: Fetching profile and orders...");
  await Promise.allSettled([
      fetchUserProfile().then(user => { // Handle profile display within the promise chain
          if (user) {
              if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${user.name || 'User'}!`;
              if (nameInput) nameInput.value = user.name || '';
              if (emailInput) emailInput.value = user.email || '';
          } else {
              // Handle profile fetch failure (error message displayed in fetchUserProfile)
              if (profileForm) { // Disable form if profile load failed
                  profileForm.style.opacity = '0.5';
                  profileForm.querySelectorAll('input, button').forEach(el => el.disabled = true);
              }
          }
      }),
      fetchAndDisplayOrders() // Call the order history function
  ]);
  console.log("Account page initialization complete.");
  // --- End Loading ---


  // --- Profile Form Submission Listener ---
  if (profileForm && nameInput && emailInput) { // Check elements exist before adding listener
      profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorParagraph.textContent = "";
        messageParagraph.textContent = "";

        if (!nameInput.value.trim() || !emailInput.value.trim()) {
            errorParagraph.textContent = "Name and Email cannot be empty.";
            return;
        }
        if (!/\S+@\S+\.\S+/.test(emailInput.value.trim())) {
            errorParagraph.textContent = "Please enter a valid email address.";
            return;
        }

        const userData = {
          name: nameInput.value.trim(),
          email: emailInput.value.trim(),
        };

        const submitButton = profileForm.querySelector('button[type="submit"]');
        if(submitButton) submitButton.disabled = true;
        messageParagraph.textContent = "Updating...";

        const result = await updateProfile(userData);

        if(submitButton) submitButton.disabled = false;
        messageParagraph.textContent = "";

        if (result.success) {
          messageParagraph.textContent = result.message || "Profile updated successfully!";
          if (result.user) {
              nameInput.value = result.user.name || '';
              emailInput.value = result.user.email || '';
              // Update welcome message if it exists
              if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${result.user.name || 'User'}!`;
          }
          // Update userInfo in localStorage
          const currentUserInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
          if (result.user && (currentUserInfo.name !== result.user.name || currentUserInfo.email !== result.user.email)) {
              currentUserInfo.name = result.user.name;
              currentUserInfo.email = result.user.email;
              localStorage.setItem('userInfo', JSON.stringify(currentUserInfo));
              console.log("Updated userInfo in localStorage.");
              // Consider calling updateHeaderUI() if needed and available/imported
              // updateHeaderUI();
          }
        } else {
          errorParagraph.textContent = result.message || "Failed to update profile. An unknown error occurred.";
        }
      });
  }
  // --- End Profile Form Listener ---

}); // End DOMContentLoaded
