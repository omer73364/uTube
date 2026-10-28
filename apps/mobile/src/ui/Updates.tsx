import React, { useEffect, useState } from 'react';
import { Alert, AppState, Pressable, Text, View } from 'react-native';
import { downloads } from '../native';
import type { UpdateState } from '../../../../packages/core/update-types';
import { updateCopy } from '../../../../packages/core/update-copy.js';

type Colors = { surface: string; line: string; text: string; muted: string; blue: string; error: string };
export default function Updates({ language, full, colors: c }: { language: 'en' | 'ar'; full: boolean; colors: Colors }) {
  const [state, setState] = useState<UpdateState>();
  const [hidden, setHidden] = useState<string>();
  const copy = updateCopy[language];
  useEffect(() => {
    let active = true, checking = false, lastCheck = 0, prior = '';
    const refresh = async () => {
      if (AppState.currentState !== 'active' || checking) return;
      checking = true;
      try {
        const value = Date.now() - lastCheck > 6 * 60 * 60 * 1000 ? await downloads.checkUpdates() : await downloads.updates();
        lastCheck = lastCheck || Date.now();
        if (Date.now() - lastCheck > 6 * 60 * 60 * 1000) lastCheck = Date.now();
        if (active) setState(value);
        const blocked = value.services.filter(rule => ['unavailable', 'retired'].includes(rule.state)).map(rule => rule.provider).sort().join(',');
        if (prior && prior !== blocked) void downloads.resume().catch(() => {});
        prior = blocked;
      } catch { /* Snapshot errors never interfere with downloads. */ }
      finally { checking = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 1500);
    const listener = AppState.addEventListener('change', value => { if (value === 'active') void refresh(); });
    return () => { active = false; clearInterval(timer); listener.remove(); };
  }, []);
  if (!state) return null;
  const key = `${state.release?.version}/${state.phase}`;
  const notices = state.services.filter(rule => rule.state !== 'available');
  if (!full && !notices.length && (!state.release || hidden === key)) return null;
  const busy = ['checking', 'downloading', 'waiting', 'installing'].includes(state.phase);
  const action = async (task: Promise<UpdateState>) => {
    try { setState(await task); } catch { setState(old => old && { ...old, error: 'install' }); }
  };
  const button = (title: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 12, opacity: disabled ? 0.5 : 1 }}><Text style={{ color: c.blue, fontWeight: '600', textAlign: 'auto' }}>{title}</Text></Pressable>;
  const install = () => Alert.alert(copy.ready, copy.androidInstallerHelp, [
    { text: copy.later, style: 'cancel' },
    { text: copy.finish, onPress: () => void action(downloads.installUpdate(false)) },
    { text: copy.interrupt, style: 'destructive', onPress: () => void action(downloads.installUpdate(true)) },
  ]);
  const status = state.phase === 'checking' ? copy.checking : state.phase === 'downloading' ? `${copy.downloading} ${Math.floor(state.loaded / Math.max(1, state.total) * 100)}%` :
    state.phase === 'ready' ? copy.ready : state.phase === 'waiting' ? copy.waiting : state.phase === 'installing' ? copy.installing :
    state.phase === 'unconfigured' ? copy.unconfigured : state.release ? copy.available : state.phase === 'current' ? copy.current : '';
  return <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 17, padding: 18, gap: 12, marginBottom: 22 }}>
    {(full || state.release) && <>
      <Text accessibilityRole="header" style={{ color: c.text, fontWeight: '700', fontSize: 16, textAlign: 'auto' }}>{copy.title}{state.release ? ` · v${state.release.version}` : ''}</Text>
      <Text accessibilityLiveRegion="polite" style={{ color: c.muted, textAlign: 'auto' }}>{status}</Text>
      {state.error && <Text accessibilityRole="alert" style={{ color: c.error, textAlign: 'auto' }}>{state.error === 'check' ? copy.checkError : state.error === 'download' ? copy.downloadError : state.error === 'permission' ? copy.permission : copy.installError}</Text>}
      {full && state.release?.notes[language] && <Text style={{ color: c.text, textAlign: 'auto' }}>{state.release.notes[language]}</Text>}
      {full && button(copy.check, () => void action(downloads.checkUpdates()), busy || state.phase === 'unconfigured')}
      {state.release && ['available', 'error'].includes(state.phase) && button(copy.download, () => void action(downloads.downloadUpdate()))}
      {state.phase === 'ready' && button(copy.install, install)}
      {['downloading', 'waiting'].includes(state.phase) && button(copy.cancel, () => { void downloads.cancelUpdate().then(() => downloads.resume()).catch(() => {}); })}
      {!full && state.release && !busy && button(copy.later, () => setHidden(key))}
    </>}
    {notices.map(rule => <View key={rule.provider} style={{ borderLeftWidth: 3, borderLeftColor: c.blue, paddingHorizontal: 12, gap: 6 }}><Text style={{ color: c.text, fontWeight: '600' }}>{rule.provider === 'x' ? 'X' : rule.provider}</Text><Text style={{ color: c.muted, textAlign: 'auto' }}>{rule.message[language]}</Text></View>)}
    {full && !state.statusVerified && state.phase !== 'unconfigured' && <Text style={{ color: c.muted, textAlign: 'auto' }}>{copy.unknown}</Text>}
  </View>;
}
