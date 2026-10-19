import {
  AudioLines,
  Film,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  Clock3,
  X,
  RotateCcw,
  FolderOpen,
} from "lucide-react";
import type { Job } from "../shared";
const stages: Record<string, string> = {
  video: "Downloading video",
  audio: "Downloading audio",
  converting: "Converting to MP3",
  merging: "Merging audio & video",
};
const sizes = (value = 0) =>
  value >= 1048576
    ? `${(value / 1048576).toFixed(1)} MB`
    : `${Math.round(value / 1024)} KB`;
const isPending = (job: Job) =>
  ["queued", "running", "cancelling"].includes(job.status);
export default function JobCard({
  job,
  action,
}: {
  job: Job;
  action: (task: Promise<unknown>) => void;
}) {
  const complete = ["saved", "skipped"].includes(job.status);
  const running = job.status === "running";
  const percent = complete
    ? 100
    : job.total
      ? Math.min(100, Math.round((job.loaded / job.total) * 100))
      : 0;
  const label =
    job.status === "saved"
      ? "Downloaded"
      : job.status === "skipped"
        ? "Already downloaded"
        : job.status === "queued"
          ? "Waiting in queue"
          : job.status === "cancelled"
            ? "Cancelled"
            : job.status === "cancelling"
              ? "Cancelling…"
              : job.status === "failed"
                ? "Download failed"
                : stages[job.stage || ""] || "Preparing download";
  return (
    <article className={`job ${complete ? "job-done" : ""}`} data-testid="job">
      <div className={`job-icon ${job.audio ? "audio" : ""}`}>
        {job.audio ? <AudioLines size={20} /> : <Film size={20} />}
      </div>
      <div className="job-body">
        <div className="job-top">
          <h3 title={job.title}>{job.title}</h3>
          <span className="format-tag">
            {job.audio ? "MP3" : job.actualQuality || job.quality || "MP4"}
          </span>
        </div>
        <div
          className={`job-status ${complete ? "success" : job.status === "failed" ? "danger" : ""}`}
        >
          {complete ? (
            <CheckCircle2 size={13} />
          ) : running ? (
            <LoaderCircle size={13} className="spin" />
          ) : job.status === "failed" ? (
            <AlertCircle size={13} />
          ) : (
            <Clock3 size={13} />
          )}
          <span>{label}</span>
          {running && job.total && <span className="ml-auto">{percent}%</span>}
        </div>
        {(running || job.status === "cancelling") && (
          <>
            <div
              className={`progress ${!job.total ? "indeterminate" : ""}`}
              role="progressbar"
              aria-label={`Progress for ${job.title}`}
              aria-valuenow={job.total ? percent : undefined}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: job.total ? `${percent}%` : "35%" }} />
            </div>
            <div className="transfer-info">
              {job.loaded > 0
                ? `${sizes(job.loaded)}${job.total ? ` of ${sizes(job.total)}` : ""}`
                : "Getting things ready…"}
            </div>
          </>
        )}
        {job.note && <p className="job-note">{job.note}</p>}
        {job.error && <p className="job-error">{job.error}</p>}
      </div>
      <div className="job-action">
        {isPending(job) && (
          <button
            className="icon-button"
            aria-label={`Cancel ${job.title}`}
            disabled={job.status === "cancelling"}
            onClick={() => action(window.utube.cancel(job.id))}
          >
            <X size={17} />
          </button>
        )}
        {["failed", "cancelled"].includes(job.status) && (
          <button
            className="icon-button"
            aria-label={`Retry ${job.title}`}
            onClick={() => action(window.utube.retry(job.id))}
          >
            <RotateCcw size={17} />
          </button>
        )}
        {complete && (
          <button
            className="icon-button"
            aria-label={`Show ${job.title} in folder`}
            onClick={() => action(window.utube.openFolder(job.id))}
          >
            <FolderOpen size={17} />
          </button>
        )}
      </div>
    </article>
  );
}
