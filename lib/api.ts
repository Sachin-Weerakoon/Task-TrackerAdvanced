import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { ZodError, type ZodType } from "zod";
import { logger } from "./logger";
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } }); }
export async function readBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(400, "Send application/json");
  let body: unknown;
  try { body = await request.json(); } catch { throw new ApiError(400, "Invalid JSON body"); }
  return schema.parse(body);
}
export function endpoint<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    const requestId = crypto.randomUUID();
    const req = args[0];
    const context = req instanceof Request ? { method: req.method, path: new URL(req.url).pathname } : {};
    try {
      if (req instanceof Request && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const origin = req.headers.get("origin");
        if (origin && origin !== new URL(req.url).origin) throw new ApiError(403, "Cross-origin request rejected");
      }
      const response = await handler(...args);
      response.headers.set("X-Request-Id", requestId);
      logger.info({ ...context, requestId, status: response.status }, "API request completed");
      return response;
    } catch (error) {
      unstable_rethrow(error);
      let status = 500; let message = "Something went wrong. Please try again.";
      let details: unknown;
      if (error instanceof ApiError) { status = error.status; message = error.message; }
      else if (error instanceof ZodError) { status = 400; message = "Please check your input"; details = error.issues.map(i => ({ field: i.path.join("."), message: i.message })); }
      else if (typeof error === "object" && error && "code" in error && error.code === 11000) { status = 409; message = "An account with this email already exists"; }
      // The logger's Error serializer sanitizes messages/stacks and omits raw
      // driver properties. Client responses retain their existing safe shape.
      logger[status >= 500 ? "error" : "warn"]({ ...context, requestId, status, err: error }, "API request failed");
      const response = json({ error: { message, ...(details ? { details } : {}) } }, status);
      response.headers.set("X-Request-Id", requestId);
      return response;
    }
  };
}
