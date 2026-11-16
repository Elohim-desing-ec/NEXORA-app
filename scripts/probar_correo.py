#!/usr/bin/env python3
"""
Prueba el correo de NEXORA antes de configurarlo en Supabase.

Envía un correo de prueba desde el Gmail de la empresa a sí mismo usando la
"contraseña de aplicación" de Google (la misma que va en Supabase).
No guarda la contraseña en ningún lado: se escribe al ejecutar y se olvida.

Uso:
    python3 scripts/probar_correo.py                      # usa el correo de NEXORA
    python3 scripts/probar_correo.py otro.correo@gmail.com
"""
import getpass
import smtplib
import ssl
import sys
from email.message import EmailMessage

CORREO_NEXORA = "modacristiana2025@gmail.com"


def main() -> int:
    correo = (sys.argv[1] if len(sys.argv) > 1 else CORREO_NEXORA).strip()
    print(f"Gmail: {correo}")
    clave = getpass.getpass("Contraseña de aplicación (16 letras; no se muestra al escribir): ").replace(" ", "")
    if len(clave) != 16:
        print("✘ La contraseña de aplicación tiene 16 letras. Créela en https://myaccount.google.com/apppasswords")
        return 1

    msg = EmailMessage()
    msg["Subject"] = "NEXORA · Prueba de correo"
    msg["From"] = f"NEXORA <{correo}>"
    msg["To"] = correo
    msg.set_content(
        "¡Funciona!\n\n"
        "Gmail ya puede enviar los correos de NEXORA (confirmar cuenta, recuperar contraseña,\n"
        "bienvenida, comprobantes e invitaciones al equipo).\n\n"
        "Siguiente paso: pegue esta misma contraseña en Supabase (ver README, sección Correo)."
    )

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=20) as s:
            s.login(correo, clave)
            s.send_message(msg)
    except smtplib.SMTPAuthenticationError:
        print("✘ Gmail rechazó el ingreso. Revise que:\n"
              "  1) la verificación en dos pasos esté activa en esa cuenta, y\n"
              "  2) use una CONTRASEÑA DE APLICACIÓN (no la contraseña normal de Gmail).")
        return 1
    except (OSError, smtplib.SMTPException) as e:
        print(f"✘ No se pudo enviar: {e}")
        return 1

    print(f"✔ Correo de prueba enviado a {correo}. Revise la bandeja de entrada (o spam).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
