import type { Hono } from "hono";
import { parse as parseHTML } from "node-html-parser";
import { Resolver } from "dns/promises";
import { connect } from "net";


// ATXP: requirePayment only fires inside an ATXP context (set by atxpHono middleware).
// For raw x402 requests, the existing @x402/hono middleware handles the gate.
// If neither protocol is active (ATXP_CONNECTION unset), tryRequirePayment is a no-op.
async function tryRequirePayment(price: number): Promise<void> {
  if (!process.env.ATXP_CONNECTION) return;
  try {
    const { requirePayment } = await import("@atxp/server");
    const BigNumber = (await import("bignumber.js")).default;
    await requirePayment({ price: BigNumber(price) });
  } catch (e: any) {
    if (e?.code === -30402) throw e;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailCandidate {
  email: string;
  pattern: string;
  confidence: number;
  mx_valid: boolean;
  smtp_valid: boolean | null;
  sources: string[];
}

interface FindResult {
  domain: string;
  first_name: string;
  last_name: string;
  mx_records: string[];
  candidates: EmailCandidate[];
  best_match: EmailCandidate | null;
}

// ---------------------------------------------------------------------------
// Email pattern generation
// ---------------------------------------------------------------------------

function generateCandidates(firstName: string, lastName: string, domain: string): { email: string; pattern: string; baseScore: number }[] {
  const f = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const l = lastName.toLowerCase().replace(/[^a-z]/g, "");
  if (!f || !l) return [];

  return [
    { email: `${f}.${l}@${domain}`,    pattern: "first.last",   baseScore: 95 },
    { email: `${f}${l}@${domain}`,      pattern: "firstlast",   baseScore: 80 },
    { email: `${f}@${domain}`,          pattern: "first",        baseScore: 70 },
    { email: `${f[0]}.${l}@${domain}`,  pattern: "f.last",       baseScore: 65 },
    { email: `${f[0]}${l}@${domain}`,   pattern: "flast",        baseScore: 60 },
    { email: `${f}_${l}@${domain}`,     pattern: "first_last",   baseScore: 55 },
    { email: `${l}@${domain}`,          pattern: "last",         baseScore: 45 },
    { email: `${f}.${l[0]}@${domain}`,  pattern: "first.l",      baseScore: 40 },
    { email: `${f}-${l}@${domain}`,     pattern: "first-last",   baseScore: 50 },
    { email: `${l}.${f}@${domain}`,     pattern: "last.first",   baseScore: 35 },
    { email: `${l}${f}@${domain}`,      pattern: "lastfirst",    baseScore: 30 },
    { email: `${f}${l[0]}@${domain}`,   pattern: "firstl",       baseScore: 25 },
  ];
}

// ---------------------------------------------------------------------------
// MX record lookup
// ---------------------------------------------------------------------------

const resolver = new Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);

async function getMxRecords(domain: string): Promise<string[]> {
  try {
    const records = await resolver.resolveMx(domain);
    return records
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.exchange);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// SMTP RCPT TO check (best-effort, many servers block this)
// ---------------------------------------------------------------------------

function smtpCheck(mxHost: string, email: string, timeoutMs = 8000): Promise<boolean | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(null);
    }, timeoutMs);

    const socket = connect(25, mxHost, () => {
      let step = 0;
      let buffer = "";

      socket.on("data", (data) => {
        buffer += data.toString();

        if (step === 0 && buffer.includes("220")) {
          // Server greeting received
          socket.write(`EHLO enrichbot.local\r\n`);
          step = 1;
          buffer = "";
        } else if (step === 1 && buffer.includes("250")) {
          socket.write(`MAIL FROM:<check@enrichbot.local>\r\n`);
          step = 2;
          buffer = "";
        } else if (step === 2 && buffer.includes("250")) {
          socket.write(`RCPT TO:<${email}>\r\n`);
          step = 3;
          buffer = "";
        } else if (step === 3) {
          const accepted = buffer.includes("250");
          const rejected = buffer.includes("550") || buffer.includes("551") || buffer.includes("552") || buffer.includes("553");
          if (accepted || rejected) {
            socket.write("QUIT\r\n");
            clearTimeout(timer);
            socket.destroy();
            resolve(accepted ? true : false);
          }
        }
      });

      socket.on("error", () => {
        clearTimeout(timer);
        resolve(null);
      });
    });

    socket.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

// ---------------------------------------------------------------------------
// Website scraping for email patterns
// ---------------------------------------------------------------------------

async function fetchPage(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EmailFinderBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) return null;
    return await res.text();
  } catch { return null; }
}

async function scrapeEmailsFromSite(domain: string): Promise<string[]> {
  const found: Set<string> = new Set();
  const pages = [
    `https://${domain}`,
    `https://${domain}/contact`,
    `https://${domain}/about`,
    `https://${domain}/contact-us`,
    `https://${domain}/about-us`,
    `https://${domain}/team`,
  ];

  for (const pageUrl of pages) {
    const html = await fetchPage(pageUrl, 6000);
    if (!html) continue;

    const root = parseHTML(html);
    const text = root.textContent;

    // Extract emails with the target domain
    const emailRegex = new RegExp(`[a-zA-Z0-9._%+-]+@${domain.replace(/\./g, "\\.")}`, "gi");
    const matches = text.match(emailRegex);
    if (matches) {
      for (const m of matches) found.add(m.toLowerCase());
    }

    // Also check mailto: links
    const mailtoLinks = root.querySelectorAll('a[href^="mailto:"]');
    for (const link of mailtoLinks) {
      const href = link.getAttribute("href") || "";
      const email = href.replace("mailto:", "").split("?")[0].trim().toLowerCase();
      if (email.endsWith(`@${domain}`)) found.add(email);
    }
  }

  return [...found];
}

// ---------------------------------------------------------------------------
// Detect dominant email pattern from scraped emails
// ---------------------------------------------------------------------------

function detectDomainPattern(emails: string[], firstName: string, lastName: string): string | null {
  // Analyze scraped emails to detect the company's email pattern
  const patterns: Record<string, number> = {};

  for (const email of emails) {
    const local = email.split("@")[0];
    if (local.includes(".")) {
      // Could be first.last or last.first or f.last
      if (/^[a-z]\.[a-z]+$/.test(local)) patterns["f.last"] = (patterns["f.last"] || 0) + 1;
      else patterns["first.last"] = (patterns["first.last"] || 0) + 1;
    } else if (local.length <= 2) {
      patterns["initials"] = (patterns["initials"] || 0) + 1;
    } else if (/^[a-z]+$/.test(local)) {
      if (local.length <= 6) patterns["first"] = (patterns["first"] || 0) + 1;
      else patterns["firstlast"] = (patterns["firstlast"] || 0) + 1;
    } else if (local.includes("_")) {
      patterns["first_last"] = (patterns["first_last"] || 0) + 1;
    } else if (local.includes("-")) {
      patterns["first-last"] = (patterns["first-last"] || 0) + 1;
    }
  }

  // Return the most common pattern
  let best: string | null = null;
  let bestCount = 0;
  for (const [pattern, count] of Object.entries(patterns)) {
    if (count > bestCount) {
      best = pattern;
      bestCount = count;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Main find function
// ---------------------------------------------------------------------------

async function findEmail(domain: string, firstName: string, lastName: string): Promise<FindResult> {
  const result: FindResult = {
    domain,
    first_name: firstName,
    last_name: lastName,
    mx_records: [],
    candidates: [],
    best_match: null,
  };

  // Step 1: Check MX records exist
  const mxRecords = await getMxRecords(domain);
  result.mx_records = mxRecords;

  if (mxRecords.length === 0) {
    return result; // No MX = domain doesn't receive email
  }

  // Step 2: Generate candidates
  const rawCandidates = generateCandidates(firstName, lastName, domain);

  // Step 3: Scrape website for email patterns (parallel with SMTP)
  const [scrapedEmails] = await Promise.all([
    scrapeEmailsFromSite(domain),
  ]);

  // Detect the company's email pattern from scraped emails
  const dominantPattern = detectDomainPattern(scrapedEmails, firstName, lastName);

  // Step 4: Check if any scraped email matches our person
  const fLower = firstName.toLowerCase();
  const lLower = lastName.toLowerCase();
  const directMatch = scrapedEmails.find((e) => {
    const local = e.split("@")[0];
    return local.includes(fLower) || local.includes(lLower);
  });

  // Step 5: Build candidates with scores
  const candidates: EmailCandidate[] = rawCandidates.map((c) => {
    let confidence = c.baseScore;
    const sources: string[] = ["pattern-generation"];

    // Boost if matches dominant pattern
    if (dominantPattern && c.pattern === dominantPattern) {
      confidence = Math.min(confidence + 15, 99);
      sources.push("domain-pattern-match");
    }

    // If directly found on website
    if (directMatch && directMatch === c.email) {
      confidence = 99;
      sources.push("website-scrape");
    }

    // Boost if scraped emails exist (means domain is active)
    if (scrapedEmails.length > 0) {
      confidence = Math.min(confidence + 5, 99);
    }

    return {
      email: c.email,
      pattern: c.pattern,
      confidence,
      mx_valid: mxRecords.length > 0,
      smtp_valid: null,
      sources,
    };
  });

  // Step 6: Try SMTP verification on top 3 candidates
  const topCandidates = candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  const primaryMx = mxRecords[0];

  if (primaryMx) {
    const smtpResults = await Promise.all(
      topCandidates.map((c) => smtpCheck(primaryMx, c.email, 6000))
    );

    for (let i = 0; i < topCandidates.length; i++) {
      topCandidates[i].smtp_valid = smtpResults[i];
      if (smtpResults[i] === true) {
        topCandidates[i].confidence = Math.min(topCandidates[i].confidence + 10, 99);
        topCandidates[i].sources.push("smtp-verified");
      } else if (smtpResults[i] === false) {
        topCandidates[i].confidence = Math.max(topCandidates[i].confidence - 30, 5);
        topCandidates[i].sources.push("smtp-rejected");
      }
    }
  }

  // Sort by confidence and take top 3
  result.candidates = candidates
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  result.best_match = result.candidates[0] || null;

  return result;
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;

function isValidDomain(domain: string): boolean {
  return DOMAIN_REGEX.test(domain);
}

function isValidName(name: string): boolean {
  return name.length >= 1 && name.length <= 50 && /^[a-zA-ZÀ-ÿ\s'-]+$/.test(name);
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerRoutes(app: Hono) {
  app.get("/api/find", async (c) => {
    await tryRequirePayment(0.005);
    const domain = c.req.query("domain");
    const firstName = c.req.query("firstName");
    const lastName = c.req.query("lastName");

    if (!domain) return c.json({ error: "Missing required parameter: domain" }, 400);
    if (!firstName) return c.json({ error: "Missing required parameter: firstName" }, 400);
    if (!lastName) return c.json({ error: "Missing required parameter: lastName" }, 400);

    const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    if (!isValidDomain(cleanDomain)) return c.json({ error: "Invalid domain format" }, 400);
    if (!isValidName(firstName)) return c.json({ error: "Invalid firstName" }, 400);
    if (!isValidName(lastName)) return c.json({ error: "Invalid lastName" }, 400);

    const startTime = Date.now();
    try {
      const result = await findEmail(cleanDomain, firstName.trim(), lastName.trim());
      return c.json({ ...result, lookup_time_ms: Date.now() - startTime });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Email finder failed";
      return c.json({ error: msg, domain: cleanDomain, lookup_time_ms: Date.now() - startTime }, 500);
    }
  });
}
