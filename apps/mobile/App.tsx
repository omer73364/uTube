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
  BackHandler,
  Keyboard,
  Image,
  AppState,
  DeviceEventEmitter,
  Modal,
  Linking,
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
import { media } from "./src/tasks";
import { validMediaID } from "../../packages/core/media-source.js";
import { en, ar } from "./src/locales";
import { Icon, type IconName } from "./src/ui/Icon";
import { Thumbnail } from "./src/ui/Thumbnail";
import { light, dark as darkPalette } from "./src/ui/theme";

const appVersion: string = require("./package.json").version;

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
  const [tab, setTab] = useState<"download" | "queue" | "library" | "settings">(
    "download",
  );
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
  const [libraryMode, setLibraryMode] = useState<"files" | "playlists">(
    "files",
  );
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>();
  const [menu, setMenu] = useState<Job>();
  const [qualityOpen, setQualityOpen] = useState(false);
  const previousTab = useRef<typeof tab>("download");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [license, setLicense] = useState<string>();
  const lookup = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const t = language === "ar" ? ar : en;
  const rtl = language === "ar";
  const dark = theme === "dark" || (theme === "system" && system === "dark");
  const c = dark ? darkPalette : light;
  // Let native text follow the inherited paragraph direction. Explicit right/left
  // is mirrored again by Android inside an RTL layout.
  const text = {
    color: c.text,
    textAlign: "auto",
    writingDirection: rtl ? "rtl" : "ltr",
  } as const;
  const active = jobs.filter((job) => activeStates.has(job.status));
  const retryable = jobs.filter(
    (job) => retryStates.has(job.status) && validMediaID(job.videoId),
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
    if (detail.includes("DOWNLOAD_BUSY")) return t.downloadBusy;
    if (detail.includes("QUEUE_FULL")) return t.queueFull;
    if (detail.includes("EMPTY_PLAYLIST")) return t.emptyPlaylist;
    if (detail.includes("PLAYLIST_TOO_LARGE")) return t.largePlaylist;
    if (/NO_FORMATS|No downloadable/.test(detail)) return t.noFormat;
    if (detail.includes("PLAYER_")) return t.player;
    if (/valid YouTube|No valid video/.test(detail)) return t.invalid;
    if (/Facebook/.test(detail)) {
      if (/limiting/.test(detail)) return t.facebookRateLimited;
      if (/no downloadable/.test(detail)) return t.facebookNoVideo;
      return t.facebookUnavailable;
    }
    if (/Instagram/.test(detail)) {
      if (/limiting/.test(detail)) return t.instagramRateLimited;
      if (/no downloadable|selected.*unavailable/.test(detail)) return t.instagramNoVideo;
      return t.instagramUnavailable;
    }
    if (detail.includes("requires sign-in")) return t.xUnavailable;
    if (/X post has no downloadable|X video has no downloadable|selected video is not available/.test(detail)) return t.xNoVideo;
    if (/X is limiting/.test(detail)) return t.xRateLimited;
    if (detail.includes("MISSING_FILE")) return t.missingHelp;
    if (/No Activity|ActivityNotFound/.test(detail)) return t.openHelp;
    if (/HTTP_403|HTTP_410|HTTP_404/.test(detail)) return t.denied;
    return `${t.error}\n${detail.slice(0, 220)}`;
  }
  async function find() {
    Keyboard.dismiss();
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    const id = ++generation.current;
    setBusy("find");
    setError("");
    setNotice("");
    setPreview(undefined);
    try {
      const data = await media.inspect(url, controller.signal);
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
              thumbnail: preview.thumbnail,
              title: preview.title.slice(0, 180),
              mode,
              requestedQuality,
            },
          ]
        : preview.items
            .filter((item) => selection.has(item.id))
            .map((item) => ({
              videoId: item.id,
              thumbnail: item.thumbnail,
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
    thumbnail: job.thumbnail,
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
  const card = { backgroundColor: c.surface, borderColor: c.line };
  const iconButton = (
    icon: IconName,
    label: string,
    onPress: () => void,
    danger = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={3}
      style={({ pressed }) => [
        s.iconButton,
        { backgroundColor: pressed ? c.soft : "transparent" },
      ]}
    >
      <Icon name={icon} color={danger ? c.error : c.text} size={21} />
    </Pressable>
  );
  const button = (
    label: string,
    onPress: () => void,
    disabled = false,
    primary = false,
    icon?: IconName,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: primary ? c.blue : c.soft,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon && (
        <Icon name={icon} size={18} color={primary ? c.onAccent : c.text} />
      )}
      <Text
        style={{
          color: primary ? c.onAccent : c.text,
          fontSize: 14,
          fontWeight: "700",
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
        s.choice,
        {
          backgroundColor: checked ? c.tint : "transparent",
          borderColor: checked ? c.blue : c.line,
        },
      ]}
    >
      <Text
        style={{
          color: checked ? c.blue : c.muted,
          fontSize: 13,
          fontWeight: checked ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
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
  const remove = (job: Job) => {
    setMenu(undefined);
    Alert.alert(t.removeTitle, t.removeBody, [
      { text: t.back, style: "cancel" },
      {
        text: t.remove,
        style: "destructive",
        onPress: () =>
          void action(async () => {
            await downloads.remove(job.id);
            setNotice(t.removed);
          }),
      },
    ]);
  };
  function navigate(next: typeof tab) {
    setTab(next);
    setQuery("");
    setVisibleJobs(50);
    setError("");
    setNotice("");
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (tab === "settings") {
          setTab(previousTab.current);
          return true;
        }
        if (tab === "library" && selectedPlaylist) {
          setSelectedPlaylist(undefined);
          return true;
        }
        if (tab === "download" && preview) {
          setPreview(undefined);
          return true;
        }
        if (tab !== "download") {
          navigate("download");
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [tab, selectedPlaylist, preview]);
  const openSettings = () => {
    previousTab.current = tab === "settings" ? "download" : tab;
    setTab("settings");
    setError("");
    setNotice("");
  };
  const qualities =
    preview?.kind === "video"
      ? preview.qualities
      : preview?.qualities || ["1080p", "720p", "480p", "360p"];
  const saved = jobs.filter((job) => job.status === "saved");
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
  const libraryFiles = saved.filter(
    (job) =>
      (!selectedPlaylist || job.playlistTitle === selectedPlaylist) &&
      (!query ||
        `${job.title} ${job.playlistTitle || ""}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase())),
  );
  const groups = Array.from(
    new Set(
      saved
        .map((job) => job.playlistTitle)
        .filter((name): name is string => !!name),
    ),
  ).filter(
    (name) =>
      !query || name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const selectedJob = menu
    ? jobs.find((job) => job.id === menu.id) || menu
    : undefined;
  const meta = (job: Job) =>
    `${job.mode === "mp3" ? "MP3" : "MP4"} · ${job.quality === "best" ? t.best : job.quality}`;
  const renderCard = (job: Job) => {
    const fraction = progress(job);
    const activeJob = activeStates.has(job.status);
    const color =
      job.status === "saved"
        ? c.success
        : job.status === "failed" || job.status === "missing"
          ? c.error
          : activeJob
            ? c.blue
            : c.muted;
    return (
      <View key={job.id} style={[s.mediaCard, card]}>
        <View style={s.mediaRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${job.title}, ${t[job.status]}`}
            onPress={() =>
              job.status === "saved"
                ? void action(() => downloads.open(job.id))
                : setMenu(job)
            }
            style={({ pressed }) => [
              s.mediaMain,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Thumbnail
              videoId={job.videoId}
              thumbnail={job.thumbnail}
              tint={c.tint}
              accent={c.blue}
              style={s.smallThumbnail}
            />
            <View style={{ flex: 1, gap: 5 }}>
              <Text numberOfLines={2} style={[s.cardTitle, text]}>
                {job.title}
              </Text>
              <Text
                numberOfLines={1}
                style={[s.metadata, { color: c.muted, textAlign: "auto" }]}
              >
                {meta(job)}
              </Text>
            </View>
          </Pressable>
          {iconButton("more", `${t.actions}: ${job.title}`, () => setMenu(job))}
        </View>
        <View style={s.statusRow}>
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: color,
            }}
          />
          <Text
            style={{
              color,
              fontSize: 11,
              fontWeight: "600",
              flex: 1,
              textAlign: "auto",
            }}
          >
            {t[job.status]}
          </Text>
          {activeJob && fraction !== undefined && (
            <Text
              style={{
                color: c.muted,
                fontSize: 11,
                fontVariant: ["tabular-nums"],
              }}
            >
              {Math.floor(fraction * 100)}%
            </Text>
          )}
        </View>
        {activeJob && (
          <View
            accessibilityRole="progressbar"
            accessibilityValue={
              fraction === undefined
                ? undefined
                : { min: 0, max: 100, now: Math.floor(fraction * 100) }
            }
            style={[s.track, { backgroundColor: c.soft }]}
          >
            <View
              style={{
                height: 4,
                borderRadius: 2,
                width: `${Math.floor((fraction || 0) * 100)}%`,
                backgroundColor: c.blue,
              }}
            />
          </View>
        )}
        {job.downgraded && (
          <Text style={[s.cardNote, { color: c.muted, textAlign: "auto" }]}>
            {t.fallback
              .replace("{actual}", job.quality)
              .replace("{requested}", job.requestedQuality)}
          </Text>
        )}
      </View>
    );
  };
  const empty = (icon: IconName, title: string, detail: string) => (
    <View style={s.empty}>
      <View style={[s.emptyIcon, { backgroundColor: c.tint }]}>
        <Icon name={icon} color={c.blue} size={28} />
      </View>
      <Text style={[s.emptyTitle, text, { textAlign: "center" }]}>{title}</Text>
      <Text style={[s.emptyDetail, { color: c.muted, textAlign: "center" }]}>
        {detail}
      </Text>
    </View>
  );
  const search = (label: string) => (
    <View
      style={[s.search, { backgroundColor: c.surface, borderColor: c.line }]}
    >
      <Icon name="search" color={c.muted} size={18} />
      <TextInput
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={c.muted}
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setVisibleJobs(50);
        }}
        style={[s.searchInput, text]}
      />
      {!!query && iconButton("close", t.clearSearch, () => setQuery(""))}
    </View>
  );
  const settingsRow = (
    icon: IconName,
    label: string,
    detail: string,
    onPress?: () => void,
    danger = false,
  ) => {
    const content = (
      <>
        <View
          style={[s.settingIcon, { backgroundColor: danger ? c.tint : c.soft }]}
        >
          <Icon name={icon} color={danger ? c.error : c.muted} size={20} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={[
              text,
              {
                fontSize: 14,
                fontWeight: "600",
                color: danger ? c.error : c.text,
              },
            ]}
          >
            {label}
          </Text>
          <Text
            style={{
              color: c.muted,
              fontSize: 12,
              lineHeight: 18,
              textAlign: "auto",
            }}
          >
            {detail}
          </Text>
        </View>
        {onPress && (
          <View style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }}>
            <Icon name="chevron" size={16} color={c.muted} />
          </View>
        )}
      </>
    );
    return onPress ? (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={[s.settingRow, { borderColor: c.line }]}
      >
        {content}
      </Pressable>
    ) : (
      <View style={[s.settingRow, { borderColor: c.line }]}>{content}</View>
    );
  };
  const sheet = (
    visible: boolean,
    title: string,
    onClose: () => void,
    children: React.ReactNode,
  ) => (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.sheetBackdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={t.close}
          onPress={onClose}
        />
        <SafeAreaView
          edges={["bottom"]}
          style={[
            s.sheet,
            { backgroundColor: c.surface, direction: rtl ? "rtl" : "ltr" },
          ]}
        >
          <View style={[s.handle, { backgroundColor: c.line }]} />
          <View style={s.sheetHeader}>
            <Text style={[s.sectionTitle, text, { flex: 1 }]} numberOfLines={2}>
              {title}
            </Text>
            {iconButton("close", t.close, onClose)}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
  const menuAction = (
    icon: IconName,
    label: string,
    onPress: () => void,
    danger = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        setMenu(undefined);
        onPress();
      }}
      style={s.menuAction}
    >
      <Icon name={icon} color={danger ? c.error : c.text} size={20} />
      <Text
        style={[
          text,
          { fontSize: 15, fontWeight: "500", color: danger ? c.error : c.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: c.bg }}
    >
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      <View style={[s.header, { direction: rtl ? "rtl" : "ltr" }]}>
        {tab === "settings" ? (
          <View style={s.brandRow}>
            <View style={{ transform: [{ scaleX: rtl ? 1 : -1 }] }}>
              {iconButton("chevron", t.back, () => setTab(previousTab.current))}
            </View>
            <Text style={[s.headerTitle, text]}>{t.settings}</Text>
          </View>
        ) : (
          <View style={s.brandRow}>
            <Image
              source={require("./src/ui/assets/logo.png")}
              style={s.brandMark}
              accessible={false}
            />
            <Text style={[s.brand, { color: c.text }]}>uTube</Text>
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 2 }}>
          {iconButton(
            dark ? "sun" : "moon",
            t.theme,
            () => void preferences(language, dark ? "light" : "dark"),
          )}
          {tab !== "settings" &&
            iconButton("settings", t.settings, openSettings)}
        </View>
      </View>
      <ScrollView
        key={tab}
        contentContainerStyle={[s.page, { direction: rtl ? "rtl" : "ltr" }]}
        keyboardShouldPersistTaps="handled"
      >
        {!!error && (
          <View
            style={[s.notice, { backgroundColor: c.tint, borderColor: c.line }]}
          >
            <Text
              accessibilityRole="alert"
              selectable
              style={[
                text,
                { color: c.error, fontSize: 13, lineHeight: 21, flex: 1 },
              ]}
            >
              {error}
            </Text>
            {iconButton("close", t.close, () => setError(""))}
          </View>
        )}
        {!!notice && (
          <View
            style={[s.notice, { backgroundColor: c.tint, borderColor: c.line }]}
          >
            <Text
              accessibilityLiveRegion="polite"
              style={[
                text,
                { color: c.blue, fontSize: 12, lineHeight: 19, flex: 1 },
              ]}
            >
              {notice}
            </Text>
            {iconButton("close", t.close, () => setNotice(""))}
          </View>
        )}
        {tab === "download" && (
          <>
            {!preview && (
              <>
                <Text style={[s.heading, text]}>{t.title}</Text>
                <Text
                  style={[s.description, { color: c.muted, textAlign: "auto" }]}
                >
                  {t.intro}
                </Text>
                <View style={[s.linkCard, card]}>
                  <View
                    style={[
                      s.linkInput,
                      { backgroundColor: c.bg, borderColor: c.line },
                    ]}
                  >
                    <Icon name="link" color={c.muted} size={18} />
                    <TextInput
                      accessibilityLabel={t.url}
                      value={url}
                      editable={!busy}
                      onChangeText={(value) => {
                        setURL(value);
                        setPreview(undefined);
                      }}
                      maxLength={4096}
                      placeholder={t.linkPlaceholder}
                      placeholderTextColor={c.muted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      returnKeyType="search"
                      onSubmitEditing={() => {
                        if (url.trim() && !busy) void find();
                      }}
                      style={[
                        s.urlInput,
                        {
                          color: c.text,
                          textAlign: url ? "left" : rtl ? "right" : "left",
                          writingDirection: url ? "ltr" : rtl ? "rtl" : "ltr",
                        },
                      ]}
                    />
                    {!!url &&
                      !busy &&
                      iconButton("close", t.clearLink, () => {
                        setURL("");
                        setPreview(undefined);
                      })}
                  </View>
                  {button(
                    busy === "find" ? t.finding : t.find,
                    () => void find(),
                    !!busy || !url.trim(),
                    true,
                    "download",
                  )}
                  {busy === "find" && (
                    <View style={s.loadingRow}>
                      <ActivityIndicator color={c.blue} size="small" />
                      <Pressable
                        accessibilityRole="button"
                        onPress={cancelLookup}
                        style={{ padding: 12 }}
                      >
                        <Text style={{ color: c.muted, fontSize: 13 }}>
                          {t.cancel}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </>
            )}
            {preview ? (
              <View style={[s.previewCard, card]}>
                <View style={s.previewHeader}>
                  <Text style={[s.eyebrow, { color: c.muted }]}>
                    {preview.provider === "facebook" ? t.facebookPost : preview.provider === "instagram" ? t.instagramPost : preview.provider === "x" ? t.xPost : preview.kind === "playlist" ? t.playlist : t.previewLabel}
                  </Text>
                  {iconButton("close", t.close, () => setPreview(undefined))}
                </View>
                <View>
                  <Thumbnail
                    videoId={
                      preview.kind === "video"
                        ? preview.id
                        : preview.items[0]?.id
                    }
                    thumbnail={preview.thumbnail}
                    tint={c.tint}
                    accent={c.blue}
                    style={s.heroThumbnail}
                  />
                  <View style={s.imageBadge}>
                    <Text
                      style={{
                        color: "white",
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      {preview.kind === "playlist"
                        ? `${preview.items.length} ${t.items}`
                        : t.video}
                    </Text>
                  </View>
                </View>
                <Text style={[s.previewTitle, text]}>{preview.title}</Text>
                <Text
                  style={[
                    s.descriptionSmall,
                    { color: c.muted, textAlign: "auto" },
                  ]}
                >
                  {preview.kind === "video"
                    ? preview.author
                    : `${preview.items.length} ${t.items}`}
                </Text>
                <View style={[s.segment, { backgroundColor: c.soft }]}>
                  {(["video", "mp3"] as const).map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: mode === value }}
                      onPress={() => setMode(value)}
                      style={[
                        s.segmentButton,
                        {
                          backgroundColor:
                            mode === value ? c.surface : "transparent",
                        },
                      ]}
                    >
                      <Icon
                        name={value === "video" ? "play" : "download"}
                        color={mode === value ? c.blue : c.muted}
                        size={16}
                      />
                      <Text
                        style={{
                          color: mode === value ? c.blue : c.muted,
                          fontSize: 13,
                          fontWeight: "600",
                        }}
                      >
                        {t[value]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {mode === "video" ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t.quality}: ${quality === "best" ? t.best : quality}`}
                    onPress={() => setQualityOpen(true)}
                    style={[s.qualityRow, { borderColor: c.line }]}
                  >
                    <Text style={[text, { fontSize: 13, flex: 1 }]}>
                      {t.quality}
                    </Text>
                    <Text
                      style={{ color: c.blue, fontSize: 13, fontWeight: "600" }}
                    >
                      {quality === "best" ? t.best : quality}
                    </Text>
                    <View style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }}>
                      <Icon name="chevron" color={c.muted} size={16} />
                    </View>
                  </Pressable>
                ) : (
                  <Text
                    style={[
                      s.cardNote,
                      {
                        color: c.muted,
                        textAlign: "auto",
                        marginVertical: 14,
                      },
                    ]}
                  >
                    {t.audioNote}
                  </Text>
                )}
                {preview.kind === "playlist" && (
                  <>
                    <View style={s.sectionHeader}>
                      <Text style={[s.label, text]}>
                        {selection.size} / {preview.items.length} {t.selected}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          setSelection(
                            selection.size
                              ? new Set()
                              : new Set(
                                  preview.items
                                    .slice(0, 1000)
                                    .map((item) => item.id),
                                ),
                          )
                        }
                        style={{ padding: 10 }}
                      >
                        <Text
                          style={{
                            color: c.blue,
                            fontSize: 12,
                            fontWeight: "600",
                          }}
                        >
                          {selection.size
                            ? t.selectNone
                            : preview.items.length > 1000
                              ? t.selectFirst
                              : t.selectAll}
                        </Text>
                      </Pressable>
                    </View>
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
                        <Thumbnail
                          videoId={item.id}
                          thumbnail={item.thumbnail}
                          tint={c.tint}
                          accent={c.blue}
                          style={{
                            width: 74,
                            aspectRatio: 16 / 9,
                            borderRadius: 8,
                          }}
                        />
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text
                            numberOfLines={2}
                            style={[
                              text,
                              {
                                fontSize: 12,
                                lineHeight: 18,
                                fontWeight: "500",
                              },
                            ]}
                          >
                            {item.title}
                          </Text>
                          <Text
                            style={{
                              color: c.muted,
                              fontSize: 10,
                              textAlign: "auto",
                            }}
                          >
                            {item.index}
                          </Text>
                        </View>
                        <View
                          style={[
                            s.checkbox,
                            {
                              borderColor: selection.has(item.id)
                                ? c.blue
                                : c.line,
                              backgroundColor: selection.has(item.id)
                                ? c.blue
                                : "transparent",
                            },
                          ]}
                        >
                          {selection.has(item.id) && (
                            <Icon name="check" size={13} color={c.onAccent} />
                          )}
                        </View>
                      </Pressable>
                    ))}
                    {visibleItems < preview.items.length &&
                      button(t.more, () =>
                        setVisibleItems((value) => value + 50),
                      )}
                    {preview.items.length > 1000 && (
                      <Text style={[s.cardNote, { color: c.muted }]}>
                        {t.batchLimit}
                      </Text>
                    )}
                  </>
                )}
                {preview.kind === "playlist" ? (
                  <View style={{ height: 12 }} />
                ) : undefined}
                {button(
                  busy === "queue"
                    ? t.starting
                    : preview.kind === "playlist"
                      ? `${t.download} (${selection.size})`
                      : t.download,
                  () => void start(),
                  !!busy || (preview.kind === "playlist" && !selection.size),
                  true,
                  "download",
                )}
                <Text
                  style={[
                    s.cardNote,
                    { color: c.muted, textAlign: "center", marginTop: 12 },
                  ]}
                >
                  {t.savedIn}
                </Text>
              </View>
            ) : (
              <>
                <View style={s.sectionHeader}>
                  <Text style={[s.sectionTitle, text]}>{t.recent}</Text>
                  {jobs.length > 0 && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => navigate("queue")}
                      style={{ padding: 10 }}
                    >
                      <Text
                        style={{
                          color: c.blue,
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {t.viewAll}
                      </Text>
                    </Pressable>
                  )}
                </View>
                {jobs.length
                  ? jobs.slice(0, 3).map(renderCard)
                  : empty("download", t.homeEmpty, t.homeEmptyHelp)}
              </>
            )}
          </>
        )}
        {tab === "queue" && (
          <>
            <View style={s.titleRow}>
              <Text style={[s.heading, text, { marginTop: 0, flex: 1 }]}>
                {t.history}
              </Text>
              {active.length > 0 && (
                <View style={[s.countBadge, { backgroundColor: c.tint }]}>
                  <Text
                    style={{ color: c.blue, fontSize: 12, fontWeight: "700" }}
                  >
                    {active.length}
                  </Text>
                </View>
              )}
            </View>
            {search(t.search)}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filters}
            >
              {(["all", "active", "finished", "errors"] as const).map((value) =>
                choice(t[value], filter === value, () => {
                  setFilter(value);
                  setVisibleJobs(50);
                }),
              )}
            </ScrollView>
            {(active.length > 0 || retryable.length > 0) && (
              <View style={s.toolbar}>
                {active.length > 0 &&
                  active.every((job) => job.status === "queued") &&
                  button(t.resume, () => void action(() => downloads.resume()))}
                {retryable.length > 0 &&
                  button(
                    `${t.retryAll} (${Math.min(1000, retryable.length)})`,
                    () =>
                      void enqueue(retryable.slice(0, 1000).map(requestFor)),
                    !!busy,
                  )}
                {active.length > 0 &&
                  button(
                    t.cancelAll,
                    () => void action(() => downloads.cancelAll()),
                  )}
              </View>
            )}
            {matches.length
              ? matches.slice(0, visibleJobs).map(renderCard)
              : empty(
                  "download",
                  query ? t.noMatches : t.queueEmpty,
                  t.queueEmptyHelp,
                )}
            {visibleJobs < matches.length &&
              button(t.more, () => setVisibleJobs((value) => value + 50))}
          </>
        )}
        {tab === "library" && (
          <>
            <Text style={[s.heading, text, { marginTop: 0 }]}>{t.library}</Text>
            {search(t.librarySearch)}
            <View style={s.filters}>
              {choice(t.files, libraryMode === "files", () => {
                setLibraryMode("files");
                setSelectedPlaylist(undefined);
              })}
              {choice(t.playlists, libraryMode === "playlists", () => {
                setLibraryMode("playlists");
                setSelectedPlaylist(undefined);
              })}
            </View>
            {selectedPlaylist && (
              <View style={s.sectionHeader}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSelectedPlaylist(undefined)}
                  style={s.backToFolders}
                >
                  <View style={{ transform: [{ scaleX: rtl ? 1 : -1 }] }}>
                    <Icon name="chevron" size={16} color={c.blue} />
                  </View>
                  <Text style={{ color: c.blue, fontSize: 12 }}>
                    {t.playlists}
                  </Text>
                </Pressable>
                <Text
                  numberOfLines={1}
                  style={[text, { flex: 1, fontSize: 13, fontWeight: "600" }]}
                >
                  {selectedPlaylist}
                </Text>
              </View>
            )}
            {libraryMode === "playlists" && !selectedPlaylist
              ? groups.length
                ? groups.slice(0, visibleJobs).map((name) => {
                    const items = saved.filter(
                      (job) => job.playlistTitle === name,
                    );
                    return (
                      <Pressable
                        key={name}
                        accessibilityRole="button"
                        onPress={() => setSelectedPlaylist(name)}
                        style={[s.folderCard, card]}
                      >
                        <Thumbnail
                          videoId={items[0]?.videoId}
                          thumbnail={items[0]?.thumbnail}
                          tint={c.tint}
                          accent={c.blue}
                          style={s.smallThumbnail}
                        />
                        <View style={{ flex: 1, gap: 6 }}>
                          <Text numberOfLines={2} style={[s.cardTitle, text]}>
                            {name}
                          </Text>
                          <Text
                            style={[
                              s.metadata,
                              {
                                color: c.muted,
                                textAlign: "auto",
                              },
                            ]}
                          >
                            {items.length} {t.items}
                          </Text>
                        </View>
                        <Icon name="folder" color={c.blue} size={21} />
                      </Pressable>
                    );
                  })
                : empty("folder", t.libraryEmpty, t.libraryEmptyHelp)
              : libraryFiles.length
                ? libraryFiles.slice(0, visibleJobs).map(renderCard)
                : empty(
                    "library",
                    query ? t.noMatches : t.libraryEmpty,
                    t.libraryEmptyHelp,
                  )}
            {(libraryMode === "playlists" && !selectedPlaylist
              ? groups.length
              : libraryFiles.length) > visibleJobs &&
              button(t.more, () => setVisibleJobs((value) => value + 50))}
          </>
        )}
        {tab === "settings" && (
          <>
            <Text
              style={[s.settingsLabel, { color: c.muted, textAlign: "auto" }]}
            >
              {t.languageLabel}
            </Text>
            <View style={[s.settingsCard, card]}>
              <View style={s.settingsChoices}>
                {choice(
                  "English",
                  language === "en",
                  () => void preferences("en", theme),
                )}
                {choice(
                  "العربية",
                  language === "ar",
                  () => void preferences("ar", theme),
                )}
              </View>
            </View>
            <Text
              style={[s.settingsLabel, { color: c.muted, textAlign: "auto" }]}
            >
              {t.theme}
            </Text>
            <View style={[s.settingsCard, card]}>
              <View style={s.appearanceRow}>
                {(["system", "light", "dark"] as const).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: theme === value }}
                    onPress={() => void preferences(language, value)}
                    style={[
                      s.appearanceChoice,
                      {
                        borderColor: theme === value ? c.blue : c.line,
                        backgroundColor: theme === value ? c.tint : c.surface,
                      },
                    ]}
                  >
                    <Icon
                      name={
                        value === "dark"
                          ? "moon"
                          : value === "light"
                            ? "sun"
                            : "system"
                      }
                      color={theme === value ? c.blue : c.muted}
                      size={23}
                    />
                    <Text
                      style={{
                        color: theme === value ? c.blue : c.muted,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {t[value]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Text
              style={[s.settingsLabel, { color: c.muted, textAlign: "auto" }]}
            >
              {t.storage}
            </Text>
            <View style={[s.settingsCard, card]}>
              {settingsRow("folder", t.location, "Downloads / uTube")}
              {settingsRow("trash", t.clear, t.keepFiles, clear, true)}
            </View>
            <View style={[s.settingsCard, card, { marginTop: 22 }]}>
              {settingsRow(
                "library",
                t.about,
                `${t.version} ${appVersion}`,
                () => setAboutOpen(true),
              )}
            </View>
            <Text style={[s.local, { color: c.muted, textAlign: "center" }]}>
              {t.local}
            </Text>
          </>
        )}
      </ScrollView>
      <SafeAreaView
        edges={["bottom"]}
        style={{
          backgroundColor: c.surface,
          borderTopWidth: 1,
          borderTopColor: c.line,
        }}
      >
        <View style={[s.navigation, { direction: rtl ? "rtl" : "ltr" }]}>
          {(
            [
              { key: "download", icon: "home", label: t.home },
              { key: "library", icon: "library", label: t.library },
              { key: "queue", icon: "download", label: t.history },
            ] as const
          ).map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item.key }}
              onPress={() => navigate(item.key)}
              style={s.navItem}
            >
              <View style={s.navIcon}>
                <View
                  pointerEvents="none"
                  style={[
                    s.navHighlight,
                    {
                      backgroundColor:
                        tab === item.key ? c.tint : "transparent",
                    },
                  ]}
                />
                <Icon
                  name={item.icon}
                  color={tab === item.key ? c.blue : c.muted}
                  size={21}
                />
                {item.key === "queue" && active.length > 0 && (
                  <View style={[s.navBadge, { backgroundColor: c.blue }]}>
                    <Text
                      style={{
                        fontSize: 9,
                        color: c.onAccent,
                        fontWeight: "700",
                      }}
                    >
                      {active.length > 99 ? "99+" : active.length}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={{
                  color: tab === item.key ? c.blue : c.muted,
                  fontSize: 11,
                  fontWeight: tab === item.key ? "700" : "500",
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
      {sheet(
        qualityOpen,
        t.quality,
        () => setQualityOpen(false),
        <>
          {["best", ...qualities].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: quality === value }}
              onPress={() => {
                setQuality(value);
                setQualityOpen(false);
              }}
              style={[s.qualityOption, { borderColor: c.line }]}
            >
              <Text
                style={[
                  text,
                  {
                    flex: 1,
                    fontSize: 15,
                    color: quality === value ? c.blue : c.text,
                  },
                ]}
              >
                {value === "best" ? t.best : value}
              </Text>
              {quality === value && (
                <Icon name="check" color={c.blue} size={20} />
              )}
            </Pressable>
          ))}
        </>,
      )}
      {sheet(
        !!selectedJob,
        selectedJob?.title || t.actions,
        () => setMenu(undefined),
        selectedJob && (
          <>
            <View style={s.sheetMedia}>
              <Thumbnail
                videoId={selectedJob.videoId}
                thumbnail={selectedJob.thumbnail}
                tint={c.tint}
                accent={c.blue}
                style={{ width: 90, aspectRatio: 16 / 9 }}
              />
              <Text style={{ color: c.muted, fontSize: 13 }}>
                {meta(selectedJob)}
              </Text>
            </View>
            {selectedJob.status === "saved" && (
              <>
                {menuAction(
                  "play",
                  t.open,
                  () => void action(() => downloads.open(selectedJob.id)),
                )}
                {menuAction(
                  "share",
                  t.share,
                  () => void action(() => downloads.share(selectedJob.id)),
                )}
              </>
            )}
            {(retryStates.has(selectedJob.status) ||
              selectedJob.status === "cancelled") &&
              menuAction(
                "retry",
                t.retry,
                () => void enqueue([requestFor(selectedJob)]),
              )}
            {activeStates.has(selectedJob.status)
              ? menuAction(
                  "close",
                  t.cancel,
                  () => void action(() => downloads.cancel(selectedJob.id)),
                  true,
                )
              : menuAction("trash", t.remove, () => remove(selectedJob), true)}
            {retryStates.has(selectedJob.status) && (
              <Text
                style={[
                  s.cardNote,
                  {
                    color: c.muted,
                    marginBottom: 14,
                    textAlign: "auto",
                  },
                ]}
              >
                {selectedJob.status === "missing"
                  ? t.missingHelp
                  : selectedJob.error?.startsWith("HTTP_")
                    ? t.denied
                    : selectedJob.error === "REQUEST_TIMEOUT"
                      ? t.timeout
                      : t.failureHelp}
              </Text>
            )}
          </>
        ),
      )}
      <Modal
        visible={aboutOpen}
        onRequestClose={() =>
          license !== undefined ? setLicense(undefined) : setAboutOpen(false)
        }
        animationType="slide"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: 20 }}>
          <View style={s.sheetHeader}>
            <Text style={[s.sectionTitle, text, { flex: 1 }]}>
              {license !== undefined ? t.licenses : t.about}
            </Text>
            {license !== undefined
              ? iconButton("chevron", t.back, () => setLicense(undefined))
              : iconButton("close", t.close, () => setAboutOpen(false))}
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            {license === undefined ? (
              <>
                <View
                  style={{ alignItems: "center", paddingVertical: 28, gap: 12 }}
                >
                  <Image
                    source={require("./src/ui/assets/logo.png")}
                    style={{ width: 72, height: 72 }}
                  />
                  <Text style={[s.sectionTitle, text]}>uTube</Text>
                  <Text style={{ color: c.muted }}>
                    {t.version} {appVersion}
                  </Text>
                </View>
                <Text
                  style={[
                    text,
                    {
                      color: c.muted,
                      fontSize: 15,
                      lineHeight: 25,
                      marginBottom: 24,
                    },
                  ]}
                >
                  {t.aboutDescription}
                </Text>
                <View style={[s.settingsCard, card]}>
                  {settingsRow(
                    "github",
                    t.repository,
                    "github.com/omer73364/uTube",
                    () =>
                      void action(() =>
                        Linking.openURL("https://github.com/omer73364/uTube"),
                      ),
                  )}
                  {settingsRow(
                    "library",
                    t.licenses,
                    t.licensesDetail,
                    () =>
                      void action(async () =>
                        setLicense(await downloads.licenses()),
                      ),
                  )}
                </View>
                <Text
                  style={[s.local, { color: c.muted, textAlign: "center" }]}
                >
                  {t.aboutCredit}
                </Text>
              </>
            ) : (
              <Text
                selectable
                style={{
                  color: c.text,
                  fontSize: 12,
                  lineHeight: 19,
                  marginTop: 16,
                }}
              >
                {license}
              </Text>
            )}
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
  page: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { fontSize: 23, fontWeight: "800", letterSpacing: -0.8 },
  headerTitle: { fontSize: 19, fontWeight: "700" },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.6,
    lineHeight: 37,
    marginTop: 14,
  },
  description: { fontSize: 14, lineHeight: 22, marginTop: 8, marginBottom: 24 },
  linkCard: { padding: 14, borderWidth: 1, borderRadius: 18, marginBottom: 16 },
  linkInput: {
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    minHeight: 52,
    gap: 8,
    marginBottom: 12,
  },
  urlInput: { flex: 1, fontSize: 13, paddingVertical: 12, minHeight: 48 },
  button: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  mediaCard: { borderWidth: 1, borderRadius: 17, padding: 12, marginTop: 10 },
  mediaRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  mediaMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  smallThumbnail: { width: 96, aspectRatio: 16 / 10, borderRadius: 10 },
  cardTitle: { fontSize: 13, fontWeight: "600", lineHeight: 20 },
  metadata: { fontSize: 11, lineHeight: 16 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 2,
  },
  track: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: 9 },
  cardNote: { fontSize: 11, lineHeight: 18, marginTop: 8 },
  previewCard: { borderWidth: 1, borderRadius: 19, padding: 14, marginTop: 4 },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  eyebrow: { fontSize: 12, fontWeight: "600" },
  heroThumbnail: { width: "100%", aspectRatio: 16 / 9, borderRadius: 12 },
  imageBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: "#151515B8",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 26,
    marginTop: 15,
  },
  descriptionSmall: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    marginBottom: 18,
  },
  segment: { flexDirection: "row", padding: 4, borderRadius: 12, gap: 4 },
  segmentButton: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  qualityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 18,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  label: { fontSize: 12, fontWeight: "600" },
  playlistItem: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    marginTop: 18,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 13 },
  filters: { flexDirection: "row", gap: 7, paddingVertical: 16 },
  choice: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  empty: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 22 },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  emptyDetail: { fontSize: 13, lineHeight: 21, marginTop: 9, maxWidth: 270 },
  folderCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
  },
  backToFolders: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 10,
    paddingRight: 12,
  },
  settingsLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 22,
    marginBottom: 10,
  },
  settingsCard: { borderWidth: 1, borderRadius: 17, overflow: "hidden" },
  settingsChoices: { flexDirection: "row", padding: 16, gap: 10 },
  appearanceRow: { flexDirection: "row", padding: 12, gap: 10 },
  appearanceChoice: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 20,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingIcon: {
    width: 35,
    height: 35,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  local: { fontSize: 12, lineHeight: 20, marginTop: 26, marginBottom: 10 },
  navigation: { flexDirection: "row", paddingTop: 6, paddingBottom: 5 },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 57,
  },
  navIcon: {
    width: 50,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  navHighlight: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    overflow: "hidden",
  },
  navBadge: {
    position: "absolute",
    right: 0,
    top: -4,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#00000066",
  },
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 22,
    paddingBottom: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  sheetMedia: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  menuAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 54,
    paddingVertical: 14,
  },
  qualityOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    paddingLeft: 14,
    paddingVertical: 7,
    borderRadius: 13,
    marginBottom: 12,
  },
});
