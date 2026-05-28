"""
Email notification service for vulnerability management system.
Supports Gmail SMTP and other SMTP servers.
"""
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import logging

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self, smtp_config: dict):
        """
        Initialize email service with SMTP configuration.
        
        smtp_config: {
            "servidor": "smtp.gmail.com",
            "puerto": 587,
            "email": "your@gmail.com",
            "password": "app-password",
            "usar_tls": True
        }
        """
        self.servidor = smtp_config.get("servidor", "smtp.gmail.com")
        self.puerto = smtp_config.get("puerto", 587)
        self.email = smtp_config.get("email", "")
        self.password = smtp_config.get("password", "")
        self.usar_tls = smtp_config.get("usar_tls", True)
    
    def test_connection(self) -> dict:
        """Test SMTP connection and return status."""
        try:
            if self.usar_tls:
                context = ssl.create_default_context()
                with smtplib.SMTP(self.servidor, self.puerto, timeout=10) as server:
                    server.starttls(context=context)
                    server.login(self.email, self.password)
            else:
                with smtplib.SMTP_SSL(self.servidor, self.puerto, timeout=10) as server:
                    server.login(self.email, self.password)
            
            return {"success": True, "message": "Conexión exitosa"}
        except smtplib.SMTPAuthenticationError:
            return {"success": False, "message": "Error de autenticación. Verifica el email y contraseña."}
        except smtplib.SMTPConnectError:
            return {"success": False, "message": f"No se pudo conectar a {self.servidor}:{self.puerto}"}
        except Exception as e:
            return {"success": False, "message": f"Error: {str(e)}"}
    
    def send_email(self, to_emails: List[str], subject: str, html_content: str) -> dict:
        """Send an email to one or more recipients."""
        if not self.email or not self.password:
            return {"success": False, "message": "Configuración SMTP incompleta"}
        
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"SecFind <{self.email}>"
            message["To"] = ", ".join(to_emails)
            
            html_part = MIMEText(html_content, "html")
            message.attach(html_part)
            
            if self.usar_tls:
                context = ssl.create_default_context()
                with smtplib.SMTP(self.servidor, self.puerto, timeout=30) as server:
                    server.starttls(context=context)
                    server.login(self.email, self.password)
                    server.sendmail(self.email, to_emails, message.as_string())
            else:
                with smtplib.SMTP_SSL(self.servidor, self.puerto, timeout=30) as server:
                    server.login(self.email, self.password)
                    server.sendmail(self.email, to_emails, message.as_string())
            
            return {"success": True, "message": f"Email enviado a {len(to_emails)} destinatario(s)"}
        except Exception as e:
            logger.error(f"Error sending email: {e}")
            return {"success": False, "message": f"Error al enviar: {str(e)}"}


def generate_alert_email(vulnerabilities: List[dict], hallazgos: List[dict], days_before: int) -> str:
    """Generate HTML content for unified alert email (vulnerabilities + audit findings)."""
    severity_colors = {
        "Critica": "#ef4444",
        "Alta": "#f97316", 
        "Media": "#eab308",
        "Baja": "#22c55e"
    }
    
    riesgo_colors = {
        "high": "#ef4444",    # >= 15
        "medium": "#f97316",  # >= 8
        "low": "#eab308",     # >= 4
        "minimal": "#22c55e"  # < 4
    }
    
    def get_riesgo_color(ri):
        if ri >= 15:
            return riesgo_colors["high"]
        if ri >= 8:
            return riesgo_colors["medium"]
        if ri >= 4:
            return riesgo_colors["low"]
        return riesgo_colors["minimal"]
    
    # Generate vulnerability rows
    vuln_rows = ""
    for v in vulnerabilities:
        color = severity_colors.get(v.get("severidad", "Media"), "#6b7280")
        fecha = v.get("fecha_compromiso", "N/A")
        vuln_rows += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #27272a;">{v.get('vulnerabilidad', 'Sin nombre')[:50]}</td>
            <td style="padding: 12px; border-bottom: 1px solid #27272a;">{v.get('institucion', 'N/A')}</td>
            <td style="padding: 12px; border-bottom: 1px solid #27272a;">
                <span style="background: {color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                    {v.get('severidad', 'N/A')}
                </span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #27272a; color: #ef4444; font-weight: bold;">{fecha}</td>
            <td style="padding: 12px; border-bottom: 1px solid #27272a;">{v.get('responsable', 'Sin asignar')}</td>
        </tr>
        """
    
    vuln_section = ""
    if vulnerabilities:
        vuln_section = f"""
        <h3 style="margin: 24px 0 12px; font-size: 16px; color: #60a5fa; display: flex; align-items: center;">
            <span style="background: #3b82f6; width: 4px; height: 20px; border-radius: 2px; margin-right: 8px;"></span>
            Vulnerabilidades ({len(vulnerabilities)})
        </h3>
        <table>
            <thead>
                <tr>
                    <th>Vulnerabilidad</th>
                    <th>Institución</th>
                    <th>Severidad</th>
                    <th>Fecha Compromiso</th>
                    <th>Responsable</th>
                </tr>
            </thead>
            <tbody>
                {vuln_rows}
            </tbody>
        </table>
        """
    
    # Generate hallazgo rows
    hallazgo_rows = ""
    for h in hallazgos:
        ri = h.get("riesgo_inherente", 0)
        color = get_riesgo_color(ri)
        fecha = h.get("fecha_compromiso", "N/A")
        hallazgo_rows += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #27272a; font-family: monospace; color: #2dd4bf;">{h.get('codigo', 'N/A')}</td>
            <td style="padding: 12px; border-bottom: 1px solid #27272a;">{h.get('brecha', 'Sin descripción')[:50]}</td>
            <td style="padding: 12px; border-bottom: 1px solid #27272a;">
                <span style="background: {color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                    {ri}
                </span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #27272a; color: #ef4444; font-weight: bold;">{fecha}</td>
            <td style="padding: 12px; border-bottom: 1px solid #27272a;">{h.get('responsable', 'Sin asignar')}</td>
        </tr>
        """
    
    hallazgo_section = ""
    if hallazgos:
        hallazgo_section = f"""
        <h3 style="margin: 24px 0 12px; font-size: 16px; color: #2dd4bf; display: flex; align-items: center;">
            <span style="background: #14b8a6; width: 4px; height: 20px; border-radius: 2px; margin-right: 8px;"></span>
            Hallazgos de Auditoría ({len(hallazgos)})
        </h3>
        <table>
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Brecha</th>
                    <th>R.I.</th>
                    <th>Fecha Compromiso</th>
                    <th>Responsable</th>
                </tr>
            </thead>
            <tbody>
                {hallazgo_rows}
            </tbody>
        </table>
        """
    
    total_items = len(vulnerabilities) + len(hallazgos)
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #fafafa; margin: 0; padding: 20px; }}
            .container {{ max-width: 900px; margin: 0 auto; background: #18181b; border-radius: 12px; overflow: hidden; }}
            .header {{ background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; }}
            .header h1 {{ margin: 0; font-size: 24px; }}
            .content {{ padding: 24px; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 8px; }}
            th {{ text-align: left; padding: 12px; background: #27272a; color: #a1a1aa; font-size: 12px; text-transform: uppercase; }}
            td {{ color: #fafafa; }}
            .alert-badge {{ background: #ef4444; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; }}
            .footer {{ padding: 16px 24px; background: #27272a; color: #71717a; font-size: 12px; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>SecFind - Alerta de Remediaciones</h1>
                <p style="margin: 8px 0 0; opacity: 0.9;">Sistema de Gestión de Vulnerabilidades y GRC</p>
            </div>
            <div class="content">
                <p style="margin: 0 0 16px;">
                    <span class="alert-badge">{total_items} remediación(es)</span>
                    vencen en los próximos <strong>{days_before} día(s)</strong>
                </p>
                {vuln_section}
                {hallazgo_section}
                <p style="margin-top: 24px; color: #a1a1aa;">
                    Por favor, revisa estos elementos y toma las acciones necesarias antes de la fecha de compromiso.
                </p>
            </div>
            <div class="footer">
                Este es un mensaje automático generado por SecFind. No responda a este correo.
            </div>
        </div>
    </body>
    </html>
    """


def generate_weekly_summary_email(vuln_stats: dict, hallazgo_stats: dict, vulnerabilities: List[dict], hallazgos: List[dict]) -> str:
    """Generate HTML content for unified weekly summary email (vulnerabilities + audit findings)."""
    severity_colors = {
        "Critica": "#ef4444",
        "Alta": "#f97316", 
        "Media": "#eab308",
        "Baja": "#22c55e"
    }
    
    def get_riesgo_color(ri):
        if ri >= 15:
            return "#ef4444"
        if ri >= 8:
            return "#f97316"
        if ri >= 4:
            return "#eab308"
        return "#22c55e"
    
    # Generate vulnerability rows
    vuln_rows = ""
    for v in vulnerabilities[:15]:
        color = severity_colors.get(v.get("severidad", "Media"), "#6b7280")
        fecha = v.get("fecha_compromiso", "N/A")
        vuln_rows += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #27272a; font-size: 13px;">{v.get('vulnerabilidad', 'Sin nombre')[:40]}</td>
            <td style="padding: 10px; border-bottom: 1px solid #27272a;">
                <span style="background: {color}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">
                    {v.get('severidad', 'N/A')}
                </span>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #27272a; color: #f97316; font-size: 13px;">{fecha}</td>
        </tr>
        """
    
    # Generate hallazgo rows
    hallazgo_rows = ""
    for h in hallazgos[:15]:
        ri = h.get("riesgo_inherente", 0)
        color = get_riesgo_color(ri)
        fecha = h.get("fecha_compromiso", "N/A")
        hallazgo_rows += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #27272a; font-size: 13px; font-family: monospace; color: #2dd4bf;">{h.get('codigo', 'N/A')}</td>
            <td style="padding: 10px; border-bottom: 1px solid #27272a;">
                <span style="background: {color}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">
                    {ri}
                </span>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #27272a; color: #f97316; font-size: 13px;">{fecha}</td>
        </tr>
        """
    
    # Calculate combined totals
    total_vencidas = vuln_stats.get('vencidas', 0) + hallazgo_stats.get('vencidas', 0)
    total_7_dias = vuln_stats.get('proximas_7_dias', 0) + hallazgo_stats.get('proximas_7_dias', 0)
    total_30_dias = vuln_stats.get('proximas_30_dias', 0) + hallazgo_stats.get('proximas_30_dias', 0)
    total_pendientes = vuln_stats.get('total_pendientes', 0) + hallazgo_stats.get('total_pendientes', 0)
    
    vuln_table = ""
    if vulnerabilities:
        vuln_table = f"""
        <h3 style="margin: 24px 0 12px; font-size: 14px; color: #60a5fa;">Vulnerabilidades próximas a vencer</h3>
        <table>
            <thead>
                <tr>
                    <th>Vulnerabilidad</th>
                    <th>Severidad</th>
                    <th>Vence</th>
                </tr>
            </thead>
            <tbody>
                {vuln_rows}
            </tbody>
        </table>
        """
    
    hallazgo_table = ""
    if hallazgos:
        hallazgo_table = f"""
        <h3 style="margin: 24px 0 12px; font-size: 14px; color: #2dd4bf;">Hallazgos de Auditoría próximos a vencer</h3>
        <table>
            <thead>
                <tr>
                    <th>Código</th>
                    <th>R.I.</th>
                    <th>Vence</th>
                </tr>
            </thead>
            <tbody>
                {hallazgo_rows}
            </tbody>
        </table>
        """
    
    no_items_msg = ""
    if not vulnerabilities and not hallazgos:
        no_items_msg = '<p style="padding: 20px; text-align: center; color: #71717a;">No hay remediaciones próximas a vencer</p>'
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #fafafa; margin: 0; padding: 20px; }}
            .container {{ max-width: 700px; margin: 0 auto; background: #18181b; border-radius: 12px; overflow: hidden; }}
            .header {{ background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; }}
            .header h1 {{ margin: 0; font-size: 22px; }}
            .content {{ padding: 24px; }}
            .stats {{ display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }}
            .stat-card {{ flex: 1; min-width: 100px; background: #27272a; padding: 16px; border-radius: 8px; text-align: center; }}
            .stat-value {{ font-size: 28px; font-weight: bold; }}
            .stat-label {{ font-size: 11px; color: #a1a1aa; text-transform: uppercase; margin-top: 4px; }}
            .stat-detail {{ font-size: 9px; color: #71717a; margin-top: 2px; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th {{ text-align: left; padding: 10px; background: #27272a; color: #a1a1aa; font-size: 11px; text-transform: uppercase; }}
            td {{ color: #fafafa; }}
            .footer {{ padding: 16px 24px; background: #27272a; color: #71717a; font-size: 12px; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Resumen Semanal de Remediaciones</h1>
                <p style="margin: 8px 0 0; opacity: 0.9;">{datetime.now().strftime('%d de %B, %Y')}</p>
            </div>
            <div class="content">
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-value" style="color: #ef4444;">{total_vencidas}</div>
                        <div class="stat-label">Vencidas</div>
                        <div class="stat-detail">{vuln_stats.get('vencidas', 0)} vuln + {hallazgo_stats.get('vencidas', 0)} hall</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #f97316;">{total_7_dias}</div>
                        <div class="stat-label">Próx. 7 días</div>
                        <div class="stat-detail">{vuln_stats.get('proximas_7_dias', 0)} vuln + {hallazgo_stats.get('proximas_7_dias', 0)} hall</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #eab308;">{total_30_dias}</div>
                        <div class="stat-label">Próx. 30 días</div>
                        <div class="stat-detail">{vuln_stats.get('proximas_30_dias', 0)} vuln + {hallazgo_stats.get('proximas_30_dias', 0)} hall</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #22c55e;">{total_pendientes}</div>
                        <div class="stat-label">Pendientes</div>
                        <div class="stat-detail">{vuln_stats.get('total_pendientes', 0)} vuln + {hallazgo_stats.get('total_pendientes', 0)} hall</div>
                    </div>
                </div>
                
                {vuln_table}
                {hallazgo_table}
                {no_items_msg}
            </div>
            <div class="footer">
                Resumen automático generado por SecFind cada lunes.
            </div>
        </div>
    </body>
    </html>
    """
