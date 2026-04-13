import type { ApiConfig } from "./shared";

export const API_CONFIG: ApiConfig = {
  name: "email-finder",
  slug: "email-finder",
  description: "Find professional email addresses from name + company domain. Tests 15+ patterns against MX records with confidence scoring.",
  version: "1.0.0",
  routes: [
    {
      method: "GET",
      path: "/api/find",
      price: "$0.005",
      description: "Find a person's email from their name and company domain",
      toolName: "email_find_by_name",
      toolDescription: `Use this when you need to find someone's professional email address from their name and company domain. Returns the most likely email with confidence score after testing 15+ common patterns against MX records.

1. email (string) -- best matching email address found
2. confidence (number 0-100) -- likelihood the email is correct
3. pattern (string) -- the pattern that matched (e.g. "first.last", "flast", "first")
4. allCandidates (array) -- all tested patterns with individual scores
5. domain (string) -- company domain used
6. mxValid (boolean) -- whether domain has valid MX records

Example output: {"email":"john.doe@stripe.com","confidence":92,"pattern":"first.last","allCandidates":[{"email":"john.doe@stripe.com","score":92},{"email":"jdoe@stripe.com","score":75},{"email":"john@stripe.com","score":60}],"domain":"stripe.com","mxValid":true}

Use this BEFORE sales outreach, cold emailing, or building prospect contact lists. Essential for finding decision-maker emails when you only know their name and company.

Do NOT use for email validation -- use email_verify_address instead. Do NOT use for company data -- use company_enrich_from_domain instead. Do NOT use for person data from email -- use person_enrich_from_email instead.`,
      inputSchema: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Company domain (e.g. company.com)" },
          firstName: { type: "string", description: "Person's first name (e.g. John)" },
          lastName: { type: "string", description: "Person's last name (e.g. Doe)" },
        },
        required: ["domain", "firstName", "lastName"],
      },
      outputSchema: {
          "type": "object",
          "properties": {
            "firstName": {
              "type": "string",
              "description": "First name searched"
            },
            "lastName": {
              "type": "string",
              "description": "Last name searched"
            },
            "domain": {
              "type": "string",
              "description": "Domain searched"
            },
            "emails": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "email": {
                    "type": "string"
                  },
                  "confidence": {
                    "type": "number"
                  },
                  "pattern": {
                    "type": "string"
                  }
                }
              }
            },
            "bestGuess": {
              "type": "string",
              "description": "Most likely email address"
            },
            "confidence": {
              "type": "number",
              "description": "Confidence score 0-100"
            },
            "lookup_time_ms": {
              "type": "number",
              "description": "Lookup time in ms"
            }
          },
          "required": [
            "domain",
            "emails"
          ]
        },
    },
  ],
};
