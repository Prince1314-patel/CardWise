import { z } from "zod";
import { ApiError } from "./errors";

const MAX_JSON_BYTES = 32 * 1024;

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  if (origin !== new URL(request.url).origin) {
    throw new ApiError(403, "INVALID_ORIGIN", "This request is not allowed.");
  }
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json for this request.");
  }
  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;
  if (contentLength !== null && (!Number.isFinite(contentLength) || contentLength < 0)) {
    throw new ApiError(400, "INVALID_CONTENT_LENGTH", "The request body is invalid.");
  }
  if (contentLength !== null && contentLength > MAX_JSON_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "This request is too large.");
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    throw new ApiError(400, "INVALID_BODY", "The request body could not be read.");
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_JSON_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "This request is too large.");
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, "INVALID_INPUT", "Some entered details are invalid.");
  }
  return parsed.data;
}
