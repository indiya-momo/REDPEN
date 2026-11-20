#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  allow, deny, hasGg, isGgMarkerPath, readStdinJson,
  targetPath, workspaceRoot, writeJson,
} from "./gg-paths.mjs";

function readLastChat(root) {
  try {
    const p = path.resolve(root, ".cursor", "hooks", "last-gg-from-chat.json");
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** @param {unknown} mode */
function isPlanMode(mode) {
  const m = String(mode ?? "").trim().toLowerCase();
  return m === "plan" || m.includes("plan");
}

try {
  const payload = await readStdinJson();
  const root = workspaceRoot(payload);
  const target = targetPath(payload.tool_input);
  if (isGgMarkerPath(target, root)) {
    writeJson(deny(
      "채팅에 고고만 해 주세요.",
      "Blocked: approval is chat go-word only.",
    ));
    process.exit(0);
  }

  const last = readLastChat(root);
  const mode = last?.composerMode ?? last?.composer_mode ?? payload.composer_mode;
  if (!isPlanMode(mode)) {
    writeJson(allow());
    process.exit(0);
  }

  if (!hasGg(root)) {
    writeJson(deny(
      "쓰기 차단: 계획 모드에서는 이번 메시지에 고고가 필요합니다.",
      "Edit blocked in plan mode: user did not say go-word in this prompt.",
    ));
    process.exit(0);
  }
  writeJson(allow());
} catch (err) {
  writeJson(deny(
    "hook error: " + String(err && err.message ? err.message : err),
    String(err && err.stack ? err.stack : err),
  ));
}