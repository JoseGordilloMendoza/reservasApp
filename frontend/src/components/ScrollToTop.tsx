import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** A new page opens at its top, not at the scroll position of the one before it. */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
