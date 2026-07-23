"""
PDF Parser for Pentraze Cybersecurity Pentest Reports
Extracts vulnerabilities without requiring AI/LLM
"""

import re
import fitz  # PyMuPDF
from typing import List, Dict, Optional
from datetime import datetime


class PentrazePDFParser:
    """Parser for Pentraze Cybersecurity pentest report format"""
    
    # Severity mapping
    SEVERITY_MAP = {
        'crítica': 'Critica',
        'critica': 'Critica',
        'alta': 'Alta',
        'media': 'Media',
        'baja': 'Baja',
        'high': 'Alta',
        'medium': 'Media',
        'low': 'Baja',
        'critical': 'Critica'
    }
    
    # Mapeo de Severidad Técnica a Nivel de Riesgo Corporativo GRC
    NIVEL_RIESGO_MAP = {
        'Critica': 'Alto',
        'Alta': 'Medio Alto',
        'Media': 'Medio',
        'Baja': 'Bajo'
    }
    
    def __init__(self, pdf_content: bytes):
        self.pdf_content = pdf_content
        self.full_text = ""
        self.pages_text = []
        self.metadata = {}
        self.vulnerabilities = []
        
    def extract_text(self) -> str:
        """Extract text from all pages of the PDF"""
        pdf_document = fitz.open(stream=self.pdf_content, filetype="pdf")
        
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            page_text = page.get_text()
            self.pages_text.append(page_text)
            self.full_text += f"\n{page_text}"
        
        pdf_document.close()
        return self.full_text
    
    def extract_metadata(self) -> Dict:
        """Extract report metadata from cover page"""
        # Get first 2 pages for metadata
        cover_text = "\n".join(self.pages_text[:2]) if len(self.pages_text) >= 2 else self.full_text[:3000]
        
        # Extract report name - improved patterns for BHD format
        # Look for patterns like "Prueba de Penetración Web a Fondos BHD"
        name_patterns = [
            r'Prueba\s+de\s+Penetración[^\n]*(?:Web|Aplicación|Portal|Sistema)[^\n]*',
            r'Pruebas\s+de\s+Penetración[^\n]*',
            r'Penetration\s+Test[^\n]*',
            r'Pentest[^\n]*',
            r'Informe\s+de[^\n]*Seguridad[^\n]*',
            r'Portal\s+Web[^\n]*BHD[^\n]*',
        ]
        
        for pattern in name_patterns:
            match = re.search(pattern, cover_text, re.IGNORECASE)
            if match:
                nombre = match.group(0).strip()
                # Clean up the name
                nombre = re.sub(r'\s+', ' ', nombre)
                self.metadata['nombre_informe'] = nombre
                break
        
        # If still no name, try to extract from title-like text
        if 'nombre_informe' not in self.metadata:
            # Look for text after "Prueba" that spans multiple words
            title_match = re.search(r'(Prueba[^\n]{10,50})', cover_text, re.IGNORECASE)
            if title_match:
                self.metadata['nombre_informe'] = title_match.group(1).strip()
        
        # Extract date - multiple formats
        date_patterns = [
            r'(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})',  # "28 de enero de 2026"
            r'(\d{4})-(\d{2})-(\d{2})',  # "2026-01-28"
            r'(\d{2})/(\d{2})/(\d{4})',  # "28/01/2026"
        ]
        
        month_map = {
            'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
            'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
            'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
        }
        
        for pattern in date_patterns:
            match = re.search(pattern, cover_text, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 3:
                    if groups[1].lower() in month_map:
                        # Spanish format: day month year
                        day = groups[0].zfill(2)
                        month = month_map[groups[1].lower()]
                        year = groups[2]
                        self.metadata['fecha_informe'] = f"{year}-{month}-{day}"
                    elif len(groups[0]) == 4:
                        # ISO format
                        self.metadata['fecha_informe'] = f"{groups[0]}-{groups[1]}-{groups[2]}"
                    else:
                        # DD/MM/YYYY format
                        self.metadata['fecha_informe'] = f"{groups[2]}-{groups[1]}-{groups[0]}"
                break
        
        # Extract institution/client - improved for BHD
        client_patterns = [
            r'(?:Cliente|Client|Para|For)[:\s]+([^\n]+)',
            r'BANCO\s+\w+',
            r'(?:Institución|Institution)[:\s]+([^\n]+)',
        ]
        
        for pattern in client_patterns:
            match = re.search(pattern, cover_text, re.IGNORECASE)
            if match:
                self.metadata['institucion'] = match.group(0).replace('Cliente:', '').replace('Para:', '').strip()
                break
        
        # Check for BHD specifically - multiple patterns
        if 'BHD' in cover_text.upper():
            if 'FONDOS' in cover_text.upper():
                self.metadata['institucion'] = 'BHD Fondos'
            else:
                self.metadata['institucion'] = 'Banco BHD'
        
        # Extract provider - check in full document since it might be in headers/footers
        proveedor_found = False
        if 'pentraze' in self.full_text.lower():
            self.metadata['proveedor'] = 'Pentraze Cybersecurity'
            proveedor_found = True
        elif 'gbm' in cover_text.lower():
            self.metadata['proveedor'] = 'GBM'
            proveedor_found = True
        
        # If not found, look for "realizó" or "carried out by" patterns
        if not proveedor_found:
            provider_match = re.search(r'(\w+(?:\s+\w+)?)\s+realizó\s+(?:un|una|el|la)', self.full_text, re.IGNORECASE)
            if provider_match:
                self.metadata['proveedor'] = provider_match.group(1).strip()
        
        return self.metadata
    
    def extract_vulnerabilities(self) -> List[Dict]:
        """Extract all vulnerabilities from the report"""
        
        # Find the start of detailed findings section
        details_start = 0
        details_markers = [
            r'Detalles\s+Técnicos\s+de\s+(?:Los\s+)?Hallazgos',
            r'Technical\s+Details\s+of\s+Findings',
            r'A\s+continuación,\s+presentamos\s+los\s+detalles\s+técnicos'
        ]
        
        for marker in details_markers:
            match = re.search(marker, self.full_text, re.IGNORECASE)
            if match:
                details_start = match.end()
                break
        
        # Work only with text after the details section starts
        details_text = self.full_text[details_start:]
        
        # Improved header pattern to capture titles like "1. (0 DAY) Falta de Validación..."
        # Must be followed by Severidad to be a real vulnerability (not TOC)
        header_pattern = r'(\d+)\.\s+(\(?[A-Z0-9][^\n]{10,})'
        headers = list(re.finditer(header_pattern, details_text))
        
        # Filter to only keep headers that have "Severidad" nearby (within 500 chars)
        valid_headers = []
        for h in headers:
            title = h.group(2).strip()
            
            # Skip if it looks like a table of contents (has page numbers or dots)
            if re.search(r'\.{3,}\s*\d+\s*$', title) or re.search(r'\.\.\.\s*\d+', title):
                continue
            if len(title) < 15:
                continue
                
            # Check if there's a Severidad label nearby (this confirms it's a real vulnerability)
            section_preview = details_text[h.end():h.end()+600]
            if re.search(r'Severidad[:\s]*(?:Crítica|Critica|Alta|Media|Baja)', section_preview, re.IGNORECASE):
                valid_headers.append(h)
        
        for i, header_match in enumerate(valid_headers):
            vuln_num = header_match.group(1)
            vuln_title = header_match.group(2).strip()
            # Clean up title - remove trailing page references if any
            vuln_title = re.sub(r'\s*\.{2,}\s*\d+\s*$', '', vuln_title)
            
            # Get the text between this header and the next one (or end)
            start_pos = header_match.end()
            if i + 1 < len(valid_headers):
                end_pos = valid_headers[i + 1].start()
            else:
                end_pos = len(details_text)
            
            section_text = details_text[start_pos:end_pos]
            
            # Extract severity - improved pattern for "Severidad: Crítica (9.1)"
            severity = 'Media'  # Default
            cvss_score = None
            
            severity_match = re.search(
                r'Severidad[:\s]*(\w+)(?:\s*\(?([\d.]+)\)?)?',
                section_text,
                re.IGNORECASE
            )
            if severity_match:
                sev_text = severity_match.group(1).lower()
                severity = self.SEVERITY_MAP.get(sev_text, 'Media')
                if severity_match.group(2):
                    cvss_score = severity_match.group(2)
            
            # Extract affected assets - improved pattern for URLs and bullet points
            activos = []
            activos_match = re.search(
                r'(?:Activos\s+Afectados|Affected\s+Assets)[:\s]*(.*?)(?:Descripción|Description|CVSS\s*Vector)',
                section_text,
                re.IGNORECASE | re.DOTALL
            )
            if activos_match:
                activos_text = activos_match.group(1).strip()
                # Extract URLs first
                urls = re.findall(r'https?://[^\s\n]+', activos_text)
                if urls:
                    activos = [url.strip().rstrip('.') for url in urls]
                else:
                    # Fall back to splitting by newlines/bullets
                    activos = [a.strip() for a in re.split(r'[\n•\-\*]', activos_text) if a.strip() and len(a.strip()) > 3]
            
            # Extract description - improved to handle "Prueba de Concepto"
            descripcion = ""
            desc_match = re.search(
                r'(?:Descripción|Description)[:\s]*(.*?)(?:Prueba\s+de\s+Concepto|PoC|Impacto|Impact|Figura)',
                section_text,
                re.IGNORECASE | re.DOTALL
            )
            if desc_match:
                descripcion = desc_match.group(1).strip()
                # Clean up description - remove excessive whitespace but keep paragraph structure
                descripcion = re.sub(r'\n\s*\n', '\n\n', descripcion)
                descripcion = re.sub(r'[ \t]+', ' ', descripcion)
                descripcion = descripcion[:1500]  # Allow longer descriptions
            
            # Extract impact
            impacto = ""
            impact_match = re.search(
                r'(?:Impacto|Impact)[:\s]*(.*?)(?:Recomendaciones|Recommendations|Mitigación)',
                section_text,
                re.IGNORECASE | re.DOTALL
            )
            if impact_match:
                impacto = impact_match.group(1).strip()
                impacto = re.sub(r'\s+', ' ', impacto)[:800]
            
            # Extract recommendations - improved to capture lists
            recomendaciones = ""
            rec_match = re.search(
                r'(?:Recomendaciones|Recommendations|Mitigación)[:\s]*(.*?)(?:Referencias|References|\d+\.\s+\(?[A-Z]|\Z)',
                section_text,
                re.IGNORECASE | re.DOTALL
            )
            if rec_match:
                recomendaciones = rec_match.group(1).strip()
                # Preserve bullet points for recommendations
                recomendaciones = re.sub(r'\n\s*\n', '\n', recomendaciones)
                recomendaciones = recomendaciones[:1500]
            
            # Only add if we have meaningful content
            if vuln_title and (descripcion or recomendaciones):
                vuln_data = {
                    'numero': vuln_num,
                    'titulo': vuln_title[:200],  # Limit title length
                    'severidad': severity,
                    'cvss_score': cvss_score,
                    'activos_afectados': activos[:10],  # Limit to 10 assets
                    'descripcion': descripcion,
                    'impacto': impacto,
                    'recomendaciones': recomendaciones,
                }
                
                # Avoid duplicates
                if not any(v['titulo'] == vuln_data['titulo'] for v in self.vulnerabilities):
                    self.vulnerabilities.append(vuln_data)
        
        return self.vulnerabilities
    
    def parse(self) -> Dict:
        """Main parsing method - extracts all data from the PDF"""
        self.extract_text()
        self.extract_metadata()
        self.extract_vulnerabilities()
        
        return {
            'metadata': self.metadata,
            'vulnerabilities': self.vulnerabilities,
            'total_vulnerabilities': len(self.vulnerabilities)
        }
    
    def to_secfind_format(self) -> List[Dict]:
        """Convert parsed vulnerabilities to SecFind import format"""
        secfind_vulns = []
        
        for vuln in self.vulnerabilities:
            severidad = vuln['severidad']
            # Calcular nivel_riesgo desde severidad
            nivel_riesgo = self.NIVEL_RIESGO_MAP.get(severidad, 'Medio')
            
            secfind_vuln = {
                'codigo': f"PEN-{vuln['numero'].zfill(3)}" if vuln.get('numero') else None,
                'fecha_hallazgo': self.metadata.get('fecha_informe'),
                'institucion': self.metadata.get('institucion'),
                'aplicaciones': vuln.get('activos_afectados', []),
                'vulnerabilidad': vuln['titulo'],
                'recomendaciones': vuln.get('recomendaciones', ''),
                'severidad': severidad,
                'nivel_riesgo': nivel_riesgo,  # Nuevo campo GRC
                'riesgo_asociado': vuln.get('impacto', ''),
                'descripcion_riesgo': vuln.get('descripcion', ''),
                'estatus': 'Pendiente',
                'nombre_informe_pentest': self.metadata.get('nombre_informe'),
                'proveedor': self.metadata.get('proveedor'),
            }
            secfind_vulns.append(secfind_vuln)
        
        return secfind_vulns


def parse_pentraze_pdf(pdf_content: bytes) -> Dict:
    """
    Utility function to parse a Pentraze PDF and return structured data
    
    Args:
        pdf_content: Raw bytes of the PDF file
        
    Returns:
        Dictionary with metadata and vulnerabilities in SecFind format
    """
    parser = PentrazePDFParser(pdf_content)
    result = parser.parse()
    
    return {
        'metadata': result['metadata'],
        'vulnerabilities': parser.to_secfind_format(),
        'total': result['total_vulnerabilities'],
        'parser': 'pentraze_rules'
    }
