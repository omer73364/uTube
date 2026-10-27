import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { downloads } from "./native";
import { shareRequests } from "./share";
import { media } from "./tasks";
import { en, ar } from "./locales";
import type { MediaMode, Preview, PlaylistPreview } from "./domain";
import { light, dark } from "./ui/theme";
import { Thumbnail } from "./ui/Thumbnail";
import { Icon } from "./ui/Icon";

export default function ShareScreen({ url }: { url: string }) {
  return (
    <SafeAreaProvider>
      <Sheet url={url} />
    </SafeAreaProvider>
  );
}

function Sheet({ url }: { url: string }) {
  const system = useColorScheme();
  const [prefs, setPrefs] = useState({
    language: "en" as "en" | "ar",
    theme: "system" as "system" | "light" | "dark",
  });
  const [preview, setPreview] = useState<Preview | PlaylistPreview>();
  const [selection, setSelection] = useState(new Set<number>());
  const [choosing, setChoosing] = useState(false);
  const [visible, setVisible] = useState(50);
  const [mode, setMode] = useState<MediaMode>("video");
  const [quality, setQuality] = useState("best");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const t = prefs.language === "ar" ? ar : en;
  const rtl = prefs.language === "ar";
  const p = (
    prefs.theme === "system" ? system === "dark" : prefs.theme === "dark"
  )
    ? dark
    : light;
  const text = {
    color: p.text,
    textAlign: rtl ? ("right" as const) : ("left" as const),
  };
  const row = {
    flexDirection: rtl ? ("row-reverse" as const) : ("row" as const),
  };
  useEffect(() => {
    void downloads
      .settings()
      .then(setPrefs)
      .catch(() => {});
    const controller = new AbortController();
    setError(undefined);
    setPreview(undefined);
    void media
      .inspect(url, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setPreview(value);
          setQuality("best");
          setSelection(
            new Set(
              value.kind === "playlist"
                ? value.items.slice(0, 1000).map((item) => item.index)
                : [],
            ),
          );
          setChoosing(false);
          setVisible(50);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "PREPARATION_FAILED");
      });
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      downloads.closeShare();
      return true;
    });
    return () => {
      controller.abort();
      back.remove();
    };
  }, [url, attempt]);

  async function start() {
    if (!preview || busy || (preview.kind === "playlist" && !selection.size))
      return;
    setBusy(true);
    setError(undefined);
    try {
      if (
        Platform.OS === "android" &&
        Number(Platform.Version) >= 33 &&
        !(await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        ))
      ) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
      }
      const requests = shareRequests(preview, mode, quality, selection);
      await downloads.enqueue(requests);
      downloads.closeShare();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "PREPARATION_FAILED");
    } finally {
      setBusy(false);
    }
  }
  const button = (
    label: string,
    action: () => void,
    selected = false,
    disabled = false,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={action}
      style={[
        s.choice,
        {
          borderColor: selected ? p.blue : p.line,
          backgroundColor: selected ? p.tint : p.surface,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text
        style={[
          text,
          {
            color: selected ? p.blue : p.text,
            fontWeight: "600",
            fontSize: 13,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
  const qualities =
    preview?.kind === "video"
      ? preview.qualities
      : preview?.qualities || ["1080p", "720p", "480p", "360p"];
  return (
    <View style={s.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel={t.close}
        onPress={() => downloads.closeShare()}
      />
      <SafeAreaView
        edges={["bottom", "left", "right"]}
        style={[s.sheet, { backgroundColor: p.bg }]}
      >
        <View style={s.handle} />
        <View style={[s.heading, row]}>
          <Text style={[text, s.brand]}>uTube</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.close}
            onPress={() => downloads.closeShare()}
            style={s.close}
          >
            <Icon name="close" color={p.text} size={24} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.content}>
          {!preview && !error && (
            <View style={s.loading}>
              <ActivityIndicator color={p.blue} />
              <Text style={text}>
                {rtl
                  ? "جارٍ تجهيز خيارات التنزيل…"
                  : "Getting download options…"}
              </Text>
            </View>
          )}
          {preview && (
            <>
              <View style={[s.details, row]}>
                <Thumbnail
                  videoId={
                    preview.kind === "video" ? preview.id : preview.items[0]?.id
                  }
                  thumbnail={preview.thumbnail}
                  tint={p.soft}
                  accent={p.blue}
                  style={s.thumb}
                />
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={[text, s.title]} numberOfLines={3}>
                    {preview.title}
                  </Text>
                  <Text style={[text, { color: p.muted, fontSize: 12 }]}>
                    {preview.kind === "video"
                      ? preview.author
                      : `${Math.min(preview.items.length, 1000)} ${t.items}`}
                  </Text>
                </View>
              </View>
              <View style={[s.options, row]}>
                {button(
                  rtl ? "فيديو · MP4" : "Video · MP4",
                  () => setMode("video"),
                  mode === "video",
                  busy,
                )}
                {button(
                  rtl ? "صوت · MP3" : "Audio · MP3",
                  () => setMode("mp3"),
                  mode === "mp3",
                  busy || (preview.kind === "video" && !preview.audioAvailable),
                )}
              </View>
              {mode === "video" && (
                <>
                  <Text style={[text, s.label]}>{t.quality}</Text>
                  <View style={[s.options, row]}>
                    {button(
                      t.best,
                      () => setQuality("best"),
                      quality === "best",
                      busy,
                    )}
                    {qualities
                      .filter((q) => q !== "best")
                      .map((q) =>
                        button(q, () => setQuality(q), quality === q, busy),
                      )}
                  </View>
                </>
              )}
              {preview.kind === "playlist" && (
                <View style={{ gap: 10 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: choosing }}
                    disabled={busy}
                    onPress={() => setChoosing((value) => !value)}
                    style={[s.selector, row, { borderColor: p.line }]}
                  >
                    <Text
                      style={[
                        text,
                        { flex: 1, fontWeight: "600", fontSize: 13 },
                      ]}
                    >
                      {rtl
                        ? `اختر الفيديوهات · تم تحديد ${selection.size}`
                        : `Choose videos · ${selection.size} selected`}
                    </Text>
                    <Text style={{ color: p.blue }}>
                      {choosing ? "−" : "+"}
                    </Text>
                  </Pressable>
                  {choosing && (
                    <>
                      <View style={[s.options, row]}>
                        {button(
                          rtl ? "تحديد الكل" : "Select all",
                          () =>
                            setSelection(
                              new Set(
                                preview.items
                                  .slice(0, 1000)
                                  .map((item) => item.index),
                              ),
                            ),
                          false,
                          busy,
                        )}
                        {button(
                          rtl ? "إلغاء التحديد" : "Clear selection",
                          () => setSelection(new Set()),
                          false,
                          busy,
                        )}
                      </View>
                      {preview.items
                        .slice(0, Math.min(visible, 1000))
                        .map((item) => {
                          const checked = selection.has(item.index);
                          return (
                            <Pressable
                              key={item.index}
                              accessibilityRole="checkbox"
                              accessibilityLabel={item.title}
                              accessibilityState={{ checked, disabled: busy }}
                              disabled={busy}
                              onPress={() =>
                                setSelection((current) => {
                                  const next = new Set(current);
                                  if (next.has(item.index))
                                    next.delete(item.index);
                                  else next.add(item.index);
                                  return next;
                                })
                              }
                              style={[
                                s.playlistItem,
                                row,
                                {
                                  borderColor: checked ? p.blue : p.line,
                                  backgroundColor: checked ? p.tint : p.surface,
                                },
                              ]}
                            >
                              <View
                                style={[
                                  s.checkbox,
                                  {
                                    borderColor: checked ? p.blue : p.muted,
                                    backgroundColor: checked
                                      ? p.blue
                                      : "transparent",
                                  },
                                ]}
                              >
                                {checked && (
                                  <Icon
                                    name="check"
                                    size={14}
                                    color={p.onAccent}
                                  />
                                )}
                              </View>
                              <Thumbnail
                                videoId={item.id}
                                thumbnail={item.thumbnail}
                                tint={p.soft}
                                accent={p.blue}
                                style={s.itemThumb}
                              />
                              <Text
                                numberOfLines={2}
                                style={[text, { flex: 1, fontSize: 13 }]}
                              >
                                {item.title}
                              </Text>
                            </Pressable>
                          );
                        })}
                      {visible < Math.min(preview.items.length, 1000) &&
                        button(
                          rtl ? "عرض المزيد" : "Show more",
                          () => setVisible((value) => value + 50),
                          false,
                          busy,
                        )}
                      {preview.items.length > 1000 && (
                        <Text style={[text, s.note, { color: p.muted }]}>
                          {t.batchLimit}
                        </Text>
                      )}
                    </>
                  )}
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                disabled={
                  busy || (preview.kind === "playlist" && !selection.size)
                }
                accessibilityState={{
                  disabled:
                    busy || (preview.kind === "playlist" && !selection.size),
                }}
                onPress={() => void start()}
                style={[
                  s.download,
                  {
                    backgroundColor: p.blue,
                    opacity:
                      busy || (preview.kind === "playlist" && !selection.size)
                        ? 0.5
                        : 1,
                  },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={p.onAccent} />
                ) : (
                  <Text
                    style={{
                      color: p.onAccent,
                      fontWeight: "700",
                      fontSize: 15,
                    }}
                  >
                    {preview.kind === "playlist"
                      ? rtl
                        ? `تنزيل المحدد (${selection.size})`
                        : `Download selected (${selection.size})`
                      : t.download}
                  </Text>
                )}
              </Pressable>
              <Text style={[text, s.note, { color: p.muted }]}>
                {rtl
                  ? "يستمر التنزيل في الخلفية. تابع تقدّمه من الإشعارات."
                  : "Downloads continue in the background. Follow progress in notifications."}
              </Text>
            </>
          )}
          {error && (
            <View style={{ gap: 12 }}>
              <Text
                accessibilityRole="alert"
                style={[text, { color: p.error }]}
              >
                {error.includes("Facebook") ? error.includes("limiting") ? t.facebookRateLimited : /no downloadable/.test(error) ? t.facebookNoVideo : t.facebookUnavailable : error.includes("Instagram") ? error.includes("limiting") ? t.instagramRateLimited : /no downloadable|selected.*unavailable/.test(error) ? t.instagramNoVideo : t.instagramUnavailable : error.includes("requires sign-in") ? t.xUnavailable : /X post has no downloadable|X video has no downloadable|selected video/.test(error) ? t.xNoVideo : error.includes("X is limiting") ? t.xRateLimited : preview ? t.error : t.preparationFailed}
              </Text>
              {!busy &&
                button(t.retry, () =>
                  preview ? void start() : setAttempt((v) => v + 1),
                )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#00000066",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#988b8866",
    alignSelf: "center",
    marginBottom: 10,
  },
  heading: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  brand: { fontSize: 20, fontWeight: "800" },
  close: { padding: 12 },
  content: { padding: 16, gap: 14 },
  loading: { padding: 30, gap: 16, alignItems: "center" },
  details: { gap: 12, alignItems: "center" },
  thumb: { width: 96, height: 62, borderRadius: 12 },
  title: { fontSize: 14, fontWeight: "700" },
  label: { fontWeight: "600", fontSize: 13 },
  options: { gap: 8, flexWrap: "wrap" },
  choice: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  download: {
    borderRadius: 13,
    padding: 13,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  note: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  selector: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 44,
    alignItems: "center",
    gap: 8,
  },
  playlistItem: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    gap: 10,
    alignItems: "center",
    minHeight: 60,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  itemThumb: { width: 64, height: 42, borderRadius: 6 },
});
