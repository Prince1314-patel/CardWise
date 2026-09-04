import { ApiError } from "./errors";

export type UserIdentity = {
  id: string;
  email: string;
  displayName: string | null;
};

export function requireUserIdentity(headers: Headers): UserIdentity {
  const id = headers.get("oai-authenticated-user-id");
  const email = headers.get("oai-authenticated-user-email");
  if (!id || !email) {
    throw new ApiError(401, "AUTH_REQUIRED", "Sign in with ChatGPT to manage your wallet.");
  }

  const encodedName = headers.get("oai-authenticated-user-full-name");
  const encodedAsUtf8 = headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8";
  let displayName: string | null = null;
  if (encodedName && encodedAsUtf8) {
    try {
      displayName = decodeURIComponent(encodedName);
    } catch {
      displayName = null;
    }
  }
  return { id, email, displayName };
}
