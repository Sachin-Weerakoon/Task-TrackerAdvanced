import { endpoint, json } from "@/lib/api";
import { SESSION_COOKIE, cookieOptions } from "@/lib/jwt";
export const POST = endpoint(async (request: Request) => {
  void request;
  const response = json({ message: "Logged out" });
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return response;
});
