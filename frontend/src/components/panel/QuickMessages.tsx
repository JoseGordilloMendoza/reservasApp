import { WhatsappLogo } from "@phosphor-icons/react";

import type { PanelBooking } from "../../lib/panelTypes";
import { quickMessages } from "../../lib/quickMessages";
import { buttonClass } from "../Button";

interface Props {
  booking: PanelBooking;
  business: string;
  timeZone: string;
  paymentInstructions: string;
}

/** WhatsApp messages written for the situation of this booking: one tap to open the chat with the text ready. */
export function QuickMessages({ booking, business, timeZone, paymentInstructions }: Props) {
  const messages = quickMessages(booking, { business, timeZone, paymentInstructions }).filter((message) => message.href);
  if (messages.length === 0) return null;

  return (
    <section aria-labelledby="mensajes" className="grid gap-3">
      <h2 id="mensajes" className="font-display text-2xl font-extrabold">
        Escribirle por WhatsApp
      </h2>
      <p className="text-sm text-muted">Se abre el chat con el mensaje ya escrito. No se envía hasta que lo mandes tú.</p>
      {messages.map((message) => (
        <a key={message.id} href={message.href!} target="_blank" rel="noreferrer" className={buttonClass("plain")}>
          <WhatsappLogo aria-hidden="true" />
          {message.label}
        </a>
      ))}
    </section>
  );
}
