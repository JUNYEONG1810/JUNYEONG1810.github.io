"""84A 단위세대 DXF → 단순화한 평면도 SVG → index.html 인라인 삽입.

사용:
    python -X utf8 scripts/dxf_to_svg.py                  # index.html의 PLAN 표시 사이를 갱신
    python -X utf8 scripts/dxf_to_svg.py --debug out.svg   # 면 분할 확인용 그림만 만든다

원본 `_자료/84 A.dxf`(mm)는 커밋하지 않는다. 이 스크립트는 사이트에서 쓰지 않는 보조 도구다.
필요: ezdxf, shapely

방법
  벽   : 같은 방향으로 50~320mm(기둥은 480mm) 떨어진 평행선 쌍의 겹치는 구간 = 벽 직사각형.
         바깥 모서리 칸은 L자 모서리 짝으로 채운다.
  방   : 벽·창으로 닫힌 세대 안쪽 공간을 문 닫힘선과 SPLITS로 나누고, 실 이름 글자가 든 조각을 그 방으로 본다.
  라벨 : 이름표 문구는 assets/js/rooms-data.js에서 읽는다.
"""
import argparse
import math
import re
from pathlib import Path

import ezdxf
from ezdxf import path as ezpath
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
DXF = ROOT / '_자료' / '84 A.dxf'
INDEX = ROOT / 'index.html'
ROOMS_JS = ROOT / 'assets' / 'js' / 'rooms-data.js'

P = 'XR_전체평면도$0$'

# ---------------------------------------------------------------- 설정
WALL_LAYERS = {
    P + 'CON': 'con',                    # 구조벽(콘크리트)
    P + 'XR_전체평면도$0$CON': 'con',
    P + 'COL': 'con',                    # 코어 구조벽·기둥
    P + 'WAL': 'mas',                    # 조적벽
    P + 'A-WALL3(DRY 미설치)': 'dry',     # 건식벽
    P + 'SIT': 'dry',                    # 실내 칸막이 (창대 선은 걸러 냄)
    P + 'IOD': 'ins',                    # 바깥벽 단열층 안쪽 면
}
CORE_LAYERS = {P + 'PD', P + '7', P + 'ELEV', P + 'A-ELEV', P + 'A-FLOR-EVTR'}
WINDOW_PREFIX = '*U'                     # 창호 동적 블록 (호가 있으면 문)
WINDOW_BLOCKS = {'A$C50A60525'}
DOOR_BLOCKS = {'A$C6138291A', 'A$C00BE0DCA', 'FSD-9X22', 'door1100', 'A$C740D0A3A'}
MSP_WINDOWS = [(51899, 30988, 53069, 31088)]   # 모델 공간에 선으로 직접 그린 창 (알파룸 위)

# 벽 없이 트인 경계를 나누는 선 (DXF 좌표, mm). 벽 끝·벽 면 좌표에 맞춰 정했다.
SPLITS = [
    ((56250, 25438), (60150, 25438)),                  # 거실 | 주방·식당 (욕실2 옆 벽 끝 ~ 팬트리 아래 벽)
    ((60159, 24100), (60159, 25380)),                  # 거실 | 복도 (침실-2 서쪽 벽 위)
    ((62420, 25398), (63760, 25398)),                  # 현관 | 복도 (WIC 모서리 ~ 욕실1 옆 벽 토막)
    ((56250, 27968), (56709, 27968), (56709, 29850)),  # 알파룸 | 주방 (남쪽 벽 끝 ~ 바깥벽 꺾인 곳)
    ((52240, 26578), (53100, 26578)),                  # 드레스룸 | 파우더룸 (건식벽 토막 사이)
    ((52200, 25378), (53600, 25378)),                  # 파우더룸 | 안방 (건식벽 토막 ~ 욕실2 아래 벽)
]
# 호(ARC)로 닫힘 위치를 정할 수 없는 문의 닫힘선
EXTRA_CLOSURES = [
    ((52200, 29470), (53150, 29470)),   # 드레스룸 위 양개문 (*U39, 폴리라인 곡선으로 그림)
    ((60089, 25750), (60089, 26850)),   # 팬트리 접이문
    ((62479, 25750), (62479, 26850)),   # WIC 접이문
]
FOLDING_R = 400    # 이보다 작은 호는 접이문 날개
GAP_CLOSE = 260    # 세대 외곽의 작은 틈을 메우는 반경 (실내 공간 찾기에만 씀)
MITRE = dict(join_style='mitre', mitre_limit=10)

# ---------------------------------------------------------------- 도면 배치 (SVG 단위 = mm)
X0, Y0 = 49500, 34150           # x' = x − X0, y' = Y0 − y
SHEET_W, SHEET_H = 24000, 14600
FRAME_OUT, FRAME_IN = 250, 450  # 도면 테두리 바깥선·안쪽선 여백
COL_X = 18100                   # 오른쪽 칸 (방위표·축척·표제란) 시작

# ---------------------------------------------------------------- DXF 읽기


def tf(x, y):
    return round(x - X0), round(Y0 - y)


def segs_of(e):
    """선분 목록 (WCS). 뒤집힌 블록 안의 폴리라인은 OCS라서 WCS로 바꾼다."""
    t = e.dxftype()
    if t == 'LINE':
        a, b = e.dxf.start, e.dxf.end
        return [((a.x, a.y), (b.x, b.y))]
    if t == 'LWPOLYLINE':
        pts = [(v.x, v.y) for v in e.vertices_in_wcs()]
        if e.closed and pts:
            pts.append(pts[0])
        return list(zip(pts, pts[1:]))
    return []


def block_name(ins):
    return ins.dxf.name.split('$0$')[-1]


def explode(ins):
    out = []
    for v in ins.virtual_entities():
        out.extend(explode(v) if v.dxftype() == 'INSERT' else [v])
    return out


def arc_info(e):
    """호의 중심·양 끝·가운데 점 (WCS)."""
    ocs = e.ocs()
    c = ocs.to_wcs(e.dxf.center)
    cx, cy, cz, r = e.dxf.center.x, e.dxf.center.y, e.dxf.center.z, e.dxf.radius
    a0, a1 = e.dxf.start_angle, e.dxf.end_angle
    if a1 < a0:
        a1 += 360

    def at(ang):
        q = ocs.to_wcs((cx + r * math.cos(math.radians(ang)), cy + r * math.sin(math.radians(ang)), cz))
        return (q.x, q.y)

    return {'c': (c.x, c.y), 'r': r, 'p0': at(a0), 'p1': at(a1), 'pm': at((a0 + a1) / 2)}


def bounds(ents):
    """블록 범위 (기준점 Defpoints 레이어는 뺀다)."""
    xs, ys = [], []
    for e in ents:
        if e.dxf.layer == 'Defpoints':
            continue
        for a, b in segs_of(e):
            xs += [a[0], b[0]]
            ys += [a[1], b[1]]
    return min(xs), min(ys), max(xs), max(ys)


def flat_paths(ents, step=20):
    """폴리라인 곡선(bulge)까지 펴서 점 목록으로 (드레스룸 위 양개문용)."""
    out = []
    for e in ents:
        if e.dxf.layer == 'Defpoints' or e.dxftype() not in ('LINE', 'LWPOLYLINE', 'ARC'):
            continue
        pts = [(v.x, v.y) for v in ezpath.make_path(e).flattening(step)]
        if len(pts) > 1 and max(math.dist(pts[0], q) for q in pts) > 30:
            out.append(pts)
    return out


def load():
    doc = ezdxf.readfile(str(DXF))
    msp = doc.modelspace()
    data = {'walls': {k: [] for k in ('con', 'mas', 'dry', 'ins')}, 'core': [], 'core_fill': [],
            'windows': list(MSP_WINDOWS), 'arcs': [], 'door_paths': [], 'texts': []}

    for e in msp:
        lay, t = e.dxf.layer, e.dxftype()
        if t == 'INSERT':
            name = block_name(e)
            parts = explode(e)
            arcs = [arc_info(v) for v in parts if v.dxftype() == 'ARC' and v.dxf.radius >= 250]
            bulged = any(v.dxftype() == 'LWPOLYLINE' and v.has_arc for v in parts)
            is_window_block = name.startswith(WINDOW_PREFIX) or name in WINDOW_BLOCKS
            if is_window_block and not arcs and not bulged:
                data['windows'].append(bounds(parts))
            elif name in DOOR_BLOCKS:
                data['arcs'].extend(arcs)
            elif is_window_block and bulged:
                data['door_paths'].extend(flat_paths(parts))
            elif lay in CORE_LAYERS:
                for v in parts:
                    data['core'].extend(segs_of(v))
            continue
        if t == 'TEXT':
            a = e.dxf.align_point
            data['texts'].append((e.dxf.text.replace(' ', ''), a.x, a.y))
        elif lay in WALL_LAYERS:
            data['walls'][WALL_LAYERS[lay]].extend(segs_of(e))
        elif lay in CORE_LAYERS:
            if t == 'LWPOLYLINE' and e.closed:
                data['core_fill'].append([(v.x, v.y) for v in e.vertices_in_wcs()])
            data['core'].extend(segs_of(e))
        elif lay == P + 'WID' and t == 'ARC' and e.dxf.radius >= 250:
            data['arcs'].append(arc_info(e))

    # SIT 중 창대 선(창 범위 안쪽)은 벽이 아니다
    wins = [box(*w).buffer(80) for w in data['windows']]
    data['walls']['dry'] = [s for s in data['walls']['dry']
                            if not any(w.contains(LineString(s)) for w in wins)]
    return data

# ---------------------------------------------------------------- 벽


WALL_RANK = {'con': 0, 'mas': 1, 'dry': 2, 'ins': 3}


def axis_segments(segs, cls):
    """수평·수직 선분만 (방향, 위치, 시작, 끝, 분류)로. 대각선은 버린다."""
    out = []
    for (x1, y1), (x2, y2) in segs:
        if abs(y1 - y2) < 1 and abs(x1 - x2) > 1:
            out.append(('h', (y1 + y2) / 2, min(x1, x2), max(x1, x2), cls))
        elif abs(x1 - x2) < 1 and abs(y1 - y2) > 1:
            out.append(('v', (x1 + x2) / 2, min(y1, y2), max(y1, y2), cls))
    return out


def pair_class(a, b):
    if 'ins' in (a, b):
        return 'ins'
    return a if WALL_RANK[a] >= WALL_RANK[b] else b


def between(segs, o, c1, c2, lo, hi, skip):
    for k, (ok, ck, k1, k2, _) in enumerate(segs):
        if k not in skip and ok == o and c1 + 1 < ck < c2 - 1 and min(hi, k2) - max(lo, k1) > 20:
            return True
    return False


def corner_squares(segs, dmin=50, dmax=320):
    """바깥 L자 모서리와 같은 방향으로 꺾인 안쪽 L자 모서리 사이의 정사각형 (모서리 칸 채우기)."""
    ends = {}
    for o, c, a1, a2, _ in segs:
        for t, sgn in ((a1, 1), (a2, -1)):
            pt = (round(t), round(c)) if o == 'h' else (round(c), round(t))
            ends.setdefault(pt, []).append((o, sgn))
    corners = []
    for pt, lst in ends.items():
        for sh in {sg for o, sg in lst if o == 'h'}:
            for sv in {sg for o, sg in lst if o == 'v'}:
                corners.append((pt, sh, sv))
    out = []
    for p, sh, sv in corners:
        for q, th, tv in corners:
            if (th, tv) == (sh, sv) and p != q:
                dx, dy = (q[0] - p[0]) * sh, (q[1] - p[1]) * sv
                if dmin <= dx <= dmax and dmin <= dy <= dmax:
                    out.append(box(min(p[0], q[0]), min(p[1], q[1]), max(p[0], q[0]), max(p[1], q[1])))
    return out


def wall_rects(data, dmin=50, dmax=480, dthin=320, min_overlap=40):
    segs = []
    for cls, ss in data['walls'].items():
        segs += axis_segments(ss, cls)
    rects = {k: [] for k in WALL_RANK}
    for i, (oi, ci, a1, a2, ki) in enumerate(segs):
        for j in range(i + 1, len(segs)):
            oj, cj, b1, b2, kj = segs[j]
            if oi != oj or not dmin <= abs(ci - cj) <= dmax:
                continue
            lo, hi = max(a1, b1), min(a2, b2)
            if hi - lo < min_overlap:
                continue
            c1, c2 = min(ci, cj), max(ci, cj)
            if c2 - c1 > dthin and between(segs, oi, c1, c2, lo, hi, (i, j)):
                continue
            rects[pair_class(ki, kj)].append(box(lo, c1, hi, c2) if oi == 'h' else box(c1, lo, c2, hi))
    rects['con'] += corner_squares(segs)
    return rects

# ---------------------------------------------------------------- 문


def doors_from_arcs(arcs, walls):
    """호마다 경첩(중심)·닫힌 끝·열린 끝을 정한다.

    닫힌 끝: 경첩에서 그 방향 뒤쪽으로 벽이 이어지고, 끝 너머에 맞은편 문틀 벽이 있는 쪽.
    접이문 날개(작은 호)는 축과 나란한 끝이 닫힌 끝이다."""
    near = walls.buffer(40)
    doors = []
    for a in arcs:
        c = a['c']
        cand = []
        for tip, other in ((a['p0'], a['p1']), (a['p1'], a['p0'])):
            ux, uy = (tip[0] - c[0]) / a['r'], (tip[1] - c[1]) / a['r']
            if a['r'] < FOLDING_R:
                score = 1 if min(abs(ux), abs(uy)) < 0.05 else 0
            else:
                back = sum(near.contains(Point(c[0] - ux * k, c[1] - uy * k)) for k in (150, 300, 450, 600))
                front = sum(near.contains(Point(tip[0] + ux * k, tip[1] + uy * k)) for k in (100, 200, 300))
                score = back * 2 + front
            cand.append((score, tip, other, ux, uy))
        cand.sort(key=lambda t: -t[0])
        score, closed, opened, ux, uy = cand[0]
        if score == 0 or score == cand[1][0]:
            print('  ! 문 닫힘 위치를 정하지 못함: 중심', [round(v) for v in c])
            continue
        line = LineString([(c[0] - ux * 150, c[1] - uy * 150), (closed[0] + ux * 150, closed[1] + uy * 150)])
        doors.append({'c': c, 'r': a['r'], 'closed': closed, 'open': opened, 'pm': a['pm'],
                      'closure': line if a['r'] >= FOLDING_R else None})
    return doors

# ---------------------------------------------------------------- 형상 만들기


def parts_of(g):
    return [x for x in getattr(g, 'geoms', [g]) if x.geom_type == 'Polygon' and not x.is_empty]


def build(data):
    rects = wall_rects(data)
    con = unary_union(rects['con'])
    mas = unary_union(rects['mas']).difference(con)
    dry = unary_union(rects['dry']).difference(con).difference(mas)
    ins = unary_union(rects['ins']).difference(con).difference(mas).difference(dry)
    walls = unary_union([con, mas, dry, ins]).buffer(4, **MITRE).buffer(-4, **MITRE)
    win_polys = [box(*w) for w in data['windows']]

    doors = doors_from_arcs(data['arcs'], walls)
    closures = [d['closure'] for d in doors if d['closure']] + [LineString(c) for c in EXTRA_CLOSURES]
    splits = [LineString(sp) for sp in SPLITS]

    # 문 구멍을 막아 세대를 닫힌 도형으로 만든 뒤, 그 안쪽 구멍이 실내 공간이다
    solid = unary_union([walls] + win_polys + [c.buffer(20, cap_style='flat') for c in closures])
    closed = solid.buffer(GAP_CLOSE, **MITRE).buffer(-GAP_CLOSE, **MITRE)
    spaces = []
    for g in parts_of(closed):
        for ring in g.interiors:
            spaces += [s for s in parts_of(Polygon(ring).difference(solid)) if s.area > 3e5]
    gaps = closed.difference(solid)
    for s in spaces:
        gaps = gaps.difference(s)

    cut = unary_union([c.buffer(10, cap_style='flat') for c in closures + splits])
    pieces = []
    for sp in spaces:
        for g in parts_of(sp.difference(cut)):
            if g.area > 2e5:
                pieces.append(g.buffer(10, **MITRE).intersection(sp))   # 자른 폭만큼 되돌림
    # 바깥 모서리를 메운 칸 중 벽에 붙은 작은 것만 구조벽으로 (바깥 오목한 곳까지 채우지 않게)
    corner_fill = [g for g in parts_of(gaps) if g.area < 2.5e5]
    con = unary_union([con] + corner_fill)
    walls = unary_union([walls] + corner_fill)
    return {'con': con, 'mas': mas, 'dry': dry, 'ins': ins, 'walls': walls, 'win': win_polys,
            'doors': doors, 'closures': closures, 'spaces': spaces, 'pieces': pieces}

# ---------------------------------------------------------------- rooms-data.js 읽기


def read_rooms():
    """rooms-data.js의 객체들을 {키: 값} 목록으로 (홑따옴표 문자열 값만)."""
    src = ROOMS_JS.read_text(encoding='utf-8')
    rooms = []
    for body in re.findall(r'\{([^{}]*)\}', src):
        obj = dict(re.findall(r"(\w+)\s*:\s*'([^']*)'", body))
        if 'id' in obj:
            rooms.append(obj)
    return rooms

# ---------------------------------------------------------------- SVG 출력


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def path_d(geom, simplify=0):
    out = []
    for g in parts_of(geom):
        if simplify:
            g = g.simplify(simplify, preserve_topology=True)
        for ring in [g.exterior] + list(g.interiors):
            pts = [tf(x, y) for x, y in ring.coords][:-1]
            # 같은 점·한 직선 위 점 제거
            clean = []
            for p in pts:
                if clean and p == clean[-1]:
                    continue
                clean.append(p)
            out.append('M' + ' '.join('%d %d' % p for p in clean) + 'Z')
    return ''.join(out)


def ring_paths(geom):
    """벽 외곽선: 고리(ring)마다 따로 path (그려지는 효과용 pathLength=1)."""
    out = []
    for g in parts_of(geom):
        g = g.simplify(3, preserve_topology=True)
        for ring in [g.exterior] + list(g.interiors):
            pts = [tf(x, y) for x, y in ring.coords]
            out.append('<path pathLength="1" d="M%sZ"/>' % ' '.join('%d %d' % p for p in pts[:-1]))
    return out


def arc_path(p0, pm, p1, r):
    """세 점을 지나는 호. 화면 좌표(y 아래)에서 시계 방향이면 sweep=1."""
    a, m, b = tf(*p0), tf(*pm), tf(*p1)
    cross = (m[0] - a[0]) * (b[1] - m[1]) - (m[1] - a[1]) * (b[0] - m[0])
    sw = 1 if cross > 0 else 0
    return 'M%d %d A%g %g 0 0 %d %d %d A%g %g 0 0 %d %d %d' % (a + (r, r, sw) + m + (r, r, sw) + b)


def text_width(s, size):
    w = 0
    for ch in s:
        w += size * (0.95 if ord(ch) > 0x2E80 else 0.58)
    return w


def label_lines(room, poly, ref):
    """이름표 줄. 활성 방은 '실명 · 내용', 방 폭이 좁으면 두 줄로 나눈다."""
    name = room['name']
    size = 250
    if room.get('type') != 'active':
        return [name], size
    full = '%s · %s' % (name, room['title'])
    minx, _, maxx, _ = poly.bounds
    if text_width(full, size) < (maxx - minx) - 300:
        return [full], size
    return ['%s ·' % name, room['title']], size


def svg_plan(data, geo, rooms):
    by_name = {r['name']: r for r in rooms}
    texts = {n: (x, y) for n, x, y in data['texts']}
    out = []
    A = out.append

    A('<svg id="plan" class="plan" viewBox="0 0 %d %d" preserveAspectRatio="xMidYMid meet" '
      'xmlns="http://www.w3.org/2000/svg" aria-labelledby="plan-title plan-desc">' % (SHEET_W, SHEET_H))
    A('<title id="plan-title">단위세대 평면도 (84A)</title>')
    A('<desc id="plan-desc">방을 누르면 해당 페이지로 이동합니다.</desc>')
    A('<defs><pattern id="hatch-con" patternUnits="userSpaceOnUse" width="90" height="90" '
      'patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="90" class="hatch-line"/></pattern></defs>')

    # #frame
    A('<g id="frame" aria-hidden="true">')
    A('<rect class="frame-out" x="%d" y="%d" width="%d" height="%d"/>' % (
        FRAME_OUT, FRAME_OUT, SHEET_W - 2 * FRAME_OUT, SHEET_H - 2 * FRAME_OUT))
    A('<rect class="frame-in" x="%d" y="%d" width="%d" height="%d"/>' % (
        FRAME_IN, FRAME_IN, SHEET_W - 2 * FRAME_IN, SHEET_H - 2 * FRAME_IN))
    A('<line class="frame-in" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (COL_X, FRAME_IN, COL_X, SHEET_H - FRAME_IN))
    A('</g>')

    # #titleblock (오른쪽 칸: 방위표, 축척 막대, 표제란)
    A(titleblock())

    # #walls: 외곽선
    A('<g id="walls" aria-hidden="true">')
    out.extend(ring_paths(geo['walls']))
    for (x1, y1), (x2, y2) in data['core']:
        if math.dist((x1, y1), (x2, y2)) > 40:
            a, b = tf(x1, y1), tf(x2, y2)
            A('<path pathLength="1" class="core-line" d="M%d %d L%d %d"/>' % (a + b))
    A('</g>')

    # #wall-fill: 채움 (선보다 살짝 안쪽으로 줄여 외곽선을 가리지 않게)
    A('<g id="wall-fill" aria-hidden="true">')
    for key in ('con', 'mas', 'dry', 'ins'):
        g = geo[key].buffer(-8, **MITRE)
        if not g.is_empty:
            A('<path class="fill-%s" d="%s"/>' % (key, path_d(g, 2)))
    for pts in data['core_fill']:
        A('<path class="fill-core" d="M%sZ"/>' % ' '.join('%d %d' % tf(*p) for p in pts))
    A('</g>')

    # #openings: 창(벽 두께 사각형 + 가운데 선), 문(문짝 선 + 열림 호)
    A('<g id="openings" aria-hidden="true">')
    for (x1, y1, x2, y2) in data['windows']:
        a, b = tf(x1, y2), tf(x2, y1)
        A('<rect class="win" x="%d" y="%d" width="%d" height="%d"/>' % (a[0], a[1], b[0] - a[0], b[1] - a[1]))
        if (x2 - x1) >= (y2 - y1):
            ym = (a[1] + b[1]) // 2
            A('<line class="win" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (a[0], ym, b[0], ym))
        else:
            xm = (a[0] + b[0]) // 2
            A('<line class="win" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (xm, a[1], xm, b[1]))
    for d in geo['doors']:
        c, o = tf(*d['c']), tf(*d['open'])
        A('<line class="door-leaf" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (c + o))
        A('<path class="door-swing" d="%s"/>' % arc_path(d['closed'], d['pm'], d['open'], d['r']))
    for pts in data['door_paths']:
        A('<path class="door-swing" d="M%s"/>' % ' L'.join('%d %d' % tf(*p) for p in pts))
    A('</g>')

    # #rooms: 방 영역 (활성 방은 링크)
    A('<g id="rooms">')
    placed = {}
    for room in rooms:
        if room['name'] not in texts:
            continue
        pt = Point(*texts[room['name']])
        poly = next((p for p in geo['pieces'] if p.contains(pt)), None)
        if poly is None:
            print('  ! 방 영역을 찾지 못함:', room['name'])
            continue
        placed[room['id']] = poly
        d = path_d(poly, 5)
        kind = room.get('type', 'inactive')
        if kind == 'active':
            label = '%s · %s — %s' % (room['name'], room['title'], room['preview'])
            A('<g id="%s" class="room" data-type="active"><a href="%s" class="room-link" aria-label="%s">'
              '<path class="room-area" d="%s"/></a></g>' % (room['id'], room['href'], esc(label), d))
        else:
            A('<g id="%s" class="room" data-type="%s" aria-hidden="true"><path class="room-area" d="%s"/></g>'
              % (room['id'], kind, d))
    A('</g>')

    # #labels: 이름표 + 면적
    A('<g id="labels" aria-hidden="true">')
    for room in rooms:
        if room['id'] not in placed:
            continue
        poly = placed[room['id']]
        x, y = tf(*texts[room['name']])
        lines, size = label_lines(room, poly, texts[room['name']])
        area = poly.area / 1e6
        n = len(lines) + 1
        top = y - (n - 1) * size * 0.62
        A('<g class="label" data-room="%s">' % room['id'])
        for i, ln in enumerate(lines):
            A('<text class="room-name" x="%d" y="%d">%s</text>' % (x, top + i * size * 1.2, esc(ln)))
        A('<text class="room-size" x="%d" y="%d">%.1f㎡</text>' % (x, top + len(lines) * size * 1.2 - 20, area))
        A('</g>')
    for name, cls in (('ELEV.홀', 'core-text'), ('ELEV.', 'core-text'), ('(16인승)', 'core-text small'),
                      ('PS', 'core-text small'), ('EPS/TPS', 'core-text small')):
        if name in texts:
            x, y = tf(*texts[name])
            A('<text class="%s" x="%d" y="%d">%s</text>' % (cls, x, y, esc(name)))
    A('</g>')
    A('</svg>')
    return '\n'.join(out), placed


def titleblock():
    x1, x2 = COL_X + 350, SHEET_W - FRAME_IN - 350
    cx = (x1 + x2) // 2
    o = ['<g id="titleblock" aria-hidden="true">']
    # 방위표 (위 = 북)
    ny = 2600
    o.append('<circle class="tb-line" cx="%d" cy="%d" r="650"/>' % (cx, ny))
    o.append('<path class="north" d="M%d %d L%d %d L%d %d L%d %dZ"/>' % (
        cx, ny - 850, cx + 260, ny + 420, cx, ny + 230, cx - 260, ny + 420))
    o.append('<text class="tb-n" x="%d" y="%d">N</text>' % (cx, ny - 1000))
    # 축척 막대 0–1–3m
    sy, sx = 9150, cx - 1500
    o.append('<rect class="scale-a" x="%d" y="%d" width="1000" height="140"/>' % (sx, sy))
    o.append('<rect class="scale-b" x="%d" y="%d" width="2000" height="140"/>' % (sx + 1000, sy))
    for v, lab in ((0, '0'), (1000, '1'), (3000, '3m')):
        o.append('<text class="tb-scale" x="%d" y="%d">%s</text>' % (sx + v, sy + 420, lab))
    o.append('<text class="tb-key" x="%d" y="%d">SCALE BAR</text>' % (sx, sy - 160))
    # 표제란
    ty, th = 9900, SHEET_H - FRAME_IN - 9900
    rows = [
        (('PROJECT', 'LEE JUNYOUNG · 84A', 'tb-val strong', None),),
        (('TITLE', '단위세대 평면도 (84A)', 'tb-val', None),),
        (('SHEET NO.', 'A-101', 'tb-val strong mono', None), ('SCALE', 'NONE', 'tb-val mono', None)),
        (('DATE', '—', 'tb-val mono', 'tb-date'), ('DRAWN', '이준영', 'tb-val', None)),
    ]
    rh = th / len(rows)
    left = COL_X
    right = SHEET_W - FRAME_IN
    o.append('<rect class="tb-box" x="%d" y="%d" width="%d" height="%d"/>' % (left, ty, right - left, th))
    for i, row in enumerate(rows):
        y = ty + i * rh
        if i:
            o.append('<line class="tb-line" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (left, y, right, y))
        cw = (right - left) / len(row)
        for j, (key, val, cls, vid) in enumerate(row):
            x = left + j * cw
            if j:
                o.append('<line class="tb-line" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (x, y, x, y + rh))
            o.append('<text class="tb-key" x="%d" y="%d">%s</text>' % (x + 200, y + 300, key))
            idattr = ' id="%s"' % vid if vid else ''
            o.append('<text class="%s"%s x="%d" y="%d">%s</text>' % (cls, idattr, x + 200, y + rh - 260, esc(val)))
    o.append('</g>')
    return '\n'.join(o)

# ---------------------------------------------------------------- 확인용 그림


def debug_svg(data, geo, out):
    import colorsys
    parts = []
    for i, f in enumerate(geo['pieces']):
        r, g, b = colorsys.hsv_to_rgb((i * 0.137) % 1, 0.35, 1)
        parts.append('<path d="%s" fill="#%02x%02x%02x" stroke="#666" stroke-width="0.5" vector-effect="non-scaling-stroke"/>'
                     % (path_d(f), int(r * 255), int(g * 255), int(b * 255)))
        cx, cy = tf(f.representative_point().x, f.representative_point().y)
        parts.append('<text x="%d" y="%d" font-size="160" fill="#333">#%d %.1f㎡</text>' % (cx, cy, i, f.area / 1e6))
    for key, col in (('con', '#222'), ('mas', '#33c'), ('dry', '#3a3'), ('ins', '#c6c')):
        parts.append('<path d="%s" fill="%s"/>' % (path_d(geo[key]), col))
    for w in geo['win']:
        parts.append('<path d="%s" fill="none" stroke="#e80" stroke-width="1.5" vector-effect="non-scaling-stroke"/>' % path_d(w))
    for c in geo['closures']:
        parts.append('<polyline points="%s" fill="none" stroke="red" stroke-width="2" vector-effect="non-scaling-stroke"/>'
                     % ' '.join('%d,%d' % tf(*q) for q in c.coords))
    for sp in SPLITS:
        parts.append('<polyline points="%s" fill="none" stroke="blue" stroke-width="2" vector-effect="non-scaling-stroke"/>'
                     % ' '.join('%d,%d' % tf(*q) for q in sp))
    for name, x, y in data['texts']:
        tx, ty = tf(x, y)
        parts.append('<circle cx="%d" cy="%d" r="50" fill="red"/><text x="%d" y="%d" font-size="200" fill="red">%s</text>'
                     % (tx, ty, tx + 60, ty + 220, name))
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" style="background:#fff">%s</svg>'
           % (SHEET_W, SHEET_H, ''.join(parts)))
    Path(out).write_text(svg, encoding='utf-8')
    print('debug →', out)

# ---------------------------------------------------------------- 실행


def inject(svg):
    html = INDEX.read_text(encoding='utf-8')
    start, end = '<!-- PLAN:START -->', '<!-- PLAN:END -->'
    i, j = html.index(start) + len(start), html.index(end)
    html = html[:i] + '\n' + svg + '\n' + html[j:]
    INDEX.write_text(html, encoding='utf-8', newline='\n')
    print('index.html 갱신 (%d자)' % len(svg))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--debug', help='면 분할 확인용 SVG 경로 (index.html은 그대로)')
    ap.add_argument('--preview', help='완성 SVG를 따로 저장할 경로')
    args = ap.parse_args()

    data = load()
    geo = build(data)
    rooms = read_rooms()
    print('창 %d · 문 %d · 실내 공간 %d · 조각 %d' % (len(data['windows']), len(geo['doors']), len(geo['spaces']), len(geo['pieces'])))
    if args.debug:
        debug_svg(data, geo, args.debug)
        return
    svg, placed = svg_plan(data, geo, rooms)
    for r in rooms:
        if r['id'] in placed:
            print('  %-14s %-6s %5.1f㎡' % (r['id'], r['name'], placed[r['id']].area / 1e6))
    if args.preview:
        Path(args.preview).write_text(svg, encoding='utf-8')
    inject(svg)


if __name__ == '__main__':
    main()
