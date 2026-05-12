export async function GET() {
  return new Response(JSON.stringify({ ok: true, msg: 'ocr root' }), { status: 200 });
}

export async function POST() {
  return new Response(JSON.stringify({ error: 'use /api/ocr/save to upload images' }), { status: 400 });
}
