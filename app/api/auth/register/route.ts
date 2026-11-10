import { hash } from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { registerSchema } from "@/lib/validation";
import { endpoint, readBody, json } from "@/lib/api";
import { assertAuthConfigured, createToken, SESSION_COOKIE, cookieOptions } from "@/lib/jwt";
export const POST = endpoint(async (request: Request) => {
  const { name, email, password } = await readBody(request, registerSchema);
  assertAuthConfigured();
  const passwordHash = await hash(password, 12);
  await connectDB();
  // Ensure the unique email index exists before accepting registrations.
  await User.init();
  const user = await User.create({ name, email, passwordHash });
  const response = json({ user: { id: String(user._id), name: user.name, email: user.email } }, 201);
  response.cookies.set(SESSION_COOKIE, await createToken(String(user._id)), cookieOptions());
  return response;
});
