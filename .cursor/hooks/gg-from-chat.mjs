#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  promptHasGg, readStdinBuffer, setGg, workspaceRoot, writeJson,
} from "./gg-paths.mjs";

function extractPrompt(payload) {
  if (!payload || typeof payload !== "object") return "";
  for (const k of ["prompt", "content", "text", "message", "user_prompt"]) {
    if (typeof payload[k] === "string") return payload[k];
  }
  return "";
}

/** @param {unknown} mode */
export function normalizeComposerMode(mode) {
  const m = String(mode ?? "").trim().toLowerCase();
  if (!m) return "";
  if (m === "plan" || m.includes("plan")) return "plan";
  if (m === "agent" || m.includes("agent")) return "agent";
  if (m === "ask" || m.includes("ask")) return "ask";
  if (m === "edit" || m.includes("edit")) return "edit";
  return m;
}

try {
  const rawBuf = await readStdinBuffer();
  let rawText = rawBuf.toString("utf8");
  if (rawText.charCodeAt(0) === 0xfeff) rawText = rawText.slice(1);

  let payload = {};
  try {
    payload = rawText.trim() ? JSON.parse(rawText) : {};
  } catch {
    payload = {};
  }

  const root = workspaceRoot(payload);
  const prompt = extractPrompt(payload);
  const composerMode = normalizeComposerMode(payload.composer_mode);
  const saidGg = promptHasGg(prompt, rawBuf);
  const gateOn = composerMode === "plan" ? saidGg : true;
  setGg(root, gateOn);

  try {
    fs.writeFileSync(
      path.resolve(root, ".cursor", "hooks", "last-gg-from-chat.json"),
      JSON.stringify({
        at: new Date().toISOString(),
        on: gateOn,
        saidGg,
        composer_mode: payload.composer_mode ?? null,
        composerMode,
        root,
        promptPreview: prompt.slice(0, 200),
        promptHex: Buffer.from(prompt, "utf8").toString("hex").slice(0, 120),
        rawHexHead: rawBuf.toString("hex").slice(0, 240),
        payloadKeys: payload && typeof payload === "object" ? Object.keys(payload) : [],
        workspace_roots: payload.workspace_roots || null,
        cwd: payload.cwd || null,
      }, null, 2),
      "utf8",
    );
  } catch {}
} catch (err) {
  try { process.stderr.write("gg-from-chat: " + String(err && err.stack ? err.stack : err) + "\n"); } catch {}
}
writeJson({ continue: true });