// === PCB Loader ===
(function () {
  var loader = document.getElementById('pcb-loader');
  if (!loader) return;

  var ua = navigator.userAgent || '';
  var isIOS = /iP(ad|hone|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isWebKit = /WebKit/i.test(ua);
  var isIOSChromium = /CriOS|EdgiOS|OPiOS/i.test(ua);
  var isIOSFirefox = /FxiOS/i.test(ua);
  var isIOSSafari = isIOS && isWebKit && !isIOSChromium && !isIOSFirefox;
  if (isIOSSafari) {
    loader.classList.add('pcb-perf-safari');
  }

  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DEBUG_PCB_LOADING = false; // set true to keep loader visible after animation (page never loads)
  var ANIM_TOTAL = 4000; // controls animation speed via _S — edit this to change speed
  var _S = ANIM_TOTAL / 2300; // scale factor relative to original baseline
  var ANIM_END = Math.round(ANIM_TOTAL * 1830 / 3000); // actual visual animation end (last trace drawn)
  var POST_ANIM_HOLD = 0; // ms to hold after last trace drawn, before fading
  var FADE_MS = 300;
  var MAX_WAIT = 6000;
  var started = false;
  var done = false;
  var pageReady = false;
  var loadingDotsTimer = null;
  var allowForceFinish = false;
  var finishing = false;

  function num(v, fallback) {
    var n = parseFloat(v);
    return isFinite(n) ? n : fallback;
  }

  function dist(x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function polylineLength(points) {
    if (!points) return 0;
    var raw = points.trim();
    if (!raw) return 0;

    var nums = raw.replace(/,/g, ' ').trim().split(/\s+/).map(function (v) {
      return parseFloat(v);
    }).filter(function (v) {
      return isFinite(v);
    });

    if (nums.length < 4) return 0;

    var total = 0;
    for (var i = 2; i + 1 < nums.length; i += 2) {
      total += dist(nums[i - 2], nums[i - 1], nums[i], nums[i + 1]);
    }
    return total;
  }

  function getTraceLength(el) {
    if (el.dataset && el.dataset.len) {
      return num(el.dataset.len, 1);
    }

    var len = 0;
    var tag = (el.tagName || '').toLowerCase();

    if (tag === 'line') {
      len = dist(
        num(el.getAttribute('x1'), 0),
        num(el.getAttribute('y1'), 0),
        num(el.getAttribute('x2'), 0),
        num(el.getAttribute('y2'), 0)
      );
    } else if (tag === 'polyline') {
      len = polylineLength(el.getAttribute('points'));
    }

    if (!(len > 0) && el.getTotalLength) {
      try {
        len = el.getTotalLength();
      } catch (_) {
        len = 0;
      }
    }

    if (!(len > 0)) len = 1;
    if (el.dataset) el.dataset.len = String(len);
    return len;
  }

  function scheduleByDelay(items, onRun) {
    if (!items.length) return;
    items.sort(function (a, b) { return a.delay - b.delay; });

    var start = (window.performance && performance.now) ? performance.now() : Date.now();
    var idx = 0;

    function tick(nowTs) {
      var now = nowTs || ((window.performance && performance.now) ? performance.now() : Date.now());
      var elapsed = now - start;
      while (idx < items.length && items[idx].delay <= elapsed) {
        onRun(items[idx]);
        idx += 1;
      }
      if (idx < items.length) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function startLoadingDots(scope) {
    var labels = scope.querySelectorAll('.pcb-loading-text');
    if (!labels.length) return;

    var frame = 1;
    function tickDots() {
      labels.forEach(function (el) {
        var dotChars = el.querySelectorAll('.pcb-loading-dot-char');
        if (dotChars.length) {
          dotChars.forEach(function (dotEl, index) {
            dotEl.style.opacity = index < frame ? '1' : '0.18';
          });
          return;
        }

        // Fallback for old markup (single text node without dot tspans)
        if (!el.dataset.base) {
          el.dataset.base = (el.textContent || '').replace(/\.+\s*$/, '').trim();
        }
        el.textContent = el.dataset.base + '.'.repeat(frame);
      });
      frame = frame % 3 + 1;
    }

    tickDots();
    loadingDotsTimer = setInterval(tickDots, 360);
  }

  function finishIfReady() {
    if (DEBUG_PCB_LOADING) return;
    if (finishing || !done) return;
    if (!pageReady && !allowForceFinish) return;
    finishing = true;
    if (loadingDotsTimer) {
      clearInterval(loadingDotsTimer);
      loadingDotsTimer = null;
    }
    loader.style.transition = 'opacity ' + (FADE_MS / 1000) + 's ease';
    loader.style.opacity = 0;
    setTimeout(function () {
      loader.remove();
      document.body.classList.remove('pcb-loading');
    }, FADE_MS);
  }

  function startAnimation() {
    if (started) return;
    started = true;

    var isMobile = window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
    var scope = loader.querySelector(isMobile ? '.pcb-svg--mobile' : '.pcb-svg--desktop');
    if (!scope) scope = loader;
    startLoadingDots(scope);

    // Animate traces using stroke-dashoffset draw technique
    var traceQueue = [];
    scope.querySelectorAll('.pcb-trace').forEach(function (el) {
      var len = getTraceLength(el);
      var delay = num(el.dataset.delay, 0) * 1000 * _S;
      // Duration scales with length: short stubs fast, long traces slower
      var dur = Math.max(0.25, Math.min(0.85, len / 500)) * _S;
      el.style.strokeDasharray = len + ' ' + len;
      el.style.strokeDashoffset = len;
      traceQueue.push({ el: el, delay: delay, dur: dur });
    });
    scheduleByDelay(traceQueue, function (item) {
      item.el.style.transition = 'stroke-dashoffset ' + item.dur + 's cubic-bezier(0.4,0,0.2,1)';
      item.el.style.opacity = '1';
      item.el.style.strokeDashoffset = 0;
    });

    // Fade in component bodies, vias, and labels
    var revealQueue = [];
    scope.querySelectorAll('.pcb-reveal').forEach(function (el) {
      revealQueue.push({
        el: el,
        delay: num(el.dataset.delay, 0) * 1000 * _S,
        opacity: num(el.dataset.opacity, 1)
      });
    });
    scheduleByDelay(revealQueue, function (item) {
      item.el.style.opacity = item.opacity;
    });

    setTimeout(function () {
      done = true;
      finishIfReady();
      setTimeout(function () {
        allowForceFinish = true;
        finishIfReady();
      }, POST_ANIM_HOLD);
    }, ANIM_END);
  }

  if (prefersReduced) {
    pageReady = true;
    done = true;
    finishIfReady();
    return;
  }

  // Wait for a paint before starting timers so the user sees the full animation.
  requestAnimationFrame(function () {
    requestAnimationFrame(startAnimation);
  });

  if (document.readyState === 'complete') {
    pageReady = true;
    finishIfReady();
  } else {
    window.addEventListener('load', function () {
      pageReady = true;
      finishIfReady();
    }, { once: true });
  }

  // Safety net: don't keep the loader forever if "load" never fires.
  setTimeout(function () {
    pageReady = true;
    finishIfReady();
  }, MAX_WAIT);
}());
