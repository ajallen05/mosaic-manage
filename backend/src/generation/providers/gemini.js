import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../../config/index.js';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

// Image provider backed by Gemini (Nano Banana models). Requires a
// billing-enabled Google Cloud project — image models are not free-tier.
export const geminiImageProvider = {
  async generateImage(prompt) {
    const model = genAI.getGenerativeModel({
      model: config.gemini.imageModel || 'gemini-2.5-flash-image',
    });
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    });
    const imagePart = response.response.candidates?.[0]?.content.parts.find(p => p.inlineData);
    if (!imagePart) {
      const err = new Error('Gemini returned no image');
      err.status = 502;
      throw err;
    }
    return {
      base64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
    };
  },
};
