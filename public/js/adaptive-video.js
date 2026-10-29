(() => {
    const players = document.querySelectorAll('[data-adaptive-video]');
    const hlsScriptUrl = 'https://cdn.jsdelivr.net/npm/hls.js@1.6.13/dist/hls.min.js';
    let hlsScriptPromise;

    const loadHls = () => {
        if (window.Hls) return Promise.resolve(window.Hls);
        if (hlsScriptPromise) return hlsScriptPromise;

        hlsScriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = hlsScriptUrl;
            script.onload = () => window.Hls ? resolve(window.Hls) : reject(new Error('HLS playback is unavailable.'));
            script.onerror = () => reject(new Error('Unable to load adaptive video playback.'));
            document.head.append(script);
        });
        return hlsScriptPromise;
    };

    players.forEach(player => {
        const video = player.querySelector('video');
        const startButton = player.querySelector('[data-video-start]');
        const status = player.querySelector('[data-video-status]');
        const streamUrl = player.dataset.streamUrl;
        const fallbackUrl = player.dataset.fallbackUrl;
        let hls;

        const play = () => video.play().catch(() => {
            status.textContent = 'Press play to start the video.';
        });

        const startProgressiveFallback = () => {
            hls?.destroy();
            video.src = fallbackUrl;
            video.load();
            play();
        };

        startButton.addEventListener('click', async () => {
            startButton.disabled = true;
            status.textContent = 'Preparing video for your connection...';
            video.controls = true;

            if (!streamUrl) {
                startProgressiveFallback();
                return;
            }

            if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = streamUrl;
                video.load();
                play();
                return;
            }

            try {
                const Hls = await loadHls();
                if (!Hls.isSupported()) return startProgressiveFallback();

                const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                const saveData = Boolean(connection?.saveData);
                hls = new Hls({
                    startLevel: saveData ? 0 : -1,
                    capLevelToPlayerSize: true,
                    maxBufferLength: saveData ? 12 : 30
                });
                hls.loadSource(streamUrl);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                    if (saveData && data.levels.length) {
                        let lowResolutionLevel = 0;
                        data.levels.forEach((level, index) => {
                            if (level.height <= 360 && level.height >= data.levels[lowResolutionLevel].height) {
                                lowResolutionLevel = index;
                            }
                        });
                        hls.autoLevelCapping = lowResolutionLevel;
                        status.textContent = 'Data Saver is on; using lower video quality.';
                    }
                    play();
                });
                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) startProgressiveFallback();
                });
            } catch (error) {
                status.textContent = 'Using standard video playback.';
                startProgressiveFallback();
            }
        });

        video.addEventListener('playing', () => {
            startButton.hidden = true;
            status.textContent = '';
        }, { once: true });
    });
})();
