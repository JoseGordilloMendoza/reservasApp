import { Check, HandCoins, UserCheck, X } from "@phosphor-icons/react";
import { useState } from "react";

import { formatTime } from "../../lib/dates";
import { ApiError } from "../../lib/http";
import { useRecordBooking } from "../../lib/panelQueries";
import type { PanelBookingDetail, PaymentMethod } from "../../lib/panelTypes";
import { METHOD_LABEL, METHODS, paymentLine } from "../../lib/payment";
import { Button } from "../Button";
import { Field } from "../Field";
import { TextAreaField } from "../TextAreaField";

/** The statuses in which a customer can still arrive. The server decides; this only hides the button. */
const CAN_ARRIVE = ["pending", "confirmed", "completed"];

interface Props {
  booking: PanelBookingDetail;
  timeZone: string;
}

/**
 * What the owner writes down about a booking: whether the customer arrived, what they paid and how, and a
 * private note. The platform charges nothing, so this is only a record between the two of them.
 */
export function PaymentCard({ booking, timeZone }: Props) {
  const record = useRecordBooking(booking.id);
  const [method, setMethod] = useState<PaymentMethod | "">(booking.payment_method);
  const [depositing, setDepositing] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState(booking.internal_note);

  const paid = booking.payment_status === "paid";
  const noteChanged = note.trim() !== booking.internal_note;
  // A refused amount is shown next to the amount; anything else goes in the alert at the end.
  const amountError = record.error instanceof ApiError ? record.error.fields.amount_paid : undefined;

  return (
    <section aria-labelledby="pago" className="grid gap-5 rounded-box border-[3px] border-line bg-surface p-5 text-text shadow-hard">
      <h2 id="pago" className="font-display text-2xl font-extrabold">
        Pago y llegada
      </h2>

      <div className="grid gap-3">
        <p className="flex items-center gap-2 font-semibold">
          <UserCheck aria-hidden="true" />
          {booking.arrived_at ? `Llegó a las ${formatTime(booking.arrived_at, timeZone)}` : "Aún no llega"}
        </p>
        {CAN_ARRIVE.includes(booking.status) && (
          <Button
            variant={booking.arrived_at ? "plain" : "primary"}
            onClick={() => record.mutate({ arrived: !booking.arrived_at })}
            disabled={record.isPending}
          >
            {booking.arrived_at ? "Deshacer llegada" : "Llegó"}
          </Button>
        )}
      </div>

      <div className="grid gap-3 border-t-[3px] border-dashed border-line/40 pt-5">
        <p className="flex items-center gap-2 font-semibold">
          <HandCoins aria-hidden="true" />
          {paymentLine(booking)}
        </p>

        <fieldset className="grid gap-2">
          <legend className="font-display text-base font-bold">¿Cómo pagó?</legend>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((id) => (
              <label key={id} className="cursor-pointer">
                <input
                  type="radio"
                  name="metodo"
                  value={id}
                  checked={method === id}
                  onChange={() => setMethod(id)}
                  className="peer sr-only"
                />
                <span className="inline-block rounded-box border-[3px] border-line bg-surface px-3 py-2 font-display font-bold peer-checked:bg-line peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2">
                  {METHOD_LABEL[id]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {!paid && (
          <Button onClick={() => record.mutate({ payment_status: "paid", payment_method: method })} disabled={record.isPending}>
            <Check aria-hidden="true" />
            Pagó todo
          </Button>
        )}

        {!depositing && !paid && (
          <Button variant="plain" onClick={() => setDepositing(true)}>
            Dejó un adelanto
          </Button>
        )}

        {depositing && !paid && (
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              record.mutate(
                { payment_status: "deposit", amount_paid: amount, payment_method: method },
                { onSuccess: () => setDepositing(false) },
              );
            }}
          >
            <Field
              label="Monto del adelanto (S/)"
              inputMode="decimal"
              value={amount}
              error={amountError}
              onChange={(event) => setAmount(event.target.value)}
            />
            <Button type="submit" disabled={record.isPending || amount.trim() === ""}>
              Guardar adelanto
            </Button>
          </form>
        )}

        {booking.payment_status !== "unpaid" && (
          <Button
            variant="plain"
            onClick={() => record.mutate({ payment_status: "unpaid" })}
            disabled={record.isPending}
          >
            Quitar el pago
          </Button>
        )}
      </div>

      <form
        className="grid gap-3 border-t-[3px] border-dashed border-line/40 pt-5"
        onSubmit={(event) => {
          event.preventDefault();
          record.mutate({ internal_note: note.trim() });
        }}
      >
        <TextAreaField
          label="Nota privada"
          hint="Solo la ves tú y tu equipo. Por ejemplo: me paga el viernes."
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <Button type="submit" variant="plain" disabled={record.isPending || !noteChanged}>
          Guardar nota
        </Button>
      </form>

      {record.error && !amountError && (
        <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-3 font-semibold text-danger">
          <X aria-hidden="true" className="mt-0.5 shrink-0" />
          {record.error.message}
        </p>
      )}
    </section>
  );
}
