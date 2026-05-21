import config from '../config/index.js';
import { geminiImageProvider } from './providers/gemini.js';
import { huggingfaceImageProvider } from './providers/huggingface.js';
import { pollinationsImageProvider } from './providers/pollinations.js';

// Selects the active image provider from config.imageProvider (env IMAGE_PROVIDER).
// Each provider exposes the same interface: generateImage(prompt) -> { base64, mimeType }.
const providers = {
  gemini: geminiImageProvider,
  huggingface: huggingfaceImageProvider,
  pollinations: pollinationsImageProvider,
};

export function getImageProvider() {
  const provider = providers[config.imageProvider];
  if (!provider) {
    const err = new Error(
      `Unknown IMAGE_PROVIDER "${config.imageProvider}". Use one of: ${Object.keys(providers).join(', ')}`
    );
    err.status = 500;
    throw err;
  }
  return provider;
}
