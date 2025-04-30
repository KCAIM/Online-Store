// js/cart.js
// Import necessary functions from the utility module
import {
    fetchCartFromServer,
    updateCartCount,
    removeItemFromCart,
    updateItemQuantity,
    calculateSubtotal,
    getAuthToken // Added import for getAuthToken
} from './cart-utils.js';

document.addEventListener('DOMContentLoaded', async () => { // Made async

    // --- DOM Elements ---
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartSubtotalElement = document.getElementById('cart-subtotal');
    // const checkoutLink = document.getElementById('checkout-link'); // Removed - now dynamic
    const cartSummarySection = document.getElementById('cart-summary-section');

    // --- Cart Display Functions ---
    async function displayCartItems() { // Made async
        // Fetch cart data using the new function
        const cart = await fetchCartFromServer();
        console.log("Displaying cart items:", cart); // Log fetched data

        if (!cartItemsContainer) {
            console.error("Cart items container not found!");
            return;
        }
        cartItemsContainer.innerHTML = ''; // Clear previous items

        // Check if cart is an array and has items
        if (!Array.isArray(cart) || cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-cart-message">Your shopping cart is empty.</p>';
            if (cartSummarySection) cartSummarySection.style.display = 'none';
            // Removed logic for disabling static checkoutLink
        } else {
            // --- UPDATED cart.forEach LOOP ---
            cart.forEach(item => {
                // Check for either 'id' (local) or 'productId' (server)
                const itemId = item.id ?? item.productId; // Use nullish coalescing to get the correct ID

                // Validate essential properties, using the determined itemId
                if (!item || typeof itemId === 'undefined' || typeof item.name === 'undefined' || typeof item.price === 'undefined' || typeof item.quantity === 'undefined') {
                    console.warn("Skipping invalid cart item:", item);
                    return;
                }

                const itemElement = document.createElement('div');
                itemElement.classList.add('cart-item');
                itemElement.dataset.productId = itemId; // Use itemId for dataset attribute

                const imageUrl = item.image || 'images/product-placeholder.png';
                const price = Number(item.price) || 0;
                const quantity = Number(item.quantity) || 0;
                const itemTotal = (price * quantity).toFixed(2);

                itemElement.innerHTML = `
                    <div class="cart-item-image">
                        <img src="${imageUrl}" alt="${item.name}">
                    </div>
                    <div class="cart-item-details">
                        <h3>${item.name}</h3>
                        <p>Price: $${price.toFixed(2)}</p>
                        <p>Total: <strong>$${itemTotal}</strong></p>
                    </div>
                    <div class="cart-item-actions">
                        <label for="qty-${itemId}">Qty:</label>
                        <input type="number" id="qty-${itemId}" class="item-quantity" value="${quantity}" min="1" data-product-id="${itemId}" aria-label="Quantity for ${item.name}">
                        <button class="btn btn-secondary btn-remove-item" data-product-id="${itemId}" aria-label="Remove ${item.name}">Remove</button>
                    </div>
                `;
                cartItemsContainer.appendChild(itemElement);
            });
            // --- END OF UPDATED cart.forEach LOOP ---

            // --- START: Dynamic Checkout Button Logic ---
            if (cartSummarySection) {
                cartSummarySection.style.display = 'block';
                // Check user authentication status
                const isLoggedIn = !!getAuthToken(); // Use getAuthToken directly

                // Get the checkout options container
                const checkoutOptionsContainer = document.getElementById('checkout-options');
                if (checkoutOptionsContainer) { // Check if container exists
                    checkoutOptionsContainer.innerHTML = ''; // Clear any existing buttons

                    if (isLoggedIn) {
                        // Logged-in user: Show "Proceed to Checkout"
                        const checkoutButton = document.createElement('a');
                        checkoutButton.id = 'checkout-link'; // Keep ID if needed elsewhere
                        // --- Updated href for logged-in user as well ---
                        checkoutButton.href = 'checkout.html'; // Redirect to checkout.html
                        // --- End of update ---
                        checkoutButton.classList.add('btn', 'btn-primary', 'btn-checkout');
                        checkoutButton.textContent = 'Proceed to Checkout';
                        checkoutOptionsContainer.appendChild(checkoutButton);
                    } else {
                        // Guest user: Show "Sign In" and "Guest Checkout"
                        const signInButton = document.createElement('a');
                        signInButton.href = 'login.html';
                        signInButton.classList.add('btn', 'btn-primary');
                        signInButton.textContent = 'Sign In';

                        const guestCheckoutButton = document.createElement('button');
                        guestCheckoutButton.id = 'guest-checkout-button';
                        guestCheckoutButton.classList.add('btn', 'btn-secondary');
                        guestCheckoutButton.textContent = 'Guest Checkout';
                        guestCheckoutButton.addEventListener('click', () => {
                            console.log("Proceeding as Guest to checkout page");
                            // --- THIS LINE WAS CHANGED ---
                            window.location.href = 'checkout.html'; // Redirect to checkout.html
                            // --- END OF CHANGE ---
                        });

                        checkoutOptionsContainer.appendChild(signInButton);
                        checkoutOptionsContainer.appendChild(guestCheckoutButton);
                    }
                } else {
                    console.error("Checkout options container '#checkout-options' not found!");
                }
            }
            // --- END: Dynamic Checkout Button Logic ---
        }
        // Update subtotal display using the fetched cart data
        updateDisplaySubtotal(cart); // Pass the fetched cart
    }

    // Function to prevent clicking the disabled checkout link (No longer needed for dynamic buttons)
    // function preventDisabledLinkClick(event) { ... }

    // This function updates the *display* using the imported calculation
    // Now accepts cart data as argument
    function updateDisplaySubtotal(cart) {
        const subtotal = calculateSubtotal(cart); // Pass cart data to calculator
        console.log("Calculated Subtotal:", subtotal); // Log subtotal calculation
        if (cartSubtotalElement) {
            cartSubtotalElement.textContent = `$${subtotal.toFixed(2)}`;
            console.log("Updated subtotal element:", cartSubtotalElement); // Log element update
        } else {
             console.error("Cart subtotal element not found!");
        }
    }

    // --- Event Listeners for Cart Actions (Using Delegation) ---
    if (cartItemsContainer) {

        // Listener for CLICK events (handles Remove button)
        cartItemsContainer.addEventListener('click', async (event) => { // Make listener async
            const target = event.target;
            const removeButton = target.closest('.btn-remove-item');
            if (removeButton) {
                // Prevent multiple clicks while processing
                removeButton.disabled = true;

                const productIdString = removeButton.dataset.productId;
                // Use consistent ID type (string or number based on cart-utils expectation)
                const productId = productIdString; // Keep as string if cart-utils expects string

                if (productId) { // Check if productId is truthy
                    console.log(`Remove button clicked for product ID: ${productId}`);
                    // Call the updated async removeItemFromCart
                    const success = await removeItemFromCart(productId);

                    if (success) {
                        // Re-fetch and display the cart after successful removal
                        await displayCartItems();
                    } else {
                        console.warn(`Failed to remove item with ID: ${productId}`);
                        alert("Could not remove item.");
                        // Re-enable button on failure if it still exists (it might be removed by redraw)
                        if (document.body.contains(removeButton)) {
                             removeButton.disabled = false;
                        }
                    }
                } else {
                     console.error("Could not get product ID from remove button:", removeButton);
                     removeButton.disabled = false; // Re-enable button on error
                }
            }
        }); // --- END OF CLICK LISTENER ---

        // Listener for CHANGE events (handles Quantity input)
        cartItemsContainer.addEventListener('change', async (event) => { // Make listener async
            const target = event.target;
            if (target.classList.contains('item-quantity')) {
                // Disable input temporarily
                target.disabled = true;

                const productIdString = target.dataset.productId;
                // Use consistent ID type
                const productId = productIdString; // Keep as string if cart-utils expects string
                let newQuantity = parseInt(target.value, 10);

                if (!productId) { // Check if productId is truthy
                    console.error("Could not get product ID from quantity input:", target);
                    await displayCartItems(); // Re-render to potentially reset state
                    return; // Exit early
                }

                // Validate quantity (ensure it's at least 1)
                if (isNaN(newQuantity) || newQuantity < 1) {
                    newQuantity = 1;
                    console.log(`Invalid quantity for ID ${productId}, attempting to set to 1`);
                }

                console.log(`Quantity change event for product ID: ${productId} to ${newQuantity}`);

                // Call the updated async updateItemQuantity
                const success = await updateItemQuantity(productId, newQuantity);

                if (success) {
                    // Re-fetch and display the cart after successful update
                    await displayCartItems();
                } else {
                    console.warn(`Failed to update quantity for item ID: ${productId}`);
                    alert("Could not update quantity.");
                    // Re-fetch and display cart to revert potential optimistic UI changes
                    await displayCartItems();
                }
                // The input should be re-enabled by the redraw in displayCartItems
            }
        }); // --- END OF CHANGE LISTENER ---

    } else {
        console.error("Cart items container '#cart-items-container' not found on page load.");
    }

    // --- Initial Page Load ---
    await displayCartItems(); // Await the async display function

}); // End DOMContentLoaded


