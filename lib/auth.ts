import { cookies } from "next/headers";
import { connectDB } from "./db";
import { User } from "@/models/User";
import { ApiError } from "./api";
import { SESSION_COOKIE, verifyToken } from "./jwt";
export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = await verifyToken(token);
  if (!id) return null;
  await connectDB();
  const user = await User.findById(id).select("name email").lean();
  return user ? { id: String(user._id), name: user.name, email: user.email } : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new ApiError(401, "Please log in to continue");
  return user;
}
