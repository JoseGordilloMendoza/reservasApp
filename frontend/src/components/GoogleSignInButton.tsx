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

/** Google's own button. The token it hands back is verified by the server. */
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
          theme: "filled_black",
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
  return <div ref={slot} aria-label="Entrar con Google" className="flex min-h-[44px] w-full justify-center" />;
}
