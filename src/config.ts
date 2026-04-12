import type { ApiConfig } from "./shared";

export const API_CONFIG: ApiConfig = {
  name: "email-finder",
  slug: "email-finder",
  description: "Find email addresses from name and company domain with confidence scoring.",
  version: "1.0.0",
  routes: [
    {
      method: "GET",
      path: "/api/find",
      price: "$0.005",
      description: "Find a person's email from their name and company domain",
      toolName: "email_find_by_name",
      toolDescription: "Use this when you need to find someone's email address from their name and company domain. Tests common email patterns (first.last@, first@, flast@, etc.) against MX records and returns the most likely email with confidence score. Do NOT use for email validation — use email_verify_address instead. Ideal for sales outreach, finding decision-maker contacts.",
      inputSchema: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Company domain (e.g. company.com)" },
          firstName: { type: "string", description: "Person's first name (e.g. John)" },
          lastName: { type: "string", description: "Person's last name (e.g. Doe)" },
        },
        required: ["domain", "firstName", "lastName"],
      },
    },
  ],
};
