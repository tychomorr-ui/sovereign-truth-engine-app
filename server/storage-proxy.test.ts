import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

type ExpressResponse = PassThrough & {
  headers: Record<string, string>;
  status: (code: number) => ExpressResponse;
  setHeader: (name: string, value: string) => ExpressResponse;
  send: (body: string) => ExpressResponse;
};

function makeResponse() {
  const response = new PassThrough() as ExpressResponse;
  response.headers = {};
  response.status = (code) => {
    response.statusCode = code;
    return response;
  };
  response.setHeader = (name, value) => {
    response.headers[name.toLowerCase()] = value;
    return response;
  };
  response.send = (body) => {
    response.end(body);
    return response;
  };
  return response;
}

async function collect(response: PassThrough) {
  const chunks: Buffer[] = [];
  response.on("data", (chunk: Buffer) => chunks.push(chunk));
  await new Promise<void>((resolve) => response.on("end", resolve));
  return Buffer.concat(chunks);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("same-origin storage proxy", () => {
  it("streams an uploaded asset without redirecting the browser cross-origin", async () => {
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "https://forge.test");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "forge-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://signed.test/config.json" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "application/json", "content-length": "3" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { registerStorageProxy } = await import("./_core/storageProxy");
    let handler: ((req: any, res: ExpressResponse) => Promise<void>) | undefined;
    registerStorageProxy({ get: (_path: string, route: typeof handler) => { handler = route; } } as any);
    const response = makeResponse();
    const bodyPromise = collect(response);
    await handler?.({ params: { splat: ["config_30f06ef9.json"] }, headers: {} }, response);
    const body = await bodyPromise;

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("application/json");
    expect(response.headers.location).toBeUndefined();
    expect(body).toEqual(Buffer.from([1, 2, 3]));
    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.any(URL), { headers: { Authorization: "Bearer forge-key" } });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://signed.test/config.json", { headers: undefined });
  });

  it("forwards byte ranges to the signed storage asset", async () => {
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "https://forge.test");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "forge-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://signed.test/model.onnx" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([9, 8]), {
        status: 206,
        headers: {
          "content-type": "application/octet-stream",
          "content-length": "2",
          "content-range": "bytes 0-1/10",
          "accept-ranges": "bytes",
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { registerStorageProxy } = await import("./_core/storageProxy");
    let handler: ((req: any, res: ExpressResponse) => Promise<void>) | undefined;
    registerStorageProxy({ get: (_path: string, route: typeof handler) => { handler = route; } } as any);
    const response = makeResponse();
    const bodyPromise = collect(response);
    await handler?.({ params: { splat: ["model_quantized.onnx"] }, headers: { range: "bytes=0-1" } }, response);
    const body = await bodyPromise;

    expect(response.statusCode).toBe(206);
    expect(response.headers["content-range"]).toBe("bytes 0-1/10");
    expect(body).toEqual(Buffer.from([9, 8]));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://signed.test/model.onnx", { headers: { Range: "bytes=0-1" } });
  });
});
