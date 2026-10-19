import JobCard from "./JobCard";
import { useEffect, useState, type FormEvent } from "react";
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
  const saved = jobs.filter((job) => job.status === "saved").length;
  const requiresFFmpeg = audio || !["360p"].includes(quality);
  const hasEncoder = settings?.ffmpeg !== false;
  const qualities =
    preview?.type === "video"
      ? preview.qualities || []
      : ["144p", "240p", "360p", "480p", "720p", "1080p"];
  const image = safeThumbnail(preview?.thumbnail);
  const queuePanel = (full: boolean) => (
    <section className={`card queue-card ${full ? "full-queue" : ""}`}>
      <div className="card-header">
        <div>
          <h2>
            {full ? "Download queue" : "Your queue"}{" "}
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
      <div className="queue-list">
        {jobs.length ? (
          [...jobs]
            .reverse()
            .slice(0, full ? undefined : 5)
            .map((job) => <JobCard key={job.id} job={job} action={action} />)
        ) : (
          <div className="empty-queue">
            <div className="empty-icon">
              <Download size={28} />
            </div>
            <h3>A little room for your favorites.</h3>
            <p>
              Your downloads will appear here.
              <br />
              Start with a YouTube link.
            </p>
            <span className="empty-dots">● &nbsp; ● &nbsp; ●</span>
          </div>
        )}
      </div>
      <div className="queue-footer">
        <span className="status-dot" /> Downloads run one at a time{" "}
        <span className="ml-auto">{saved} saved</span>
      </div>
    </section>
  );
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
            onClick={() => setScreen("download")}
          >
            <Download size={18} /> New download
          </button>
          <button
            className={screen === "queue" ? "active" : ""}
            onClick={() => setScreen("queue")}
          >
            <Layers size={18} /> Queue{" "}
            {pending > 0 && <span className="nav-count">{pending}</span>}
          </button>
          <button
            className={screen === "settings" ? "active" : ""}
            onClick={() => setScreen("settings")}
          >
            <Settings2 size={18} /> Settings
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="note-star">✦</span>
          <h3>Keep the good stuff.</h3>
          <p>Your favorite videos and sounds, ready when you are.</p>
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
          <span className="preview-badge">DESKTOP PREVIEW</span>
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
                  <div className="eyebrow">LESS SEARCHING. MORE KEEPING.</div>
                  <h1>
                    Your next watch,
                    <br />
                    <span>ready to go.</span>
                  </h1>
                  <p>
                    A video you love. A playlist for later. Start with a link.
                  </p>
                </div>
                <div className="hero-symbol">
                  <Play size={32} fill="currentColor" />
                  <span className="hero-spark">✦</span>
                </div>
              </div>
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
                      YouTube links only <span>·</span> Choose quality after
                      preview
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
                <div className="eyebrow">YOUR COLLECTION IN PROGRESS</div>
                <h1>One queue. More favorites.</h1>
                <p>
                  Retry a failed download, cancel a transfer, or jump to your
                  files.
                </p>
              </div>
              {queuePanel(true)}
            </>
          )}
          {screen === "settings" && (
            <>
              <div className="section-heading">
                <div className="eyebrow">A LITTLE MORE YOURS</div>
                <h1>Make yourself at home.</h1>
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
            <span>Made for the things you want to keep.</span>
            <span className="ml-auto">MP4 + MP3</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
