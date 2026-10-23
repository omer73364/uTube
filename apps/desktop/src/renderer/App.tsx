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
} from "lucide-react";
import JobCard from "./JobCard";
import { languages, translator, localizeError } from "../locales";
import type { Preview, Job, Settings, Preferences } from "../shared";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState<number>();
  const [queueFilter, setQueueFilter] = useState("all");
  const [query, setQuery] = useState("");
  const urlInput = useRef<HTMLInputElement>(null);
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
    window.scrollTo(0, 0);
  }, [screen]);
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
        data.qualities?.includes("360p")
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
          : [{ id: preview.id, title: preview.title }];
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
  const qualities = !preview
    ? []
    : preview.type === "video"
      ? preview.qualities || []
      : ["144p", "240p", "360p", "480p", "720p", "1080p"];
  const hasEncoder = settings?.ffmpeg !== false;
  const requiresFFmpeg = audio || quality !== "360p";
  const image = safeThumbnail(preview?.thumbnail);
  const filters = [
    ["all", t("all"), jobs.length],
    ["active", t("active"), pending],
    ["completed", t("completed"), completed],
    ["attention", t("attention"), attention],
  ] as const;
  const navigation = [
    { id: "download", label: t("download"), icon: Download },
    { id: "queue", label: t("queue"), icon: Layers },
    { id: "settings", label: t("settings"), icon: Settings2 },
  ] as const;
  const folderControl = (choose = false) => (
    <div className="destination">
      <FolderOpen size={18} />
      <div>
        <span>{t("saveTo")}</span>
        <strong dir="auto" title={settings?.folder}>
          {settings?.folder || t("loadingFolder")}
        </strong>
      </div>
      <button
        className="text-button"
        disabled={!settings}
        onClick={chooseFolder}
      >
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
        <nav aria-label={t("navigation")}>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={screen === id ? "page" : undefined}
              onClick={() => setScreen(id)}
            >
              <Icon size={17} />
              {label}
              {id === "queue" && pending > 0 && (
                <span className="count">{pending}</span>
              )}
            </button>
          ))}
        </nav>
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
            className="button secondary folder-shortcut"
            disabled={!settings}
            onClick={() => action(window.utube.openFolder())}
          >
            <FolderOpen size={16} />
            {t("openFolder")}
          </button>
        </div>
      </header>
      <main className="page-content">
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
                  : "settingsTitle",
            )}
          </h1>
          <p>
            {t(
              screen === "download"
                ? "downloadDescription"
                : screen === "queue"
                  ? "queueDescription"
                  : "settingsDescription",
            )}
          </p>
        </div>
        {screen === "download" && (
          <>
            <section className="card download-card">
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
                    placeholder="https://www.youtube.com/watch?v=…"
                    value={url}
                    required
                    disabled={loading}
                    onChange={(event) => {
                      setURL(event.target.value);
                      setPreview(undefined);
                    }}
                  />
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
              <div className="options-section">
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
                {preview && (
                  <div className="source-preview" data-testid="source-preview">
                    <div className="thumbnail">
                      {image ? (
                        <img src={image} alt="" />
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
                            ? "playlistPreview"
                            : "videoPreview",
                          { count: preview.items?.length || 0 },
                        )}
                      </span>
                      <h3 dir="auto">{preview.title}</h3>
                      {preview.author && <p dir="auto">{preview.author}</p>}
                    </div>
                  </div>
                )}
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
                  <p className="inline-note">{t("encoderNeeded")}</p>
                )}
                {preview && !audio && !qualities.length && (
                  <p className="inline-note">{t("noQualities")}</p>
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
            </section>
            {jobs.length > 0 && queuePanel(false)}
          </>
        )}
        {screen === "queue" && queuePanel(true)}
        {screen === "settings" && (
          <section className="card settings-card">
            <div className="settings-section">
              <h2>{t("appearance")}</h2>
              <div className="preference-row">
                <label htmlFor="theme">{t("theme")}</label>
                <select
                  id="theme"
                  value={theme}
                  disabled={!settings || saving}
                  onChange={(event) =>
                    void updatePreferences({
                      theme: event.target.value as Preferences["theme"],
                    })
                  }
                >
                  {(["system", "light", "dark"] as const).map((value) => (
                    <option key={value} value={value}>
                      {t(value)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="preference-row">
                <label htmlFor="language">{t("language")}</label>
                <select
                  id="language"
                  value={language}
                  disabled={!settings || saving}
                  onChange={(event) =>
                    void updatePreferences({
                      language: event.target.value as Preferences["language"],
                    })
                  }
                >
                  {languages.map((item) => (
                    <option key={item.code} value={item.code} lang={item.code}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <p>{t("preferencesHint")}</p>
            </div>
            <div className="settings-section">
              <h2>{t("folder")}</h2>
              <p>{t("folderDescription")}</p>
              {folderControl(true)}
            </div>
            <div className="settings-section">
              <h2>{t("processing")}</h2>
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
              <p>{t("encoderHelp")}</p>
            </div>
            <div className="settings-section">
              <h2>{t("about")}</h2>
              <p>
                <bdi>uTube Desktop {settings?.version || "0.1.0"}</bdi> ·{" "}
                {t("aboutDescription")}
              </p>
            </div>
          </section>
        )}
        <footer className="page-footer">
          <span
            className={`status-dot ${settings?.ffmpeg === false ? "amber" : ""}`}
          />
          <span>
            {t(
              !settings
                ? "preparing"
                : settings.ffmpeg
                  ? "ready"
                  : "encoderMissing",
            )}
          </span>
          <span className="footer-version">
            <bdi>v{settings?.version || "0.1.0"}</bdi> · {t("preview")}
          </span>
        </footer>
      </main>
    </div>
  );
}
