import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebounced } from "./useDebounced";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("waiting for typing to pause", () => {
  it("starts with the value it is given", () => {
    const { result } = renderHook(() => useDebounced("hola", 300));

    expect(result.current).toBe("hola");
  });

  it("holds the old value until the pause", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounced(value, 300), { initialProps: { value: "a" } });

    rerender({ value: "ab" });
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("ab");
  });

  it("restarts the wait with every change, so only the last one gets through", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounced(value, 300), { initialProps: { value: "a" } });

    rerender({ value: "ab" });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: "abc" });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("abc");
  });
});
