(() => {
  const root = document.documentElement;
  root.classList.remove('no-js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  // Scroll reveal
  const items = document.querySelectorAll('.ln-reveal');
  if (!('IntersectionObserver' in window) || reduceMotion) {
    items.forEach((item) => item.classList.add('is-visible'));
  } else {
    const revealer = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
    items.forEach((item) => revealer.observe(item));
  }

  // Header depth cue
  const header = document.querySelector('.ln-header');
  const onScroll = () => header && header.classList.toggle('is-scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Hero 3D house: slow auto-spin, drag or swipe to turn it, momentum on release.
  const scene = document.querySelector('.ln-scene');
  const stage = document.querySelector('.ln-stage');
  if (scene && stage) {
    let yaw = -32;
    let pitch = -16;
    let velocity = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let visible = true;
    let frame = 0;
    const AUTO_SPEED = 0.12;

    const paint = () => {
      stage.style.setProperty('--ry', `${yaw}deg`);
      stage.style.setProperty('--rx', `${pitch}deg`);
    };
    paint();

    if (!reduceMotion) {
      const tick = () => {
        frame = 0;
        if (!visible || document.hidden) return;
        if (!dragging) {
          yaw += velocity + AUTO_SPEED;
          velocity *= 0.94;
          pitch += (-16 - pitch) * 0.04;
          paint();
        }
        frame = requestAnimationFrame(tick);
      };
      const start = () => { if (!frame) frame = requestAnimationFrame(tick); };
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); }).observe(scene);
      }
      document.addEventListener('visibilitychange', start);
      start();

      scene.addEventListener('pointerdown', (event) => {
        dragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
        scene.classList.add('is-dragging');
        if (scene.setPointerCapture) scene.setPointerCapture(event.pointerId);
      });
      scene.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        yaw += dx * 0.5;
        velocity = dx * 0.25;
        pitch = Math.max(-38, Math.min(-4, pitch + dy * 0.2));
        paint();
      });
      const release = () => { dragging = false; scene.classList.remove('is-dragging'); };
      scene.addEventListener('pointerup', release);
      scene.addEventListener('pointercancel', release);

      // Gentle parallax on the whole scene as the page scrolls.
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const offset = Math.min(window.scrollY, 700);
          scene.style.transform = `translate3d(0,${offset * 0.12}px,0)`;
          ticking = false;
        });
      }, { passive: true });
    }
  }

  // Cards tilt toward the pointer on devices that have one; touch devices stay flat.
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.ln-card, .ln-value').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const box = card.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width;
        const y = (event.clientY - box.top) / box.height;
        card.style.setProperty('--ty', `${(x - 0.5) * 8}deg`);
        card.style.setProperty('--tx', `${(0.5 - y) * 8}deg`);
        card.style.setProperty('--gx', `${x * 100}%`);
        card.style.setProperty('--gy', `${y * 100}%`);
        card.classList.add('is-tilting');
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--ty', '0deg');
        card.style.setProperty('--tx', '0deg');
        card.classList.remove('is-tilting');
      });
    });
  }

  // Smooth in-page links
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  });
})();
