(() => {
  'use strict';

  // --- Particle Background ---
  const canvas = document.getElementById('bgParticles');
  const ctx = canvas.getContext('2d');
  let particles = [];
  const REF_DIAG = Math.sqrt(1920 * 1920 + 1080 * 1080); // reference: 1080p
  const BASE_LINK_DIST = 120;
  const BASE_CURSOR_LINK_DIST = 200;
  const BASE_CURSOR_RADIUS = 250;
  const DENSITY = 36000;
  const MAX_PARTICLES = 40;

  let linkDist = BASE_LINK_DIST;
  let cursorLinkDist = BASE_CURSOR_LINK_DIST;
  let cursorRadius = BASE_CURSOR_RADIUS;

  let mouse = { x: -9999, y: -9999 };
  window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

  let dpr = 1;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const diag = Math.sqrt(window.innerWidth * window.innerWidth + window.innerHeight * window.innerHeight);
    const scale = diag / REF_DIAG;
    linkDist = BASE_LINK_DIST * scale;
    cursorLinkDist = BASE_CURSOR_LINK_DIST * scale;
    cursorRadius = BASE_CURSOR_RADIUS * scale;
  }
  resize();
  window.addEventListener('resize', () => { resize(); init(); });

  function init() {
    particles = [];
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const count = Math.min(Math.floor((w * h) / DENSITY), MAX_PARTICLES);
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.8 + 1
      });
    }
  }
  init();

  function nearCursor(px, py) {
    const dx = px - mouse.x;
    const dy = py - mouse.y;
    return Math.sqrt(dx * dx + dy * dy) < cursorRadius;
  }

  function particleColor(alpha) {
    return document.documentElement.dataset.theme === 'dark'
      ? `rgba(99,153,255,${alpha})`
      : `rgba(37,99,235,${alpha})`;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // Lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const bothNear = nearCursor(particles[i].x, particles[i].y) && nearCursor(particles[j].x, particles[j].y);
        const maxDist = bothNear ? cursorLinkDist : linkDist;
        if (dist < maxDist) {
          const alpha = bothNear
            ? 0.25 * (1 - dist / maxDist)
            : 0.13 * (1 - dist / maxDist);
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = particleColor(alpha);
          ctx.lineWidth = bothNear ? 1.2 : 0.8;
          ctx.stroke();
        }
      }
    }

    // Dots
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width / dpr) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height / dpr) p.vy *= -1;
      const isNear = nearCursor(p.x, p.y);
      const dotAlpha = isNear ? 0.45 : 0.25;
      const dotRadius = isNear ? p.r * 1.3 : p.r;
      ctx.beginPath();
      ctx.arc(p.x, p.y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = particleColor(dotAlpha);
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }
  draw();

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
