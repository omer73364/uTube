import { useId, useRef, useState } from "react";
import {
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  Clock3,
  X,
  RotateCcw,
  FolderOpen,
  Play,
  EllipsisVertical,
} from "lucide-react";
import { updateCopy } from '../../../../packages/core/update-copy.js';
import Thumbnail from "./Thumbnail";
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
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const run = (task: () => Promise<unknown>) => {
    menu.current?.hidePopover();
    trigger.current?.focus();
    action(task());
  };
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
      <Thumbnail videoId={job.videoId} thumbnail={job.thumbnail} />
      <div className="job-body">
        <div className="job-top">
          <h3 dir="auto" title={job.title}>
            {job.title}
          </h3>
        </div>
        <div className="job-format">
          <span className="format-tag">
            {job.audio
              ? "MP3"
              : ["MP4", job.actualQuality || job.quality]
                  .filter(Boolean)
                  .join(" · ")}
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
          <span>{job.holdReason ? updateCopy[language][job.holdReason === "update" ? "heldUpdate" : "held"] : label}</span>
          {running && job.total && <span>{percent}%</span>}
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
      <div className="job-options">
        <button
          ref={trigger}
          className="icon-button"
          popoverTarget={menuId}
          aria-haspopup="menu"
          aria-label={t("videoOptions", { title: job.title })}
          title={t("options")}
          onClick={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            setPosition({
              top: Math.max(
                12,
                Math.min(bounds.bottom + 6, window.innerHeight - 150),
              ),
              left: Math.max(
                12,
                Math.min(
                  language === "ar" ? bounds.left : bounds.right - 220,
                  window.innerWidth - 232,
                ),
              ),
            });
          }}
        >
          <EllipsisVertical size={20} />
        </button>
        <div
          ref={menu}
          id={menuId}
          popover="auto"
          role="menu"
          aria-label={t("videoOptions", { title: job.title })}
          className="job-menu"
          style={position}
          onToggle={(event) => {
            if (event.newState === "open") {
              requestAnimationFrame(() =>
                menu.current
                  ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
                  ?.focus({ preventScroll: true }),
              );
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              menu.current?.hidePopover();
              return;
            }
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const items = [
              ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ),
            ];
            if (!items.length) return;
            const current = items.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? items.length - 1
                  : (current +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      items.length) %
                    items.length;
            items[next].focus();
          }}
        >
          {isPending(job) && (
            <button
              role="menuitem"
              aria-label={t("cancelJob", { title: job.title })}
              title={t("cancel")}
              disabled={job.status === "cancelling"}
              onClick={() => run(() => window.utube.cancel(job.id))}
            >
              <X size={17} /> {t("cancel")}
            </button>
          )}
          {["failed", "cancelled"].includes(job.status) && (
            <button
              role="menuitem"
              aria-label={t("retryJob", { title: job.title })}
              title={t("retry")}
              onClick={() => run(() => window.utube.retry(job.id))}
            >
              <RotateCcw size={17} /> {t("retry")}
            </button>
          )}
          {complete && (
            <>
              <button
                role="menuitem"
                aria-label={t("openJob", { title: job.title })}
                title={t("openFile")}
                onClick={() => run(() => window.utube.openFile(job.id))}
              >
                <Play size={14} />
                {t("openFile")}
              </button>
              <button
                role="menuitem"
                aria-label={t("showJob", { title: job.title })}
                title={t("showFile")}
                onClick={() => run(() => window.utube.openFolder(job.id))}
              >
                <FolderOpen size={17} /> {t("showFile")}
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
