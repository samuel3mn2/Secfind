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


def generate_alert_email(vulnerabilities: List[dict], days_before: int) -> str:
    """Generate HTML content for vulnerability alert email."""
    severity_colors = {
        "Critica": "#ef4444",
        "Alta": "#f97316", 
        "Media": "#eab308",
        "Baja": "#22c55e"
    }
    
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
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #fafafa; margin: 0; padding: 20px; }}
            .container {{ max-width: 800px; margin: 0 auto; background: #18181b; border-radius: 12px; overflow: hidden; }}
            .header {{ background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; }}
            .header h1 {{ margin: 0; font-size: 24px; }}
            .content {{ padding: 24px; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
            th {{ text-align: left; padding: 12px; background: #27272a; color: #a1a1aa; font-size: 12px; text-transform: uppercase; }}
            td {{ color: #fafafa; }}
            .alert-badge {{ background: #ef4444; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; }}
            .footer {{ padding: 16px 24px; background: #27272a; color: #71717a; font-size: 12px; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>SecFind - Alerta de Vulnerabilidades</h1>
                <p style="margin: 8px 0 0; opacity: 0.9;">Sistema de Gestión de Vulnerabilidades</p>
            </div>
            <div class="content">
                <p style="margin: 0 0 16px;">
                    <span class="alert-badge">{len(vulnerabilities)} vulnerabilidad(es)</span>
                    vencen en los próximos <strong>{days_before} día(s)</strong>
                </p>
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
                <p style="margin-top: 24px; color: #a1a1aa;">
                    Por favor, revisa estas vulnerabilidades y toma las acciones necesarias antes de la fecha de compromiso.
                </p>
            </div>
            <div class="footer">
                Este es un mensaje automático generado por SecFind. No responda a este correo.
            </div>
        </div>
    </body>
    </html>
    """


def generate_weekly_summary_email(stats: dict, vulnerabilities: List[dict]) -> str:
    """Generate HTML content for weekly summary email."""
    severity_colors = {
        "Critica": "#ef4444",
        "Alta": "#f97316", 
        "Media": "#eab308",
        "Baja": "#22c55e"
    }
    
    vuln_rows = ""
    for v in vulnerabilities[:20]:  # Limit to 20 in summary
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
            .stats {{ display: flex; gap: 12px; margin-bottom: 24px; }}
            .stat-card {{ flex: 1; background: #27272a; padding: 16px; border-radius: 8px; text-align: center; }}
            .stat-value {{ font-size: 28px; font-weight: bold; }}
            .stat-label {{ font-size: 11px; color: #a1a1aa; text-transform: uppercase; margin-top: 4px; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th {{ text-align: left; padding: 10px; background: #27272a; color: #a1a1aa; font-size: 11px; text-transform: uppercase; }}
            td {{ color: #fafafa; }}
            .footer {{ padding: 16px 24px; background: #27272a; color: #71717a; font-size: 12px; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Resumen Semanal de Vulnerabilidades</h1>
                <p style="margin: 8px 0 0; opacity: 0.9;">{datetime.now().strftime('%d de %B, %Y')}</p>
            </div>
            <div class="content">
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-value" style="color: #ef4444;">{stats.get('vencidas', 0)}</div>
                        <div class="stat-label">Vencidas</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #f97316;">{stats.get('proximas_7_dias', 0)}</div>
                        <div class="stat-label">Próx. 7 días</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #eab308;">{stats.get('proximas_30_dias', 0)}</div>
                        <div class="stat-label">Próx. 30 días</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #22c55e;">{stats.get('total_pendientes', 0)}</div>
                        <div class="stat-label">Pendientes</div>
                    </div>
                </div>
                
                <h3 style="margin: 0 0 12px; font-size: 14px; color: #a1a1aa;">Vulnerabilidades próximas a vencer</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Vulnerabilidad</th>
                            <th>Severidad</th>
                            <th>Vence</th>
                        </tr>
                    </thead>
                    <tbody>
                        {vuln_rows if vuln_rows else '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #71717a;">No hay vulnerabilidades próximas a vencer</td></tr>'}
                    </tbody>
                </table>
            </div>
            <div class="footer">
                Resumen automático generado por SecFind cada lunes.
            </div>
        </div>
    </body>
    </html>
    """
