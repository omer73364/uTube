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
  Play,
} from "lucide-react";
import type { Job, Preferences } from "../shared";
import { translator, localizeError, type TextKey } from "../locales";
const stages: Record<string, TextKey> = {
  video: "downloadingVideo",
  audio: "downloadingAudio",
  converting: "converting",
  merging: "merging",
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
  language = "en",
}: {
  job: Job;
  action: (task: Promise<unknown>) => void;
  language?: Preferences["language"];
}) {
  const t = translator(language);
  const complete = ["saved", "skipped"].includes(job.status);
  const running = job.status === "running";
  const percent = complete
    ? 100
    : job.total
      ? Math.min(100, Math.round((job.loaded / job.total) * 100))
      : 0;
  const label = t(
    job.status === "saved"
      ? "downloaded"
      : job.status === "skipped"
        ? "skipped"
        : job.status === "queued"
          ? "waiting"
          : job.status === "cancelled"
            ? job.interrupted
              ? "interrupted"
              : "cancelled"
            : job.status === "cancelling"
              ? "cancelling"
              : job.status === "failed"
                ? "failed"
                : stages[job.stage || ""] || "preparingDownload",
  );
  return (
    <article
      className={`job job-${job.status} ${complete ? "job-done" : ""}`}
      data-testid="job"
    >
      <div className={`job-icon ${job.audio ? "audio" : ""}`}>
        {job.audio ? <AudioLines size={20} /> : <Film size={20} />}
      </div>
      <div className="job-body">
        <div className="job-top">
          <h3 dir="auto" title={job.title}>
            {job.title}
          </h3>
          <span className="format-tag">
            {job.audio ? "MP3" : job.actualQuality || job.quality || "MP4"}
          </span>
        </div>
        {(job.playlistTitle || job.createdAt) && (
          <div className="job-meta">
            {job.playlistTitle && <span dir="auto">{job.playlistTitle}</span>}
            {job.createdAt && (
              <time dateTime={new Date(job.createdAt).toISOString()}>
                {t("addedAt", {
                  date: new Intl.DateTimeFormat(language, {
                    dateStyle: "medium",
                  }).format(job.createdAt),
                })}
              </time>
            )}
          </div>
        )}
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
              aria-label={t("progress", { title: job.title })}
              aria-valuenow={job.total ? percent : undefined}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: job.total ? `${percent}%` : "35%" }} />
            </div>
            <div className="transfer-info">
              {job.loaded > 0
                ? job.total
                  ? t("of", {
                      loaded: sizes(job.loaded),
                      total: sizes(job.total),
                    })
                  : sizes(job.loaded)
                : t("preparing")}
              {job.speed
                ? ` · ${t("perSecond", { size: sizes(job.speed) })}`
                : ""}
              {job.eta !== undefined
                ? ` · ${t("secondsLeft", { count: job.eta })}`
                : ""}
            </div>
          </>
        )}
        {job.note && (
          <p className="job-note" dir="auto">
            {localizeError(job.note, language)}
          </p>
        )}
        {job.error && (
          <p className="job-error" dir="auto">
            {localizeError(job.error, language)}
          </p>
        )}
        {job.interrupted && <p className="job-note">{t("retryInterrupted")}</p>}
      </div>
      <div className="job-action">
        {isPending(job) && (
          <button
            className="icon-button"
            aria-label={t("cancelJob", { title: job.title })}
            title={t("cancel")}
            disabled={job.status === "cancelling"}
            onClick={() => action(window.utube.cancel(job.id))}
          >
            <X size={17} />
          </button>
        )}
        {["failed", "cancelled"].includes(job.status) && (
          <button
            className="icon-button"
            aria-label={t("retryJob", { title: job.title })}
            title={t("retry")}
            onClick={() => action(window.utube.retry(job.id))}
          >
            <RotateCcw size={17} />
          </button>
        )}
        {complete && (
          <>
            <button
              className="button secondary open-file"
              aria-label={t("openJob", { title: job.title })}
              title={t("openFile")}
              onClick={() => action(window.utube.openFile(job.id))}
            >
              <Play size={14} />
              {t("openFile")}
            </button>
            <button
              className="icon-button"
              aria-label={t("showJob", { title: job.title })}
              title={t("showFile")}
              onClick={() => action(window.utube.openFolder(job.id))}
            >
              <FolderOpen size={17} />
            </button>
          </>
        )}
      </div>
    </article>
  );
}
