import config from '../../config/index.js';

const HF_BASE = 'https://api-inference.huggingface.co/models';

// Free text-to-image provider via the Hugging Face Inference API.
// Returns { base64, mimeType }. No image-editing support — text-to-image only.
export const huggingfaceImageProvider = {
  async generateImage(prompt) {
    if (!config.huggingface.apiKey) {
      const err = new Error('Hugging Face not configured. Set HUGGINGFACE_API_KEY in .env');
      err.status = 503;
      throw err;
    }

    const url = `${HF_BASE}/${config.huggingface.imageModel}`;

    // HF cold-starts a model on first use and returns 503 with an ETA.
    // Retry once after waiting, then give up with a clear error.
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.huggingface.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'image/png',
        },
        body: JSON.stringify({ inputs: prompt }),
      });

      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        return {
          base64: buffer.toString('base64'),
          mimeType: res.headers.get('content-type') || 'image/png',
        };
      }

      const detail = await res.text();

      if (res.status === 503 && attempt === 0) {
        let wait = 20;
        try { wait = Math.min(JSON.parse(detail).estimated_time || 20, 30); } catch { /* keep default */ }
        console.warn(`[huggingface] model loading, retrying in ${Math.ceil(wait)}s`);
        await new Promise(resolve => setTimeout(resolve, wait * 1000));
        continue;
      }

      const err = new Error(`Hugging Face image generation failed (${res.status}): ${detail}`);
      err.status = res.status === 429 ? 429 : 502;
      throw err;
    }

    const err = new Error('Hugging Face image generation failed: model did not load in time');
    err.status = 504;
    throw err;
  },
};
