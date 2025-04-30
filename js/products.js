// js/products.js

// Simple product database simulation
const products = [
    {
        id: "prod101",
        name: "Sample Product One",
        price: 19.99,
        image: "images/product-placeholder.png", // Use specific image if available
        description: "This is a fantastic sample product with amazing features. It's perfect for everyday use and offers great value.",
        specs: [
            "Feature A: High quality material",
            "Feature B: Easy to use",
            "Feature C: Available in multiple colors"
        ]
    },
    {
        id: "prod102",
        name: "Another Cool Item",
        price: 25.49,
        image: "images/product-placeholder.png", // Use specific image if available
        description: "Discover the coolness of this item. It's designed for enthusiasts who demand performance and style.",
        specs: [
            "Spec X: Lightweight design",
            "Spec Y: Long battery life",
            "Spec Z: Water resistant"
        ]
    },
    {
        id: "prod103",
        name: "Widget Pro",
        price: 99.00,
        image: "images/product-placeholder.png", // Use specific image if available
        description: "The Widget Pro takes widgets to the next level. Unmatched power and precision for professionals.",
        specs: [
            "Pro Feature 1: Enhanced durability",
            "Pro Feature 2: Advanced settings",
            "Pro Feature 3: Premium finish"
        ]
    },
    {
        id: "prod104",
        name: "Basic Gadget",
        price: 12.50,
        image: "images/product-placeholder.png", // Use specific image if available
        description: "A simple, reliable gadget that gets the job done without fuss. Great for beginners or as a backup.",
        specs: [
            "Simplicity: One-button operation",
            "Reliability: Built to last",
            "Affordability: Excellent price point"
        ]
    }
];

// Function to find a product by its ID
// Added export keyword directly to the function definition
export function findProductById(productId) {
    // Use === for strict equality comparison
    return products.find(product => product.id === productId);
}

// No need to export the 'products' array unless specifically needed elsewhere
// export { products, findProductById }; // This line is no longer needed if exporting directly

