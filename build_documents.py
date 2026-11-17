import os
import re
import subprocess
from pathlib import Path

REPORT_MD_PATH = r"C:\Users\dr_ra\.gemini\antigravity\brain\d325463a-36e9-427b-a30e-80a2e8b459b2\evolve_final_project_report.md"
OUTPUT_DIR = Path(r"c:\Users\dr_ra\Desktop\FinalMiniProject")
HTML_PATH = OUTPUT_DIR / "EVOLVE_Project_Report.html"
DOC_PATH = OUTPUT_DIR / "EVOLVE_Project_Report.doc"
PDF_PATH = OUTPUT_DIR / "EVOLVE_Project_Report.pdf"

def md_to_html(md_text: str) -> str:
    lines = md_text.splitlines()
    html_parts = []
    
    in_code_block = False
    code_block_content = []
    in_table = False
    table_rows = []
    
    def flush_table():
        nonlocal in_table, table_rows
        if not table_rows:
            return ""
        out = ['<table class="report-table">']
        # table_rows[0] is header
        # table_rows[1] is separator (skip)
        # table_rows[2:] are body
        headers = [c.strip() for c in table_rows[0].split('|')[1:-1]]
        out.append('  <thead><tr>')
        for h in headers:
            # parse formatting
            h_fmt = format_inline(h)
            out.append(f'    <th>{h_fmt}</th>')
        out.append('  </tr></thead>')
        
        out.append('  <tbody>')
        for row in table_rows[2:]:
            cells = [c.strip() for c in row.split('|')[1:-1]]
            if not cells:
                continue
            out.append('    <tr>')
            for c in cells:
                c_fmt = format_inline(c)
                out.append(f'      <td>{c_fmt}</td>')
            out.append('    </tr>')
        out.append('  </tbody></table>')
        in_table = False
        table_rows = []
        return '\n'.join(out)

    def format_inline(text: str) -> str:
        # bold-italic
        text = re.sub(r'\*\*\*(.*?)\*\*\*', r'<strong><em>\1</em></strong>', text)
        # bold
        text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)
        # italic
        text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', text)
        # inline code
        text = re.sub(r'`(.*?)`', r'<code>\1</code>', text)
        # clean math formatting for HTML
        # display math \hat{\mathbf{u}} \cdot \hat{\mathbf{v}}
        text = text.replace(r'\hat{\mathbf{u}} \cdot \hat{\mathbf{v}}', 'û · v̂')
        text = text.replace(r'\sum_{k=1}^{512} u_k \cdot v_k', '∑<sub>k=1</sub><sup>512</sup> (u<sub>k</sub> × v<sub>k</sub>)')
        text = text.replace(r'\mathcal{M}_{\text{safe}}', 'M<sub>safe</sub>')
        text = text.replace(r'\mathcal{R}_{\text{needed}}', 'R<sub>needed</sub>')
        text = text.replace(r'\ge', '≥')
        text = text.replace(r'\le', '≤')
        text = text.replace(r'<', '&lt;')
        text = text.replace(r'>', '&gt;')
        text = text.replace(r'\times', '×')
        text = text.replace(r'\text{min}', 'min')
        text = text.replace(r'\text{ms}', 'ms')
        text = text.replace(r'\text{ MB}', ' MB')
        text = text.replace(r'\text{ GB}', ' GB')
        text = text.replace(r'\text{', '')
        text = text.replace(r'}', '')
        text = text.replace(r'\left\lfloor', '⌊')
        text = text.replace(r'\right\rfloor', '⌋')
        text = text.replace(r'\left\lceil', '⌈')
        text = text.replace(r'\right\rceil', '⌉')
        text = text.replace(r'\left(', '(')
        text = text.replace(r'\right)', ')')
        text = text.replace(r'\frac', '')
        # remove single dollar signs if left
        text = re.sub(r'\$([^\$]+)\$', r'<span class="math-inline">\1</span>', text)
        return text

    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Code / ASCII block
        if line.startswith("```"):
            if in_table:
                html_parts.append(flush_table())
            if in_code_block:
                in_code_block = False
                code_text = "\n".join(code_block_content)
                code_block_content = []
                html_parts.append(f'<pre class="code-box"><code>{code_text}</code></pre>')
            else:
                in_code_block = True
                code_block_content = []
            i += 1
            continue
            
        if in_code_block:
            code_block_content.append(line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
            i += 1
            continue
            
        # Table
        if line.strip().startswith("|") and line.strip().endswith("|"):
            in_table = True
            table_rows.append(line.strip())
            i += 1
            continue
        elif in_table:
            html_parts.append(flush_table())
            
        stripped = line.strip()
        
        # Empty line
        if not stripped:
            i += 1
            continue
            
        # Horizontal rule
        if stripped == "---":
            html_parts.append('<hr class="report-divider" />')
            i += 1
            continue
            
        # Image handling ![alt](src)
        m_img = re.match(r'^!\[(.*?)\]\((.*?)\)$', stripped)
        if m_img:
            alt_text = m_img.group(1)
            img_src = m_img.group(2)
            svg_file = OUTPUT_DIR / img_src
            if svg_file.exists() and img_src.endswith(".svg"):
                with open(svg_file, "r", encoding="utf-8") as sf:
                    svg_xml = sf.read()
                html_parts.append(f'<div class="diagram-wrapper">{svg_xml}<div class="diagram-caption">{alt_text}</div></div>')
            else:
                html_parts.append(f'<div class="diagram-wrapper"><img src="{img_src}" alt="{alt_text}" style="max-width:100%;" /><div class="diagram-caption">{alt_text}</div></div>')
            i += 1
            continue

        # Headers
        if stripped.startswith("# "):
            title_text = format_inline(stripped[2:])
            html_parts.append(f'<h1 class="doc-title">{title_text}</h1>')
            i += 1
            continue
        elif stripped.startswith("## "):
            h2_text = format_inline(stripped[3:])
            html_parts.append(f'<h2 class="section-title">{h2_text}</h2>')
            i += 1
            continue
        elif stripped.startswith("### "):
            h3_text = format_inline(stripped[4:])
            html_parts.append(f'<h3 class="subsection-title">{h3_text}</h3>')
            i += 1
            continue
        elif stripped.startswith("#### "):
            h4_text = format_inline(stripped[5:])
            html_parts.append(f'<h4 class="subsubsection-title">{h4_text}</h4>')
            i += 1
            continue
            
        # Math display block $$...$$
        if stripped.startswith("$$") and stripped.endswith("$$") and len(stripped) > 4:
            math_content = format_inline(stripped[2:-2].strip())
            html_parts.append(f'<div class="math-block">{math_content}</div>')
            i += 1
            continue
        elif stripped.startswith("$$"):
            math_lines = [stripped[2:]]
            i += 1
            while i < len(lines) and not lines[i].strip().endswith("$$"):
                math_lines.append(lines[i])
                i += 1
            if i < len(lines):
                math_lines.append(lines[i].strip()[:-2])
            math_content = format_inline("\n".join(math_lines).strip())
            html_parts.append(f'<div class="math-block">{math_content}</div>')
            i += 1
            continue
            
        # Ordered list
        m_num = re.match(r'^(\d+)\.\s+(.*)$', stripped)
        if m_num:
            num = m_num.group(1)
            content = format_inline(m_num.group(2))
            html_parts.append(f'<div class="list-item-num"><span class="list-num">{num}.</span> {content}</div>')
            i += 1
            continue
            
        # Unordered list
        if stripped.startswith("- ") or stripped.startswith("* "):
            content = format_inline(stripped[2:])
            html_parts.append(f'<div class="list-item-bullet"><span class="list-bullet">•</span> {content}</div>')
            i += 1
            continue
            
        # Normal paragraph
        p_content = format_inline(stripped)
        html_parts.append(f'<p class="report-p">{p_content}</p>')
        i += 1

    if in_table:
        html_parts.append(flush_table())
        
    return "\n".join(html_parts)

CSS_STYLES = """
@page {
    size: A4;
    margin: 20mm 20mm 25mm 20mm;
    @bottom-right {
        content: counter(page);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 9pt;
        color: #64748b;
    }
}

body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1e293b;
    background-color: #ffffff;
    margin: 0;
    padding: 0;
}

.report-container {
    max-width: 850px;
    margin: 0 auto;
    padding: 20px;
}

/* Header & Cover Banner */
.cover-header {
    text-align: center;
    border-bottom: 3px double #0284c7;
    padding-bottom: 25px;
    margin-bottom: 30px;
}

.doc-title {
    font-size: 22pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.3;
    margin-bottom: 10px;
}

.doc-subtitle {
    font-size: 14pt;
    font-weight: 600;
    color: #0284c7;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 8px;
}

.doc-meta {
    font-size: 10pt;
    color: #64748b;
    margin-top: 5px;
}

/* Headings */
.section-title {
    font-size: 15pt;
    font-weight: 700;
    color: #0369a1;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 6px;
    margin-top: 35px;
    margin-bottom: 15px;
    page-break-after: avoid;
}

.subsection-title {
    font-size: 12.5pt;
    font-weight: 600;
    color: #0f172a;
    margin-top: 22px;
    margin-bottom: 10px;
    page-break-after: avoid;
}

.subsubsection-title {
    font-size: 11pt;
    font-weight: 600;
    color: #334155;
    margin-top: 16px;
    margin-bottom: 8px;
    page-break-after: avoid;
}

/* Paragraphs & Lists */
.report-p {
    margin-bottom: 12px;
    text-align: justify;
    text-justify: inter-word;
}

.list-item-num {
    margin-left: 20px;
    margin-bottom: 8px;
    text-align: justify;
}

.list-num {
    font-weight: 700;
    color: #0284c7;
    margin-right: 4px;
}

.list-item-bullet {
    margin-left: 20px;
    margin-bottom: 6px;
    text-align: justify;
}

.list-bullet {
    color: #0284c7;
    font-weight: bold;
    margin-right: 6px;
}

/* Dividers */
.report-divider {
    border: 0;
    height: 1px;
    background: #e2e8f0;
    margin: 30px 0;
}

/* Diagrams & Vector Figures */
.diagram-wrapper {
    text-align: center;
    margin: 25px auto;
    page-break-inside: avoid;
}

.diagram-wrapper svg {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}

.diagram-caption {
    font-size: 9.5pt;
    font-weight: 600;
    color: #475569;
    margin-top: 8px;
    font-style: italic;
}

/* Tables */
.report-table {
    width: 100%;
    border-collapse: collapse;
    margin: 18px 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
}

.report-table th, .report-table td {
    border: 1px solid #cbd5e1;
    padding: 8px 12px;
    text-align: left;
}

.report-table th {
    background-color: #f1f5f9;
    color: #0f172a;
    font-weight: 700;
}

.report-table tr:nth-child(even) {
    background-color: #f8fafc;
}

/* Monospace Box */
.code-box {
    background-color: #f8fafc;
    border: 1px solid #cbd5e1;
    border-left: 4px solid #0284c7;
    border-radius: 4px;
    padding: 12px 16px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 8.5pt;
    line-height: 1.4;
    overflow-x: auto;
    white-space: pre;
    margin: 15px 0;
    page-break-inside: avoid;
}

/* Math callout */
.math-block {
    background-color: #f0f9ff;
    border: 1px solid #bae6fd;
    border-left: 4px solid #0284c7;
    padding: 10px 16px;
    margin: 14px 0;
    font-family: 'Cambria Math', 'Times New Roman', serif;
    font-size: 11.5pt;
    color: #0369a1;
    text-align: center;
    border-radius: 4px;
    page-break-inside: avoid;
}

.math-inline {
    font-family: 'Cambria Math', 'Times New Roman', serif;
    color: #0369a1;
    font-weight: 600;
}

code {
    background-color: #f1f5f9;
    padding: 2px 5px;
    border-radius: 3px;
    font-family: 'Consolas', monospace;
    font-size: 9.5pt;
    color: #0f172a;
}
"""

def generate():
    with open(REPORT_MD_PATH, "r", encoding="utf-8") as f:
        md_text = f.read()

    body_html = md_to_html(md_text)

    # 1. Standalone HTML
    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EVOLVE: Project Engineering Report</title>
<style>
{CSS_STYLES}
</style>
</head>
<body>
<div class="report-container">
{body_html}
</div>
</body>
</html>
"""
    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(full_html)
    print(f"Generated HTML: {HTML_PATH} ({os.path.getsize(HTML_PATH)} bytes)")

    # 2. Microsoft Word Document (.doc via Word-HTML namespace)
    doc_html = f"""<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<title>EVOLVE Project Report</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
{CSS_STYLES}
@page Section1 {{
    size: 595.3pt 841.9pt; /* A4 */
    margin: 54.0pt 54.0pt 54.0pt 54.0pt;
    mso-header-margin: 35.4pt;
    mso-footer-margin: 35.4pt;
    mso-paper-source: 0;
}}
div.Section1 {{
    page: Section1;
}}
</style>
</head>
<body>
<div class="Section1 report-container">
{body_html}
</div>
</body>
</html>
"""
    with open(DOC_PATH, "w", encoding="utf-8") as f:
        f.write(doc_html)
    print(f"Generated DOC: {DOC_PATH} ({os.path.getsize(DOC_PATH)} bytes)")
    print("Compilation complete! All HTML, Word, and SVG vector figures generated successfully.")

if __name__ == "__main__":
    generate()

