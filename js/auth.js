// js/auth.js
const API_BASE_URL = 'https://online-store-i8da.onrender.com/api';

// --- Helper functions for showing/clearing errors ---
function showError(field, message) {
    field.classList.add('invalid');
    const errorElement = field.nextElementSibling?.classList.contains('error-message')
                       ? field.nextElementSibling
                       : field.closest('.form-group')?.querySelector('.error-message');
    if (errorElement) {
        errorElement.textContent = message;
    }
}

function clearError(field) {
    field.classList.remove('invalid');
    const errorElement = field.nextElementSibling?.classList.contains('error-message')
                       ? field.nextElementSibling
                       : field.closest('.form-group')?.querySelector('.error-message');
    if (errorElement) {
        errorElement.textContent = '';
    }
}

// Helper to display general form messages (success/error)
function showFormMessage(formElement, message, isError = true) {
    let messageElement = formElement.querySelector('.form-message');
    // Create message element if it doesn't exist
    if (!messageElement) {
        messageElement = document.createElement('p');
        messageElement.className = 'form-message';
        // Insert after the last form group or before the submit button
        const submitButton = formElement.querySelector('button[type="submit"]');
        if (submitButton) {
            formElement.insertBefore(messageElement, submitButton);
        } else {
            formElement.appendChild(messageElement); // Fallback
        }
    }
    messageElement.textContent = message;
    messageElement.style.color = isError ? 'red' : 'green';
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Registration Form Handling ---
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        const nameField = document.getElementById('name');
        const emailField = document.getElementById('email');
        const passwordField = document.getElementById('password');
        const confirmPasswordField = document.getElementById('confirm-password');

        registerForm.addEventListener('submit', async (event) => { // Make handler async
            event.preventDefault();
            let isValid = true;
            showFormMessage(registerForm, '', false); // Clear previous form message

            // Clear previous field errors
            clearError(nameField);
            clearError(emailField);
            clearError(passwordField);
            clearError(confirmPasswordField);

            // --- Client-side Validation ---
            if (!nameField.value.trim()) {
                showError(nameField, 'Full Name is required.');
                isValid = false;
            }
            const emailValue = emailField.value.trim();
            if (!emailValue) {
                showError(emailField, 'Email is required.');
                isValid = false;
            } else if (!/\S+@\S+\.\S+/.test(emailValue)) {
                showError(emailField, 'Please enter a valid email address.');
                isValid = false;
            }
            const passwordValue = passwordField.value;
            if (!passwordValue) {
                showError(passwordField, 'Password is required.');
                isValid = false;
            } else if (passwordValue.length < 6) {
                showError(passwordField, 'Password must be at least 6 characters long.');
                isValid = false;
            }
            const confirmPasswordValue = confirmPasswordField.value;
            if (!confirmPasswordValue) {
                showError(confirmPasswordField, 'Please confirm your password.');
                isValid = false;
            } else if (passwordValue && passwordValue !== confirmPasswordValue) {
                showError(confirmPasswordField, 'Passwords do not match.');
                isValid = false;
            }
            // --- End Client-side Validation ---

            if (isValid) {
                console.log('Registration form valid, attempting API call...');
                const name = nameField.value.trim();
                const email = emailValue;
                const password = passwordValue;

                try {
                    const response = await fetch(`${API_BASE_URL}/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, email, password })
                    });

                    const data = await response.json();

                    if (response.ok) { // Status 201 Created
                        console.log('Registration successful:', data);
                        showFormMessage(registerForm, 'Registration successful! Redirecting to login...', false);
                        // Redirect to login page after a short delay
                        setTimeout(() => {
                            window.location.href = 'login.html';
                        }, 1500); // 1.5 second delay
                    } else {
                        // Handle backend errors (e.g., 400, 409, 500)
                        console.error('Registration failed:', data);
                        showFormMessage(registerForm, data.message || 'Registration failed. Please try again.');
                        // Optionally highlight specific fields based on error message
                        if (data.message && data.message.toLowerCase().includes('email already exists')) {
                            showError(emailField, 'This email address is already registered.');
                            emailField.focus();
                        }
                    }
                } catch (error) {
                    // Handle network errors
                    console.error('Registration request error:', error);
                    showFormMessage(registerForm, 'An error occurred during registration. Please check your connection and try again.');
                }

            } else {
                console.log('Registration form is invalid.');
                const firstError = registerForm.querySelector('.invalid');
                if (firstError) {
                    firstError.focus();
                }
            }
        });
    }

    // --- Login Form Handling ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        const loginEmailField = loginForm.querySelector('#email');
        const loginPasswordField = loginForm.querySelector('#password');

        loginForm.addEventListener('submit', async (event) => { // Make handler async
            event.preventDefault();
            let isValid = true;
            showFormMessage(loginForm, '', false); // Clear previous form message

            // Clear previous field errors
            clearError(loginEmailField);
            clearError(loginPasswordField);

            // --- Client-side Validation ---
            const emailValue = loginEmailField.value.trim();
            if (!emailValue) {
                showError(loginEmailField, 'Email is required.');
                isValid = false;
            } else if (!/\S+@\S+\.\S+/.test(emailValue)) {
                showError(loginEmailField, 'Please enter a valid email address.');
                isValid = false;
            }
            const passwordValue = loginPasswordField.value;
            if (!passwordValue) {
                showError(loginPasswordField, 'Password is required.');
                isValid = false;
            }
            // --- End Client-side Validation ---

            if (isValid) {
                console.log('Login form valid, attempting API call...');
                const email = emailValue;
                const password = passwordValue;

                try {
                    const response = await fetch('http://localhost:3000/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });

                    const data = await response.json();

                    if (response.ok) { // Status 200 OK
                        console.log('Login successful:', data);
                        // Store token and user info
                        localStorage.setItem('authToken', data.token);
                        localStorage.setItem('userInfo', JSON.stringify(data.user));

                        showFormMessage(loginForm, `Login successful! Welcome ${data.user.name}. Redirecting...`, false);
                        // Redirect to homepage after a short delay
                        setTimeout(() => {
                            window.location.href = 'index.html';
                        }, 1000); // 1 second delay

                    } else {
                        // Handle backend errors (e.g., 400, 401, 500)
                        console.error('Login failed:', data);
                        showFormMessage(loginForm, data.message || 'Login failed. Please check your credentials.');
                        // Optionally clear password field on failed login
                        loginPasswordField.value = '';
                        loginPasswordField.focus();
                    }
                } catch (error) {
                    // Handle network errors
                    console.error('Login request error:', error);
                    showFormMessage(loginForm, 'An error occurred during login. Please check your connection and try again.');
                }

            } else {
                console.log('Login form is invalid.');
                const firstError = loginForm.querySelector('.invalid');
                if (firstError) {
                    firstError.focus();
                }
            }
        });
    }
});

