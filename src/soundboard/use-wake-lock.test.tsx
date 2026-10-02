import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "./use-wake-lock";

function installWakeLock() {
  const sentinels: Array<{ release: ReturnType<typeof vi.fn> }> = [];
  const request = vi.fn(() => {
    const sentinel = { release: vi.fn(() => Promise.resolve()) };
    sentinels.push(sentinel);
    return Promise.resolve(sentinel);
  });
  Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
  return { request, sentinels };
}

const flush = () => Promise.resolve().then(() => Promise.resolve());

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "wakeLock");
});

describe("useWakeLock", () => {
  it("requests the lock on mount and releases it on unmount", async () => {
    const { request, sentinels } = installWakeLock();

    const { unmount } = renderHook(() => useWakeLock(true));
    await flush();

    expect(request).toHaveBeenCalledWith("screen");
    unmount();
    expect(sentinels[0].release).toHaveBeenCalled();
  });

  it("request() asks again inside a gesture and keeps only the newest lock", async () => {
    const { request, sentinels } = installWakeLock();
    const { result } = renderHook(() => useWakeLock(true));
    await flush();

    result.current();
    await flush();

    expect(request).toHaveBeenCalledTimes(2);
    expect(sentinels[0].release).toHaveBeenCalled();
    expect(sentinels[1].release).not.toHaveBeenCalled();
  });

  it("request() keeps a stable identity and does nothing when inactive or unsupported", async () => {
    const { request } = installWakeLock();
    const { result, rerender } = renderHook(({ active }) => useWakeLock(active), {
      initialProps: { active: false },
    });
    const first = result.current;

    expect(() => result.current()).not.toThrow();
    rerender({ active: false });

    expect(result.current).toBe(first);
    expect(request).not.toHaveBeenCalled();

    Reflect.deleteProperty(navigator, "wakeLock");
    const unsupported = renderHook(() => useWakeLock(true));
    expect(() => unsupported.result.current()).not.toThrow();
  });
});
