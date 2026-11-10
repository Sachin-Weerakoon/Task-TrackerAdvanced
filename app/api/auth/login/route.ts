import { compare } from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { loginSchema } from "@/lib/validation";
import { ApiError, endpoint, readBody, json } from "@/lib/api";
import { createToken, SESSION_COOKIE, cookieOptions } from "@/lib/jwt";
export const POST = endpoint(async (request: Request) => {
  const { email, password } = await readBody(request, loginSchema);
  await connectDB();
  const user = await User.findOne({ email }).select("+passwordHash");
  // A fixed bcrypt hash keeps unknown-email attempts on the password comparison path.
  const valid = await compare(password, user?.passwordHash ?? "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW");
  if (!user || !valid) throw new ApiError(401, "Invalid email or password");
  const response = json({ user: { id: String(user._id), name: user.name, email: user.email } });
  response.cookies.set(SESSION_COOKIE, await createToken(String(user._id)), cookieOptions());
  return response;
});
