import React from "react";
import { Image, View } from "react-native";

export type IconName =
  | "github"
  | "home"
  | "library"
  | "download"
  | "settings"
  | "more"
  | "close"
  | "search"
  | "check"
  | "chevron"
  | "trash"
  | "play"
  | "plus"
  | "globe"
  | "sun"
  | "moon"
  | "system"
  | "folder"
  | "share"
  | "retry"
  | "link";
export function Icon({
  name,
  color,
  size = 22,
}: {
  name: IconName;
  color: string;
  size?: number;
}) {
  // Pre-rendered continuous paths avoid seams between rotated native Views.
  const artwork = {
    retry: require("./assets/retry.png"),
    github: require("./assets/github.png"),
    settings: require("./assets/settings.png"),
    sun: require("./assets/sun.png"),
    moon: require("./assets/moon.png"),
    system: require("./assets/system.png"),
  };
  if (name in artwork) {
    return (
      <Image
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        source={artwork[name as keyof typeof artwork]}
        style={{ width: size, height: size, tintColor: color }}
        resizeMode="contain"
      />
    );
  }
  const line = (x: number, y: number, a: number, b: number, key: string) => {
    const length = Math.hypot(a - x, b - y);
    return (
      <View
        key={key}
        style={{
          position: "absolute",
          left: (x + a) / 2 - length / 2,
          top: (y + b) / 2 - 0.85,
          width: length,
          height: 1.7,
          borderRadius: 1,
          backgroundColor: color,
          transform: [
            { rotate: `${(Math.atan2(b - y, a - x) * 180) / Math.PI}deg` },
          ],
        }}
      />
    );
  };
  const lines = (points: number[][]) =>
    points.map((p, i) => line(p[0], p[1], p[2], p[3], String(i)));
  const box = (x: number, y: number, w: number, h: number, r = 3) => (
    <View
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderWidth: 1.7,
        borderColor: color,
        borderRadius: r,
      }}
    />
  );
  let shape;
  switch (name) {
    case "home":
      shape = (
        <>
          {lines([
            [3, 11, 12, 3],
            [12, 3, 21, 11],
            [6, 10, 6, 21],
            [6, 21, 18, 21],
            [18, 21, 18, 10],
            [10, 21, 10, 15],
            [10, 15, 14, 15],
            [14, 15, 14, 21],
          ])}
        </>
      );
      break;
    case "library":
      shape = (
        <>
          {box(4, 3, 16, 18)}
          {lines([
            [9, 8, 16, 12],
            [16, 12, 9, 16],
            [9, 16, 9, 8],
          ])}
        </>
      );
      break;
    case "play":
      shape = (
        <>
          {lines([
            [8, 5, 19, 12],
            [19, 12, 8, 19],
            [8, 19, 8, 5],
          ])}
        </>
      );
      break;
    case "download":
      shape = (
        <>
          {lines([
            [12, 3, 12, 15],
            [7, 10, 12, 15],
            [12, 15, 17, 10],
            [4, 16, 4, 21],
            [4, 21, 20, 21],
            [20, 21, 20, 16],
          ])}
        </>
      );
      break;
    case "more":
      shape = (
        <>
          {[5, 12, 19].map((y) => (
            <View
              key={y}
              style={{
                position: "absolute",
                left: 10.5,
                top: y - 1.5,
                width: 3,
                height: 3,
                borderRadius: 2,
                backgroundColor: color,
              }}
            />
          ))}
        </>
      );
      break;
    case "close":
      shape = lines([
        [6, 6, 18, 18],
        [6, 18, 18, 6],
      ]);
      break;
    case "plus":
      shape = lines([
        [12, 5, 12, 19],
        [5, 12, 19, 12],
      ]);
      break;
    case "search":
      shape = (
        <>
          {box(3, 3, 14, 14, 7)}
          {lines([[15, 15, 21, 21]])}
        </>
      );
      break;
    case "check":
      shape = lines([
        [5, 12, 10, 17],
        [10, 17, 20, 6],
      ]);
      break;
    case "chevron":
      shape = lines([
        [9, 5, 16, 12],
        [16, 12, 9, 19],
      ]);
      break;
    case "trash":
      shape = (
        <>
          {box(6, 7, 12, 14, 2)}
          {lines([
            [4, 6, 20, 6],
            [9, 3, 15, 3],
            [10, 10, 10, 17],
            [14, 10, 14, 17],
          ])}
        </>
      );
      break;
    case "globe":
      shape = (
        <>
          {box(3, 3, 18, 18, 9)}
          {box(8, 3, 8, 18, 4)}
          {lines([[3, 12, 21, 12]])}
        </>
      );
      break;
    case "folder":
      shape = (
        <>
          {box(3, 7, 18, 14)}
          {lines([
            [3, 7, 3, 4],
            [3, 4, 10, 4],
            [10, 4, 13, 7],
          ])}
        </>
      );
      break;
    case "share":
      shape = (
        <>
          {box(4, 12, 16, 9, 2)}
          {lines([
            [12, 15, 12, 3],
            [8, 7, 12, 3],
            [12, 3, 16, 7],
          ])}
        </>
      );
      break;
    case "link":
      shape = (
        <>
          {box(3, 9, 12, 7, 4)}
          {box(9, 5, 12, 7, 4)}
        </>
      );
      break;
  }
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, direction: "ltr" }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          transform: [{ scale: size / 24 }],
          transformOrigin: "top left",
        }}
      >
        {shape}
      </View>
    </View>
  );
}
