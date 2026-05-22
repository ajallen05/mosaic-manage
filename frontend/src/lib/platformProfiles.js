export const PLATFORM_PROFILES = {
  instagram_feed: {
    id: 'instagram_feed',
    label: 'Instagram Feed',
    canvas: { width: 1080, height: 1350 },
    safeArea: { top: 60, bottom: 60, left: 60, right: 60 },
  },
  instagram_story: {
    id: 'instagram_story',
    label: 'Instagram Story',
    canvas: { width: 1080, height: 1920 },
    safeArea: { top: 250, bottom: 250, left: 80, right: 80 },
  },
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    canvas: { width: 1080, height: 1920 },
    safeArea: { top: 300, bottom: 300, left: 80, right: 80 },
  },
  facebook_feed: {
    id: 'facebook_feed',
    label: 'Facebook Feed',
    canvas: { width: 1200, height: 630 },
    safeArea: { top: 40, bottom: 40, left: 40, right: 40 },
  },
  facebook_story: {
    id: 'facebook_story',
    label: 'Facebook Story',
    canvas: { width: 1080, height: 1920 },
    safeArea: { top: 250, bottom: 250, left: 80, right: 80 },
  },
  linkedin_post: {
    id: 'linkedin_post',
    label: 'LinkedIn Post',
    canvas: { width: 1200, height: 627 },
    safeArea: { top: 40, bottom: 40, left: 40, right: 40 },
  },
  twitter_post: {
    id: 'twitter_post',
    label: 'X / Twitter Post',
    canvas: { width: 1600, height: 900 },
    safeArea: { top: 40, bottom: 40, left: 40, right: 40 },
  },
  youtube_thumbnail: {
    id: 'youtube_thumbnail',
    label: 'YouTube Thumbnail',
    canvas: { width: 1280, height: 720 },
    safeArea: { top: 40, bottom: 40, left: 40, right: 40 },
  },
  youtube_shorts: {
    id: 'youtube_shorts',
    label: 'YouTube Shorts',
    canvas: { width: 1080, height: 1920 },
    safeArea: { top: 300, bottom: 300, left: 80, right: 80 },
  },
  pinterest: {
    id: 'pinterest',
    label: 'Pinterest',
    canvas: { width: 1000, height: 1500 },
    safeArea: { top: 60, bottom: 60, left: 60, right: 60 },
  },
};

export const PLATFORM_LIST = Object.values(PLATFORM_PROFILES);

export const MAX_DISPLAY_WIDTH = 480;

export function getDisplaySize(profileId) {
  const profile = PLATFORM_PROFILES[profileId] || PLATFORM_PROFILES.instagram_feed;
  const { width: nativeW, height: nativeH } = profile.canvas;
  const displayW = Math.min(MAX_DISPLAY_WIDTH, nativeW);
  const displayH = Math.round(displayW * nativeH / nativeW);
  return {
    displayW,
    displayH,
    nativeW,
    nativeH,
    scale: displayW / nativeW,
    exportMultiplier: nativeW / displayW,
  };
}
