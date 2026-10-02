import { z } from "zod";

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
