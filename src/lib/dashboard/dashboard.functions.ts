import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadDashboardOverview } from "./dashboard.server";

const periodSchema = z.object({
  key: z.enum(["today", "7d", "30d", "90d", "month", "previous", "custom"]),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string(),
});

export const getDashboardOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => periodSchema.parse(data))
  .handler(({ data, context }) => loadDashboardOverview(context.supabase, context.userId, data));