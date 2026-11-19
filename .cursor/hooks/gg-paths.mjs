import path from "node:path";
import fs from "node:fs";

export const GG = String.fromCharCode(0x3131, 0x3131);
const GG_UTF8 = Buffer.from([0xe3, 0x84, 0xb1, 0xe3, 0x84, 0xb1]);
const GG_CP949 = Buffer.from([0xa4, 0xa1, 0xa4, 0xa1]);
const GG_JSON_ESC = "\\u3131\\u3131";
const GG_MOJIBAKE = new Set(["긱꽦", "?긱꽦", "湲깃쉐", "?湲깃쉐"]);

export function normalizeFsPath(input) {
  let p = String(input || "").trim();
  if (!p) return "";
  if (/^file:/i.test(p)) {
    p = decodeURIComponent(p.replace(/^file:\/\//i, ""));
    if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
  }
  p = p.replace(/^[/\\]+([A-Za-z]:)/, "$1");
  p = path.resolve(p);
  p = p.replace(/^([A-Za-z]:)[/\\]\1([/\\]|$)/i, "$1$2");
  return p;
}

export function workspaceRoot(payload) {
  const candidates = [
    ...(Array.isArray(payload?.workspace_roots) ? payload.workspace_roots : []),
    payload?.cwd,
    process.cwd(),
  ];
  for (const c of candidates) {
    const p = normalizeFsPath(c);
    if (!p) continue;
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return path.resolve(process.cwd());
}

export function gateDir(root) {
  return path.resolve(root, ".cursor", "gates");
}

export function ggPath(root) {
  return path.resolve(gateDir(root), GG);
}

export function hasGg(root) {
  try { return fs.existsSync(ggPath(root)); } catch { return false; }
}

export function setGg(root, on) {
  const dir = gateDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const p = ggPath(root);
  if (on) fs.writeFileSync(p, "chat\n", "utf8");
  else {
    try { fs.unlinkSync(p); } catch {}
  }
}

function bufferHasNeedle(buf, needle) {
  return buf.indexOf(needle) !== -1;
}

export function promptHasGg(prompt, rawBuf) {
  const s = String(prompt || "");
  if (s.includes(GG)) return true;
  if (GG_MOJIBAKE.has(s.trim())) return true;
  try {
    const fixed = Buffer.from(s, "latin1").toString("utf8");
    if (fixed.includes(GG)) return true;
  } catch {}

  const buf = Buffer.isBuffer(rawBuf)
    ? rawBuf
    : Buffer.from(String(rawBuf || ""), "utf8");
  if (bufferHasNeedle(buf, GG_UTF8)) return true;
  if (bufferHasNeedle(buf, GG_CP949)) return true;
  const asText = buf.toString("utf8");
  if (asText.includes(GG) || asText.includes(GG_JSON_ESC)) return true;
  try {
    if (Buffer.from(asText, "latin1").toString("utf8").includes(GG)) return true;
  } catch {}
  return false;
}

export function targetPath(toolInput) {
  if (!toolInput || typeof toolInput !== "object") return "";
  return String(toolInput.path || toolInput.file_path || toolInput.target_notebook || "");
}

export function isGgMarkerPath(filePath, root) {
  if (!filePath) return false;
  const abs = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(root, filePath);
  return abs === path.resolve(ggPath(root));
}

export function commandTouchesGg(command) {
  const c = String(command || "");
  if (!c) return false;
  if (!(/[\\/]\.cursor[\\/]gates\b/i.test(c) || /\.cursor[\\/]gates\b/i.test(c))) return false;
  return c.includes(GG) || /\b(New-Item|Set-Content|Add-Content|Out-File|Copy-Item|echo|touch|writeFileSync|WriteAllText)\b/i.test(c);
}

export function deny(user_message, agent_message) {
  return { permission: "deny", user_message, agent_message };
}

export function allow() {
  return { permission: "allow" };
}

export async function readStdinBuffer() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function readStdinText() {
  const buf = await readStdinBuffer();
  let text = buf.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

export async function readStdinJson() {
  const text = await readStdinText();
  if (!text.trim()) return {};
  return JSON.parse(text);
}

export function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}
