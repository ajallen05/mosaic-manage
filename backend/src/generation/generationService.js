import { v4 as uuidv4 } from 'uuid';
import { contentRepository } from '../repositories/contentRepository.js';
import { getImageProvider } from './imageProvider.js';

// Collapses one or more provider failures into a single user-facing error.
// Detects quota/rate-limit (429) for a friendly message; otherwise surfaces
// the provider's own message and status so the real cause is visible.
export function buildGenerationError(errors) {
  const items = errors.map(e => (typeof e === 'string' ? { message: e } : (e || {})));
  const joined = items.map(e => e.message || '').join(' ');

  if (/\b429\b|quota|too many requests/i.test(joined)) {
    const err = new Error(
      'Image generation rate/quota limit reached. Wait a moment and retry, ' +
      'or check your provider plan (free tiers are rate-limited).'
    );
    err.status = 429;
    return err;
  }

  const first = items[0];
  if (first?.message) {
    const err = new Error(first.message);
    err.status = first.status || 502;
    return err;
  }

  const err = new Error('Image generation failed: no image returned from the provider');
  err.status = 502;
  return err;
}

export const generationService = {
  async generateImages({ userId, prompt, count = 4 }) {
    const safeCount = Math.min(Math.max(1, parseInt(count) || 1), 4);
    const provider = getImageProvider();

    const responses = await Promise.allSettled(
      Array.from({ length: safeCount }, () => provider.generateImage(prompt))
    );

    const results = [];
    const failures = [];

    for (const res of responses) {
      if (res.status === 'rejected') {
        console.error('[generation] Image generation failed for one slot:', res.reason?.message || res.reason);
        failures.push(res.reason);
        continue;
      }
      const { base64, mimeType } = res.value;
      const record = contentRepository.create({
        id: uuidv4(),
        userId,
        prompt,
        base64,
        mimeType,
      });
      results.push({ id: record.id, base64: record.base64, mimeType: record.mimeType, prompt });
    }

    if (results.length === 0) {
      throw buildGenerationError(failures);
    }
    return results;
  },

  async regenerateImage({ userId, imageId, prompt }) {
    const existing = contentRepository.findById(imageId);
    if (!existing || existing.userId !== userId) {
      const err = new Error('Image not found');
      err.status = 404;
      throw err;
    }

    let image;
    try {
      image = await getImageProvider().generateImage(prompt);
    } catch (err) {
      throw buildGenerationError([err]);
    }

    const updated = contentRepository.update(imageId, {
      base64: image.base64,
      mimeType: image.mimeType,
      prompt,
    });
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
