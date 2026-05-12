import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

type ParsedEntry = {
  id: string;
  date: string;
  description: string;
  amount: number;
  direction: 'credit' | 'debit';
  category: string;
};

function normalizeDate(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  const dmy = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const dd = Number(dmy[1]);
    const mm = Number(dmy[2]);
    const yyyy = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
    const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }

  const parsed = new Date(t);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return null;
}

function inferCategory(desc: string): string {
  const s = desc.toLowerCase();
  if (s.includes('swiggy') || s.includes('zomato') || s.includes('restaurant') || s.includes('food')) return 'Food & Dining';
  if (s.includes('uber') || s.includes('ola') || s.includes('metro') || s.includes('fuel') || s.includes('petrol')) return 'Transport';
  if (s.includes('amazon') || s.includes('flipkart') || s.includes('myntra')) return 'Shopping';
  if (s.includes('electricity') || s.includes('water bill') || s.includes('gas bill') || s.includes('recharge')) return 'Utilities';
  if (s.includes('rent') || s.includes('emi')) return 'Rent/EMI';
  if (s.includes('hospital') || s.includes('pharmacy')) return 'Healthcare';
  if (s.includes('school') || s.includes('college') || s.includes('course')) return 'Education';
  return 'Other';
}

function parseAmount(v: string): number | null {
  const m = v.replace(/[, ]/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

function parseDirection(raw: string, description: string, amountRaw: string): 'credit' | 'debit' {
  const s = `${raw} ${description} ${amountRaw}`.toLowerCase();
  if (s.includes('cr') || s.includes('credit') || s.includes('received') || s.includes('deposit')) return 'credit';
  return 'debit';
}

function parseFromText(text: string): ParsedEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: ParsedEntry[] = [];

  for (const line of lines) {
    const dateMatch = line.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    const amountMatch = line.match(/(?:₹|INR|Rs\.?)?\s*([0-9][0-9,]*\.?[0-9]{0,2})\s*(CR|DR|Cr|Dr|credit|debit)?/);
    if (!dateMatch || !amountMatch) continue;

    const dateIso = normalizeDate(dateMatch[1]);
    const amount = parseAmount(amountMatch[1]);
    if (!dateIso || !amount || amount <= 0) continue;

    const description = line.replace(dateMatch[0], '').trim().slice(0, 140) || 'Statement transaction';
    const direction = parseDirection(amountMatch[2] || '', description, line);

    out.push({
      id: `stmt_${Buffer.from(`${dateIso}_${description}_${amount}`).toString('base64').slice(0, 24)}`,
      date: dateIso,
      description,
      amount,
      direction,
      category: direction === 'debit' ? inferCategory(description) : 'Other',
    });
  }

  return out;
}

function parseFromSheetRows(rows: Record<string, any>[]): ParsedEntry[] {
  const out: ParsedEntry[] = [];

  for (const row of rows) {
    const entries = Object.entries(row).map(([k, v]) => [String(k).toLowerCase(), String(v ?? '').trim()] as const);
    const get = (...keys: string[]) => entries.find(([k]) => keys.some((key) => k.includes(key)))?.[1] || '';

    const dateRaw = get('date', 'txn date', 'transaction date', 'value date');
    const desc = get('description', 'narration', 'particular', 'remarks', 'details');
    const debitRaw = get('debit', 'withdrawal', 'dr');
    const creditRaw = get('credit', 'deposit', 'cr');
    const amountRaw = get('amount');
    const typeRaw = get('type', 'txn type');

    const dateIso = normalizeDate(dateRaw);
    if (!dateIso) continue;

    let direction: 'credit' | 'debit' = 'debit';
    let amount: number | null = null;

    const debit = parseAmount(debitRaw);
    const credit = parseAmount(creditRaw);
    const plainAmount = parseAmount(amountRaw);

    if (debit && debit > 0) {
      direction = 'debit';
      amount = debit;
    } else if (credit && credit > 0) {
      direction = 'credit';
      amount = credit;
    } else if (plainAmount && plainAmount > 0) {
      direction = parseDirection(typeRaw, desc, amountRaw);
      amount = plainAmount;
    }

    if (!amount) continue;

    const description = (desc || 'Statement transaction').slice(0, 140);
    out.push({
      id: `stmt_${Buffer.from(`${dateIso}_${description}_${amount}`).toString('base64').slice(0, 24)}`,
      date: dateIso,
      description,
      amount,
      direction,
      category: direction === 'debit' ? inferCategory(description) : 'Other',
    });
  }

  return out;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Disable worker to avoid Next/Turbopack worker chunk issues.
  const loadingTask = getDocument(
    {
      data: new Uint8Array(buffer),
      disableWorker: true,
      // `standardFontDataUrl` etc. are not needed for basic text extraction.
    } as any
  );

  const pdf = await loadingTask.promise;
  try {
    const parts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = (content.items as any[])
        .map((it) => (typeof it.str === 'string' ? it.str : ''))
        .join(' ');
      parts.push(pageText);
    }
    return parts.join('\n');
  } finally {
    try {
      await pdf.destroy();
    } catch {
      // ignore
    }
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let parsed: ParsedEntry[] = [];

    if (name.endsWith('.pdf')) {
      let text = '';
      try {
        text = await extractPdfText(buffer);
      } catch (e: any) {
        // pdf.js errors can be non-obvious; surface a friendly message
        const msg = String(e?.message || e);
        console.error('PDF parse failed:', e);
        if (msg.toLowerCase().includes('password')) {
          return NextResponse.json(
            { error: 'This PDF is password-protected. Please export an unprotected statement PDF/Excel.' },
            { status: 400 }
          );
        }
        return NextResponse.json(
          {
            error:
              'Could not read text from this PDF. If it is a scanned/image statement, export Excel/CSV instead (recommended) or use a text-based PDF.',
            details: msg,
          },
          { status: 400 }
        );
      }

      parsed = parseFromText(text || '');
      if (parsed.length === 0) {
        return NextResponse.json(
          {
            error:
              'No transactions detected in this PDF text. This usually means the statement is scanned/image-based. Please export Excel/CSV from YONO/netbanking for best results.',
          },
          { status: 400 }
        );
      }
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const allRows: Record<string, any>[] = [];
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        allRows.push(...rows);
      }
      parsed = parseFromSheetRows(allRows);
      if (parsed.length === 0) {
        return NextResponse.json(
          {
            error:
              'No transactions detected in this file. Please confirm the sheet has columns like Date/Narration and Debit/Credit (or Amount).',
          },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF, XLSX, XLS, or CSV.' }, { status: 400 });
    }

    const unique = new Map<string, ParsedEntry>();
    for (const row of parsed) unique.set(row.id, row);
    const rows = Array.from(unique.values()).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

    const summary = {
      totalRows: rows.length,
      totalDebits: rows.filter((r) => r.direction === 'debit').reduce((s, r) => s + r.amount, 0),
      totalCredits: rows.filter((r) => r.direction === 'credit').reduce((s, r) => s + r.amount, 0),
    };

    return NextResponse.json({ rows: rows.slice(0, 500), summary });
  } catch (e: any) {
    console.error('Statement parse route failed:', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to parse statement', details: String(e?.stack || '') },
      { status: 400 }
    );
  }
}

