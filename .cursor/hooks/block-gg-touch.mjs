#!/usr/bin/env node
import { allow, commandTouchesGg, deny, readStdinBuffer, writeJson } from "./gg-paths.mjs";
try {
  const raw = await readStdinBuffer();
  let text = raw.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  let payload = {};
  try {
    payload = text.trim() ? JSON.parse(text) : {};
  } catch {
    writeJson(allow());
    process.exit(0);
  }
  const command = payload.command || (payload.tool_input && payload.tool_input.command) || "";
  if (commandTouchesGg(command)) {
    writeJson(deny(
      "게이트 파일 셸 조작 금지. 채팅 고고만.",
      "Shell blocked: chat go-word only.",
    ));
    process.exit(0);
  }
  writeJson(allow());
} catch {
  writeJson(allow());
}
