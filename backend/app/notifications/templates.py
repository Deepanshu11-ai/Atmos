"""Professional alert templates (email + WhatsApp).
Email: poori detail + usage table. WhatsApp: chhota aur seedha message.
ctx keys: name, dept, pct, remaining, used, budget (unit apne aap judta hai)."""
from html import escape

UNIT = "credits"          # budget ki unit; project mein jo use ho wahi likho (jaise "tCO2e")
DEFAULT_TONE = "formal"

LEVEL_LABELS = {
    "WARNING": "ADVISORY",
    "CRITICAL": "ACTION REQUIRED",
    "EXCEEDED": "BUDGET EXCEEDED",
}
COLORS = {"WARNING": "#b45309", "CRITICAL": "#c2410c", "EXCEEDED": "#b91c1c"}

# ---------------- Email (subject, body) ----------------
# Body mein blank line (\n\n) = naya paragraph
TEMPLATES = {
    "formal": {
        "WARNING": (
            "Carbon Budget Advisory: {dept} has used {pct}% of its allocation",
            "Dear {name},\n\n"
            "This is an advisory notification from the Atmos Carbon Management Platform. "
            "The {dept} department has consumed {pct}% of its allocated carbon budget "
            "for the current period.\n\n"
            "We recommend reviewing the department's current emission sources and "
            "planning corrective measures so that usage remains within the allocation.\n\n"
            "Please sign in to the Atmos dashboard to view the detailed breakdown.",
        ),
        "CRITICAL": (
            "Action Required: {dept} carbon budget at {pct}%",
            "Dear {name},\n\n"
            "The {dept} department has consumed {pct}% of its allocated carbon budget, "
            "with {remaining} {unit} remaining. At the current rate of usage, the "
            "allocation may be exhausted shortly.\n\n"
            "An immediate review is recommended. Please take steps to reduce emissions "
            "or request additional credits from the administrator to avoid restrictions "
            "on the department.\n\n"
            "Detailed figures are available on the Atmos dashboard.",
        ),
        "EXCEEDED": (
            "Carbon Budget Exceeded: {dept} has been locked",
            "Dear {name},\n\n"
            "The {dept} department has exhausted its allocated carbon budget "
            "(usage: {used} {unit} against an allocation of {budget} {unit}). "
            "In accordance with the carbon budget policy, the department has been locked.\n\n"
            "To restore access, please coordinate with the administrator to allocate "
            "additional credits or revise the department's allocation.\n\n"
            "Detailed figures are available on the Atmos dashboard.",
        ),
    },
}

# ---------------- WhatsApp (chhote messages) ----------------
# ---------------- WhatsApp ----------------
# Yeh text Twilio Content Template ki body se EXACT match hona chahiye:
# "Atmos Carbon Management Platform: {{1}}. The {{2}} department has used {{3}}% of its
#  allocated carbon budget. Remaining: {{4}}. Please review the Atmos dashboard for details."
WA_TEXT = (
    "Atmos Carbon Management Platform: {label}. The {dept} department has used "
    "{pct}% of its allocated carbon budget. Remaining: {remaining}. "
    "Please review the Atmos dashboard for details."
)
WA_LABELS = {
    "WARNING": "Carbon budget advisory",
    "CRITICAL": "Action required",
    "EXCEEDED": "Carbon budget exceeded",
}


def whatsapp_params(level_name: str, ctx: dict) -> list[str]:
    """Template variables {{1}}..{{4}} ka fixed order."""
    c = _with_unit(ctx)
    return [
        WA_LABELS[level_name],
        str(c["dept"]),
        str(c["pct"]),
        f'{c["remaining"]} {c["unit"]}',
    ]


def build_whatsapp(level_name: str, ctx: dict) -> str:
    """Template ka rendered text (free-form body aur log, dono ke liye)."""
    label, dept, pct, remaining = whatsapp_params(level_name, ctx)
    return WA_TEXT.format(label=label, dept=dept, pct=pct, remaining=remaining)

def _with_unit(ctx: dict) -> dict:
    return {"unit": UNIT, **ctx}


def build_message(tone: str, level_name: str, ctx: dict) -> tuple[str, str]:
    """Email ke liye (subject, body). Unknown tone par formal use hota hai."""
    subject, body = TEMPLATES.get(tone, TEMPLATES[DEFAULT_TONE])[level_name]
    ctx = _with_unit(ctx)
    return subject.format(**ctx), body.format(**ctx)


def to_html(subject: str, body: str, level_name: str, ctx: dict | None = None) -> str:
    """Email ka HTML: coloured header, paragraphs, aur (ctx mile to) usage table."""
    color = COLORS.get(level_name, "#15803d")
    label = LEVEL_LABELS.get(level_name, "NOTICE")

    paragraphs = "".join(
        f'<p style="margin:0 0 14px;line-height:1.6">{escape(p).replace(chr(10), "<br>")}</p>'
        for p in body.split("\n\n")
    )

    table = ""
    if ctx:
        c = _with_unit(ctx)
        rows = [
            ("Department", c["dept"]),
            ("Allocated budget", f'{c["budget"]} {c["unit"]}'),
            ("Used", f'{c["used"]} {c["unit"]}'),
            ("Remaining", f'{c["remaining"]} {c["unit"]}'),
            ("Utilisation", f'{c["pct"]}%'),
        ]
        cells = "".join(
            f'<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;'
            f'width:45%">{escape(str(k))}</td>'
            f'<td style="padding:8px 12px;border:1px solid #e5e7eb">{escape(str(v))}</td></tr>'
            for k, v in rows
        )
        table = (
            '<table style="border-collapse:collapse;width:100%;margin:6px 0 18px;'
            f'font-size:14px">{cells}</table>'
        )

    return f"""
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;
            border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;color:#111827">
  <div style="background:{color};color:#ffffff;padding:14px 20px">
    <div style="font-size:12px;letter-spacing:1px">{label}</div>
    <div style="font-size:16px;font-weight:bold;margin-top:2px">
      Atmos Carbon Management Platform
    </div>
  </div>
  <div style="padding:20px;font-size:14px">
    <h3 style="margin:0 0 14px;font-size:16px">{escape(subject)}</h3>
    {paragraphs}
    {table}
    <p style="margin:18px 0 0;padding-top:12px;border-top:1px solid #e5e7eb;
              color:#6b7280;font-size:12px;line-height:1.5">
      This is an automated message from the Atmos Carbon Management Platform.
      Please do not reply to this email.
    </p>
  </div>
</div>"""