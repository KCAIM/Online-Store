// js/product.js
import { addItemToCart, updateCartCount } from './cart-utils.js'; // Import cart functions
import { findProductById } from './products.js'; // Import product lookup

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    // Added checks for element existence
    const productNameElement = document.getElementById('product-name');
    const productPriceElement = document.getElementById('product-price');
    const productImageElement = document.getElementById('product-image');
    const productDescriptionElement = document.getElementById('product-description');
    const productSpecsList = document.getElementById('product-specs')?.querySelector('ul'); // Safer query
    const addToCartButton = document.getElementById('detail-add-to-cart-btn');
    const productBreadcrumbName = document.getElementById('product-breadcrumb-name');
    // No need for cartCountElement here, updateCartCount handles it

    // --- Cart Functions Removed (Now Imported) ---
    // function getCart() { ... } removed
    // function saveCart(cart) { ... } removed
    // function updateCartCount() { ... } removed
    // function addItemToCart(item) { ... } removed

    // --- Product Detail Logic ---
    function getProductIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    function displayProductDetails(productId) {
        // Use the imported findProductById function
        const product = findProductById(productId);

        // Check if essential elements exist before trying to update them
        if (!productNameElement || !productPriceElement || !productImageElement || !productDescriptionElement || !productSpecsList || !addToCartButton) {
            console.error("One or more essential product detail elements are missing from the page.");
            return; // Stop execution if elements are missing
        }

        if (product) {
            // Update the page elements with product data
            document.title = `${product.name} - My Awesome Store`; // Update page title
            productNameElement.textContent = product.name;
            productPriceElement.textContent = `$${product.price.toFixed(2)}`;
            productImageElement.src = product.image || 'images/product-placeholder.png'; // Use fallback image
            productImageElement.alt = product.name;
            productDescriptionElement.innerHTML = `<p>${product.description || 'No description available.'}</p>`; // Use innerHTML safely, provide fallback

            // Populate specifications list
            productSpecsList.innerHTML = ''; // Clear loading/previous text
            if (product.specs && product.specs.length > 0) {
                 product.specs.forEach(spec => {
                    const li = document.createElement('li');
                    li.textContent = spec;
                    productSpecsList.appendChild(li);
                });
            } else {
                 // Provide feedback if no specs are available
                 const li = document.createElement('li');
                 li.textContent = 'No specifications available.';
                 productSpecsList.appendChild(li);
            }


            // Update breadcrumbs (optional)
            if (productBreadcrumbName) productBreadcrumbName.textContent = product.name;

            // Enable the Add to Cart button and set its data attribute
            addToCartButton.disabled = false;
            addToCartButton.dataset.productId = product.id; // Store ID for the click handler

        } else {
            // Handle case where product ID is not found
            productNameElement.textContent = "Product Not Found";
            productDescriptionElement.innerHTML = '<p>Sorry, the product you are looking for does not exist.</p>';
            productPriceElement.textContent = '';
            productSpecsList.innerHTML = '';
            addToCartButton.disabled = true;
            console.error(`Product with ID ${productId} not found.`);
        }
    }

    // --- Event Listener for Add to Cart ---
    // Check if button exists before adding listener
    if (addToCartButton) {
        addToCartButton.addEventListener('click', () => {
            const productId = addToCartButton.dataset.productId;
            // Use imported findProductById
            const product = findProductById(productId);
            if (product) {
                // Create item object matching the structure expected by cart-utils addItemToCart
                const itemToAdd = {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.image // Include image
                };
                // Use imported addItemToCart
                addItemToCart(itemToAdd);

                // Add visual feedback
                addToCartButton.textContent = 'Added!';
                addToCartButton.disabled = true;
                setTimeout(() => {
                    // Check if button still exists in DOM before updating
                    if (document.body.contains(addToCartButton)) {
                        addToCartButton.textContent = 'Add to Cart';
                        addToCartButton.disabled = false;
                    }
                }, 1500); // Revert after 1.5 seconds
            } else {
                console.error("Could not add item to cart: Product data missing for ID:", productId);
            }
        });
    } else {
         console.warn("Add to cart button ('detail-add-to-cart-btn') not found.");
    }


    // --- Initial Page Load ---
    const productId = getProductIdFromUrl();
    if (productId) {
        displayProductDetails(productId);
    } else {
        // Handle case where no ID is in the URL - Ensure elements exist before updating
        if (productNameElement) productNameElement.textContent = "No Product Specified";
        if (productDescriptionElement) productDescriptionElement.innerHTML = '<p>Please select a product from the store.</p>';
        if (addToCartButton) addToCartButton.disabled = true;
        console.error("No product ID found in URL.");
    }
    // Update header cart count on load using imported function
    updateCartCount();

}); // End DOMContentLoaded

