import { z } from "zod";

// Domain validation helper
export const createDomainValidator = (allowedDomain: string) => {
  return z
    .string()
    .trim()
    .email({ message: "Ugyldig e-mailadresse" })
    .refine(
      (email) => email.toLowerCase().endsWith(`@${allowedDomain.toLowerCase()}`),
      { message: `E-mail skal være fra @${allowedDomain}` }
    );
};

// Invite code validation
export const inviteCodeSchema = z.object({
  code: z.string().min(1, { message: "Invitationskode er påkrævet" }),
  email: z.string().email({ message: "Ugyldig e-mailadresse" }),
});

// Authentication validation schemas
export const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Ugyldig e-mailadresse" })
    .max(255, { message: "E-mail skal være mindre end 255 tegn" }),
  password: z
    .string()
    .min(8, { message: "Adgangskoden skal være mindst 8 tegn" })
    .max(128, { message: "Adgangskoden skal være mindre end 128 tegn" })
    .regex(/[A-Z]/, { message: "Adgangskoden skal indeholde mindst ét stort bogstav" })
    .regex(/[a-z]/, { message: "Adgangskoden skal indeholde mindst ét lille bogstav" })
    .regex(/[0-9]/, { message: "Adgangskoden skal indeholde mindst ét tal" }),
  fullName: z
    .string()
    .trim()
    .min(1, { message: "Fulde navn er påkrævet" })
    .max(100, { message: "Fulde navn skal være mindre end 100 tegn" })
    .regex(/^[a-zA-ZæøåÆØÅ\s'-]+$/, { message: "Fulde navn kan kun indeholde bogstaver, mellemrum, bindestreger og apostroffer" }),
  inviteCode: z.string().optional(),
});

// Sign up with invite validation (created dynamically with domain)
export const createSignUpWithInviteSchema = (allowedDomain: string) => z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Ugyldig e-mailadresse" })
    .max(255, { message: "E-mail skal være mindre end 255 tegn" })
    .refine(
      (email) => email.toLowerCase().endsWith(`@${allowedDomain.toLowerCase()}`),
      { message: `E-mail skal være fra @${allowedDomain}` }
    ),
  password: z
    .string()
    .min(8, { message: "Adgangskoden skal være mindst 8 tegn" })
    .max(128, { message: "Adgangskoden skal være mindre end 128 tegn" })
    .regex(/[A-Z]/, { message: "Adgangskoden skal indeholde mindst ét stort bogstav" })
    .regex(/[a-z]/, { message: "Adgangskoden skal indeholde mindst ét lille bogstav" })
    .regex(/[0-9]/, { message: "Adgangskoden skal indeholde mindst ét tal" }),
  fullName: z
    .string()
    .trim()
    .min(1, { message: "Fulde navn er påkrævet" })
    .max(100, { message: "Fulde navn skal være mindre end 100 tegn" })
    .regex(/^[a-zA-ZæøåÆØÅ\s'-]+$/, { message: "Fulde navn kan kun indeholde bogstaver, mellemrum, bindestreger og apostroffer" }),
  inviteCode: z.string().min(1, { message: "Invitationskode er påkrævet" }),
});

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Ugyldig e-mailadresse" })
    .max(255, { message: "E-mail skal være mindre end 255 tegn" }),
  password: z
    .string()
    .min(1, { message: "Adgangskode er påkrævet" }),
});


// Profile validation schema
export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { message: "Fulde navn er påkrævet" })
    .max(100, { message: "Fulde navn skal være mindre end 100 tegn" })
    .regex(/^[a-zA-ZæøåÆØÅ\s'-]+$/, { message: "Fulde navn kan kun indeholde bogstaver, mellemrum, bindestreger og apostroffer" }),
  isGlutenFree: z.boolean(),
  isLactoseFree: z.boolean(),
  isVegetarian: z.boolean(),
});
