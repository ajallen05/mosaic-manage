import config from '../config/index.js';
import { contentRepository } from '../repositories/contentRepository.js';

const IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell-Free';
const API_URL = 'https://api.together.xyz/v1/images/generations';

async function generateImage(prompt) {
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
    throw new Error(`Together AI image edit failed: ${detail}`);
  }
  const data = await res.json();
  return data.data[0].b64_json;
}

export const editorService = {
  async promptEdit({ userId, imageId, editPrompt }) {
    const record = contentRepository.findById(imageId);
    if (!record || record.userId !== userId) {
      const err = new Error('Image not found');
      err.status = 404;
      throw err;
    }

    // Combine original prompt with edit instruction for best results
    const combinedPrompt = `${record.prompt}. ${editPrompt}`;
    const base64 = await generateImage(combinedPrompt);

    const editHistoryEntry = {
      prompt: editPrompt,
      base64: record.base64,
      editedAt: new Date().toISOString(),
    };

    const updated = contentRepository.update(imageId, {
      base64,
      mimeType: 'image/jpeg',
      editHistory: [...(record.editHistory || []), editHistoryEntry],
    });

    return { id: updated.id, base64: updated.base64, mimeType: updated.mimeType };
  },

  saveCanvasEdit({ userId, imageId, canvasData, compositeBase64, mimeType }) {
    const record = contentRepository.findById(imageId);
    if (!record || record.userId !== userId) {
      const err = new Error('Image not found');
      err.status = 404;
      throw err;
    }

    const editHistoryEntry = {
      prompt: '[canvas edit]',
      base64: record.base64,
      editedAt: new Date().toISOString(),
    };

    const updated = contentRepository.update(imageId, {
      base64: compositeBase64,
      mimeType: mimeType || 'image/png',
      canvasData,
      editHistory: [...(record.editHistory || []), editHistoryEntry],
    });

    return { id: updated.id, base64: updated.base64, mimeType: updated.mimeType };
  },
};
