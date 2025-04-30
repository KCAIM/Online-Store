// js/main.js
import { addItemToCart, updateCartCount, clearCart } from './cart-utils.js'; // Added clearCart import

const API_BASE_URL = 'https://online-store-i8da.onrender.com/api';

let allProducts = []; // Variable to store fetched products

// --- Authentication UI Elements ---
const loggedOutLinks = document.getElementById('logged-out-links');
const loggedInLinks = document.getElementById('logged-in-links');
const accountLink = document.getElementById('account-link'); // Optional: for displaying username
const logoutButton = document.getElementById('logout-button');
// --- End Authentication UI Elements ---

/**
 * Renders an array of product objects into the product list container.
 * @param {Array} products - Array of product objects from the API.
 * @param {HTMLElement} container - The HTML element to render products into.
 */
function renderProducts(products, container) {
    container.innerHTML = ''; // Clear loading message or previous products

    if (!products || products.length === 0) {
        // --- FIX: Corrected HTML entities ---
        container.innerHTML = '<p>No products found.</p>';
        // --- End Fix ---
        return;
    }

    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        const price = Number(product.price) || 0;
        // --- FIX: Corrected HTML entities ---
        productCard.innerHTML = `
            <img src="${product.image_url || 'images/placeholder.png'}" alt="${product.name}" class="product-image">
            <h3 class="product-name">${product.name}</h3>
            <p class="product-price">$${price.toFixed(2)}</p>
            <p class="product-description">${product.description || ''}</p>
            <button class="btn add-to-cart-btn" data-product-id="${product.id}">Add to Cart</button>
        `;
        // --- End Fix ---
        container.appendChild(productCard);
    });
}

/**
 * Fetches products from the API and calls the render function.
 */
async function fetchAndDisplayProducts() {
    const productListContainer = document.getElementById('product-list');
    if (!productListContainer) {
        console.error("Product list container '#product-list' not found.");
        return;
    }
    // --- FIX: Corrected HTML entities ---
    productListContainer.innerHTML = '<p>Loading products...</p>';
    // --- End Fix ---

    try {
        const response = await fetch(`${API_BASE_URL}/products`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const products = await response.json();
        allProducts = products; // Store fetched products
        renderProducts(products, productListContainer);

    } catch (error) {
        console.error("Failed to fetch products:", error);
        // --- FIX: Corrected HTML entities ---
        productListContainer.innerHTML = '<p>Sorry, we could not load products at this time. Please try again later.</p>';
        // --- End Fix ---
    }
}

/**
 * Handles clicks within the product list container for adding items to cart.
 * @param {Event} event - The click event object.
 */
async function handleProductListClick(event) {
    const clickedButton = event.target.closest('.add-to-cart-btn');

    if (clickedButton) {
        // Assuming numeric IDs from backend based on server.js schema
        const productId = parseInt(clickedButton.dataset.productId, 10);
        // Check if parseInt resulted in a valid number
        if (isNaN(productId)) {
            console.error("Invalid product ID found on button:", clickedButton.dataset.productId);
            return;
        }
        console.log(`Add to Cart clicked for product ID: ${productId}`);

        // Find the product details from the stored list
        const productToAdd = allProducts.find(p => p.id === productId);

        if (productToAdd) {
            // Prepare item object for cart-utils
            const item = {
                id: productToAdd.id,
                name: productToAdd.name,
                price: productToAdd.price,
                image: productToAdd.image_url // Use image_url from backend data
            };
            const success = await addItemToCart(item); // Add item using imported function

            if(success){
                console.log(`Added ${productToAdd.name} to cart.`);
                // Optional: Provide visual feedback on the button
                clickedButton.textContent = 'Added!';
                clickedButton.disabled = true;
                setTimeout(() => {
                    // Check if button still exists in DOM before updating
                    if (document.body.contains(clickedButton)) {
                        clickedButton.textContent = 'Add to Cart';
                        clickedButton.disabled = false;
                    }
                }, 1500);
            } else {
                console.error(`Error adding Product ${productToAdd.name} (ID: ${productToAdd.id}) to cart.`);
                // No alert here, addItemToCart handles alerts for API errors
            }

        } else {
            console.error(`Product details not found locally for ID: ${productId}. Refetching products might be needed.`);
            alert('Could not add item to cart. Product details missing.'); // Inform user
            // Optionally reload the page or refetch products if local cache might be stale
            // fetchAndDisplayProducts();
        }
    }
}


// --- Authentication Functions ---

/**
 * Checks if a user token exists in localStorage.
 * @returns {boolean} True if logged in, false otherwise.
 */
function checkLoginStatus() {
    // Check for the presence of the auth token
    const token = localStorage.getItem('authToken');
    // Optional: Add token validation/decoding here if needed later
    return !!token; // Returns true if token exists (basic check), false otherwise
}

/**
 * Updates the header links based on login status.
 */
function updateHeaderUI() {
    const isLoggedIn = checkLoginStatus();

    // Use optional chaining ?. to safely access classList even if elements are null
    if (isLoggedIn) {
        loggedOutLinks?.classList.add('hidden');
        loggedInLinks?.classList.remove('hidden');

        // Optional: Display username if stored
        try {
            // Ensure userInfo exists and is valid JSON before parsing
            const userInfoString = localStorage.getItem('userInfo');
            if (userInfoString) {
                 const userInfo = JSON.parse(userInfoString);
                 if (userInfo && userInfo.name && accountLink) {
                      // Keep it as "Account" or customize:
                      // accountLink.textContent = `Hi, ${userInfo.name.split(' ')[0]}`; // Display first name
                  }
            } else {
                // If logged in but no userInfo, maybe clear token? Or attempt fetch?
                // For now, just means we can't display the name.
                console.warn("Logged in but user info not found in localStorage.");
            }
        } catch (e) {
            console.error("Error parsing user info from localStorage", e);
            // Optionally clear potentially corrupted user info and token
             localStorage.removeItem('userInfo');
             // localStorage.removeItem('authToken'); // Consider if this implies logout
             // handleAuthError(); // Or trigger full logout
        }

    } else {
        loggedOutLinks?.classList.remove('hidden');
        loggedInLinks?.classList.add('hidden');
    }
}

/**
 * Handles the logout process.
 */
async function handleLogout() {
    console.log('Logging out...');
    // Remove token and user info from localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo'); // Remove user info if you stored it

    // Update the header UI immediately
    updateHeaderUI();

    // Optional: Redirect to homepage after logout
    // window.location.href = 'index.html';

    // Clear the cart upon logout
     await clearCart(); // clearCart now handles local/API clearing logic
     // updateCartCount is called within clearCart, no need to call again here

    alert("You have been logged out."); // Simple feedback
}

// --- End Authentication Functions ---


// --- Main Execution ---
document.addEventListener('DOMContentLoaded', () => {

    // --- Mobile Menu Logic ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('is-open');
            mobileMenuButton.classList.toggle('is-active');
            document.body.classList.toggle('mobile-nav-open');
            const isExpanded = mobileMenuButton.getAttribute('aria-expanded') === 'true';
            mobileMenuButton.setAttribute('aria-expanded', !isExpanded);
        });
        mobileMenu.addEventListener('click', (event) => {
            // Close menu if a link inside it is clicked
            if (event.target.tagName === 'A' && event.target.closest('#mobile-menu')) {
                 mobileMenu.classList.remove('is-open');
                 mobileMenuButton.classList.remove('is-active');
                 document.body.classList.remove('mobile-nav-open');
                 mobileMenuButton.setAttribute('aria-expanded', 'false');
            }
        });
    } else {
        console.warn("Mobile menu button or menu container not found.");
    }
    // --- End Mobile Menu Logic ---


    // --- Fetch and Display Products ---
    const productListContainer = document.getElementById('product-list');
    if (productListContainer) {
        fetchAndDisplayProducts(); // Fetch and render products
        productListContainer.addEventListener('click', handleProductListClick); // Add listener for clicks
    }
    // --- End Fetch and Display Products ---


    // --- Authentication UI Setup ---
    updateHeaderUI(); // Update header on initial load

    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    } else {
        // Check if we are potentially logged in but the button is missing
        if (checkLoginStatus()) {
             console.warn("Logout button not found, but user appears logged in.");
        }
    }
    // --- End Authentication UI Setup ---


    // --- Other global JS ---
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // --- Initial Cart Count Update ---
    updateCartCount(); // Update cart count display on initial page load

}); // End DOMContentLoaded

