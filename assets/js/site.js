/* 공통 머리말·메뉴·꼬리말 주입 + 날짜 계산 + 이메일 복사
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

  /* ---------- 날짜 계산 ---------- */

  /* 'YYYY.MM'부터 오늘까지 지난 개월 수 (시작 달은 0개월) */
  function monthsSince(ym, today) {
    var p = ym.split('.');
    var d = today || new Date();
    return (d.getFullYear() - Number(p[0])) * 12 + (d.getMonth() + 1 - Number(p[1]));
  }

  /* 개월 수 → 'n년 n개월' / 'n년' / 'n개월' */
  function formatDuration(months) {
    var y = Math.floor(months / 12);
    var m = months % 12;
    if (y && m) return y + '년 ' + m + '개월';
    if (y) return y + '년';
    return m + '개월';
  }

  /* <span data-since="2023.04"> → '3년 6개월' 처럼 채운다 */
  function fillDurations() {
    var nodes = document.querySelectorAll('[data-since]');
    for (var i = 0; i < nodes.length; i++) {
      var months = monthsSince(nodes[i].getAttribute('data-since'));
      if (months >= 0) nodes[i].textContent = formatDuration(months);
    }
  }

  /* ---------- 이메일 복사 ----------
     주소를 소스에 통째로 두지 않는다. 버튼을 누를 때만 합쳐 클립보드에 복사하고 화면에는 표시하지 않는다. */
  var MAIL_ID = ['pear', '1810'];
  var MAIL_DOMAIN = ['naver', 'com'];

  function mailAddress() {
    return MAIL_ID.join('') + String.fromCharCode(64) + MAIL_DOMAIN.join('.');
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) resolve(); else reject();
    });
  }

  function bindEmailCopy() {
    var buttons = document.querySelectorAll('[data-copy-email]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () {
        var status = document.getElementById(this.getAttribute('aria-describedby'));
        copyText(mailAddress()).then(function () {
          if (status) status.textContent = '복사되었습니다';
        }, function () {
          if (status) status.textContent = '복사하지 못했습니다. 다시 눌러 주세요.';
        });
        if (status) {
          clearTimeout(status._t);
          status._t = setTimeout(function () { status.textContent = ''; }, 2500);
        }
      });
    }
  }

  /* Date → 'YYYY.MM.DD' */
  function formatDate(d) {
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '.' + (m < 10 ? '0' : '') + m + '.' + (day < 10 ? '0' : '') + day;
  }

  window.Site = { monthsSince: monthsSince, formatDuration: formatDuration, formatDate: formatDate };

  var header = document.getElementById('site-header');
  if (header) buildHeader(header);

  var footer = document.getElementById('site-footer');
  if (footer) buildFooter(footer);

  fillDurations();
  bindEmailCopy();
})();
