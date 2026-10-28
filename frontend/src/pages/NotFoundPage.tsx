import { Link } from "react-router-dom";

import { buttonClass } from "../components/Button";

interface Props {
  title?: string;
  hint?: string;
}

export function NotFoundPage({ title = "No encontramos esa página", hint }: Props) {
  return (
    <div className="grid min-h-[60dvh] place-items-center py-10">
      <div className="max-w-[28rem] rounded-box border-[3px] border-line bg-surface p-6 shadow-hard">
        <p aria-hidden="true" className="font-display text-[7rem] font-extrabold leading-none text-accent-deep">
          404
        </p>
        <h1 className="mt-2 text-balance font-display text-3xl font-extrabold leading-tight">{title}</h1>
        {hint && <p className="mt-3 text-muted">{hint}</p>}
        <Link to="/" className={buttonClass("primary", "mt-6")}>
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
