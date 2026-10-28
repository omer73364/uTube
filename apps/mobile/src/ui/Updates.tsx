import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { downloads } from '../native';
import type { UpdateState } from '../../../../packages/core/update-types';
import { Icon, type IconName } from './Icon';
import type { light } from './theme';
import { updateCopy } from '../../../../packages/core/update-copy.js';

type Colors = typeof light;
export default function Updates({ language, full, colors: c, hasCurrentDownload = false, placement }: { language: 'en' | 'ar'; full: boolean; colors: Colors; hasCurrentDownload?: boolean; placement?: 'banner' | 'settings' }) {
  const [state, setState] = useState<UpdateState>();
  const [hidden, setHidden] = useState<string>();
  const copy = updateCopy[language];
  useEffect(() => {
    let active = true, checking = false, lastCheck = 0, prior = '';
    const refresh = async () => {
      if (AppState.currentState !== 'active' || checking) return;
      checking = true;
      try {
        const value = placement !== 'settings' && Date.now() - lastCheck > 6 * 60 * 60 * 1000 ? await downloads.checkUpdates() : await downloads.updates();
        lastCheck = lastCheck || Date.now();
        if (Date.now() - lastCheck > 6 * 60 * 60 * 1000) lastCheck = Date.now();
        if (active) setState(value);
        const blocked = value.services.filter(rule => ['unavailable', 'retired'].includes(rule.state)).map(rule => rule.provider).sort().join(',');
        if (placement !== 'settings' && prior && prior !== blocked) void downloads.resume().catch(() => {});
        prior = blocked;
      } catch { /* Snapshot errors never interfere with downloads. */ }
      finally { checking = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 1500);
    const listener = AppState.addEventListener('change', value => { if (value === 'active') void refresh(); });
    return () => { active = false; clearInterval(timer); listener.remove(); };
  }, [placement]);
  if (!state || (placement === 'banner' && full) || (placement === 'settings' && !full)) return null;
  const key = `${state.release?.version}/${state.phase}`;
  const notices = state.services.filter(rule => rule.state !== 'available');
  if (!full && !notices.length && (!state.release || hidden === key)) return null;
  const busy = ['checking', 'downloading', 'waiting', 'installing'].includes(state.phase);
  const action = async (task: Promise<UpdateState>) => {
    try { setState(await task); } catch { setState(old => old && { ...old, error: 'install' }); }
  };
  const rtl = language === 'ar';
  const text = { textAlign: 'auto' as const, writingDirection: rtl ? 'rtl' as const : 'ltr' as const };
  const button = (title: string, onPress: () => void, disabled = false, primary = false, icon: IconName = 'retry') => (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: primary ? c.blue : c.soft, borderColor: primary ? c.blue : c.line, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}>
      <Icon name={icon} size={17} color={primary ? c.onAccent : c.text} />
      <Text style={[styles.buttonText, text, { color: primary ? c.onAccent : c.text }]}>{title}</Text>
    </Pressable>
  );
  const install = async () => {
    let current = hasCurrentDownload;
    try { current = (await downloads.list()).some(job => ['preparing', 'running', 'merging', 'converting', 'publishing'].includes(job.status)); } catch { /* Use the latest parent snapshot if history cannot be read. */ }
    Alert.alert(copy.ready, copy.androidInstallerHelp, [
      { text: copy.later, style: 'cancel' },
      { text: current ? copy.finish : copy.install, onPress: () => void action(downloads.installUpdate(false)) },
      ...(current ? [{ text: copy.interrupt, style: 'destructive' as const, onPress: () => void action(downloads.installUpdate(true)) }] : []),
    ]);
  };
  const status = state.phase === 'checking' ? copy.checking : state.phase === 'downloading' ? `${copy.downloading} ${Math.floor(state.loaded / Math.max(1, state.total) * 100)}%` :
    state.phase === 'ready' ? copy.ready : state.phase === 'waiting' ? copy.waiting : state.phase === 'installing' ? copy.installing :
    state.phase === 'unconfigured' ? copy.unconfigured : state.release ? copy.available : state.phase === 'current' ? copy.current : '';
  const progress = Math.min(1, Math.max(0, state.loaded / Math.max(1, state.total)));
  return <View style={{ direction: rtl ? 'rtl' : 'ltr', marginBottom: full ? 0 : 22 }}>
    {full && <Text style={[styles.sectionLabel, text, { color: c.muted }]}>{copy.title}</Text>}
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      {(full || state.release) && <>
        {(state.release || !['idle', 'error'].includes(state.phase)) && <View style={styles.statusRow}>
          <Text accessibilityLiveRegion="polite" style={[styles.description, text, { color: c.muted, flex: 1 }]}>{state.release ? `${status} · v${state.release.version}` : status}</Text>
          {state.phase === 'checking' && <ActivityIndicator size="small" color={c.blue} />}
        </View>}
        {state.phase === 'downloading' && <View accessible accessibilityRole="progressbar" accessibilityLabel={copy.downloading} accessibilityValue={{ min: 0, max: 100, now: Math.floor(progress * 100) }} style={[styles.track, { backgroundColor: c.soft }]}><View style={{ height: 5, width: `${progress * 100}%`, backgroundColor: c.blue, borderRadius: 3 }} /></View>}
        {full && state.release?.notes[language] && <View style={[styles.notes, { backgroundColor: c.soft }]}><Text style={[styles.notesTitle, text, { color: c.text }]}>{copy.notes}</Text><Text style={[styles.description, text, { color: c.muted }]}>{state.release.notes[language]}</Text></View>}
        <View style={styles.actions}>
          {full && button(copy.check, () => void action(downloads.checkUpdates()), busy || state.phase === 'unconfigured', !state.release)}
          {state.release && ['available', 'error'].includes(state.phase) && button(copy.download, () => void action(downloads.downloadUpdate()), false, true, 'download')}
          {state.phase === 'ready' && button(copy.install, () => void install(), false, true, 'download')}
          {['downloading', 'waiting'].includes(state.phase) && button(copy.cancel, () => { void downloads.cancelUpdate().then(() => downloads.resume()).catch(() => {}); }, false, false, 'close')}
          {!full && state.release && !busy && button(copy.later, () => setHidden(key), false, false, 'close')}
        </View>
        {state.error && <Text accessibilityRole="alert" style={[styles.description, text, { color: c.error }]}>{state.error === 'check' ? copy.checkError : state.error === 'download' ? copy.downloadError : state.error === 'permission' ? copy.permission : copy.installError}</Text>}
      </>}
      {notices.map(rule => <View key={rule.provider} style={[styles.notice, { borderColor: c.blue, backgroundColor: c.tint }]}><Text style={[styles.notesTitle, text, { color: c.text }]}>{rule.provider === 'x' ? 'X' : rule.provider}</Text><Text style={[styles.description, text, { color: c.muted }]}>{rule.message[language]}</Text></View>)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  sectionLabel: { fontSize: 12, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  card: { borderWidth: 1, borderRadius: 17, padding: 16, gap: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  description: { fontSize: 12, lineHeight: 19 },
  notesTitle: { fontSize: 12, fontWeight: '700', lineHeight: 19 },
  notes: { padding: 12, borderRadius: 12, gap: 5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderRadius: 12, flexGrow: 1, flexShrink: 1, minHeight: 44 },
  buttonText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  notice: { borderStartWidth: 3, borderRadius: 10, padding: 12, gap: 5 },
});
