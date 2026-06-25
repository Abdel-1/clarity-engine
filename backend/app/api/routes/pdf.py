"""
PDF Export — GET /api/analyses/{id}/pdf
Clean single-file ReportLab PDF generator. No custom Flowables.
"""
import json
from io import BytesIO
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies.db import get_db
from app.core.dependencies.auth import get_current_user
from app.db.models.analyses import Analysis
from app.db.models.brand_system import BrandSystem
from app.db.models.user import User
from app.api.routes.analysis import _apply_user_scope

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)
from reportlab.pdfgen import canvas as _canvas

router = APIRouter()

# ─── Page geometry ──────────────────────────────────────────────────────────
PW, PH = A4
ML = 16 * mm
MR = 16 * mm
CW = PW - ML - MR          # ≈ 163 mm  (content width)

# ─── Colour tokens ──────────────────────────────────────────────────────────
NAVY     = colors.HexColor('#0f172a')
NAVY2    = colors.HexColor('#1e293b')
GOLD     = colors.HexColor('#c9a227')
SLATE    = colors.HexColor('#64748b')
SLATE_L  = colors.HexColor('#94a3b8')
BORDER   = colors.HexColor('#e2e8f0')
BG_CARD  = colors.HexColor('#f8fafc')
BG_STRIP = colors.HexColor('#f1f5f9')
GREEN    = colors.HexColor('#16a34a')
GREEN_BG = colors.HexColor('#f0fdf4')
AMBER    = colors.HexColor('#d97706')
AMBER_BG = colors.HexColor('#fffbeb')
BLUE     = colors.HexColor('#2563eb')
BLUE_BG  = colors.HexColor('#eff6ff')
RED      = colors.HexColor('#dc2626')
WHITE    = colors.white


# ─── Score helpers ───────────────────────────────────────────────────────────

def _col(n, mx):
    p = n / mx if mx else 0
    return GREEN if p >= 0.75 else AMBER if p >= 0.5 else RED

def _lbl(n, mx):
    p = n / mx if mx else 0
    return "Excellent" if p >= 0.75 else "Satisfaisant" if p >= 0.5 else "À améliorer"

def _risk_lbl(r):
    if not r:
        return "—"
    v = r.lower().replace('é', 'e')
    return {
        "faible": "Faible", "low": "Faible",
        "modere": "Modéré", "medium": "Modéré",
        "eleve": "Élevé", "high": "Élevé"
    }.get(v, r)

def _risk_col(r):
    if not r:
        return SLATE
    v = r.lower().replace('é', 'e')
    return {
        "faible": GREEN, "low": GREEN,
        "modere": AMBER, "medium": AMBER,
        "eleve": RED, "high": RED
    }.get(v, SLATE)

def _parse(raw):
    try:   return json.loads(raw) if raw else []
    except: return []


from xml.sax.saxutils import escape as _xml_escape

def _esc(t) -> str:
    """Escape user content for ReportLab's mini-HTML paragraph parser.
    Without this, an '&' or '<' in a message/point would crash PDF generation."""
    return _xml_escape(str(t if t is not None else ""))

def _clamp(v, mx):
    return min(v, mx) if v is not None else 0


# ─── Paragraph styles ────────────────────────────────────────────────────────

def S():
    kw = dict(spaceBefore=0, spaceAfter=0)
    return {
        'cap'  : ParagraphStyle('cap',  fontSize=7,    fontName='Helvetica-Bold',
                                textColor=SLATE_L, leading=9.5, **kw),
        'val'  : ParagraphStyle('val',  fontSize=10,   fontName='Helvetica-Bold',
                                textColor=NAVY,    leading=12.5, **kw),
        'sec'  : ParagraphStyle('sec',  fontSize=9.5,  fontName='Helvetica-Bold',
                                textColor=WHITE,   leading=11.5,  **kw),
        'body' : ParagraphStyle('body', fontSize=10.5, fontName='Helvetica',
                                textColor=NAVY2,   leading=16.5, alignment=TA_JUSTIFY, **kw),
        'pt'   : ParagraphStyle('pt',   fontSize=10,   fontName='Helvetica',
                                textColor=NAVY2,   leading=14.5, **kw),
        'foot' : ParagraphStyle('foot', fontSize=7,    fontName='Helvetica',
                                textColor=SLATE,   leading=9.5,  alignment=TA_CENTER, **kw),
        'slbl' : ParagraphStyle('slbl', fontSize=9,    fontName='Helvetica-Bold',
                                textColor=NAVY,    leading=11, alignment=TA_CENTER, **kw),
        'sdsc' : ParagraphStyle('sdsc', fontSize=7,    fontName='Helvetica',
                                textColor=SLATE,   leading=8.5,  alignment=TA_CENTER, **kw),
    }


# ─── Page header & footer (drawn directly on canvas every page) ──────────────

def _deco(canv: _canvas.Canvas, doc, brand: str, title: str):
    w, h = PW, PH

    # ── Top bar ──────────────────────────────────────────────────────────
    canv.setFillColor(NAVY)
    canv.rect(0, h - 17*mm, w, 17*mm, fill=1, stroke=0)
    canv.setFillColor(GOLD)
    canv.rect(0, h - 17*mm, w, 1.5, fill=1, stroke=0)     # gold underline

    canv.setFillColor(GOLD)
    canv.setFont('Helvetica-Bold', 10)
    canv.drawString(ML, h - 10*mm, 'CLARITY ENGINE')

    canv.setFillColor(colors.HexColor('#94a3b8'))
    canv.setFont('Helvetica', 8)
    canv.drawString(ML + 88, h - 10*mm, '|  Rapport d\'Analyse de Communication')

    canv.setFillColor(colors.HexColor('#94a3b8'))
    canv.setFont('Helvetica', 7.5)
    canv.drawRightString(w - MR, h - 10*mm, f'{brand[:26]}  ·  Page {doc.page}')

    # ── Bottom strip ──────────────────────────────────────────────────────
    canv.setFillColor(BG_STRIP)
    canv.rect(0, 0, w, 11*mm, fill=1, stroke=0)
    canv.setFillColor(GOLD)
    canv.rect(0, 11*mm, w, 0.8, fill=1, stroke=0)

    canv.setFillColor(SLATE)
    canv.setFont('Helvetica', 6)
    canv.drawCentredString(w/2, 4*mm,
        '© Clarity Engine  —  Document confidentiel  —  Généré automatiquement')
    short = (title[:60] + '…') if len(title) > 60 else title
    canv.drawString(ML, 4*mm, short)
    canv.drawRightString(w - MR, 4*mm, datetime.now().strftime('%d/%m/%Y %H:%M'))


# ─── Section header bar ──────────────────────────────────────────────────────

def _shdr(text: str, s) -> Table:
    t = Table([[Paragraph(text, s['sec'])]], colWidths=[CW])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,-1), NAVY),
        ('LINEBELOW',     (0,0),(-1,-1), 2.5, GOLD),
        ('LEFTPADDING',   (0,0),(-1,-1), 14),
        ('RIGHTPADDING',  (0,0),(-1,-1), 12),
        ('TOPPADDING',    (0,0),(-1,-1), 9),
        ('BOTTOMPADDING', (0,0),(-1,-1), 9),
    ]))
    return t


# ─── Thin coloured bar helper (fits within a given width) ────────────────────

def _bar(pct: float, total_w: float, h: int = 8, col=GREEN) -> Table:
    """Two-cell table that renders a progress bar.  total_w must not exceed CW."""
    filled = max(0.5, total_w * pct)
    empty  = max(0.5, total_w - filled)
    t = Table([['', '']], colWidths=[filled, empty], rowHeights=[h])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(0,0), col),
        ('BACKGROUND',    (1,0),(1,0), BORDER),
        ('TOPPADDING',    (0,0),(-1,-1), 0),
        ('BOTTOMPADDING', (0,0),(-1,-1), 0),
        ('LEFTPADDING',   (0,0),(-1,-1), 0),
        ('RIGHTPADDING',  (0,0),(-1,-1), 0),
    ]))
    return t


# ─── Hero score card ─────────────────────────────────────────────────────────

def _hero(score: int, meta: dict, s) -> Table:
    c    = _col(score, 100)
    LW   = CW * 0.40    # left (score) column
    RW   = CW * 0.60    # right (meta) column
    BAR  = LW - 4       # bar fits strictly inside left column

    # ── Score block (left) ────────────────────────────────────────────────
    def _p(txt, sz, bold, color, lead):
        fn = 'Helvetica-Bold' if bold else 'Helvetica'
        return Paragraph(txt,
            ParagraphStyle('_', fontSize=sz, fontName=fn,
                           textColor=color, leading=lead,
                           spaceBefore=0, spaceAfter=0))

    score_p   = _p(f'{score}', 40, True,  c,      44)
    slash_p   = _p(f'/100',    12, False, SLATE_L, 14)
    badge_p   = _p(_lbl(score,100), 10, True, c,  13)
    cap_p     = _p('SCORE GLOBAL DE CLARTÉ', 6.5, True, SLATE_L, 8)
    risk_c    = _risk_col(meta.get('risk'))
    risk_p    = _p(
        f'Risque narratif : <font color="{risk_c.hexval()}"><b>'
        f'{_risk_lbl(meta.get("risk"))}</b></font>',
        8, False, SLATE, 11)

    # The score number and /100 are placed side by side in a tiny 2-col table
    score_row = Table(
        [[score_p, slash_p]],
        colWidths=[LW * 0.60, LW * 0.40],
    )
    score_row.setStyle(TableStyle([
        ('VALIGN',        (0,0),(-1,-1), 'BOTTOM'),
        ('TOPPADDING',    (0,0),(-1,-1), 0),
        ('BOTTOMPADDING', (0,0),(-1,-1), 0),
        ('LEFTPADDING',   (0,0),(-1,-1), 0),
        ('RIGHTPADDING',  (0,0),(-1,-1), 0),
    ]))

    bar_tbl = _bar(score / 100, BAR, 9, c)

    left = Table([
        [score_row],
        [Spacer(1, 2)],
        [badge_p],
        [Spacer(1, 12)],
        [cap_p],
        [Spacer(1, 4)],
        [bar_tbl],
        [Spacer(1, 10)],
        [risk_p],
    ], colWidths=[LW])
    left.setStyle(TableStyle([
        ('TOPPADDING',    (0,0),(-1,-1), 0),
        ('BOTTOMPADDING', (0,0),(-1,-1), 0),
        ('LEFTPADDING',   (0,0),(-1,-1), 0),
        ('RIGHTPADDING',  (0,0),(-1,-1), 0),
        ('VALIGN',        (0,0),(-1,-1), 'TOP'),
    ]))

    # ── Meta grid (right) ─────────────────────────────────────────────────
    fields = [
        ('SYSTÈME DE MARQUE', meta.get('brand_name','—')),
        ('CANAL',             meta.get('channel') or '—'),
        ('TYPE DE CONTENU',   meta.get('content_type') or '—'),
        ('LANGUE',            (meta.get('lang') or 'FR').upper()),
        ("DATE D'ANALYSE",    meta.get('date','—')),
        ('ANALYSÉ PAR',       meta.get('analyzed_by') or '—'),
    ]
    CW2 = RW / 2

    def _field(lbl_txt, val_txt):
        t = Table([
            [Paragraph(_esc(lbl_txt), s['cap'])],
            [Paragraph(_esc(str(val_txt)[:28]), s['val'])],
        ], colWidths=[CW2 - 10])
        t.setStyle(TableStyle([
            ('TOPPADDING',    (0,0),(-1,-1), 0),
            ('BOTTOMPADDING', (0,0),(-1,-1), 10),
            ('LEFTPADDING',   (0,0),(-1,-1), 0),
            ('RIGHTPADDING',  (0,0),(-1,-1), 0),
        ]))
        return t

    meta_rows = [
        [_field(fields[0][0], fields[0][1]), _field(fields[1][0], fields[1][1])],
        [_field(fields[2][0], fields[2][1]), _field(fields[3][0], fields[3][1])],
        [_field(fields[4][0], fields[4][1]), _field(fields[5][0], fields[5][1])],
    ]
    meta_grid = Table(meta_rows, colWidths=[CW2, CW2])
    meta_grid.setStyle(TableStyle([
        ('VALIGN',        (0,0),(-1,-1), 'TOP'),
        ('TOPPADDING',    (0,0),(-1,-1), 0),
        ('BOTTOMPADDING', (0,0),(-1,-1), 0),
        ('LEFTPADDING',   (0,0),(-1,-1), 0),
        ('RIGHTPADDING',  (0,0),(-1,-1), 0),
    ]))

    right = Table([[meta_grid]], colWidths=[RW])
    right.setStyle(TableStyle([
        ('LEFTPADDING',   (0,0),(-1,-1), 18),
        ('RIGHTPADDING',  (0,0),(-1,-1), 0),
        ('TOPPADDING',    (0,0),(-1,-1), 4),
        ('BOTTOMPADDING', (0,0),(-1,-1), 0),
        ('LINEBEFORE',    (0,0),(-1,-1), 0.6, BORDER),
    ]))

    # ── Combine ───────────────────────────────────────────────────────────
    inner = Table([[left, right]], colWidths=[LW, RW])
    inner.setStyle(TableStyle([
        ('VALIGN',        (0,0),(-1,-1), 'TOP'),
        ('TOPPADDING',    (0,0),(-1,-1), 0),
        ('BOTTOMPADDING', (0,0),(-1,-1), 0),
        ('LEFTPADDING',   (0,0),(-1,-1), 0),
        ('RIGHTPADDING',  (0,0),(-1,-1), 0),
    ]))

    card = Table([[inner]], colWidths=[CW])
    card.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,-1), BG_CARD),
        ('BOX',           (0,0),(-1,-1), 0.7, BORDER),
        ('LINEABOVE',     (0,0),(-1, 0), 3.5, GOLD),
        ('LEFTPADDING',   (0,0),(-1,-1), 18),
        ('RIGHTPADDING',  (0,0),(-1,-1), 18),
        ('TOPPADDING',    (0,0),(-1,-1), 18),
        ('BOTTOMPADDING', (0,0),(-1,-1), 18),
    ]))
    return card


# ─── 5 Subscores grid ────────────────────────────────────────────────────────

SUBS = [
    ('sub_lisibilite',             'Lisibilité',  'Clarté & fluidité'),
    ('sub_alignment',              'Alignement',  'Cohérence de marque'),
    ('sub_focus',                  'Focus',       'Précision du propos'),
    ('sub_tone',                   'Ton',         'Registre tonal'),
    ('sub_narrative_contribution', 'Narratif',    'Contribution narrative'),
]


def _subscores(vals: dict, s) -> Table:
    CW5 = CW / 5
    BAR = CW5 - 16

    cells = []
    for key, label, desc in SUBS:
        v  = vals.get(key, 0) or 0
        c  = _col(v, 20)

        score_p = Paragraph(
            f'<font color="{c.hexval()}"><b>{v}</b></font>'
            f'<font size="8" color="#94a3b8"> /20</font>',
            ParagraphStyle('_', fontSize=20, fontName='Helvetica-Bold',
                           alignment=TA_CENTER, leading=22,
                           spaceBefore=0, spaceAfter=0))

        badge_p = Paragraph(
            f'<font color="{c.hexval()}"><b>{_lbl(v, 20)}</b></font>',
            ParagraphStyle('_', fontSize=7, fontName='Helvetica-Bold',
                           alignment=TA_CENTER, leading=9,
                           spaceBefore=0, spaceAfter=0))

        bar_tbl = _bar(v / 20, BAR, 5, c)

        cell = Table([
            [Paragraph(label, s['slbl'])],
            [Spacer(1, 6)],
            [score_p],
            [Spacer(1, 4)],
            [bar_tbl],
            [Spacer(1, 4)],
            [badge_p],
            [Spacer(1, 2)],
            [Paragraph(desc, s['sdsc'])],
        ], colWidths=[CW5 - 6])
        cell.setStyle(TableStyle([
            ('ALIGN',         (0,0),(-1,-1), 'CENTER'),
            ('VALIGN',        (0,0),(-1,-1), 'TOP'),
            ('TOPPADDING',    (0,0),(-1,-1), 0),
            ('BOTTOMPADDING', (0,0),(-1,-1), 0),
            ('LEFTPADDING',   (0,0),(-1,-1), 3),
            ('RIGHTPADDING',  (0,0),(-1,-1), 3),
        ]))
        cells.append(cell)

    grid = Table([cells], colWidths=[CW5] * 5)
    grid.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,-1), BG_CARD),
        ('BOX',           (0,0),(-1,-1), 0.7, BORDER),
        ('LINEAFTER',     (0,0),(-2,-1), 0.5, BORDER),
        ('TOPPADDING',    (0,0),(-1,-1), 14),
        ('BOTTOMPADDING', (0,0),(-1,-1), 14),
        ('ALIGN',         (0,0),(-1,-1), 'CENTER'),
        ('VALIGN',        (0,0),(-1,-1), 'TOP'),
    ]))
    return grid


# ─── Message body block ──────────────────────────────────────────────────────

def _msg(body: str, s) -> Table:
    html = _esc(body).replace('\n', '<br/>')
    t = Table([[Paragraph(html, s['body'])]], colWidths=[CW])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,-1), BG_CARD),
        ('BOX',           (0,0),(-1,-1), 0.7, BORDER),
        ('LINEBEFORE',    (0,0),(0,-1),  3.5, GOLD),
        ('LEFTPADDING',   (0,0),(-1,-1), 16),
        ('RIGHTPADDING',  (0,0),(-1,-1), 16),
        ('TOPPADDING',    (0,0),(-1,-1), 14),
        ('BOTTOMPADDING', (0,0),(-1,-1), 14),
    ]))
    return t


def _rewritten_msg(body: str, s) -> Table:
    t = Table([[Paragraph(body, s['body'])]], colWidths=[CW])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,-1), GREEN_BG),
        ('BOX',           (0,0),(-1,-1), 0.7, BORDER),
        ('LINEBEFORE',    (0,0),(0,-1),  3.5, GREEN),
        ('LEFTPADDING',   (0,0),(-1,-1), 14),
        ('RIGHTPADDING',  (0,0),(-1,-1), 14),
        ('TOPPADDING',    (0,0),(-1,-1), 12),
        ('BOTTOMPADDING', (0,0),(-1,-1), 12),
    ]))
    return t


# ─── Points / recommandations block ─────────────────────────────────────────

def _pts(items: list, bg, accent, s) -> Table:
    rows = []
    for i, item in enumerate(items):
        # Support both legacy string items and v2 schema objects {text, evidence|brand_element}
        if isinstance(item, dict):
            txt   = _esc(item.get("text", ""))
            extra = _esc(item.get("evidence") or item.get("brand_element") or "")
        else:
            txt, extra = _esc(item), ""
        html = txt
        if extra:
            html += (f'<br/><font size="8" color="{SLATE.hexval()}"><i>{extra}</i></font>')
        num = Paragraph(
            f'<font color="#ffffff"><b>{i+1}</b></font>',
            ParagraphStyle('_', fontSize=8, fontName='Helvetica-Bold',
                           alignment=TA_CENTER, leading=10,
                           spaceBefore=0, spaceAfter=0))

        nbx = Table([[num]], colWidths=[18], rowHeights=[18])
        nbx.setStyle(TableStyle([
            ('BACKGROUND',    (0,0),(-1,-1), accent),
            ('ALIGN',         (0,0),(-1,-1), 'CENTER'),
            ('VALIGN',        (0,0),(-1,-1), 'MIDDLE'),
            ('TOPPADDING',    (0,0),(-1,-1), 0),
            ('BOTTOMPADDING', (0,0),(-1,-1), 0),
            ('LEFTPADDING',   (0,0),(-1,-1), 0),
            ('RIGHTPADDING',  (0,0),(-1,-1), 0),
        ]))

        row = Table([[nbx, Paragraph(html, s['pt'])]], colWidths=[26, CW-26])
        row.setStyle(TableStyle([
            ('BACKGROUND',    (0,0),(-1,-1), bg),
            ('LINEBEFORE',    (0,0),(0,-1),  3, accent),
            ('LINEBELOW',     (0,0),(-1,-1), 0.4, BORDER),
            ('VALIGN',        (0,0),(-1,-1), 'MIDDLE'),
            ('TOPPADDING',    (0,0),(-1,-1), 7),
            ('BOTTOMPADDING', (0,0),(-1,-1), 7),
            ('LEFTPADDING',   (0,0),(0,0),   4),
            ('RIGHTPADDING',  (0,0),(0,0),   0),
            ('LEFTPADDING',   (1,0),(1,-1),  8),
            ('RIGHTPADDING',  (1,0),(1,-1),  10),
        ]))
        rows.append([row])

    outer = Table(rows, colWidths=[CW])
    outer.setStyle(TableStyle([
        ('BOX',           (0,0),(-1,-1), 0.7, BORDER),
        ('TOPPADDING',    (0,0),(-1,-1), 0),
        ('BOTTOMPADDING', (0,0),(-1,-1), 0),
        ('LEFTPADDING',   (0,0),(-1,-1), 0),
        ('RIGHTPADDING',  (0,0),(-1,-1), 0),
    ]))
    return outer


# ─── PDF builder ─────────────────────────────────────────────────────────────

def generate_analysis_pdf(analysis: Analysis, bs_name: str) -> bytes:
    buf   = BytesIO()
    title = (analysis.message_title or 'Rapport')[:80]

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=ML, rightMargin=MR,
        topMargin=23*mm, bottomMargin=17*mm,
        title=f'Clarity Engine — {title}',
        author='Clarity Engine',
    )

    s    = S()
    pf   = _parse(analysis.points_forts)
    pw   = _parse(analysis.points_faibles)
    recs = _parse(analysis.recommandations)

    score = _clamp(analysis.clarity_score or 0, 100)
    subs  = {k: _clamp(getattr(analysis, k, None), 20) for k,*_ in SUBS}
    date  = analysis.analyzed_at.strftime('%d/%m/%Y') if analysis.analyzed_at else '—'

    meta = {
        'brand_name':   bs_name,
        'channel':      analysis.channel,
        'content_type': analysis.content_type,
        'lang':         analysis.message_language,
        'risk':         analysis.narrative_risk,
        'analyzed_by':  analysis.analyzed_by,
        'date':         date,
    }

    story = []

    story.append(_hero(score, meta, s))
    story.append(Spacer(1, 14))

    story.append(_shdr('ANALYSE DES 5 DIMENSIONS STRATÉGIQUES', s))
    story.append(_subscores(subs, s))
    story.append(Spacer(1, 14))

    if analysis.message_body and analysis.message_body.strip():
        story.append(_shdr('MESSAGE ANALYSÉ', s))
        story.append(_msg(analysis.message_body, s))
        story.append(Spacer(1, 14))

    if pf:
        story.append(_shdr(f'POINTS FORTS  ({len(pf)})', s))
        story.append(_pts(pf, GREEN_BG, GREEN, s))
        story.append(Spacer(1, 14))

    if pw:
        story.append(_shdr(f"POINTS D'AMÉLIORATION  ({len(pw)})", s))
        story.append(_pts(pw, AMBER_BG, AMBER, s))
        story.append(Spacer(1, 14))

    if recs:
        story.append(_shdr(f'RECOMMANDATIONS IA  ({len(recs)})', s))
        story.append(_pts(recs, BLUE_BG, BLUE, s))
        story.append(Spacer(1, 14))

    story.append(HRFlowable(width=CW, thickness=0.5, color=BORDER, spaceAfter=5))
    story.append(Paragraph(
        f'Rapport généré le {datetime.now().strftime("%d/%m/%Y à %H:%M")}  ·  '
        f'Système : {_esc(bs_name)}  ·  Score : {score}/100  ·  Clarity Engine',
        s['foot'],
    ))

    def _on(canv, doc):
        _deco(canv, doc, bs_name, title)

    doc.build(story, onFirstPage=_on, onLaterPages=_on)
    return buf.getvalue()


# ─── FastAPI route ────────────────────────────────────────────────────────────

@router.get('/analyses/{analysis_id}/pdf')
def export_pdf(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Auth required + ownership: reuse the same role scoping as GET /analyses/{id}
    q = db.query(Analysis).filter(Analysis.id == analysis_id)
    q = _apply_user_scope(q, current_user)
    row = q.first()
    if not row:
        raise HTTPException(404, 'Analysis not found')

    bs      = db.query(BrandSystem).filter(BrandSystem.id == row.brand_system_id).first()
    bs_name = bs.brand_name if bs else '—'

    data     = generate_analysis_pdf(row, bs_name)
    safe     = ''.join(c for c in (row.message_title or 'rapport')
                       if c.isalnum() or c in ' _-')[:40].strip()
    filename = f'clarity-{row.id}-{safe}.pdf'.replace(' ', '_')

    return StreamingResponse(
        BytesIO(data),
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )
