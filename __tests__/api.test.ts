import { fetchWithTimeout } from "../src/services/api";

// Mock fetch globally
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns response on successful fetch", async () => {
    const mockResponse = { ok: true, json: async () => ({ text: "hello" }) };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await fetchWithTimeout("http://example.com/api", {}, 5000);
    expect(result.ok).toBe(true);
  });

  it("passes abort signal to fetch", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await fetchWithTimeout(
      "http://example.com/api",
      { method: "POST" },
      5000
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "http://example.com/api",
      expect.objectContaining({
        method: "POST",
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("aborts when timeout is exceeded", async () => {
    // fetch that never resolves
    mockFetch.mockImplementation(
      (_url: string, opts: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError"))
          );
        })
    );

    await expect(
      fetchWithTimeout("http://example.com/api", {}, 50)
    ).rejects.toThrow();
  });
});
