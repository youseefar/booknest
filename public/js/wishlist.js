(() => {
    const storageKey = 'futb-housing-wishlist';
    const maxSavedProperties = 100;
    let savedIds = [];

    try {
        const storedIds = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (Array.isArray(storedIds)) {
            savedIds = storedIds
                .filter(id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id))
                .slice(0, maxSavedProperties);
        }
    } catch (error) {
        savedIds = [];
    }

    const saveIds = () => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(savedIds));
        } catch (error) {
            // Keep the current-page controls usable when storage is unavailable.
        }
    };

    const updateSavedLinks = () => {
        const href = savedIds.length
            ? `/saved-properties?ids=${encodeURIComponent(savedIds.join(','))}`
            : '/saved-properties';
        document.querySelectorAll('[data-saved-properties-link]').forEach(link => {
            link.href = href;
            link.setAttribute('aria-label', `Saved homes (${savedIds.length})`);
        });
    };

    const savedPage = document.body.dataset.savedPropertiesPage === 'true';
    if (savedPage) {
        const renderedIds = (document.body.dataset.renderedSavedIds || '')
            .split(',')
            .filter(id => /^[a-f\d]{24}$/i.test(id));
        savedIds = renderedIds;
        saveIds();
    }

    document.querySelectorAll('.wish-btn[data-property-id]').forEach(button => {
        const propertyId = button.dataset.propertyId;
        const icon = button.querySelector('i');

        const setSavedState = isSaved => {
            button.classList.toggle('is-saved', isSaved);
            button.setAttribute('aria-pressed', String(isSaved));
            button.setAttribute('aria-label', `${isSaved ? 'Remove' : 'Save'} ${button.dataset.propertyTitle} ${isSaved ? 'from' : 'to'} wishlist`);
            icon.className = `bi ${isSaved ? 'bi-heart-fill' : 'bi-heart'}`;
        };

        setSavedState(savedIds.includes(propertyId));
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();

            const isSaved = savedIds.includes(propertyId);
            if (!isSaved && savedIds.length >= maxSavedProperties) {
                button.setAttribute('aria-label', 'You can save up to 100 homes on this device');
                return;
            }
            savedIds = isSaved
                ? savedIds.filter(id => id !== propertyId)
                : [...savedIds, propertyId];
            saveIds();
            setSavedState(!isSaved);
            updateSavedLinks();
            if (savedPage && isSaved) {
                button.closest('[data-saved-card]')?.remove();
                const count = document.querySelector('[data-saved-count]');
                if (count) count.textContent = String(savedIds.length);
                const countLabel = document.querySelector('[data-saved-label]');
                if (countLabel) countLabel.textContent = savedIds.length === 1 ? 'home' : 'homes';
                const emptyState = document.querySelector('[data-saved-empty]');
                if (emptyState && savedIds.length === 0) emptyState.hidden = false;
            }
        });
    });

    updateSavedLinks();
})();