import { z } from "zod";

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());

const password = z.string().min(12).max(128).superRefine((value, ctx) => {
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    ctx.addIssue({ code: "custom", message: "Use a stronger password." });
  }
});

export const emailAuthInputSchema = z.object({
  mode: z.enum(["sign-in", "sign-up"]),
  email,
  password,
}).strict();
