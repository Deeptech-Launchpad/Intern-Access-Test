"""
Email utility for sending candidate test links using Gmail SMTP.
Uses SMTP_EMAIL and SMTP_APP_PASSWORD from environment/.env file.
"""
import smtplib
import os
from pathlib import Path
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

# Load .env from the backend root directory regardless of where we're called from
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path, override=True)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_APP_PASSWORD = os.getenv("SMTP_APP_PASSWORD", "")
SENDER_NAME = os.getenv("SENDER_NAME", "InternAssess Portal")


def send_test_link_email(
    candidate_name: str,
    candidate_email: str,
    test_link: str,
    expires_at: str,
    job_position: str = "",
    assessment_title: str = "",
    experience_level: str = "",
) -> bool:
    """
    Send a test link email to the candidate.
    Returns True on success, False on failure.
    """
    if not SMTP_EMAIL or not SMTP_APP_PASSWORD:
        print("[WARN] SMTP not configured. Email not sent. Set SMTP_EMAIL and SMTP_APP_PASSWORD in .env")
        return False

    exp_label = "Experienced" if experience_level == "experienced" else "Fresher"
    role_line = f"{job_position} ({exp_label})" if job_position else "Assessment"
    subject_title = assessment_title if assessment_title else "InternAssess MCQ Test"

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Your {subject_title} Test Link — {role_line}"
        msg["From"] = f"{SENDER_NAME} <{SMTP_EMAIL}>"
        msg["To"] = candidate_email

        # Plain text fallback
        plain = f"""
Hello {candidate_name},

You have been invited to take the {subject_title} for the role of {role_line}.

Your unique test link (valid for 1 hour):
{test_link}

Expires at: {expires_at}

Instructions:
- Open the link on a Desktop or Laptop browser only
- Do NOT switch tabs or minimize the window during the test
- Answer all questions before submitting
- You cannot re-take the test once submitted

Good luck!
InternAssess Team
        """.strip()

        # HTML version
        html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a56db,#1e40af);padding:36px 40px;text-align:center;">
      <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:10px;padding:10px 18px;margin-bottom:16px;">
        <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:1px;">IA</span>
      </div>
      <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;">InternAssess</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Internship Assessment Portal</p>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <h2 style="font-size:20px;color:#111827;margin-bottom:20px;">Hello, {candidate_name}!</h2>

      <p style="color:#6b7280;font-size:15px;line-height:1.6;margin-bottom:28px;">
        You have been invited to take the <strong>{subject_title}</strong> for the role of
        <strong>{role_line}</strong>.
        Click the button below to begin your assessment.
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="{test_link}"
           style="display:inline-block;background:#1a56db;color:#fff;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">
          Start My Test →
        </a>
      </div>

      <!-- Link box -->
      <div style="background:#f5f7fb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
        <p style="font-size:12px;color:#6b7280;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Or copy this link:</p>
        <p style="font-size:13px;color:#1a56db;margin:0;word-break:break-all;">{test_link}</p>
      </div>

      <!-- Expiry -->
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
        <p style="font-size:13px;color:#9a3412;margin:0;">
          <strong>Expires at:</strong> {expires_at} IST &nbsp;|&nbsp; <strong>Valid for 1 hour only</strong>
        </p>
      </div>

      <!-- Rules -->
      <h3 style="font-size:14px;color:#374151;margin-bottom:10px;">Important Instructions:</h3>
      <ul style="color:#6b7280;font-size:14px;line-height:1.8;padding-left:20px;">
        <li>Open the link on a <strong>Desktop or Laptop</strong> only (mobiles/tablets are blocked)</li>
        <li>Do <strong>NOT</strong> switch tabs or minimize the window during the test</li>
        <li>Answer all questions before submitting</li>
        <li>The test <strong>auto-submits</strong> on the 3rd tab switch</li>
        <li>You cannot re-take the test once submitted</li>
      </ul>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
      <p style="font-size:12px;color:#9ca3af;margin:0;">
        This is an automated message from InternAssess. Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
        """.strip()

        msg.attach(MIMEText(plain, "plain"))
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
            server.sendmail(SMTP_EMAIL, candidate_email, msg.as_string())

        print(f"[OK] Email sent to {candidate_email} ({role_line})")
        return True

    except Exception as e:
        print(f"[ERROR] Failed to send email to {candidate_email}: {e}")
        return False
