import React, { memo, useEffect, useState } from "react";
import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Icon } from "./Icon";
export const Thumbnail = memo(function Thumbnail({
  videoId,
  style,
  tint,
  accent,
}: {
  videoId?: string;
  style?: StyleProp<ViewStyle>;
  tint: string;
  accent: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [videoId]);
  const valid = !!videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId);
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
      {valid && !failed && (
        <Image
          source={{ uri: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` }}
          resizeMode="cover"
          onError={() => setFailed(true)}
          style={StyleSheet.absoluteFill}
          accessible={false}
        />
      )}
    </View>
  );
});
