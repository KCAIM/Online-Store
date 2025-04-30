// js/cart-utils.js

const CART_STORAGE_KEY = 'shoppingCart'; // Keep for guest cart fallback
//const API_BASE_URL = 'http://localhost:3000/api'; // Your backend API base URL
const API_BASE_URL = 'https://online-store-i8da.onrender.com/api'; // Your backend API base URL

// --- Auth Helper Functions ---

/**
 * Retrieves the authentication token from localStorage.
 * @returns {string|null} The token or null if not found.
 */
function getAuthToken() {
    return localStorage.getItem('authToken');
}

/**
 * Creates headers for authenticated API requests.
 * @returns {Headers} Headers object with Authorization if token exists.
 */
function createAuthHeaders() {
    const headers = new Headers({
        'Content-Type': 'application/json'
    });
    const token = getAuthToken();
    if (token) {
        headers.append('Authorization', `Bearer ${token}`);
    }
    return headers;
}

/**
 * Handles authentication errors (401/403) by logging out the user.
 */
function handleAuthError() {
    console.warn("Authentication error (401/403). Logging out.");
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');
    // Update UI immediately if possible (though reload is safer)
    // updateHeaderUI(); // Assumes updateHeaderUI is globally available or imported
    alert("Your session has expired or is invalid. Please log in again.");
    // Use replace to avoid back button issues and clear history stack
    window.location.replace('login.html');
}


// --- Local Storage Functions (Keep for guest fallback) ---
/**
 * Helper function to set the isGuest flag in local storage
 */
function setIsGuest(value) {
     localStorage.setItem('isGuest', value);
}
/**
 * Gets the cart array from localStorage.
 * @returns {Array} The cart array or an empty array.
 */
function getCartFromLocalStorage() {
    try {
        const storedCart = localStorage.getItem(CART_STORAGE_KEY);
        return storedCart ? JSON.parse(storedCart) : [];
    } catch (error) {
        console.error("Error parsing cart from localStorage:", error);
        return []; // Return empty array on error
    }
}

/**
 * Saves the cart array to localStorage.
 * @param {Array} cart - The cart array to save.
 */
function saveCartToLocalStorage(cart) {
    try {
        // Ensure cart is an array before saving
        if (!Array.isArray(cart)) {
            console.error("Attempted to save non-array to cart localStorage:", cart);
            return;
        }
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
        console.error("Error saving cart to localStorage:", error);
    }
}

// --- API Interaction Functions ---

/**
 * Fetches the user's cart content from the backend API.
 * Falls back to localStorage if not logged in or on error.
 * @returns {Promise<Array>} A promise that resolves with the cart items array.
 */
async function fetchCartFromServer() {
    const token = getAuthToken();
    if (!token) {
        console.log("fetchCartFromServer: No token, using localStorage cart.");
        return getCartFromLocalStorage(); // Use local storage for guests
    }

    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            method: 'GET',
            headers: createAuthHeaders()
        });

        // Check for 401/403 specifically
        if (response.status === 401 || response.status === 403) {
            handleAuthError(); // Trigger logout/reload
            // Return empty array to prevent further processing with invalid state
            return [];
        }

        if (!response.ok) {
            // Throw error for other non-OK statuses (like 500)
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const cartItems = await response.json();
        console.log("Fetched cart from server:", cartItems);
        // Optional: Sync localStorage with server cart?
        // saveCartToLocalStorage(cartItems);
        return cartItems; // Return server data

    } catch (error) {
        // Avoid falling back to local storage if the error was auth-related
        // as handleAuthError would have been called.
        console.error("Failed to fetch cart from server:", error);
        // Fallback to local storage only on non-auth fetch errors
        // Note: If handleAuthError reloads, this might not be reached anyway.
        return getCartFromLocalStorage();
    }
}


/**
 * Adds an item to the cart. Uses API if logged in, otherwise uses localStorage.
 * @param {object} item - The item object { id, name, price, image }
 * @param {number} [quantity=1] - The quantity to add.
 * @returns {Promise<boolean>} A promise that resolves to true if successful, false otherwise.
 */
async function addItemToCart(item, quantity = 1) {
    const token = getAuthToken();

    if (token) {
        // --- Logged In: Use API ---
        console.log("addItemToCart: User logged in, using API.");
        if (!item || typeof item.id === 'undefined') {
            console.error("addItemToCart (API): Invalid item provided.", item);
            return false;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/cart/items`, {
                method: 'POST',
                headers: createAuthHeaders(),
                body: JSON.stringify({ productId: item.id, quantity: quantity })
            });

            // Check for 401/403 specifically
            if (response.status === 401 || response.status === 403) {
                handleAuthError();
                return false; // Indicate failure
            }

            const data = await response.json(); // Assume JSON response even for errors now
            if (response.ok) {
                console.log(`API: ${data.message}`, data.item || '');
                await updateCartCount(); // Update count after successful API call
                return true;
            } else {
                console.error(`API Error adding item (${response.status}): ${data.message || 'Failed request'}`);
                alert(`Error: ${data.message || 'Could not add item to cart.'}`);
                return false;
            }
        } catch (error) {
            console.error("Failed to add item to cart via API:", error);
            alert("An error occurred while adding the item to your cart. Please try again.");
            return false;
        }
    } else {
        // --- Not Logged In: Use LocalStorage ---
        console.log("addItemToCart: User not logged in, using localStorage.");
        if (!item || typeof item.id === 'undefined') {
            console.error("addItemToCart (Local): Invalid item provided.", item);
            return false;
        }
        try {
            // Use getCartFromLocalStorage directly here
            const cart = getCartFromLocalStorage();
            // Ensure consistent ID comparison (e.g., always string)
            const existingItemIndex = cart.findIndex(cartItem => String(cartItem.id ?? cartItem.productId) === String(item.id));

            if (existingItemIndex > -1) {
                // Item exists, increase quantity
                cart[existingItemIndex].quantity += quantity;
            } else {
                // Add new item
                // Ensure base properties exist and quantity is set
                cart.push({
                    id: item.id, // Use the ID passed in
                    name: item.name,
                    price: Number(item.price) || 0,
                    image: item.image || 'images/product-placeholder.png',
                    quantity: quantity // Use the passed quantity
                });
            }
            saveCartToLocalStorage(cart);
            await updateCartCount(); // Update count after modifying local storage
            return true; // Indicate local success
        } catch (error) {
            console.error("Failed to add item to local storage cart:", error);
            return false;
        }
    }
}

// --- Cart Calculation & Update Functions ---

/**
 * Calculates the subtotal of the items in the cart.
 * NOTE: This function now needs the cart data passed to it.
 * @param {Array} cart - The cart array (fetched from server or local storage).
 * @returns {number} The calculated subtotal.
 */
function calculateSubtotal(cart) {
    if (!Array.isArray(cart)) {
        console.warn("calculateSubtotal received invalid cart data:", cart);
        return 0;
    }
    // Ensure properties used match the server response (e.g., price, quantity)
    return cart.reduce((sum, item) => {
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 0;
        return sum + (price * quantity);
    }, 0);
}


/**
 * Updates the cart item count display in the header.
 * Fetches cart data (server or local) to calculate count.
 */
async function updateCartCount() {
    const cartCountElement = document.getElementById('cart-item-count');
    if (!cartCountElement) {
        return; // Silently exit if element isn't on the page
    }

    let totalItems = 0;
    try {
        // Fetch the current cart state (handles logged-in vs guest automatically)
        const currentCart = await fetchCartFromServer();
        // Sum quantities from the fetched cart items
        totalItems = currentCart.reduce((sum, item) => sum + (item.quantity || 0), 0);
        console.log(`Updating cart count: ${totalItems}`);
    } catch (error) {
        // If fetchCartFromServer throws an auth error, handleAuthError would have run.
        console.error("Error calculating cart count:", error);
        totalItems = 0; // Default to 0 on error
    }

    cartCountElement.textContent = totalItems;
}

/**
 * Clears the cart (server-side if logged in, and local storage).
 * TODO: Implement server-side clearing endpoint.
 */
async function clearCart() {
    const token = getAuthToken();
    let clearedServer = false;

    if (token) {
        console.warn("clearCart: Server-side cart clearing not implemented yet.");
        // TODO: Implement DELETE /api/cart endpoint on backend
        /*
        try {
            const response = await fetch(`${API_BASE_URL}/cart`, {
                method: 'DELETE',
                headers: createAuthHeaders()
            });

            // Check for 401/403
            if (response.status === 401 || response.status === 403) {
                handleAuthError();
                return false; // Indicate failure
            }

            if (response.ok) {
                console.log("Cleared cart on server.");
                clearedServer = true;
            } else {
                const data = await response.json().catch(() => ({})); // Attempt to parse error
                console.error(`API Error (${response.status}) clearing cart: ${data.message || 'Failed request'}`);
            }
        } catch (error) {
            console.error("Failed to clear cart via API:", error);
        }
        */
        // For now, assume server clear worked if logged in, or proceed anyway
        clearedServer = true; // TEMPORARY until backend endpoint exists
    }

    // Always clear local storage
    saveCartToLocalStorage([]);
    console.log("Cleared cart in local storage.");

    // Update count after clearing, but catch errors here
    try {
        await updateCartCount();
    } catch (updateError) {
        // Log the error but don't re-throw, allowing clearCart to resolve
        console.error("Error updating cart count within clearCart:", updateError);
    }

    // Return true if guest or if server clear (or simulation) was successful
    return !token || clearedServer;
}

/**
 * Removes an item from the cart. Uses API if logged in, otherwise uses localStorage.
 * @param {string|number} productId - The ID of the product to remove.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function removeItemFromCart(productId) {
    const token = getAuthToken();

    if (token) {
        // --- Logged In: Use API ---
        console.log(`removeItemFromCart: User logged in, using API for product ${productId}.`);
        try {
            const response = await fetch(`${API_BASE_URL}/cart/items/${productId}`, {
                method: 'DELETE',
                headers: createAuthHeaders()
            });

            // Check for 401/403 specifically
            if (response.status === 401 || response.status === 403) {
                handleAuthError();
                return false; // Indicate failure
            }

            const data = await response.json().catch(() => ({})); // Attempt to parse JSON response, provide fallback

            if (response.ok) { // Status 200 OK
                console.log(`API: ${data.message || 'Item removed.'}`);
                await updateCartCount(); // Update count after successful API call
                return true;
            } else {
                // Handle 404 Not Found specifically
                if (response.status === 404) {
                    console.warn(`API Error removing item (${response.status}): ${data.message || 'Item not found in server cart.'}`);
                } else {
                    console.error(`API Error removing item (${response.status}): ${data.message || 'Failed request'}`);
                }
                alert(`Error: ${data.message || 'Could not remove item from cart.'}`);
                return false;
            }
        } catch (error) {
            console.error("Failed to remove item via API:", error);
            alert("An error occurred while removing the item. Please try again.");
            return false;
        }
    } else {
        // --- Not Logged In: Use LocalStorage ---
        console.log(`removeItemFromCart: User not logged in, using localStorage for product ${productId}.`);
        let cart = getCartFromLocalStorage();
        const initialLength = cart.length;
        // Ensure consistent ID types for comparison
        cart = cart.filter(item => String(item.id ?? item.productId) !== String(productId)); // Check both id and productId

        if (cart.length < initialLength) {
            saveCartToLocalStorage(cart); // Save the updated local cart
            await updateCartCount(); // Update count
            console.log(`Removed item ${productId} from local storage`);
            return true; // Indicate local success
        } else {
            console.warn(`Attempted to remove item ${productId} from local storage, but it was not found.`);
            return false;
        }
    }
}

/**
 * Updates the quantity of an item in the cart. Uses API if logged in, otherwise uses localStorage.
 * @param {string|number} productId - The ID of the product to update.
 * @param {number} quantity - The new quantity.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function updateItemQuantity(productId, quantity) {
    const token = getAuthToken();
    const newQuantity = Math.max(1, Number(quantity) || 1); // Ensure positive integer

    if (token) {
        // --- Logged In: Use API ---
        console.log(`updateItemQuantity: User logged in, using API for product ${productId} to quantity ${newQuantity}.`);
        try {
            const response = await fetch(`${API_BASE_URL}/cart/items/${productId}`, {
                method: 'PUT', // Use PUT method
                headers: createAuthHeaders(),
                body: JSON.stringify({ quantity: newQuantity }) // Send new quantity in body
            });

            // Check for 401/403 specifically
            if (response.status === 401 || response.status === 403) {
                handleAuthError();
                return false; // Indicate failure
            }

            const data = await response.json().catch(() => ({})); // Attempt to parse JSON response, provide fallback

            if (response.ok) { // Status 200 OK
                console.log(`API: ${data.message || 'Item quantity updated.'}`, data.item || '');
                await updateCartCount(); // Update count after successful API call
                return true;
            } else {
                // Handle 404 Not Found specifically
                if (response.status === 404) {
                    console.warn(`API Error updating quantity (${response.status}): ${data.message || 'Item not found in server cart.'}`);
                } else {
                    console.error(`API Error updating quantity (${response.status}): ${data.message || 'Failed request'}`);
                }
                alert(`Error: ${data.message || 'Could not update item quantity.'}`);
                return false;
            }
        } catch (error) {
            console.error("Failed to update quantity via API:", error);
            alert("An error occurred while updating the item quantity. Please try again.");
            return false;
        }
    } else {
        // --- Not Logged In: Use LocalStorage ---
        console.log(`updateItemQuantity: User not logged in, using localStorage for product ${productId} to quantity ${newQuantity}.`);
        let cart = getCartFromLocalStorage();
        // Ensure consistent ID types
        const itemIndex = cart.findIndex(item => String(item.id ?? item.productId) === String(productId));

        if (itemIndex > -1) {
            if (cart[itemIndex].quantity !== newQuantity) {
                cart[itemIndex].quantity = newQuantity;
                saveCartToLocalStorage(cart);
                await updateCartCount(); // Update count
                console.log(`Updated quantity for ${productId} to ${newQuantity} in local storage`);
                return true;
            }
            return false; // Quantity didn't change
        } else {
            console.warn(`Attempted to update quantity for item ${productId} in local storage, but it was not found.`);
            return false;
        }
    }
}

// --- Export Functions ---
export {
    getAuthToken,
    createAuthHeaders,
    handleAuthError, // <<< ENSURE THIS IS INCLUDED
    fetchCartFromServer, // Use this to get cart data
    addItemToCart, // Handles both API and local
    updateCartCount,
    calculateSubtotal, // Needs cart data passed in
    clearCart,
    removeItemFromCart, // Handles both API and local now
    updateItemQuantity, // Handles both API and local now
    // Keep local storage functions if needed directly elsewhere
    getCartFromLocalStorage,
    saveCartToLocalStorage,
    setIsGuest
};




