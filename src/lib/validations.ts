import { z } from "zod";

// Domain validation helper
export const createDomainValidator = (allowedDomain: string) => {
  return z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .refine(
      (email) => email.toLowerCase().endsWith(`@${allowedDomain.toLowerCase()}`),
      { message: `Email must be from @${allowedDomain}` }
    );
};

// Invite code validation
export const inviteCodeSchema = z.object({
  code: z.string().min(1, { message: "Invite code is required" }),
  email: z.string().email({ message: "Invalid email address" }),
});

// Authentication validation schemas
export const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(128, { message: "Password must be less than 128 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" }),
  fullName: z
    .string()
    .trim()
    .min(1, { message: "Full name is required" })
    .max(100, { message: "Full name must be less than 100 characters" })
    .regex(/^[a-zA-ZæøåÆØÅ\s'-]+$/, { message: "Full name can only contain letters, spaces, hyphens, and apostrophes" }),
  inviteCode: z.string().optional(),
});

// Sign up with invite validation (created dynamically with domain)
export const createSignUpWithInviteSchema = (allowedDomain: string) => z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" })
    .refine(
      (email) => email.toLowerCase().endsWith(`@${allowedDomain.toLowerCase()}`),
      { message: `Email must be from @${allowedDomain}` }
    ),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(128, { message: "Password must be less than 128 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" }),
  fullName: z
    .string()
    .trim()
    .min(1, { message: "Full name is required" })
    .max(100, { message: "Full name must be less than 100 characters" })
    .regex(/^[a-zA-ZæøåÆØÅ\s'-]+$/, { message: "Full name can only contain letters, spaces, hyphens, and apostrophes" }),
  inviteCode: z.string().min(1, { message: "Invite code is required" }),
});

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(1, { message: "Password is required" }),
});

// Profile validation schema
export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { message: "Full name is required" })
    .max(100, { message: "Full name must be less than 100 characters" })
    .regex(/^[a-zA-ZæøåÆØÅ\s'-]+$/, { message: "Full name can only contain letters, spaces, hyphens, and apostrophes" }),
  isGlutenFree: z.boolean(),
  isLactoseFree: z.boolean(),
  isVegetarian: z.boolean(),
});
