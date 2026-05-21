import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import { contentRepository } from '../repositories/contentRepository.js';

const IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell-Free';
const API_URL = 'https://api.together.xyz/v1/images/generations';

async function generateOne(prompt) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.togetherAI.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      width: 1024,
      height: 1024,
      steps: 4,
      n: 1,
      response_format: 'b64_json',
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Together AI image generation failed: ${detail}`);
  }
  const data = await res.json();
  return data.data[0].b64_json;
}

export const generationService = {
  async generateImages({ userId, prompt, count = 4 }) {
    const safeCount = Math.min(Math.max(1, parseInt(count) || 1), 4);

    const results = await Promise.allSettled(
      Array.from({ length: safeCount }, () => generateOne(prompt))
    );

    const images = [];
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[generation] One slot failed:', result.reason?.message);
        continue;
      }
      const record = contentRepository.create({
        id: uuidv4(),
        userId,
        prompt,
        base64: result.value,
        mimeType: 'image/jpeg',
      });
      images.push({ id: record.id, base64: record.base64, mimeType: record.mimeType, prompt });
    }

    if (images.length === 0) {
      const err = new Error('Image generation failed: no images returned from Together AI');
      err.status = 502;
      throw err;
    }
    return images;
  },

  async regenerateImage({ userId, imageId, prompt }) {
    const existing = contentRepository.findById(imageId);
    if (!existing || existing.userId !== userId) {
      const err = new Error('Image not found');
      err.status = 404;
      throw err;
    }
    const base64 = await generateOne(prompt);
    const updated = contentRepository.update(imageId, { base64, mimeType: 'image/jpeg', prompt });
    return { id: updated.id, base64: updated.base64, mimeType: updated.mimeType, prompt };
  },

  getHistory(userId) {
    return contentRepository.findByUserId(userId).map(r => ({
      id: r.id,
      prompt: r.prompt,
      mimeType: r.mimeType,
      caption: r.caption,
      hashtags: r.hashtags,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },
};
