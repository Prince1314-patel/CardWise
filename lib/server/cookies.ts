export function getCookie(headers: Headers, name: string) {
  const header = headers.get("cookie");
  if (!header || header.length > 12_000) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}
