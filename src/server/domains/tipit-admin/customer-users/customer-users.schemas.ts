import { z } from "zod";

export const createCustomerUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["CUSTOMER_ADMIN", "CUSTOMER_MANAGER", "CUSTOMER_VIEWER"]),
});

export const updateCustomerUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export type CreateCustomerUserInput = z.infer<typeof createCustomerUserSchema>;
export type UpdateCustomerUserStatusInput = z.infer<typeof updateCustomerUserStatusSchema>;
