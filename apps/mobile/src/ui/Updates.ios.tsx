import React, { useEffect, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { downloads } from '../native';
import type { UpdateState } from '../../../../packages/core/update-types';
import type { light } from './theme';
export default function Updates({ language, full, colors, placement }: {
  language: 'en' | 'ar'; full: boolean; colors: typeof light;
  hasCurrentDownload?: boolean; placement?: 'banner' | 'settings';
}) {
  const [state, setState] = useState<UpdateState>();
  useEffect(() => {
    let mounted = true, checking = false, lastCheck = 0;
    const refresh = async () => {
      if (checking || AppState.currentState !== 'active') return;
      checking = true;
      try {
        const check = Date.now() - lastCheck > 6 * 60 * 60 * 1000;
        const value = await (check ? downloads.checkUpdates() : downloads.updates());
        if (check) lastCheck = Date.now();
        if (mounted) setState(value);
      } catch { /* Cached signed notices remain available if the network is down. */ }
      finally { checking = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    const listener = AppState.addEventListener('change', value => { if (value === 'active') void refresh(); });
    return () => { mounted = false; clearInterval(timer); listener.remove(); };
  }, []);
  if ((placement === 'banner' && full) || (placement === 'settings' && !full)) return null;
  const notices = state?.services.filter(rule => rule.state !== 'available') ?? [];
  if (!full && !notices.length) return null;
  const rtl = language === 'ar';
  const text = { color: colors.muted, fontSize: 12, lineHeight: 19, writingDirection: rtl ? 'rtl' as const : 'ltr' as const };
  return <View style={{ marginTop: full ? 22 : 0, marginBottom: full ? 0 : 22, gap: 12, direction: rtl ? 'rtl' : 'ltr' }}>
    {full && <>
      <Text style={text}>{rtl ? 'تُسلَّم تحديثات iOS عبر قناة توزيع Apple المستخدمة لتثبيت التطبيق.' : 'iOS updates are delivered through the Apple distribution channel used to install this app.'}</Text>
      <Pressable accessibilityRole="button" disabled={state?.phase === 'checking'} onPress={() => { void downloads.checkUpdates().then(setState).catch(() => {}); }} style={{ padding: 14, borderRadius: 12, backgroundColor: colors.soft }}>
        <Text style={[text, { color: colors.text }]}>{rtl ? 'التحقق من حالة الخدمات' : 'Check service status'}</Text>
      </Pressable>
      {state?.error && <Text style={text}>{rtl ? 'تعذّر التحقق من حالة الخدمات. حاول لاحقاً.' : 'Could not check service status. Please try again later.'}</Text>}
    </>}
    {notices.map(rule => <View key={rule.provider} style={{ padding: 14, borderRadius: 12, borderStartWidth: 3, borderColor: colors.blue, backgroundColor: colors.tint }}>
      <Text style={[text, { color: colors.text, fontWeight: '700' }]}>{rule.provider === 'x' ? 'X' : rule.provider}</Text>
      <Text style={text}>{rule.message[language]}</Text>
    </View>)}
  </View>;
}
