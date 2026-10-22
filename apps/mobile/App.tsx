import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  DeviceEventEmitter,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { downloads, type DownloadRequest } from "./src/native";
import {
  progress,
  type Job,
  type MediaMode,
  type Preview,
  type PlaylistPreview,
} from "./src/domain";
import { youtube } from "./src/tasks";
import { en, ar } from "./src/locales";

const activeStates = new Set([
  "queued",
  "preparing",
  "running",
  "merging",
  "converting",
  "publishing",
]);
const retryStates = new Set(["failed", "interrupted", "missing"]);
function Screen() {
  const system = useColorScheme();
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [tab, setTab] = useState<"download" | "queue">("download");
  const [url, setURL] = useState("");
  const [preview, setPreview] = useState<Preview | PlaylistPreview>();
  const [mode, setMode] = useState<MediaMode>("video");
  const [quality, setQuality] = useState("best");
  const [selection, setSelection] = useState(new Set<string>());
  const [visibleItems, setVisibleItems] = useState(50);
  const [busy, setBusy] = useState<"find" | "queue">();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    "all" | "active" | "finished" | "errors"
  >("all");
  const [visibleJobs, setVisibleJobs] = useState(50);
  const [license, setLicense] = useState<string>();
  const lookup = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const t = language === "ar" ? ar : en;
  const rtl = language === "ar";
  const dark = theme === "dark" || (theme === "system" && system === "dark");
  const c = dark
    ? {
        bg: "#10151d",
        surface: "#1b2330",
        text: "#eef2f9",
        muted: "#a4afc1",
        line: "#303c50",
        blue: "#8aafff",
        error: "#ffb4ac",
      }
    : {
        bg: "#f5f6f8",
        surface: "#ffffff",
        text: "#19212d",
        muted: "#637082",
        line: "#dce1e8",
        blue: "#3769d6",
        error: "#a6312a",
      };
  const text = {
    color: c.text,
    textAlign: rtl ? "right" : "left",
    writingDirection: rtl ? "rtl" : "ltr",
  } as const;
  const active = jobs.filter((job) => activeStates.has(job.status));
  const retryable = jobs.filter(
    (job) => retryStates.has(job.status) && /^[\w-]{11}$/.test(job.videoId),
  );
  const refresh = useCallback(async () => {
    try {
      setJobs(await downloads.list());
    } catch {
      setError(language === "ar" ? ar.historyError : en.historyError);
    }
  }, [language]);
  function cancelLookup() {
    generation.current++;
    lookup.current?.abort();
    lookup.current = null;
    setBusy(undefined);
  }
  const acceptLink = useCallback((value: string) => {
    generation.current++;
    lookup.current?.abort();
    setBusy(undefined);
    setURL(value);
    setPreview(undefined);
    setError("");
    setNotice("");
    setTab("download");
  }, []);
  useEffect(() => {
    downloads
      .settings()
      .then((prefs) => {
        setLanguage(prefs.language);
        setTheme(prefs.theme);
      })
      .catch(() => setError(en.settingsError));
    const consume = () =>
      downloads
        .consumeSharedLink()
        .then((value) => {
          if (value) acceptLink(value);
        })
        .catch(() => {});
    void consume();
    const incoming = DeviceEventEmitter.addListener(
      "utubeLink",
      () => void consume(),
    );
    const state = AppState.addEventListener("change", (value) => {
      if (value === "active") {
        void consume();
      } else {
        generation.current++;
        lookup.current?.abort();
        setBusy(undefined);
      }
    });
    return () => {
      generation.current++;
      lookup.current?.abort();
      incoming.remove();
      state.remove();
    };
  }, [acceptLink]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(
      () => {
        if (AppState.currentState === "active") void refresh();
      },
      active.length ? 2000 : 10000,
    );
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [refresh, active.length]);
  function message(value: unknown) {
    const detail = value instanceof Error ? value.message : String(value);
    if (/REQUEST_TIMEOUT|timed out|timeout/i.test(detail)) return t.timeout;
    if (detail.includes("QUEUE_FULL")) return t.queueFull;
    if (detail.includes("EMPTY_PLAYLIST")) return t.emptyPlaylist;
    if (detail.includes("PLAYLIST_TOO_LARGE")) return t.largePlaylist;
    if (/NO_FORMATS|No downloadable/.test(detail)) return t.noFormat;
    if (detail.includes("PLAYER_")) return t.player;
    if (/valid YouTube|No valid video/.test(detail)) return t.invalid;
    if (detail.includes("MISSING_FILE")) return t.missingHelp;
    if (/No Activity|ActivityNotFound/.test(detail)) return t.openHelp;
    if (/HTTP_403|HTTP_410|HTTP_404/.test(detail)) return t.denied;
    return `${t.error}\n${detail.slice(0, 220)}`;
  }
  async function find() {
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    const id = ++generation.current;
    setBusy("find");
    setError("");
    setNotice("");
    setPreview(undefined);
    try {
      const data = await youtube.inspect(url, controller.signal);
      if (id !== generation.current) return;
      setPreview(data);
      setQuality("best");
      if (data.kind === "playlist") {
        setSelection(new Set(data.items.slice(0, 1000).map((item) => item.id)));
        setVisibleItems(50);
      }
    } catch (e) {
      if (id === generation.current && !controller.signal.aborted)
        setError(message(e));
    } finally {
      if (id === generation.current) setBusy(undefined);
    }
  }
  async function permissions() {
    if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
      const allowed = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (!allowed)
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
    }
  }
  async function enqueue(requests: DownloadRequest[]) {
    setBusy("queue");
    setError("");
    setNotice("");
    try {
      await permissions();
      await downloads.enqueue(requests);
      await refresh();
      setNotice(t.queuedNote);
      setTab("queue");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(undefined);
    }
  }
  async function start() {
    if (!preview) return;
    const requestedQuality = mode === "mp3" ? "MP3" : quality;
    const requests: DownloadRequest[] =
      preview.kind === "video"
        ? [
            {
              videoId: preview.id,
              title: preview.title.slice(0, 180),
              mode,
              requestedQuality,
            },
          ]
        : preview.items
            .filter((item) => selection.has(item.id))
            .map((item) => ({
              videoId: item.id,
              title: item.title.slice(0, 180),
              mode,
              requestedQuality,
              playlistTitle: preview.title.slice(0, 180),
              playlistIndex: item.index,
            }));
    if (requests.length) await enqueue(requests);
  }
  const requestFor = (job: Job): DownloadRequest => ({
    videoId: job.videoId,
    title: job.title,
    mode: job.mode,
    requestedQuality: job.requestedQuality,
    playlistTitle: job.playlistTitle,
    playlistIndex: job.playlistIndex,
    retryId: job.id,
  });
  async function action(fn: () => Promise<unknown>) {
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(message(e));
    }
  }
  async function preferences(
    nextLanguage: typeof language,
    nextTheme: typeof theme,
  ) {
    try {
      await downloads.saveSettings(nextLanguage, nextTheme);
      setLanguage(nextLanguage);
      setTheme(nextTheme);
    } catch {
      setError(t.settingsError);
    }
  }
  const button = (
    label: string,
    onPress: () => void,
    disabled = false,
    primary = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        {
          borderColor: c.line,
          backgroundColor: primary ? c.blue : c.surface,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: primary ? (dark ? "#10151d" : "white") : c.text,
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  const choice = (label: string, checked: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={[
        s.chip,
        { borderColor: checked ? c.blue : c.line, backgroundColor: c.surface },
      ]}
    >
      <Text style={{ color: checked ? c.blue : c.muted }}>{label}</Text>
    </Pressable>
  );
  const card = { backgroundColor: c.surface, borderColor: c.line };
  const input = {
    color: c.text,
    borderColor: c.line,
    backgroundColor: c.surface,
  };
  const matches = useMemo(
    () =>
      jobs.filter(
        (job) =>
          (!query ||
            `${job.title} ${job.playlistTitle || ""}`
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase())) &&
          (filter === "all" ||
            (filter === "active" && activeStates.has(job.status)) ||
            (filter === "finished" && job.status === "saved") ||
            (filter === "errors" && retryStates.has(job.status))),
      ),
    [jobs, query, filter],
  );
  const qualities =
    preview?.kind === "video"
      ? preview.qualities
      : ["1080p", "720p", "480p", "360p"];
  const clear = () =>
    Alert.alert(t.clearTitle, t.clearBody, [
      { text: t.back, style: "cancel" },
      {
        text: t.confirm,
        onPress: () =>
          void action(async () => {
            await downloads.clearFinished();
            setNotice(t.cleared);
          }),
      },
    ]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      <ScrollView
        contentContainerStyle={[s.page, { direction: rtl ? "rtl" : "ltr" }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          <View>
            <Text style={[s.brand, { color: c.blue }]}>▶ uTube</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>{t.subtitle}</Text>
          </View>
          {button(t.language, () => void preferences(rtl ? "en" : "ar", theme))}
        </View>
        <View style={s.row} accessibilityLabel={t.theme}>
          {(["system", "light", "dark"] as const).map((value) =>
            choice(
              t[value],
              theme === value,
              () => void preferences(language, value),
            ),
          )}
        </View>
        <View style={s.row}>
          {choice(t.newDownload, tab === "download", () => setTab("download"))}
          {choice(
            `${t.history}${active.length ? ` (${active.length})` : ""}`,
            tab === "queue",
            () => setTab("queue"),
          )}
        </View>
        {!!error && (
          <Text
            accessibilityRole="alert"
            selectable
            style={[s.notice, text, { color: c.error, borderColor: c.line }]}
          >
            {error}
          </Text>
        )}
        {!!notice && (
          <Text
            accessibilityLiveRegion="polite"
            style={[
              s.notice,
              {
                borderColor: c.line,
                color: c.blue,
                textAlign: rtl ? "right" : "left",
              },
            ]}
          >
            {notice}
          </Text>
        )}
        {tab === "download" ? (
          <>
            <Text style={[s.heading, text]}>{t.title}</Text>
            <Text
              style={[
                s.description,
                { color: c.muted, textAlign: rtl ? "right" : "left" },
              ]}
            >
              {t.intro}
            </Text>
            <View style={[s.card, card]}>
              <Text style={[s.label, text]}>{t.url}</Text>
              <TextInput
                accessibilityLabel={t.url}
                value={url}
                editable={!busy}
                onChangeText={(value) => {
                  setURL(value);
                  setPreview(undefined);
                }}
                maxLength={4096}
                placeholder="https://www.youtube.com/watch?v=…"
                placeholderTextColor={c.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="search"
                onSubmitEditing={() => {
                  if (url.trim() && !busy) void find();
                }}
                style={[
                  s.input,
                  input,
                  { direction: "ltr", textAlign: "left" },
                ]}
              />
              {button(
                busy === "find" ? t.finding : t.find,
                () => void find(),
                !!busy || !url.trim(),
                true,
              )}
              {busy === "find" && (
                <>
                  {
                    <ActivityIndicator
                      style={{ marginTop: 12 }}
                      color={c.blue}
                    />
                  }{" "}
                  {button(t.cancel, cancelLookup)}
                </>
              )}
            </View>
            {preview && (
              <View style={[s.card, card]}>
                <Text style={[s.videoTitle, text]}>{preview.title}</Text>
                <Text
                  style={{
                    color: c.muted,
                    textAlign: rtl ? "right" : "left",
                    marginTop: 6,
                  }}
                >
                  {preview.kind === "video"
                    ? preview.author
                    : `${t.playlist} · ${preview.items.length} ${t.items}`}
                </Text>
                <View style={s.row}>
                  {choice(t.video, mode === "video", () => setMode("video"))}
                  {choice(t.mp3, mode === "mp3", () => setMode("mp3"))}
                </View>
                {mode === "video" ? (
                  <>
                    <Text style={[s.label, text]}>{t.quality}</Text>
                    <View style={s.row}>
                      {choice(t.best, quality === "best", () =>
                        setQuality("best"),
                      )}
                      {qualities?.map((value) =>
                        choice(value, quality === value, () =>
                          setQuality(value),
                        ),
                      )}
                    </View>
                  </>
                ) : (
                  <Text
                    style={{
                      color: c.muted,
                      textAlign: rtl ? "right" : "left",
                    }}
                  >
                    {t.audioNote}
                  </Text>
                )}
                {preview.kind === "playlist" && (
                  <>
                    <Text
                      style={[
                        s.description,
                        { color: c.muted, textAlign: rtl ? "right" : "left" },
                      ]}
                    >
                      {t.playlistNote}
                    </Text>
                    <Text style={[s.label, text]}>
                      {selection.size} / {preview.items.length} {t.selected}
                    </Text>
                    <View style={s.row}>
                      {button(
                        preview.items.length > 1000
                          ? t.selectFirst
                          : t.selectAll,
                        () =>
                          setSelection(
                            new Set(
                              preview.items
                                .slice(0, 1000)
                                .map((item) => item.id),
                            ),
                          ),
                      )}
                      {button(t.selectNone, () => setSelection(new Set()))}
                    </View>
                    {preview.items.length > 1000 && (
                      <Text style={{ color: c.muted }}>{t.batchLimit}</Text>
                    )}
                    {preview.items.slice(0, visibleItems).map((item) => (
                      <Pressable
                        key={item.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selection.has(item.id) }}
                        onPress={() =>
                          setSelection((current) => {
                            const next = new Set(current);
                            if (next.has(item.id)) next.delete(item.id);
                            else if (next.size < 1000) next.add(item.id);
                            return next;
                          })
                        }
                        style={[s.playlistItem, { borderColor: c.line }]}
                      >
                        <Text
                          style={{
                            color: selection.has(item.id) ? c.blue : c.muted,
                            fontSize: 20,
                          }}
                        >
                          {selection.has(item.id) ? "☑" : "☐"}
                        </Text>
                        <Text style={[text, { flex: 1, lineHeight: 21 }]}>
                          {item.index}. {item.title}
                        </Text>
                      </Pressable>
                    ))}
                    {visibleItems < preview.items.length &&
                      button(t.more, () =>
                        setVisibleItems((value) => value + 50),
                      )}
                  </>
                )}
                {button(
                  busy === "queue"
                    ? t.starting
                    : preview.kind === "playlist"
                      ? `${t.download} (${selection.size})`
                      : t.download,
                  () => void start(),
                  !!busy || (preview.kind === "playlist" && !selection.size),
                  true,
                )}
                <Text
                  style={{
                    color: c.muted,
                    fontSize: 12,
                    marginTop: 12,
                    textAlign: rtl ? "right" : "left",
                  }}
                >
                  {t.savedIn}
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={[s.heading, text]}>{t.history}</Text>
            <TextInput
              accessibilityLabel={t.search}
              placeholder={t.search}
              placeholderTextColor={c.muted}
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setVisibleJobs(50);
              }}
              style={[s.input, input, text, { marginTop: 16 }]}
            />
            <View style={s.row}>
              {(["all", "active", "finished", "errors"] as const).map((value) =>
                choice(t[value], filter === value, () => {
                  setFilter(value);
                  setVisibleJobs(50);
                }),
              )}
            </View>
            <View style={s.row}>
              {active.length > 0 &&
                active.every((job) => job.status === "queued") &&
                button(t.resume, () => void action(() => downloads.resume()))}
              {retryable.length > 0 &&
                button(
                  `${t.retryAll} (${Math.min(1000, retryable.length)})`,
                  () => void enqueue(retryable.slice(0, 1000).map(requestFor)),
                  !!busy,
                )}
              {active.length > 0 &&
                button(
                  t.cancelAll,
                  () => void action(() => downloads.cancelAll()),
                )}
              {jobs.some((job) =>
                ["saved", "failed", "cancelled", "missing"].includes(
                  job.status,
                ),
              ) && button(t.clear, clear)}
            </View>
            {!matches.length && (
              <Text
                style={{
                  color: c.muted,
                  textAlign: rtl ? "right" : "left",
                  marginTop: 18,
                }}
              >
                {jobs.length ? t.noMatches : t.empty}
              </Text>
            )}
            {matches.slice(0, visibleJobs).map((job) => {
              const fraction = progress(job);
              return (
                <View key={job.id} style={[s.card, card]}>
                  <Text style={[s.videoTitle, text]}>{job.title}</Text>
                  {!!job.playlistTitle && (
                    <Text
                      style={{
                        color: c.muted,
                        fontSize: 12,
                        marginTop: 6,
                        textAlign: rtl ? "right" : "left",
                      }}
                    >
                      {job.playlistTitle}
                    </Text>
                  )}
                  <Text
                    style={{
                      color: c.muted,
                      fontSize: 12,
                      marginTop: 9,
                      textAlign: rtl ? "right" : "left",
                    }}
                  >
                    {job.quality === "best" ? t.best : job.quality} ·{" "}
                    {job.mode === "mp3" ? "MP3" : "MP4"} · {t[job.status]}
                    {fraction !== undefined && activeStates.has(job.status)
                      ? ` · ${Math.floor(fraction * 100)}%`
                      : ""}
                  </Text>
                  {activeStates.has(job.status) && (
                    <>
                      <View
                        accessibilityRole="progressbar"
                        accessibilityValue={
                          fraction === undefined
                            ? undefined
                            : {
                                min: 0,
                                max: 100,
                                now: Math.floor(fraction * 100),
                              }
                        }
                        style={[s.track, { backgroundColor: c.line }]}
                      >
                        <View
                          style={{
                            height: 4,
                            width: `${Math.floor((fraction || 0) * 100)}%`,
                            backgroundColor: c.blue,
                          }}
                        />
                      </View>
                      {button(
                        t.cancel,
                        () => void action(() => downloads.cancel(job.id)),
                      )}
                    </>
                  )}
                  {job.status === "saved" && (
                    <>
                      <View style={s.row}>
                        {button(
                          t.open,
                          () => void action(() => downloads.open(job.id)),
                        )}
                        {button(
                          t.share,
                          () => void action(() => downloads.share(job.id)),
                        )}
                      </View>
                      {job.downgraded && (
                        <Text
                          style={{
                            color: c.muted,
                            lineHeight: 20,
                            marginTop: 8,
                            textAlign: rtl ? "right" : "left",
                          }}
                        >
                          {t.fallback
                            .replace("{actual}", job.quality)
                            .replace("{requested}", job.requestedQuality)}
                        </Text>
                      )}
                    </>
                  )}
                  {(retryStates.has(job.status) ||
                    job.status === "cancelled") && (
                    <>
                      {job.status !== "cancelled" && (
                        <Text
                          style={{
                            color: c.muted,
                            fontSize: 12,
                            lineHeight: 19,
                            marginTop: 10,
                            textAlign: rtl ? "right" : "left",
                          }}
                        >
                          {job.status === "missing"
                            ? t.missingHelp
                            : job.error?.startsWith("HTTP_")
                              ? t.denied
                              : job.error === "REQUEST_TIMEOUT"
                                ? t.timeout
                                : t.failureHelp}
                        </Text>
                      )}
                      {button(
                        t.retry,
                        () => void enqueue([requestFor(job)]),
                        !!busy || !/^[\w-]{11}$/.test(job.videoId),
                      )}
                    </>
                  )}
                </View>
              );
            })}
            {visibleJobs < matches.length &&
              button(t.more, () => setVisibleJobs((value) => value + 50))}
          </>
        )}
        <Text
          style={{
            color: c.muted,
            fontSize: 12,
            lineHeight: 20,
            marginTop: 28,
            textAlign: rtl ? "right" : "left",
          }}
        >
          {t.local}
        </Text>
        {button(
          t.about,
          () => void action(async () => setLicense(await downloads.licenses())),
        )}
      </ScrollView>
      <Modal
        visible={license !== undefined}
        onRequestClose={() => setLicense(undefined)}
        animationType="slide"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: 20 }}>
          {button(t.close, () => setLicense(undefined))}
          <ScrollView>
            <Text
              selectable
              style={{
                color: c.text,
                fontSize: 12,
                lineHeight: 19,
                marginTop: 20,
              }}
            >
              {license}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Screen />
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  page: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  brand: { fontSize: 25, fontWeight: "700" },
  row: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginVertical: 9,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  heading: { fontSize: 26, fontWeight: "700", marginTop: 18 },
  description: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 12,
  },
  card: { borderWidth: 1, borderRadius: 10, padding: 16, marginTop: 14 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 9, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  button: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 6,
  },
  notice: {
    padding: 14,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 12,
    fontSize: 13,
    lineHeight: 21,
  },
  videoTitle: { fontSize: 16, fontWeight: "600" },
  track: { height: 4, borderRadius: 2, overflow: "hidden", marginVertical: 14 },
  playlistItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
});
