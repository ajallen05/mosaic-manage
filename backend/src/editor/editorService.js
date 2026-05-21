import { contentRepository } from '../repositories/contentRepository.js';
import { getImageProvider } from '../generation/imageProvider.js';
import { buildGenerationError } from '../generation/generationService.js';

export const editorService = {
  // Free image providers are text-to-image only — no true image editing.
  // "Prompt edit" re-generates a fresh image, combining the original prompt
  // with the edit instruction so the new version keeps the original context.
  async promptEdit({ userId, imageId, editPrompt }) {
    const record = contentRepository.findById(imageId);
    if (!record || record.userId !== userId) {
      const err = new Error('Image not found');
      err.status = 404;
      throw err;
    }

    const combinedPrompt = record.prompt ? `${record.prompt}. ${editPrompt}` : editPrompt;

    let image;
    try {
      image = await getImageProvider().generateImage(combinedPrompt);
    } catch (err) {
      throw buildGenerationError([err]);
    }

    const editHistoryEntry = {
      prompt: editPrompt,
      base64: record.base64,
      editedAt: new Date().toISOString(),
    };

    const updated = contentRepository.update(imageId, {
      base64: image.base64,
      mimeType: image.mimeType,
      prompt: combinedPrompt,
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
