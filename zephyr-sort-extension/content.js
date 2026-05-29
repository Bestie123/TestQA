(function () {
  'use strict';

  var currentSort = 'default';
  var sortInserted = false;

  function getTestName(li) {
    var el = li.querySelector('.ktm-test-result-name .ng-binding');
    if (el) return el.textContent.trim();
    var link = li.querySelector('a.ng-binding');
    if (link) return link.title || link.textContent.trim();
    return '';
  }

  function getTestId(li) {
    var link = li.querySelector('a.ng-binding');
    if (link) {
      var m = link.getAttribute('href').match(/\/testCase\/(\d+)/);
      if (m) return parseInt(m[1], 10);
      var txt = link.textContent.match(/T(\d+)/);
      if (txt) return parseInt(txt[1], 10);
    }
    return 0;
  }

  function sortList(ol) {
    var items = Array.from(ol.querySelectorAll(':scope > li'));
    if (items.length < 2) return;

    var sorted = items.slice().sort(function (a, b) {
      switch (currentSort) {
        case 'name-asc':
          return getTestName(a).localeCompare(getTestName(b), 'ru');
        case 'name-desc':
          return getTestName(b).localeCompare(getTestName(a), 'ru');
        case 'id-asc':
          return getTestId(a) - getTestId(b);
        case 'id-desc':
          return getTestId(b) - getTestId(a);
        default:
          return 0;
      }
    });

    var needsSort = false;
    for (var i = 0; i < items.length; i++) {
      if (items[i] !== sorted[i]) { needsSort = true; break; }
    }
    if (needsSort) {
      sorted.forEach(function (item) { ol.appendChild(item); });
    }
  }

  function sortAll() {
    document.querySelectorAll('ol.ktm-testplayer-testresults').forEach(sortList);
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent =
      '#ktm-sort-trigger { cursor: pointer; -webkit-user-select: none; user-select: none; }' +
      '#ktm-sort-control { display: inline-block; margin-left: 8px; vertical-align: middle; position: relative; }' +
      '#ktm-sort-dropdown { display: none; position: absolute; z-index: 5000; left: 0; min-width: 220px; background: #fff; border: 1px solid #ccc; border-radius: 3px; box-shadow: 0 4px 8px rgba(0,0,0,0.15); }' +
      '#ktm-sort-dropdown ul { list-style: none; margin: 0; padding: 0; }' +
      '#ktm-sort-dropdown a { display: block; padding: 6px 12px; color: #333; text-decoration: none; }' +
      '#ktm-sort-dropdown a:hover { background: #f0f0f0; }';
    document.head.appendChild(style);
  }

  function insertSortControls() {
    if (sortInserted) return;
    var header = document.querySelector('.ktm-search-and-group');
    if (!header) return;

    var container = document.createElement('div');
    container.id = 'ktm-sort-control';

    container.innerHTML =
      '<div class="ktm-simple-dropdown ktm-slim aui-dropdown2-trigger" id="ktm-sort-trigger" aria-haspopup="true">' +
        '<span id="ktm-sort-label">Сортировка: По умолчанию</span>' +
        '<span class="aui-icon aui-icon-small ktm-expanded-icon"></span>' +
      '</div>' +
      '<div id="ktm-sort-dropdown">' +
        '<ul class="aui-list-truncate">' +
          '<li><a href="#" data-sort="default">По умолчанию</a></li>' +
          '<li><a href="#" data-sort="name-asc">По названию (А-Я)</a></li>' +
          '<li><a href="#" data-sort="name-desc">По названию (Я-А)</a></li>' +
          '<li><a href="#" data-sort="id-asc">По дате создания (сначала новые)</a></li>' +
          '<li><a href="#" data-sort="id-desc">По дате создания (сначала старые)</a></li>' +
        '</ul>' +
      '</div>';

    header.appendChild(container);
    sortInserted = true;

    var trigger = container.querySelector('#ktm-sort-trigger');
    var dropdown = container.querySelector('#ktm-sort-dropdown');

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });

    dropdown.querySelectorAll('a[data-sort]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        currentSort = this.getAttribute('data-sort');
        document.getElementById('ktm-sort-label').textContent = 'Сортировка: ' + this.textContent;
        dropdown.style.display = 'none';
        sortAll();
      });
    });

    document.addEventListener('click', function () {
      dropdown.style.display = 'none';
    });
  }

  function init() {
    injectStyles();

    var target = document.querySelector('.ktm-groups-list') || document.querySelector('#ktm-test-player-scope');
    if (!target) {
      var fallbackObs = new MutationObserver(function () {
        if (!sortInserted) insertSortControls();
        if (currentSort !== 'default') sortAll();
      });
      fallbackObs.observe(document.body, { childList: true, subtree: true });
      insertSortControls();
      return;
    }

    insertSortControls();

    var listObserver = new MutationObserver(function () {
      if (currentSort !== 'default') sortAll();
    });
    listObserver.observe(target, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
