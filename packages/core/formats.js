export const videoFormats = (info) => [
  ...(info.streaming_data?.formats || []),
  ...(info.streaming_data?.adaptive_formats || []),
].filter((format) => format.has_video && format.mime_type?.includes("video/mp4") && (format.url || format.signature_cipher || format.cipher));

export const selectFormat = (info, quality) => {
  const formats = videoFormats(info);
  if (!formats.length) throw new Error(info.playability_status?.reason || "No downloadable MP4 formats available.");
  const exact = formats.filter((format) => format.quality_label === quality);
  const matching = exact.length ? exact : formats.filter((format) => parseInt(format.quality_label) === parseInt(quality));
  // Preserve the documented 360p fallback, then use the lowest available quality.
  const fallback = formats.filter((format) => format.quality_label === "360p");
  const candidates = matching.length ? matching : fallback.length ? fallback : [...formats].sort((a, b) => a.height - b.height);
  return candidates.find((format) => format.has_audio) || candidates[0];
};

export const audioFormats = (info) => [
  ...(info.streaming_data?.adaptive_formats || []),
  ...(info.streaming_data?.formats || []),
].filter((format) => format.has_audio && (format.url || format.signature_cipher || format.cipher));

export const selectAudioFormat = (info) => {
  const formats = audioFormats(info);
  const audioOnly = formats.filter((format) => !format.has_video);
  const original = audioOnly.filter((format) => format.is_original);
  const candidates = original.length ? original : audioOnly.length ? audioOnly : formats;
  if (!candidates.length) throw new Error(info.playability_status?.reason || "No downloadable audio formats available.");
  return [...candidates].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
};

