import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
import { statuses } from "@/lib/validation";
const schema = new Schema({ title: { type: String, required: true, trim: true, maxlength: 160 }, description: { type: String, default: "", maxlength: 5000 }, status: { type: String, enum: statuses, default: "todo", required: true }, owner: { type: Schema.Types.ObjectId, ref: "User", required: true } }, { timestamps: true });
schema.index({ owner: 1, createdAt: -1 });
export type TaskRecord = InferSchemaType<typeof schema>;
export const Task = (models.Task as Model<TaskRecord>) || model("Task", schema);
