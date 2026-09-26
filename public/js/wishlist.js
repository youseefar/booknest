(() => {
    const storageKey = 'futb-housing-wishlist';
    let savedIds = [];

    try {
        const storedIds = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (Array.isArray(storedIds)) savedIds = storedIds.filter(id => typeof id === 'string');
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
            savedIds = isSaved
                ? savedIds.filter(id => id !== propertyId)
                : [...savedIds, propertyId];
            saveIds();
            setSavedState(!isSaved);
        });
    });
})();