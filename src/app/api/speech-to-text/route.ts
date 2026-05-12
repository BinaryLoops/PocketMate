import { NextResponse } from 'next/server';

// Simple route that accepts JSON { audio: string (base64 or data URL), mimeType?: string }
// and forwards to Google Speech-to-Text REST API using an API key from env.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { audio, mimeType = 'audio/webm' } = body || {};

    if (!audio) {
      return NextResponse.json({ error: 'Missing audio payload' }, { status: 400 });
    }

  // Accept either GOOGLE_API_KEY or GEMINI_API_KEY (fallback)
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key: set GOOGLE_API_KEY or GEMINI_API_KEY in server env' }, { status: 500 });
    }

  // Diagnostic logging (mask key)
  const mask = (s: string) => s ? `${s.slice(0,4)}...${s.slice(-4)}` : 'none';
  console.debug('[speech-to-text] using key var:', process.env.GOOGLE_API_KEY ? 'GOOGLE_API_KEY' : 'GEMINI_API_KEY', 'masked=', mask(apiKey));

    // Map common mime types to Google encoding labels
    const encoding = mimeType.includes('webm')
      ? 'WEBM_OPUS'
      : mimeType.includes('ogg')
      ? 'OGG_OPUS'
      : mimeType.includes('wav')
      ? 'LINEAR16'
      : 'ENCODING_UNSPECIFIED';

    // Strip data URL prefix if present
    const base64 = String(audio).replace(/^data:.*;base64,/, '');

    console.debug('[speech-to-text] encoding:', encoding, 'audio bytes:', base64.length);

    const resp = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: (() => {
            const cfg: any = {
              encoding,
              // Force English transcription
              languageCode: 'en-US',
              enableAutomaticPunctuation: true,
              audioChannelCount: 1,
              // Prefer English by providing a phrase hint; keep it minimal
              speechContexts: [{ phrases: ['expense', 'rent', 'subscription', 'EMI', 'lunch', 'dinner', 'groceries'] }],
              maxAlternatives: 1,
            };
            // For container formats that carry their own sample rate (WEBM/OGG with OPUS), do not set sampleRateHertz.
            if (encoding === 'LINEAR16') {
              cfg.sampleRateHertz = 16000;
            }
            return cfg;
          })(),
          audio: { content: base64 },
        }),
      }
    );
    const textJson = await resp.text();
    let json: any = null;
    try { json = JSON.parse(textJson); } catch (e) { json = { raw: textJson }; }

    if (!resp.ok) {
      console.error('[speech-to-text] upstream error', { status: resp.status, body: json });
      return NextResponse.json({ error: 'Speech-to-text API error', status: resp.status, details: json }, { status: 502 });
    }

    // Try to extract the first transcript
    const transcript = json?.results?.[0]?.alternatives?.[0]?.transcript ?? '';

    return NextResponse.json({ text: transcript, raw: json });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
