"use client";

import React from 'react';
// lazy/dynamic import of tesseract to avoid hard dependency at build time

type OcrUploaderProps = {
  onResult: (data: { text?: string; parsed?: any }) => void;
  targetForm?: 'onboarding' | 'expense' | 'checkin';
};

export default function OcrUploader({ onResult, targetForm = 'checkin' }: OcrUploaderProps) {
  const [processing, setProcessing] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  async function handleFile(file?: File) {
    if (!file) return;
    setProcessing(true);
    const url = URL.createObjectURL(file);
    setPreview(url);

    try {
      // run Tesseract.js in the browser (dynamically imported)
      const tesseract: any = await import('tesseract.js').catch(() => null);
      let text = '';
      if (tesseract) {
        // Preferred path: worker API
        if (typeof tesseract.createWorker === 'function') {
          const worker = await tesseract.createWorker();
          // guard against builds where worker methods may differ
          if (worker.load && worker.loadLanguage && worker.initialize && worker.recognize) {
            await worker.load();
            // only call loadLanguage/initialize if present (some builds bundle different API)
            try {
              await worker.loadLanguage?.('eng');
              await worker.initialize?.('eng');
            } catch (e) {
              // ignore if language load/initialize not supported in this build
            }
            const result = await worker.recognize(file);
            await worker.terminate();
            text = (result?.data?.text ?? '').trim();
          } else {
            // fallback to library-level recognize if worker doesn't expose expected methods
            if (typeof tesseract.recognize === 'function') {
              const result = await tesseract.recognize(file, 'eng');
              text = (result?.data?.text ?? '').trim();
            } else {
              console.warn('tesseract worker API missing methods and library-level recognize not available');
            }
          }
        } else if (typeof tesseract.recognize === 'function') {
          // Some builds export a top-level recognize function
          const result = await tesseract.recognize(file, 'eng');
          text = (result?.data?.text ?? '').trim();
        } else {
          console.warn('tesseract.js does not expose worker or recognize API');
        }
      } else {
        console.warn('tesseract.js not available; skipping OCR');
      }

      // optional: upload image to server for storage (non-blocking)
      try {
        const arrayBuffer = await file.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        fetch('/api/ocr/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: b64, mimeType: file.type }),
        }).catch(() => {});
      } catch (e) {
        // ignore upload errors
      }

      // send extracted text to parse-fields (same flow as MicRecorder)
      const parseRes = await fetch('/api/parse-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetForm }),
      });
      const parseJson = await parseRes.json();

      onResult({ text, parsed: parseJson?.parsed ?? null });
    } catch (err) {
      console.error('ocr error', err);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="px-3 py-2 rounded-md border bg-black text-sm shadow-sm"
        aria-busy={processing}
      >
        {processing ? 'Scanning…' : 'Upload image (OCR)'}
      </button>

      {preview ? (
        <img src={preview} alt="preview" className="h-12 object-contain rounded" />
      ) : (
        <div className="h-12 w-24 bg-gray-50 rounded flex items-center justify-center text-xs text-muted-foreground">Image preview</div>
      )}
    </div>
  );
}
