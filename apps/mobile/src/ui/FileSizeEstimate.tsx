import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { describeSize, summarizeSizes, type SizeEstimates } from '../../../../packages/core/file-size.js';

type Props = {
  items: { sizeEstimates?: SizeEstimates }[];
  audio: boolean;
  quality: string;
  language: 'en' | 'ar';
  colors: { text: string; muted: string; line: string };
};

export default function FileSizeEstimate({ items, audio, quality, language, colors }: Props) {
  const size = describeSize(summarizeSizes(items, audio, quality), language);
  const align = language === 'ar' ? 'right' : 'left';
  return (
    <View style={[styles.container, { borderColor: colors.line }]} accessibilityLiveRegion="polite">
      <Text style={[styles.label, { color: colors.muted, textAlign: align }]}>{size.label}</Text>
      <Text style={[styles.value, { color: colors.text, textAlign: align }]}>{size.value}</Text>
      {!!size.help && <Text style={[styles.help, { color: colors.muted, textAlign: align }]}>{size.help}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, paddingVertical: 14, gap: 6, marginTop: 4 },
  label: { fontSize: 12 },
  value: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  help: { fontSize: 11, lineHeight: 17 },
});
