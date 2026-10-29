import { CheckCircle } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { StandingStamp } from "../../components/platform/StandingStamp";
import { Skeleton } from "../../components/Skeleton";
import { Button } from "../../components/Button";
import { useAuth } from "../../lib/auth";
import { formatPrice } from "../../lib/format";
import { useDashboard } from "../../lib/platformQueries";
import type { BusinessFilter, Dashboard } from "../../lib/platformTypes";

const money = (amount: number | string) => formatPrice(String(amount)) ?? "S/ 0";

function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="grid content-between gap-2 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard-sm">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="font-display text-3xl font-extrabold leading-none">{value}</p>
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}

const BREAKDOWN: { key: keyof Dashboard["subscriptions"]; label: string; filter?: BusinessFilter }[] = [
  { key: "active", label: "Vigentes" },
  { key: "expiring_soon", label: "Por vencer esta semana", filter: "expiring" },
  { key: "grace", label: "En gracia", filter: "past_due" },
  { key: "expired", label: "Vencidas", filter: "past_due" },
  { key: "without_subscription", label: "Sin suscripción", filter: "no_subscription" },
];

function Attention({ items }: { items: Dashboard["attention"] }) {
  return (
    <section aria-labelledby="atencion" className="grid gap-3">
      <h2 id="atencion" className="font-display text-2xl font-extrabold">
        Requieren atención
        {items.length > 0 && <span className="ml-2 font-mono text-lg">{items.length}</span>}
      </h2>

      {items.length === 0 ? (
        <p className="flex items-center gap-3 rounded-box border-[3px] border-dashed border-line p-5 font-display text-xl font-bold leading-tight">
          <CheckCircle aria-hidden="true" size={28} className="shrink-0" />
          Todo al día: ninguna suscripción vence esta semana.
        </p>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.slug}>
              <Link
                to={`/plataforma/negocios/${item.slug}`}
                className="press flex items-center justify-between gap-3 rounded-box border-[3px] border-line bg-surface p-3 text-text shadow-hard-sm"
              >
                <span className="min-w-0 truncate font-display text-lg font-bold">{item.name}</span>
                <StandingStamp
                  suspended={item.suspended}
                  standing={{ state: item.state, valid_until: item.valid_until, grace_ends_on: null, days_left: item.days_left }}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PlatformHome() {
  const { user } = useAuth();
  const dashboard = useDashboard();
  const first = user?.name.split(" ")[0];

  if (dashboard.isError) {
    return (
      <div role="alert" className="grid gap-3 rounded-box border-[3px] border-danger p-4">
        <p className="font-semibold text-danger">No pudimos cargar los indicadores. {dashboard.error.message}</p>
        <Button variant="plain" onClick={() => void dashboard.refetch()}>
          Intentar otra vez
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-10">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">
        {first ? `Hola, ${first}` : "Hola"}
      </h1>

      {dashboard.isPending ? (
        <div className="grid gap-4" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-[160px]" />
          <Skeleton className="h-[200px]" />
        </div>
      ) : (
        <>
          <Attention items={dashboard.data.attention} />

          <section aria-labelledby="numeros" className="grid gap-3">
            <h2 id="numeros" className="font-display text-2xl font-extrabold">
              En números
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Tile
                label="Negocios activos"
                value={dashboard.data.businesses.active}
                hint={
                  dashboard.data.businesses.suspended > 0
                    ? `${dashboard.data.businesses.suspended} suspendidos`
                    : `de ${dashboard.data.businesses.total}`
                }
              />
              <Tile label="Reservas, 30 días" value={dashboard.data.bookings_30d} />
              <Tile label="Cobrado este mes" value={money(dashboard.data.revenue.received_this_month)} />
              <Tile label="Esperado al mes" value={money(dashboard.data.revenue.expected_monthly)} hint="de suscripciones en curso" />
            </div>
          </section>

          <section aria-labelledby="suscripciones" className="grid gap-3">
            <h2 id="suscripciones" className="font-display text-2xl font-extrabold">
              Suscripciones
            </h2>
            <ul className="grid gap-3">
              {BREAKDOWN.map(({ key, label, filter }) => {
                const row = (
                  <>
                    <span className="font-semibold">{label}</span>
                    <span className="font-mono text-xl font-bold">{dashboard.data.subscriptions[key]}</span>
                  </>
                );
                const style =
                  "flex items-center justify-between gap-3 rounded-box border-[3px] border-line bg-surface p-3 text-text";
                return (
                  <li key={key}>
                    {filter ? (
                      <Link to={`/plataforma/negocios?filtro=${filter}`} className={`press shadow-hard-sm ${style}`}>
                        {row}
                      </Link>
                    ) : (
                      <div className={style}>{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {dashboard.data.busiest.length > 0 && (
            <section aria-labelledby="activos" className="grid gap-3">
              <h2 id="activos" className="font-display text-2xl font-extrabold">
                Más activos
              </h2>
              <ol className="grid gap-3">
                {dashboard.data.busiest.map((business, index) => (
                  <li key={business.slug}>
                    <Link
                      to={`/plataforma/negocios/${business.slug}`}
                      className="press flex items-center gap-4 rounded-box border-[3px] border-line bg-surface p-3 text-text shadow-hard-sm"
                    >
                      <span className="w-6 font-mono text-xl font-bold text-muted">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-display text-lg font-bold">{business.name}</span>
                      <span className="font-mono text-lg font-bold">{business.bookings}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  );
}
