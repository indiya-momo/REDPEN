#!/usr/bin/env node
import {
  allow, deny, hasGg, isGgMarkerPath, readStdinJson,
  targetPath, workspaceRoot, writeJson,
} from "./gg-paths.mjs";
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
  if (!hasGg(root)) {
    writeJson(deny(
      "쓰기 차단: 이번 메시지에 고고 없음.",
      "Edit blocked: user did not say go-word in this prompt.",
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
