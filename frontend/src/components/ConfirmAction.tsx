import { useState } from "react";
import type { ReactNode } from "react";

import { Button } from "./Button";

interface Props {
  /** The button that starts the action. */
  label: string;
  /** The question asked before doing it. */
  question: string;
  /** Wording of the button that goes ahead. */
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
  children?: ReactNode;
}

/** For actions that cannot be undone: the first tap asks, the second one does it. */
export function ConfirmAction({ label, question, confirmLabel, onConfirm, busy = false }: Props) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Button variant="plain" onClick={() => setAsking(true)} disabled={busy}>
        {label}
      </Button>
    );
  }

  return (
    <div role="group" aria-label={question} className="grid gap-3 rounded-box border-[3px] border-line bg-surface p-4">
      <p className="font-display text-lg font-bold leading-tight">{question}</p>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="ink"
          disabled={busy}
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
        <Button variant="plain" onClick={() => setAsking(false)}>
          No
        </Button>
      </div>
    </div>
  );
}
