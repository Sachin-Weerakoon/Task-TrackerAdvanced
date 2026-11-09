import { afterEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { hash, compare } from "bcryptjs";
import { createToken, verifyToken, cookieOptions, SESSION_SECONDS } from "@/lib/jwt";
const userId = "507f1f77bcf86cd799439011";
afterEach(() => vi.unstubAllEnvs());
describe("authentication helpers", () => {
  it("signs and verifies an expiring session", async () => {
    vi.stubEnv("JWT_SECRET", "test-secret-of-at-least-thirty-two-bytes");
    expect(await verifyToken(await createToken(userId))).toBe(userId);
  });
  it("rejects tampering and invalid tokens", async () => {
    vi.stubEnv("JWT_SECRET", "test-secret-of-at-least-thirty-two-bytes");
    const token = await createToken(userId);
    const [header, payload, signature] = token.split(".");
    expect(await verifyToken(`${header}.${payload}.${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`)).toBeNull();
    expect(await verifyToken("not-a-jwt")).toBeNull();
  });
  it("rejects expiration, wrong audience and invalid subjects", async () => {
    vi.stubEnv("JWT_SECRET", "test-secret-of-at-least-thirty-two-bytes");
    const key = new TextEncoder().encode(process.env.JWT_SECRET);
    const expired = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuer("taskflow").setAudience("taskflow").setExpirationTime(1).sign(key);
    expect(await verifyToken(expired)).toBeNull();
    const wrongAudience = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuer("taskflow").setAudience("other").setExpirationTime("1h").sign(key);
    expect(await verifyToken(wrongAudience)).toBeNull();
    expect(await verifyToken(await createToken("bad-id"))).toBeNull();
  });
  it("fails closed when the signing secret is missing or weak", async () => {
    vi.stubEnv("JWT_SECRET", ""); await expect(createToken(userId)).rejects.toThrow("JWT_SECRET");
    vi.stubEnv("JWT_SECRET", "weak"); await expect(verifyToken("token")).rejects.toThrow("JWT_SECRET");
  });
  it("uses HttpOnly, same-site, expiring cookies and HTTPS in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(cookieOptions()).toEqual({ httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: SESSION_SECONDS });
  });
  it("hashes passwords and rejects an incorrect password", async () => {
    const hashed = await hash("strong-password", 4);
    expect(hashed).not.toBe("strong-password"); expect(await compare("strong-password", hashed)).toBe(true); expect(await compare("wrong-password", hashed)).toBe(false);
  });
});
