(() => {
    const storageKey = 'futb-housing-theme';
    const root = document.documentElement;
    let savedTheme = null;
    let pageLoader;
    let loaderRemovalTimer;

    const createLoader = () => {
        if (pageLoader?.isConnected) return pageLoader;

        pageLoader = document.createElement('div');
        pageLoader.className = 'page-loader';
        pageLoader.setAttribute('role', 'status');
        pageLoader.setAttribute('aria-live', 'polite');
        pageLoader.innerHTML = `
            <div class="page-loader-content">
                <span class="page-loader-brand">JacobRent</span>
                <p>Getting your page ready</p>
                <div class="page-loader-progress" aria-hidden="true"><span></span></div>
            </div>`;
        root.append(pageLoader);
        return pageLoader;
    };

    const showLoader = () => {
        const loader = createLoader();
        window.clearTimeout(loaderRemovalTimer);
        loader.classList.remove('is-leaving');
        root.classList.add('is-loading');
        root.setAttribute('aria-busy', 'true');
    };

    const hideLoader = () => {
        root.classList.remove('is-loading');
        root.setAttribute('aria-busy', 'false');
        if (!pageLoader) return;
        pageLoader.classList.add('is-leaving');
        loaderRemovalTimer = window.setTimeout(() => {
            pageLoader?.remove();
            pageLoader = null;
        }, 320);
    };

    showLoader();
    document.addEventListener('DOMContentLoaded', hideLoader, { once: true });
    window.addEventListener('pageshow', hideLoader);
    window.addEventListener('beforeunload', showLoader);

    try {
        savedTheme = localStorage.getItem(storageKey);
    } catch (error) {
        savedTheme = null;
    }

    const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = savedTheme === 'dark' || savedTheme === 'light'
        ? savedTheme
        : systemPrefersDark ? 'dark' : 'light';

    const addToggle = () => {
        document.querySelectorAll('input[type="password"]').forEach((input, index) => {
            if (input.parentElement.classList.contains('password-field')) return;

            if (!input.id) input.id = `password-field-${index + 1}`;

            const wrapper = document.createElement('div');
            wrapper.className = 'password-field';
            input.parentNode.insertBefore(wrapper, input);
            wrapper.append(input);
            input.classList.add('password-field-control');

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'password-toggle';
            button.setAttribute('aria-label', 'Show password');
            button.setAttribute('aria-controls', input.id);
            button.setAttribute('aria-pressed', 'false');
            button.title = 'Show password';
            button.innerHTML = '<i class="bi bi-eye" aria-hidden="true"></i>';
            button.addEventListener('click', () => {
                const isVisible = input.type === 'text';
                input.type = isVisible ? 'password' : 'text';
                button.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
                button.setAttribute('aria-pressed', String(!isVisible));
                button.title = isVisible ? 'Show password' : 'Hide password';
                button.querySelector('i').className = `bi ${isVisible ? 'bi-eye' : 'bi-eye-slash'}`;
            });
            wrapper.append(button);
        });

        document.querySelectorAll('input[data-password-strength]').forEach(input => {
            const strength = document.createElement('div');
            strength.className = 'password-strength is-empty';

            const bars = document.createElement('div');
            bars.className = 'password-strength-bars';
            bars.setAttribute('aria-hidden', 'true');
            for (let index = 0; index < 5; index += 1) {
                bars.append(document.createElement('span'));
            }

            const label = document.createElement('span');
            label.className = 'password-strength-label';
            label.id = `${input.id}-strength`;
            label.setAttribute('role', 'status');
            label.setAttribute('aria-live', 'polite');
            label.textContent = 'Use at least 6 characters';

            strength.append(bars, label);
            const passwordField = input.closest('.password-field');
            (passwordField || input).insertAdjacentElement('afterend', strength);

            const descriptions = input.getAttribute('aria-describedby');
            input.setAttribute('aria-describedby', [descriptions, label.id].filter(Boolean).join(' '));

            input.addEventListener('input', () => {
                const value = input.value;
                const score = [
                    value.length >= 8,
                    value.length >= 12,
                    /[a-z]/.test(value) && /[A-Z]/.test(value),
                    /\d/.test(value),
                    /[^a-zA-Z0-9]/.test(value)
                ].filter(Boolean).length;

                if (!value) {
                    strength.className = 'password-strength is-empty';
                    label.textContent = 'Use at least 6 characters';
                    return;
                }

                const level = score <= 1 ? 'weak' : score === 2 ? 'fair' : score === 3 ? 'good' : 'strong';
                strength.className = `password-strength is-${level}`;
                strength.style.setProperty('--strength-level', String(Math.max(score, 1)));
                label.textContent = `${level[0].toUpperCase()}${level.slice(1)}`;
            });
        });

        document.querySelectorAll('input[data-password-confirm]').forEach(confirmInput => {
            const passwordInput = document.getElementById(confirmInput.dataset.passwordConfirm);
            if (!passwordInput || !confirmInput.form) return;

            const submitButton = confirmInput.form.querySelector('button[type="submit"], input[type="submit"]');
            const matchStatus = document.createElement('span');
            matchStatus.className = 'password-match is-empty';
            matchStatus.id = `${confirmInput.id}-match`;
            matchStatus.setAttribute('role', 'status');
            matchStatus.setAttribute('aria-live', 'polite');
            matchStatus.textContent = 'Re-enter your password';
            const confirmField = confirmInput.closest('.password-field');
            (confirmField || confirmInput).insertAdjacentElement('afterend', matchStatus);

            const descriptions = confirmInput.getAttribute('aria-describedby');
            confirmInput.setAttribute('aria-describedby', [descriptions, matchStatus.id].filter(Boolean).join(' '));

            const updateMatch = () => {
                const hasConfirmation = confirmInput.value.length > 0;
                const matches = hasConfirmation && passwordInput.value === confirmInput.value;
                const minimumLength = Math.max(passwordInput.minLength || 0, 6);
                const passwordIsLongEnough = passwordInput.value.length >= minimumLength;

                if (!hasConfirmation) {
                    matchStatus.className = 'password-match is-empty';
                    matchStatus.textContent = 'Re-enter your password';
                } else if (matches) {
                    matchStatus.className = 'password-match is-match';
                    matchStatus.textContent = 'Passwords match';
                } else {
                    matchStatus.className = 'password-match is-mismatch';
                    matchStatus.textContent = 'Passwords do not match';
                }

                confirmInput.setCustomValidity(hasConfirmation && !matches ? 'Passwords do not match.' : '');
                if (submitButton) submitButton.disabled = !(matches && passwordIsLongEnough);
            };

            passwordInput.addEventListener('input', updateMatch);
            confirmInput.addEventListener('input', updateMatch);
            updateMatch();
        });

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'theme-toggle';
        button.innerHTML = '<i class="bi bi-moon-stars-fill" aria-hidden="true"></i><span class="theme-toggle-track" aria-hidden="true"><span></span></span>';

        const updateToggle = () => {
            const isDark = root.dataset.theme === 'dark';
            const nextTheme = isDark ? 'light' : 'dark';
            button.setAttribute('aria-label', `Switch to ${nextTheme} mode`);
            button.setAttribute('title', `Switch to ${nextTheme} mode`);
            button.setAttribute('aria-pressed', String(isDark));
            button.querySelector('i').className = `bi ${isDark ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`;
        };

        button.addEventListener('click', () => {
            root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
            try {
                localStorage.setItem(storageKey, root.dataset.theme);
            } catch (error) {
                // Keep the current-page toggle usable when storage is unavailable.
            }
            updateToggle();
        });

        updateToggle();
        const navActions = document.querySelector('.navbar .container > .d-flex');
        if (navActions) {
            const navContainer = navActions.parentElement;
            navActions.classList.add('site-nav-actions');
            navActions.id = navActions.id || 'site-nav-actions';
            navActions.setAttribute('aria-label', 'Main navigation');
            navActions.append(button);

            const menuToggle = document.createElement('button');
            menuToggle.type = 'button';
            menuToggle.className = 'site-nav-toggle';
            menuToggle.setAttribute('aria-label', 'Open navigation menu');
            menuToggle.setAttribute('aria-controls', navActions.id);
            menuToggle.setAttribute('aria-expanded', 'false');
            menuToggle.innerHTML = '<i class="bi bi-list" aria-hidden="true"></i>';
            navActions.before(menuToggle);

            const setMenuOpen = isOpen => {
                navActions.classList.toggle('is-open', isOpen);
                menuToggle.setAttribute('aria-expanded', String(isOpen));
                menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
                menuToggle.querySelector('i').className = `bi ${isOpen ? 'bi-x-lg' : 'bi-list'}`;
            };

            menuToggle.addEventListener('click', () => setMenuOpen(!navActions.classList.contains('is-open')));
            navActions.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', () => setMenuOpen(false));
            });
            navContainer.addEventListener('keydown', event => {
                if (event.key === 'Escape') setMenuOpen(false);
            });
            document.addEventListener('click', event => {
                if (!navContainer.contains(event.target)) setMenuOpen(false);
            });
        } else {
            button.classList.add('theme-toggle-floating');
            document.body.append(button);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addToggle, { once: true });
    } else {
        addToggle();
    }
})();