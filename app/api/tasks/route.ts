import { endpoint, json, readBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { taskSchema } from "@/lib/validation";
import { taskJSON } from "@/lib/tasks";
export const GET = endpoint(async () => {
  const user = await requireUser();
  await connectDB();
  const tasks = await Task.find({ owner: user.id }).sort({ createdAt: -1 }).lean();
  return json({ tasks: tasks.map(taskJSON) });
});
export const POST = endpoint(async (request: Request) => {
  const user = await requireUser();
  const data = await readBody(request, taskSchema);
  await connectDB();
  const task = await Task.create({ ...data, owner: user.id });
  return json({ task: taskJSON(task) }, 201);
});
