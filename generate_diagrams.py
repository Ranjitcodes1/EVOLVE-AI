import os
from pathlib import Path

# SVG 1: High-Level System Architecture & Block Diagram
SVG1_CONTENT = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 680" width="100%" height="100%" style="background:#ffffff; font-family:'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;">
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.08"/>
    </filter>
    <linearGradient id="clientGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
    <linearGradient id="apiGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
    <linearGradient id="cvGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <linearGradient id="dbGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#d97706"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#64748b"/>
    </marker>
    <marker id="arrowhead-blue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#0284c7"/>
    </marker>
    <marker id="arrowhead-green" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#059669"/>
    </marker>
  </defs>

  <!-- Title Banner -->
  <rect x="20" y="15" width="860" height="42" rx="6" fill="#0f172a"/>
  <text x="450" y="42" fill="#ffffff" font-size="16" font-weight="700" text-anchor="middle" letter-spacing="1">FIGURE 3.1: EVOLVE SYSTEM ARCHITECTURE &amp; BLOCK DIAGRAM</text>

  <!-- TIER 1: CLIENT TIER -->
  <g transform="translate(30, 75)">
    <rect x="0" y="0" width="840" height="115" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
    <rect x="0" y="0" width="840" height="28" rx="8" fill="url(#clientGrad)"/>
    <text x="16" y="19" fill="#ffffff" font-size="12" font-weight="700" letter-spacing="0.5">1. PRESENTATION &amp; CLIENT TIER (Next.js 16 + React 19 + Tailwind CSS)</text>

    <!-- Component 1 -->
    <rect x="15" y="38" width="150" height="65" rx="5" fill="#ffffff" stroke="#bae6fd" stroke-width="1.2"/>
    <text x="90" y="58" fill="#0369a1" font-size="11" font-weight="700" text-anchor="middle">Landing Gateway</text>
    <text x="90" y="74" fill="#64748b" font-size="9" text-anchor="middle">Role Selector (/)</text>
    <text x="90" y="88" fill="#0f172a" font-size="8.5" text-anchor="middle">Neo-Brutalist UI</text>

    <!-- Component 2 -->
    <rect x="180" y="38" width="150" height="65" rx="5" fill="#ffffff" stroke="#bae6fd" stroke-width="1.2"/>
    <text x="255" y="58" fill="#0369a1" font-size="11" font-weight="700" text-anchor="middle">3D Lanyard Studio</text>
    <text x="255" y="74" fill="#64748b" font-size="9" text-anchor="middle">Enrollment (/register)</text>
    <text x="255" y="88" fill="#0f172a" font-size="8.5" text-anchor="middle">Biometric Oval Guide</text>

    <!-- Component 3 -->
    <rect x="345" y="38" width="150" height="65" rx="5" fill="#ffffff" stroke="#bae6fd" stroke-width="1.2"/>
    <text x="420" y="58" fill="#0369a1" font-size="11" font-weight="700" text-anchor="middle">Faculty Studio</text>
    <text x="420" y="74" fill="#64748b" font-size="9" text-anchor="middle">Session (/teacher/new)</text>
    <text x="420" y="88" fill="#0f172a" font-size="8.5" text-anchor="middle">Multi-Angle Capture</text>

    <!-- Component 4 -->
    <rect x="510" y="38" width="150" height="65" rx="5" fill="#ffffff" stroke="#bae6fd" stroke-width="1.2"/>
    <text x="585" y="58" fill="#0369a1" font-size="11" font-weight="700" text-anchor="middle">HITL Review Studio</text>
    <text x="585" y="74" fill="#64748b" font-size="9" text-anchor="middle">Audit (/teacher/session)</text>
    <text x="585" y="88" fill="#0f172a" font-size="8.5" text-anchor="middle">Confidence Tiers</text>

    <!-- Component 5 -->
    <rect x="675" y="38" width="150" height="65" rx="5" fill="#ffffff" stroke="#bae6fd" stroke-width="1.2"/>
    <text x="750" y="58" fill="#0369a1" font-size="11" font-weight="700" text-anchor="middle">Student Hub</text>
    <text x="750" y="74" fill="#64748b" font-size="9" text-anchor="middle">Dashboard (/student)</text>
    <text x="750" y="88" fill="#0f172a" font-size="8.5" text-anchor="middle">75% Exam Eligibility</text>
  </g>

  <!-- Connection 1 -->
  <line x1="450" y1="190" x2="450" y2="218" stroke="#0284c7" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#arrowhead-blue)"/>
  <rect x="350" y="196" width="200" height="18" rx="4" fill="#e0f2fe"/>
  <text x="450" y="209" fill="#0369a1" font-size="9" font-weight="600" text-anchor="middle">REST APIs / 24-hr Bearer JWT</text>

  <!-- TIER 2: API & ORCHESTRATION TIER -->
  <g transform="translate(30, 220)">
    <rect x="0" y="0" width="840" height="110" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
    <rect x="0" y="0" width="840" height="28" rx="8" fill="url(#apiGrad)"/>
    <text x="16" y="19" fill="#ffffff" font-size="12" font-weight="700" letter-spacing="0.5">2. API &amp; ORCHESTRATION TIER (FastAPI Async ASGI + Python 3.12)</text>

    <rect x="15" y="38" width="190" height="60" rx="5" fill="#ffffff" stroke="#c7d2fe" stroke-width="1.2"/>
    <text x="110" y="57" fill="#4338ca" font-size="11" font-weight="700" text-anchor="middle">Authentication Controller</text>
    <text x="110" y="73" fill="#64748b" font-size="9" text-anchor="middle">JWT Sign / Auto-Purge</text>
    <text x="110" y="87" fill="#0f172a" font-size="8.5" text-anchor="middle">Token Version Invalidation</text>

    <rect x="220" y="38" width="190" height="60" rx="5" fill="#ffffff" stroke="#c7d2fe" stroke-width="1.2"/>
    <text x="315" y="57" fill="#4338ca" font-size="11" font-weight="700" text-anchor="middle">Academic Hierarchy Router</text>
    <text x="315" y="73" fill="#64748b" font-size="9" text-anchor="middle">Institution / Dept / Division</text>
    <text x="315" y="87" fill="#0f172a" font-size="8.5" text-anchor="middle">Course Offering Mapping</text>

    <rect x="425" y="38" width="195" height="60" rx="5" fill="#ffffff" stroke="#c7d2fe" stroke-width="1.2"/>
    <text x="522" y="57" fill="#4338ca" font-size="11" font-weight="700" text-anchor="middle">Attendance State Machine</text>
    <text x="522" y="73" fill="#64748b" font-size="9" text-anchor="middle">Draft → Upload → Review</text>
    <text x="522" y="87" fill="#0f172a" font-size="8.5" text-anchor="middle">Confirmed / Locked State</text>

    <rect x="635" y="38" width="190" height="60" rx="5" fill="#ffffff" stroke="#c7d2fe" stroke-width="1.2"/>
    <text x="730" y="57" fill="#4338ca" font-size="11" font-weight="700" text-anchor="middle">Data Governance Daemon</text>
    <text x="730" y="73" fill="#64748b" font-size="9" text-anchor="middle">30-Day Ephemeral Purge</text>
    <text x="730" y="87" fill="#0f172a" font-size="8.5" text-anchor="middle">DPDP / GDPR Compliance</text>
  </g>

  <!-- Connection 2 -->
  <line x1="450" y1="330" x2="450" y2="358" stroke="#059669" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#arrowhead-green)"/>
  <rect x="330" y="336" width="240" height="18" rx="4" fill="#ecfdf5"/>
  <text x="450" y="349" fill="#047857" font-size="9" font-weight="600" text-anchor="middle">In-Memory Image Arrays / Batch Tensors</text>

  <!-- TIER 3: COMPUTER VISION INFERENCE CORE -->
  <g transform="translate(30, 360)">
    <rect x="0" y="0" width="840" height="120" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
    <rect x="0" y="0" width="840" height="28" rx="8" fill="url(#cvGrad)"/>
    <text x="16" y="19" fill="#ffffff" font-size="12" font-weight="700" letter-spacing="0.5">3. COMPUTER VISION INFERENCE CORE (OpenCV DNN + ONNX Runtime on CPU)</text>

    <!-- Stage 1 -->
    <rect x="15" y="38" width="190" height="70" rx="5" fill="#ffffff" stroke="#a7f3d0" stroke-width="1.2"/>
    <text x="110" y="57" fill="#047857" font-size="11" font-weight="700" text-anchor="middle">YuNet Edge Detector</text>
    <text x="110" y="73" fill="#64748b" font-size="9" text-anchor="middle">Face Bounding Boxes</text>
    <text x="110" y="87" fill="#0f172a" font-size="8.5" text-anchor="middle">5 Key Facial Landmarks</text>
    <text x="110" y="99" fill="#059669" font-size="8" font-weight="600" text-anchor="middle">&lt; 15ms CPU Latency</text>

    <!-- Stage 2 -->
    <rect x="220" y="38" width="190" height="70" rx="5" fill="#ffffff" stroke="#a7f3d0" stroke-width="1.2"/>
    <text x="315" y="57" fill="#047857" font-size="11" font-weight="700" text-anchor="middle">5-Point Alignment</text>
    <text x="315" y="73" fill="#64748b" font-size="9" text-anchor="middle">Affine Transform Matrix</text>
    <text x="315" y="87" fill="#0f172a" font-size="8.5" text-anchor="middle">112 × 112 Canonical Patch</text>
    <text x="315" y="99" fill="#059669" font-size="8" font-weight="600" text-anchor="middle">Tilt &amp; Pose Normalization</text>

    <!-- Stage 3 -->
    <rect x="425" y="38" width="195" height="70" rx="5" fill="#ffffff" stroke="#a7f3d0" stroke-width="1.2"/>
    <text x="522" y="57" fill="#047857" font-size="11" font-weight="700" text-anchor="middle">ArcFace Deep Extractor</text>
    <text x="522" y="73" fill="#64748b" font-size="9" text-anchor="middle">ResNet-50 Backbone</text>
    <text x="522" y="87" fill="#0f172a" font-size="8.5" text-anchor="middle">512-d Hypersphere Vector</text>
    <text x="522" y="99" fill="#059669" font-size="8" font-weight="600" text-anchor="middle">Unit-Normalized (||v|| = 1)</text>

    <!-- Stage 4 -->
    <rect x="635" y="38" width="190" height="70" rx="5" fill="#ffffff" stroke="#a7f3d0" stroke-width="1.2"/>
    <text x="730" y="57" fill="#047857" font-size="11" font-weight="700" text-anchor="middle">Bipartite Deduplicator</text>
    <text x="730" y="73" fill="#64748b" font-size="9" text-anchor="middle">Cosine Similarity (û · v̂)</text>
    <text x="730" y="87" fill="#0f172a" font-size="8.5" text-anchor="middle">Greedy Cohort Assignment</text>
    <text x="730" y="99" fill="#059669" font-size="8" font-weight="600" text-anchor="middle">Multi-Angle Deduplication</text>
  </g>

  <!-- Connection 3 -->
  <line x1="450" y1="480" x2="450" y2="508" stroke="#d97706" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#arrowhead)"/>
  <rect x="340" y="486" width="220" height="18" rx="4" fill="#fef3c7"/>
  <text x="450" y="499" fill="#b45309" font-size="9" font-weight="600" text-anchor="middle">SQLAlchemy ORM / Irreversible Vectors</text>

  <!-- TIER 4: PERSISTENCE & DATA GOVERNANCE TIER -->
  <g transform="translate(30, 510)">
    <rect x="0" y="0" width="840" height="110" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
    <rect x="0" y="0" width="840" height="28" rx="8" fill="url(#dbGrad)"/>
    <text x="16" y="19" fill="#ffffff" font-size="12" font-weight="700" letter-spacing="0.5">4. PERSISTENCE &amp; AUDIT TIER (SQLite / PostgreSQL)</text>

    <rect x="15" y="38" width="190" height="60" rx="5" fill="#ffffff" stroke="#fed7aa" stroke-width="1.2"/>
    <text x="110" y="57" fill="#b45309" font-size="11" font-weight="700" text-anchor="middle">Relational Schema</text>
    <text x="110" y="73" fill="#64748b" font-size="9" text-anchor="middle">Profiles, Courses, Offerings</text>
    <text x="110" y="87" fill="#0f172a" font-size="8.5" text-anchor="middle">Session Tracking Tables</text>

    <rect x="220" y="38" width="190" height="60" rx="5" fill="#ffffff" stroke="#fed7aa" stroke-width="1.2"/>
    <text x="315" y="57" fill="#b45309" font-size="11" font-weight="700" text-anchor="middle">Biometric Vector Store</text>
    <text x="315" y="73" fill="#64748b" font-size="9" text-anchor="middle">512-d Floats (JSON Array)</text>
    <text x="315" y="87" fill="#0f172a" font-size="8.5" text-anchor="middle">Zero Raw Selfie Retention</text>

    <rect x="425" y="38" width="195" height="60" rx="5" fill="#ffffff" stroke="#fed7aa" stroke-width="1.2"/>
    <text x="522" y="57" fill="#b45309" font-size="11" font-weight="700" text-anchor="middle">Immutable Audit Ledger</text>
    <text x="522" y="73" fill="#64748b" font-size="9" text-anchor="middle">AttendanceAuditLog Table</text>
    <text x="522" y="87" fill="#0f172a" font-size="8.5" text-anchor="middle">Mandatory Override Reasons</text>

    <rect x="635" y="38" width="190" height="60" rx="5" fill="#ffffff" stroke="#fed7aa" stroke-width="1.2"/>
    <text x="730" y="57" fill="#b45309" font-size="11" font-weight="700" text-anchor="middle">Ephemeral Asset Buffer</text>
    <text x="730" y="73" fill="#64748b" font-size="9" text-anchor="middle">AttendanceCaptureAsset</text>
    <text x="730" y="87" fill="#0f172a" font-size="8.5" text-anchor="middle">Strict 30-Day Auto Purge</text>
  </g>

  <!-- Footer compliance note -->
  <text x="450" y="650" fill="#64748b" font-size="10" text-anchor="middle">Strict Disassociation Security: No biometric photographs are stored permanently. All inferences operate strictly on ephemeral buffers and 512-d mathematical embeddings.</text>
</svg>
"""

# SVG 2: Attendance Session Lifecycle Flowchart
SVG2_CONTENT = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 380" width="100%" height="100%" style="background:#ffffff; font-family:'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;">
  <defs>
    <filter id="shadow2" x="-5%" y="-5%" width="110%" height="110%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.08"/>
    </filter>
    <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#0284c7"/>
    </marker>
  </defs>

  <!-- Title Banner -->
  <rect x="20" y="15" width="860" height="38" rx="6" fill="#0f172a"/>
  <text x="450" y="39" fill="#ffffff" font-size="15" font-weight="700" text-anchor="middle" letter-spacing="1">FIGURE 3.2: ATTENDANCE SESSION LIFECYCLE FLOWCHART</text>

  <!-- Step 1 -->
  <g transform="translate(30, 80)">
    <rect x="0" y="0" width="150" height="210" rx="8" fill="#f8fafc" stroke="#0284c7" stroke-width="2" filter="url(#shadow2)"/>
    <rect x="0" y="0" width="150" height="32" rx="8" fill="#0284c7"/>
    <text x="75" y="21" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">1. INITIATION</text>
    <text x="75" y="55" fill="#0369a1" font-size="12" font-weight="700" text-anchor="middle">Draft State</text>
    <text x="75" y="80" fill="#475569" font-size="10" text-anchor="middle">• Faculty logs in</text>
    <text x="75" y="100" fill="#475569" font-size="10" text-anchor="middle">• Selects Division</text>
    <text x="75" y="120" fill="#475569" font-size="10" text-anchor="middle">• Chooses Subject</text>
    <text x="75" y="140" fill="#475569" font-size="10" text-anchor="middle">• Sets Lecture Date</text>
    <rect x="20" y="165" width="110" height="26" rx="4" fill="#e0f2fe"/>
    <text x="75" y="182" fill="#0369a1" font-size="9" font-weight="700" text-anchor="middle">Session Created</text>
  </g>

  <!-- Arrow 1 to 2 -->
  <line x1="180" y1="185" x2="208" y2="185" stroke="#0284c7" stroke-width="2.5" marker-end="url(#arrow)"/>

  <!-- Step 2 -->
  <g transform="translate(210, 80)">
    <rect x="0" y="0" width="150" height="210" rx="8" fill="#f8fafc" stroke="#0284c7" stroke-width="2" filter="url(#shadow2)"/>
    <rect x="0" y="0" width="150" height="32" rx="8" fill="#0284c7"/>
    <text x="75" y="21" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">2. CAPTURE</text>
    <text x="75" y="55" fill="#0369a1" font-size="12" font-weight="700" text-anchor="middle">Uploading</text>
    <text x="75" y="80" fill="#475569" font-size="10" text-anchor="middle">• Left Angle Photo</text>
    <text x="75" y="100" fill="#475569" font-size="10" text-anchor="middle">• Center Angle Photo</text>
    <text x="75" y="120" fill="#475569" font-size="10" text-anchor="middle">• Right Angle Photo</text>
    <text x="75" y="140" fill="#475569" font-size="10" text-anchor="middle">• Faculty Device (BYOD)</text>
    <rect x="20" y="165" width="110" height="26" rx="4" fill="#e0f2fe"/>
    <text x="75" y="182" fill="#0369a1" font-size="9" font-weight="700" text-anchor="middle">&lt; 30s Total Time</text>
  </g>

  <!-- Arrow 2 to 3 -->
  <line x1="360" y1="185" x2="388" y2="185" stroke="#0284c7" stroke-width="2.5" marker-end="url(#arrow)"/>

  <!-- Step 3 -->
  <g transform="translate(390, 80)">
    <rect x="0" y="0" width="150" height="210" rx="8" fill="#f8fafc" stroke="#059669" stroke-width="2" filter="url(#shadow2)"/>
    <rect x="0" y="0" width="150" height="32" rx="8" fill="#059669"/>
    <text x="75" y="21" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">3. AI PIPELINE</text>
    <text x="75" y="55" fill="#047857" font-size="12" font-weight="700" text-anchor="middle">Processing</text>
    <text x="75" y="78" fill="#475569" font-size="9.5" text-anchor="middle">1. YuNet Detection</text>
    <text x="75" y="96" fill="#475569" font-size="9.5" text-anchor="middle">2. 5-Point Alignment</text>
    <text x="75" y="114" fill="#475569" font-size="9.5" text-anchor="middle">3. ArcFace 512-d</text>
    <text x="75" y="132" fill="#475569" font-size="9.5" text-anchor="middle">4. Cosine Matching</text>
    <text x="75" y="150" fill="#475569" font-size="9.5" text-anchor="middle">5. Deduplication</text>
    <rect x="20" y="165" width="110" height="26" rx="4" fill="#d1fae5"/>
    <text x="75" y="182" fill="#047857" font-size="9" font-weight="700" text-anchor="middle">Sub-2s Execution</text>
  </g>

  <!-- Arrow 3 to 4 -->
  <line x1="540" y1="185" x2="568" y2="185" stroke="#0284c7" stroke-width="2.5" marker-end="url(#arrow)"/>

  <!-- Step 4 -->
  <g transform="translate(570, 80)">
    <rect x="0" y="0" width="150" height="210" rx="8" fill="#f8fafc" stroke="#d97706" stroke-width="2" filter="url(#shadow2)"/>
    <rect x="0" y="0" width="150" height="32" rx="8" fill="#d97706"/>
    <text x="75" y="21" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">4. HITL REVIEW</text>
    <text x="75" y="55" fill="#b45309" font-size="12" font-weight="700" text-anchor="middle">Review Required</text>
    <text x="75" y="80" fill="#059669" font-size="9.5" font-weight="600" text-anchor="middle">✓ Accepted (≥ 0.32)</text>
    <text x="75" y="100" fill="#d97706" font-size="9.5" font-weight="600" text-anchor="middle">⚠ Needs Review</text>
    <text x="75" y="120" fill="#64748b" font-size="9.5" font-weight="600" text-anchor="middle">✕ Not Detected</text>
    <text x="75" y="142" fill="#475569" font-size="9" text-anchor="middle">• Mandatory Justification</text>
    <rect x="15" y="165" width="120" height="26" rx="4" fill="#fef3c7"/>
    <text x="75" y="182" fill="#b45309" font-size="8.5" font-weight="700" text-anchor="middle">Audited Override</text>
  </g>

  <!-- Arrow 4 to 5 -->
  <line x1="720" y1="185" x2="748" y2="185" stroke="#0284c7" stroke-width="2.5" marker-end="url(#arrow)"/>

  <!-- Step 5 -->
  <g transform="translate(750, 80)">
    <rect x="0" y="0" width="130" height="210" rx="8" fill="#f8fafc" stroke="#0f172a" stroke-width="2" filter="url(#shadow2)"/>
    <rect x="0" y="0" width="130" height="32" rx="8" fill="#0f172a"/>
    <text x="65" y="21" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">5. COMMITTED</text>
    <text x="65" y="55" fill="#0f172a" font-size="12" font-weight="700" text-anchor="middle">Confirmed</text>
    <text x="65" y="80" fill="#475569" font-size="9.5" text-anchor="middle">• Session Locked</text>
    <text x="65" y="100" fill="#475569" font-size="9.5" text-anchor="middle">• Audit Trail Written</text>
    <text x="65" y="120" fill="#475569" font-size="9.5" text-anchor="middle">• 75% Gauges Sync</text>
    <text x="65" y="140" fill="#475569" font-size="9.5" text-anchor="middle">• 30-Day TTL Starts</text>
    <rect x="10" y="165" width="110" height="26" rx="4" fill="#f1f5f9"/>
    <text x="65" y="182" fill="#0f172a" font-size="8.5" font-weight="700" text-anchor="middle">Immutable State</text>
  </g>

  <!-- Bottom Legend -->
  <text x="450" y="335" fill="#64748b" font-size="10.5" text-anchor="middle">Complete end-to-end roll-call process executes in &lt; 30 seconds of classroom time, maintaining full teacher agency and indelible audit compliance.</text>
</svg>
"""

# Write to both the workspace and the artifact directory
dirs = [
    Path(r"c:\Users\dr_ra\Desktop\FinalMiniProject"),
    Path(r"C:\Users\dr_ra\.gemini\antigravity\brain\d325463a-36e9-427b-a30e-80a2e8b459b2")
]

for d in dirs:
    d.mkdir(parents=True, exist_ok=True)
    with open(d / "fig1_architecture.svg", "w", encoding="utf-8") as f:
        f.write(SVG1_CONTENT)
    with open(d / "fig2_flowchart.svg", "w", encoding="utf-8") as f:
        f.write(SVG2_CONTENT)
    print(f"Wrote SVG diagrams to {d}")

print("Successfully generated all block diagrams and flowcharts!")

