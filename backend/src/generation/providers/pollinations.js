// Pollinations.ai — free, no API key, no sign-up required.
// GET https://image.pollinations.ai/prompt/{encoded_prompt}?nologo=true&model=flux
// Returns the image directly as binary.
const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';

export const pollinationsImageProvider = {
  async generateImage(prompt) {
    const url = `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}?nologo=true&model=flux&width=1024&height=1024`;

    let res;
    try {
      res = await fetch(url);
    } catch (networkErr) {
      const cause = networkErr.cause?.code || networkErr.cause?.message || networkErr.message;
      const err = new Error(
        `Pollinations request failed (network error: ${cause}). ` +
        'Check that image.pollinations.ai is reachable from your machine.'
      );
      err.status = 502;
      throw err;
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const err = new Error(`Pollinations image generation failed (${res.status}): ${detail}`);
      err.status = 502;
      throw err;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get('content-type') || 'image/jpeg';
    return { base64: buffer.toString('base64'), mimeType };
  },
};
