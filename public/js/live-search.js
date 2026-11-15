// Search while typing.
//  1. Forms marked data-live-search refresh their results as you type or change a filter.
//     The server still renders the page; we swap in only the results (data-live-target).
//  2. Inputs marked data-suggest-url show a dropdown of matching homes under the box.
// Without JavaScript, or if a request fails, the normal Search button keeps working.
(() => {
    const DEBOUNCE_MS = 350;
    const hasSearchableText = value => value === '' || /[\p{L}\p{N}]/u.test(value);

    // ---- 1. Live results ----------------------------------------------------------------
    const initLiveForm = form => {
        const selectors = String(form.dataset.liveTarget || '').split(',').map(item => item.trim()).filter(Boolean);
        if (!selectors.length) return;
        const cache = new Map();
        let timer;
        let controller;
        let lastUrl = '';

        const buildUrl = () => {
            const params = new URLSearchParams(new FormData(form));
            params.delete('page');
            return `${form.getAttribute('action') || location.pathname}?${params.toString()}`;
        };

        const textFieldsAreValid = () => [...form.querySelectorAll('input[type="search"], input[type="text"]')]
            .every(input => hasSearchableText(input.value.trim()));

        const updateClearButton = () => {
            const clear = form.querySelector('[data-live-clear]');
            if (!clear) return;
            const active = [...form.elements].some(field => {
                if (field.type === 'search' || field.type === 'text') return field.value.trim() !== '';
                if (field.tagName === 'SELECT') return field.selectedIndex > 0;
                return false;
            });
            clear.hidden = !active;
        };

        const syncOtherForms = () => {
            const names = new Set([...new FormData(form).keys()]);
            document.querySelectorAll('input[type="hidden"][data-live-sync]').forEach(input => {
                if (form.contains(input) || !names.has(input.name)) return;
                const field = form.elements[input.name];
                if (field && 'value' in field) input.value = field.value;
            });
        };

        const apply = (html, url) => {
            const next = new DOMParser().parseFromString(html, 'text/html');
            let swapped = false;
            for (const selector of selectors) {
                const current = document.querySelector(selector);
                const fresh = next.querySelector(selector);
                if (current && fresh) {
                    current.innerHTML = fresh.innerHTML;
                    current.removeAttribute('aria-busy');
                    current.classList.remove('is-updating');
                    swapped = true;
                }
            }
            if (!swapped) return false;
            try { history.replaceState(null, '', url); } catch (error) { /* keep working without it */ }
            updateClearButton();
            syncOtherForms();
            document.dispatchEvent(new CustomEvent('live-results:updated'));
            return true;
        };

        const setBusy = busy => selectors.forEach(selector => {
            const element = document.querySelector(selector);
            if (!element) return;
            element.classList.toggle('is-updating', busy);
            if (busy) element.setAttribute('aria-busy', 'true');
            else element.removeAttribute('aria-busy');
        });

        const refresh = async () => {
            if (!textFieldsAreValid()) return;
            const url = buildUrl();
            if (url === lastUrl) return;
            if (cache.has(url)) {
                lastUrl = url;
                apply(cache.get(url), url);
                return;
            }
            controller?.abort();
            controller = new AbortController();
            setBusy(true);
            try {
                const response = await fetch(url, {
                    credentials: 'same-origin',
                    headers: { Accept: 'text/html' },
                    signal: controller.signal
                });
                if (!response.ok) throw new Error(`Search returned ${response.status}`);
                const html = await response.text();
                if (cache.size > 30) cache.clear();
                cache.set(url, html);
                lastUrl = url;
                apply(html, url);
            } catch (error) {
                if (error.name !== 'AbortError') setBusy(false);
                return;
            }
            setBusy(false);
        };

        const schedule = () => {
            updateClearButton();
            window.clearTimeout(timer);
            timer = window.setTimeout(refresh, DEBOUNCE_MS);
        };

        lastUrl = buildUrl();
        form.addEventListener('input', event => {
            if (event.target.matches('input[type="search"], input[type="text"]')) schedule();
        });
        form.addEventListener('change', event => {
            if (event.target.matches('select')) {
                window.clearTimeout(timer);
                refresh();
            }
        });
        form.addEventListener('submit', () => window.clearTimeout(timer));
    };

    document.querySelectorAll('form[data-live-search]').forEach(initLiveForm);

    // ---- 2. Suggestions under the home search box ------------------------------------------
    const initSuggestions = input => {
        const url = input.dataset.suggestUrl;
        const host = input.closest('form');
        if (!url || !host) return;

        const list = document.createElement('div');
        list.className = 'live-suggest';
        list.id = 'live-suggest-list';
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-label', 'Matching homes');
        list.hidden = true;
        host.append(list);
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-controls', list.id);
        input.setAttribute('aria-expanded', 'false');

        const cache = new Map();
        let timer;
        let controller;
        let active = -1;
        let requestId = 0;

        const options = () => [...list.querySelectorAll('[role="option"]')];
        const close = () => {
            list.hidden = true;
            active = -1;
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute('aria-activedescendant');
        };
        const setActive = index => {
            const items = options();
            items.forEach(item => item.setAttribute('aria-selected', 'false'));
            active = items.length ? (index + items.length) % items.length : -1;
            if (active >= 0) {
                items[active].setAttribute('aria-selected', 'true');
                input.setAttribute('aria-activedescendant', items[active].id);
                items[active].scrollIntoView({ block: 'nearest' });
            } else {
                input.removeAttribute('aria-activedescendant');
            }
        };

        const addText = (parent, tag, className, text) => {
            const element = document.createElement(tag);
            element.className = className;
            element.textContent = text;
            parent.append(element);
        };

        const render = (data, query) => {
            list.replaceChildren();
            const results = Array.isArray(data.results) ? data.results : [];
            if (!results.length) {
                addText(list, 'div', 'live-suggest-empty', `No homes match “${query}” yet.`);
            }
            results.forEach((property, index) => {
                if (!/^[a-f\d]{24}$/i.test(String(property.id))) return;
                const link = document.createElement('a');
                link.className = 'live-suggest-item';
                link.id = `live-suggest-${index}`;
                link.href = `/property/${property.id}`;
                link.setAttribute('role', 'option');
                link.setAttribute('aria-selected', 'false');
                addText(link, 'span', 'live-suggest-title', property.title);
                const price = Number.isFinite(Number(property.price)) ? `₦${Number(property.price).toLocaleString()}` : '';
                addText(link, 'span', 'live-suggest-meta',
                    [property.location, property.listingType === 'sale' ? 'For sale' : 'For rent', price].filter(Boolean).join(' · '));
                list.append(link);
            });
            if (results.length) {
                const more = document.createElement('a');
                more.className = 'live-suggest-all';
                more.href = `/properties?q=${encodeURIComponent(query)}`;
                more.textContent = data.total > results.length
                    ? `See all ${Number(data.total).toLocaleString()} results`
                    : 'See these results on the Browse page';
                list.append(more);
            }
            list.hidden = false;
            active = -1;
            input.setAttribute('aria-expanded', 'true');
        };

        const lookup = async () => {
            const query = input.value.trim();
            if (!query || !hasSearchableText(query)) return close();
            const id = ++requestId;
            if (cache.has(query)) return render(cache.get(query), query);
            controller?.abort();
            controller = new AbortController();
            try {
                const response = await fetch(`${url}?q=${encodeURIComponent(query)}`, {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                    signal: controller.signal
                });
                if (!response.ok) throw new Error(`Suggestions returned ${response.status}`);
                const data = await response.json();
                if (cache.size > 40) cache.clear();
                cache.set(query, data);
                if (id === requestId && input.value.trim() === query) render(data, query);
            } catch (error) {
                if (error.name !== 'AbortError') close();
            }
        };

        input.addEventListener('input', () => {
            window.clearTimeout(timer);
            if (!input.value.trim()) {
                requestId += 1;
                controller?.abort();
                return close();
            }
            timer = window.setTimeout(lookup, 250);
        });
        input.addEventListener('focus', () => {
            if (list.childElementCount && input.value.trim()) {
                list.hidden = false;
                input.setAttribute('aria-expanded', 'true');
            }
        });
        input.addEventListener('keydown', event => {
            if (event.key === 'Escape') return close();
            if (list.hidden) return;
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive(active + 1); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(active - 1); }
            else if (event.key === 'Enter' && active >= 0) {
                event.preventDefault();
                options()[active].click();
            }
        });
        document.addEventListener('click', event => {
            if (!host.contains(event.target)) close();
        });
        host.addEventListener('submit', close);
    };

    document.querySelectorAll('input[data-suggest-url]').forEach(initSuggestions);
})();
