(() => {
    const videos = document.querySelectorAll('video[data-lazy-video]');
    if (!videos.length) return;

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

    if (!('IntersectionObserver' in window)) {
        videos.forEach(video => {
            activate(video);
            playPreview(video);
        });
        return;
    }

    const observer = new IntersectionObserver(entries => {
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
    }, { rootMargin: '160px 0px' });

    videos.forEach(video => observer.observe(video));
})();
