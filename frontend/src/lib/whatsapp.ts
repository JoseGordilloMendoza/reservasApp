/** A wa.me link that opens a chat with the message already written. */
export function whatsappLink(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Digits only, for tel: links. Keeps a leading plus. */
export function telLink(phone: string): string | null {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned.length >= 8 ? `tel:${cleaned}` : null;
}

/** "+51987654321" -> "987 654 321" for display. Other countries are shown as given. */
export function displayPhone(phone: string): string {
  const match = /^\+51(\d{3})(\d{3})(\d{3})$/.exec(phone);
  return match ? `${match[1]} ${match[2]} ${match[3]}` : phone;
}
