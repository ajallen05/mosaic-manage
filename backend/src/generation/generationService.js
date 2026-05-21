import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import { contentRepository } from '../repositories/contentRepository.js';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

function getImageModel() {
  return genAI.getGenerativeModel({
    model: config.gemini.imageModel || 'gemini-2.5-flash-image',
  });
}

// Turns raw Gemini failure messages into a single user-facing error.
// Detects quota/rate-limit (429) so the cause is obvious instead of a generic 502.
function buildGenerationError(messages) {
  const joined = messages.join(' ');
  if (/\b429\b|quota|too many requests/i.test(joined)) {
    const err = new Error(
      'Gemini quota exceeded for the image model. The Nano Banana image models ' +
      'are not on the free tier — enable billing on your Google Cloud project, ' +
      'or set GEMINI_IMAGE_MODEL to a model your plan allows.'
    );
    err.status = 429;
    return err;
  }
  const err = new Error('Image generation failed: no images returned from Gemini');
  err.status = 502;
  return err;
}

export const generationService = {
  async generateImages({ userId, prompt, count = 4 }) {
    const safeCount = Math.min(Math.max(1, parseInt(count) || 1), 4);
    const model = getImageModel();

    const promises = Array.from({ length: safeCount }, () =>
      model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
      })
    );

    const responses = await Promise.allSettled(promises);
    const results = [];
    const failures = [];

    for (const res of responses) {
      if (res.status === 'rejected') {
        const msg = res.reason?.message || String(res.reason);
        console.error('[generation] Image generation failed for one slot:', msg);
        failures.push(msg);
        continue;
      }
      const candidate = res.value.response.candidates?.[0];
      if (!candidate) continue;
      const imagePart = candidate.content.parts.find(p => p.inlineData);
      if (!imagePart) continue;

      const record = contentRepository.create({
        id: uuidv4(),
        userId,
        prompt,
        base64: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || 'image/png',
      });
      results.push({
        id: record.id,
        base64: record.base64,
        mimeType: record.mimeType,
        prompt,
      });
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
    const model = getImageModel();
    let response;
    try {
      response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
      });
    } catch (err) {
      throw buildGenerationError([err?.message || String(err)]);
    }
    const imagePart = response.response.candidates?.[0]?.content.parts.find(p => p.inlineData);
    if (!imagePart) {
      const err = new Error('Regeneration failed: no image returned');
      err.status = 502;
      throw err;
    }
    const updated = contentRepository.update(imageId, {
      base64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
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
