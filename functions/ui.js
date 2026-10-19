import cliProgress from "cli-progress";
import ora from "ora";
import { stripVTControlCharacters } from "node:util";
import { version } from "../version.js";

export const interactive = () => Boolean(process.stdin.isTTY && process.stdout.isTTY);
const color = (code, value) => process.stdout.isTTY && !Object.hasOwn(process.env, "NO_COLOR")
  ? `\x1b[${code}m${value}\x1b[0m` : String(value);
export const accent = (value) => color("36", value);
export const muted = (value) => color("90", value);
export const bold = (value) => color("1", value);
// Remote titles must not inject terminal control sequences or extra prompt lines.
export const text = (value) => stripVTControlCharacters(String(value ?? "")).replace(/[\x00-\x1f\x7f-\x9f]/g, " ");
export const bytes = (value) => {
  if (!Number.isFinite(value) || value < 0) return "—";
  const unit = Math.min(Math.floor(Math.log2(Math.max(1, value)) / 10), 3);
  return `${(value / 1024 ** unit).toFixed(unit ? 1 : 0)} ${["B", "KB", "MB", "GB"][unit]}`;
};
const violet = (value) => color("95", value);
const border = (value) => color("38;5;104", value);
const badge = (code, label) => color(`${code};1`, ` ${label} `);
const columns = () => Math.max(16, Math.min(76, (process.stdout.columns || 80) - 4));
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const cells = (value) => [...segmenter.segment(stripVTControlCharacters(String(value)))].map(({ segment }) => {
  const point = segment.codePointAt(0);
  const wide = /\p{Emoji_Presentation}|\uFE0F/u.test(segment) || point >= 0x1100 && (
    point <= 0x115f || point >= 0x2e80 && point <= 0xa4cf || point >= 0xac00 && point <= 0xd7a3 ||
    point >= 0xf900 && point <= 0xfaff || point >= 0xfe10 && point <= 0xfe6f ||
    point >= 0xff01 && point <= 0xff60 || point >= 0x20000
  );
  return { segment, width: wide ? 2 : 1 };
});
const width = (value) => cells(value).reduce((sum, cell) => sum + cell.width, 0);
const wrap = (value, limit) => {
  const lines = [];
  let line = "", used = 0;
  for (const cell of cells(text(value))) {
    if (used + cell.width > limit) { lines.push(line); line = ""; used = 0; }
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
  const row = (line, paint = (value) => value) => console.log(`  ${border("│")} ${paint(line)}${" ".repeat(Math.max(0, inner - width(line)))} ${border("│")}`);
  console.log(`  ${border(`╭${"─".repeat(inner + 2)}╮`)}`);
  if (title) {
    for (const line of wrap(title, inner)) row(line, (value) => bold(accent(value)));
    console.log(`  ${border(`├${"─".repeat(inner + 2)}┤`)}`);
  }
  for (const line of lines) for (const part of wrap(line, inner)) row(part);
  console.log(`  ${border(`╰${"─".repeat(inner + 2)}╯`)}
`);
};

export const info = (message) => console.log(`  ${accent("◆")} ${text(message)}`);
export const success = (message) => console.log(`\n  ${badge("42;30", "DONE")} ${text(message)}\n`);
export const warning = (message) => console.log(`  ${badge("43;30", "NOTE")} ${text(message)}`);
export const failure = (message) => console.error(`\n  ${badge("41;97", "ERROR")} ${text(message)}\n`);
export const heading = (title) => {
  console.log(`\n  ${violet("◆")} ${bold(text(title))}`);
  if (process.stdout.isTTY) console.log(`  ${border("─".repeat(columns()))}`);
};
export const details = (rows) => panel("", rows.map(([label, value]) => `${label.padEnd(10)} ${text(value)}`));
export const banner = () => {
  console.log();
  if (!process.stdout.isTTY) { console.log(`  uTube v${version}\n`); return; }
  panel(`▶  uTube   /   v${version}`, [
    "Your next watch, ready to go.",
    "", "VIDEOS  /  PLAYLISTS  /  MP3",
  ]);
  console.log(`  ${muted("↑ ↓ navigate   ↵ select   Ctrl+C exit")}\n`);
};
export const promptOptions = { prefix: accent("◆"), pageSize: 9 };

export const task = async (label, work) => {
  const spinner = ora({ text: label, color: "cyan", isEnabled: interactive() }).start();
  if (!interactive()) info(label);
  try { const result = await work(); spinner.stop(); return result; }
  catch (error) { spinner.stop(); throw error; }
};

export const createTransferDisplay = (label, total) => {
  if (!interactive()) { info(label); return { update() {}, stop() {} }; }
  let loaded = 0;
  const started = Date.now();
  const known = Number.isFinite(total) && total > 0;
  const bar = known ? new cliProgress.SingleBar({
    format: (process.stdout.columns || 80) < 70
      ? `  ${accent("{bar}")} {percentage}%  {speed}`
      : `  ${border("│")} ${accent("{bar}")} ${bold("{percentage}%")}  {amount}  ${muted("{speed} · {eta_formatted}")}`,
    barsize: Math.max(8, Math.min(22, (process.stdout.columns || 80) - 64)),
    hideCursor: true, clearOnComplete: true, stream: process.stdout,
    barCompleteChar: "█", barIncompleteChar: "░",
  }) : null;
  const spinner = !known ? ora({ text: label, color: "cyan" }).start() : null;
  if (bar) { info(label); bar.start(total, 0, { amount: `0 B / ${bytes(total)}`, speed: "—" }); }
  return {
    update(value) {
      loaded = value;
      const speed = `${bytes(loaded / Math.max((Date.now() - started) / 1000, 0.1))}/s`;
      if (bar) bar.update(Math.min(total, loaded), { amount: `${bytes(loaded)} / ${bytes(total)}`, speed });
      else spinner.text = `${label} · ${bytes(loaded)} · ${speed}`;
    },
    stop() { bar?.stop(); spinner?.stop(); },
  };
};

export const transfer = async (label, total, work) => {
  const display = createTransferDisplay(label, total);
  try { return await work((loaded) => display.update(loaded)); }
  finally { display.stop(); }
};
