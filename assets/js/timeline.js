/* A-205 이력 공정표 그리기 (SVG)
   - timeline-data.js(TIMELINE), site.js(Site)를 먼저 불러와야 한다.
   - 가로축 1px = 차트 폭 1000 기준 단위. viewBox로 컨테이너 폭에 맞춰 늘고 준다.
   - 오늘선 위치와 전체 공정률은 방문일 기준으로 계산한다. */
(function () {
  var host = document.getElementById('timeline');
  if (!host || !window.TIMELINE) return;
  var T = window.TIMELINE;

  var DAY = 86400000;
  var W = 1000;
  var LEFT = 84;            // 공종 이름 칸
  var RIGHT = 976;          // 진로 화살표 자리를 남긴다
  var TOP_STRIP = 30;       // 오늘선 라벨·위쪽 일시중지 라벨
  var AXIS_H = 28;          // 연도 라벨·학기 눈금
  var ROW_H = 52;
  var LANE_H = 37;
  var BAR_H = 14;
  var BOTTOM_STRIP = 40;    // 아래쪽 일시중지 라벨

  /* ---------- 날짜 ---------- */

  function utc(y, m, d) { return Date.UTC(y, m - 1, d); }

  var now = new Date();
  var TODAY = utc(now.getFullYear(), now.getMonth() + 1, now.getDate());

  /* 'YYYY.MM' | 'YYYY.MM.DD' | 'today' → UTC ms. edge='end'면 그 달(그 날)의 끝(다음 날 0시) */
  function parse(s, edge) {
    if (s === 'today') return TODAY;
    if (s === 'axis-end') return AXIS_END;
    var p = s.split('.').map(Number);
    if (p.length === 2) return edge === 'end' ? utc(p[0], p[1] + 1, 1) : utc(p[0], p[1], 1);
    return edge === 'end' ? utc(p[0], p[1], p[2]) + DAY : utc(p[0], p[1], p[2]);
  }

  var AXIS_START = parse(T.axis.start, 'start');
  var AXIS_END = parse(T.axis.end, 'end');

  function x(t) {
    return LEFT + (t - AXIS_START) / (AXIS_END - AXIS_START) * (RIGHT - LEFT);
  }

  function fmt(t) {
    var d = new Date(t);
    return Site.formatDate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  function fmtMonth(s) {
    return s.split('.').slice(0, 2).join('.');
  }

  /* ---------- 전체 공정률 (일시중지 제외) ---------- */

  function overlap(a0, a1, b0, b1) {
    return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  }

  var worksStart = parse(T.works.start);
  var worksEnd = parse(T.works.finish, 'end');          // 준공일 다음 날 0시
  var outer = T.pauses.filter(function (p) { return p.level === 1; });
  var pauseTotal = 0;
  var pauseElapsed = 0;
  var elapsedEnd = Math.min(Math.max(TODAY, worksStart), worksEnd);   // 오늘 0시까지 = 다 지난 날만
  outer.forEach(function (p) {
    var p0 = parse(p.start);
    var p1 = parse(p.end, 'end');
    pauseTotal += overlap(p0, p1, worksStart, worksEnd);
    pauseElapsed += overlap(p0, p1, worksStart, elapsedEnd);
  });
  var totalDays = Math.round((worksEnd - worksStart - pauseTotal) / DAY);
  var doneDays = Math.round((elapsedEnd - worksStart - pauseElapsed) / DAY);
  var rate = Math.max(0, Math.min(100, doneDays / totalDays * 100));

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  setText('tl-rate', rate.toFixed(1) + '%');
  setText('tl-rate-note', '실제 공정 ' + totalDays.toLocaleString('ko-KR') + '일 중 ' +
    doneDays.toLocaleString('ko-KR') + '일 경과 · 일시중지 ' +
    Math.round(pauseTotal / DAY).toLocaleString('ko-KR') + '일 제외');
  setText('tl-today', fmt(TODAY));
  var fill = document.getElementById('tl-rate-fill');
  if (fill) fill.style.width = rate.toFixed(1) + '%';
  var meter = document.getElementById('tl-rate-meter');
  if (meter) meter.setAttribute('aria-valuenow', rate.toFixed(1));

  /* ---------- 행 배치 ---------- */

  var y = TOP_STRIP + AXIS_H;
  var ROWS_TOP = y;
  var rows = T.rows.map(function (row) {
    var lanes = row.lanes || 1;
    var extra = row.items.some(function (it) { return it.note; }) ? 14 : 0;
    var h = Math.max(ROW_H, lanes * LANE_H) + extra;
    var r = { row: row, top: y, h: h, lanes: lanes };
    y += h;
    return r;
  });
  var ROWS_BOTTOM = y;
  var H = ROWS_BOTTOM + BOTTOM_STRIP;

  function laneY(r, lane) {
    var extra = r.row.items.some(function (it) { return it.note; }) ? 14 : 0;
    var usable = r.h - extra;
    return r.top + usable / r.lanes * ((lane || 0) + 0.5) + (extra ? 4 : 0);
  }

  /* ---------- SVG 만들기 ---------- */

  var out = [];
  var A = function (s) { out.push(s); };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function r1(v) { return Math.round(v * 10) / 10; }

  A('<svg class="tl-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="group" aria-labelledby="tl-title">');
  A('<title id="tl-title">이력 공정표 2021–2028</title>');
  A('<defs>' +
    '<pattern id="tl-hatch-1" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">' +
    '<line x1="0" y1="0" x2="0" y2="8" class="tl-hatch-1"/></pattern>' +
    '<pattern id="tl-hatch-2" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">' +
    '<line x1="0" y1="0" x2="0" y2="4" class="tl-hatch-2"/></pattern>' +
    '<linearGradient id="tl-fade" x1="0" x2="1" y1="0" y2="0">' +
    '<stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0.3"/></linearGradient>' +
    '<mask id="tl-fade-mask" maskContentUnits="objectBoundingBox"><rect x="0" y="0" width="1" height="1" fill="url(#tl-fade)"/></mask>' +
    '</defs>');

  /* 가로축: 연도 격자·라벨, 학기 눈금(3월·9월) */
  A('<g class="tl-axis" aria-hidden="true">');
  var y0 = parseInt(T.axis.start, 10);
  var y1 = parseInt(T.axis.end, 10);
  for (var yr = y0; yr <= y1 + 1; yr++) {
    var gx = r1(x(utc(yr, 1, 1)));
    A('<line class="tl-grid-year" x1="' + gx + '" y1="' + (ROWS_TOP - AXIS_H + 4) + '" x2="' + gx + '" y2="' + ROWS_BOTTOM + '"/>');
    if (yr <= y1) {
      A('<text class="tl-year" x="' + r1(gx + 5) + '" y="' + (ROWS_TOP - 10) + '">' + yr + '</text>');
      [3, 9].forEach(function (m) {
        var sx = r1(x(utc(yr, m, 1)));
        A('<line class="tl-grid-term" x1="' + sx + '" y1="' + ROWS_TOP + '" x2="' + sx + '" y2="' + ROWS_BOTTOM + '"/>');
        A('<line class="tl-tick" x1="' + sx + '" y1="' + (ROWS_TOP - 6) + '" x2="' + sx + '" y2="' + ROWS_TOP + '"/>');
      });
    }
  }
  A('<line class="tl-axis-line" x1="' + LEFT + '" y1="' + ROWS_TOP + '" x2="' + RIGHT + '" y2="' + ROWS_TOP + '"/>');
  A('</g>');

  /* 행 이름·구분선 */
  A('<g class="tl-rows" aria-hidden="true">');
  rows.forEach(function (r) {
    A('<line class="tl-row-line" x1="0" y1="' + (r.top + r.h) + '" x2="' + RIGHT + '" y2="' + (r.top + r.h) + '"/>');
    A('<text class="tl-row-name" x="8" y="' + r1(r.top + r.h / 2) + '">' + esc(r.row.name) + '</text>');
  });
  A('</g>');

  /* 막대 */
  var labels = [];   // 막대·마일스톤 라벨은 맨 위에 따로 그린다
  var marks = [];
  A('<g class="tl-bars">');
  rows.forEach(function (r) {
    r.row.items.forEach(function (it) {
      if (it.type !== 'bar') return;
      var t0 = parse(it.start);
      var t1 = parse(it.end, 'end');
      var bx0 = x(t0);
      var bx1 = x(t1);
      var cy = laneY(r, it.lane);
      var by = cy - BAR_H / 2;
      var period = fmtMonth(it.start) + ' ~ ' + (it.end === 'today' ? '현재' : it.end === 'axis-end' ? '미정' : fmtMonth(it.end));
      var state = { done: '실적', progress: '진행 중', open: '계획' }[it.status];
      var aria = it.label + ', ' + period + ', ' + state;
      A('<g class="tl-bar is-' + it.status + '" tabindex="0" aria-label="' + esc(aria) + '" data-tip="' +
        esc(it.label) + '" data-tip-sub="' + esc(period + ' · ' + state) + '">');
      if (it.status === 'open') {
        var ax = bx1 + 2;
        A('<g mask="url(#tl-fade-mask)">' +
          '<rect class="tl-open" x="' + r1(bx0) + '" y="' + r1(by) + '" width="' + r1(bx1 - bx0) + '" height="' + BAR_H + '"/>' +
          '<path class="tl-arrow" d="M' + r1(bx1 - 1) + ' ' + r1(cy - 7) + ' L' + r1(ax + 8) + ' ' + r1(cy) + ' L' + r1(bx1 - 1) + ' ' + r1(cy + 7) + 'Z"/>' +
          '</g>');
      } else {
        var split = it.status === 'progress' ? Math.min(Math.max(x(TODAY), bx0), bx1) : bx1;
        A('<rect class="tl-solid" x="' + r1(bx0) + '" y="' + r1(by) + '" width="' + r1(split - bx0) + '" height="' + BAR_H + '"/>');
        if (bx1 > split) {
          A('<rect class="tl-future" x="' + r1(split) + '" y="' + r1(by) + '" width="' + r1(bx1 - split) + '" height="' + BAR_H + '"/>');
        }
      }
      A('</g>');

      var lx, anchor, ly = cy, cls = 'tl-label';
      if (it.labelPos === 'inside') { lx = bx0 + 7; anchor = 'start'; cls += ' is-inside'; }
      else if (it.labelPos === 'left') { lx = bx0 - 7; anchor = 'end'; }
      else if (it.labelPos === 'right') { lx = bx1 + 7; anchor = 'start'; }
      else { lx = bx1; anchor = 'end'; ly = cy - BAR_H / 2 - 9; }
      labels.push({ x: lx, y: ly, anchor: anchor, text: it.label, cls: cls });
      if (it.note) {
        labels.push({ x: bx0, y: cy + BAR_H / 2 + 12, anchor: 'start', text: it.note, cls: 'tl-label tl-note' });
      }
    });
  });
  A('</g>');

  /* 공사 일시중지 띠: 차트 전체 높이 (막대 위에 빗금으로 겹친다) */
  A('<g class="tl-pauses">');
  T.pauses.forEach(function (p) {
    var p0 = x(parse(p.start));
    var p1 = x(parse(p.end, 'end'));
    var period = fmtMonth(p.start) + ' ~ ' + fmtMonth(p.end);
    A('<rect class="tl-pause is-l' + p.level + '" x="' + r1(p0) + '" y="' + ROWS_TOP + '" width="' + r1(p1 - p0) +
      '" height="' + (ROWS_BOTTOM - ROWS_TOP) + '" fill="url(#tl-hatch-' + p.level + ')" tabindex="0" aria-label="' +
      esc(p.label + ', ' + period) + '" data-tip="' + esc(p.label) + '" data-tip-sub="' + esc(period) + '"/>');
    // 괄호선 + 라벨 (위 또는 아래 띠)
    var top = p.labelAt === 'top';
    var by = top ? ROWS_TOP - AXIS_H - 6 : ROWS_BOTTOM + 8;
    var tick = top ? 5 : -5;
    A('<path class="tl-bracket" aria-hidden="true" d="M' + r1(p0) + ' ' + (by + tick) + ' V' + by + ' H' + r1(p1) + ' V' + (by + tick) + '"/>');
    labels.push({ x: (p0 + p1) / 2, y: top ? by - 9 : by + 15, anchor: 'middle', text: p.label, cls: 'tl-label tl-pause-label' });
  });
  A('</g>');

  /* 오늘선 */
  var tx = x(TODAY);
  if (tx >= LEFT && tx <= RIGHT) {
    A('<g class="tl-today" aria-hidden="true">');
    A('<line x1="' + r1(tx) + '" y1="' + (ROWS_TOP - 4) + '" x2="' + r1(tx) + '" y2="' + ROWS_BOTTOM + '"/>');
    labels.push({ x: Math.min(Math.max(tx, LEFT + 50), W - 50), y: 14, anchor: 'middle',
      text: '오늘 ' + fmt(TODAY), cls: 'tl-label tl-today-label' });
    A('</g>');
  }

  /* 마일스톤 ◆ (오늘선 위에 그린다) */
  var leaders = [];
  A('<g class="tl-milestones">');
  rows.forEach(function (r) {
    r.row.items.forEach(function (it) {
      if (it.type !== 'milestone') return;
      var t = parse(it.date);
      var mx = x(t);
      var my = it.lane != null ? laneY(r, it.lane) : r.top + r.h / 2;
      var date = fmt(t);
      A('<g class="tl-ms" tabindex="0" aria-label="' + esc(it.label + ', ' + date) + '" data-tip="' + esc(it.label) +
        '" data-tip-sub="' + date + '">' +
        '<circle class="tl-ms-hit" cx="' + r1(mx) + '" cy="' + r1(my) + '" r="11"/>' +
        '<path class="tl-diamond" d="M' + r1(mx) + ' ' + r1(my - 7) + ' L' + r1(mx + 7) + ' ' + r1(my) + ' L' + r1(mx) +
        ' ' + r1(my + 7) + ' L' + r1(mx - 7) + ' ' + r1(my) + 'Z"/></g>');
      // 라벨은 ◆ 위(아래)로 띄우고, ◆ 가장자리 → 라벨 높이까지 세로 → 라벨 끝까지 가로로 꺾은 지시선으로 잇는다
      var above = it.labelPos !== 'below';
      var toEnd = it.anchor === 'end';
      var ly = above ? my - 19 : my + 19;
      leaders.push('M' + r1(mx) + ' ' + r1(above ? my - 8 : my + 8) + ' V' + r1(ly) + ' H' + r1(toEnd ? mx - 6 : mx + 6));
      labels.push({ x: toEnd ? mx - 9 : mx + 9, y: ly, anchor: toEnd ? 'end' : 'start', text: it.label, cls: 'tl-label tl-ms-label' });
    });
  });
  A('</g>');

  /* 마일스톤 지시선 (얇은 회색) */
  A('<g class="tl-leaders" aria-hidden="true">');
  leaders.forEach(function (d) { A('<path class="tl-leader" d="' + d + '"/>'); });
  A('</g>');

  /* 라벨 (흰 테두리로 빗금·선 위에서도 읽히게) */
  A('<g class="tl-labels" aria-hidden="true">');
  labels.forEach(function (l) {
    A('<text class="' + l.cls + '" x="' + r1(l.x) + '" y="' + r1(l.y) + '" text-anchor="' + l.anchor + '">' + esc(l.text) + '</text>');
  });
  A('</g>');
  A('</svg>');

  host.innerHTML = out.join('');

  /* ---------- 마우스·초점 안내 (이름·날짜) ---------- */

  var tip = document.createElement('div');
  tip.className = 'tl-tip';
  tip.hidden = true;
  tip.setAttribute('aria-hidden', 'true');
  host.appendChild(tip);

  function show(el) {
    tip.innerHTML = '';
    var b = document.createElement('strong');
    b.textContent = el.getAttribute('data-tip');
    var s = document.createElement('span');
    s.textContent = el.getAttribute('data-tip-sub');
    tip.appendChild(b);
    tip.appendChild(s);
    tip.hidden = false;
    var r = el.getBoundingClientRect();
    var h = host.getBoundingClientRect();
    var left = r.left + r.width / 2 - h.left - tip.offsetWidth / 2;
    left = Math.max(0, Math.min(left, h.width - tip.offsetWidth));
    var top = r.top - h.top - tip.offsetHeight - 8;
    if (top < 0) top = r.bottom - h.top + 8;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  function hide() { tip.hidden = true; }

  var targets = host.querySelectorAll('[data-tip]');
  for (var i = 0; i < targets.length; i++) {
    targets[i].addEventListener('mouseenter', function () { show(this); });
    targets[i].addEventListener('mouseleave', hide);
    targets[i].addEventListener('focus', function () { show(this); });
    targets[i].addEventListener('blur', hide);
  }
})();
