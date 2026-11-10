import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
const schema = new Schema({ name: { type: String, required: true, trim: true, maxlength: 80 }, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, passwordHash: { type: String, required: true, select: false } }, { timestamps: true });
schema.set("toJSON", { transform(_doc, ret) { Reflect.deleteProperty(ret, "passwordHash"); return ret; } });
export type UserRecord = InferSchemaType<typeof schema>;
export const User = (models.User as Model<UserRecord>) || model("User", schema);
