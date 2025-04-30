// js/script.js
import { addItemToCart, updateCartCount } from './cart-utils.js';

document.addEventListener('DOMContentLoaded', () => {

    const productGrid = document.querySelector('.product-grid');
    // No need for cartCountElement here, updateCartCount handles finding it

    // --- Add to Cart Event Listener (Existing Code) ---
    if (productGrid) {
        productGrid.addEventListener('click', (event) => {
            const button = event.target.closest('.js-add-to-cart-btn');
            if (button) {
                const card = button.closest('.product-card');
                if (card) {
                    // ... (existing add to cart logic) ...
                    const productId = card.dataset.productId;
                    const productName = card.dataset.productName;
                    const productPrice = parseFloat(card.dataset.productPrice);
                    const productImage = card.querySelector('.product-image')?.src || 'images/product-placeholder.png';

                    if (productId && productName && !isNaN(productPrice)) {
                        const itemToAdd = {
                            id: productId,
                            name: productName,
                            price: productPrice,
                            image: productImage
                        };
                        addItemToCart(itemToAdd);
                        button.textContent = 'Added!';
                        button.disabled = true;
                        setTimeout(() => {
                            if (document.body.contains(button)) {
                                button.textContent = 'Add to Cart';
                                button.disabled = false;
                            }
                        }, 1500);
                    } else {
                        console.error('Product data attributes missing or invalid on card:', card);
                    }
                }
            }
        });
    } else {
        console.warn("Element with class '.product-grid' not found.");
    }

    // --- NEW: Search Bar Logic ---
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    // Get all cards initially, handle case where productGrid might be null
    const allProductCards = productGrid ? Array.from(productGrid.querySelectorAll('.product-card')) : [];

    function filterProducts() {
        // Ensure searchInput exists before accessing its value
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

        if (!productGrid) return; // Exit if grid doesn't exist

        let visibleCardsCount = 0; // Keep track of visible cards

        // Loop through all initially fetched product cards
        allProductCards.forEach(card => {
            // Get product name from data attribute or title element
            const productName = (card.dataset.productName || card.querySelector('.product-title')?.textContent || '').toLowerCase();

            // Check if product name includes the search term OR if search term is empty
            const isMatch = productName.includes(searchTerm) || searchTerm === '';

            // Set display based on match
            card.style.display = isMatch ? 'flex' : 'none'; // Use 'flex' as per your .product-card style

            if (isMatch) {
                visibleCardsCount++; // Increment count if card is shown
            }
        });

        // Handle "No results" message
        let noResultsMessage = productGrid.querySelector('.no-results-message');
        if (visibleCardsCount === 0 && searchTerm !== '') {
            // Create message if it doesn't exist
            if (!noResultsMessage) {
                noResultsMessage = document.createElement('p');
                noResultsMessage.classList.add('no-results-message');
                // Apply styles via CSS if possible, or inline as fallback
                noResultsMessage.style.gridColumn = '1 / -1'; // Span full grid width
                noResultsMessage.style.textAlign = 'center';
                noResultsMessage.style.marginTop = '20px';
                productGrid.appendChild(noResultsMessage);
            }
            // Use textContent for security
            noResultsMessage.textContent = `No products found matching "${searchInput.value.trim()}".`;
            noResultsMessage.style.display = 'block'; // Ensure it's visible
        } else if (noResultsMessage) {
            // Hide or remove message if results found or search cleared
            // noResultsMessage.remove(); // Or hide it:
             noResultsMessage.style.display = 'none';
        }
    }

    // Add event listener for search button click
    if (searchButton) {
        searchButton.addEventListener('click', filterProducts);
    } else {
        console.warn("Search button ('search-button') not found.");
    }

    // Add event listener for pressing Enter in the search input
    if (searchInput) {
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent potential form submission
                filterProducts();
            }
        });
        // Optional: Filter as user types (can be performance intensive on large lists)
        // searchInput.addEventListener('input', filterProducts);

        // Optional: Clear filter when search input is cleared (e.g., by clicking 'x')
        searchInput.addEventListener('search', () => {
            // The 'search' event fires when the input is cleared via the 'x' button
            // Check value just in case event fires unexpectedly
            if (searchInput.value === '') {
                filterProducts();
            }
        });
    } else {
         console.warn("Search input ('search-input') not found.");
    }

    // --- Initial Setup ---
    updateCartCount(); // Use imported function

}); // End DOMContentLoaded


