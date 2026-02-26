(() => {
  'use strict';

  // --- Scrolling Stars Background ---
  const starContainer = document.getElementById('bgStars');
  const linkCanvas = document.getElementById('bgStarLinks');
  const linkCtx = linkCanvas ? linkCanvas.getContext('2d') : null;

  if (starContainer && linkCanvas && linkCtx) {
    const REF_DIAG = Math.hypot(1920, 1080);
    const BASE_LINK_DIST = 120;
    const BASE_CURSOR_LINK_DIST = 155;
    const BASE_CURSOR_RADIUS = 185;
    const BASE_SCROLL_FACTOR = 0.05;
    const BASE_LINK_CHANCE = 0.62;
    const BASE_NEAR_LINK_CHANCE = 0.34;
    const STAR_AREA = 18000;
    const MIN_STARS = 30;
    const MAX_STARS = 84;
    const STATIC_STAR_RATIO = 0.3;
    const OFFSCREEN = -9999;
    const MIN_VISIBLE_SEC = 5;
    const MAX_VISIBLE_SEC = 14;
    const MIN_FADE_SEC = 0.7;
    const MAX_FADE_SEC = 1.6;
    const MIN_HIDDEN_SEC = 0.15;
    const MAX_HIDDEN_SEC = 0.85;

    let stars = [];
    let projected = [];
    let dpr = 1;
    let viewportW = window.innerWidth;
    let viewportH = window.innerHeight;
    let linkDist = BASE_LINK_DIST;
    let cursorLinkDist = BASE_CURSOR_LINK_DIST;
    let cursorRadius = BASE_CURSOR_RADIUS;
    let scrollFactor = BASE_SCROLL_FACTOR;
    let linkChance = BASE_LINK_CHANCE;
    let nearLinkChance = BASE_NEAR_LINK_CHANCE;
    let reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const pointer = { x: OFFSCREEN, y: OFFSCREEN, active: false };
    let lastScrollY = window.scrollY || 0;
    let lastFrameTime = performance.now();

    function isDarkTheme() {
      return document.documentElement.dataset.theme === 'dark';
    }

    function linkColor(alpha) {
      return isDarkTheme()
        ? `rgba(147,197,253,${alpha})`
        : `rgba(37,99,235,${alpha})`;
    }

    function pairNoise(i, j) {
      const hash = ((((i + 1) * 374761393) ^ ((j + 1) * 668265263)) >>> 0);
      return (hash % 1000) / 1000;
    }

    function rand(min, max) {
      return min + Math.random() * (max - min);
    }

    function reseedStar(star) {
      const isStatic = Math.random() < STATIC_STAR_RATIO;
      const size = isStatic
        ? 1 + Math.random() * 1.4
        : 1 + Math.random() * 2.2;

      star.xPct = Math.random() * 100;
      star.yBasePct = Math.random() * 100;
      star.speed = isStatic ? 0 : (0.2 + Math.random() * 0.6);
      star.driftXPctPerSec = (Math.random() - 0.5) * (isStatic ? 0.3 : 0.7);
      star.driftYPctPerSec = (Math.random() - 0.5) * (isStatic ? 0.3 : 0.7);

      star.el.style.width = `${size.toFixed(2)}px`;
      star.el.style.height = `${size.toFixed(2)}px`;
      star.el.style.setProperty('--twinkle-duration', `${(2 + Math.random() * 4).toFixed(2)}s`);
      star.el.style.setProperty('--twinkle-delay', `${(Math.random() * 5).toFixed(2)}s`);
    }

    function startVisibleCycle(star, initial = false) {
      star.lifeState = 'visible';
      star.lifeOpacity = 1;
      star.fadeProgress = 0;
      star.hiddenTimer = 0;
      star.fadeDuration = rand(MIN_FADE_SEC, MAX_FADE_SEC);
      star.visibleTimer = initial
        ? rand(0.3, MAX_VISIBLE_SEC)
        : rand(MIN_VISIBLE_SEC, MAX_VISIBLE_SEC);
    }

    function scheduleRespawn(star) {
      reseedStar(star);
      star.lifeState = 'hidden';
      star.lifeOpacity = 0;
      star.hiddenTimer = rand(MIN_HIDDEN_SEC, MAX_HIDDEN_SEC);
      star.fadeDuration = rand(MIN_FADE_SEC, MAX_FADE_SEC);
      star.fadeProgress = 0;
    }

    function nearPointer(px, py) {
      if (!pointer.active) return false;
      const dx = px - pointer.x;
      const dy = py - pointer.y;
      return (dx * dx + dy * dy) < (cursorRadius * cursorRadius);
    }

    function updateResponsiveSettings() {
      viewportW = window.innerWidth;
      viewportH = window.innerHeight;

      const isCoarse = window.matchMedia('(pointer: coarse)').matches;
      const diag = Math.hypot(viewportW, viewportH);
      const scale = diag / REF_DIAG;
      const perfBias = (isCoarse ? 0.88 : 1) * (reduceMotion ? 0.9 : 1);

      let count = Math.round((viewportW * viewportH) / STAR_AREA);
      count = Math.round(count * 0.7);
      count = Math.max(MIN_STARS, Math.min(MAX_STARS, count));
      if (isCoarse) count = Math.round(count * 0.8);
      if (reduceMotion) count = Math.round(count * 0.85);

      linkDist = BASE_LINK_DIST * scale * perfBias;
      cursorLinkDist = BASE_CURSOR_LINK_DIST * scale * perfBias;
      cursorRadius = BASE_CURSOR_RADIUS * scale * perfBias;
      scrollFactor = BASE_SCROLL_FACTOR * (isCoarse ? 0.9 : 1) * (reduceMotion ? 0.75 : 1);
      linkChance = BASE_LINK_CHANCE + (isCoarse ? 0.06 : 0);
      nearLinkChance = BASE_NEAR_LINK_CHANCE + (isCoarse ? 0.06 : 0) + (reduceMotion ? 0.04 : 0);

      return count;
    }

    function resizeLinkCanvas() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      linkCanvas.width = Math.round(viewportW * dpr);
      linkCanvas.height = Math.round(viewportH * dpr);
      linkCanvas.style.width = `${viewportW}px`;
      linkCanvas.style.height = `${viewportH}px`;
      linkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function buildStars(count) {
      starContainer.innerHTML = '';
      stars = [];
      projected = new Array(count);

      for (let i = 0; i < count; i++) {
        const starEl = document.createElement('span');
        starEl.className = 'star';
        starContainer.appendChild(starEl);

        const star = {
          el: starEl,
          xPct: 0,
          yBasePct: 0,
          speed: 0,
          driftXPctPerSec: 0,
          driftYPctPerSec: 0,
          lifeState: 'visible',
          lifeOpacity: 1,
          visibleTimer: 0,
          hiddenTimer: 0,
          fadeDuration: 1,
          fadeProgress: 0
        };

        reseedStar(star);
        startVisibleCycle(star, true);
        stars.push(star);
      }
    }

    function clearPointer() {
      pointer.active = false;
      pointer.x = OFFSCREEN;
      pointer.y = OFFSCREEN;
    }

    function refreshBackground() {
      const count = updateResponsiveSettings();
      resizeLinkCanvas();
      buildStars(count);
    }

    refreshBackground();

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(refreshBackground, 120);
    });

    window.addEventListener('mousemove', (e) => {
      pointer.active = true;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    });

    window.addEventListener('mouseleave', clearPointer);

    window.addEventListener('touchstart', (e) => {
      if (!e.touches || e.touches.length === 0) return;
      pointer.active = true;
      pointer.x = e.touches[0].clientX;
      pointer.y = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!e.touches || e.touches.length === 0) return;
      pointer.active = true;
      pointer.x = e.touches[0].clientX;
      pointer.y = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchend', clearPointer, { passive: true });
    window.addEventListener('touchcancel', clearPointer, { passive: true });

    const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (e) => {
      reduceMotion = e.matches;
      refreshBackground();
    };
    if (motionMedia.addEventListener) {
      motionMedia.addEventListener('change', handleMotionChange);
    } else if (motionMedia.addListener) {
      motionMedia.addListener(handleMotionChange);
    }

    function draw(now) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const dt = Math.max(1, now - lastFrameTime);
      const dtSec = Math.min(0.05, dt / 1000);
      const velocityPxPerMs = (scrollY - lastScrollY) / dt;
      const stretchCap = reduceMotion ? 0.2 : 0.45;
      const stretch = 1 + Math.min(stretchCap, Math.abs(velocityPxPerMs) * 0.18);

      linkCtx.clearRect(0, 0, viewportW, viewportH);

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.xPct = (s.xPct + s.driftXPctPerSec * dtSec + 100) % 100;
        s.yBasePct = (s.yBasePct + s.driftYPctPerSec * dtSec + 100) % 100;

        if (s.lifeState === 'visible') {
          s.visibleTimer -= dtSec;
          s.lifeOpacity = 1;
          if (s.visibleTimer <= 0) {
            s.lifeState = 'fadingOut';
            s.fadeDuration = rand(MIN_FADE_SEC, MAX_FADE_SEC);
            s.fadeProgress = 0;
          }
        } else if (s.lifeState === 'fadingOut') {
          s.fadeProgress += dtSec;
          const t = Math.min(s.fadeProgress / s.fadeDuration, 1);
          s.lifeOpacity = 1 - t;
          if (t >= 1) {
            scheduleRespawn(s);
          }
        } else if (s.lifeState === 'hidden') {
          s.hiddenTimer -= dtSec;
          s.lifeOpacity = 0;
          if (s.hiddenTimer <= 0) {
            s.lifeState = 'fadingIn';
            s.fadeDuration = rand(MIN_FADE_SEC, MAX_FADE_SEC);
            s.fadeProgress = 0;
          }
        } else if (s.lifeState === 'fadingIn') {
          s.fadeProgress += dtSec;
          const t = Math.min(s.fadeProgress / s.fadeDuration, 1);
          s.lifeOpacity = t;
          if (t >= 1) {
            startVisibleCycle(s, false);
          }
        }

        let yPct = s.yBasePct;
        if (s.speed !== 0) {
          yPct = (s.yBasePct - scrollY * s.speed * scrollFactor) % 100;
          if (yPct < 0) yPct += 100;
        }

        const x = (s.xPct / 100) * viewportW;
        const y = (yPct / 100) * viewportH;
        projected[i] = { x, y, opacity: s.lifeOpacity };

        const warp = s.speed === 0 ? 1 : stretch;
        s.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scaleY(${warp.toFixed(3)})`;
        s.el.style.opacity = s.lifeOpacity.toFixed(3);
      }

      for (let i = 0; i < projected.length; i++) {
        const a = projected[i];
        if (a.opacity < 0.18) continue;
        const aNear = nearPointer(a.x, a.y);

        for (let j = i + 1; j < projected.length; j++) {
          const b = projected[j];
          if (b.opacity < 0.18) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          const bothNear = aNear && nearPointer(b.x, b.y);
          const maxDist = bothNear ? cursorLinkDist : linkDist;
          const pairRandom = pairNoise(i, j);

          if (dist >= maxDist) continue;
          if (bothNear && pairRandom > nearLinkChance) continue;
          if (!bothNear && pairRandom > linkChance) continue;

          const visibility = Math.min(a.opacity, b.opacity);
          const alpha = (bothNear
            ? 0.20 * (1 - dist / maxDist)
            : 0.14 * (1 - dist / maxDist)) * visibility;
          if (alpha <= 0.01) continue;

          linkCtx.beginPath();
          linkCtx.moveTo(a.x, a.y);
          linkCtx.lineTo(b.x, b.y);
          linkCtx.strokeStyle = linkColor(alpha);
          linkCtx.lineWidth = bothNear ? 1.0 : 0.8;
          linkCtx.stroke();
        }
      }

      lastScrollY = scrollY;
      lastFrameTime = now;
      requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
  }

  // --- Scroll Reveal ---
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // --- Nav shadow on scroll ---
  const nav = document.querySelector('.nav');
  const onScroll = () => {
    nav.classList.toggle('nav--scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // --- Active nav link ---
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__links .nav__link');

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.toggle('nav__link--active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { threshold: 0.3, rootMargin: '-80px 0px -50% 0px' });

  sections.forEach(section => sectionObserver.observe(section));

  // --- Mobile nav toggle ---
  const hamburger = document.querySelector('.nav__hamburger');
  const mobileMenu = document.querySelector('.nav__links');

  function closeMenu() {
    mobileMenu.classList.remove('nav__links--open');
    hamburger.classList.remove('nav__hamburger--open');
    hamburger.setAttribute('aria-expanded', 'false');
  }

  hamburger.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('nav__links--open');
    hamburger.classList.toggle('nav__hamburger--open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen);
  });

  navLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close menu when tapping outside
  document.addEventListener('click', (e) => {
    if (mobileMenu.classList.contains('nav__links--open') &&
        !mobileMenu.contains(e.target) &&
        !hamburger.contains(e.target)) {
      closeMenu();
    }
  });

  // --- Auto-open skills accordions on scroll ---
  const skillsCharts = document.querySelector('.skills-charts');
  if (skillsCharts) {
    const skillsRevealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const accordions = entry.target.querySelectorAll('.skills-accordion');
          accordions.forEach((accordion, i) => {
            setTimeout(() => { accordion.open = true; }, i * 180);
          });
          skillsRevealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    skillsRevealObserver.observe(skillsCharts);
  }

  // --- Why Section: Stat Counters + Border Sweep ---
  const whyStats = document.querySelector('.why__stats');
  if (whyStats) {
    function countUp(el) {
      const target = +el.dataset.count;
      const suffix = el.dataset.suffix || '';
      const duration = 1600;
      const start = performance.now();
      function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        el.textContent = Math.round(eased * target) + suffix;
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          el.textContent = target + suffix;
          el.classList.add('why__stat-num--done');
        }
      }
      requestAnimationFrame(tick);
    }

    const statsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const cards = entry.target.querySelectorAll('.why__stat');
        const nums  = entry.target.querySelectorAll('.why__stat-num[data-count]');
        // Border sweep: staggered per card
        cards.forEach((card, i) => {
          setTimeout(() => card.classList.add('why__stat--animate'), i * 160);
        });
        // Counter: starts slightly after reveal animation settles
        nums.forEach((num, i) => {
          setTimeout(() => countUp(num), 350 + i * 160);
        });
        statsObserver.unobserve(entry.target);
      });
    }, { threshold: 0.25 });

    statsObserver.observe(whyStats);
  }

  // --- Contact form ---
  const form = document.getElementById('contactForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('.contact-form__submit');
    const feedback = document.getElementById('formFeedback');
    const originalText = btn.textContent;

    btn.textContent = 'Wird gesendet…';
    btn.disabled = true;
    feedback.textContent = '';
    feedback.className = 'contact-form__feedback';

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    form.querySelector('#contactName').value,
          email:   form.querySelector('#contactEmail').value,
          message: form.querySelector('#contactMessage').value,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        feedback.textContent = 'Nachricht erfolgreich verschickt!';
        feedback.classList.add('contact-form__feedback--success');
        form.reset();
      } else {
        throw new Error(data.error || 'Unbekannter Fehler');
      }
    } catch (err) {
      feedback.textContent = 'Fehler beim Senden. Bitte versuche es erneut.';
      feedback.classList.add('contact-form__feedback--error');
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });

  // --- Smooth scroll with offset ---
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const offset = 72;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  // --- Dark Mode Toggle ---
  const themeToggle = document.querySelector('.nav__theme-toggle');

  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    // Briefly add transition class for smooth switch
    document.documentElement.classList.add('theme-transition');
    setTimeout(() => document.documentElement.classList.remove('theme-transition'), 400);

    if (isDark) {
      delete document.documentElement.dataset.theme;
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.dataset.theme = 'dark';
      localStorage.setItem('theme', 'dark');
    }
  });
})();
