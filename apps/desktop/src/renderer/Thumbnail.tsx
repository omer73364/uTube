import { useState } from "react";
import { Play } from "lucide-react";

export default function Thumbnail({ videoId }: { videoId: string }) {
  const [failedId, setFailedId] = useState<string>();
  return (
    <div className="thumbnail" aria-hidden="true">
      {/^[\w-]{11}$/.test(videoId) && failedId !== videoId ? (
        <img
          src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
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
