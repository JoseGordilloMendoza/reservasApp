import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";

import { App } from "./App";
import { retryUnlessClientError } from "./lib/queries";
import "./styles/index.css";

// Keeps the installed app up to date: a new version replaces the old one on the next visit.
registerSW({ immediate: true });

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: retryUnlessClientError } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Honors prefers-reduced-motion for every animation in the app. */}
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
