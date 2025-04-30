// js/checkout.js
import {
    fetchCartFromServer, // Use this
    calculateSubtotal,
    updateCartCount,
    clearCart, // Import clearCart if you intend to clear it after order placement
    // --- ADDED createAuthHeaders and getAuthToken ---
    createAuthHeaders,
    getAuthToken,
    // --- ADDED getCartFromLocalStorage ---
    getCartFromLocalStorage
    // --- END ADD ---
    // other imports...
} from './cart-utils.js';

// --- ADDED API_BASE_URL ---
const API_BASE_URL = 'http://127.0.0.1:3000/api';
// --- END ADD ---

// --- DOM Elements ---
// (Make sure you have variables for summary elements)
const summaryContainer = document.getElementById('checkout-order-summary');
const summarySubtotalEl = document.getElementById('summary-subtotal');
const summaryShippingEl = document.getElementById('summary-shipping');
const summaryTotalEl = document.getElementById('summary-total');
const checkoutForm = document.getElementById('checkout-form');
// ... other form elements ...
const sameAsShippingCheckbox = document.getElementById('same-as-shipping');
const billingAddressForm = document.getElementById('billing-address-form');


// --- Display Order Summary ---
// Ensure this function is ASYNC
async function displayOrderSummary() {
    if (!summaryContainer || !summarySubtotalEl || !summaryShippingEl || !summaryTotalEl) {
        console.error("One or more summary elements not found!");
        return;
    }

    // Corrected HTML entities
    summaryContainer.innerHTML = '<p>Loading summary...</p>'; // Show loading state

    // Use await here - requires the function to be async
    const cart = await fetchCartFromServer(); // Handles guest vs logged-in
    console.log("Checkout - Fetched cart for summary:", cart);

    summaryContainer.innerHTML = ''; // Clear loading message

    if (!Array.isArray(cart) || cart.length === 0) {
        // Corrected HTML entities
        summaryContainer.innerHTML = '<p>Your cart is empty.</p>';
        // Optionally disable form submission
        checkoutForm?.querySelector('button[type="submit"]')?.setAttribute('disabled', 'true');
        // Set totals to 0
        summarySubtotalEl.textContent = '$0.00';
        summaryShippingEl.textContent = '$0.00'; // Or handle based on default method
        summaryTotalEl.textContent = '$0.00';
        return;
    }

    // Enable form submission if cart is not empty
     checkoutForm?.querySelector('button[type="submit"]')?.removeAttribute('disabled');

    cart.forEach(item => {
        // --- UPDATED VALIDATION AND PROPERTY ACCESS ---
        // Check for either 'id' (local) or 'productId' (server)
        const itemId = item.id ?? item.productId; // Use nullish coalescing

        // Validate essential properties
        if (!item || typeof itemId === 'undefined' || typeof item.name === 'undefined' || typeof item.price === 'undefined' || typeof item.quantity === 'undefined') {
            console.warn("Skipping invalid cart item in summary:", item);
            return;
        }
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 0;
        const itemElement = document.createElement('div');
        itemElement.classList.add('summary-item');
        // Corrected HTML entities
        itemElement.innerHTML = `
            <span class="summary-item-name">${item.name} (x${quantity})</span>
            <span class="summary-item-price">$${(price * quantity).toFixed(2)}</span>
        `;
        summaryContainer.appendChild(itemElement);
    });

    // Calculate and display totals
    updateSummaryTotals(cart);
}

// --- Calculate and Update Totals ---
function updateSummaryTotals(cart) {
    const subtotal = calculateSubtotal(cart);
    // TODO: Get shipping cost based on selected method
    const shippingCost = 5.00; // Placeholder
    const total = subtotal + shippingCost;

    if (summarySubtotalEl) summarySubtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (summaryShippingEl) summaryShippingEl.textContent = `$${shippingCost.toFixed(2)}`;
    if (summaryTotalEl) summaryTotalEl.textContent = `$${total.toFixed(2)}`;
}


// --- Form Handling & Validation ---
// --- ADDED Basic Validation Helpers ---
function showError(field, message) {
    // Basic implementation - replace with your actual validation UI logic
    console.error(`Validation Error for ${field.id || field.name}: ${message}`);
    field.style.border = '1px solid red'; // Example visual feedback
}
function clearError(field) {
    // Basic implementation - replace with your actual validation UI logic
    field.style.border = ''; // Remove visual feedback
}
// --- END Validation Helpers ---


// --- Main Execution ---
// Ensure the DOMContentLoaded listener is ASYNC
document.addEventListener('DOMContentLoaded', async () => {

    // --- REMOVED: Redirect if not logged in ---
    // if (!getAuthToken()) { ... } block was removed here to allow guests
    // --- END REMOVAL ---

    // Initial UI setup
    updateCartCount(); // Update header count
    await displayOrderSummary(); // Await the summary display

    // --- Billing Address Toggle ---
    if (sameAsShippingCheckbox && billingAddressForm) {
        sameAsShippingCheckbox.addEventListener('change', () => {
            billingAddressForm.classList.toggle('hidden', sameAsShippingCheckbox.checked);
            // Add/remove 'required' attributes on billing fields if needed for validation
            const billingInputs = billingAddressForm.querySelectorAll('input, select');
            billingInputs.forEach(input => {
                if (!sameAsShippingCheckbox.checked) {
                    input.setAttribute('required', 'true');
                } else {
                    input.removeAttribute('required');
                    clearError(input); // Clear errors when hiding
                }
            });
        });
        // Initial check in case the checkbox starts unchecked (though default is checked)
        billingAddressForm.classList.toggle('hidden', sameAsShippingCheckbox.checked);
        // Set initial required state
        const billingInputs = billingAddressForm.querySelectorAll('input, select');
         billingInputs.forEach(input => {
             if (!sameAsShippingCheckbox.checked) {
                 input.setAttribute('required', 'true');
             } else {
                 input.removeAttribute('required');
             }
         });
    }

    // --- Form Submission --- // <<< REPLACED BLOCK START >>>
    if (checkoutForm) {
        const placeOrderButton = checkoutForm.querySelector('.btn-place-order'); // Define button here

        checkoutForm.addEventListener('submit', async (event) => { // Make submit handler async
            event.preventDefault();
            console.log("Checkout form submitted");

            // --- Client-side Validation ---
            let isFormValid = true;
            const requiredFields = checkoutForm.querySelectorAll('[required]');
            checkoutForm.querySelectorAll('input, select').forEach(clearError); // Clear previous errors
            requiredFields.forEach(field => {
                if (sameAsShippingCheckbox?.checked && field.closest('#billing-address-form')) return;
                if (!field.value.trim()) {
                    showError(field, `${field.previousElementSibling?.textContent || 'Field'} is required.`);
                    if (isFormValid) field.focus();
                    isFormValid = false;
                }
            });
            if (!isFormValid) {
                console.log("Checkout form validation failed.");
                alert("Please fill out all required fields.");
                return;
            }
            console.log("Checkout form is valid (client-side). Preparing order data...");

            // Disable button
            if (placeOrderButton) {
                placeOrderButton.disabled = true;
                placeOrderButton.textContent = 'Placing Order...';
            }

            // --- Prepare Order Data ---
            const formData = new FormData(checkoutForm);
            const shippingAddress = {
                name: formData.get('shipping_name'), address1: formData.get('shipping_address1'),
                address2: formData.get('shipping_address2') || '', city: formData.get('shipping_city'),
                state: formData.get('shipping_state'), zip: formData.get('shipping_zip'),
                country: formData.get('shipping_country'), phone: formData.get('shipping_phone')
            };
            let billingAddress = null;
            if (sameAsShippingCheckbox && !sameAsShippingCheckbox.checked) {
                billingAddress = {
                    name: formData.get('billing_name'), address1: formData.get('billing_address1'),
                    address2: formData.get('billing_address2') || '', city: formData.get('billing_city'),
                    state: formData.get('billing_state'), zip: formData.get('billing_zip'),
                    country: formData.get('billing_country')
                };
            }
            const shippingAddressString = JSON.stringify(shippingAddress);
            const billingAddressString = billingAddress ? JSON.stringify(billingAddress) : null;
            const shippingMethod = formData.get('shipping_method');

            // --- Prepare Request Body (Handles Guest vs Logged In) ---
            const isLoggedIn = !!getAuthToken();
            const requestBody = {
                shipping_address: shippingAddressString,
                billing_address: billingAddressString,
                shipping_method: shippingMethod
            };

            if (!isLoggedIn) {
                // For guests, get cart from local storage and add to body
                const guestCart = getCartFromLocalStorage(); // Use imported function
                if (!Array.isArray(guestCart) || guestCart.length === 0) {
                    alert("Your cart is empty. Cannot place order.");
                    if (placeOrderButton) { placeOrderButton.disabled = false; placeOrderButton.textContent = 'Place Order'; }
                    return;
                }
                // Ensure items have needed properties (productId, quantity, price) for backend guest processing
                requestBody.items = guestCart.map(item => ({
                    productId: item.id, // Map local 'id' to 'productId'
                    quantity: item.quantity,
                    price: item.price // Send price from local cart for guest
                }));
                 // Basic validation before sending
                 if (requestBody.items.some(item => !item.productId || isNaN(item.quantity) || item.quantity <= 0 || isNaN(item.price))) {
                     alert("There was an issue with the items in your cart. Please refresh and try again.");
                     if (placeOrderButton) { placeOrderButton.disabled = false; placeOrderButton.textContent = 'Place Order'; }
                     return;
                 }
                console.log("Guest checkout: Sending items in request body:", requestBody.items);
            }
            // --- End Prepare Request Body ---


            // --- Send Order Data to Backend ---
            try {
                const response = await fetch(`${API_BASE_URL}/orders`, {
                    method: 'POST',
                    // createAuthHeaders only adds Authorization if token exists
                    headers: createAuthHeaders(),
                    body: JSON.stringify(requestBody) // Send the prepared body
                });
                const result = await response.json();

                if (response.ok) {
                    console.log("Order placed successfully:", result);
                    // Clear local cart regardless of login status AFTER successful order
                    await clearCart(); // clearCart clears local storage and updates count

                    window.location.href = `thankyou.html?orderId=${result.orderId}`; // Redirect immediately

                } else {
                    console.error(`Order placement failed (${response.status}):`, result.message);
                    throw new Error(result.message || 'Order placement failed. Please try again.');
                }
            } catch (error) {
                console.error("Caught Error Type:", error.name);
                console.error("Caught Error Message:", error.message);
                console.error("Full Caught Error Object:", error);
                alert(`Order placement failed: ${error.message || 'An unknown error occurred. Check console.'}`);
                if (placeOrderButton) {
                    placeOrderButton.disabled = false;
                    placeOrderButton.textContent = 'Place Order';
                }
            }
            // <<< END Send Order Data >>>

        });
    } else {
         console.error("Checkout form not found.");
    }
    // --- Form Submission --- // <<< REPLACED BLOCK END >>>

    // ... other event listeners if needed ...

}); // End DOMContentLoaded
