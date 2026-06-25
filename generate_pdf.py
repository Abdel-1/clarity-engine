from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether, Flowable
)
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Circle, Polygon
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics import renderPDF
from reportlab.platypus.flowables import Flowable
import math

# ─── BRAND COLORS ────────────────────────────────────────────────────────────
NAVY       = colors.HexColor('#0A1628')
BLUE_DARK  = colors.HexColor('#1A3A6E')
BLUE_MID   = colors.HexColor('#2D6BE4')
BLUE_LIGHT = colors.HexColor('#4A90D9')
BLUE_PALE  = colors.HexColor('#EBF3FF')
ACCENT     = colors.HexColor('#00C6AE')   # teal accent
ACCENT2    = colors.HexColor('#F5A623')   # amber
WHITE      = colors.white
GRAY_DARK  = colors.HexColor('#2C3E50')
GRAY_MID   = colors.HexColor('#7F8C8D')
GRAY_LIGHT = colors.HexColor('#ECF0F1')
GRAY_LINE  = colors.HexColor('#D5DDE8')
RED_RISK   = colors.HexColor('#E74C3C')
GREEN_OK   = colors.HexColor('#27AE60')
AMBER_WARN = colors.HexColor('#F39C12')

PAGE_W, PAGE_H = A4

# ─── CUSTOM FLOWABLES ─────────────────────────────────────────────────────────

def draw_cover(c):
    """Draw the cover page directly onto a canvas object (no frame/margin constraints)."""
    w, h = PAGE_W, PAGE_H

    # ── Dark navy background
    c.setFillColor(NAVY)
    c.rect(0, 0, w, h, fill=1, stroke=0)

    # ── Decorative diagonal stripe (top-right)
    c.setFillColor(BLUE_DARK)
    p = c.beginPath()
    p.moveTo(w * 0.55, h)
    p.lineTo(w, h)
    p.lineTo(w, h * 0.55)
    p.close()
    c.drawPath(p, fill=1, stroke=0)

    # ── Accent line stripe
    c.setFillColor(BLUE_MID)
    p2 = c.beginPath()
    p2.moveTo(w * 0.65, h)
    p2.lineTo(w, h)
    p2.lineTo(w, h * 0.65)
    p2.close()
    c.drawPath(p2, fill=1, stroke=0)

    # ── Teal accent corner triangle
    c.setFillColor(ACCENT)
    p3 = c.beginPath()
    p3.moveTo(w * 0.75, h)
    p3.lineTo(w, h)
    p3.lineTo(w, h * 0.75)
    p3.close()
    c.drawPath(p3, fill=1, stroke=0)

    # ── Bottom gradient band
    c.setFillColor(BLUE_DARK)
    c.rect(0, 0, w, 60, fill=1, stroke=0)
    c.setFillColor(BLUE_MID)
    c.rect(0, 0, w * 0.4, 60, fill=1, stroke=0)

    # ── Horizontal accent bar
    c.setFillColor(ACCENT)
    c.rect(0, h * 0.38, w, 4, fill=1, stroke=0)
    c.setFillColor(BLUE_LIGHT)
    c.rect(0, h * 0.38 - 2, w * 0.6, 2, fill=1, stroke=0)

    # ── Left vertical accent bar
    c.setFillColor(ACCENT)
    c.rect(0, h * 0.38 + 4, 5, h * 0.52, fill=1, stroke=0)

    # ── Circular decoration (abstract logo feel)
    cx, cy = w * 0.82, h * 0.72
    for i, (col, rad) in enumerate([
        (colors.HexColor('#ffffff10'), 80),
        (colors.HexColor('#ffffff18'), 55),
        (BLUE_MID, 34),
        (ACCENT, 18),
    ]):
        c.setFillColor(col)
        c.circle(cx, cy, rad, fill=1, stroke=0)

    # ── Tag: RAPPORT DE STAGE
    c.setFillColor(BLUE_MID)
    c.roundRect(40, h - 62, 200, 28, 6, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 10)
    c.drawString(52, h - 50, 'RAPPORT DE STAGE — 2026')

    # ── Main title
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 46)
    c.drawString(40, h * 0.60, 'CLARITY')
    c.setFillColor(ACCENT)
    c.setFont('Helvetica-Bold', 46)
    c.drawString(40, h * 0.52, 'ENGINE')

    # ── Subtitle
    c.setFillColor(GRAY_LIGHT)
    c.setFont('Helvetica', 14)
    c.drawString(40, h * 0.46, 'Plateforme SaaS de Gouvernance de Marque')

    # ── Divider dots
    c.setFillColor(BLUE_LIGHT)
    for xi in range(6):
        c.circle(40 + xi * 16, h * 0.42, 3, fill=1, stroke=0)


    # ── Footer
    c.setFillColor(GRAY_MID)
    c.setFont('Helvetica', 8)
    c.drawString(42, 22, '© 2026 Zone Bleue — Document confidentiel')
    c.setFillColor(ACCENT)
    c.drawRightString(w - 40, 22, 'Livrables Techniques')


class SectionDivider(Flowable):
    """Full-width colored section divider banner."""
    def __init__(self, number, title, subtitle='', color=BLUE_DARK):
        Flowable.__init__(self)
        self.number   = number
        self.title    = title
        self.subtitle = subtitle
        self.color    = color
        self.width    = PAGE_W - 80
        self.height   = 52

    def wrap(self, aw, ah):
        return (self.width, self.height)

    def draw(self):
        c = self.canv
        w = self.width
        # Background
        c.setFillColor(self.color)
        c.roundRect(0, 0, w, self.height, 6, fill=1, stroke=0)
        # Number circle
        c.setFillColor(ACCENT)
        c.circle(30, self.height / 2, 16, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont('Helvetica-Bold', 14)
        c.drawCentredString(30, self.height / 2 - 5, str(self.number))
        # Title
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 15)
        c.drawString(56, self.height / 2 + 2, self.title)
        if self.subtitle:
            c.setFont('Helvetica', 9)
            c.setFillColor(GRAY_LIGHT)
            c.drawString(58, self.height / 2 - 13, self.subtitle)
        # Right accent
        c.setFillColor(ACCENT)
        c.rect(w - 6, 0, 6, self.height, fill=1, stroke=0)


class ArchitectureDiagram(Flowable):
    """Custom architecture diagram."""
    def __init__(self):
        Flowable.__init__(self)
        self.width  = PAGE_W - 80
        self.height = 200

    def wrap(self, aw, ah):
        return (self.width, self.height)

    def _box(self, c, x, y, w, h, fill_col, text_lines, radius=6):
        c.setFillColor(fill_col)
        c.roundRect(x, y, w, h, radius, fill=1, stroke=0)
        # white border
        c.setStrokeColor(WHITE)
        c.setLineWidth(0.5)
        c.roundRect(x, y, w, h, radius, fill=0, stroke=1)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 8)
        mid_y = y + h / 2 + (len(text_lines) - 1) * 6
        for line in text_lines:
            c.drawCentredString(x + w / 2, mid_y, line)
            mid_y -= 11

    def _arrow(self, c, x1, y1, x2, y2, label='', color=BLUE_LIGHT, bidirectional=False):
        c.setStrokeColor(color)
        c.setLineWidth(1.2)
        c.line(x1, y1, x2, y2)
        # arrowhead at (x2, y2)
        dx = x2 - x1; dy = y2 - y1
        length = math.sqrt(dx*dx + dy*dy)
        if length == 0:
            return
        ux = dx / length; uy = dy / length
        ax1 = x2 - 8*ux + 4*uy
        ax2 = x2 - 8*ux - 4*uy
        c.setFillColor(color)
        p = c.beginPath()
        p.moveTo(x2, y2)
        p.lineTo(ax1, ax1 if ax1 == ax2 else ax1)
        # simple triangle
        p.moveTo(x2, y2)
        p.lineTo(ax1, y2 - 8*uy + 4*ux if uy != 0 else y2)
        p.lineTo(ax2, y2 - 8*uy - 4*ux if uy != 0 else y2)
        p.close()
        c.drawPath(p, fill=1, stroke=0)
        if label:
            mx = (x1 + x2) / 2; my = (y1 + y2) / 2
            c.setFillColor(GRAY_MID)
            c.setFont('Helvetica', 7)
            c.drawCentredString(mx, my + 4, label)

    def draw(self):
        c = self.canv
        W = self.width
        H = self.height

        # Background card
        c.setFillColor(colors.HexColor('#F0F4FB'))
        c.roundRect(0, 0, W, H, 8, fill=1, stroke=0)
        c.setStrokeColor(GRAY_LINE)
        c.setLineWidth(0.8)
        c.roundRect(0, 0, W, H, 8, fill=0, stroke=1)

        # Title band
        c.setFillColor(NAVY)
        c.roundRect(0, H - 28, W, 28, 8, fill=1, stroke=0)
        c.rect(0, H - 28, W, 14, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 9)
        c.drawCentredString(W / 2, H - 18, 'ARCHITECTURE APPLICATIVE — CLARITY ENGINE')

        # Layers (top → bottom)
        # Layer 1: Browser
        bw, bh = 140, 36
        bx = (W - bw) / 2
        self._box(c, bx, H - 75, bw, bh, BLUE_MID,
                  ['Navigateur Web', '(React SPA — TypeScript)'])

        # Arrow down
        mid_x = W / 2
        c.setStrokeColor(BLUE_LIGHT)
        c.setLineWidth(1.5)
        c.line(mid_x, H - 75, mid_x, H - 98)
        c.setFillColor(BLUE_LIGHT)
        _p = c.beginPath()
        _p.moveTo(mid_x, H - 104)
        _p.lineTo(mid_x - 5, H - 96)
        _p.lineTo(mid_x + 5, H - 96)
        _p.close()
        c.drawPath(_p, fill=1, stroke=0)
        c.setFont('Helvetica', 7)
        c.setFillColor(GRAY_MID)
        c.drawCentredString(mid_x + 30, H - 90, 'REST / HTTP + JWT')

        # Layer 2: Backend
        self._box(c, bx, H - 140, bw, 36, BLUE_DARK,
                  ['Serveur Backend', '(FastAPI / Python 3.11+)'])

        # Two branches from backend
        # Left: SQLite
        lx = 25; ly = H - 192
        c.setStrokeColor(BLUE_LIGHT)
        c.setLineWidth(1.2)
        c.line(bx + 20, H - 140, lx + 60, ly + 32)
        c.setFillColor(BLUE_LIGHT)
        _p2 = c.beginPath()
        _p2.moveTo(lx + 60, ly + 32)
        _p2.lineTo(lx + 54, ly + 37)
        _p2.lineTo(lx + 63, ly + 40)
        _p2.close()
        c.drawPath(_p2, fill=1, stroke=0)
        c.setFont('Helvetica', 7)
        c.setFillColor(GRAY_MID)
        c.drawString(22, H - 165, 'SQLAlchemy')
        self._box(c, lx, ly, 120, 32, colors.HexColor('#1A6E4A'),
                  ['Base de données', 'SQLite'])

        # Right: Groq API
        rx = W - 145
        c.setStrokeColor(BLUE_LIGHT)
        c.setLineWidth(1.2)
        c.line(bx + bw - 20, H - 140, rx + 60, ly + 32)
        c.setFillColor(BLUE_LIGHT)
        _p3 = c.beginPath()
        _p3.moveTo(rx + 60, ly + 32)
        _p3.lineTo(rx + 54, ly + 37)
        _p3.lineTo(rx + 63, ly + 40)
        _p3.close()
        c.drawPath(_p3, fill=1, stroke=0)
        c.setFont('Helvetica', 7)
        c.setFillColor(GRAY_MID)
        c.drawString(rx - 10, H - 165, 'Groq SDK (HTTPS)')
        self._box(c, rx, ly, 120, 32, colors.HexColor('#6E1A4A'),
                  ['API Groq Cloud', 'Llama 3.3-70b'])

        # Optional: Celery/Redis (dashed)
        cx2 = W / 2 - 55
        c.setStrokeColor(AMBER_WARN)
        c.setDash(3, 3)
        c.setLineWidth(1)
        c.line(bx + bw / 2, H - 140, cx2 + 55, ly + 32)
        c.setDash()
        self._box(c, cx2, ly, 110, 32, colors.HexColor('#7E5A00'),
                  ['Celery + Redis', '(Documents async)'])

        # Legend
        c.setFillColor(GRAY_MID)
        c.setFont('Helvetica', 7)
        c.drawString(8, 8, '●  Flux synchrone (REST/HTTP)')
        c.setFillColor(AMBER_WARN)
        c.drawString(160, 8, '- - -  Flux asynchrone (Celery)')
        c.setFillColor(GRAY_MID)


class RiskBadge(Flowable):
    """Small inline colored risk badge."""
    def __init__(self, level, text):
        Flowable.__init__(self)
        colors_map = {'high': RED_RISK, 'medium': AMBER_WARN, 'low': GREEN_OK}
        self.bg    = colors_map.get(level, BLUE_MID)
        self.text  = text
        self.width = 110
        self.height = 20

    def wrap(self, aw, ah):
        return (self.width, self.height)

    def draw(self):
        c = self.canv
        c.setFillColor(self.bg)
        c.roundRect(0, 0, self.width, self.height, 4, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 8)
        c.drawCentredString(self.width / 2, 6, self.text)


class KPIRow(Flowable):
    """Row of KPI cards."""
    def __init__(self, items):
        Flowable.__init__(self)
        self.items  = items   # list of (icon_char, value, label, color)
        self.width  = PAGE_W - 80
        self.height = 62

    def wrap(self, aw, ah):
        return (self.width, self.height)

    def draw(self):
        c = self.canv
        n   = len(self.items)
        pad = 8
        bw  = (self.width - pad * (n + 1)) / n

        for i, (icon, value, label, col) in enumerate(self.items):
            x = pad + i * (bw + pad)
            y = 0
            # Card bg
            c.setFillColor(col)
            c.roundRect(x, y, bw, self.height, 6, fill=1, stroke=0)
            # Icon circle
            c.setFillColor(colors.HexColor('#ffffff30'))
            c.circle(x + 20, y + self.height / 2, 14, fill=1, stroke=0)
            c.setFillColor(WHITE)
            c.setFont('Helvetica-Bold', 13)
            c.drawCentredString(x + 20, y + self.height / 2 - 5, icon)
            # Value
            c.setFont('Helvetica-Bold', 16)
            c.drawString(x + 38, y + self.height / 2 + 4, value)
            # Label
            c.setFont('Helvetica', 8)
            c.setFillColor(colors.HexColor('#ffffffCC'))
            c.drawString(x + 38, y + self.height / 2 - 10, label)


class DBSchema(Flowable):
    """Database schema diagram — 2x2 grid so all 4 tables are fully visible."""
    def __init__(self):
        Flowable.__init__(self)
        self.width  = PAGE_W - 80
        self.height = 300

    def wrap(self, aw, ah):
        return (self.width, self.height)

    def _table_box(self, c, x, y, name, fields, color=BLUE_DARK, bw=240):
        row_h = 14
        total_h = 22 + len(fields) * row_h + 4
        # Header
        c.setFillColor(color)
        c.roundRect(x, y + total_h - 22, bw, 22, 4, fill=1, stroke=0)
        c.rect(x, y + total_h - 22, bw, 11, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 9)
        c.drawCentredString(x + bw / 2, y + total_h - 13, name)
        # Body
        c.setFillColor(colors.HexColor('#F7FAFF'))
        c.rect(x, y, bw, total_h - 22, fill=1, stroke=0)
        c.setStrokeColor(GRAY_LINE)
        c.setLineWidth(0.5)
        c.roundRect(x, y, bw, total_h, 4, fill=0, stroke=1)
        # Fields
        for j, (fname, ftype, is_pk) in enumerate(fields):
            fy = y + total_h - 22 - (j + 1) * row_h
            if j % 2 == 0:
                c.setFillColor(colors.HexColor('#EEF4FF'))
                c.rect(x + 1, fy, bw - 2, row_h, fill=1, stroke=0)
            c.setFillColor(BLUE_MID if is_pk else GRAY_DARK)
            c.setFont('Helvetica-Bold' if is_pk else 'Helvetica', 7)
            c.drawString(x + 6, fy + 4, ('[PK] ' if is_pk else '     ') + fname)
            c.setFillColor(GRAY_MID)
            c.setFont('Helvetica', 7)
            c.drawRightString(x + bw - 5, fy + 4, ftype)

    def draw(self):
        c = self.canv
        W = self.width
        H = self.height

        c.setFillColor(colors.HexColor('#F0F4FB'))
        c.roundRect(0, 0, W, H, 8, fill=1, stroke=0)
        c.setStrokeColor(GRAY_LINE)
        c.roundRect(0, 0, W, H, 8, fill=0, stroke=1)

        # Title band
        c.setFillColor(NAVY)
        c.roundRect(0, H - 26, W, 26, 8, fill=1, stroke=0)
        c.rect(0, H - 26, W, 13, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 9)
        c.drawCentredString(W / 2, H - 16, 'SCHEMA DE LA BASE DE DONNEES — SQLITE')

        # ── 2x2 grid layout ──────────────────────────────────────────────────
        gap = 14
        tw  = (W - 3 * gap) / 2   # table width  ≈ 244 pts for W≈515

        # users: 5 fields  → total_h = 22 + 5*14 + 4 = 96
        # clients: 4 fields → total_h = 22 + 4*14 + 4 = 82
        # brand_systems: 6 fields → total_h = 22 + 6*14 + 4 = 110
        # analyses: 5 fields → total_h = 22 + 5*14 + 4 = 96

        row1_y = 162   # top row y-origin   (H - 26 title - gap - tallest_row≈110)
        row2_y = 30    # bottom row y-origin
        col1_x = gap
        col2_x = gap + tw + gap

        tables = [
            # Top row
            ('users', [
                ('id',              'INTEGER PK', True),
                ('email',           'TEXT',       False),
                ('hashed_password', 'TEXT',       False),
                ('role',            'TEXT',       False),
                ('created_at',      'DATETIME',   False),
            ], BLUE_DARK, col1_x, row1_y),
            ('clients', [
                ('id',           'INTEGER PK', True),
                ('company_name', 'TEXT',       False),
                ('sector',       'TEXT',       False),
                ('created_at',   'DATETIME',   False),
            ], colors.HexColor('#1A6E4A'), col2_x, row1_y),
            # Bottom row
            ('brand_systems', [
                ('id',               'INTEGER PK',     True),
                ('client_id',        'FK -> clients',  False),
                ('brand_name',       'TEXT',           False),
                ('version',          'INTEGER',        False),
                ('is_active',        'BOOLEAN',        False),
                ('tone / priorities','TEXT',           False),
            ], colors.HexColor('#6E1A4A'), col1_x, row2_y),
            ('analyses', [
                ('id',              'INTEGER PK',          True),
                ('brand_system_id', 'FK -> brand_systems', False),
                ('clarity_score',   'FLOAT',               False),
                ('narrative_risk',  'TEXT',                False),
                ('analyzed_at',     'DATETIME',            False),
            ], colors.HexColor('#7E5A00'), col2_x, row2_y),
        ]

        for name, fields, color, tx, ty in tables:
            self._table_box(c, tx, ty, name, fields, color, bw=tw)

        # ── Relation lines (dashed teal) ──────────────────────────────────────
        c.setStrokeColor(ACCENT)
        c.setLineWidth(1.2)
        c.setDash(4, 2)

        # clients (top-right) → brand_systems (bottom-left)
        # Route: down from clients centre, then left, then down to brand_systems top
        cli_cx  = col2_x + tw / 2
        cli_bot = row1_y                       # bottom of clients (y-origin)
        bs_cx   = col1_x + tw / 2
        bs_top  = row2_y + 22 + 6 * 14 + 4    # top of brand_systems box
        mid_y   = (cli_bot + bs_top) / 2
        c.line(cli_cx, cli_bot, cli_cx, mid_y)
        c.line(cli_cx, mid_y,   bs_cx, mid_y)
        c.line(bs_cx,  mid_y,   bs_cx, bs_top)

        # brand_systems (right edge) → analyses (left edge), horizontal
        bs_right_x = col1_x + tw
        an_left_x  = col2_x
        mid_row2_y = row2_y + (22 + 5 * 14 + 4) / 2   # midpoint of analyses height
        c.line(bs_right_x, mid_row2_y, an_left_x, mid_row2_y)

        c.setDash()

        # Legend
        c.setFillColor(GRAY_MID)
        c.setFont('Helvetica', 7)
        c.drawString(10, 10, '[PK] = Cle primaire   FK = Cle etrangere   - - -  Relation entre tables')



# ─── STYLES ───────────────────────────────────────────────────────────────────

def build_styles():
    base = getSampleStyleSheet()
    S = {}

    S['cover_tag'] = ParagraphStyle('cover_tag',
        fontSize=9, fontName='Helvetica-Bold',
        textColor=WHITE, backColor=BLUE_MID,
        spaceBefore=0, spaceAfter=0)

    S['h1'] = ParagraphStyle('h1',
        fontSize=18, fontName='Helvetica-Bold',
        textColor=NAVY, spaceBefore=18, spaceAfter=6,
        leading=22)

    S['h2'] = ParagraphStyle('h2',
        fontSize=13, fontName='Helvetica-Bold',
        textColor=BLUE_DARK, spaceBefore=14, spaceAfter=4,
        leading=17)

    S['h3'] = ParagraphStyle('h3',
        fontSize=10.5, fontName='Helvetica-Bold',
        textColor=GRAY_DARK, spaceBefore=10, spaceAfter=3)

    S['body'] = ParagraphStyle('body',
        fontSize=9.5, fontName='Helvetica',
        textColor=GRAY_DARK, leading=15,
        spaceBefore=4, spaceAfter=4,
        alignment=TA_JUSTIFY)

    S['body_small'] = ParagraphStyle('body_small',
        fontSize=8.5, fontName='Helvetica',
        textColor=GRAY_DARK, leading=13,
        spaceBefore=3, spaceAfter=3)

    S['bullet'] = ParagraphStyle('bullet',
        fontSize=9.5, fontName='Helvetica',
        textColor=GRAY_DARK, leading=14,
        spaceBefore=2, spaceAfter=2,
        leftIndent=14, bulletIndent=4)

    S['caption'] = ParagraphStyle('caption',
        fontSize=8, fontName='Helvetica',
        textColor=GRAY_MID, alignment=TA_CENTER,
        spaceBefore=4, spaceAfter=8, leading=11)

    S['note'] = ParagraphStyle('note',
        fontSize=8.5, fontName='Helvetica',
        textColor=BLUE_DARK,
        backColor=BLUE_PALE,
        leftIndent=10, rightIndent=10,
        spaceBefore=6, spaceAfter=6,
        leading=13, borderPad=6)

    S['code'] = ParagraphStyle('code',
        fontSize=8, fontName='Courier',
        textColor=NAVY,
        backColor=colors.HexColor('#F4F6F8'),
        leftIndent=8, spaceBefore=4, spaceAfter=4,
        leading=13, borderPad=5)

    S['tbl_header'] = ParagraphStyle('tbl_header',
        fontSize=8.5, fontName='Helvetica-Bold',
        textColor=WHITE, alignment=TA_CENTER)

    S['tbl_cell'] = ParagraphStyle('tbl_cell',
        fontSize=8, fontName='Helvetica',
        textColor=GRAY_DARK, leading=12)

    S['tbl_cell_c'] = ParagraphStyle('tbl_cell_c',
        fontSize=8, fontName='Helvetica',
        textColor=GRAY_DARK, leading=12, alignment=TA_CENTER)

    S['highlight'] = ParagraphStyle('highlight',
        fontSize=9.5, fontName='Helvetica-Bold',
        textColor=NAVY, backColor=colors.HexColor('#FFFAE0'),
        leftIndent=8, spaceBefore=4, spaceAfter=4,
        leading=14, borderPad=5)

    return S


# ─── TABLE HELPERS ────────────────────────────────────────────────────────────

def styled_table(header, rows, S, col_widths=None, col_colors=None):
    hdr = [Paragraph(h, S['tbl_header']) for h in header]
    data = [hdr]
    for row in rows:
        data.append([Paragraph(str(c), S['tbl_cell']) for c in row])

    if col_widths is None:
        n   = len(header)
        cw  = (PAGE_W - 80) / n
        col_widths = [cw] * n

    style = TableStyle([
        ('BACKGROUND',  (0,0), (-1, 0), NAVY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, BLUE_PALE]),
        ('GRID',        (0,0), (-1, -1), 0.4, GRAY_LINE),
        ('TOPPADDING',  (0,0), (-1, -1), 5),
        ('BOTTOMPADDING', (0,0), (-1, -1), 5),
        ('LEFTPADDING', (0,0), (-1, -1), 7),
        ('RIGHTPADDING', (0,0), (-1, -1), 7),
        ('VALIGN',      (0,0), (-1, -1), 'MIDDLE'),
        ('ROUNDEDCORNERS', [4]),
    ])

    if col_colors:
        for ci, col in enumerate(col_colors):
            if col:
                style.add('BACKGROUND', (ci, 0), (ci, 0), col)

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(style)
    return t


def score_table(S):
    """5 dimensions evaluation table with visual bars."""
    dims = [
        ('Clarté linguistique',        'Évalue la lisibilité, la précision lexicale et l\'absence d\'ambiguïté syntaxique du message.'),
        ('Alignement stratégique',      'Mesure la cohérence entre le message et le positionnement, la mission et les priorités de la marque.'),
        ('Focus',                        'Détermine la concentration du propos : un seul message central, sans dilution ni surcharge informationnelle.'),
        ('Ton',                          'Évalue la conformité du registre émotionnel et stylistique avec les directives tonales du Brand System.'),
        ('Contribution narrative',       'Apprécie la contribution du message à l\'histoire globale de la marque et à sa cohérence temporelle.'),
    ]
    hdr = ['Dimension', 'Description', 'Pondération']
    rows = []
    weights = ['20 pts', '20 pts', '20 pts', '20 pts', '20 pts']
    for (name, desc), w in zip(dims, weights):
        rows.append([f'<b>{name}</b>', desc, w])
    return styled_table(hdr, rows, S,
        col_widths=[110, 250, 55],
        col_colors=[BLUE_DARK, None, ACCENT])


def tech_table_backend(S):
    rows = [
        ['FastAPI 0.136', 'Framework API REST, validation Pydantic, cycle de vie async.'],
        ['Uvicorn 0.46',  'Serveur ASGI asynchrone, exécution du processus FastAPI.'],
        ['SQLAlchemy 2.0','ORM — mapping objet-relationnel, requêtes via sessions.'],
        ['Alembic 1.18',  'Gestion versionnée des migrations de schéma BDD.'],
        ['SQLite',         'Base de données relationnelle embarquée (fichier clarity.db).'],
        ['python-jose',    'Génération et vérification des tokens JWT.'],
        ['bcrypt / passlib','Hachage sécurisé unidirectionnel des mots de passe.'],
        ['Groq SDK 1.2',  'Client Python officiel pour l\'API Groq (LLM Llama 3.3-70b).'],
        ['Celery 5.6',    'File de tâches distribuées — traitement asynchrone de documents.'],
        ['Redis 7.4',     'Broker de messages pour Celery.'],
        ['pypdf 6.10',    'Extraction du contenu textuel des PDF uploadés.'],
    ]
    return styled_table(
        ['Technologie / Version', 'Rôle'], rows, S,
        col_widths=[130, 285])


def tech_table_frontend(S):
    rows = [
        ['React 19.2',         'Bibliothèque de composants pour l\'interface réactive (SPA).'],
        ['TypeScript ~6.0',    'Typage statique, sécurité à la compilation, maintenabilité.'],
        ['Vite 8.0',           'Bundler ultra-rapide avec Hot Module Replacement (HMR).'],
        ['react-router-dom 7', 'Gestion des routes côté client (navigation SPA).'],
        ['Recharts 3.8',       'Graphiques (barres, camemberts) pour scores et statistiques.'],
        ['Tailwind CSS 4.2',   'Classes utilitaires CSS en complément du design system.'],
        ['Lora + DM Sans',     'Typographie éditoriale : titres (Lora) + corps (DM Sans).'],
        ['Fetch API (natif)',  'Requêtes HTTP vers le backend avec token JWT en header.'],
    ]
    return styled_table(
        ['Technologie / Version', 'Rôle'], rows, S,
        col_widths=[130, 285])


def scope_table(S):
    in_scope = [
        ['Authentification',         'Inscription, connexion, JWT, déconnexion.'],
        ['Gestion Brand Systems',    'Création, édition versionnée, désactivation logique.'],
        ['Moteur IA',                'Appel Groq, parsing JSON, retry ×3, normalisation des scores.'],
        ['5 dimensions d\'évaluation','Clarté, Alignement, Focus, Ton, Contribution narrative.'],
        ['Réécriture assistée',      'Génération version améliorée + liste des modifications.'],
        ['Tableau de bord',          'KPIs globaux, distribution des risques, analyses récentes.'],
        ['Historique',               'Filtrage par risque, canal, période de dates.'],
        ['Panel Admin',              'Vue globale clients, Brand Systems, toutes analyses.'],
        ['Import documents',         'Upload → Celery async → consultation du statut.'],
        ['Multi-langue',             'FR, EN, ES, DE, AR, PT.'],
    ]
    return styled_table(
        ['Fonctionnalité', 'Description'], in_scope, S,
        col_widths=[145, 270])


def out_of_scope_table(S):
    rows = [
        ['Génération ex nihilo',    'Clarity Engine améliore ; il ne génère pas depuis un brief vide.'],
        ['Réseaux sociaux',         'Aucun connecteur LinkedIn, Twitter ou autre prévu.'],
        ['Analyse visuelle',        'Le moteur traite uniquement du texte.'],
        ['Déploiement cloud',       'Opéré localement ; AWS/GCP/Azure hors périmètre.'],
        ['Fine-tuning LLM',         'Llama 3.3 utilisé tel quel via l\'API Groq.'],
        ['Facturation',             'L\'aspect commercial et monétisation est hors périmètre.'],
        ['Application mobile',      'Interface web uniquement ; pas d\'app iOS/Android native.'],
    ]
    ts = TableStyle([
        ('BACKGROUND',  (0, 0), (-1, 0), RED_RISK),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1),
         [WHITE, colors.HexColor('#FFF5F5')]),
        ('GRID',        (0,0), (-1, -1), 0.4, GRAY_LINE),
        ('TOPPADDING',  (0,0), (-1, -1), 5),
        ('BOTTOMPADDING', (0,0), (-1, -1), 5),
        ('LEFTPADDING', (0,0), (-1, -1), 7),
        ('RIGHTPADDING', (0,0), (-1, -1), 7),
        ('VALIGN',      (0,0), (-1, -1), 'MIDDLE'),
    ])
    hdr = [Paragraph(h, S['tbl_header'])
           for h in ['Fonctionnalité', 'Justification']]
    data = [hdr] + [[Paragraph(c, S['tbl_cell']) for c in r] for r in rows]
    t = Table(data, colWidths=[145, 270], repeatRows=1)
    t.setStyle(ts)
    return t


def flow_table(S):
    """Main analysis flow."""
    steps = [
        ('1', 'Saisie utilisateur', 'L\'utilisateur sélectionne un Brand System et saisit son message dans l\'interface React.'),
        ('2', 'Requête HTTP', 'Le frontend envoie POST /api/analyze avec le token JWT en header Authorization.'),
        ('3', 'Récupération BDD', 'Le backend charge le Brand System depuis SQLite via SQLAlchemy.'),
        ('4', 'Construction du prompt', 'Assemblage du prompt structuré : directives Brand System + message à analyser.'),
        ('5', 'Appel LLM', 'Appel à l\'API Groq (Llama 3.3-70b, temperature=0, seed=0) → réponse JSON.'),
        ('6', 'Parsing & validation', 'Parsing JSON, validation Pydantic, 3 tentatives max, normalisation des scores (0–100).'),
        ('7', 'Persistance', 'Sauvegarde de l\'analyse complète en base de données SQLite.'),
        ('8', 'Affichage résultats', 'Le frontend reçoit l\'identifiant, redirige vers la page de résultats détaillés.'),
    ]
    style_n = ParagraphStyle('step_num',
        fontSize=11, fontName='Helvetica-Bold',
        textColor=WHITE, alignment=TA_CENTER)

    header = [Paragraph(h, S['tbl_header'])
              for h in ['#', 'Étape', 'Description']]
    data   = [header]
    for num, step, desc in steps:
        data.append([
            Paragraph(f'<b>{num}</b>', style_n),
            Paragraph(f'<b>{step}</b>', S['tbl_cell']),
            Paragraph(desc, S['tbl_cell']),
        ])

    ts = TableStyle([
        ('BACKGROUND',  (0,0), (-1, 0), NAVY),
        ('BACKGROUND',  (0,1), (0, -1), BLUE_MID),
        ('ROWBACKGROUNDS', (1, 1), (-1, -1), [WHITE, BLUE_PALE]),
        ('GRID',        (0,0), (-1,-1), 0.4, GRAY_LINE),
        ('TOPPADDING',  (0,0), (-1,-1), 6),
        ('BOTTOMPADDING',(0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('VALIGN',      (0,0), (-1,-1), 'MIDDLE'),
    ])
    t = Table(data, colWidths=[22, 110, 283], repeatRows=1)
    t.setStyle(ts)
    return t


# ─── PAGE TEMPLATE ────────────────────────────────────────────────────────────

class PageTemplate:
    def __init__(self, doc_title='Clarity Engine — Rapport de Stage'):
        self.title = doc_title

    def on_page(self, canv, doc):
        if doc.page == 1:
            return
        p = doc.page
        w, h = PAGE_W, PAGE_H

        # Header bar
        canv.setFillColor(NAVY)
        canv.rect(0, h - 28, w, 28, fill=1, stroke=0)
        canv.setFillColor(ACCENT)
        canv.rect(0, h - 30, w, 2, fill=1, stroke=0)
        canv.setFillColor(WHITE)
        canv.setFont('Helvetica-Bold', 8)
        canv.drawString(40, h - 18, 'CLARITY ENGINE — Rapport de Stage Technique')
        canv.setFont('Helvetica', 8)
        canv.setFillColor(GRAY_LIGHT)
        canv.drawRightString(w - 40, h - 18, 'Zone Bleue  ·  Juin 2026')

        # Footer
        canv.setFillColor(NAVY)
        canv.rect(0, 0, w, 22, fill=1, stroke=0)
        canv.setFillColor(GRAY_MID)
        canv.setFont('Helvetica', 7.5)
        canv.drawString(40, 7, '© 2026 Zone Bleue — Confidentiel')
        canv.setFillColor(ACCENT)
        canv.setFont('Helvetica-Bold', 8)
        canv.drawCentredString(w / 2, 7, f'— {p} —')
        canv.setFillColor(GRAY_MID)
        canv.setFont('Helvetica', 7.5)
        canv.drawRightString(w - 40, 7, 'Clarity Engine v1.0')

        # Margin line
        canv.setStrokeColor(GRAY_LINE)
        canv.setLineWidth(0.5)
        canv.line(40, h - 38, w - 40, h - 38)


# ─── BUILD DOCUMENT ───────────────────────────────────────────────────────────

def build():
    import os
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rapport_clarity_engine.pdf')
    tmpl = PageTemplate()

    doc = SimpleDocTemplate(
        out,
        pagesize       = A4,
        leftMargin     = 40,
        rightMargin    = 40,
        topMargin      = 45,
        bottomMargin   = 32,
        title          = 'Rapport de Stage — Clarity Engine',
        author         = 'Zone Bleue',
        subject        = 'Livrables Techniques — SaaS Gouvernance de Marque',
    )

    S     = build_styles()
    story = []

    # ── COVER is drawn via onFirstPage callback (bypasses frame margin limits)
    story.append(PageBreak())  # first page is the cover — jump to page 2 for content

    # ── TABLE OF CONTENTS (manual) ────────────────────────────────────────────
    story.append(SectionDivider('', 'TABLE DES MATIÈRES', '', GRAY_DARK))
    story.append(Spacer(1, 10))

    toc_entries = [
        ('1.', 'Présentation générale du projet',          '3'),
        ('2.', 'Objectifs du projet',                       '3'),
        ('   2.1', 'Objectif principal',                    '3'),
        ('   2.2', 'Objectifs fonctionnels',                '3'),
        ('   2.3', 'Objectifs techniques',                  '4'),
        ('3.', 'Périmètre du projet (Scope)',               '4'),
        ('   3.1', 'Fonctionnalités dans le périmètre',    '4'),
        ('   3.2', 'Fonctionnalités hors périmètre',       '5'),
        ('4.', 'Architecture applicative',                  '5'),
        ('   4.1', 'Modèle client-serveur 3 niveaux',      '5'),
        ('   4.2', 'Flux principal d\'une analyse',        '6'),
        ('5.', 'Technologies utilisées',                    '6'),
        ('   5.1', 'Backend (Python / FastAPI)',            '6'),
        ('   5.2', 'Frontend (React / TypeScript)',        '7'),
        ('   5.3', 'Infrastructure & outils de dev.',      '7'),
        ('6.', 'Schéma de la base de données',             '8'),
        ('7.', 'Moteur d\'évaluation IA',                  '8'),
        ('8.', 'Sécurité et déterminisme',                  '9'),
    ]

    toc_style_main = ParagraphStyle('toc_main',
        fontSize=9.5, fontName='Helvetica-Bold',
        textColor=NAVY, leading=16, leftIndent=0)
    toc_style_sub  = ParagraphStyle('toc_sub',
        fontSize=8.5, fontName='Helvetica',
        textColor=GRAY_DARK, leading=14, leftIndent=16)

    for num, title, page in toc_entries:
        is_main = not num.startswith('   ')
        st = toc_style_main if is_main else toc_style_sub
        dots = '.' * max(2, 65 - len(num) - len(title))
        entry = Paragraph(f'{num}  {title} <font color="#9aaabb">{dots}</font> <b>{page}</b>', st)
        story.append(entry)
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width='100%', thickness=0.5, color=GRAY_LINE))
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────────────────
    # SECTION 1 — PRÉSENTATION GÉNÉRALE
    # ─────────────────────────────────────────────────────────────────────────
    story.append(SectionDivider('1', 'PRÉSENTATION GÉNÉRALE',
        'Vue d\'ensemble de la plateforme et de son contexte'))
    story.append(Spacer(1, 8))

    story.append(Paragraph('Contexte & Enjeux', S['h2']))
    story.append(Paragraph(
        '<b>Clarity Engine</b> est une plateforme SaaS de <b>gouvernance de marque</b> '
        'développée lors d\'un stage au sein de <b>Zone Bleue</b>, agence de communication '
        'stratégique. La plateforme permet d\'évaluer automatiquement des messages de '
        'communication — communiqués de presse, publications LinkedIn, e-mails institutionnels, '
        'discours — en les confrontant à un référentiel structuré appelé <b>Brand System</b>.',
        S['body']))
    story.append(Spacer(1, 6))

    story.append(KPIRow([
        ('⚙', 'SaaS', 'Modèle de livraison', BLUE_MID),
        ('📊', '5 dims', 'Dimensions d\'évaluation', BLUE_DARK),
        ('🌐', '6 langues', 'Couverture multilingue', colors.HexColor('#1A6E4A')),
        ('🔒', 'JWT', 'Authentification sécurisée', colors.HexColor('#6E1A4A')),
    ]))
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        'Contrairement à un chatbot ou générateur de contenu générique, Clarity Engine est '
        'un <b>moteur d\'évaluation de précision</b> : chaque analyse produit un score chiffré '
        '(/100), cinq sous-scores dimensionnels, un niveau de risque narratif '
        '(<i>faible / modéré / élevé</i>), ainsi que des recommandations d\'amélioration '
        'ancrées dans les lignes éditoriales propres à chaque marque.',
        S['body']))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        '<b>Note :</b> La plateforme ne génère pas de communication ex nihilo. '
        'Elle évalue et améliore des messages existants dans le respect strict '
        'du Brand System associé.',
        S['note']))

    # ─────────────────────────────────────────────────────────────────────────
    # SECTION 2 — OBJECTIFS
    # ─────────────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 10))
    story.append(SectionDivider('2', 'OBJECTIFS DU PROJET',
        'Objectif principal, fonctionnels et techniques'))
    story.append(Spacer(1, 8))

    story.append(Paragraph('2.1  Objectif principal', S['h2']))
    story.append(Paragraph(
        'Automatiser et <b>objectiver l\'évaluation de la cohérence de marque</b> dans '
        'les productions écrites, en remplaçant une revue manuelle subjective par une '
        'analyse structurée, reproductible et entièrement documentée.',
        S['body']))

    story.append(Paragraph('2.2  Objectifs fonctionnels', S['h2']))
    obj_rows = [
        ['O1', 'Évaluation automatisée',         'Analyser tout message contre un Brand System → score /100 + 5 sous-scores.'],
        ['O2', 'Gestion des Brand Systems',       'Création, édition versionnée et consultation de référentiels multi-clients.'],
        ['O3', 'Réécriture assistée',             'Version améliorée du message + liste des corrections effectuées.'],
        ['O4', 'Historique & reporting',          'Conservation de toutes les analyses + statistiques agrégées.'],
        ['O5', 'Multi-utilisateurs & multi-rôles','Distinction admins (accès global) / clients (périmètre restreint).'],
        ['O6', 'Import de documents',             'Upload PDF/texte → pipeline Celery async → consultation du statut.'],
    ]
    story.append(styled_table(
        ['#', 'Objectif', 'Description'], obj_rows, S,
        col_widths=[22, 120, 273]))

    story.append(Paragraph('2.3  Objectifs techniques', S['h2']))
    tech_goals = [
        'Architecture découplée (frontend / backend / BDD / IA externe) pour l\'évolutivité.',
        'Évaluations <b>déterministes et reproductibles</b> : temperature=0, seed=0 sur tous les appels LLM.',
        'Authentification JWT sécurisant l\'intégralité des routes sensibles.',
        'API REST documentée et consommable par n\'importe quel client HTTP.',
    ]
    for g in tech_goals:
        story.append(Paragraph(f'▸  {g}', S['bullet']))

    # ─────────────────────────────────────────────────────────────────────────
    # SECTION 3 — PÉRIMÈTRE
    # ─────────────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(SectionDivider('3', 'PÉRIMÈTRE DU PROJET',
        'In-Scope & Out-of-Scope'))
    story.append(Spacer(1, 8))

    story.append(Paragraph('3.1  Fonctionnalités dans le périmètre (In-Scope)', S['h2']))
    story.append(scope_table(S))

    story.append(Spacer(1, 10))
    story.append(Paragraph('3.2  Fonctionnalités hors périmètre (Out-of-Scope)', S['h2']))
    story.append(out_of_scope_table(S))

    # ─────────────────────────────────────────────────────────────────────────
    # SECTION 4 — ARCHITECTURE
    # ─────────────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(SectionDivider('4', 'ARCHITECTURE APPLICATIVE',
        'Modèle client-serveur 3 niveaux & flux d\'analyse'))
    story.append(Spacer(1, 8))

    story.append(Paragraph('4.1  Modèle client-serveur à 3 niveaux', S['h2']))
    story.append(Paragraph(
        'L\'architecture suit un modèle <b>client-serveur à 3 niveaux</b> strictement découplés. '
        'Le frontend React (SPA) communique exclusivement avec le backend FastAPI via '
        'une API REST sécurisée par JWT. Le backend orchestre deux dépendances principales : '
        'la base de données SQLite pour la persistance, et l\'API Groq pour l\'intelligence '
        'artificielle. Un composant optionnel Celery + Redis gère les traitements asynchrones '
        '(import de documents volumineux).',
        S['body']))
    story.append(Spacer(1, 6))
    story.append(ArchitectureDiagram())
    story.append(Paragraph(
        'Figure 1 — Diagramme d\'architecture applicative de Clarity Engine. '
        'Les traits pleins représentent les flux synchrones (REST/HTTP) ; '
        'les tirets représentent les flux asynchrones (Celery/Redis).',
        S['caption']))

    story.append(Paragraph('4.2  Flux principal d\'une analyse', S['h2']))
    story.append(flow_table(S))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        'Tableau 2 — Flux séquentiel d\'une analyse de message via Clarity Engine.',
        S['caption']))

    # ─────────────────────────────────────────────────────────────────────────
    # SECTION 5 — TECHNOLOGIES
    # ─────────────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(SectionDivider('5', 'TECHNOLOGIES UTILISÉES',
        'Stack complète Backend, Frontend & Infrastructure'))
    story.append(Spacer(1, 8))

    story.append(Paragraph('5.1  Backend — Python / FastAPI', S['h2']))
    story.append(tech_table_backend(S))

    story.append(Spacer(1, 10))
    story.append(Paragraph('5.2  Frontend — React / TypeScript', S['h2']))
    story.append(tech_table_frontend(S))

    story.append(Spacer(1, 10))
    story.append(Paragraph('5.3  Infrastructure & outils de développement', S['h2']))
    infra_rows = [
        ['Git',             'Versioning du code source, gestion des branches de développement.'],
        ['Fichier .env',    'Stockage des secrets : clé API Groq, clé secrète JWT, URL BDD.'],
        ['venv (Python)',   'Isolation des dépendances Python du projet.'],
        ['npm',             'Gestion des dépendances JavaScript du frontend.'],
        ['Local / Windows + macOS', 'Environnement cible de développement et de tests.'],
    ]
    story.append(styled_table(
        ['Outil', 'Rôle'], infra_rows, S,
        col_widths=[145, 270]))

    story.append(Spacer(1, 10))
    story.append(Paragraph('5.4  API externe', S['h2']))
    ext_rows = [
        ['Groq API (cloud)',         'Service d\'inférence LLM haute performance. Reçoit un prompt structuré (Brand System + message) et retourne une évaluation JSON.'],
        ['Llama 3.3-70b-versatile', 'LLM open source de Meta, 70 milliards de paramètres. temperature=0, seed=0 pour garantir le déterminisme des sorties.'],
    ]
    story.append(styled_table(
        ['Service', 'Description'], ext_rows, S,
        col_widths=[145, 270]))

    # ─────────────────────────────────────────────────────────────────────────
    # SECTION 6 — BASE DE DONNÉES
    # ─────────────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(SectionDivider('6', 'SCHÉMA DE LA BASE DE DONNÉES',
        'Structure relationnelle SQLite — 4 tables principales'))
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        'La base de données SQLite comprend <b>4 tables principales</b> liées par des '
        'clés étrangères. La table <i>brand_systems</i> est versionnée : chaque modification '
        'incrémente le champ <code>version</code> sans effacer l\'historique.',
        S['body']))
    story.append(Spacer(1, 6))
    story.append(DBSchema())
    story.append(Paragraph(
        'Figure 2 — Schéma de la base de données SQLite de Clarity Engine '
        '(relations simplifiées — clés primaires en bleu, clés étrangères en tirets teal).',
        S['caption']))

    story.append(Spacer(1, 4))
    db_rows = [
        ['users',         'id, email, hashed_password, role, created_at',
         'Comptes utilisateurs (admin / client).'],
        ['clients',       'id, company_name, sector, created_at',
         'Organisations clientes associées aux Brand Systems.'],
        ['brand_systems', 'id, client_id, brand_name, version, is_active, tone, …',
         'Référentiels de marque complets, versionnés.'],
        ['analyses',      'id, brand_system_id, clarity_score, narrative_risk, analyzed_at, …',
         'Résultats complets de chaque analyse IA.'],
    ]
    story.append(styled_table(
        ['Table', 'Colonnes clés', 'Description'], db_rows, S,
        col_widths=[80, 180, 155]))

    # ─────────────────────────────────────────────────────────────────────────
    # SECTION 7 — MOTEUR IA
    # ─────────────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(SectionDivider('7', 'MOTEUR D\'ÉVALUATION IA',
        'Dimensions, scoring et mécanism de retry'))
    story.append(Spacer(1, 8))

    story.append(Paragraph('Les 5 dimensions d\'évaluation', S['h2']))
    story.append(Paragraph(
        'Chaque message est évalué selon <b>5 dimensions indépendantes</b>, chacune notée '
        'sur 20 points, pour un total de <b>100 points (Clarity Score)</b>. '
        'Un niveau de risque narratif — <i>faible</i>, <i>modéré</i> ou <i>élevé</i> — '
        'est également calculé en fonction du score global et des faiblesses identifiées.',
        S['body']))
    story.append(Spacer(1, 6))
    story.append(score_table(S))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        'Tableau 5 — Les 5 dimensions d\'évaluation du moteur Clarity Engine.',
        S['caption']))

    story.append(Paragraph('Mécanisme de robustesse (retry)', S['h2']))
    retry_items = [
        '<b>Tentative 1</b> : appel à l\'API Groq avec le prompt complet.',
        '<b>Tentative 2</b> (si erreur de parsing) : reformulation du prompt avec instructions JSON renforcées.',
        '<b>Tentative 3</b> (si nouvelle erreur) : dernier appel avec schéma JSON explicite en exemple.',
        '<b>Échec définitif</b> : l\'analyse est marquée comme échouée et une erreur métier est remontée.',
    ]
    for item in retry_items:
        story.append(Paragraph(f'▸  {item}', S['bullet']))

    story.append(Spacer(1, 6))
    story.append(Paragraph(
        'Après réception d\'une réponse valide, les scores sont <b>normalisés</b> '
        '(clamping entre 0 et 20 par dimension, 0 et 100 globalement) par une '
        'fonction dédiée afin de garantir l\'intégrité des données persistées.',
        S['body']))

    story.append(Paragraph('Format de sortie JSON', S['h2']))
    story.append(Paragraph(
        'POST /api/analyze → réponse structurée :', S['body_small']))
    story.append(Paragraph(
        '{ "clarity_score": 82, "sub_clarity": 17, "sub_alignment": 16, '
        '"sub_focus": 18, "sub_tone": 15, "sub_narrative_contribution": 16, '
        '"narrative_risk": "faible", "points_forts": [...], '
        '"points_faibles": [...], "recommandations": [...], '
        '"rewritten_message": "..." }',
        S['code']))

    # ─────────────────────────────────────────────────────────────────────────
    # SECTION 8 — SÉCURITÉ
    # ─────────────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(SectionDivider('8', 'SÉCURITÉ & DÉTERMINISME',
        'Authentification JWT, hachage et reproductibilité'))
    story.append(Spacer(1, 8))

    story.append(Paragraph('Authentification JWT', S['h2']))
    jwt_items = [
        'Toutes les routes sensibles sont protégées par un middleware de vérification JWT.',
        'Les tokens sont générés côté backend (python-jose) à la connexion et transmis dans le header <code>Authorization: Bearer &lt;token&gt;</code>.',
        'Les mots de passe sont hachés avec bcrypt (via passlib) — stockage unidirectionnel, sans possibilité de déchiffrement.',
        'Séparation des rôles : <b>admin</b> (accès global) vs <b>client</b> (périmètre restreint à sa marque).',
    ]
    for item in jwt_items:
        story.append(Paragraph(f'▸  {item}', S['bullet']))

    story.append(Paragraph('Déterminisme des évaluations', S['h2']))
    story.append(Paragraph(
        'Garantir qu\'un même message soumis au même Brand System produise <b>toujours '
        'les mêmes scores</b> est une contrainte fonctionnelle fondamentale de Clarity Engine. '
        'Elle est assurée par deux paramètres fixés sur chaque appel LLM :',
        S['body']))

    det_data = [
        [Paragraph('<b>Paramètre</b>', S['tbl_header']),
         Paragraph('<b>Valeur</b>', S['tbl_header']),
         Paragraph('<b>Effet</b>', S['tbl_header'])],
        [Paragraph('temperature', S['tbl_cell']),
         Paragraph('<b>0</b>', S['tbl_cell']),
         Paragraph('Supprime toute composante aléatoire dans la génération de tokens.', S['tbl_cell'])],
        [Paragraph('seed', S['tbl_cell']),
         Paragraph('<b>0</b>', S['tbl_cell']),
         Paragraph('Initialise le générateur pseudo-aléatoire à une valeur fixe.', S['tbl_cell'])],
    ]
    det_ts = TableStyle([
        ('BACKGROUND', (0,0), (-1, 0), NAVY),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, BLUE_PALE]),
        ('GRID', (0,0), (-1,-1), 0.4, GRAY_LINE),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ])
    det_t = Table(det_data, colWidths=[100, 60, 255])
    det_t.setStyle(det_ts)
    story.append(det_t)
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        'Cette contrainte de déterminisme permet notamment de réaliser des <i>audits de '
        'cohérence</i> sur des corpus de messages historiques sans que les résultats '
        'soient influencés par la variabilité intrinsèque du modèle LLM.',
        S['body']))


    # ── BUILD ────────────────────────────────────────────────────────────────
    def on_first_page(canv, doc):
        draw_cover(canv)  # draw cover art on raw canvas (no margin constraints)

    doc.build(
        story,
        onFirstPage = on_first_page,
        onLaterPages= tmpl.on_page,
    )
    print('[OK] PDF genere : ' + out)
    return out


if __name__ == '__main__':
    build()
