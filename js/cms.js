(function () {
    'use strict';

    var CMS_KEY = 'futurify_cms_content_v1';
    var AUTH_KEY = 'futurify_cms_admin_session';
    var CUSTOM_SECTION_ATTR = 'data-cms-custom-sections';
    var EDITABLE_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, li, a, button, span, strong, em, blockquote, img';
    var state = loadState();
    var isAdminPage = /\/admin\.html$/i.test(location.pathname);
    var isLoggedIn = sessionStorage.getItem(AUTH_KEY) === 'true';
    var activeEditor = null;

    function loadState() {
        try { return JSON.parse(localStorage.getItem(CMS_KEY) || '{}'); }
        catch (error) { return {}; }
    }

    function saveState() {
        localStorage.setItem(CMS_KEY, JSON.stringify(state));
    }

    function pageKey() {
        return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    }

    function pageState() {
        var key = pageKey();
        if (!state[key]) state[key] = { nodes: {}, customSections: {} };
        if (!state[key].nodes) state[key].nodes = {};
        if (!state[key].customSections) state[key].customSections = {};
        return state[key];
    }

    function nodePath(el) {
        if (el.id) return '#' + el.id;
        var parts = [];
        while (el && el.nodeType === 1 && el !== document.body) {
            var name = el.tagName.toLowerCase();
            var index = 1;
            var sibling = el;
            while ((sibling = sibling.previousElementSibling)) {
                if (sibling.tagName === el.tagName) index += 1;
            }
            parts.unshift(name + ':nth-of-type(' + index + ')');
            el = el.parentElement;
        }
        return parts.join('>');
    }

    function applyNodeState(el, value) {
        if (!value) return;
        if (value.hidden) el.style.display = 'none';
        if (value.html != null && el.tagName !== 'IMG') el.innerHTML = value.html;
        if (value.href && el.tagName === 'A') el.setAttribute('href', value.href);
        if (value.src && el.tagName === 'IMG') el.setAttribute('src', value.src);
        if (value.alt != null && el.tagName === 'IMG') el.setAttribute('alt', value.alt);
    }

    function applySavedContent() {
        var current = pageState();
        document.querySelectorAll(EDITABLE_SELECTOR).forEach(function (el) {
            var key = nodePath(el);
            if (current.nodes[key]) applyNodeState(el, current.nodes[key]);
        });
        document.querySelectorAll('[' + CUSTOM_SECTION_ATTR + ']').forEach(function (zone) {
            var zoneKey = zone.getAttribute(CUSTOM_SECTION_ATTR);
            if (current.customSections[zoneKey]) zone.innerHTML = current.customSections[zoneKey];
        });
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function closeEditor() {
        if (activeEditor && activeEditor.panel) activeEditor.panel.remove();
        activeEditor = null;
    }

    function openEditor(el) {
        closeEditor();
        var key = nodePath(el);
        var currentValue = pageState().nodes[key] || {};
        var isImage = el.tagName === 'IMG';
        var isLink = el.tagName === 'A';
        var panel = document.createElement('div');
        panel.className = 'cms-editor';
        panel.innerHTML = '<div class="cms-editor-card">'
            + '<div class="cms-editor-head"><strong>Admin Editor</strong><button type="button" data-cms-close>&times;</button></div>'
            + (isImage
                ? '<label>Image URL</label><input type="text" data-cms-src value="' + escapeHtml(currentValue.src || el.getAttribute('src') || '') + '"><label>Alt text</label><input type="text" data-cms-alt value="' + escapeHtml(currentValue.alt || el.getAttribute('alt') || '') + '">'
                : '<label>Content</label><textarea data-cms-text>' + escapeHtml(currentValue.html || el.innerHTML) + '</textarea>')
            + (isLink ? '<label>Link URL</label><input type="text" data-cms-href value="' + escapeHtml(currentValue.href || el.getAttribute('href') || '') + '">' : '')
            + '<label class="cms-checkbox"><input type="checkbox" data-cms-hidden ' + (currentValue.hidden ? 'checked' : '') + '> Hide this element</label>'
            + '<div class="cms-editor-actions"><button type="button" data-cms-reset>Reset</button><button type="button" data-cms-save>Save</button></div>'
            + '</div>';
        document.body.appendChild(panel);
        activeEditor = { panel: panel };

        panel.querySelector('[data-cms-close]').addEventListener('click', closeEditor);
        panel.addEventListener('click', function (event) {
            if (event.target === panel) closeEditor();
        });
        panel.querySelector('[data-cms-save]').addEventListener('click', function () {
            var next = { hidden: panel.querySelector('[data-cms-hidden]').checked };
            if (isImage) {
                next.src = panel.querySelector('[data-cms-src]').value.trim();
                next.alt = panel.querySelector('[data-cms-alt]').value.trim();
            } else {
                next.html = panel.querySelector('[data-cms-text]').value;
            }
            if (isLink) next.href = panel.querySelector('[data-cms-href]').value.trim();
            pageState().nodes[key] = next;
            saveState();
            applyNodeState(el, next);
            closeEditor();
        });
        panel.querySelector('[data-cms-reset]').addEventListener('click', function () {
            delete pageState().nodes[key];
            saveState();
            location.reload();
        });
    }

    function createToolbar() {
        var toolbar = document.createElement('div');
        toolbar.className = 'cms-toolbar';
        toolbar.innerHTML = '<button type="button" data-cms-add>Add Section</button><button type="button" data-cms-edit-zone>Edit Section Area</button><button type="button" data-cms-clear>Reset Page</button><button type="button" data-cms-logout>Logout</button>';
        document.body.appendChild(toolbar);

        toolbar.querySelector('[data-cms-logout]').addEventListener('click', function () {
            sessionStorage.removeItem(AUTH_KEY);
            location.href = 'admin.html';
        });
        toolbar.querySelector('[data-cms-clear]').addEventListener('click', function () {
            state[pageKey()] = { nodes: {}, customSections: {} };
            saveState();
            location.reload();
        });
        toolbar.querySelector('[data-cms-add]').addEventListener('click', function () {
            var zone = document.querySelector('[' + CUSTOM_SECTION_ATTR + ']');
            if (!zone) return alert('No custom section zone was found on this page.');
            var content = prompt('Paste the section HTML you want to add:', '<section class="cms-section"><h2>New Section</h2><p>Edit this section content.</p></section>');
            if (!content) return;
            zone.insertAdjacentHTML('beforeend', content);
            pageState().customSections[zone.getAttribute(CUSTOM_SECTION_ATTR)] = zone.innerHTML;
            saveState();
        });
        toolbar.querySelector('[data-cms-edit-zone]').addEventListener('click', function () {
            var zone = document.querySelector('[' + CUSTOM_SECTION_ATTR + ']');
            if (!zone) return alert('No custom section zone was found on this page.');
            var next = prompt('Edit the custom sections HTML for this page:', zone.innerHTML);
            if (next == null) return;
            zone.innerHTML = next;
            pageState().customSections[zone.getAttribute(CUSTOM_SECTION_ATTR)] = next;
            saveState();
        });
    }

    function injectStyles() {
        var style = document.createElement('style');
        style.textContent = '.cms-toolbar{position:fixed;right:18px;bottom:18px;z-index:400000;display:flex;gap:10px;flex-wrap:wrap;padding:12px;background:rgba(6,6,6,.92);border:1px solid rgba(242,237,229,.15);backdrop-filter:blur(14px)}'
            + '.cms-toolbar button{background:#c8f135;color:#060606;border:none;padding:10px 14px;font:700 12px Syne,sans-serif;cursor:pointer}'
            + '.cms-editor{position:fixed;inset:0;z-index:400100;background:rgba(6,6,6,.82);display:flex;align-items:center;justify-content:center;padding:20px}'
            + '.cms-editor-card{width:min(720px,100%);background:#060606;border:1px solid rgba(242,237,229,.16);padding:20px;display:flex;flex-direction:column;gap:10px;color:#f2ede5}'
            + '.cms-editor-head{display:flex;align-items:center;justify-content:space-between}'
            + '.cms-editor-head button{background:none;border:none;color:#f2ede5;font-size:28px;cursor:pointer}'
            + '.cms-editor textarea,.cms-editor input{width:100%;background:#111;border:1px solid rgba(242,237,229,.18);color:#f2ede5;padding:12px;font:400 13px \"DM Mono\",monospace}'
            + '.cms-editor textarea{min-height:220px;resize:vertical}'
            + '.cms-editor label{font:700 11px \"DM Mono\",monospace;letter-spacing:.08em;text-transform:uppercase;color:rgba(242,237,229,.72)}'
            + '.cms-editor-actions{display:flex;gap:10px;justify-content:flex-end}'
            + '.cms-editor-actions button{padding:10px 14px;border:none;cursor:pointer;font:700 12px Syne,sans-serif}'
            + '.cms-editor-actions [data-cms-reset]{background:#1b1b1b;color:#f2ede5;border:1px solid rgba(242,237,229,.16)}'
            + '.cms-editor-actions [data-cms-save]{background:#c8f135;color:#060606}'
            + '.cms-checkbox{display:flex;align-items:center;gap:10px}'
            + '.cms-checkbox input{width:auto}'
            + '.cms-editable{outline:1px dashed rgba(200,241,53,.25);outline-offset:4px;cursor:pointer !important}'
            + '@media (max-width:700px){.cms-toolbar{left:12px;right:12px;bottom:12px}.cms-toolbar button{flex:1 1 140px}}';
        document.head.appendChild(style);
    }

    function makeEditable() {
        document.querySelectorAll(EDITABLE_SELECTOR).forEach(function (el) {
            if (el.closest('.cms-toolbar, .cms-editor') || el.hasAttribute('data-cms-ignore')) return;
            el.classList.add('cms-editable');
            el.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                openEditor(el);
            });
        });
    }

    function initAdmin() {
        if (!isLoggedIn || isAdminPage) return;
        injectStyles();
        createToolbar();
        makeEditable();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            applySavedContent();
            initAdmin();
        });
    } else {
        applySavedContent();
        initAdmin();
    }
})();
