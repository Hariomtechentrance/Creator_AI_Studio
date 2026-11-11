import type { LeadSource } from "@/types/database";

function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
  }

  return rows;
}

/**
 * Meta's lead downloads have shipped as both plain comma CSV and as
 * UTF-16 tab-separated text with a .csv extension, so the delimiter is
 * sniffed from the header line rather than assumed.
 */
function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs > commas ? "\t" : ",";
}

/** "Full Name", "full name" and Meta's "full_name" all become "full_name". */
function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseLeadsCsv(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ""), detectDelimiter(text));
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      if (header) record[header] = (row[i] ?? "").trim();
    });
    return record;
  });
}

/**
 * Decodes an uploaded file by its byte-order mark: Meta's older "Download
 * leads" export is UTF-16LE, which File.text() (always UTF-8) turns into
 * unreadable text where every header fails to match.
 */
export async function readCsvFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  return new TextDecoder("utf-8").decode(bytes);
}

const NAME_KEYS = ["name", "full_name", "fullname", "lead_name", "contact_name", "customer_name"];
const EMAIL_KEYS = ["email", "email_address", "e_mail", "work_email"];
const PHONE_KEYS = ["phone", "phone_number", "mobile", "mobile_number", "mobile_no", "contact_number", "whatsapp", "whatsapp_number", "work_phone_number"];
const COMPANY_KEYS = ["company", "company_name", "business_name", "business", "organization", "organisation"];
const CITY_KEYS = ["city", "location", "town", "city_name"];

/** Columns that only exist to identify rows inside Meta's systems — no use to whoever calls the lead back. */
const META_ONLY_KEYS = new Set(["id", "is_organic", "lead_status", "inbox_url"]);

/** Present in every Meta lead export (Leads Center and the per-form download), never in a hand-made sheet. */
const META_EXPORT_MARKERS = ["form_id", "ad_id", "adset_id", "campaign_id", "form_name"];

function pick(record: Record<string, string>, keys: string[]): { value: string | null; key: string | null } {
  for (const key of keys) {
    const value = record[key];
    if (value) return { value, key };
  }
  return { value: null, key: null };
}

/**
 * Meta prefixes exported phone numbers with "p:" (e.g. "p:+919876543210").
 * Spaces, dashes and brackets are dropped too so the same number typed
 * differently still matches findDuplicateLead's exact comparison, and so
 * tel:/WhatsApp links work.
 */
export function cleanPhone(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/^p:\s*/i, "").replace(/[\s\-().]/g, "");
  return cleaned || null;
}

export interface CsvLead {
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  location: string | null;
  source: LeadSource;
  /** Form answers and ad attribution (campaign/ad set/ad names) that have no dedicated column. */
  customFields: Record<string, string>;
}

export function mapCsvRowToLead(record: Record<string, string>): CsvLead {
  const isMetaExport = META_EXPORT_MARKERS.some((key) => key in record);

  const name = pick(record, NAME_KEYS);
  const firstLast = [record.first_name, record.last_name].filter(Boolean).join(" ") || null;
  const email = pick(record, EMAIL_KEYS);
  const phone = pick(record, PHONE_KEYS);
  const company = pick(record, COMPANY_KEYS);
  const city = pick(record, CITY_KEYS);

  const used = new Set([name.key, email.key, phone.key, company.key, city.key]);
  if (!name.value && firstLast) {
    used.add("first_name");
    used.add("last_name");
  }

  const customFields: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!value || used.has(key) || META_ONLY_KEYS.has(key) || key.endsWith("_id")) continue;
    customFields[key] = value;
  }

  return {
    name: name.value ?? firstLast,
    email: email.value,
    phone: cleanPhone(phone.value),
    company: company.value,
    location: city.value,
    source: isMetaExport ? "facebook" : "csv",
    customFields,
  };
}
