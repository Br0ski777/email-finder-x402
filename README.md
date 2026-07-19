# Email Finder API

[![MCP Server](https://img.shields.io/badge/MCP-server-blue)](https://email-finder.api.klymax402.com/mcp)
[![x402](https://img.shields.io/badge/payments-x402-6E56CF)](https://x402.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Find professional email addresses from name + company domain. Tests 15+ patterns against MX records with confidence scoring. Pay-per-call via [x402](https://x402.org) (USDC on Base L2) -- no API key, no signup, no rate-limit wall.

Part of the [klymax402](https://klymax402.com) marketplace -- 100 x402 micropayment APIs for AI agents, one wallet, USDC on Base.

## Quickstart -- MCP

Add to your MCP client config (Claude Desktop, Cursor, ElizaOS, etc.):

```json
{
  "mcpServers": {
    "email-finder": {
      "url": "https://email-finder.api.klymax402.com/mcp"
    }
  }
}
```

## Quickstart -- HTTP (x402)

```bash
curl "https://email-finder.api.klymax402.com/api/find?domain=...&firstName=...&lastName=..."
# -> 402 Payment Required, with an x402 payment challenge in the response body
```

Any x402-aware client ([`@x402/fetch`](https://www.npmjs.com/package/@x402/fetch), [`x402-agent-tools`](https://www.npmjs.com/package/x402-agent-tools), ATXP) handles the 402 -> sign -> retry cycle automatically.

## Tools

| Tool | Method | Path | Price | Description |
|---|---|---|---|---|
| `email_find_by_name` | GET | `/api/find` | $0.012 | Find a person's email from their name and company domain |
| `email_find_by_name` | POST | `/api/find` | $0.012 | Find a person's email from their name and company domain (POST variant) |

### `email_find_by_name`

Search for people/contacts matching criteria and find their professional email address from name and company domain. Alternative to Apollo people-search at 4x lower cost. Returns the most likely email with confidence score after testing 15+ patterns against MX records.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `domain` | string | yes | Company domain (e.g. company.com) |
| `firstName` | string | yes | Person's first name (e.g. John) |
| `lastName` | string | yes | Person's last name (e.g. Doe) |

Example response:

```json
{"email":"john.doe@stripe.com","confidence":92,"pattern":"first.last","allCandidates":[{"email":"john.doe@stripe.com","score":92},{"email":"jdoe@stripe.com","score":75},{"email":"john@stripe.com","score":60}],"domain":"stripe.com","mxValid":true}
```

**When to use**: sales outreach, cold emailing, or building prospect contact lists. Essential for searching for people/contacts and finding decision-maker emails when you only know their name and company. Drop-in replacement for Apollo people search.

**Not for**: email validation (use `email_verify_address`), company data (use `company_enrich_from_domain`), person data from email (use `person_enrich_from_email`).

### `email_find_by_name`

Search for people/contacts matching criteria and find their professional email address from name and company domain. Alternative to Apollo people-search at 4x lower cost. Returns the most likely email with confidence score after testing 15+ patterns against MX records. POST variant of email_find_by_name -- same params passed as JSON body instead of query string.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `domain` | string | yes | Company domain (e.g. company.com) |
| `firstName` | string | yes | Person's first name (e.g. John) |
| `lastName` | string | yes | Person's last name (e.g. Doe) |

Example response:

```json
{"email":"john.doe@stripe.com","confidence":92,"pattern":"first.last","allCandidates":[{"email":"john.doe@stripe.com","score":92},{"email":"jdoe@stripe.com","score":75},{"email":"john@stripe.com","score":60}],"domain":"stripe.com","mxValid":true}
```

**When to use**: sales outreach, cold emailing, or building prospect contact lists. Essential for searching for people/contacts and finding decision-maker emails when you only know their name and company. Drop-in replacement for Apollo people search.

**Not for**: email validation (use `email_verify_address`), company data (use `company_enrich_from_domain`), person data from email (use `person_enrich_from_email`).

## Example agent prompts

- "Search for people/contacts matching criteria and find their professional email address from name and company domain"
- "Search for people/contacts matching criteria and find their professional email address from name and company domain"

## Payment

- Protocol: [x402](https://x402.org) -- HTTP-native pay-per-call, no signup, no API key
- Network: Base L2 (`eip155:8453`)
- Asset: USDC
- Facilitator: Coinbase CDP (primary), PayAI (fallback)
- Also reachable via [ATXP](https://atxp.ai) (OAuth-wrapped x402, RFC 9728 protected-resource metadata)

## Part of klymax402

100 x402 micropayment APIs for AI agents -- one wallet, USDC on Base, zero signup.

- Catalog: https://klymax402.com/llms.txt
- Full API reference: https://klymax402.com/llms-full.txt
- Live stats: https://klymax402.com/stats

## License

MIT
