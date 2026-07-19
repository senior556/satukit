import { z } from "zod";

export const LANG = z.enum(["ru", "kk"]);
export type Lang = z.infer<typeof LANG>;

// ---- Form input (client → /api/generate). product_name is the ONLY required field.
export const FormSchema = z.object({
  product_name: z.string().min(1).max(120),
  facts: z.string().max(2000).optional(),
  region: z.string().max(80).optional(),
  price: z.number().int().nonnegative().optional(), // tenge (major units) as entered
  cost: z.number().nonnegative().optional(), // tenge
  margin_percent: z.number().gt(0).lt(95).optional(),
  language: LANG.default("ru"),
});
export type FormInput = z.infer<typeof FormSchema>;

// ---- AI output contract (TRD §6)
export const BuyerFaq = z.object({ question: z.string(), answer: z.string() });
export const ConfirmationClaim = z.object({ claim: z.string(), reason: z.string() });

export const AiOutputSchema = z.object({
  headline: z.string().min(1),
  description: z.string().min(1),
  instagram_caption: z.string().min(1).max(2200),
  whatsapp_message: z.string().min(1).max(700),
  buyer_faq: z.array(BuyerFaq).min(3).max(5),
  presentation_tips: z.array(z.string()).max(3),
  confirmation_required: z.array(ConfirmationClaim),
  image_alt_text: z.string().min(1),
});
export type AiOutput = z.infer<typeof AiOutputSchema>;

// ---- Public card payload (only confirmed, non-sensitive fields; TRD §5 GET /p/[slug])
export const PublicCardSchema = z.object({
  product_name: z.string(),
  description: z.string(),
  price_minor: z.number().int().nullable(),
  region: z.string().nullable(),
  image_url: z.string(),
  whatsapp_e164: z.string(),
  language: LANG,
});
export type PublicCard = z.infer<typeof PublicCardSchema>;

// ---- Feedback (FR-10)
export const FeedbackSchema = z.object({
  product_id: z.string().uuid(),
  business_type: z.string().max(120).optional(),
  region: z.string().max(80).optional(),
  currently_selling: z.boolean().optional(),
  ease_rating: z.number().int().min(1).max(5).optional(),
  usefulness_rating: z.number().int().min(1).max(5).optional(),
  most_useful: z.string().max(1000).optional(),
  requested_improvement: z.string().max(1000).optional(),
  asset_used: z.boolean().optional(),
  evidence_consent: z.boolean().default(false),
});
export type FeedbackInput = z.infer<typeof FeedbackSchema>;

// ---- Funnel events (FR-12) — allowlist
export const EVENT_NAMES = [
  "generation_requested",
  "generation_succeeded",
  "generation_failed",
  "card_published",
  "whatsapp_clicked",
  "feedback_submitted",
] as const;
export const EventName = z.enum(EVENT_NAMES);

export const EventSchema = z.object({
  session_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  event_name: EventName,
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type EventInput = z.infer<typeof EventSchema>;
