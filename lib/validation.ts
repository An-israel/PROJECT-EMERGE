import { z } from "zod";
import { TIERS, PLANS, CUSTOM_TIER_MINIMUM } from "@/lib/constants";
import { inferMimeType } from "@/lib/upload";
import {
  BROADCAST_AUDIENCES,
  MAX_BODY_LENGTH,
  MAX_SMS_LENGTH,
  MAX_SUBJECT_LENGTH,
} from "@/lib/broadcast";

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

/**
 * Pledging from an account that already exists (an admin who also partners,
 * or any profile created without a partnership). Same amount rules as sign
 * up, without the account fields.
 */
export const pledgeSchema = z
  .object({
    tier: z.enum(TIERS),
    plan: z.enum(PLANS),
    customAmount: z.number().positive().optional(),
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

export type PledgeInput = z.infer<typeof pledgeSchema>;

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
  /** Optional: used when the browser reports no type at all. */
  name?: string;
}): string | null {
  const type = file.name ? inferMimeType(file.name, file.type) : file.type;
  if (!ALLOWED_MIME.includes(type as (typeof ALLOWED_MIME)[number])) {
    return "File must be a JPEG, PNG, WEBP, or PDF.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return `File must be ${MAX_FILE_BYTES / (1024 * 1024)}MB or smaller.`;
  }
  if (file.size === 0) {
    return "That file is empty. Please choose your receipt again.";
  }
  return null;
}

/** Image-only assets (e.g. the landing page background). No PDF. */
export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
// Hero backgrounds still travel through a Server Action, so this must stay
// under the platform request cap (Vercel rejects bodies over 4.5MB).
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB

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
    return `Image must be ${MAX_IMAGE_BYTES / (1024 * 1024)}MB or smaller.`;
  }
  return null;
}

export const partnerSettingsSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name"),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(20),
  showOnHonorRoll: z.boolean().default(false),
  honorRollName: z.string().trim().max(80).optional().or(z.literal("")),
  /** Opt IN to announcements; stored inverted as `email_opt_out`. */
  receiveAnnouncements: z.boolean().default(true),
  /** Opt IN to text announcements; stored inverted as `sms_opt_out`. */
  receiveSms: z.boolean().default(true),
});

/** Admin broadcast: an announcement emailed to a chosen audience. */
export const broadcastSchema = z.object({
  audience: z.enum(BROADCAST_AUDIENCES),
  subject: z
    .string()
    .trim()
    .min(3, "Give the email a subject")
    .max(MAX_SUBJECT_LENGTH, `Keep the subject under ${MAX_SUBJECT_LENGTH} characters`),
  body: z
    .string()
    .trim()
    .min(10, "Write a message of at least 10 characters")
    .max(MAX_BODY_LENGTH, `Keep the message under ${MAX_BODY_LENGTH} characters`),
});

export type BroadcastInput = z.infer<typeof broadcastSchema>;

/** Admin bulk SMS. No subject — a text message is body only. */
export const smsBroadcastSchema = z.object({
  audience: z.enum(BROADCAST_AUDIENCES),
  body: z
    .string()
    .trim()
    .min(5, "Write a message of at least 5 characters")
    .max(MAX_SMS_LENGTH, `Keep the text under ${MAX_SMS_LENGTH} characters`),
});

export type SmsBroadcastInput = z.infer<typeof smsBroadcastSchema>;

export const adminSettingsSchema = z.object({
  campaignTitle: z.string().trim().min(1),
  campaignSubtitle: z.string().trim().min(1),
  scripture: z.string().trim().min(1),
  heroBody: z.string().trim().max(1000).optional().or(z.literal("")),
  visionBody: z.string().trim().max(2000).optional().or(z.literal("")),
  goal: z.number().positive(),
  bankAccountName: z.string().trim().min(1),
  bankAccountNumber: z.string().trim().min(1),
  bankName: z.string().trim().min(1),
  contactPhone: z.string().trim().max(60).optional().or(z.literal("")),
  contactEmail: z.string().trim().max(120).optional().or(z.literal("")),
  contactAddress: z.string().trim().max(200).optional().or(z.literal("")),
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
