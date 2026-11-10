import { endpoint, json, readBody, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { taskUpdateSchema } from "@/lib/validation";
import { taskJSON, ownedTaskFilter, getTask } from "@/lib/tasks";
type Context = { params: Promise<{ id: string }> };
export const GET = endpoint(async (_request: Request, context: Context) => {
  const user = await requireUser();
  return json({ task: await getTask((await context.params).id, user.id) });
});
export const PATCH = endpoint(async (request: Request, context: Context) => {
  const user = await requireUser();
  const filter = ownedTaskFilter((await context.params).id, user.id);
  const data = await readBody(request, taskUpdateSchema);
  await connectDB();
  const task = await Task.findOneAndUpdate(filter, { $set: data }, { new: true, runValidators: true }).lean();
  if (!task) throw new ApiError(404, "Task not found");
  return json({ task: taskJSON(task) });
});
export const DELETE = endpoint(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const filter = ownedTaskFilter((await context.params).id, user.id);
  await connectDB();
  const task = await Task.findOneAndDelete(filter);
  if (!task) throw new ApiError(404, "Task not found");
  return json({ message: "Task deleted" });
});
