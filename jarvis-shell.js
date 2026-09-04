// ══════════════════════════════════════════════════════════════════
// JARVIS — БҮРХҮҮЛ (5 хаалганы цэс + Jarvis товч)
// ══════════════════════════════════════════════════════════════════
// Хэрэглэх: хуудасны төгсгөлд
//   <script src="jarvis-shell.js" data-page="home"></script>
// data-page утга: home | hsk | life | finance | profile
//
// Цэсийг дахин бичих шаардлагагүй — энэ файл бүх хуудсанд адилхан
// цэс, Jarvis товчийг өөрөө зурна. Нэг л газраас засна.
'use strict';

(function () {
  if (window.jarvisShell) return;

  var I = {
    home:    '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5"/>',
    hsk:     '<path d="M4 4h7v13a3 3 0 0 0-3-3H4z"/><path d="M20 4h-7v13a3 3 0 0 1 3-3h4z"/>',
    life:    '<path d="M3 12h4l2.5-6 4 12 2.5-6h5"/>',
    finance: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.4"/>',
    profile: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    brand:   '<path d="M12 2.6 20 7v10l-8 4.4L4 17V7z"/><circle cx="12" cy="12" r="3"/>',
    ace:     '<path d="M12 3.2 13.9 9l5.8 1.9-5.8 1.9L12 18.6 10.1 12.8 4.3 10.9 10.1 9z"/><path d="M18.5 3.5v3M20 5h-3"/>',
  };

  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[name] + '</svg>';
  }

  var PAGES = [
    { id: 'home',    label: 'Өнөөдөр', file: 'home'    },
    { id: 'hsk',     label: 'Хятад',   file: 'hsk'     },
    { id: 'life',    label: 'Амьдрал', file: 'life'    },
    { id: 'finance', label: 'Мөнгө',   file: 'finance' },
    { id: 'profile', label: 'Би',      file: 'profile' },
  ];

  function href(name) {
    return window.jarvisHref ? window.jarvisHref(name) : (name + '.html');
  }

  function build(current) {
    if (document.querySelector('.jv-nav')) return;

    var nav = document.createElement('nav');
    nav.className = 'jv-nav';
    nav.setAttribute('aria-label', 'Үндсэн цэс');

    var brand = document.createElement('a');
    brand.className = 'jv-brand';
    brand.href = href('home');
    brand.innerHTML = svg('brand') + '<span>Jarvis</span>';
    nav.appendChild(brand);

    PAGES.forEach(function (p) {
      var a = document.createElement('a');
      a.href = href(p.file);
      a.innerHTML = svg(p.id) + '<span>' + p.label + '</span>';
      if (p.id === current) {
        a.classList.add('on');
        a.setAttribute('aria-current', 'page');
      }
      nav.appendChild(a);
    });

    // Утсан дээр цэс доод талд хөвдөг тул агуулгын доор зай үлдээнэ
    var spacer = document.createElement('div');
    spacer.className = 'jv-nav-space';

    document.body.insertBefore(nav, document.body.firstChild);
    document.body.appendChild(spacer);

    // Jarvis товч — аль ч хуудаснаас нэг дарахад чат нээгдэнэ
    if (current !== 'chat') {
      var ace = document.createElement('a');
      ace.className = 'jv-ace';
      ace.href = href('chat');
      ace.innerHTML = svg('ace') + '<span>Jarvis</span>';
      ace.setAttribute('aria-label', 'Jarvis-тай ярих');
      document.body.appendChild(ace);
    }
  }

  window.jarvisShell = { build: build, icon: svg, pages: PAGES, href: href };

  // <script ... data-page="home"> байвал өөрөө зурна
  var me = document.currentScript;
  var page = me && me.getAttribute('data-page');
  if (page) {
    if (document.body) build(page);
    else document.addEventListener('DOMContentLoaded', function () { build(page); });
  }
})();
