import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

def send_password_email(to_email: str, name: str, password: str):
    from_email = os.getenv("MAIL_EMAIL")
    from_password = os.getenv("MAIL_PASSWORD")

    subject = "Your Account Has Been Created"
    body = f"""
    Hello {name},

    Your account has been created successfully.

    Here are your login credentials:
    Email: {to_email}
    Password: {password}

    Please log in and change your password as soon as possible.

    Regards,
    BI App Team
    """

    msg = MIMEMultipart()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(from_email, from_password)
            server.sendmail(from_email, to_email, msg.as_string())
    except Exception as e:
        raise Exception(f"Failed to send email: {str(e)}")