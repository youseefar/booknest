(() => {
    const storageKey = 'futb-housing-theme';
    const root = document.documentElement;
    let savedTheme = null;

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