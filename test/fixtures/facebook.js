export const postId = '2298871784249067';
export const id = `fb-${postId}-1`;
export const url = `https://www.facebook.com/reel/${postId}/`;
export const share = 'https://www.facebook.com/share/r/1BhmM7uP7K/';
export const video = (extra = {}) => ({ id:postId, name:'A public Facebook moment', owner:{name:'Studio'},length_in_second:1,
  thumbnailImage:{uri:'https://scontent.example.fna.fbcdn.net/thumbnail.jpg'},
  videoDeliveryLegacyFields:{ browser_native_sd_url:'https://video.example.fbcdn.net/sd.mp4?token=temporary',browser_native_hd_url:'https://video.example.fbcdn.net/hd.mp4?token=temporary' },...extra });
export const page = data => `<html><script type="application/json">${JSON.stringify({require:[{data:{video:data}}]})}</script></html>`;
