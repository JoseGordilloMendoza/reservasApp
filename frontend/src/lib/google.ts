/** What Google says about the person, read from the ID token it handed the browser. */
export interface GoogleProfile {
  name: string;
  email: string;
}

/**
 * Reads the name and email out of a Google ID token only to show them and prefill the form. The browser
 * cannot check the token's signature: the server does, and it alone decides whether the person is verified.
 */
export function readGoogleProfile(credential: string): GoogleProfile | null {
  try {
    const payload = credential.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), (char) => char.charCodeAt(0)));
    const claims = JSON.parse(json) as { name?: unknown; email?: unknown };
    if (typeof claims.email !== "string" || !claims.email) return null;
    return { name: typeof claims.name === "string" ? claims.name : "", email: claims.email };
  } catch {
    return null;
  }
}
