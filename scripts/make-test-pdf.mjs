import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, '../public/test-pages.pdf');
const pageCount = 30;

/** @type {string[]} */
const objects = [];
const pageObjectIds = [];
const contentObjectIds = [];

for (let page = 1; page <= pageCount; page += 1) {
  const stream = `BT /F1 24 Tf 72 720 Td (Page ${page}) Tj ET`;
  contentObjectIds.push(objects.length + 1);
  objects.push(
    `${contentObjectIds.at(-1)} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`,
  );

  pageObjectIds.push(objects.length + 1);
  objects.push(
    `${pageObjectIds.at(-1)} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjectIds.at(-1)} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj`,
  );
}

const header = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [ ${pageObjectIds.map((id) => `${id} 0 R`).join(' ')} ] /Count ${pageCount} >>
endobj
3 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
`;

const body = `${header}${objects.join('\n')}\n`;
const xrefOffset = Buffer.byteLength(body, 'utf8');
const totalObjects = 3 + objects.length;
const xrefLines = [`xref`, `0 ${totalObjects}`, `0000000000 65535 f `];

let cursor = 0;
const chunks = body.split('\n');
let rebuilt = '';
for (const line of chunks) {
  if (/^\d+ 0 obj$/.test(line)) {
    xrefLines.push(`${String(cursor).padStart(10, '0')} 00000 n `);
  }
  rebuilt += `${line}\n`;
  cursor = Buffer.byteLength(rebuilt, 'utf8');
}

const trailer = `trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${body}${trailer}`);

console.log(`Wrote ${outPath} (${pageCount} pages)`);
