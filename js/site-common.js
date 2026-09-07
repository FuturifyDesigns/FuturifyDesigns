/**
 * Futurify Designs — shared site behaviors
 * hamburger · scroll reveal · opening overlay
 */
(function () {
  'use strict';

  /* ── Hamburger ─────────────────────────────────────────── */
  function initNav() {
    var hamburger = document.getElementById('hamburger');
    var navLinks = document.getElementById('navLinks');
    if (!hamburger || !navLinks) return;

    function close() {
      hamburger.classList.remove('active');
      navLinks.classList.remove('active');
      document.body.style.overflow = '';
      document.body.classList.remove('nav-open');
    }

    hamburger.addEventListener('click', function () {
      var open = navLinks.classList.toggle('active');
      hamburger.classList.toggle('active', open);
      document.body.style.overflow = open ? 'hidden' : '';
      document.body.classList.toggle('nav-open', open);
    });

    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', close);
    });
  }

  /* ── Reveal on scroll ──────────────────────────────────── */
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) {
        el.classList.add('in', 'visible');
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('in', 'visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    els.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ── Opening overlay character reveal ──────────────────── */
  /**
   * Split `word` into animated characters inside #ooWord / .oo-word,
   * animate a progress bar, then dismiss the overlay.
   * Returns a Promise that resolves when the overlay starts exiting.
   * @param {string} word
   * @param {{duration?: number, onDone?: function}} [opts]
   */
  window.runOpening = function runOpening(word, opts) {
    opts = opts || {};
    var duration = typeof opts.duration === 'number' ? opts.duration : 2600;
    var overlay =
      document.getElementById('opening') ||
      document.getElementById('openingOverlay') ||
      document.querySelector('.opening-overlay');
    var wordEl =
      document.getElementById('ooWord') ||
      (overlay && overlay.querySelector('.oo-word'));
    var barEl =
      document.getElementById('ooBar') ||
      (overlay && overlay.querySelector('.oo-barfill'));
    var pctEl =
      document.getElementById('ooPct') ||
      (overlay && overlay.querySelector('.oo-pct'));
    var page = document.getElementById('page');

    if (!wordEl) {
      if (overlay) overlay.classList.add('out');
      if (page) page.classList.add('revealed');
      if (typeof opts.onDone === 'function') opts.onDone();
      return Promise.resolve();
    }

    var text = word == null ? 'Futurify' : String(word);
    wordEl.textContent = '';

    text.split('').forEach(function (ch) {
      var s = document.createElement('span');
      s.className = 'oo-char';
      s.textContent = ch;
      if (ch === ' ') {
        s.style.width = '0.3em';
        s.style.transform = 'none';
        s.style.opacity = '1';
        s.style.display = 'inline';
      }
      wordEl.appendChild(s);
    });

    setTimeout(function () {
      wordEl.querySelectorAll('.oo-char').forEach(function (s, i) {
        setTimeout(function () {
          s.style.transition =
            'transform .6s cubic-bezier(0.34,1.5,0.64,1), opacity .35s ease';
          s.style.transform = 'translateY(0)';
          s.style.opacity = '1';
        }, i * 45);
      });
    }, 150);

    var pct = 0;
    var iv = setInterval(function () {
      pct += Math.random() * 10 + 3;
      if (pct > 100) pct = 100;
      if (pctEl) pctEl.textContent = String(Math.round(pct)).padStart(3, '0');
      if (barEl) {
        barEl.style.width = pct + '%';
        barEl.style.transition = 'width 0.3s ease';
      }
      if (pct >= 100) clearInterval(iv);
    }, 100);

    return new Promise(function (resolve) {
      function finish() {
        if (overlay) {
          overlay.classList.add('out', 'is-done');
          overlay.dataset.started = '1';
          setTimeout(function () {
            if (overlay && overlay.parentNode) overlay.style.display = 'none';
          }, 900);
        }
        if (page) page.classList.add('revealed');
        document.body.style.overflow = '';
        if (typeof opts.onDone === 'function') opts.onDone();
        resolve();
      }

      // Absolute failsafe — dismiss within 4s even if load hangs
      setTimeout(finish, Math.max(duration, 1800) + 1500);
    });
  };

  /* ── Boot ──────────────────────────────────────────────── */
  function boot() {
    initNav();
    initReveal();

    // Auto-dismiss opening overlay if present and nothing started it yet
    var overlay =
      document.getElementById('opening') ||
      document.getElementById('openingOverlay') ||
      document.querySelector('.opening-overlay');
    if (overlay && !overlay.dataset.started) {
      overlay.dataset.started = '1';
      var label = overlay.getAttribute('data-label') || 'Futurify';
      window.runOpening(label);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
