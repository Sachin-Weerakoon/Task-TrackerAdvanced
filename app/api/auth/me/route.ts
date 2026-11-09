import { endpoint, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
export const GET = endpoint(async () => json({ user: await requireUser() }));
