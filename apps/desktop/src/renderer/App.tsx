import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
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
  Search,
  Sun,
  Moon,
  Home,
  Library,
  Monitor,
} from "lucide-react";
import { safeMediaThumbnail } from "../../../../packages/core/media-source.js";
import appLicense from "../../../../LICENSE?raw";
import { describeSize, summarizeSizes, qualitySizeLabel } from '../../../../packages/core/file-size.js';
import JobCard from "./JobCard";
import Thumbnail from "./Thumbnail";
import { languages, translator, localizeError } from "../locales";
import type { Preview, Job, Settings, Preferences } from "../shared";

const isPending = (job: Job) =>
  ["queued", "running", "cancelling"].includes(job.status);

export default function App() {
  const [screen, setScreen] = useState<
    "download" | "queue" | "library" | "settings"
  >("download");
  const [settings, setSettings] = useState<Settings>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [url, setURL] = useState("");
  const [preview, setPreview] = useState<Preview>();
  const [selected, setSelected] = useState<number[]>([]);
  const [audio, setAudio] = useState(false);
  const [quality, setQuality] = useState("360p");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [installingFFmpeg, setInstallingFFmpeg] = useState(false);
  const [ffmpegProgress, setFFmpegProgress] = useState(0);
  const [ffmpegSetupError, setFFmpegSetupError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState<number>();
  const [queueFilter, setQueueFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [libraryMode, setLibraryMode] = useState<"files" | "playlists">(
    "files",
  );
  const [playlist, setPlaylist] = useState<string>();
  const aboutDialog = useRef<HTMLDialogElement>(null);
  const ffmpegPrompt = useRef<HTMLDialogElement>(null);
  const ffmpegPromptShown = useRef(false);
  const ffmpegSection = useRef<HTMLHeadingElement>(null);
  const [ffmpegFocus, setFFmpegFocus] = useState(0);
  const openFFmpegSettings = () => {
    setScreen("settings");
    setFFmpegFocus((value) => value + 1);
  };
  const urlInput = useRef<HTMLInputElement>(null);
  const pageContent = useRef<HTMLElement>(null);
  const language = settings?.language || "en";
  const t = translator(language);
  const theme = settings?.theme || "system";
  const dark = settings
    ? settings.resolvedTheme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.lang = language;
    document.documentElement.dir = languages.find(
      (item) => item.code === language,
    )!.dir;
  }, [dark, language]);
  useEffect(() => {
    pageContent.current?.scrollTo(0, 0);
  }, [screen]);
  useEffect(() => {
    if (screen === "settings" && ffmpegFocus) {
      ffmpegSection.current?.scrollIntoView({ block: "start" });
      ffmpegSection.current?.focus({ preventScroll: true });
    }
  }, [screen, ffmpegFocus]);
  useEffect(() => {
    if (settings && !ffmpegPromptShown.current) {
      ffmpegPromptShown.current = true;
      if (
        !settings.ffmpeg &&
        !settings.ffmpegInstalling &&
        settings.ffmpegSetupSupported !== false
      )
        ffmpegPrompt.current?.showModal();
    }
  }, [settings]);
  useEffect(() => {
    const closeMenus = () =>
      document
        .querySelectorAll<HTMLElement>(".job-menu:popover-open")
        .forEach((menu) => menu.hidePopover());
    document.addEventListener("scroll", closeMenus, true);
    window.addEventListener("resize", closeMenus);
    return () => {
      document.removeEventListener("scroll", closeMenus, true);
      window.removeEventListener("resize", closeMenus);
    };
  }, []);
  useEffect(() => {
    if (notice === undefined) return;
    const timeout = window.setTimeout(() => setNotice(undefined), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    const focusLink = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.code === "KeyL" || event.key.toLowerCase() === "l")
      ) {
        event.preventDefault();
        setScreen("download");
        setPreview(undefined);
        requestAnimationFrame(() => urlInput.current?.focus());
      }
    };
    window.addEventListener("keydown", focusLink);
    return () => window.removeEventListener("keydown", focusLink);
  }, []);
  useEffect(() => {
    if (!window.utube) {
      setError("Open this interface in uTube to use downloads.");
      return;
    }
    let mounted = true;
    const unsubscribe = window.utube.onJobs((value) => {
      if (mounted) setJobs(value);
    });
    const unsubscribeTheme = window.utube.onTheme((dark) => {
      if (mounted)
        setSettings(
          (old) => old && { ...old, resolvedTheme: dark ? "dark" : "light" },
        );
    });
    const unsubscribeHistory = window.utube.onHistoryError((message) => {
      if (mounted) setError(message);
    });
    Promise.all([window.utube.settings(), window.utube.jobs()])
      .then(([prefs, queue]) => {
        if (mounted) {
          setSettings(prefs);
          setInstallingFFmpeg(Boolean(prefs.ffmpegInstalling));
          if (prefs.ffmpegProgress?.total)
            setFFmpegProgress(
              Math.floor(
                (prefs.ffmpegProgress.loaded / prefs.ffmpegProgress.total) *
                  100,
              ),
            );
          setJobs(queue);
          if (prefs.historyError) setError(prefs.historyError);
        }
      })
      .catch((error) => {
        if (mounted) setError(error);
      });
    return () => {
      mounted = false;
      unsubscribe();
      unsubscribeTheme();
      unsubscribeHistory();
    };
  }, []);
  useEffect(
    () =>
      window.utube?.onFFmpegProgress?.(
        ({ loaded, total, done, ffmpeg, failed }) => {
          if (done) {
            setInstallingFFmpeg(false);
            setFFmpegSetupError(Boolean(failed));
            if (ffmpeg) setScreen("download");
            setSettings((current) =>
              current ? { ...current, ffmpeg: Boolean(ffmpeg) } : current,
            );
            return;
          }
          setFFmpegProgress(total ? Math.floor((loaded / total) * 100) : 0);
        },
      ),
    [],
  );
  const installFFmpeg = async () => {
    setInstallingFFmpeg(true);
    setFFmpegProgress(0);
    setFFmpegSetupError(false);
    try {
      const result = await window.utube.installFFmpeg();
      if (result.ffmpeg) setScreen("download");
      setSettings((current) =>
        current ? { ...current, ffmpeg: result.ffmpeg } : current,
      );
    } catch (error) {
      if (
        !/abort|cancel/i.test(
          error instanceof Error ? error.message : String(error),
        )
      )
        setFFmpegSetupError(true);
    } finally {
      setInstallingFFmpeg(false);
    }
  };
  const action = (task: Promise<unknown>) => {
    setError(undefined);
    void task.catch(setError);
  };
  const updatePreferences = async (patch: Partial<Preferences>) => {
    setSaving(true);
    setError(undefined);
    try {
      const value = await window.utube.preferences(patch);
      setSettings((old) => old && { ...old, ...value });
    } catch (error) {
      setError(error);
    } finally {
      setSaving(false);
    }
  };
  const chooseFolder = async () => {
    try {
      const folder = await window.utube.chooseFolder();
      if (folder) setSettings((old) => old && { ...old, folder });
    } catch (error) {
      setError(error);
    }
  };
  const inspect = async (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim() || loading) return;
    setError(undefined);
    setNotice(undefined);
    setPreview(undefined);
    setLoading(true);
    try {
      const data = await window.utube.inspect(url.trim());
      setPreview(data);
      setSelected((data.items || [data]).map((_, index) => index));
      setQuality(
        (!data.provider || data.provider === "youtube") && data.qualities?.includes("360p")
          ? "360p"
          : data.qualities?.at(-1) || "360p",
      );
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  };
  const addDownloads = async () => {
    if (!preview || !selected.length) return;
    setAdding(true);
    setError(undefined);
    try {
      const items =
        preview.type === "playlist"
          ? preview.items!
          : [{ id: preview.id, title: preview.title, thumbnail: preview.thumbnail || undefined }];
      await window.utube.enqueue({
        items: selected.map((index) => ({ ...items[index], index })),
        audio,
        quality: audio ? undefined : quality,
        playlistTitle: preview.type === "playlist" ? preview.title : undefined,
      });
      setNotice(selected.length);
      setPreview(undefined);
      setURL("");
    } catch (error) {
      setError(error);
    } finally {
      setAdding(false);
    }
  };
  const pending = jobs.filter(isPending).length;
  const completed = jobs.filter((job) =>
    ["saved", "skipped"].includes(job.status),
  ).length;
  const attention = jobs.filter((job) =>
    ["failed", "cancelled"].includes(job.status),
  ).length;
  const filtered = jobs.filter(
    (job) =>
      (queueFilter === "all" ||
        (queueFilter === "active" && isPending(job)) ||
        (queueFilter === "completed" &&
          ["saved", "skipped"].includes(job.status)) ||
        (queueFilter === "attention" &&
          ["failed", "cancelled"].includes(job.status))) &&
      `${job.title} ${job.playlistTitle || ""}`
        .toLocaleLowerCase(language)
        .includes(query.trim().toLocaleLowerCase(language)),
  );
  const saved = jobs.filter((job) => ["saved", "skipped"].includes(job.status));
  const libraryFiles = saved.filter(
    (job) =>
      (!playlist || job.playlistTitle === playlist) &&
      `${job.title} ${job.playlistTitle || ""}`
        .toLocaleLowerCase(language)
        .includes(query.trim().toLocaleLowerCase(language)),
  );
  const playlistNames = [
    ...new Set(
      saved
        .map((job) => job.playlistTitle)
        .filter((name): name is string => !!name),
    ),
  ].filter((name) =>
    name
      .toLocaleLowerCase(language)
      .includes(query.trim().toLocaleLowerCase(language)),
  );
  const qualities = !preview
    ? []
    : preview.type === "video"
      ? preview.qualities || []
      : preview.qualities || ["144p", "240p", "360p", "480p", "720p", "1080p"];
  const sizeItems = !preview ? [] : preview.type === 'playlist' ? selected.map(index => preview.items?.[index]).filter(Boolean) : [preview];
  const sizeDescription = preview ? describeSize(summarizeSizes(sizeItems, audio, quality), language) : undefined;
  const hasEncoder = settings?.ffmpeg !== false;
  const requiresFFmpeg = audio || ((!preview?.provider || preview.provider === "youtube") && quality !== "360p");
  const image = safeMediaThumbnail(preview?.thumbnail);
  const filters = [
    ["all", t("all"), jobs.length],
    ["active", t("active"), pending],
    ["completed", t("completed"), completed],
    ["attention", t("attention"), attention],
  ] as const;
  const navigation = [
    { id: "download", label: t("home"), icon: Home },
    { id: "library", label: t("library"), icon: Library },
    { id: "queue", label: t("downloads"), icon: Download },
  ] as const;
  const folderControl = (choose = false) => (
    <div className="destination">
      <span className="destination-icon" aria-hidden="true">
        <FolderOpen size={21} />
      </span>
      <div className="destination-details">
        <span className="destination-label">{t("saveTo")}</span>
        <strong dir="auto" title={settings?.folder}>
          {settings?.folder || t("loadingFolder")}
        </strong>
      </div>
      <button
        className="button secondary destination-change"
        disabled={!settings}
        onClick={chooseFolder}
      >
        <FolderOpen size={15} />
        {t(choose ? "chooseFolder" : "change")}
      </button>
    </div>
  );
  const queuePanel = (full: boolean) => {
    const visible = full ? filtered : jobs.slice(-3);
    return (
      <section className="card queue-card">
        <div className="card-header">
          <h2>
            {t(full ? "queueTitle" : "recent")}{" "}
            <span className="count">{jobs.length}</span>
          </h2>
          {!full && jobs.length > 0 && (
            <button className="text-button" onClick={() => setScreen("queue")}>
              {t("viewAll")} <ArrowRight size={14} />
            </button>
          )}
        </div>
        {full && (
          <div className="queue-toolbar">
            <div
              className="queue-filters"
              role="group"
              aria-label={t("filters")}
            >
              {filters.map(([value, label, count]) => (
                <button
                  key={value}
                  aria-pressed={queueFilter === value}
                  onClick={() => setQueueFilter(value)}
                >
                  {label} <span>{count}</span>
                </button>
              ))}
            </div>
            <label className="queue-search">
              <Search size={16} />
              <input
                aria-label={t("search")}
                placeholder={t("search")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
        )}
        <div className="queue-list">
          {visible.length ? (
            [...visible]
              .reverse()
              .map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  action={action}
                  language={language}
                />
              ))
          ) : (
            <div className="empty-queue">
              <Download size={24} />
              <h3>{t(jobs.length ? "noMatches" : "empty")}</h3>
              <p>{t(jobs.length ? "trySearch" : "emptyDescription")}</p>
              {jobs.length > 0 && (
                <button
                  className="text-button"
                  onClick={() => {
                    setQuery("");
                    setQueueFilter("all");
                  }}
                >
                  {t("clearFilters")}
                </button>
              )}
            </div>
          )}
        </div>
        {full && (
          <div className="queue-footer">
            <span>{t("sequential")}</span>
            <span>{t("completedCount", { count: completed })}</span>
          </div>
        )}
      </section>
    );
  };
  if (!settings && error === undefined)
    return (
      <div className="app-loading" role="status" aria-label="uTube">
        <LoaderCircle size={23} className="spin" />
      </div>
    );
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img
            className="brand-mark"
            src={new URL("../../assets/icon.svg", import.meta.url).href}
            alt=""
          />
          uTube
        </div>

        <div className="header-actions">
          <button
            className="icon-button"
            aria-label={t(dark ? "light" : "dark")}
            title={t(dark ? "light" : "dark")}
            disabled={!settings || saving}
            onClick={() =>
              void updatePreferences({ theme: dark ? "light" : "dark" })
            }
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="icon-button"
            aria-label={t("settings")}
            title={t("settings")}
            aria-pressed={screen === "settings"}
            onClick={() => setScreen("settings")}
          >
            <Settings2 size={20} />
          </button>
          <button
            className="button secondary folder-shortcut"
            disabled={!settings}
            onClick={() => action(window.utube.openFolder())}
          >
            <FolderOpen size={16} />
            {t("openFolder")}
          </button>
        </div>
      </header>
      <main className="page-content" ref={pageContent} tabIndex={0}>
        {error !== undefined && (
          <div className="alert error-alert" role="alert">
            <AlertCircle size={18} />
            <span dir="auto">{localizeError(error, language)}</span>
            <button
              className="icon-button"
              aria-label={t("dismissError")}
              onClick={() => setError(undefined)}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {notice !== undefined && (
          <div className="alert notice" role="status">
            <CheckCircle2 size={18} />
            <span>{t("added", { count: notice })}</span>
            <button
              className="icon-button"
              aria-label={t("dismissNotice")}
              onClick={() => setNotice(undefined)}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="page-heading">
          <h1>
            {t(
              screen === "download"
                ? "downloadTitle"
                : screen === "queue"
                  ? "queueTitle"
                  : screen === "library"
                    ? "library"
                    : "settingsTitle",
            )}
          </h1>
          <p>
            {t(
              screen === "download"
                ? "downloadDescription"
                : screen === "queue"
                  ? "queueDescription"
                  : screen === "library"
                    ? "libraryDescription"
                    : "settingsDescription",
            )}
          </p>
        </div>
        {screen === "download" && (
          <>
            <section className="card download-card">
              {!preview && (
                <form className="link-section" onSubmit={inspect}>
                  <label htmlFor="youtube-url">{t("linkHeading")}</label>
                  <div className="url-form">
                    <Link2 size={18} />
                    <input
                      id="youtube-url"
                      ref={urlInput}
                      aria-label={t("link")}
                      dir="ltr"
                      type="url"
                      placeholder={t("linkPlaceholder")}
                      value={url}
                      required
                      disabled={loading}
                      onChange={(event) => {
                        setURL(event.target.value);
                        setPreview(undefined);
                      }}
                    />
                    {url && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t("clearLink")}
                        onClick={() => {
                          setURL("");
                          urlInput.current?.focus();
                        }}
                      >
                        <X size={17} />
                      </button>
                    )}
                    <button
                      type="submit"
                      className="button primary"
                      disabled={loading || !url.trim() || !settings}
                    >
                      {loading ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <Search size={16} />
                      )}
                      {t(loading ? "loading" : "find")}
                    </button>
                  </div>
                  <span className="shortcut">{t("shortcut")}</span>
                </form>
              )}
              {preview && (
                <div className="options-section">
                  {preview && (
                    <div
                      className="source-preview"
                      data-testid="source-preview"
                    >
                      <button
                        className="icon-button preview-close"
                        aria-label={t("closePreview")}
                        onClick={() => {
                          setPreview(undefined);
                          requestAnimationFrame(() =>
                            urlInput.current?.focus(),
                          );
                        }}
                      >
                        <X size={18} />
                      </button>
                      <div className="thumbnail">
                        {image ? (
                          <img
                            src={image}
                            alt=""
                            onError={(event) => {
                              event.currentTarget.hidden = true;
                            }}
                          />
                        ) : preview.type === "playlist" ? (
                          <Layers size={25} />
                        ) : (
                          <Play size={25} />
                        )}
                      </div>
                      <div>
                        <span>
                          {t(
                            preview.type === "playlist"
                              ? preview.provider === "facebook" ? "facebookPostPreview" : preview.provider === "instagram" ? "instagramPostPreview" : preview.provider === "x" ? "xPostPreview" : "playlistPreview"
                              : preview.provider === "facebook" ? "facebookVideoPreview" : preview.provider === "instagram" ? "instagramVideoPreview" : preview.provider === "x" ? "xVideoPreview" : "videoPreview",
                            { count: preview.items?.length || 0 },
                          )}
                        </span>
                        <h3 dir="auto">{preview.title}</h3>
                        {preview.author && <p dir="auto">{preview.author}</p>}
                      </div>
                    </div>
                  )}
                  <h2>{t("options")}</h2>
                  <div className="format-options">
                    <button
                      aria-pressed={!audio}
                      onClick={() => setAudio(false)}
                      className={`format-choice ${!audio ? "chosen" : ""}`}
                    >
                      <Film size={20} />
                      <div>
                        <strong>{t("video")}</strong>
                        <span>{t("videoDescription")}</span>
                      </div>
                      {!audio && <Check size={16} />}
                    </button>
                    <button
                      aria-pressed={audio}
                      onClick={() => setAudio(true)}
                      className={`format-choice ${audio ? "chosen" : ""}`}
                    >
                      <AudioLines size={20} />
                      <div>
                        <strong>{t("audio")}</strong>
                        <span>{t("audioDescription")}</span>
                      </div>
                      {audio && <Check size={16} />}
                    </button>
                  </div>
                  {preview?.type === "playlist" && !preview.items?.length && (
                    <p className="inline-note">{t("noPlaylist")}</p>
                  )}
                  {preview?.type === "playlist" && (
                    <div className="playlist-picker">
                      <div className="playlist-heading">
                        <strong>
                          {t("selected", { count: selected.length })}
                        </strong>
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
                          {t(
                            selected.length === preview.items!.length
                              ? "deselectAll"
                              : "selectAll",
                          )}
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
                            <Thumbnail videoId={item.id} thumbnail={item.thumbnail} />
                            <span className="playlist-index">{index + 1}</span>
                            <span dir="auto">{item.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {!audio && (
                    <div className="quality-row">
                      <label htmlFor="quality">{t("quality")}</label>
                      <select
                        id="quality"
                        value={quality}
                        disabled={!preview || !qualities.length}
                        onChange={(event) => setQuality(event.target.value)}
                      >
                        {[...qualities].reverse().map((value) => (
                          <option key={value} value={value}>
                            {value}
                            {parseInt(value) >= 720 ? " · HD" : ""}
                            {preview ? ` — ${qualitySizeLabel(sizeItems, value, language)}` : ""}
                          </option>
                        ))}
                        {!preview && (
                          <option value="360p">{t("loadQualities")}</option>
                        )}
                      </select>
                    </div>
                  )}
                  {folderControl()}
                  {!hasEncoder && requiresFFmpeg && (
                    <p className="inline-note">
                      {t("encoderNeeded")}{" "}
                      <button
                        className="text-button"
                        onClick={openFFmpegSettings}
                      >
                        {t("ffmpegInSettings")}
                      </button>
                    </p>
                  )}
                  {preview && !audio && !qualities.length && (
                    <p className="inline-note">{t("noQualities")}</p>
                  )}
                  {sizeDescription && (audio || preview?.type === "playlist") && (
                    <div className="file-size-estimate" role="status" aria-live="polite">
                      <span>{sizeDescription.label}</span>
                      <strong><bdi>{sizeDescription.value}</bdi></strong>
                      {sizeDescription.help && <small>{sizeDescription.help}</small>}
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
                      <LoaderCircle size={17} className="spin" />
                    ) : (
                      <Download size={17} />
                    )}
                    {t(
                      adding
                        ? "adding"
                        : !preview
                          ? "start"
                          : preview.type === "playlist"
                            ? audio
                              ? "downloadTracks"
                              : "downloadVideos"
                            : audio
                              ? "downloadAudio"
                              : "downloadVideo",
                      { count: selected.length },
                    )}
                  </button>
                  <p className="format-footnote">
                    {t(audio ? "conversionNote" : "qualityNote")}
                  </p>
                </div>
              )}
            </section>
            {!preview && queuePanel(false)}
          </>
        )}
        {screen === "queue" && queuePanel(true)}
        {screen === "library" && (
          <section className="library-panel">
            <div className="library-toolbar">
              <div
                className="queue-filters"
                role="group"
                aria-label={t("library")}
              >
                {(["files", "playlists"] as const).map((value) => (
                  <button
                    key={value}
                    aria-pressed={libraryMode === value}
                    onClick={() => {
                      setLibraryMode(value);
                      setPlaylist(undefined);
                      setQuery("");
                    }}
                  >
                    {t(value)}
                  </button>
                ))}
              </div>
              <label className="queue-search">
                <Search size={17} />
                <input
                  aria-label={t("search")}
                  placeholder={t("search")}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            {playlist && (
              <button
                className="text-button back-to-playlists"
                onClick={() => {
                  setPlaylist(undefined);
                  setQuery("");
                }}
              >
                {t("allPlaylists")}
              </button>
            )}
            {libraryMode === "playlists" && !playlist ? (
              <div className="playlist-grid">
                {playlistNames.map((name) => {
                  const items = saved.filter(
                    (job) => job.playlistTitle === name,
                  );
                  return (
                    <button
                      className="playlist-folder"
                      key={name}
                      onClick={() => {
                        setPlaylist(name);
                        setQuery("");
                      }}
                    >
                      <Thumbnail videoId={items[0].videoId} thumbnail={items[0].thumbnail} />
                      <span>
                        <strong dir="auto">{name}</strong>
                        <small>
                          {t("completedCount", { count: items.length })}
                        </small>
                      </span>
                      <ArrowRight size={18} />
                    </button>
                  );
                })}
                {!playlistNames.length && (
                  <div className="empty-queue">
                    <Layers size={30} />
                    <h3>{t(query ? "noMatches" : "noPlaylists")}</h3>
                  </div>
                )}
              </div>
            ) : (
              <div className="library-list">
                {[...libraryFiles].reverse().map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    action={action}
                    language={language}
                  />
                ))}
                {!libraryFiles.length && (
                  <div className="empty-queue">
                    <Library size={30} />
                    <h3>{t(query ? "noMatches" : "libraryEmpty")}</h3>
                    <p>{t(query ? "trySearch" : "libraryEmptyDescription")}</p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
        {screen === "settings" && (
          <section className="card settings-card">
            <div className="settings-section">
              <h2>{t("appearance")}</h2>
              <div
                className="theme-choices"
                role="radiogroup"
                aria-label={t("theme")}
              >
                {(["system", "light", "dark"] as const).map((value) => {
                  const Icon =
                    value === "system"
                      ? Monitor
                      : value === "light"
                        ? Sun
                        : Moon;
                  return (
                    <button
                      key={value}
                      role="radio"
                      aria-checked={theme === value}
                      disabled={!settings || saving}
                      onClick={() => void updatePreferences({ theme: value })}
                    >
                      <Icon size={24} />
                      <span>{t(value)}</span>
                    </button>
                  );
                })}
              </div>
              <h2 className="language-heading">{t("language")}</h2>
              <div
                className="language-choices"
                role="radiogroup"
                aria-label={t("language")}
              >
                {languages.map((item) => (
                  <button
                    key={item.code}
                    role="radio"
                    aria-checked={language === item.code}
                    lang={item.code}
                    disabled={!settings || saving}
                    onClick={() =>
                      void updatePreferences({ language: item.code })
                    }
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              <p>{t("preferencesHint")}</p>
            </div>
            <div className="settings-section">
              <h2>{t("folder")}</h2>
              <p>{t("folderDescription")}</p>
              {folderControl(true)}
            </div>
            <div className="settings-section">
              <h2
                ref={ffmpegSection}
                tabIndex={-1}
                className="ffmpeg-section-title"
              >
                {t("processing")}
              </h2>
              <div
                className={`encoder-status ${settings?.ffmpeg ? "success" : "danger"}`}
              >
                {settings?.ffmpeg ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <AlertCircle size={17} />
                )}
                {t(
                  settings?.ffmpeg ? "encoderAvailable" : "encoderPathMissing",
                )}
              </div>
              <p>{t(settings?.ffmpeg ? "ffmpegReadyHelp" : "encoderHelp")}</p>
              <button
                className="text-button"
                onClick={() => action(window.utube.openFFmpegSource())}
              >
                {t("ffmpegSource")}
              </button>
              {!settings?.ffmpeg && (
                <div className="ffmpeg-setup">
                  <p>{t("ffmpegDownloadNote")}</p>
                  <div className="ffmpeg-setup-actions">
                    <button
                      className="primary"
                      disabled={
                        installingFFmpeg ||
                        settings?.ffmpegSetupSupported === false
                      }
                      onClick={() => void installFFmpeg()}
                    >
                      <Download size={16} />{" "}
                      {t(
                        installingFFmpeg
                          ? "ffmpegInstalling"
                          : "ffmpegDownload",
                      )}
                    </button>
                    {installingFFmpeg && (
                      <button
                        className="secondary"
                        onClick={() => action(window.utube.cancelFFmpeg())}
                      >
                        {t("ffmpegCancel")}
                      </button>
                    )}
                  </div>
                  {installingFFmpeg && (
                    <div className="ffmpeg-download-progress">
                      <div className="ffmpeg-progress-heading">
                        <span><LoaderCircle size={15} className="spin" aria-hidden="true" />{t(ffmpegProgress >= 100 ? "ffmpegInstalling" : "ffmpegDownloading")}</span>
                        <strong>{new Intl.NumberFormat(language, { style: "percent" }).format(ffmpegProgress / 100)}</strong>
                      </div>
                      <progress
                        aria-label={t("ffmpegInstalling")}
                        max={100}
                        value={ffmpegProgress}
                      />
                    </div>
                  )}
                  {ffmpegSetupError && (
                    <p role="alert">{t("ffmpegSetupFailed")}</p>
                  )}
                  {settings?.ffmpegSetupSupported === false && (
                    <p>{t("ffmpegUnsupported")}</p>
                  )}
                </div>
              )}
            </div>
            <div className="settings-section">
              <h2>{t("about")}</h2>
              <button
                className="about-entry"
                onClick={() => aboutDialog.current?.showModal()}
              >
                <img
                  src={new URL("../../assets/icon.svg", import.meta.url).href}
                  alt=""
                  width="42"
                  height="42"
                />
                <span>
                  <strong>{t("aboutApp")}</strong>
                  <small>
                    {t("versionLabel")} <bdi>{settings?.version}</bdi>
                  </small>
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </section>
        )}
        <footer className="page-footer">
          <span
            className={`status-dot ${settings?.ffmpeg === false ? "amber" : ""}`}
          />
          {settings?.ffmpeg === false ? (
            <button className="ffmpeg-status-link" onClick={openFFmpegSettings}>
              {t("encoderMissing")}
            </button>
          ) : (
            <span>{t(!settings ? "preparing" : "ready")}</span>
          )}
          <span className="footer-version">
            <bdi>v{settings?.version || "0.1.0"}</bdi> · {t("preview")}
          </span>
        </footer>
      </main>
      <dialog
        ref={ffmpegPrompt}
        className="about-dialog ffmpeg-startup-dialog"
        aria-labelledby="ffmpeg-startup-title"
      >
        <div className="about-dialog-header">
          <h2 id="ffmpeg-startup-title">{t("ffmpegStartupTitle")}</h2>
          <button
            className="icon-button"
            aria-label={t("close")}
            onClick={() => ffmpegPrompt.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p>{t("ffmpegStartupDescription")}</p>
        <p>{t("ffmpegDownloadNote")}</p>
        <div className="ffmpeg-setup-actions">
          <button
            className="primary"
            onClick={() => {
              ffmpegPrompt.current?.close();
              openFFmpegSettings();
              void installFFmpeg();
            }}
          >
            <Download size={16} />
            {t("ffmpegDownload")}
          </button>
          <button
            className="secondary"
            onClick={() => ffmpegPrompt.current?.close()}
          >
            {t("ffmpegLater")}
          </button>
        </div>
      </dialog>
      <dialog
        ref={aboutDialog}
        className="about-dialog"
        aria-labelledby="about-title"
      >
        <form method="dialog" className="about-dialog-header">
          <h2 id="about-title">{t("aboutApp")}</h2>
          <button className="icon-button" aria-label={t("close")}>
            <X size={20} />
          </button>
        </form>
        <div className="about-identity">
          <img
            src={new URL("../../assets/icon.svg", import.meta.url).href}
            alt=""
            width="76"
            height="76"
          />
          <h3>uTube</h3>
          <p>
            {t("versionLabel")} <bdi>{settings?.version}</bdi>
          </p>
        </div>
        <p className="about-summary">{t("appSummary")}</p>
        <p className="about-credit">{t("freeOpenSource")}</p>
        <button
          className="about-github"
          onClick={() =>
            void window.utube
              .openRepository()
              .catch((error) => setError(String(error)))
          }
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.2-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.5 4.9 18.5 5.2 18.5 5.2c.7 1.7.3 2.9.2 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.4c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
          </svg>
          <span>{t("repository")}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <details className="about-licenses">
          <summary>{t("openSourceLicenses")}</summary>
          <p>{t("desktopLicenseNote")}</p>
          <pre dir="ltr">{appLicense}</pre>
        </details>
      </dialog>
      <nav aria-label={t("navigation")}>
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-current={screen === id ? "page" : undefined}
            onClick={() => {
              setScreen(id);
              setQuery("");
            }}
          >
            <Icon size={17} />
            {label}
            {id === "queue" && pending > 0 && (
              <span className="count">{pending}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
