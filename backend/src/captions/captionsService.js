import config from '../config/index.js';
import { contentRepository } from '../repositories/contentRepository.js';

const TEXT_MODEL = 'meta-llama/Llama-3.2-3B-Instruct-Turbo';
const API_URL = 'https://api.together.xyz/v1/chat/completions';

const PLATFORM_GUIDANCE = {
  instagram: 'Instagram — casual, visual, personal tone; use 5–30 relevant hashtags; emojis encouraged.',
  linkedin: 'LinkedIn — professional, thought-leadership tone; 3–5 niche hashtags only; minimal emojis.',
  default: 'General social media; balanced professional-casual tone; 10–20 hashtags.',
};

const TONE_MODIFIERS = {
  casual: 'Write in a fun, relaxed, conversational tone.',
  professional: 'Write in a polished, authoritative, business-appropriate tone.',
  playful: 'Write in a witty, energetic, bold tone with creative wordplay.',
  inspirational: 'Write in an uplifting, motivational tone that inspires action.',
};

async function generateText(prompt) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.togetherAI.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Together AI caption generation failed: ${detail}`);
  }
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

export const captionsService = {
  async generateCaption({ userId, imageId, platform = 'default', tone = 'casual' }) {
    const record = contentRepository.findById(imageId);
    if (!record || record.userId !== userId) {
      const err = new Error('Image not found');
      err.status = 404;
      throw err;
    }

    const platformGuide = PLATFORM_GUIDANCE[platform] || PLATFORM_GUIDANCE.default;
    const toneGuide = TONE_MODIFIERS[tone] || TONE_MODIFIERS.casual;

    const prompt = `You are a social media copywriter. Generate a post caption and hashtags for a marketing/advertisement image.

The image was created with this prompt: "${record.prompt}"

Platform guidelines: ${platformGuide}
Tone: ${toneGuide}

Respond ONLY with valid JSON, no markdown fences, no explanation:
{"caption":"<the post caption, 1-3 sentences>","hashtags":["<hashtag1>","<hashtag2>"],"characterCount":<number>}`;

    const raw = await generateText(prompt);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    contentRepository.update(imageId, {
      caption: parsed.caption,
      hashtags: parsed.hashtags,
      captionPlatform: platform,
      captionTone: tone,
    });

    return { caption: parsed.caption, hashtags: parsed.hashtags, platform, tone };
  },

  updateCaption({ userId, imageId, caption, hashtags }) {
    const record = contentRepository.findById(imageId);
    if (!record || record.userId !== userId) {
      const err = new Error('Image not found');
      err.status = 404;
      throw err;
    }
    const updated = contentRepository.update(imageId, { caption, hashtags });
    return { caption: updated.caption, hashtags: updated.hashtags };
  },
};
