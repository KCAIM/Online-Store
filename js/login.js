// js/login.js
const API_BASE_URL = 'https://online-store-i8da.onrender.com/api';

document.addEventListener('DOMContentLoaded', () => { // Wrap in DOMContentLoaded
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const messageElement = document.getElementById('login-message');
    const submitButton = loginForm.querySelector('button[type="submit"]'); // Get submit button

    if (!loginForm || !emailInput || !passwordInput || !messageElement || !submitButton) {
        console.error("Login form elements not found!");
        return; // Stop if essential elements are missing
    }

    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault(); // Prevent the default form submission (page reload)

        const email = emailInput.value.trim(); // Trim whitespace
        const password = passwordInput.value;

        // --- Basic Client-Side Validation ---
        messageElement.textContent = ''; // Clear previous messages
        let isValid = true;
        if (!email) {
            messageElement.style.color = 'red';
            messageElement.textContent = 'Email is required.';
            emailInput.focus();
            isValid = false;
        } else if (!password) {
            messageElement.style.color = 'red';
            messageElement.textContent = 'Password is required.';
            passwordInput.focus();
            isValid = false;
        }

        if (!isValid) {
            return; // Stop if validation fails
        }
        // --- End Validation ---

        // Disable button to prevent multiple submissions
        submitButton.disabled = true;
        submitButton.textContent = 'Logging In...'; // Provide visual feedback

        try {
            const response = await fetch(`${API_BASE_URL}/login`, { // Your backend URL
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }), // Send data as JSON
            });

            const data = await response.json(); // Parse the JSON response body

            if (response.ok) { // Check if status code is 200-299
                messageElement.style.color = 'green';
                messageElement.textContent = `Login successful! Welcome ${data.user.name}. Redirecting...`;
                console.log('Login successful:', data);

                // --- Store Token and User Info ---
                localStorage.setItem('authToken', data.token); // Store the JWT token
                localStorage.setItem('userInfo', JSON.stringify(data.user)); // Store user details (including is_admin)

                // --- Redirect after a short delay ---
                setTimeout(() => {
                    window.location.href = 'index.html'; // Redirect to homepage
                }, 1000); // 1 second delay

                // Keep button disabled during redirect
                return; // Exit function after starting redirect timeout

            } else {
                // Handle errors (e.g., 401 Unauthorized, 400 Bad Request)
                messageElement.style.color = 'red';
                messageElement.textContent = data.message || 'Login failed. Please check your credentials.';
                console.error('Login failed:', data);
                passwordInput.value = ''; // Clear password field on error
                passwordInput.focus();
            }

        } catch (error) {
            // Handle network errors or issues with the fetch itself
            messageElement.style.color = 'red';
            messageElement.textContent = 'An error occurred. Please check your connection and try again.';
            console.error('Login request error:', error);
        } finally {
            // Re-enable button if not redirecting (i.e., on error)
            // This block runs regardless of try/catch outcome, but the 'return' in the 'if (response.ok)' block prevents it from running on success+redirect.
            if (submitButton) { // Check if button still exists
                 submitButton.disabled = false;
                 submitButton.textContent = 'Login';
            }
        }
    });
}); // End DOMContentLoaded

