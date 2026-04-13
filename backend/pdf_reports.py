"""
PDF Report Generation Module for SecFind
Generates executive reports with charts and tables
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.barcharts import VerticalBarChart
from io import BytesIO
from datetime import datetime, timezone
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt


def create_pie_chart_image(data: dict, title: str, width: int = 300, height: int = 200) -> BytesIO:
    """Create a pie chart and return as BytesIO image"""
    fig, ax = plt.subplots(figsize=(width/100, height/100), dpi=100)
    
    labels = list(data.keys())
    values = list(data.values())
    
    # Filter out zero values
    filtered = [(l, v) for l, v in zip(labels, values) if v > 0]
    if not filtered:
        filtered = [("Sin datos", 1)]
    labels, values = zip(*filtered)
    
    # Colors for severity
    color_map = {
        "Critica": "#ef4444",
        "Alta": "#f97316", 
        "Media": "#eab308",
        "Baja": "#22c55e",
        "Pendiente": "#f97316",
        "En Proceso": "#3b82f6",
        "Corregido": "#22c55e",
        "Cerrado": "#6b7280",
        "Para Re Test": "#8b5cf6",
        "Desestimado": "#64748b",
    }
    
    chart_colors = [color_map.get(l, "#6b7280") for l in labels]
    
    wedges, texts, autotexts = ax.pie(
        values, 
        labels=labels, 
        autopct='%1.0f%%',
        colors=chart_colors,
        startangle=90
    )
    
    ax.set_title(title, fontsize=10, fontweight='bold')
    
    plt.tight_layout()
    
    buf = BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', facecolor='white')
    plt.close(fig)
    buf.seek(0)
    return buf


def create_bar_chart_image(data: dict, title: str, width: int = 400, height: int = 200) -> BytesIO:
    """Create a bar chart and return as BytesIO image"""
    fig, ax = plt.subplots(figsize=(width/100, height/100), dpi=100)
    
    labels = list(data.keys())
    values = list(data.values())
    
    # Truncate long labels
    labels = [l[:20] + "..." if len(l) > 20 else l for l in labels]
    
    bars = ax.bar(labels, values, color='#6366f1')
    ax.set_title(title, fontsize=10, fontweight='bold')
    ax.set_ylabel('Cantidad')
    
    # Rotate labels if too many
    if len(labels) > 5:
        plt.xticks(rotation=45, ha='right')
    
    # Add value labels on bars
    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5, 
                str(val), ha='center', va='bottom', fontsize=8)
    
    plt.tight_layout()
    
    buf = BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', facecolor='white')
    plt.close(fig)
    buf.seek(0)
    return buf


def generate_executive_report(
    stats: dict,
    por_severidad: dict,
    por_estatus: dict,
    por_institucion: dict,
    filtros: dict = None
) -> BytesIO:
    """Generate executive PDF report with KPIs and charts"""
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=20,
        alignment=TA_CENTER,
        spaceAfter=20,
        textColor=colors.HexColor('#1e293b')
    )
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Heading2'],
        fontSize=14,
        alignment=TA_LEFT,
        spaceBefore=15,
        spaceAfter=10,
        textColor=colors.HexColor('#334155')
    )
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#475569')
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph("SecFind - Reporte Ejecutivo", title_style))
    elements.append(Paragraph(
        f"Generado: {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M UTC')}",
        normal_style
    ))
    
    # Filters applied
    if filtros:
        filtro_text = "Filtros aplicados: "
        filtro_parts = []
        if filtros.get("año"):
            filtro_parts.append(f"Año: {filtros['año']}")
        if filtros.get("institucion"):
            filtro_parts.append(f"Institución: {filtros['institucion']}")
        if filtros.get("informe_pentest"):
            filtro_parts.append(f"Informe: {filtros['informe_pentest']}")
        if filtro_parts:
            elements.append(Paragraph(filtro_text + ", ".join(filtro_parts), normal_style))
    
    elements.append(Spacer(1, 20))
    
    # KPI Summary Table
    elements.append(Paragraph("Resumen de KPIs", subtitle_style))
    
    kpi_data = [
        ["Total Vulnerabilidades", str(stats.get("total_vulnerabilidades", 0))],
        ["Críticas Abiertas", str(stats.get("criticas_abiertas", 0))],
        ["Corregidas", str(stats.get("vulnerabilidades_corregidas", 0))],
        ["Pendientes", str(stats.get("pendientes", 0))],
        ["En Proceso", str(stats.get("en_proceso", 0))],
        ["Para Re Test", str(stats.get("para_retest", 0))],
    ]
    
    kpi_table = Table(kpi_data, colWidths=[3*inch, 1.5*inch])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1e293b')),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 30))
    
    # Charts
    elements.append(Paragraph("Distribución por Severidad", subtitle_style))
    if por_severidad and any(v > 0 for v in por_severidad.values()):
        sev_chart = create_pie_chart_image(por_severidad, "")
        elements.append(Image(sev_chart, width=3.5*inch, height=2.5*inch))
    else:
        elements.append(Paragraph("Sin datos de severidad", normal_style))
    
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("Distribución por Estatus", subtitle_style))
    if por_estatus and any(v > 0 for v in por_estatus.values()):
        status_chart = create_pie_chart_image(por_estatus, "")
        elements.append(Image(status_chart, width=3.5*inch, height=2.5*inch))
    else:
        elements.append(Paragraph("Sin datos de estatus", normal_style))
    
    elements.append(PageBreak())
    
    elements.append(Paragraph("Distribución por Institución", subtitle_style))
    if por_institucion and any(v > 0 for v in por_institucion.values()):
        # Take top 10 institutions
        sorted_inst = dict(sorted(por_institucion.items(), key=lambda x: x[1], reverse=True)[:10])
        inst_chart = create_bar_chart_image(sorted_inst, "")
        elements.append(Image(inst_chart, width=5*inch, height=2.5*inch))
    else:
        elements.append(Paragraph("Sin datos por institución", normal_style))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_institution_report(
    institucion: str,
    vulnerabilidades: list,
    stats: dict
) -> BytesIO:
    """Generate PDF report for a specific institution"""
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        alignment=TA_CENTER,
        spaceAfter=20,
        textColor=colors.HexColor('#1e293b')
    )
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Heading2'],
        fontSize=12,
        alignment=TA_LEFT,
        spaceBefore=15,
        spaceAfter=10,
        textColor=colors.HexColor('#334155')
    )
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#475569')
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph(f"Reporte de Vulnerabilidades", title_style))
    elements.append(Paragraph(f"Institución: {institucion}", subtitle_style))
    elements.append(Paragraph(
        f"Generado: {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M UTC')}",
        normal_style
    ))
    elements.append(Spacer(1, 20))
    
    # Summary
    elements.append(Paragraph("Resumen", subtitle_style))
    summary_data = [
        ["Total", str(len(vulnerabilidades))],
        ["Críticas", str(stats.get("criticas", 0))],
        ["Altas", str(stats.get("altas", 0))],
        ["Medias", str(stats.get("medias", 0))],
        ["Bajas", str(stats.get("bajas", 0))],
        ["Pendientes", str(stats.get("pendientes", 0))],
        ["Corregidas", str(stats.get("corregidas", 0))],
    ]
    
    summary_table = Table(summary_data, colWidths=[2*inch, 1*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1e293b')),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 20))
    
    # Vulnerabilities table
    elements.append(Paragraph("Detalle de Vulnerabilidades", subtitle_style))
    
    # Table header
    table_data = [["#", "Vulnerabilidad", "Severidad", "Estatus", "Fecha"]]
    
    for i, vuln in enumerate(vulnerabilidades[:50], 1):  # Limit to 50
        nombre = vuln.get("vulnerabilidad", "")[:40]
        if len(vuln.get("vulnerabilidad", "")) > 40:
            nombre += "..."
        table_data.append([
            str(i),
            nombre,
            vuln.get("severidad", "-"),
            vuln.get("estatus", "-"),
            vuln.get("fecha_hallazgo", "-")[:10] if vuln.get("fecha_hallazgo") else "-"
        ])
    
    vuln_table = Table(table_data, colWidths=[0.4*inch, 3*inch, 0.8*inch, 0.9*inch, 0.8*inch])
    
    # Color by severity
    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (1, 1), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
    ]
    
    # Apply row colors based on severity
    for i, row in enumerate(table_data[1:], 1):
        sev = row[2]
        if sev == "Critica":
            table_style.append(('BACKGROUND', (2, i), (2, i), colors.HexColor('#fee2e2')))
            table_style.append(('TEXTCOLOR', (2, i), (2, i), colors.HexColor('#dc2626')))
        elif sev == "Alta":
            table_style.append(('BACKGROUND', (2, i), (2, i), colors.HexColor('#ffedd5')))
            table_style.append(('TEXTCOLOR', (2, i), (2, i), colors.HexColor('#ea580c')))
        elif sev == "Media":
            table_style.append(('BACKGROUND', (2, i), (2, i), colors.HexColor('#fef9c3')))
            table_style.append(('TEXTCOLOR', (2, i), (2, i), colors.HexColor('#ca8a04')))
        elif sev == "Baja":
            table_style.append(('BACKGROUND', (2, i), (2, i), colors.HexColor('#dcfce7')))
            table_style.append(('TEXTCOLOR', (2, i), (2, i), colors.HexColor('#16a34a')))
    
    vuln_table.setStyle(TableStyle(table_style))
    elements.append(vuln_table)
    
    if len(vulnerabilidades) > 50:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(f"... y {len(vulnerabilidades) - 50} vulnerabilidades más", normal_style))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_vista_comite_report(data: list, filtros: dict = None) -> BytesIO:
    """Generate Vista Comité report in PDF format"""
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1*cm, leftMargin=0.5*cm, rightMargin=0.5*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        alignment=TA_CENTER,
        spaceAfter=15,
        textColor=colors.HexColor('#1e293b')
    )
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#475569')
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph("Vista Comité - Resumen Ejecutivo", title_style))
    elements.append(Paragraph(
        f"Generado: {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M UTC')}",
        normal_style
    ))
    elements.append(Spacer(1, 15))
    
    # Table header
    table_data = [["Informe/Alcance", "Crítico", "Alto", "Medio", "Bajo", "Responsable", "T.Activo", "Pend/Total", "%"]]
    
    # Totals
    totals = {
        "criticas_pend": 0, "criticas_total": 0,
        "altas_pend": 0, "altas_total": 0,
        "medias_pend": 0, "medias_total": 0,
        "bajas_pend": 0, "bajas_total": 0,
        "total_pend": 0, "total_hall": 0
    }
    
    for row in data:
        informe = row.get("informe", "")[:35]
        if len(row.get("informe", "")) > 35:
            informe += "..."
        
        responsable = row.get("responsable", "-") or "-"
        if len(responsable) > 20:
            responsable = responsable[:20] + "..."
        
        tiempo = f"{row.get('tiempo_activo_meses', '-')}m" if row.get('tiempo_activo_meses') is not None else "-"
        
        pend = row.get("total_pendientes", 0)
        total = row.get("total_hallazgos", 0)
        pct = round((pend / total * 100) if total > 0 else 0)
        
        table_data.append([
            informe,
            f"{row.get('criticas_pendientes', 0)}/{row.get('criticas_total', 0)}",
            f"{row.get('altas_pendientes', 0)}/{row.get('altas_total', 0)}",
            f"{row.get('medias_pendientes', 0)}/{row.get('medias_total', 0)}",
            f"{row.get('bajas_pendientes', 0)}/{row.get('bajas_total', 0)}",
            responsable,
            tiempo,
            f"{pend}/{total}",
            f"{pct}%"
        ])
        
        # Accumulate totals
        totals["criticas_pend"] += row.get("criticas_pendientes", 0)
        totals["criticas_total"] += row.get("criticas_total", 0)
        totals["altas_pend"] += row.get("altas_pendientes", 0)
        totals["altas_total"] += row.get("altas_total", 0)
        totals["medias_pend"] += row.get("medias_pendientes", 0)
        totals["medias_total"] += row.get("medias_total", 0)
        totals["bajas_pend"] += row.get("bajas_pendientes", 0)
        totals["bajas_total"] += row.get("bajas_total", 0)
        totals["total_pend"] += pend
        totals["total_hall"] += total
    
    # Add totals row
    total_pct = round((totals["total_pend"] / totals["total_hall"] * 100) if totals["total_hall"] > 0 else 0)
    table_data.append([
        "TOTALES",
        f"{totals['criticas_pend']}/{totals['criticas_total']}",
        f"{totals['altas_pend']}/{totals['altas_total']}",
        f"{totals['medias_pend']}/{totals['medias_total']}",
        f"{totals['bajas_pend']}/{totals['bajas_total']}",
        "",
        "",
        f"{totals['total_pend']}/{totals['total_hall']}",
        f"{total_pct}%"
    ])
    
    col_widths = [2.5*inch, 0.6*inch, 0.6*inch, 0.6*inch, 0.6*inch, 1.2*inch, 0.5*inch, 0.7*inch, 0.4*inch]
    table = Table(table_data, colWidths=col_widths)
    
    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e2e8f0')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -2), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
    ]
    
    # Color severity columns header
    table_style.append(('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#dc2626')))  # Critico
    table_style.append(('BACKGROUND', (2, 0), (2, 0), colors.HexColor('#ea580c')))  # Alto
    table_style.append(('BACKGROUND', (3, 0), (3, 0), colors.HexColor('#ca8a04')))  # Medio
    table_style.append(('BACKGROUND', (4, 0), (4, 0), colors.HexColor('#16a34a')))  # Bajo
    
    table.setStyle(TableStyle(table_style))
    elements.append(table)
    
    doc.build(elements)
    buffer.seek(0)
    return buffer
