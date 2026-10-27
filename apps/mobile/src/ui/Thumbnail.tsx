import React, { memo, useEffect, useState } from "react";
import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Icon } from "./Icon";
import { safeMediaThumbnail } from '../../../../packages/core/media-source.js';
export const Thumbnail = memo(function Thumbnail({
  videoId,
  thumbnail,
  style,
  tint,
  accent,
}: {
  videoId?: string;
  thumbnail?: string;
  style?: StyleProp<ViewStyle>;
  tint: string;
  accent: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [videoId, thumbnail]);
  const valid = !!videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId);
  const source = safeMediaThumbnail(thumbnail) || (valid ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined);
  return (
    <View
      accessible={false}
      style={[
        {
          aspectRatio: 16 / 9,
          overflow: "hidden",
          borderRadius: 12,
          backgroundColor: tint,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Icon name="play" size={26} color={accent} />
      {source && !failed && (
        <Image
          source={{ uri: source }}
          resizeMode="cover"
          onError={() => setFailed(true)}
          style={StyleSheet.absoluteFill}
          accessible={false}
        />
      )}
    </View>
  );
});
