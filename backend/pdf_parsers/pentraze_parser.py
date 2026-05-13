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
        
        # Extract report name - look for "Pruebas de Penetración" or similar
        name_patterns = [
            r'Pruebas de Penetración[^\n]*',
            r'Penetration Test[^\n]*',
            r'Pentest[^\n]*',
            r'Informe de[^\n]*Seguridad[^\n]*',
        ]
        
        for pattern in name_patterns:
            match = re.search(pattern, cover_text, re.IGNORECASE)
            if match:
                self.metadata['nombre_informe'] = match.group(0).strip()
                break
        
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
        
        # Extract institution/client
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
        
        # Check for BHD specifically
        if 'BHD' in cover_text.upper():
            self.metadata['institucion'] = 'Banco BHD'
        
        # Extract provider
        if 'pentraze' in cover_text.lower():
            self.metadata['proveedor'] = 'Pentraze Cybersecurity'
        elif 'gbm' in cover_text.lower():
            self.metadata['proveedor'] = 'GBM'
        
        return self.metadata
    
    def extract_vulnerabilities(self) -> List[Dict]:
        """Extract all vulnerabilities from the report"""
        
        # Pattern to identify vulnerability sections
        # Pentraze format: "1. Title of Vulnerability" followed by severity
        vuln_pattern = r'(\d+)\.\s+([^\n]+)\n.*?(?:Severidad|Severity)[:\s]*(\w+)\s*\(?([\d.]+)?\)?'
        
        # More detailed pattern for full vulnerability extraction
        full_vuln_pattern = r'''
            (\d+)\.\s+                          # Number and dot
            ([^\n]+)\n                          # Title
            .*?                                 # Any content
            (?:Severidad|Severity)[:\s]*        # Severity label
            (\w+)                               # Severity value (Alta, Crítica, etc.)
            (?:\s*\(?([\d.]+)\)?)?              # Optional CVSS score
            .*?                                 # Any content
            (?:Activos\s+Afectados|Affected\s+Assets)[:\s]*
            (.*?)                               # Affected assets
            (?:Descripción|Description)[:\s]*
            (.*?)                               # Description
            (?:Impacto|Impact)[:\s]*
            (.*?)                               # Impact
            (?:Recomendaciones|Recommendations)[:\s]*
            (.*?)                               # Recommendations
            (?=\d+\.\s+[A-Z]|\Z|Referencias|References)  # Next vulnerability or end
        '''
        
        # First, let's find all vulnerability headers
        header_pattern = r'(\d+)\.\s+([A-Z][^\n]{10,})'
        headers = list(re.finditer(header_pattern, self.full_text))
        
        for i, header_match in enumerate(headers):
            vuln_num = header_match.group(1)
            vuln_title = header_match.group(2).strip()
            
            # Skip if this looks like a table of contents entry
            if len(vuln_title) < 15:
                continue
            
            # Get the text between this header and the next one (or end)
            start_pos = header_match.end()
            if i + 1 < len(headers):
                end_pos = headers[i + 1].start()
            else:
                end_pos = len(self.full_text)
            
            section_text = self.full_text[start_pos:end_pos]
            
            # Extract severity
            severity = 'Media'  # Default
            cvss_score = None
            
            severity_match = re.search(
                r'(?:Severidad|Severity)[:\s]*(\w+)(?:\s*\(?([\d.]+)\)?)?',
                section_text,
                re.IGNORECASE
            )
            if severity_match:
                sev_text = severity_match.group(1).lower()
                severity = self.SEVERITY_MAP.get(sev_text, 'Media')
                if severity_match.group(2):
                    cvss_score = severity_match.group(2)
            
            # Extract affected assets
            activos = []
            activos_match = re.search(
                r'(?:Activos\s+Afectados|Affected\s+Assets)[:\s]*(.*?)(?:Descripción|Description|CVSS)',
                section_text,
                re.IGNORECASE | re.DOTALL
            )
            if activos_match:
                activos_text = activos_match.group(1).strip()
                # Clean up and split
                activos = [a.strip() for a in re.split(r'[\n•\-\*]', activos_text) if a.strip() and len(a.strip()) > 3]
            
            # Extract description
            descripcion = ""
            desc_match = re.search(
                r'(?:Descripción|Description)[:\s]*(.*?)(?:Prueba\s+de\s+Concepto|PoC|Impacto|Impact)',
                section_text,
                re.IGNORECASE | re.DOTALL
            )
            if desc_match:
                descripcion = desc_match.group(1).strip()
                # Clean up description
                descripcion = re.sub(r'\s+', ' ', descripcion)[:1000]
            
            # Extract impact
            impacto = ""
            impact_match = re.search(
                r'(?:Impacto|Impact)[:\s]*(.*?)(?:Recomendaciones|Recommendations)',
                section_text,
                re.IGNORECASE | re.DOTALL
            )
            if impact_match:
                impacto = impact_match.group(1).strip()
                impacto = re.sub(r'\s+', ' ', impacto)[:500]
            
            # Extract recommendations
            recomendaciones = ""
            rec_match = re.search(
                r'(?:Recomendaciones|Recommendations)[:\s]*(.*?)(?:Referencias|References|\d+\.\s+[A-Z]|\Z)',
                section_text,
                re.IGNORECASE | re.DOTALL
            )
            if rec_match:
                recomendaciones = rec_match.group(1).strip()
                recomendaciones = re.sub(r'\s+', ' ', recomendaciones)[:1000]
            
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
            secfind_vuln = {
                'codigo': f"PEN-{vuln['numero'].zfill(3)}" if vuln.get('numero') else None,
                'fecha_hallazgo': self.metadata.get('fecha_informe'),
                'institucion': self.metadata.get('institucion'),
                'aplicaciones': vuln.get('activos_afectados', []),
                'vulnerabilidad': vuln['titulo'],
                'recomendaciones': vuln.get('recomendaciones', ''),
                'severidad': vuln['severidad'],
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
