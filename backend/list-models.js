// Diagnostic: lists every Gemini model your API key can access.
// Usage: node list-models.js
import config from './src/config/index.js';

const key = config.gemini.apiKey;
if (!key) {
  console.error('GOOGLE_GEMINI_API_KEY is not set in .env');
  process.exit(1);
}

async function listFor(version) {
  const url = `https://generativelanguage.googleapis.com/${version}/models?key=${key}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`\n[${version}] request failed: ${res.status} ${await res.text()}`);
    return;
  }
  const { models = [] } = await res.json();
  const usable = models.filter(m =>
    (m.supportedGenerationMethods || []).includes('generateContent')
  );
  console.log(`\n=== ${version} — ${usable.length} models support generateContent ===`);
  for (const m of usable) {
    const name = m.name.replace(/^models\//, '');
    const imageHint = /image/i.test(name) || /image/i.test(m.displayName || '');
    console.log(`${imageHint ? '  [IMAGE?] ' : '          '}${name}  —  ${m.displayName}`);
  }
}

await listFor('v1beta');
await listFor('v1alpha');
console.log('\nUse a name marked [IMAGE?] (or any image-generation model) as GEMINI_IMAGE_MODEL in .env');
