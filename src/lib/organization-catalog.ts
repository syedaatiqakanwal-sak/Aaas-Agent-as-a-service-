export const INDUSTRIES = [
  "customer-support",
  "sales",
  "marketing",
  "finance",
  "healthcare",
  "real-estate",
  "ecommerce",
  "human-resources",
  "productivity",
  "legal",
  "education",
  "data-analytics",
  "developer-tools",
  "operations",
  "other",
] as const;

export const OBJECTIVES = [
  "support-customers",
  "qualify-leads",
  "draft-content",
  "analyze-documents",
  "automate-operations",
  "internal-knowledge",
] as const;

export type Industry = (typeof INDUSTRIES)[number];
export type Objective = (typeof OBJECTIVES)[number];

export function isIndustry(value: string): value is Industry {
  return (INDUSTRIES as readonly string[]).includes(value);
}

export function isObjective(value: string): value is Objective {
  return (OBJECTIVES as readonly string[]).includes(value);
}
