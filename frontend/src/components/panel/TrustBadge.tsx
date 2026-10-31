import { ShieldCheck, User, UserCheck, WarningCircle } from "@phosphor-icons/react";

import type { CustomerTrust, TrustLevel } from "../../lib/panelTypes";
import { TRUST_LABEL, trustLine } from "../../lib/trust";

const LOOK: Record<TrustLevel, { icon: typeof User; style: string }> = {
  // The strongest signal reads as solid ink, the worrying one as the danger color, and a stranger as a dashed outline.
  verified: { icon: ShieldCheck, style: "border-solid bg-line text-paper" },
  known: { icon: UserCheck, style: "border-solid bg-surface text-text" },
  new: { icon: User, style: "border-dashed bg-surface text-text" },
  flagged: { icon: WarningCircle, style: "border-solid border-danger bg-surface text-danger" },
};

/** Who is booking, at a glance, with what they did before underneath. */
export function TrustBadge({ trust }: { trust: CustomerTrust }) {
  const { icon: Icon, style } = LOOK[trust.level];

  return (
    <div className="grid gap-1">
      <span className={`inline-flex w-fit items-center gap-2 rounded-[8px] border-[3px] border-line px-2 py-1 font-display text-sm font-extrabold leading-none ${style}`}>
        <Icon aria-hidden="true" weight="bold" />
        {TRUST_LABEL[trust.level]}
      </span>
      <span className={`text-sm ${trust.level === "flagged" ? "font-semibold text-danger" : "text-muted"}`}>{trustLine(trust)}</span>
    </div>
  );
}
