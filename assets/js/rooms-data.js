/* 방 목록 — CLAUDE.md 방 배정 표 + 원고.md A-101 한 줄 미리보기
   type: active(상세 페이지로 이동) / bath(클릭 시 말풍선) / inactive(흐리게, 클릭 없음) */
var ROOMS = [
  { id: 'room-living',   name: '거실',      label: '거실 · 소개',            title: '소개',      preview: '건축학부 공학전공 이준영',            href: 'about.html',     sheet: 'A-201', type: 'active' },
  { id: 'room-master',   name: '안방',      label: '안방 · 연구',            title: '연구',      preview: '고정밀 BLE PDR 융합 실내 내비게이션', href: 'research.html',  sheet: 'A-202', type: 'active' },
  { id: 'room-bed1',     name: '침실-1',    label: '침실-1 · 수상',          title: '수상',      preview: '수상 4건 · 2021–2026',               href: 'awards.html',    sheet: 'A-203', type: 'active' },
  { id: 'room-bed2',     name: '침실-2',    label: '침실-2 · 봉사',          title: '봉사',      preview: '벽화, 집짓기, 레고 봉사',             href: 'volunteer.html', sheet: 'A-204', type: 'active' },
  { id: 'room-kitchen',  name: '주방/식당', label: '주방 · 공정표',          title: '공정표',    preview: '2021 착공 · 2027 준공 예정',          href: 'timeline.html',  sheet: 'A-205', type: 'active' },
  { id: 'room-alpha',    name: '알파룸',    label: '알파룸 · 현장 실습',     title: '현장 실습', preview: '롯데캐슬 시공 현장 2개월',            href: 'field.html',     sheet: 'A-206', type: 'active' },
  { id: 'room-utility',  name: '다용도실',  label: '다용도실 · 취미',        title: '취미',      preview: '헬스, 구기 종목, 영화',               href: 'hobby.html',     sheet: 'A-207', type: 'active' },
  { id: 'room-dress',    name: '드레스룸',  label: '드레스룸 · 자격·어학',   title: '자격·어학', preview: '토익 800 외 2개',                     href: 'license.html',   sheet: 'A-208', type: 'active' },
  { id: 'room-entrance', name: '현관',      label: '현관 · 연락처',          title: '연락처',    preview: '이메일 복사하기',                     href: 'contact.html',   sheet: 'A-209', type: 'active' },

  { id: 'room-bath1',    name: '욕실1',     type: 'bath',     message: '사용 중입니다' },
  { id: 'room-bath2',    name: '욕실2',     type: 'bath',     message: '사용 중입니다' },

  { id: 'room-pantry',   name: '팬트리',    type: 'inactive' },
  { id: 'room-wic',      name: 'WIC',       type: 'inactive' },
  { id: 'room-powder',   name: '파우더룸',  type: 'inactive' }
];
