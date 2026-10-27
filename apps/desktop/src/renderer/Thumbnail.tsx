import { useState } from "react";
import { safeMediaThumbnail } from "../../../../packages/core/media-source.js";
import { Play } from "lucide-react";

export default function Thumbnail({ videoId, thumbnail }: { videoId: string; thumbnail?: string }) {
  const [failedId, setFailedId] = useState<string>();
  const source = safeMediaThumbnail(thumbnail) || (/^[\w-]{11}$/.test(videoId) ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined);
  return (
    <div className="thumbnail" aria-hidden="true">
      {source && failedId !== videoId ? (
        <img
          src={source}
          alt=""
          loading="lazy"
          onError={() => setFailedId(videoId)}
        />
      ) : (
        <Play size={22} />
      )}
    </div>
  );
}
