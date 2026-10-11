/* A-101 홈 평면도 동작
   - 그려지는 효과: <head>의 한 줄 스크립트가 재생 여부를 정해 <html class="plan-play">를 붙이고,
     애니메이션은 plan.css가 한다. 여기서는 끝내기(시간 경과·클릭)와 방문 기록만 맡는다.
   - 방 ↔ 도면 목록 연동 강조, 이름표·미리보기, 욕실 말풍선, 표제란 날짜.
   - rooms-data.js(ROOMS), site.js(Site)를 먼저 불러와야 한다. */
(function () {
  var root = document.documentElement;
  var plan = document.getElementById('plan');
  var wrap = plan && plan.parentNode;
  if (!plan) return;

  var PLAY_KEY = 'plan-drawn';
  var PLAY_MS = 2100;

  /* ---------- 그려지는 효과 끝내기 ---------- */

  function finish() {
    root.classList.remove('plan-play');
    document.removeEventListener('pointerdown', finish, true);
    document.removeEventListener('keydown', finish, true);
  }

  if (root.classList.contains('plan-play')) {
    try { sessionStorage.setItem(PLAY_KEY, '1'); } catch (e) { /* 저장 못 해도 재생은 한다 */ }
    setTimeout(finish, PLAY_MS);
    // 화면 아무 곳이나 누르면 즉시 완성. 방을 누른 경우 링크 이동은 그대로 진행된다.
    document.addEventListener('pointerdown', finish, true);
    document.addEventListener('keydown', finish, true);
  }

  /* ---------- 표제란 일자: 방문일 ---------- */

  var dateEl = document.getElementById('tb-date');
  if (dateEl && window.Site) dateEl.textContent = Site.formatDate(new Date());

  /* ---------- 이름표·미리보기 카드, 욕실 말풍선 (HTML) ---------- */

  var tip = document.createElement('div');
  tip.className = 'plan-tip';
  tip.setAttribute('aria-hidden', 'true');
  tip.hidden = true;
  var tipName = document.createElement('strong');
  var tipText = document.createElement('span');
  tip.appendChild(tipName);
  tip.appendChild(tipText);
  wrap.appendChild(tip);

  var bubble = document.createElement('div');
  bubble.className = 'plan-bubble';
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-live', 'polite');
  wrap.appendChild(bubble);

  /* 방 이름표(라벨) 위치를 .plan-wrap 기준 좌표로 */
  function anchorOf(roomId) {
    var label = plan.querySelector('.label[data-room="' + roomId + '"]');
    var target = label || document.getElementById(roomId);
    var r = target.getBoundingClientRect();
    var w = wrap.getBoundingClientRect();
    return { x: r.left + r.width / 2 - w.left, top: r.top - w.top, bottom: r.bottom - w.top, width: w.width };
  }

  /* 라벨 위에 띄우되, 위로 넘치면 아래, 좌우는 화면 안으로 */
  function place(el, a) {
    var gap = 10;
    var y = a.top - el.offsetHeight - gap;
    if (y < 4) y = a.bottom + gap;
    var x = a.x - el.offsetWidth / 2;
    x = Math.max(4, Math.min(x, a.width - el.offsetWidth - 4));
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  function showTip(room) {
    tipName.textContent = room.label;
    tipText.textContent = room.preview;
    tip.hidden = false;
    place(tip, anchorOf(room.id));
  }

  function hideTip() {
    tip.hidden = true;
  }

  var bubbleTimer = null;
  function showBubble(room) {
    clearTimeout(bubbleTimer);
    bubble.textContent = room.message || '사용 중입니다';
    bubble.classList.add('is-on');
    place(bubble, anchorOf(room.id));
    bubbleTimer = setTimeout(function () {
      bubble.classList.remove('is-on');
      bubble.textContent = '';
    }, 1500);
  }

  /* ---------- 방 ↔ 도면 목록 연동 강조 ---------- */

  var byHref = {};
  ROOMS.forEach(function (room) {
    if (room.type !== 'active') return;
    var g = document.getElementById(room.id);
    if (!g) return;
    byHref[room.href] = {
      room: room,
      g: g,
      link: g.querySelector('.room-link'),
      row: plan.querySelector('.dl-link[href="' + room.href + '"]')
    };
  });

  var hot = null;
  function setHot(entry) {
    if (hot === entry) return;
    if (hot) {
      hot.g.classList.remove('is-hot');
      if (hot.row) hot.row.classList.remove('is-hot');
    }
    hot = entry;
    if (!entry) {
      hideTip();
      return;
    }
    entry.g.classList.add('is-hot');
    if (entry.row) entry.row.classList.add('is-hot');
    showTip(entry.room);
  }

  Object.keys(byHref).forEach(function (href) {
    var entry = byHref[href];
    [entry.link, entry.row].forEach(function (el) {
      if (!el) return;
      el.addEventListener('mouseenter', function () { setHot(entry); });
      el.addEventListener('mouseleave', function () { if (hot === entry) setHot(null); });
      el.addEventListener('focus', function () { setHot(entry); });
      el.addEventListener('blur', function () { if (hot === entry) setHot(null); });
    });
  });

  /* ---------- 욕실: 누르면 말풍선 1.5초 ---------- */

  ROOMS.forEach(function (room) {
    if (room.type !== 'bath') return;
    var g = document.getElementById(room.id);
    if (!g) return;
    g.addEventListener('click', function () { showBubble(room); });
    g.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showBubble(room);
      }
    });
  });

  window.addEventListener('resize', function () {
    if (hot) showTip(hot.room);
  });
})();
