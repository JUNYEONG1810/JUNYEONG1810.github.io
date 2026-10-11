/* 이력 공정표 데이터 — 원고.md A-205 표
   날짜: 'YYYY.MM'(막대 시작은 그 달 1일, 끝은 그 달 말일) 또는 'YYYY.MM.DD'. 'today' = 방문일.
   status: done(실적) / progress(진행 중: 오늘 이후 옅게) / open(계획: 점선, 끝으로 갈수록 흐려지고 ▶)
   label: inside(막대 안) / left / right / above (막대 기준)
   마일스톤 label: above / below, anchor: start(◆ 오른쪽으로) / end(◆ 왼쪽으로) */
var TIMELINE = {
  axis: { start: '2021.01', end: '2028.12' },
  works: { start: '2021.03.01', finish: '2027.08.31' },   // 착공(입학) ~ 준공 예정(졸업)

  pauses: [
    { label: '공사 일시중지 · 정비 기간', start: '2022.08.01', end: '2025.02.28', level: 1, labelAt: 'bottom' },
    { label: '공사 일시중지 · 국방 현장 투입', start: '2023.04.01', end: '2024.10.31', level: 2, labelAt: 'top' }
  ],

  rows: [
    { name: '학업', items: [
      // 공사 일시중지(휴학·군 복무) 동안 학업도 멈췄으므로 J.U.M.P와 같은 곳에서 끊는다
      { type: 'bar', label: '건축학부 (공학전공)', start: '2021.03', end: '2022.07', status: 'done', labelPos: 'inside' },
      { type: 'bar', label: '건축학부', start: '2025.03', end: '2027.08', status: 'progress', labelPos: 'inside' },
      { type: 'milestone', label: '준공 예정', date: '2027.08.31', labelPos: 'above', anchor: 'end' }
    ] },
    { name: '연구', items: [
      { type: 'bar', label: '캡스톤 디자인 1', start: '2026.03', end: '2026.06', status: 'done', labelPos: 'left' }
    ] },
    { name: '수상', lanes: 2, items: [
      { type: 'milestone', label: '도시건축재생 경진대회 우수상', date: '2021.05.12', labelPos: 'above', anchor: 'start' },
      { type: 'milestone', label: 'Job-Road Map 설계 프로그램 장려상', date: '2025.06.09', labelPos: 'below', anchor: 'end' },
      { type: 'milestone', label: '건축학부 졸업작품전 우수상', date: '2026.07.01', labelPos: 'above', anchor: 'end' },
      { type: 'milestone', label: '건축도시문화제 학생우수작품상', date: '2026.10.07', labelPos: 'below', anchor: 'start' }
    ] },
    { name: '활동', lanes: 2, items: [
      { type: 'bar', label: 'J.U.M.P (Habitat)', start: '2021.03', end: '2022.07', status: 'done', labelPos: 'inside', lane: 0 },
      { type: 'bar', label: 'J.U.M.P', start: '2025.03', end: 'today', status: 'progress', labelPos: 'inside', lane: 0 },
      { type: 'bar', label: '아동센터 레고 봉사', start: '2021.06', end: '2021.08', status: 'done', labelPos: 'right', lane: 1 }
    ] },
    { name: '현장', items: [
      { type: 'bar', label: '롯데건설 롯데캐슬 현장 실습', start: '2026.01', end: '2026.02', status: 'done', labelPos: 'left' }
    ] },
    { name: '진로', items: [
      { type: 'bar', label: '후속 공사: 공기업 (설계 변경 가능)', start: '2027.08.31', end: 'axis-end', status: 'open',
        labelPos: 'above', note: '착공일 미정 · 입찰 준비 중' }
    ] }
  ]
};
