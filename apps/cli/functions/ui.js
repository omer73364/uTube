import ora from "ora";
import { stripVTControlCharacters } from "node:util";
import { version } from "../../../version.js";

export const interactive = () =>
  Boolean(process.stdin.isTTY && process.stdout.isTTY);
const color = (code, value) =>
  process.stdout.isTTY && !Object.hasOwn(process.env, "NO_COLOR")
    ? `\x1b[${code}m${value}\x1b[0m`
    : String(value);
const accentCode = () =>
  /truecolor|24bit/i.test(process.env.COLORTERM || "")
    ? "38;2;221;59;32"
    : /256color/i.test(process.env.TERM || "")
      ? "38;5;203"
      : "91";
export const accent = (value) => color(accentCode(), value);
// Inquirer 8 uses cyan for selections and submitted answers. Repaint only that
// accent, preserving its green confirmations, yellow hints, and red errors.
export const paintPrompt = (value) => {
  if (typeof value !== "string") return value;
  if (!process.stdout.isTTY || Object.hasOwn(process.env, "NO_COLOR"))
    return stripVTControlCharacters(value);
  return value.replace(/\x1b\[(?:36|96)m/g, `\x1b[${accentCode()}m`);
};
export const muted = (value) => color("90", value);
export const bold = (value) => color("1", value);
// Remote titles must not inject terminal control sequences or extra prompt lines.
export const text = (value) =>
  stripVTControlCharacters(String(value ?? "")).replace(
    /[\x00-\x1f\x7f-\x9f]/g,
    " ",
  );
export const bytes = (value) => {
  if (!Number.isFinite(value) || value < 0) return "—";
  const unit = Math.min(Math.floor(Math.log2(Math.max(1, value)) / 10), 3);
  return `${(value / 1024 ** unit).toFixed(unit ? 1 : 0)} ${["B", "KB", "MB", "GB"][unit]}`;
};
const border = (value) =>
  color(
    /truecolor|24bit/i.test(process.env.COLORTERM || "")
      ? "38;2;155;81;75"
      : /256color/i.test(process.env.TERM || "")
        ? "38;5;131"
        : "31",
    value,
  );
const badge = (code, label) => color(`${code};1`, ` ${label} `);
const columns = () =>
  Math.max(16, Math.min(76, (process.stdout.columns || 80) - 4));
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const cells = (value) =>
  [...segmenter.segment(stripVTControlCharacters(String(value)))].map(
    ({ segment }) => {
      const point = segment.codePointAt(0);
      const wide =
        /\p{Emoji_Presentation}|\uFE0F/u.test(segment) ||
        (point >= 0x1100 &&
          (point <= 0x115f ||
            (point >= 0x2e80 && point <= 0xa4cf) ||
            (point >= 0xac00 && point <= 0xd7a3) ||
            (point >= 0xf900 && point <= 0xfaff) ||
            (point >= 0xfe10 && point <= 0xfe6f) ||
            (point >= 0xff01 && point <= 0xff60) ||
            point >= 0x20000));
      return { segment, width: wide ? 2 : 1 };
    },
  );
const width = (value) =>
  cells(value).reduce((sum, cell) => sum + cell.width, 0);
const wrap = (value, limit) => {
  const lines = [];
  let line = "",
    used = 0;
  for (const cell of cells(text(value))) {
    if (used + cell.width > limit) {
      lines.push(line);
      line = "";
      used = 0;
    }
    line += cell.segment;
    used += cell.width;
  }
  lines.push(line);
  return lines;
};

// Keep every row within the terminal width, including wide Unicode titles.
export const panel = (title, lines) => {
  if (!process.stdout.isTTY) {
    if (title) console.log(`  ${text(title)}`);
    for (const line of lines) console.log(`  ${text(line)}`);
    console.log();
    return;
  }
  const inner = columns() - 4;
  const row = (line, paint = (value) => value) =>
    console.log(
      `  ${border("│")} ${paint(line)}${" ".repeat(Math.max(0, inner - width(line)))} ${border("│")}`,
    );
  console.log(`  ${border(`╭${"─".repeat(inner + 2)}╮`)}`);
  if (title) {
    for (const line of wrap(title, inner))
      row(line, (value) => bold(accent(value)));
    console.log(`  ${border(`├${"─".repeat(inner + 2)}┤`)}`);
  }
  for (const line of lines) for (const part of wrap(line, inner)) row(part);
  console.log(`  ${border(`╰${"─".repeat(inner + 2)}╯`)}
`);
};

export const info = (message) =>
  console.log(`  ${accent("◆")} ${text(message)}`);
export const success = (message) =>
  console.log(`\n  ${badge("42;30", "DONE")} ${text(message)}\n`);
export const warning = (message) =>
  console.log(`  ${badge("43;30", "NOTE")} ${text(message)}`);
export const failure = (message) =>
  console.error(`\n  ${badge("41;97", "ERROR")} ${text(message)}\n`);
export const heading = (title) => {
  console.log(`\n  ${accent("◆")} ${bold(text(title))}`);
  if (process.stdout.isTTY) console.log(`  ${border("─".repeat(columns()))}`);
};
export const details = (rows) =>
  panel(
    "",
    rows.map(([label, value]) => `${label.padEnd(10)} ${text(value)}`),
  );
export const banner = () => {
  console.log();
  if (!process.stdout.isTTY) {
    console.log(`  uTube v${version}\n`);
    return;
  }
  panel(`▶  uTube   /   v${version}`, [
    "Your next watch, ready to go.",
    "",
    "VIDEOS  /  PLAYLISTS  /  MP3",
  ]);
  console.log(`  ${muted("↑ ↓ navigate   ↵ select   Ctrl+C exit")}\n`);
};
export const promptOptions = { prefix: accent("◆"), pageSize: 9 };

export const task = async (label, work) => {
  const spinner = ora({
    text: label,
    color: Object.hasOwn(process.env, "NO_COLOR") ? false : "red",
    isEnabled: interactive(),
  }).start();
  if (!interactive()) info(label);
  try {
    const result = await work();
    spinner.stop();
    return result;
  } catch (error) {
    spinner.stop();
    throw error;
  }
};

const shorten = (value, limit) => {
  let result = "",
    used = 0;
  for (const cell of cells(text(value))) {
    if (used + cell.width > limit - 1) return `${result}…`;
    result += cell.segment;
    used += cell.width;
  }
  return result;
};
export const duration = (value) => {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return "—";
  const seconds = Math.floor(Number(value));
  const minutes = Math.floor(seconds / 60);
  return `${minutes >= 60 ? `${Math.floor(minutes / 60)}:` : ""}${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};
export const videoCard = ({
  title,
  channel,
  seconds,
  views,
  audio,
  quality,
  size,
  folder,
  id,
}) => {
  const rows = [
    ...(channel ? [["Channel", channel]] : []),
    ...(Number(seconds) > 0 ? [["Duration", duration(seconds)]] : []),
    ...(views !== undefined && Number.isFinite(Number(views))
      ? [["Views", new Intl.NumberFormat("en").format(Number(views))]]
      : []),
    [
      "Format",
      audio
        ? "MP3 · 192 kbps"
        : `MP4${quality ? ` · ${quality}` : " · choose quality below"}`,
    ],
    ...(size ? [["Est. size", size]] : []),
    ["Save to", folder],
    ...(id && /^[\w-]{11}$/.test(id)
      ? [["Watch", `https://youtu.be/${id}`]]
      : []),
  ];
  panel(
    title || "Video",
    rows.map(([label, value]) => `${label.padEnd(10)} ${text(value)}`),
  );
};

export const createTransferDisplay = (
  initialLabel,
  initialTotal,
  { quiet = false } = {},
) => {
  if (!interactive()) {
    if (!quiet) info(initialLabel);
    return {
      update() {},
      stage(label) {
        info(label);
      },
      stop() {},
    };
  }
  let label = text(initialLabel),
    total = initialTotal,
    loaded = 0;
  let started = Date.now(),
    samples = [{ time: started, loaded: 0 }];
  let processing = false,
    stopped = false;
  const spinner = ora({
    text: label,
    prefixText: "  ",
    stream: process.stdout,
    color: Object.hasOwn(process.env, "NO_COLOR") ? false : "red",
    hideCursor: true,
  });
  const refresh = () => {
    if (stopped) return;
    const now = Date.now();
    const available = Math.max(8, (process.stdout.columns || 80) - 4);
    const known = Number.isFinite(total) && total > 0;
    const percent = known
      ? Math.min(100, Math.floor((loaded / total) * 100))
      : undefined;
    const sample =
      samples.find((point) => point.time >= now - 2500) || samples.at(-1);
    const speed =
      Math.max(0, loaded - sample.loaded) /
      Math.max((now - sample.time) / 1000, 0.1);
    const elapsed = Math.floor((now - started) / 1000);
    let bar, detail;
    if (processing) {
      bar = muted("Writing your file…");
      detail = `Elapsed ${elapsed ? duration(elapsed) : "00:00"}`;
    } else {
      if (known) {
        const length = Math.max(6, Math.min(44, available - 9));
        const filled = Math.floor(length * Math.min(1, loaded / total));
        bar = `${accent("━".repeat(filled))}${muted("─".repeat(length - filled))} ${bold(`${percent}%`.padStart(4))}`;
      } else bar = muted(loaded ? "Receiving data…" : "Waiting for data…");
      const rate = speed > 0 ? `${bytes(speed)}/s` : "— /s";
      const eta =
        known && speed > 0 && loaded < total
          ? `ETA ${duration(Math.max(1, Math.ceil((total - loaded) / speed)))}`
          : `Elapsed ${elapsed ? duration(elapsed) : "00:00"}`;
      detail =
        available < 48
          ? `${bytes(loaded)} · ${rate}`
          : `${bytes(loaded)}${known ? ` / ${bytes(total)}` : ""} · ${rate} · ${eta}`;
    }
    spinner.text = `${bold(shorten(label, available - 2))}\n    ${bar}\n    ${muted(shorten(detail, available))}`;
  };
  refresh();
  spinner.start();
  const timer = setInterval(refresh, 1000);
  timer.unref();
  return {
    update(value, nextTotal = total) {
      if (stopped) return;
      if (Number.isFinite(value)) loaded = Math.max(loaded, value);
      if (Number.isFinite(nextTotal) && nextTotal > 0) total = nextTotal;
      const now = Date.now();
      samples.push({ time: now, loaded });
      samples = samples.filter((point) => point.time >= now - 3000).slice(-100);
      refresh();
    },
    stage(nextLabel, nextTotal, options = {}) {
      label = text(nextLabel);
      total = nextTotal;
      loaded = 0;
      started = Date.now();
      samples = [{ time: started, loaded: 0 }];
      processing = !!options.processing;
      refresh();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      spinner.stop();
    },
  };
};

export const transfer = async (label, total, work) => {
  const display = createTransferDisplay(label, total);
  try {
    return await work((loaded) => display.update(loaded));
  } finally {
    display.stop();
  }
};
