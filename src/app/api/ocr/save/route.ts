import { promises as fs } from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image, mimeType } = body || {};
    if (!image) return new Response(JSON.stringify({ error: 'no image' }), { status: 400 });

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const ext = (mimeType && mimeType.split('/')[1]) || 'png';
    const filename = `ocr-${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    // image is base64 without data: prefix
    const buffer = Buffer.from(image, 'base64');
    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${filename}`;
    return new Response(JSON.stringify({ url: publicUrl }), { status: 200 });
  } catch (err) {
    console.error('ocr save error', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
