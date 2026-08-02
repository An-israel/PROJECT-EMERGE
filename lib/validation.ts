import { z } from "zod";
import { TIERS, PLANS, CUSTOM_TIER_MINIMUM } from "@/lib/constants";

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

/** Sign-up form. Custom amount is only meaningful for the top tier. */
export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name"),
    email: z.string().trim().email("Enter a valid email"),
    phone: z
      .string()
      .trim()
      .min(7, "Enter a valid phone number")
      .max(20, "Phone number is too long"),
    password: z.string().min(8, "Use at least 8 characters"),
    tier: z.enum(TIERS),
    plan: z.enum(PLANS),
    customAmount: z.number().positive().optional(),
    showOnHonorRoll: z.boolean().default(false),
    honorRollName: z.string().trim().max(80).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.tier === "2000000_plus") {
      if (data.customAmount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customAmount"],
          message: "Enter an amount of at least ₦2,000,000",
        });
      } else if (data.customAmount < CUSTOM_TIER_MINIMUM) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customAmount"],
          message: "Amount must be at least ₦2,000,000",
        });
      }
    }
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

/** Resolve the pledged amount from a validated sign-up input. */
export function resolveAmount(input: {
  tier: (typeof TIERS)[number];
  customAmount?: number;
}): number {
  if (input.tier === "2000000_plus") return input.customAmount ?? 0;
  return Number(input.tier);
}

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string().min(8),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

/** Receipt upload metadata (file validated separately, client + server). */
export const receiptSchema = z.object({
  amount: z.number().positive("Enter an amount greater than 0"),
  transferDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ReceiptInput = z.infer<typeof receiptSchema>;

export function validateFile(file: {
  type: string;
  size: number;
}): string | null {
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return "File must be a JPEG, PNG, WEBP, or PDF.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "File must be 5MB or smaller.";
  }
  return null;
}

/** Image-only assets (e.g. the landing page background). No PDF. */
export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB — backgrounds can be large

export function validateImageFile(file: {
  type: string;
  size: number;
}): string | null {
  if (
    !ALLOWED_IMAGE_MIME.includes(file.type as (typeof ALLOWED_IMAGE_MIME)[number])
  ) {
    return "Background must be a JPEG, PNG, or WEBP image.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Image must be 8MB or smaller.";
  }
  return null;
}

export const partnerSettingsSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name"),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(20),
  showOnHonorRoll: z.boolean().default(false),
  honorRollName: z.string().trim().max(80).optional().or(z.literal("")),
});

export const adminSettingsSchema = z.object({
  campaignTitle: z.string().trim().min(1),
  campaignSubtitle: z.string().trim().min(1),
  scripture: z.string().trim().min(1),
  goal: z.number().positive(),
  bankAccountName: z.string().trim().min(1),
  bankAccountNumber: z.string().trim().min(1),
  bankName: z.string().trim().min(1),
  oneTimeGraceDays: z.number().int().min(0),
  monthlyIntervalMonths: z.number().int().min(1),
  behindGraceDays: z.number().int().min(0),
});

export const contactLogSchema = z.object({
  partnerId: z.string().uuid(),
  method: z.enum(["phone", "email", "whatsapp", "other"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const rejectReceiptSchema = z.object({
  receiptId: z.string().uuid(),
  reason: z.string().trim().min(3, "Give a short reason for the partner"),
});
