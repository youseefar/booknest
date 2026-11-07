(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = document.querySelectorAll('.jp-reveal');
  const header = document.querySelector('.jp-header');
  const art = document.querySelector('.jp-hero-art');
  if (!('IntersectionObserver' in window) || reduceMotion) {
    items.forEach((item) => item.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver((entries, activeObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          activeObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });
    items.forEach((item) => observer.observe(item));
  }

  // Subtle pointer-driven 3D perspective; touch devices keep the floating animation.
  if (art && !reduceMotion && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    art.addEventListener('pointermove', (event) => {
      const bounds = art.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      art.style.transform = `perspective(1100px) rotateY(${x * 5}deg) rotateX(${y * -5}deg)`;
    });
    art.addEventListener('pointerleave', () => {
      art.style.transform = '';
    });
  }

  // Give the navigation a quiet depth cue after the visitor starts scrolling.
  let ticking = false;
  const updateHeader = () => {
    if (header) header.classList.toggle('jp-scrolled', window.scrollY > 12);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateHeader);
      ticking = true;
    }
  }, { passive: true });
  updateHeader();

  // Animate in-page navigation without hijacking external or modified clicks.
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  });
})();