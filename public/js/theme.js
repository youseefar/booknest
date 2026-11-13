(() => {
    const storageKey = 'futb-housing-theme';
    const root = document.documentElement;
    let savedTheme = null;
    let pageLoader;

    const initializeConfirmations = () => {
        const backdrop = document.createElement('div');
        backdrop.className = 'app-confirm-backdrop';
        backdrop.hidden = true;
        backdrop.innerHTML = `
            <section class="app-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="app-confirm-title" aria-describedby="app-confirm-message">
                <span class="app-confirm-icon" aria-hidden="true"><i class="bi bi-exclamation-circle"></i></span>
                <h2 id="app-confirm-title">Please confirm</h2>
                <p id="app-confirm-message"></p>
                <div class="app-confirm-actions">
                    <button class="app-confirm-cancel" type="button" data-confirm-cancel>Cancel</button>
                    <button class="app-confirm-accept" type="button" data-confirm-accept>Continue</button>
                </div>
            </section>`;
        document.body.append(backdrop);

        const title = backdrop.querySelector('#app-confirm-title');
        const message = backdrop.querySelector('#app-confirm-message');
        const cancelButton = backdrop.querySelector('[data-confirm-cancel]');
        const acceptButton = backdrop.querySelector('[data-confirm-accept]');
        let pendingForm = null;
        let pendingSubmitter = null;
        let confirmedForm = null;
        let previousFocus = null;

        const close = () => {
            backdrop.hidden = true;
            document.body.classList.remove('app-confirm-open');
            pendingForm = null;
            pendingSubmitter = null;
            if (previousFocus?.isConnected) previousFocus.focus();
            previousFocus = null;
        };

        document.addEventListener('submit', event => {
            const form = event.target;
            if (!(form instanceof HTMLFormElement) || !form.dataset.confirmMessage) return;
            if (form === confirmedForm) {
                confirmedForm = null;
                return;
            }

            event.preventDefault();
            pendingForm = form;
            pendingSubmitter = event.submitter || null;
            previousFocus = document.activeElement;
            title.textContent = form.dataset.confirmTitle || 'Please confirm';
            message.textContent = form.dataset.confirmMessage;
            acceptButton.textContent = form.dataset.confirmAction || 'Continue';
            acceptButton.className = `app-confirm-accept is-${['danger', 'warning'].includes(form.dataset.confirmVariant) ? form.dataset.confirmVariant : 'primary'}`;
            backdrop.hidden = false;
            document.body.classList.add('app-confirm-open');
            cancelButton.focus();
        });

        cancelButton.addEventListener('click', close);
        backdrop.addEventListener('click', event => {
            if (event.target === backdrop) close();
        });
        acceptButton.addEventListener('click', () => {
            const form = pendingForm;
            const submitter = pendingSubmitter;
            if (!form) return close();
            confirmedForm = form;
            close();
            if (submitter) form.requestSubmit(submitter);
            else form.requestSubmit();
        });
        document.addEventListener('keydown', event => {
            if (backdrop.hidden) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
                return;
            }
            if (event.key !== 'Tab') return;

            const focusable = [cancelButton, acceptButton];
            const currentIndex = focusable.indexOf(document.activeElement);
            if (currentIndex === -1) {
                event.preventDefault();
                cancelButton.focus();
            } else if (event.shiftKey && currentIndex === 0) {
                event.preventDefault();
                acceptButton.focus();
            } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
                event.preventDefault();
                cancelButton.focus();
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeConfirmations, { once: true });
    } else {
        initializeConfirmations();
    }

    if (!document.querySelector('link[rel="manifest"]')) {
        const manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        manifestLink.href = '/manifest.webmanifest';
        document.head.append(manifestLink);
    }

    if (!document.querySelector('link[href="/css/pwa.css"]')) {
        const pwaStyles = document.createElement('link');
        pwaStyles.rel = 'stylesheet';
        pwaStyles.href = '/css/pwa.css';
        document.head.append(pwaStyles);
    }

    const addMeta = (name, content) => {
        if (document.querySelector(`meta[name="${name}"]`)) return;
        const meta = document.createElement('meta');
        meta.name = name;
        meta.content = content;
        document.head.append(meta);
    };

    addMeta('theme-color', '#17355c');
    addMeta('apple-mobile-web-app-capable', 'yes');
    addMeta('apple-mobile-web-app-title', 'Jacob Estate');
    addMeta('apple-mobile-web-app-status-bar-style', 'default');

    if ('serviceWorker' in navigator && window.isSecureContext) {
        navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(error => {
            console.error('Unable to register the Jacob Estate service worker:', error);
        });
    }

    const installDismissalKey = 'jacobrent-pwa-dismissed-until';
    const userAgent = navigator.userAgent || '';
    const isIosDevice = /iphone|ipad|ipod/i.test(userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /safari/i.test(userAgent) && !/crios|fxios|edgios|opios/i.test(userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    let deferredInstallPrompt = null;
    let installPromptCard = null;

    const wasInstallPromptDismissed = () => {
        try {
            return Number(localStorage.getItem(installDismissalKey) || 0) > Date.now();
        } catch (error) {
            return false;
        }
    };

    const removeInstallPrompt = () => {
        installPromptCard?.remove();
        installPromptCard = null;
    };

    const showInstallPrompt = () => {
        if (installPromptCard || isStandalone || wasInstallPromptDismissed()) return;
        if (!deferredInstallPrompt && !(isIosDevice && isSafari)) return;

        installPromptCard = document.createElement('aside');
        installPromptCard.className = 'pwa-install-prompt';
        installPromptCard.setAttribute('role', 'dialog');
        installPromptCard.setAttribute('aria-labelledby', 'pwa-install-title');
        installPromptCard.innerHTML = `
            <img class="pwa-install-icon" src="/jacobrent-app-icon.svg" alt="">
            <span class="pwa-install-copy">
                <strong id="pwa-install-title">Install Jacob Estate</strong>
                <span data-install-copy>Add it to your device for quick access.</span>
            </span>
            <button class="pwa-install-action" type="button" data-install-action>${isIosDevice ? 'How to add' : 'Install'}</button>
            <button class="pwa-install-dismiss" type="button" data-install-dismiss aria-label="Dismiss install prompt"><i class="bi bi-x-lg" aria-hidden="true"></i></button>`;

        const installButton = installPromptCard.querySelector('[data-install-action]');
        const dismissButton = installPromptCard.querySelector('[data-install-dismiss]');
        const installCopy = installPromptCard.querySelector('[data-install-copy]');

        installButton.addEventListener('click', async () => {
            if (isIosDevice) {
                installCopy.textContent = 'In Safari, tap Share, then Add to Home Screen.';
                installButton.hidden = true;
                return;
            }
            if (!deferredInstallPrompt) return;

            deferredInstallPrompt.prompt();
            const result = await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
            if (result.outcome === 'accepted') removeInstallPrompt();
            else installPromptCard?.remove();
        });

        dismissButton.addEventListener('click', () => {
            try {
                localStorage.setItem(installDismissalKey, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
            } catch (error) {
                // Dismissal remains effective for the current page if storage is unavailable.
            }
            removeInstallPrompt();
        });

        document.body.append(installPromptCard);
    };

    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        deferredInstallPrompt = event;
        window.setTimeout(showInstallPrompt, 1200);
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        removeInstallPrompt();
    });

    if (isIosDevice && isSafari && !isStandalone) {
        window.setTimeout(showInstallPrompt, 1800);
    }

    // Loading feedback: a thin top progress bar for every load and navigation, plus a branded
    // splash that only appears when the first page of a visit takes noticeably long to load.
    const SPLASH_DELAY_MS = 250;
    const SPLASH_MIN_MS = 450;
    const splashStorageKey = 'jacob-splash-seen';
    let progressBar;
    let progressTimer;
    let progressGuard;
    let progressValue = 0;
    let splashShownAt = 0;
    let splashTimer;
    let pageReady = false;

    const startProgress = () => {
        if (!progressBar?.isConnected) {
            progressBar = document.createElement('div');
            progressBar.className = 'page-progress';
            progressBar.setAttribute('aria-hidden', 'true');
            root.append(progressBar);
        }
        window.clearInterval(progressTimer);
        progressBar.classList.remove('is-done');
        progressValue = 0.08;
        progressBar.style.transform = `scaleX(${progressValue})`;
        progressTimer = window.setInterval(() => {
            progressValue += (0.92 - progressValue) * 0.08;
            progressBar.style.transform = `scaleX(${progressValue.toFixed(3)})`;
        }, 200);
        // If the browser stays on this page (a download or mail link), do not leave the bar hanging.
        window.clearTimeout(progressGuard);
        progressGuard = window.setTimeout(finishProgress, 12000);
    };

    const finishProgress = () => {
        window.clearInterval(progressTimer);
        window.clearTimeout(progressGuard);
        if (!progressBar) return;
        const bar = progressBar;
        bar.style.transform = 'scaleX(1)';
        window.setTimeout(() => bar.classList.add('is-done'), 150);
        window.setTimeout(() => {
            bar.remove();
            if (progressBar === bar) progressBar = null;
        }, 700);
    };

    const showSplash = () => {
        if (pageReady || pageLoader?.isConnected) return;
        pageLoader = document.createElement('div');
        pageLoader.className = 'page-loader';
        pageLoader.setAttribute('role', 'status');
        pageLoader.setAttribute('aria-live', 'polite');
        pageLoader.innerHTML = `
            <div class="page-loader-content">
                <div class="page-loader-mark">
                    <svg class="page-loader-ring" viewBox="0 0 100 100" aria-hidden="true">
                        <circle class="ring-track" cx="50" cy="50" r="46"></circle>
                        <circle class="ring-arc" cx="50" cy="50" r="46"></circle>
                    </svg>
                    <img src="/jacobrent-mark.svg" alt="">
                </div>
                <span class="page-loader-brand">Jacob <strong>Estate</strong></span>
                <span class="loader-sr-only">Loading</span>
            </div>`;
        root.append(pageLoader);
        splashShownAt = Date.now();
        root.classList.add('is-loading');
        root.setAttribute('aria-busy', 'true');
    };

    const hideSplash = () => {
        const leave = () => {
            root.classList.remove('is-loading');
            root.setAttribute('aria-busy', 'false');
            if (!pageLoader) return;
            const loader = pageLoader;
            loader.classList.add('is-leaving');
            window.setTimeout(() => {
                loader.remove();
                if (pageLoader === loader) pageLoader = null;
            }, 450);
        };
        // Keep the splash up briefly once it has appeared so it never just flickers.
        const remaining = splashShownAt ? SPLASH_MIN_MS - (Date.now() - splashShownAt) : 0;
        if (remaining > 0) window.setTimeout(leave, remaining);
        else leave();
    };

    const onPageReady = () => {
        pageReady = true;
        window.clearTimeout(splashTimer);
        finishProgress();
        hideSplash();
    };

    let splashSeen = false;
    try { splashSeen = sessionStorage.getItem(splashStorageKey) === '1'; } catch (error) { /* storage unavailable */ }
    try { sessionStorage.setItem(splashStorageKey, '1'); } catch (error) { /* storage unavailable */ }

    startProgress();
    if (!splashSeen) splashTimer = window.setTimeout(showSplash, SPLASH_DELAY_MS);
    document.addEventListener('DOMContentLoaded', onPageReady, { once: true });
    window.addEventListener('load', onPageReady, { once: true });
    window.addEventListener('pageshow', event => { if (event.persisted) onPageReady(); });
    window.addEventListener('beforeunload', () => {
        pageReady = false;
        startProgress();
    });

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
            label.textContent = 'Use 8+ characters and a number';

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
                    label.textContent = 'Use 8+ characters and a number';
                    return;
                }

                const level = score <= 1 ? 'weak' : score === 2 ? 'fair' : score === 3 ? 'good' : 'strong';
                strength.className = `password-strength is-${level}`;
                strength.style.setProperty('--strength-level', String(Math.max(score, 1)));
                label.textContent = value.length < 8
                    ? 'Use at least 8 characters'
                    : !/[A-Za-z]/.test(value)
                        ? 'Add at least one letter'
                        : !/\d/.test(value)
                            ? 'Add at least one number'
                            : `${level[0].toUpperCase()}${level.slice(1)}`;
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
                const passwordIsValid = passwordInput.validity.valid
                    && /[A-Za-z]/.test(passwordInput.value)
                    && /\d/.test(passwordInput.value);

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
                if (submitButton) submitButton.disabled = !(matches && passwordIsValid);
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