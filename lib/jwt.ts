import { SignJWT, jwtVerify } from "jose";
export const SESSION_COOKIE = "taskflow_session";
export const SESSION_SECONDS = 60 * 60 * 24;
function key() {
  const secret = process.env.JWT_SECRET;
  if (!secret || new TextEncoder().encode(secret).length < 32) throw new Error("JWT_SECRET must contain at least 32 bytes");
  return new TextEncoder().encode(secret);
}
export function assertAuthConfigured() { key(); }
export async function createToken(userId: string) {
  return new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuer("taskflow").setAudience("taskflow").setIssuedAt().setExpirationTime(`${SESSION_SECONDS}s`).sign(key());
}
export async function verifyToken(token: string): Promise<string | null> {
  const secret = key();
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"], issuer: "taskflow", audience: "taskflow" });
    return payload.sub && /^[a-f\d]{24}$/i.test(payload.sub) ? payload.sub : null;
  } catch { return null; }
}
export const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_SECONDS });
