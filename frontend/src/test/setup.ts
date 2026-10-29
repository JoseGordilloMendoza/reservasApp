import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { clearSession } from "../lib/session";

// jsdom lacks a few browser APIs the app relies on.
beforeEach(() => {
  localStorage.clear();
  clearSession();
  // The dev container defines a Google client id; tests decide for themselves.
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });

  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.scrollTo = vi.fn();
});

afterEach(() => {
  cleanup();
});
