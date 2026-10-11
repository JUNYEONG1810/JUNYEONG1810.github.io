/* 공통 머리말·메뉴·꼬리말 주입
   - 각 페이지 <body data-sheet="A-20x">로 현재 도면번호를 알려 준다 (홈은 A-101).
   - <header id="site-header">, <footer id="site-footer"> 자리에 내용을 채운다.
   - rooms-data.js(ROOMS)를 먼저 불러와야 한다. */
(function () {
  var SITE_NAME = 'LEE JUNYOUNG · 84A';
  var HOME_SHEET = 'A-101';

  var sheet = document.body.getAttribute('data-sheet') || '';
  var isHome = sheet === HOME_SHEET;

  var menuRooms = ROOMS.filter(function (r) { return r.type === 'active'; });
  var isDetail = menuRooms.some(function (r) { return r.sheet === sheet; });

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, attrs[k]);
    }
    if (text != null) node.textContent = text;
    return node;
  }

  /* 머리말: 사이트 이름(홈 링크) + 메뉴 9개, 상세 페이지는 그 아래 "평면도로 돌아가기" */
  function buildHeader(target) {
    var bar = el('div', { 'class': 'site-bar' });

    var brand = el('a', { 'class': 'site-name', href: 'index.html' }, SITE_NAME);
    if (isHome) brand.setAttribute('aria-current', 'page');
    bar.appendChild(brand);

    var nav = el('nav', { 'class': 'site-nav', 'aria-label': '페이지 메뉴' });
    var list = el('ul');
    menuRooms.forEach(function (r) {
      var li = el('li');
      var a = el('a', { href: r.href, title: r.sheet + ' ' + r.label }, r.title);
      if (r.sheet === sheet) a.setAttribute('aria-current', 'page');
      li.appendChild(a);
      list.appendChild(li);
    });
    nav.appendChild(list);
    bar.appendChild(nav);

    target.appendChild(bar);

    if (isDetail) {
      var back = el('div', { 'class': 'back-row' });
      back.appendChild(el('a', { 'class': 'back-link', href: 'index.html' }, '← 평면도로 돌아가기'));
      target.appendChild(back);
    }
  }

  /* 꼬리말: 작은 표제란 — LEE JUNYOUNG · 84A | A-20x | 이준영 | © 2026 */
  function buildFooter(target) {
    var cells = [
      ['PROJECT', SITE_NAME],
      ['SHEET', sheet || '—'],
      ['DRAWN', '이준영'],
      ['', '© 2026']
    ];
    var block = el('div', { 'class': 'titleblock-mini' });
    cells.forEach(function (c) {
      var cell = el('div', { 'class': 'tb-cell' });
      if (c[0]) cell.appendChild(el('span', { 'class': 'tb-key' }, c[0]));
      cell.appendChild(el('span', { 'class': 'tb-val' }, c[1]));
      block.appendChild(cell);
    });
    target.appendChild(block);
  }

  var header = document.getElementById('site-header');
  if (header) buildHeader(header);

  var footer = document.getElementById('site-footer');
  if (footer) buildFooter(footer);
})();
