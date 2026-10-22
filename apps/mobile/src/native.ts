import { NativeModules } from "react-native";
import type { Job } from "./domain";
export const downloads = NativeModules.UTubeDownloads as {
  sha1(input: string): Promise<string>;
  start(
    url: string,
    id: string,
    title: string,
    quality: string,
  ): Promise<number>;
  list(): Promise<Job[]>;
  cancel(id: number): Promise<void>;
  open(id: number): Promise<void>;
  settings(): Promise<{
    language: "en" | "ar";
    theme: "light" | "dark" | "system";
  }>;
  saveSettings(
    language: "en" | "ar",
    theme: "light" | "dark" | "system",
  ): Promise<void>;
};
