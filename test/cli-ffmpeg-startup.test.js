import test from "node:test";
import assert from "node:assert/strict";
import prompts from "../apps/cli/functions/prompts.js";
import {
  mediaTools,
  offerFFmpegAtStartup,
} from "../apps/cli/functions/ffmpeg.js";
import { home } from "../apps/cli/functions/readInput.js";

test("CLI skips startup setup and hides the menu action when FFmpeg is available", async (t) => {
  const original = prompts.prompt;
  const resolve = mediaTools.resolve;
  const descriptors = [process.stdin, process.stdout].map((stream) =>
    Object.getOwnPropertyDescriptor(stream, "isTTY"),
  );
  [process.stdin, process.stdout].forEach((stream) =>
    Object.defineProperty(stream, "isTTY", { value: true, configurable: true }),
  );
  t.after(() => {
    prompts.prompt = original;
    mediaTools.resolve = resolve;
    [process.stdin, process.stdout].forEach((stream, i) =>
      descriptors[i]
        ? Object.defineProperty(stream, "isTTY", descriptors[i])
        : delete stream.isTTY,
    );
  });
  mediaTools.resolve = async () => "ffmpeg";
  let questions = 0;
  prompts.prompt = async ([question]) => {
    questions++;
    assert.equal(question.name, "action");
    assert.equal(
      question.choices.some((choice) => choice.value === "ffmpeg"),
      false,
    );
    return { action: "exit" };
  };
  await offerFFmpegAtStartup();
  assert.equal(questions, 0);
  assert.equal(await home(), "exit");
  assert.equal(questions, 1);
});
test("missing FFmpeg is offered at startup with Yes selected and declining keeps the menu usable", async (t) => {
  const original = prompts.prompt;
  const resolve = mediaTools.resolve;
  const descriptors = [process.stdin, process.stdout].map((stream) =>
    Object.getOwnPropertyDescriptor(stream, "isTTY"),
  );
  [process.stdin, process.stdout].forEach((stream) =>
    Object.defineProperty(stream, "isTTY", { value: true, configurable: true }),
  );
  t.after(() => {
    prompts.prompt = original;
    mediaTools.resolve = resolve;
    [process.stdin, process.stdout].forEach((stream, i) =>
      descriptors[i]
        ? Object.defineProperty(stream, "isTTY", descriptors[i])
        : delete stream.isTTY,
    );
  });
  mediaTools.resolve = async () => null;
  let questions = 0;
  prompts.prompt = async ([question]) => {
    questions++;
    if (question.name === "install") {
      assert.equal(question.default, true);
      return { install: false };
    }
    assert.equal(
      question.choices.some((choice) => choice.value === "ffmpeg"),
      true,
    );
    return { action: "exit" };
  };
  await offerFFmpegAtStartup();
  assert.equal(await home(), "exit");
  assert.equal(questions, 2);
  await offerFFmpegAtStartup();
  assert.equal(questions, 2, "No repeated prompt during the same session");
});
