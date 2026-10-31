import { useEffect, useRef } from "react";

// The subset of Google Identity Services this app uses.
interface GoogleId {
  initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
  renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

/** The public id of the Google web client. Without it the button is not offered. */
export function googleClientId(): string | undefined {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || undefined;
}

const SCRIPT_URL = "https://accounts.google.com/gsi/client";
let loading: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Google script failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

interface Props {
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
  clientId?: string;
}

/** The four colors of Google's mark, as it must appear next to the words. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className="size-5 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * Sign in with Google, dressed in the look of the app. Google only hands over a verified token through its
 * own button, so that button is drawn invisible over ours: the person sees and presses ours, and the click
 * lands on Google's. The token it hands back is verified by the server.
 */
export function GoogleSignInButton({ onCredential, onError, clientId = googleClientId() }: Props) {
  const slot = useRef<HTMLDivElement>(null);
  // Callbacks change on every render; the button must be drawn once.
  const callbacks = useRef({ onCredential, onError });
  callbacks.current = { onCredential, onError };

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        const google = window.google?.accounts.id;
        if (cancelled || !google || !slot.current) return;
        google.initialize({
          client_id: clientId,
          callback: (response) => callbacks.current.onCredential(response.credential),
        });
        google.renderButton(slot.current, {
          type: "standard",
          theme: "filled_blue",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          locale: "es",
          width: slot.current.clientWidth || 320,
        });
      })
      .catch(() => {
        if (!cancelled) callbacks.current.onError("No pudimos cargar el acceso con Google. Usa tu correo y contraseña.");
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) return null;
  return (
    <div className="relative rounded-box focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-3 focus-within:outline-line">
      <span
        aria-hidden="true"
        className="press pointer-events-none flex min-h-[52px] items-center justify-center gap-3 rounded-box border-[3px] border-line bg-surface px-5 py-3 font-display text-lg font-bold leading-none text-text shadow-hard"
      >
        <GoogleMark />
        Continuar con Google
      </span>
      {/* Google's button is 40px tall; stretched to the height of ours so the whole of it can be pressed. */}
      <div
        ref={slot}
        aria-label="Entrar con Google"
        className="absolute inset-0 flex origin-center scale-y-[1.3] items-center justify-center overflow-hidden opacity-0"
      />
    </div>
  );
}
