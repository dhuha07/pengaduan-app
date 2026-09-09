document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('formLogin');
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eye');
    const togglePasswordBtn = document.querySelector('.toggle-password');

    // 1. Toggle Password Visibility
    if (togglePasswordBtn && passwordInput && eyeIcon) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            eyeIcon.classList.toggle('fa-eye', !isPassword);
            eyeIcon.classList.toggle('fa-eye-slash', isPassword);
        });
    }

    // 2. Submit Form & Simpan Semua Variasi Sesi
    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault();

            const usernameInput = document.getElementById('username') || document.querySelector('input[name="username"]');
            const username = usernameInput ? usernameInput.value.trim() : 'admin';

            // Data Otorisasi Kompatibel
            const authData = {
                'isLoggedIn': 'true',
                'role': 'petugas',
                'userRole': 'petugas',
                'token': 'petugas-secret-token-123',
                'username': username
            };

            // Simpan ke localStorage DAN sessionStorage
            Object.keys(authData).forEach(key => {
                localStorage.setItem(key, authData[key]);
                sessionStorage.setItem(key, authData[key]);
            });

            // Redirect ke Dashboard
            window.location.href = 'dashboard.html';
        });
    }
});