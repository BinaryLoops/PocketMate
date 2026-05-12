import { NextResponse } from 'next/server';

type ParseRequest = {
  text: string;
  targetForm?: 'onboarding' | 'expense';
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ParseRequest;
    const { text, targetForm = 'onboarding' } = body || {};

    console.info('[parse-fields] incoming request', { textLength: text?.length ?? 0, targetForm });

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    // --- API keys and model setup ---
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    const project = process.env.GOOGLE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

    if (!apiKey || !project) {
      return NextResponse.json(
        { error: 'Missing API key or project id: set GOOGLE_API_KEY or GEMINI_API_KEY and GOOGLE_PROJECT_ID in server env' },
        { status: 500 }
      );
    }

    // --- Categories & Instructions ---
    const allowedCategories = [
      'Food & Dining',
      'Groceries',
      'Transport',
      'Shopping',
      'Entertainment',
      'Utilities',
      'Rent/EMI',
      'Healthcare',
      'Education',
      'Other',
    ];

    const instructions = {
      onboarding: `Produce a JSON object with keys: role (Student|Professional|Housewife), income (number), fixedExpenses (array of {name,category,amount,timelineMonths,startDate?}). Parse dates as ISO strings. Only output JSON, no explanation. If a field is missing, omit it.`,
      expense: `Produce a JSON object with keys: description (short string, 2-6 words), amount (number = total amount on the receipt), category (one of ${allowedCategories.join(
        ', '
      )}), date (ISO date if available). Only output JSON, no explanation. The category value MUST be exactly one of the allowed values: ${allowedCategories.join(
        ' | '
      )}. If you cannot determine a category, return \"Other\". If you see line-item prices, prefer the explicit \"Total\" line; otherwise sum item prices to compute the total. Always return amount as a plain number.`,
    } as const;

    const prompt = `${instructions[targetForm as keyof typeof instructions]}\n\nInput: "${text.replace(/"/g, '\\"')}` + '"';

    // --- API Configuration (Generative Models endpoint) ---
    const API_BASE = process.env.PARSE_FIELDS_API_BASE || 'https://generativelanguage.googleapis.com/v1';
  const primaryModel = (process.env.PARSE_FIELDS_MODEL || 'gemini-2.5-flash').replace(/^models\//, '');
    const urlForModel = (modelId: string) => `${API_BASE}/models/${modelId}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    // --- Fallback logic helpers ---
    const extractNumber = (s: string | undefined) => {
      if (!s) return null;
      const totalMatch = s.match(/total[^\d](\d{1,3}(?:[\d,])(?:\.\d+)?)/i);
      if (totalMatch) return Number(totalMatch[1].replace(/,/g, ''));
      const nums = Array.from(s.matchAll(/(\d{1,3}(?:[\d,]*)(?:\.\d+)?)/g)).map((m) =>
        Number(m[0].replace(/,/g, ''))
      );
      if (nums.length === 0) return null;
      const sensible = nums.filter((n) => !Number.isNaN(n) && isFinite(n) && n > 0);
      if (sensible.length === 0) return null;
      return sensible.reduce((a, b) => Math.max(a, b), 0);
    };

    const ensureAmountFromText = (rawText: string) => {
      const maybe = extractNumber(rawText);
      if (maybe != null) console.info('[parse-fields] ensureAmountFromText extracted', { value: maybe });
      return maybe;
    };

    // --- Call the Generative Model ---
    const callModel = async (modelId: string) => {
      const tryUrl = urlForModel(modelId);
      console.info('[parse-fields] calling model', tryUrl);
      try {
        const r = await fetch(tryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.0, maxOutputTokens: 800 },
          }),
        });
        const j = await r.json().catch(() => null);
        return { resp: r, json: j } as const;
      } catch (e) {
        return { resp: null, json: String(e) } as const;
      }
    };

    let resp: Response | null = null;
    let json: any = null;
    let output = '';

    const primary = await callModel(primaryModel);
    resp = primary.resp;
    json = primary.json;

    console.info('[parse-fields] model attempt', { model: primaryModel, status: resp?.status ?? 'fetch-error' });
    console.info('[parse-fields] model response body', JSON.stringify(json));

    // --- Handle model failure (try fallback models) ---
    if (!resp || !resp.ok) {
      let fallbackList =
        (process.env.PARSE_FIELDS_MODEL_FALLBACKS || 'models/gemini-1.5-pro,models/gemini-1.0-pro')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

      for (const alt of fallbackList) {
  const altId = alt.replace(/^models\//, '');
        console.info('[parse-fields] trying fallback model', altId);
        const attempt = await callModel(altId);
        console.info('[parse-fields] fallback attempt result', {
          model: alt,
          status: attempt.resp?.status ?? 'fetch-error',
        });
        if (attempt.resp && attempt.resp.ok) {
          resp = attempt.resp;
          json = attempt.json;
          console.info('[parse-fields] fallback model succeeded', alt);
          break;
        }
      }
    }

    // --- Fallback handling ---
    if (!resp || !resp.ok) {
      console.error('[parse-fields] generative API failed', resp?.status ?? 'no-response', json);
      const fallbackParsed: any = {};
      const fallbackAmount = ensureAmountFromText(text);
      if (fallbackAmount != null) fallbackParsed.amount = fallbackAmount;
      const cleaned = text.replace(/[\n\r]/g, ' ').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      fallbackParsed.description = cleaned.split(' ').slice(0, 6).join(' ') || 'Expense';
      fallbackParsed.category = 'Other';
      fallbackParsed._amountSource = fallbackParsed.amount != null ? 'fallback' : 'none';
      return NextResponse.json(
        { error: 'Generative API error', parsed: fallbackParsed, raw: '', modelResponse: json },
        { status: 200 }
      );
    }

    // --- Extract model output ---
    output =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ??
      json?.candidates?.[0]?.content ??
      '';

    // --- Parse JSON output ---
    let parsed: any = {};
    try {
      const match = output.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch (e) {
      parsed = {};
    }

    // --- Normalize values ---
    if (parsed.description && typeof parsed.description === 'string') {
      const words = parsed.description.trim().split(/\s+/);
      if (words.length > 6) parsed.description = words.slice(0, 6).join(' ');
    }

    const parsedAmount = parsed?.amount ?? parsed?.total ?? parsed?.Total;
    let _amountSource: 'model' | 'fallback' | 'none' = 'model';

    if (parsedAmount == null || Number.isNaN(Number(parsedAmount))) {
      const fallback1 = ensureAmountFromText(output);
      const fallback2 = ensureAmountFromText(text);
      const finalAmount = fallback1 ?? fallback2 ?? null;
      if (finalAmount != null) {
        parsed.amount = finalAmount;
        _amountSource = 'fallback';
      } else {
        _amountSource = 'none';
      }
    } else {
      parsed.amount = Number(parsedAmount);
    }

    parsed._amountSource = _amountSource;

    if ((!parsed.description || parsed.description.trim() === '') && text) {
      const cleaned = text.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      parsed.description = cleaned.split(' ').slice(0, 6).join(' ') || 'Expense';
    }

    // --- Normalize category ---
    const normalizeCategory = (rawCat: string | undefined) => {
      if (!rawCat) return 'Other';
      const lower = rawCat.toLowerCase();
      if (/food|restaurant|dine|cafe|meal/.test(lower)) return 'Food & Dining';
      if (/grocery|supermarket|vegetable|fruit|mart/.test(lower)) return 'Groceries';
      if (/taxi|uber|ola|rapido|bus|metro|train|transport|ride/.test(lower)) return 'Transport';
      if (/shopping|mall|clothes|apparel|purchase/.test(lower)) return 'Shopping';
      if (/movie|netflix|spotify|entertainment|show/.test(lower)) return 'Entertainment';
      if (/electric|water|bill|utility|internet|wifi|gas/.test(lower)) return 'Utilities';
      if (/rent|emi|loan|mortgage/.test(lower)) return 'Rent/EMI';
      if (/doctor|hospital|medicine|clinic|health|pharmacy/.test(lower)) return 'Healthcare';
      if (/tuition|course|study|education|school|college/.test(lower)) return 'Education';
      return 'Other';
    };

    parsed.category = normalizeCategory(parsed.category);

    return NextResponse.json({ parsed, raw: output, modelResponse: json });
  } catch (err: any) {
    console.error('[parse-fields] fatal error', err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}