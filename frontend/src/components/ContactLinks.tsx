import { Phone, WhatsappLogo } from "@phosphor-icons/react";

import { displayPhone, telLink, whatsappLink } from "../lib/whatsapp";

const LINK =
  "press inline-flex min-h-[44px] items-center gap-2 rounded-box border-[3px] border-line bg-surface px-3 py-2 " +
  "text-sm font-semibold text-text shadow-hard-sm";

interface Props {
  phone: string;
  /** What the WhatsApp chat starts with. */
  message: string;
}

/** Call and chat with a customer in one tap. */
export function ContactLinks({ phone, message }: Props) {
  const call = telLink(phone);
  const chat = whatsappLink(phone, message);

  return (
    <div className="flex flex-wrap gap-2">
      {call && (
        <a href={call} className={LINK}>
          <Phone aria-hidden="true" />
          {displayPhone(phone)}
        </a>
      )}
      {chat && (
        <a href={chat} target="_blank" rel="noreferrer" className={LINK}>
          <WhatsappLogo aria-hidden="true" />
          WhatsApp
        </a>
      )}
    </div>
  );
}
