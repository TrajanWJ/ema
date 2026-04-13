import { z } from "zod";
import { baseEntitySchema } from "./common.js";

export const settingSchema = baseEntitySchema.extend({
  key: z.string(),
  value: z.string(),
});
