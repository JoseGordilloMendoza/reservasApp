"""The text of every email. Each function returns (subject, body) and sends nothing.

Plain text, short sentences, Peruvian Spanish. Dates are shown in the business's own timezone.
"""

from zoneinfo import ZoneInfo

from django.conf import settings

WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MONTHS = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]  # fmt: skip


def when(moment, business):
    """'lunes 7 de enero a las 19:00' in the business's timezone."""
    local = moment.astimezone(ZoneInfo(business.timezone))
    return (
        f"{WEEKDAYS[local.weekday()]} {local.day} de {MONTHS[local.month - 1]} "
        f"a las {local:%H:%M}"
    )


def ticket_url(business, token):
    return f"{settings.FRONTEND_URL}/{business.slug}/reserva/{token}"


def panel_url(booking):
    return f"{settings.FRONTEND_URL}/panel/reservas/{booking.id}"


def _soles(amount):
    """S/ 60 for a whole amount, S/ 45.50 otherwise."""
    return f"S/ {amount:.0f}" if amount == amount.to_integral() else f"S/ {amount:.2f}"


def _details(booking):
    business = booking.business
    lines = [
        f"{booking.service.name} · {booking.resource.name}",
        when(booking.starts_at, business),
    ]
    if booking.price_snapshot is not None:
        lines.append(f"Precio de referencia: {_soles(booking.price_snapshot)}")
    return "\n".join(lines)


def _contact(business):
    """How the customer can reach the business, when it left a way."""
    lines = []
    if business.whatsapp:
        digits = business.whatsapp.lstrip("+")
        lines.append(f"WhatsApp: https://wa.me/{digits}")
    if business.phone:
        lines.append(f"Teléfono: {business.phone}")
    if business.address:
        lines.append(f"Dirección: {business.address}")
    return "\n".join(lines)


def _customer_mail(booking, intro, *, token=None, closing=""):
    business = booking.business
    parts = [f"Hola {booking.customer.name},", intro, _details(booking)]
    if token:
        parts.append(
            "Aquí puedes ver tu reserva o cancelarla (guarda este correo, el enlace no se envía otra vez):\n"
            + ticket_url(business, token)
        )
    if closing:
        parts.append(closing)
    contact = _contact(business)
    if contact:
        parts.append(f"¿Dudas? Habla con {business.name}:\n{contact}")
    parts.append(f"{business.name}")
    return "\n\n".join(parts)


# --- to the customer --------------------------------------------------------------------


def customer_received(booking, token):
    """Booked online and waiting for the business to answer."""
    business = booking.business
    hold = ""
    if booking.expires_at:
        hold = (
            f"{business.name} debe confirmarla. Si no responde antes del "
            f"{when(booking.expires_at, business)}, el horario se libera."
        )
    return (
        f"Recibimos tu reserva en {business.name}",
        _customer_mail(
            booking,
            "Recibimos tu reserva y está pendiente de confirmación.",
            token=token,
            closing=hold,
        ),
    )


def customer_confirmed(booking, token=None):
    """Confirmed: right away (automatic mode, or written down by the business) or by the business later.

    The ticket link is only available at creation, so later emails come without it.
    """
    business = booking.business
    return (
        f"Tu reserva en {business.name} está confirmada",
        _customer_mail(booking, "Tu reserva está confirmada. Te esperamos.", token=token),
    )


def customer_rejected(booking):
    business = booking.business
    return (
        f"{business.name} no pudo aceptar tu reserva",
        _customer_mail(
            booking,
            f"Lamentamos avisarte que {business.name} no pudo aceptar tu reserva.",
            closing=f"Puedes elegir otro horario aquí: {settings.FRONTEND_URL}/{business.slug}",
        ),
    )


def customer_cancelled_by_business(booking):
    business = booking.business
    return (
        f"{business.name} canceló tu reserva",
        _customer_mail(
            booking,
            f"Lamentamos avisarte que {business.name} canceló tu reserva.",
            closing=f"Puedes reservar otro horario aquí: {settings.FRONTEND_URL}/{business.slug}",
        ),
    )


def customer_expired(booking):
    business = booking.business
    return (
        f"Tu reserva en {business.name} venció",
        _customer_mail(
            booking,
            f"{business.name} no llegó a confirmar tu reserva a tiempo y el horario se liberó.",
            closing=f"Puedes intentar con otro horario aquí: {settings.FRONTEND_URL}/{business.slug}",
        ),
    )


# --- to the business --------------------------------------------------------------------


def business_new_booking(booking):
    """A customer booked online."""
    business = booking.business
    customer = booking.customer
    pending = booking.expires_at is not None
    status = (
        f"Está pendiente: confírmala o recházala antes del {when(booking.expires_at, business)}, "
        "o el horario se libera solo."
        if pending
        else "Quedó confirmada automáticamente."
    )
    contact = f"{customer.name} · {customer.phone}"
    if customer.email:
        contact += f" · {customer.email}"
    body = "\n\n".join(
        [
            f"Llegó una reserva nueva en {business.name}.",
            f"{_details(booking)}\n{contact}",
            status,
            f"Ábrela en el panel:\n{panel_url(booking)}",
        ]
    )
    return f"Nueva reserva de {customer.name}: {when(booking.starts_at, business)}", body


def business_cancelled_by_customer(booking):
    business = booking.business
    customer = booking.customer
    body = "\n\n".join(
        [
            f"{customer.name} canceló su reserva en {business.name}. El horario quedó libre.",
            f"{_details(booking)}\n{customer.name} · {customer.phone}",
            f"Verla en el panel:\n{panel_url(booking)}",
        ]
    )
    return f"{customer.name} canceló su reserva: {when(booking.starts_at, business)}", body
