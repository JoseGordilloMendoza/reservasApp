import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ScrollToTop } from "./ScrollToTop";

const scrollTo = () => vi.mocked(window.scrollTo);

function app() {
  render(
    <MemoryRouter initialEntries={["/uno"]}>
      <ScrollToTop />
      <Link to="/dos">otra pagina</Link>
      <Link to="/uno?filtro=x">misma pagina</Link>
      <Routes>
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("opening a new page", () => {
  beforeEach(() => scrollTo().mockClear());

  it("starts at the top when the page changes", async () => {
    app();
    scrollTo().mockClear();

    await userEvent.click(screen.getByRole("link", { name: "otra pagina" }));

    expect(scrollTo()).toHaveBeenCalledWith(0, 0);
  });

  it("does not jump when only the query of the same page changes", async () => {
    app();
    scrollTo().mockClear();

    await userEvent.click(screen.getByRole("link", { name: "misma pagina" }));

    expect(scrollTo()).not.toHaveBeenCalled();
  });
});
