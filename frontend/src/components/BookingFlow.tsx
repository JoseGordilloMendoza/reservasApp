import { CalendarX, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, api } from "../lib/api";
import { validateCustomer } from "../lib/customer";
import type { CustomerErrors, CustomerValues } from "../lib/customer";
import { formatShortDate, formatTime, groupSlotsByDay, upcomingDays } from "../lib/dates";
import { formatPrice } from "../lib/format";
import { useAvailability } from "../lib/queries";
import { saveBooking } from "../lib/storage";
import type { PublicBusiness } from "../lib/types";
import { whatsappLink } from "../lib/whatsapp";
import { Box } from "./Box";
import { Button, ButtonLink } from "./Button";
import { DateStrip } from "./DateStrip";
import { CheckField, Field } from "./Field";
import { ServicePicker, bookableOptions, optionId } from "./ServicePicker";
import { Skeleton } from "./Skeleton";
import { SlotGrid } from "./SlotGrid";

const DAYS_SHOWN = 14;

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`step-${number}`} className="flex flex-col gap-4">
      <h2 id={`step-${number}`} className="flex items-center gap-3 font-display text-2xl font-extrabold leading-none">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-line text-lg text-paper"
        >
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

const EMPTY_FORM: CustomerValues = { name: "", phone: "", email: "", accepted: false };

/** Server field names -> form field names. */
const SERVER_FIELDS: Record<string, keyof CustomerValues> = {
  "customer.name": "name",
  "customer.phone": "phone",
  "customer.email": "email",
  accepted_terms: "accepted",
};

export function BookingFlow({ business }: { business: PublicBusiness }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const timeZone = business.timezone;

  const options = useMemo(() => bookableOptions(business.resources), [business.resources]);
  const [optionKey, setOptionKey] = useState(() => (options[0] ? optionId(options[0]) : ""));
  const option = options.find((candidate) => optionId(candidate) === optionKey) ?? options[0];

  const days = useMemo(() => upcomingDays(timeZone, DAYS_SHOWN), [timeZone]);
  const availability = useAvailability(
    business.slug,
    option
      ? { resource: option.resource.id, service: option.service.id, from: days[0]!, to: days[days.length - 1]! }
      : null,
  );

  const slotsByDay = useMemo(
    () => groupSlotsByDay(availability.data?.slots ?? [], timeZone),
    [availability.data, timeZone],
  );
  const availableDays = useMemo(() => new Set(slotsByDay.keys()), [slotsByDay]);
  const firstDay = days.find((day) => availableDays.has(day)) ?? null;

  // Until the customer touches anything, the nearest free slot is already chosen.
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);
  const day = pickedDay && availableDays.has(pickedDay) ? pickedDay : firstDay;
  const daySlots = (day && slotsByDay.get(day)) || [];
  const nearest = firstDay ? (slotsByDay.get(firstDay)?.[0]?.starts_at ?? null) : null;
  const slot =
    pickedSlot && daySlots.some((candidate) => candidate.starts_at === pickedSlot)
      ? pickedSlot
      : pickedDay
        ? null
        : nearest;

  const [form, setForm] = useState<CustomerValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [focusTick, setFocusTick] = useState(0);

  // Runs after the errors are painted, when the invalid fields can be found.
  useEffect(() => {
    if (focusTick === 0) return;
    formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [focusTick]);

  function chooseOption(key: string) {
    setOptionKey(key);
    setPickedDay(null);
    setPickedSlot(null);
  }

  const create = useMutation({
    mutationFn: () =>
      api.createBooking(business.slug, {
        service: option!.service.id,
        starts_at: slot!,
        customer: { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() },
        accepted_terms: form.accepted,
      }),
    onSuccess: (booking) => {
      saveBooking({
        slug: business.slug,
        token: booking.manage_token,
        businessName: business.name,
        timeZone: business.timezone,
      });
      queryClient.setQueryData(["booking", booking.manage_token], booking);
      navigate(`/${business.slug}/reserva/${booking.manage_token}`, { state: { fresh: true } });
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) {
        setFormError("Algo salió mal. Inténtalo de nuevo en un momento.");
        return;
      }
      if (error.code === "invalid") {
        const fromServer: CustomerErrors = {};
        for (const [field, message] of Object.entries(error.fields)) {
          const key = SERVER_FIELDS[field];
          if (key) fromServer[key] = message;
        }
        setErrors(fromServer);
        setFormError(Object.keys(fromServer).length ? null : error.message);
        return;
      }
      setFormError(error.message);
      if (error.code === "slot_unavailable") {
        // Someone else took it: forget the choice and show what is free now.
        setPickedSlot(null);
        void queryClient.invalidateQueries({ queryKey: ["availability", business.slug] });
      }
    },
  });

  // Errors make no sense once the booking being described changes.
  useEffect(() => setFormError(null), [slot, optionKey]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateCustomer(form);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) {
      setFocusTick((tick) => tick + 1);
      return;
    }
    create.mutate();
  }

  if (!option) {
    return (
      <Box className="p-5 sm:p-6">
        <p className="font-display text-xl font-bold">Este negocio todavía no tiene nada para reservar.</p>
      </Box>
    );
  }

  const price = formatPrice(option.service.reference_price);
  const contact = whatsappLink(business.whatsapp, `Hola, quisiera reservar ${option.service.name}.`);
  const noSlotsAtAll = availability.isSuccess && availableDays.size === 0;

  return (
    <Box className="p-5 sm:p-6">
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-8">
        {options.length > 1 && (
          <Step number={1} title="¿Qué reservas?">
            <ServicePicker options={options} selected={optionId(option)} onSelect={chooseOption} />
          </Step>
        )}

        <Step number={options.length > 1 ? 2 : 1} title="¿Cuándo?">
          {availability.isPending && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className="h-[88px] w-[68px] shrink-0" />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton key={index} className="h-[60px]" />
                ))}
              </div>
            </div>
          )}

          {availability.isError && (
            <div role="alert" className="flex flex-col gap-3 rounded-box border-[3px] border-danger p-4">
              <p className="flex items-center gap-2 font-semibold text-danger">
                <WarningCircle aria-hidden="true" />
                No pudimos cargar los horarios.
              </p>
              <Button variant="plain" onClick={() => void availability.refetch()}>
                Intentar otra vez
              </Button>
            </div>
          )}

          {noSlotsAtAll && (
            <div className="flex flex-col items-start gap-4 rounded-box border-[3px] border-dashed border-line p-5">
              <CalendarX size={36} aria-hidden="true" />
              <p className="font-display text-xl font-bold leading-tight">
                No hay horarios libres en los próximos {DAYS_SHOWN} días.
              </p>
              {contact && (
                <ButtonLink href={contact} target="_blank" rel="noreferrer" variant="plain">
                  Preguntar por WhatsApp
                </ButtonLink>
              )}
            </div>
          )}

          {availability.isSuccess && !noSlotsAtAll && (
            <>
              <DateStrip days={days} available={availableDays} selected={day} onSelect={(next) => {
                setPickedDay(next);
                setPickedSlot(null);
              }} />
              <SlotGrid
                slots={daySlots}
                timeZone={timeZone}
                selected={slot}
                nearest={nearest}
                onSelect={(startsAt) => {
                  setPickedDay(day);
                  setPickedSlot(startsAt);
                }}
              />
            </>
          )}
        </Step>

        {slot && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 24 }}>
            <Step number={options.length > 1 ? 3 : 2} title="¿A nombre de quién?">
              <div className="grid gap-5">
                <Field
                  label="Tu nombre"
                  autoComplete="name"
                  value={form.name}
                  error={errors.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
                <Field
                  label="Tu celular"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="987 654 321"
                  hint="Para avisarte si algo cambia."
                  value={form.phone}
                  error={errors.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
                <Field
                  label="Correo (opcional)"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={form.email}
                  error={errors.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
                <CheckField
                  label={`Acepto que ${business.name} use mis datos para gestionar esta reserva.`}
                  checked={form.accepted}
                  error={errors.accepted}
                  onChange={(event) => setForm({ ...form, accepted: event.target.checked })}
                />
              </div>
            </Step>
          </motion.div>
        )}

        {formError && (
          <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-4 font-semibold text-danger">
            <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
            {formError}
          </p>
        )}

        <div className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-line bg-paper px-4 py-3 md:static md:border-0 md:bg-transparent md:p-0">
          <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4">
            <p className="min-w-0 text-sm leading-tight">
              {slot ? (
                <>
                  <span className="block truncate font-display text-base font-bold">{option.service.name}</span>
                  <span className="font-mono text-sm">
                    {formatShortDate(slot, timeZone)} {formatTime(slot, timeZone)}
                  </span>
                </>
              ) : (
                <span className="text-muted">Elige un horario para continuar.</span>
              )}
            </p>
            <Button type="submit" disabled={!slot || create.isPending} className="md:min-w-[200px]">
              {create.isPending ? "Reservando" : price ? `Reservar ${price}` : "Reservar"}
            </Button>
          </div>
        </div>
      </form>
    </Box>
  );
}
