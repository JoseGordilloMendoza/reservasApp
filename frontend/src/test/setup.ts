import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { createElement, type ComponentType } from "react";
import { afterEach, beforeAll, beforeEach, vi } from "vitest";

import { clearSession } from "../lib/session";

// The app loads each screen when it is first opened (React.lazy). Tests look for what a screen shows
// right after rendering it, so here the screens are loaded first and then drawn as plain components.
const loading: Promise<unknown>[] = [];
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    lazy: (load: () => Promise<{ default: ComponentType<object> }>) => {
      let screen: ComponentType<object> | undefined;
      loading.push(load().then((module) => (screen = module.default)));
      return (props: object) => (screen ? createElement(screen, props) : null);
    },
  };
});
beforeAll(() => Promise.all(loading));

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
