import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
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
import { downloads } from "./src/native";
import { progress, type Job, type Preview } from "./src/domain";
import { PlayerSandbox, type PlayerEvaluator } from "./src/PlayerSandbox";
import { createInspector } from "./src/youtube";
import { en, ar } from "./src/locales";

function Screen() {
  const system = useColorScheme();
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [url, setURL] = useState("");
  const [preview, setPreview] = useState<Preview>();
  const [selected, setSelected] = useState<number>();
  const [busy, setBusy] = useState<"find" | "start">();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const sandbox = useRef<PlayerEvaluator>(null);
  const t = language === "ar" ? ar : en;
  const dark = theme === "dark" || (theme === "system" && system === "dark");
  const c = dark
    ? {
        bg: "#10151d",
        surface: "#1b2330",
        text: "#eef2f9",
        muted: "#a4afc1",
        line: "#303c50",
        blue: "#8aafff",
      }
    : {
        bg: "#f5f6f8",
        surface: "#fff",
        text: "#19212d",
        muted: "#637082",
        line: "#dce1e8",
        blue: "#3769d6",
      };
  const rtl = language === "ar";
  const textStyle = {
    color: c.text,
    textAlign: rtl ? "right" : "left",
    writingDirection: rtl ? "rtl" : "ltr",
  } as const;
  const inspect = useMemo(
    () =>
      createInspector(
        (script) =>
          sandbox.current?.evaluate(script) ||
          Promise.reject(new Error("PLAYER_NOT_READY")),
      ),
    [],
  );
  const refresh = useCallback(async () => {
    try {
      setJobs(await downloads.list());
    } catch {
      setError(language === "ar" ? ar.historyError : en.historyError);
    }
  }, [language]);
  useEffect(() => {
    downloads
      .settings()
      .then((prefs) => {
        setLanguage(prefs.language);
        setTheme(prefs.theme);
      })
      .catch(() => setError(en.settingsError));
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, 1500);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [refresh]);
  function message(error: unknown) {
    const detail = error instanceof Error ? error.message : "";
    if (detail.includes("PLAYLIST_NOT_YET")) return t.playlist;
    if (detail.includes("NO_COMBINED_MP4")) return t.noFormat;
    if (detail.includes("PLAYER_")) return t.player;
    if (/valid YouTube|No valid video/.test(detail)) return t.invalid;
    return `${t.error}${detail ? `\n${detail}` : ""}`;
  }
  async function find() {
    setBusy("find");
    setError("");
    setPreview(undefined);
    try {
      const data = await inspect(url);
      setPreview(data);
      setSelected(data.formats[0].id);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(undefined);
    }
  }
  async function start() {
    if (!preview) return;
    setBusy("start");
    setError("");
    try {
      // Resolve a fresh URL on each start; signed stream links expire.
      const fresh = await inspect(`https://youtu.be/${preview.id}`);
      const format = fresh.formats.find((item) => item.id === selected);
      if (!format) throw new Error("NO_COMBINED_MP4");
      await downloads.start(format.url, fresh.id, fresh.title, format.quality);
      await refresh();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(undefined);
    }
  }
  async function preferences(
    nextLanguage: "en" | "ar",
    nextTheme: "light" | "dark" | "system",
  ) {
    try {
      await downloads.saveSettings(nextLanguage, nextTheme);
      setLanguage(nextLanguage);
      setTheme(nextTheme);
    } catch {
      setError(t.settingsError);
    }
  }
  async function action(fn: () => Promise<void>) {
    try {
      setError("");
      await fn();
      await refresh();
    } catch (error) {
      setError(message(error));
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
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      <PlayerSandbox ref={sandbox} />
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
        <View style={s.themes} accessibilityLabel={t.theme}>
          {(["system", "light", "dark"] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: theme === value }}
              onPress={() => void preferences(language, value)}
              style={[
                s.chip,
                { borderColor: theme === value ? c.blue : c.line },
              ]}
            >
              <Text style={{ color: theme === value ? c.blue : c.muted }}>
                {t[value]}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[s.heading, textStyle]}>{t.title}</Text>
        <Text
          style={[
            s.description,
            { color: c.muted, textAlign: rtl ? "right" : "left" },
          ]}
        >
          {t.intro}
        </Text>
        <View
          style={[s.card, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <Text style={[s.label, textStyle]}>{t.url}</Text>
          <TextInput
            accessibilityLabel={t.url}
            value={url}
            editable={!busy}
            onChangeText={(value) => {
              setURL(value);
              setPreview(undefined);
            }}
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
              {
                color: c.text,
                borderColor: c.line,
                direction: "ltr",
                textAlign: "left",
              },
            ]}
          />
          {button(
            busy === "find" ? t.finding : t.find,
            () => void find(),
            !!busy || !url.trim(),
            true,
          )}
        </View>
        {busy && (
          <ActivityIndicator
            accessibilityLabel={busy === "find" ? t.finding : t.starting}
            color={c.blue}
            style={{ marginVertical: 14 }}
          />
        )}
        {!!error && (
          <Text
            accessibilityRole="alert"
            selectable
            style={[
              s.notice,
              {
                color: dark ? "#ffb4ac" : "#a6312a",
                borderColor: c.line,
                textAlign: rtl ? "right" : "left",
              },
            ]}
          >
            {error}
          </Text>
        )}
        {preview && (
          <View
            style={[
              s.card,
              { backgroundColor: c.surface, borderColor: c.line },
            ]}
          >
            <Text style={[s.videoTitle, textStyle]}>{preview.title}</Text>
            <Text style={{ color: c.muted }}>{preview.author}</Text>
            <Text style={[s.label, textStyle]}>{t.quality}</Text>
            <View style={s.themes}>
              {preview.formats.map((format) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected === format.id }}
                  key={format.id}
                  onPress={() => setSelected(format.id)}
                  style={[
                    s.chip,
                    { borderColor: selected === format.id ? c.blue : c.line },
                  ]}
                >
                  <Text
                    style={{ color: selected === format.id ? c.blue : c.text }}
                  >
                    {format.quality}
                  </Text>
                </Pressable>
              ))}
            </View>
            {button(
              busy === "start" ? t.starting : t.download,
              () => void start(),
              !!busy,
              true,
            )}
            <Text style={{ color: c.muted, fontSize: 12, marginTop: 12 }}>
              {t.savedIn}
            </Text>
          </View>
        )}
        <Text style={[s.section, textStyle]}>{t.history}</Text>
        {!jobs.length && (
          <Text style={{ color: c.muted, textAlign: rtl ? "right" : "left" }}>
            {t.empty}
          </Text>
        )}
        {jobs.map((job) => {
          const fraction = progress(job);
          return (
            <View
              key={job.id}
              style={[
                s.card,
                { backgroundColor: c.surface, borderColor: c.line },
              ]}
            >
              <Text style={[s.videoTitle, textStyle]}>{job.title}</Text>
              <Text style={{ color: c.muted, fontSize: 12, marginTop: 7 }}>
                {job.quality} · MP4 · {t[job.status]}
                {fraction !== undefined && job.status !== "saved"
                  ? ` · ${Math.round(fraction * 100)}%`
                  : ""}
              </Text>
              {["running", "paused", "queued"].includes(job.status) && (
                <>
                  <View style={[s.track, { backgroundColor: c.line }]}>
                    <View
                      style={{
                        height: 4,
                        width: `${Math.round((fraction || 0) * 100)}%`,
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
              {job.status === "saved" &&
                button(t.open, () => void action(() => downloads.open(job.id)))}
              {job.status === "failed" && (
                <Text style={{ color: c.muted, fontSize: 12, marginTop: 10 }}>
                  {t.failureHelp}
                </Text>
              )}
            </View>
          );
        })}
        <Text
          style={{
            color: c.muted,
            fontSize: 12,
            lineHeight: 20,
            marginTop: 24,
            textAlign: rtl ? "right" : "left",
          }}
        >
          {t.prototype}
        </Text>
      </ScrollView>
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
    marginBottom: 20,
  },
  brand: { fontSize: 25, fontWeight: "700" },
  themes: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginVertical: 12,
  },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 7,
  },
  heading: { fontSize: 26, fontWeight: "700", marginTop: 18 },
  description: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 20,
  },
  card: { borderWidth: 1, borderRadius: 10, padding: 16, marginTop: 12 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 9, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 7,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  button: {
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 6,
  },
  notice: {
    padding: 14,
    borderWidth: 1,
    borderRadius: 7,
    marginTop: 12,
    fontSize: 13,
    lineHeight: 21,
  },
  videoTitle: { fontSize: 16, fontWeight: "600" },
  section: { fontSize: 20, fontWeight: "700", marginTop: 28, marginBottom: 8 },
  track: { height: 4, borderRadius: 2, overflow: "hidden", marginVertical: 14 },
});
