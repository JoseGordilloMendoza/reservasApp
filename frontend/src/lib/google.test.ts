import { describe, expect, it } from "vitest";

import { readGoogleProfile } from "./google";

/** A token shaped like Google's: three parts, the middle one the claims in base64url. */
function token(claims: unknown) {
  const body = btoa(unescape(encodeURIComponent(JSON.stringify(claims)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `header.${body}.signature`;
}

describe("readGoogleProfile", () => {
  it("reads the name and the email, to show them and prefill the form", () => {
    expect(readGoogleProfile(token({ name: "Rosa Quispe", email: "rosa@gmail.com" }))).toEqual({
      name: "Rosa Quispe",
      email: "rosa@gmail.com",
    });
  });

  it("keeps accents in a name", () => {
    expect(readGoogleProfile(token({ name: "María Núñez", email: "maria@gmail.com" }))?.name).toBe("María Núñez");
  });

  it("works without a name", () => {
    expect(readGoogleProfile(token({ email: "rosa@gmail.com" }))).toEqual({ name: "", email: "rosa@gmail.com" });
  });

  it("gives nothing for something that is not a token, or has no email", () => {
    expect(readGoogleProfile("")).toBeNull();
    expect(readGoogleProfile("not-a-token")).toBeNull();
    expect(readGoogleProfile("a.@@@.c")).toBeNull();
    expect(readGoogleProfile(token({ name: "Rosa" }))).toBeNull();
    expect(readGoogleProfile(token({ email: 42 }))).toBeNull();
  });
});
