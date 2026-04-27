import { z } from "zod";

export const TravelFormSchema = z.object({
  budget: z.number().min(1000, "Минимальный бюджет 1000 ₽"),
  days: z.number().min(1).max(30),
  startCity: z.string().min(2, "Укажите город отправления"),
  distancePreference: z.enum(["local", "russia", "abroad"]),
  tripStyle: z.enum(["active", "relaxed", "family", "romantic"]),
  peopleCount: z.number().min(1),
  constraints: z.string().default(""),
  priority: z.enum(["money", "time", "destination"]),
  dateFrom: z.string().optional().default(""),
  dateTo: z.string().optional().default(""),
});

export type TravelFormData = z.infer<typeof TravelFormSchema>;

export const TransportOptionSchema = z.object({
  type: z.enum(["plane", "train", "bus", "car"]),
  label: z.string(),
  duration: z.string(),
  price_per_person: z.number(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
});

export const StayOptionSchema = z.object({
  name: z.string(),
  type: z.enum(["hotel", "apartment", "hostel"]),
  price_per_night: z.number(),
  why_chosen: z.string(),
});

export const DayPlanSchema = z.object({
  day: z.number(),
  date: z.string().optional(),
  morning: z.string(),
  afternoon: z.string(),
  evening: z.string(),
  estimated_day_cost: z.number(),
});

export const RouteVariantSchema = z.object({
  tier: z.enum(["budget", "balanced", "comfort"]),
  title: z.string(),
  total_cost: z.number(),
  cost_breakdown: z.object({
    transport: z.number(),
    stay: z.number(),
    food: z.number(),
    activities: z.number(),
    buffer: z.number(),
  }),
  transport: TransportOptionSchema,
  stay: StayOptionSchema,
  day_plan: z.array(DayPlanSchema),
  must_do: z.array(z.string()),
});

export const RouteResultSchema = z.object({
  destination: z.string(),
  summary: z.string(),
  variants: z.array(RouteVariantSchema).length(3),
  transport_options: z.array(TransportOptionSchema),
  plan_b: z.string(),
  notes: z.array(z.string()),
});

export type RouteResult = z.infer<typeof RouteResultSchema>;
export type RouteVariant = z.infer<typeof RouteVariantSchema>;
export type TransportOption = z.infer<typeof TransportOptionSchema>;
