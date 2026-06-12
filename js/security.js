/**
 * Futurify Designs — client-side security helpers
 * Note: Client-side checks supplement (not replace) server-side validation.
 */
(function (global) {
    'use strict';

    var STORAGE_PREFIX = 'futurify_sec_';

    function now() {
        return Date.now();
    }

    function getStore(key) {
        try {
            var raw = localStorage.getItem(STORAGE_PREFIX + key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function setStore(key, value) {
        try {
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
        } catch (e) { /* private mode / quota */ }
    }

    function rateLimit(key, maxAttempts, windowMs) {
        var bucket = getStore('rl_' + key) || { count: 0, resetAt: 0 };
        var t = now();

        if (t > bucket.resetAt) {
            bucket = { count: 0, resetAt: t + windowMs };
        }

        if (bucket.count >= maxAttempts) {
            var waitSec = Math.ceil((bucket.resetAt - t) / 1000);
            return { allowed: false, retryAfterSec: waitSec };
        }

        bucket.count += 1;
        setStore('rl_' + key, bucket);
        return { allowed: true, remaining: maxAttempts - bucket.count };
    }

    function checkHoneypot(input) {
        if (!input) return true;
        return !String(input.value || '').trim();
    }

    function checkFormTiming(form, minMs) {
        if (!form) return true;
        var loaded = parseInt(form.getAttribute('data-loaded-at') || '0', 10);
        if (!loaded) return true;
        return (now() - loaded) >= (minMs || 3000);
    }

    function sanitizeInput(value, maxLen) {
        if (value == null) return '';
        var s = String(value).replace(/[\0\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
        if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
        return s;
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
    }

    function secureFetch(url, options, rateKey, maxAttempts, windowMs) {
        var limit = rateLimit(rateKey || 'fetch_default', maxAttempts || 30, windowMs || 60000);
        if (!limit.allowed) {
            return Promise.reject(new Error('RATE_LIMIT:' + limit.retryAfterSec));
        }
        return fetch(url, options);
    }

    function markFormLoaded(form) {
        if (form && !form.getAttribute('data-loaded-at')) {
            form.setAttribute('data-loaded-at', String(now()));
        }
    }

    function initHoneypotForms() {
        document.querySelectorAll('form[data-honeypot]').forEach(markFormLoaded);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHoneypotForms);
    } else {
        initHoneypotForms();
    }

    global.FuturifySecurity = {
        rateLimit: rateLimit,
        checkHoneypot: checkHoneypot,
        checkFormTiming: checkFormTiming,
        sanitizeInput: sanitizeInput,
        isValidEmail: isValidEmail,
        secureFetch: secureFetch,
        markFormLoaded: markFormLoaded
    };
})(typeof window !== 'undefined' ? window : this);
