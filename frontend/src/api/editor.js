import client from './client.js';

export const editorApi = {
  promptEdit: (imageId, editPrompt) =>
    client.post('/editor/prompt-edit', { imageId, editPrompt }).then(r => r.data),
  saveCanvas: (imageId, canvasData, compositeBase64, mimeType, sceneGraph) =>
    client.post('/editor/save', { imageId, canvasData, compositeBase64, mimeType, sceneGraph }).then(r => r.data),
};
