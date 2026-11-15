(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const activate = video => {
        if (video.dataset.loaded) return;
        video.load();
        video.dataset.loaded = 'true';
    };
    const playPreview = video => {
        if (video.hasAttribute('data-video-preview') && !reduceMotion) {
            video.play().then(() => video.classList.add('is-playing')).catch(() => {});
        }
    };

    const observer = 'IntersectionObserver' in window
        ? new IntersectionObserver(entries => {
            for (const entry of entries) {
                const video = entry.target;
                if (entry.isIntersecting) {
                    activate(video);
                    playPreview(video);
                } else if (video.hasAttribute('data-video-preview')) {
                    video.pause();
                    video.classList.remove('is-playing');
                }
            }
        }, { rootMargin: '160px 0px' })
        : null;

    const watchVideos = () => {
        document.querySelectorAll('video[data-lazy-video]:not([data-watched])').forEach(video => {
            video.dataset.watched = 'true';
            if (observer) {
                observer.observe(video);
            } else {
                activate(video);
                playPreview(video);
            }
        });
    };

    watchVideos();
    // Search results can be replaced while typing; watch the new videos too.
    document.addEventListener('live-results:updated', watchVideos);
})();
