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
  const progress = document.querySelector('.ln-progress');
  const onScroll = () => {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 10);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.setProperty('--p', max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0);
    }
  };
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
    let moved = 0;
    const bubble = document.querySelector('.ln-bubble span');
    const lines = ['Hi, welcome home!', 'Come on in!', 'Keys are ready!', 'Let us find yours!'];
    let lineIndex = 0;
    let openTimer = 0;
    const colours = ['#d2b47c', '#f6f1e5', '#5fa88a', '#e9967a', '#8fc7e8'];
    const celebrate = () => {
      stage.classList.remove('is-hop');
      void stage.offsetWidth;
      stage.classList.add('is-hop');
      stage.classList.add('is-open');
      clearTimeout(openTimer);
      openTimer = setTimeout(() => stage.classList.remove('is-open', 'is-hop'), 2400);
      if (bubble) {
        lineIndex = (lineIndex + 1) % lines.length;
        bubble.textContent = lines[lineIndex];
      }
      if (!scene.animate) return;
      for (let i = 0; i < 26; i += 1) {
        const piece = document.createElement('i');
        piece.className = 'ln-confetti';
        piece.style.background = colours[i % colours.length];
        scene.appendChild(piece);
        const angle = (Math.PI * 2 * i) / 26 + Math.random() * 0.4;
        const power = 90 + Math.random() * 130;
        const animation = piece.animate([
          { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
          { transform: `translate(${Math.cos(angle) * power}px, ${Math.sin(angle) * power - 70}px) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${Math.cos(angle) * power * 1.2}px, ${Math.sin(angle) * power + 120}px) rotate(${Math.random() * 900}deg)`, opacity: 0 }
        ], { duration: 1300 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.4,1)' });
        animation.onfinish = () => piece.remove();
      }
    };

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
        moved = 0;
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
        moved += Math.abs(dx) + Math.abs(dy);
        yaw += dx * 0.5;
        velocity = dx * 0.25;
        pitch = Math.max(-38, Math.min(-4, pitch + dy * 0.2));
        paint();
      });
      const release = () => { dragging = false; scene.classList.remove('is-dragging'); };
      scene.addEventListener('pointerup', () => {
        const wasTap = dragging && moved < 6;
        release();
        if (wasTap) celebrate();
      });
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

  // Soft glow that follows the pointer across the hero.
  const hero = document.querySelector('.ln-hero');
  if (hero && finePointer && !reduceMotion) {
    hero.addEventListener('pointermove', (event) => {
      const box = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', `${event.clientX - box.left}px`);
      hero.style.setProperty('--my', `${event.clientY - box.top}px`);
    });
  }

  // Buttons lean a little toward the pointer.
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.ln-btn, .ln-go, .ln-cta').forEach((button) => {
      button.addEventListener('pointermove', (event) => {
        const box = button.getBoundingClientRect();
        const x = (event.clientX - box.left - box.width / 2) * 0.18;
        const y = (event.clientY - box.top - box.height / 2) * 0.3;
        button.style.translate = `${x}px ${y}px`;
      });
      button.addEventListener('pointerleave', () => { button.style.translate = ''; });
    });
  }

  // Search box types example searches until the visitor clicks into it.
  const search = document.getElementById('ln-search');
  if (search && !reduceMotion) {
    const original = search.getAttribute('placeholder') || '';
    const phrases = ['Try a city or neighbourhood', 'Try a property name', 'A place to rent or to own'];
    let phrase = 0;
    let letters = 0;
    let erasing = false;
    let timer = 0;
    const stop = () => { clearTimeout(timer); timer = 0; search.setAttribute('placeholder', original); };
    const step = () => {
      const text = phrases[phrase];
      letters += erasing ? -1 : 1;
      search.setAttribute('placeholder', text.slice(0, letters) || ' ');
      let delay = erasing ? 25 : 60;
      if (!erasing && letters === text.length) { erasing = true; delay = 1400; }
      else if (erasing && letters === 0) { erasing = false; phrase = (phrase + 1) % phrases.length; delay = 350; }
      timer = setTimeout(step, delay);
    };
    search.addEventListener('focus', stop);
    search.addEventListener('blur', () => { if (!search.value && !timer) step(); });
    timer = setTimeout(step, 1800);
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
