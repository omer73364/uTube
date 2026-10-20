import JobCard from "./JobCard";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Play,
  Download,
  AudioLines,
  Film,
  FolderOpen,
  Settings2,
  ArrowRight,
  LoaderCircle,
  Link2,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronRight,
  Plus,
  Search,
  ArrowUpRight,
  HardDrive,
} from "lucide-react";
import type { Preview, Job, Settings } from "../shared";

const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
const isPending = (job: Job) =>
  ["queued", "running", "cancelling"].includes(job.status);
const safeThumbnail = (value?: string | null) => {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && url.hostname === "i.ytimg.com"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};

export default function App() {
  const [screen, setScreen] = useState<"download" | "queue" | "settings">(
    "download",
  );
  const [settings, setSettings] = useState<Settings>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [url, setURL] = useState("");
  const [preview, setPreview] = useState<Preview>();
  const [selected, setSelected] = useState<number[]>([]);
  const [audio, setAudio] = useState(false);
  const [quality, setQuality] = useState("360p");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [queueFilter, setQueueFilter] = useState("all");
  const [query, setQuery] = useState("");
  const urlInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);
  useEffect(() => {
    const focusLink = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
        event.preventDefault();
        setScreen("download");
        requestAnimationFrame(() => urlInput.current?.focus());
      }
    };
    window.addEventListener("keydown", focusLink);
    return () => window.removeEventListener("keydown", focusLink);
  }, []);
  useEffect(() => {
    if (!window.utube) {
      setError("Open this interface in uTube Desktop to use downloads.");
      return;
    }
    let mounted = true;
    const unsubscribe = window.utube.onJobs((value) => {
      if (mounted) setJobs(value);
    });
    Promise.all([window.utube.settings(), window.utube.jobs()])
      .then(([prefs, queue]) => {
        if (mounted) {
          setSettings(prefs);
          setJobs(queue);
        }
      })
      .catch((error) => {
        if (mounted) setError(message(error));
      });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);
  const action = (task: Promise<unknown>) => {
    setError("");
    void task.catch((error) => setError(message(error)));
  };
  const chooseFolder = async () => {
    try {
      const folder = await window.utube.chooseFolder();
      if (folder) setSettings((old) => old && { ...old, folder });
    } catch (error) {
      setError(message(error));
    }
  };
  const inspect = async (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim() || loading) return;
    setError("");
    setNotice("");
    setPreview(undefined);
    setLoading(true);
    try {
      const data = await window.utube.inspect(url.trim());
      setPreview(data);
      setSelected((data.items || [data]).map((_, index) => index));
      setQuality(
        data.qualities?.includes("360p")
          ? "360p"
          : data.qualities?.at(-1) || "360p",
      );
    } catch (error) {
      setError(message(error));
    } finally {
      setLoading(false);
    }
  };
  const addDownloads = async () => {
    if (!preview || !selected.length) return;
    setAdding(true);
    setError("");
    try {
      const items =
        preview.type === "playlist"
          ? preview.items!
          : [{ id: preview.id, title: preview.title }];
      await window.utube.enqueue({
        items: selected.map((index) => ({ ...items[index], index })),
        audio,
        quality: audio ? undefined : quality,
        playlistTitle: preview.type === "playlist" ? preview.title : undefined,
      });
      setNotice(
        `${selected.length === 1 ? "Download" : `${selected.length} downloads`} added to your queue.`,
      );
      setPreview(undefined);
      setURL("");
    } catch (error) {
      setError(message(error));
    } finally {
      setAdding(false);
    }
  };
  const pending = jobs.filter(isPending).length;
  const saved = jobs.filter((job) =>
    ["saved", "skipped"].includes(job.status),
  ).length;
  const attention = jobs.filter((job) =>
    ["failed", "cancelled"].includes(job.status),
  ).length;
  const filteredJobs = jobs.filter((job) => {
    const matches =
      queueFilter === "all" ||
      (queueFilter === "active" && isPending(job)) ||
      (queueFilter === "completed" &&
        ["saved", "skipped"].includes(job.status)) ||
      (queueFilter === "attention" &&
        ["failed", "cancelled"].includes(job.status));
    return (
      matches &&
      job.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    );
  });
  const overview = (
    <section className="overview" aria-label="Session overview">
      <div className="overview-item">
        <span className="overview-icon">
          <Download size={18} />
        </span>
        <div>
          <strong>{pending.toString().padStart(2, "0")}</strong>
          <span>In the queue</span>
        </div>
        <span className="overview-live">{pending ? "Active" : "Ready"}</span>
      </div>
      <div className="overview-item">
        <span className="overview-icon completed">
          <CheckCircle2 size={18} />
        </span>
        <div>
          <strong>{saved.toString().padStart(2, "0")}</strong>
          <span>Completed this session</span>
        </div>
      </div>
      <div className="overview-item">
        <span className={`overview-icon ${attention ? "attention" : ""}`}>
          <AlertCircle size={18} />
        </span>
        <div>
          <strong>{attention.toString().padStart(2, "0")}</strong>
          <span>Need attention</span>
        </div>
      </div>
    </section>
  );
  const requiresFFmpeg = audio || !["360p"].includes(quality);
  const hasEncoder = settings?.ffmpeg !== false;
  const qualities =
    preview?.type === "video"
      ? preview.qualities || []
      : ["144p", "240p", "360p", "480p", "720p", "1080p"];
  const image = safeThumbnail(preview?.thumbnail);
  const queuePanel = (full: boolean) => {
    const visibleJobs = full ? filteredJobs : jobs;
    return (
      <section className={`card queue-card ${full ? "full-queue" : ""}`}>
        <div className="card-header">
          <div>
            <h2>
              {full ? "Download queue" : "Recent activity"}{" "}
              <span className="count">{jobs.length}</span>
            </h2>
            <p>
              {pending
                ? `${pending} ${pending === 1 ? "download" : "downloads"} in progress or waiting`
                : "Everything in one place."}
            </p>
          </div>
          {!full && jobs.length > 0 && (
            <button className="text-button" onClick={() => setScreen("queue")}>
              View all <ChevronRight size={15} />
            </button>
          )}
        </div>
        {full && (
          <div className="queue-toolbar">
            <div
              className="queue-filters"
              role="group"
              aria-label="Filter downloads"
            >
              {[
                ["all", "All", jobs.length],
                ["active", "Active", pending],
                ["completed", "Completed", saved],
                ["attention", "Needs attention", attention],
              ].map(([value, label, count]) => (
                <button
                  key={value}
                  aria-pressed={queueFilter === value}
                  onClick={() => setQueueFilter(String(value))}
                >
                  {label}
                  <span>{count}</span>
                </button>
              ))}
            </div>
            <label className="queue-search">
              <Search size={16} />
              <input
                aria-label="Search downloads"
                placeholder="Search downloads…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
        )}
        <div className="queue-list">
          {visibleJobs.length ? (
            [...visibleJobs]
              .reverse()
              .slice(0, full ? undefined : 5)
              .map((job) => <JobCard key={job.id} job={job} action={action} />)
          ) : (
            <div className="empty-queue">
              <div className="empty-icon">
                <Download size={28} />
              </div>
              <h3>
                {jobs.length
                  ? "No matching downloads"
                  : "Your next favorite belongs here."}
              </h3>
              <p>
                {jobs.length
                  ? "Try another search or filter."
                  : "Videos, playlists, and sounds."}
                <br />
                {!jobs.length && "Add a link to start your collection."}
              </p>
              {jobs.length > 0 && (
                <button
                  className="text-button"
                  onClick={() => {
                    setQuery("");
                    setQueueFilter("all");
                  }}
                >
                  Clear filters <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="queue-footer">
          <span className="status-dot" /> Downloads run one at a time{" "}
          <span className="ml-auto">{saved} completed</span>
        </div>
      </section>
    );
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Play size={20} fill="currentColor" />
          </div>
          <div>
            uTube<span>DESKTOP</span>
          </div>
        </div>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          <button
            className={screen === "download" ? "active" : ""}
            aria-current={screen === "download" ? "page" : undefined}
            onClick={() => setScreen("download")}
          >
            <Download size={18} /> New download
          </button>
          <button
            className={screen === "queue" ? "active" : ""}
            aria-current={screen === "queue" ? "page" : undefined}
            onClick={() => setScreen("queue")}
          >
            <Layers size={18} /> Queue{" "}
            {pending > 0 && <span className="nav-count">{pending}</span>}
          </button>
          <button
            className={screen === "settings" ? "active" : ""}
            aria-current={screen === "settings" ? "page" : undefined}
            onClick={() => setScreen("settings")}
          >
            <Settings2 size={18} /> Settings
          </button>
        </nav>
        <div className="sidebar-note">
          <HardDrive size={20} />
          <h3>Your files. Your device.</h3>
          <p>Find your saved videos and audio right where you want them.</p>
          <button
            className="text-button"
            disabled={!settings}
            onClick={() => action(window.utube.openFolder())}
          >
            Open download folder <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <span
            className={`status-dot ${settings && !settings.ffmpeg ? "amber" : ""}`}
          />
          <span>
            {settings
              ? settings.ffmpeg
                ? "Ready to download"
                : "FFmpeg not found"
              : "Getting ready…"}
          </span>
          <small>v{settings?.version || "0.1.0"} · local preview</small>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div>
            Workspace <ChevronRight size={13} />
            <strong>
              {screen === "download"
                ? "New download"
                : screen === "queue"
                  ? "Queue"
                  : "Settings"}
            </strong>
          </div>
          <button
            className="button topbar-folder"
            disabled={!settings}
            onClick={() => action(window.utube.openFolder())}
          >
            <FolderOpen size={16} /> Open folder <ArrowUpRight size={14} />
          </button>
        </header>
        <div className="page-content">
          {error && (
            <div className="alert error-alert" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert notice" role="status">
              <CheckCircle2 size={18} />
              <span>{notice}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {screen === "download" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span className="status-dot" /> YOUR PERSONAL DOWNLOAD SPACE
                  </div>
                  <h1>
                    Good things. <span>Worth keeping.</span>
                  </h1>
                  <p>Bring your favorite videos and sounds a little closer.</p>
                </div>
                <div className="hero-symbol" aria-hidden="true">
                  <div className="hero-orbit" />
                  <Download size={36} strokeWidth={1.5} />
                  <span className="hero-spark">
                    <Check size={15} />
                  </span>
                </div>
              </div>
              {overview}
              <div className="download-layout">
                <div className="download-column">
                  <section className="card source-card">
                    <div className="card-header">
                      <div>
                        <h2>
                          <span className="step">01</span> Add a YouTube link
                        </h2>
                        <p>Videos, Shorts, or an entire playlist.</p>
                      </div>
                      <Link2 size={18} className="subtle-icon" />
                    </div>
                    <form className="url-form" onSubmit={inspect}>
                      <Link2 size={18} />
                      <input
                        ref={urlInput}
                        aria-label="YouTube URL"
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=…"
                        value={url}
                        onChange={(event) => {
                          setURL(event.target.value);
                          setPreview(undefined);
                        }}
                        required
                        disabled={loading}
                      />
                      <button
                        type="submit"
                        className="button primary"
                        disabled={loading || !url.trim() || !settings}
                      >
                        {loading ? (
                          <LoaderCircle size={17} className="spin" />
                        ) : (
                          <ArrowRight size={17} />
                        )}
                        <span>{loading ? "Loading" : "Find"}</span>
                      </button>
                    </form>
                    <div className="supported">
                      <span className="tiny-check">
                        <Check size={10} />
                      </span>{" "}
                      Video, Shorts & playlists <span>·</span>
                      <kbd>Ctrl / ⌘ L</kbd>
                    </div>
                  </section>
                  <section className="card options-card">
                    <div className="card-header">
                      <div>
                        <h2>
                          <span className="step">02</span> Make it yours
                        </h2>
                        <p>Choose what you want to keep.</p>
                      </div>
                    </div>
                    <div className="format-options">
                      <button
                        aria-pressed={!audio}
                        onClick={() => setAudio(false)}
                        className={`format-choice ${!audio ? "chosen" : ""}`}
                      >
                        <div className="choice-icon">
                          <Film size={20} />
                        </div>
                        <div>
                          <strong>Video</strong>
                          <span>MP4 with audio</span>
                        </div>
                        <div className="radio-dot">
                          {!audio && <Check size={10} />}
                        </div>
                      </button>
                      <button
                        aria-pressed={audio}
                        onClick={() => setAudio(true)}
                        className={`format-choice ${audio ? "chosen" : ""}`}
                      >
                        <div className="choice-icon audio">
                          <AudioLines size={20} />
                        </div>
                        <div>
                          <strong>Audio only</strong>
                          <span>MP3 · 192 kbps</span>
                        </div>
                        <div className="radio-dot">
                          {audio && <Check size={10} />}
                        </div>
                      </button>
                    </div>
                    {preview && (
                      <div
                        className="source-preview"
                        data-testid="source-preview"
                      >
                        <div className="thumbnail">
                          {image ? (
                            <img src={image} alt="" />
                          ) : preview.type === "playlist" ? (
                            <Layers size={30} />
                          ) : (
                            <Play size={30} fill="currentColor" />
                          )}
                        </div>
                        <div>
                          <span className="eyebrow">
                            {preview.type === "playlist"
                              ? `${preview.items?.length || 0} VIDEOS · PLAYLIST`
                              : "VIDEO PREVIEW"}
                          </span>
                          <h3>{preview.title}</h3>
                          {preview.author && <p>{preview.author}</p>}
                        </div>
                      </div>
                    )}
                    {preview?.type === "playlist" && !preview.items?.length && (
                      <div className="inline-note">
                        <AlertCircle size={15} />
                        This playlist has no accessible videos.
                      </div>
                    )}
                    {preview?.type === "playlist" && (
                      <div className="playlist-picker">
                        <div className="playlist-heading">
                          <strong>{selected.length} selected</strong>
                          <button
                            className="text-button"
                            onClick={() =>
                              setSelected(
                                selected.length === preview.items!.length
                                  ? []
                                  : preview.items!.map((_, index) => index),
                              )
                            }
                          >
                            {selected.length === preview.items!.length
                              ? "Deselect all"
                              : "Select all"}
                          </button>
                        </div>
                        <div className="playlist-list">
                          {preview.items!.map((item, index) => (
                            <label key={`${item.id}-${index}`}>
                              <input
                                type="checkbox"
                                checked={selected.includes(index)}
                                onChange={(event) =>
                                  setSelected((old) =>
                                    event.target.checked
                                      ? [...old, index].sort((a, b) => a - b)
                                      : old.filter((value) => value !== index),
                                  )
                                }
                              />
                              <span className="playlist-index">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <span>{item.title}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {!audio && (
                      <div className="quality-row">
                        <label htmlFor="quality">Video quality</label>
                        <select
                          id="quality"
                          value={quality}
                          disabled={!preview || !qualities.length}
                          onChange={(event) => setQuality(event.target.value)}
                        >
                          {[...qualities].reverse().map((item) => (
                            <option key={item} value={item}>
                              {item}
                              {parseInt(item) >= 720 ? " · HD" : ""}
                            </option>
                          ))}
                          {!preview && (
                            <option value="360p">
                              Load a link to see qualities
                            </option>
                          )}
                        </select>
                      </div>
                    )}
                    <div className="destination">
                      <FolderOpen size={19} />
                      <div>
                        <span>Save to</span>
                        <strong title={settings?.folder}>
                          {settings?.folder || "Loading destination…"}
                        </strong>
                      </div>
                      <button
                        className="text-button"
                        onClick={chooseFolder}
                        disabled={!settings}
                      >
                        Change
                      </button>
                    </div>
                    {!hasEncoder && requiresFFmpeg && (
                      <div className="inline-note">
                        <AlertCircle size={15} />
                        Install FFmpeg to use MP3 conversion or separate
                        video/audio streams.
                      </div>
                    )}
                    {preview && !audio && !qualities.length && (
                      <div className="inline-note">
                        <AlertCircle size={15} />
                        No downloadable MP4 qualities are available. You can try
                        audio only.
                      </div>
                    )}
                    <button
                      className="button primary download-button"
                      disabled={
                        !preview ||
                        !selected.length ||
                        adding ||
                        !settings ||
                        (!hasEncoder && requiresFFmpeg) ||
                        (!audio && !qualities.length)
                      }
                      onClick={addDownloads}
                    >
                      {adding ? (
                        <LoaderCircle className="spin" size={18} />
                      ) : (
                        <Download size={18} />
                      )}
                      {adding
                        ? "Adding to queue…"
                        : preview
                          ? `Download ${preview.type === "playlist" ? `${selected.length} ${audio ? "tracks" : "videos"}` : audio ? "MP3" : "video"}`
                          : "Add a link to get started"}
                    </button>
                    <p className="format-footnote">
                      {audio
                        ? "Audio is converted locally with FFmpeg."
                        : "If a quality is unavailable, the actual resolution is shown in your queue."}
                    </p>
                  </section>
                </div>
                <div className="activity-column">
                  {queuePanel(false)}
                  <div className="little-tip">
                    <div>
                      <Plus size={16} />
                    </div>
                    <p>
                      Keep exploring.
                      <br />
                      <span>
                        You can add another link while a download is running.
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
          {screen === "queue" && (
            <>
              <div className="section-heading">
                <div className="eyebrow">EVERY DOWNLOAD, IN VIEW</div>
                <h1>
                  Your download queue<span>.</span>
                </h1>
                <p>
                  Retry a failed download, cancel a transfer, or jump to your
                  files.
                </p>
              </div>
              {overview}
              {queuePanel(true)}
            </>
          )}
          {screen === "settings" && (
            <>
              <div className="section-heading">
                <div className="eyebrow">SET UP YOUR SPACE</div>
                <h1>
                  The little details<span>.</span>
                </h1>
                <p>A few essentials for your downloads.</p>
              </div>
              <section className="card settings-card">
                <h2>Download folder</h2>
                <p>
                  New downloads are saved here. Playlists get their own
                  subfolder.
                </p>
                <div className="destination">
                  <FolderOpen size={20} />
                  <strong title={settings?.folder}>{settings?.folder}</strong>
                  <button className="button secondary" onClick={chooseFolder}>
                    Choose folder
                  </button>
                </div>
                <div className="settings-divider" />
                <h2>Audio & video processing</h2>
                <div
                  className={`encoder-status ${settings?.ffmpeg ? "success" : "danger"}`}
                >
                  {settings?.ffmpeg ? (
                    <CheckCircle2 size={17} />
                  ) : (
                    <AlertCircle size={17} />
                  )}
                  {settings?.ffmpeg
                    ? "FFmpeg is available"
                    : "FFmpeg was not found on your PATH"}
                </div>
                <p>
                  FFmpeg is needed for MP3 conversion and merging separate video
                  and audio. Install it, then restart the app.
                </p>
                <div className="settings-divider" />
                <h2>About this preview</h2>
                <p>
                  uTube Desktop {settings?.version || "0.1.0"} · Downloads use
                  the same engine as the CLI. Your queue is kept for this
                  session; pause/resume and persistent history are not included.
                </p>
              </section>
            </>
          )}
          <footer className="page-footer">
            <Play size={12} fill="currentColor" />
            <span>Keep a little of what you love.</span>
            <span className="ml-auto">
              MP4 video <span className="footer-separator">/</span> MP3 audio
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
