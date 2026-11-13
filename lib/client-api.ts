export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...options?.headers } });
  const body = await response.json();
  if (!response.ok) {
    const details = body.error?.details?.map((d: { field: string; message: string }) => `${d.field}: ${d.message}`).join(". ");
    throw new Error(details || body.error?.message || "Unable to complete your request");
  }
  return body;
}
