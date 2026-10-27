export const code = 'DemPo6-NFZK';
export const id = `ig-${code}-1`;
export const url = `https://www.instagram.com/reel/${code}/?igsh=share`;
export const video = (height = 720) => ({ original_width: height, original_height: Math.round(height * 16 / 9), video_duration: 1,
  video_versions: [{ type: 101, url: `https://instagram.example.fna.fbcdn.net/video${height}.mp4?token=temporary` }],
  image_versions2: { candidates: [{ url: 'https://scontent.cdninstagram.com/thumbnail.jpg' }] } });
export const product = (extra = {}) => ({ code, user: { username: 'studio' }, caption: { text: 'A public moment' }, ...video(), ...extra });
export const page = data => `<html><script type="application/json">${JSON.stringify({ require: [{ result: { data: { xig_polaris_media: { if_not_gated_logged_out: data } } } }] })}</script></html>`;
