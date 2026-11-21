import {
  BinaryDiffChunk,
  HexPatchRule,
  HexValueType,
  X360JsonPatchFile,
  X360JsonPatchRecord,
} from '../types/modding';

const IPS_HEADER = [0x50, 0x41, 0x54, 0x43, 0x48]; // "PATCH"
const IPS_EOF = [0x45, 0x4f, 0x46]; // "EOF"
const IPS_MAX_OFFSET = 0xffffff; // ~16 MB
const IPS_EOF_MAGIC = 0x454f46;

export function formatHexOffset(offset: number, pad = 8): string {
  return '0x' + offset.toString(16).toUpperCase().padStart(pad, '0');
}

export function parseHexOffset(input: string): number | null {
  const cleaned = input.trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]+$/.test(cleaned)) return null;
  const num = Number.parseInt(cleaned, 16);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

export function bytesToHexString(bytes: Uint8Array, separator = ' '): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(separator);
}

export function hexStringToBytes(hexStr: string): Uint8Array | null {
  const cleaned = hexStr.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
  if (cleaned.length === 0 || cleaned.length % 2 !== 0) return null;
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToAsciiPreview(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
    .join('');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function triggerBinaryDownload(data: Uint8Array | string, fileName: string, mime = 'application/octet-stream'): void {
  let blobPart: BlobPart;
  if (typeof data === 'string') {
    blobPart = data;
  } else {
    const bufferCopy = new ArrayBuffer(data.byteLength);
    new Uint8Array(bufferCopy).set(data);
    blobPart = bufferCopy;
  }
  const blob = new Blob([blobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface RawDiffSpan {
  offset: number;
  bytes: Uint8Array;
  originalBytes: Uint8Array;
}

function collectDiffSpans(original: Uint8Array, modified: Uint8Array, mergeGap = 6): RawDiffSpan[] {
  const maxLen = Math.max(original.length, modified.length);
  const spans: RawDiffSpan[] = [];

  let i = 0;
  while (i < maxLen) {
    const origByte = i < original.length ? original[i] : 0;
    const modByte = i < modified.length ? modified[i] : 0;

    if (origByte !== modByte) {
      const start = i;
      let end = i + 1;
      let unchangedStreak = 0;

      while (end < maxLen) {
        const o = end < original.length ? original[end] : 0;
        const m = end < modified.length ? modified[end] : 0;
        if (o !== m) {
          unchangedStreak = 0;
        } else {
          unchangedStreak++;
          if (unchangedStreak > mergeGap) {
            break;
          }
        }
        end++;
      }

      // Trim trailing unchanged bytes inside gap
      const actualEnd = end - unchangedStreak;
      const chunkLen = actualEnd - start;
      const modSlice = new Uint8Array(chunkLen);
      const origSlice = new Uint8Array(chunkLen);
      for (let k = 0; k < chunkLen; k++) {
        const pos = start + k;
        modSlice[k] = pos < modified.length ? modified[pos] : 0;
        origSlice[k] = pos < original.length ? original[pos] : 0;
      }

      spans.push({ offset: start, bytes: modSlice, originalBytes: origSlice });
      i = actualEnd;
    } else {
      i++;
    }
  }

  return spans;
}

export function buildBinaryDiff(
  original: Uint8Array,
  modified: Uint8Array
): {
  ipsBytes: Uint8Array | null;
  exceedsIpsLimit: boolean;
  chunks: BinaryDiffChunk[];
  totalChangedBytes: number;
} {
  const spans = collectDiffSpans(original, modified);
  const chunks: BinaryDiffChunk[] = [];
  let totalChangedBytes = 0;
  let exceedsIpsLimit = modified.length > IPS_MAX_OFFSET;

  const ipsOutput: number[] = [...IPS_HEADER];

  for (const span of spans) {
    let cursor = 0;
    while (cursor < span.bytes.length) {
      let recordOffset = span.offset + cursor;
      let maxRecordLen = Math.min(0xffff, span.bytes.length - cursor);

      // Guard IPS magic EOF offset (0x454F46) by shifting start 1 byte back if needed
      if (recordOffset === IPS_EOF_MAGIC && recordOffset > 0) {
        recordOffset -= 1;
        cursor = Math.max(0, cursor - 1);
        maxRecordLen = Math.min(0xffff, span.bytes.length - cursor);
      }

      if (recordOffset > IPS_MAX_OFFSET) {
        exceedsIpsLimit = true;
      }

      const slice = span.bytes.slice(cursor, cursor + maxRecordLen);
      const origSlice = span.originalBytes.slice(cursor, cursor + maxRecordLen);

      const firstByte = slice[0];
      const isUniform = slice.length >= 8 && slice.every((b) => b === firstByte);

      totalChangedBytes += slice.length;
      chunks.push({
        offset: recordOffset,
        length: slice.length,
        originalHex: bytesToHexString(origSlice.slice(0, 16)) + (origSlice.length > 16 ? ' ...' : ''),
        modifiedHex: bytesToHexString(slice.slice(0, 16)) + (slice.length > 16 ? ' ...' : ''),
        asciiPreview: bytesToAsciiPreview(slice.slice(0, 24)),
        isRle: isUniform,
      });

      if (!exceedsIpsLimit) {
        ipsOutput.push((recordOffset >> 16) & 0xff, (recordOffset >> 8) & 0xff, recordOffset & 0xff);
        if (isUniform) {
          ipsOutput.push(0x00, 0x00);
          ipsOutput.push((slice.length >> 8) & 0xff, slice.length & 0xff);
          ipsOutput.push(firstByte);
        } else {
          ipsOutput.push((slice.length >> 8) & 0xff, slice.length & 0xff);
          for (let j = 0; j < slice.length; j++) {
            ipsOutput.push(slice[j]);
          }
        }
      }

      cursor += maxRecordLen;
    }
  }

  ipsOutput.push(...IPS_EOF);

  return {
    ipsBytes: exceedsIpsLimit ? null : new Uint8Array(ipsOutput),
    exceedsIpsLimit,
    chunks,
    totalChangedBytes,
  };
}

export function applyIpsPatch(
  original: Uint8Array,
  ipsBytes: Uint8Array
): { patched: Uint8Array; recordCount: number } {
  if (ipsBytes.length < 8) {
    throw new Error('Arquivo IPS inválido ou corrompido (tamanho insuficiente).');
  }
  const header = String.fromCharCode(...ipsBytes.slice(0, 5));
  if (header !== 'PATCH') {
    throw new Error('Cabeçalho IPS inválido: esperado "PATCH".');
  }

  const ops: Array<{ offset: number; data: Uint8Array }> = [];
  let maxRequiredSize = original.length;
  let pos = 5;

  while (pos + 3 <= ipsBytes.length) {
    // Check EOF marker
    if (
      ipsBytes[pos] === 0x45 &&
      ipsBytes[pos + 1] === 0x4f &&
      ipsBytes[pos + 2] === 0x46
    ) {
      pos += 3;
      // Optional 3-byte truncation size after EOF
      if (pos + 3 === ipsBytes.length) {
        maxRequiredSize = (ipsBytes[pos] << 16) | (ipsBytes[pos + 1] << 8) | ipsBytes[pos + 2];
      }
      break;
    }

    if (pos + 5 > ipsBytes.length) {
      throw new Error('Registro IPS truncado antes do marcador EOF.');
    }

    const offset = (ipsBytes[pos] << 16) | (ipsBytes[pos + 1] << 8) | ipsBytes[pos + 2];
    const size = (ipsBytes[pos + 3] << 8) | ipsBytes[pos + 4];
    pos += 5;

    if (size === 0) {
      // RLE record
      if (pos + 3 > ipsBytes.length) {
        throw new Error('Registro RLE IPS inválido.');
      }
      const rleSize = (ipsBytes[pos] << 8) | ipsBytes[pos + 1];
      const rleByte = ipsBytes[pos + 2];
      pos += 3;
      const data = new Uint8Array(rleSize).fill(rleByte);
      ops.push({ offset, data });
      if (offset + rleSize > maxRequiredSize) maxRequiredSize = offset + rleSize;
    } else {
      if (pos + size > ipsBytes.length) {
        throw new Error('Dados do registro IPS ultrapassam o final do arquivo.');
      }
      const data = ipsBytes.slice(pos, pos + size);
      pos += size;
      ops.push({ offset, data });
      if (offset + size > maxRequiredSize) maxRequiredSize = offset + size;
    }
  }

  const out = new Uint8Array(maxRequiredSize);
  out.set(original.slice(0, Math.min(original.length, maxRequiredSize)));

  for (const op of ops) {
    out.set(op.data, op.offset);
  }

  return { patched: out, recordCount: ops.length };
}

export function buildJsonPatchPackage(
  original: Uint8Array,
  modified: Uint8Array,
  meta: X360JsonPatchFile['metadata']
): X360JsonPatchFile {
  const spans = collectDiffSpans(original, modified, 4);
  const records: X360JsonPatchRecord[] = spans.map((span) => ({
    offset: span.offset,
    originalHex: bytesToHexString(span.originalBytes, ''),
    modifiedHex: bytesToHexString(span.bytes, ''),
  }));

  return {
    format: 'x360-patch-v1',
    createdAt: new Date().toISOString(),
    metadata: meta,
    records,
  };
}

export function applyJsonPatchPackage(
  original: Uint8Array,
  pkg: X360JsonPatchFile
): { patched: Uint8Array; recordCount: number } {
  if (pkg.format !== 'x360-patch-v1' || !Array.isArray(pkg.records)) {
    throw new Error('Arquivo de patch JSON inválido para X360 Mod Studio.');
  }

  let targetSize = Math.max(original.length, pkg.metadata?.modifiedSize ?? original.length);
  for (const rec of pkg.records) {
    const bytes = hexStringToBytes(rec.modifiedHex);
    if (!bytes) throw new Error(`Hex inválido no offset ${formatHexOffset(rec.offset)}.`);
    if (rec.offset + bytes.length > targetSize) {
      targetSize = rec.offset + bytes.length;
    }
  }

  const out = new Uint8Array(targetSize);
  out.set(original.slice(0, Math.min(original.length, targetSize)));

  for (const rec of pkg.records) {
    const bytes = hexStringToBytes(rec.modifiedHex);
    if (bytes) {
      out.set(bytes, rec.offset);
    }
  }

  return { patched: out, recordCount: pkg.records.length };
}

export function encodeHexRuleBytes(type: HexValueType, value: string): Uint8Array {
  switch (type) {
    case 'hex': {
      const parsed = hexStringToBytes(value);
      if (!parsed) {
        throw new Error('Hex inválido. Use pares como "63 00 FF" ou "6300FF".');
      }
      return parsed;
    }
    case 'ascii': {
      const bytes = new Uint8Array(value.length);
      for (let i = 0; i < value.length; i++) {
        bytes[i] = value.charCodeAt(i) & 0xff;
      }
      return bytes;
    }
    case 'utf16be': {
      const bytes = new Uint8Array(value.length * 2);
      for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        bytes[i * 2] = (code >> 8) & 0xff;
        bytes[i * 2 + 1] = code & 0xff;
      }
      return bytes;
    }
    case 'int16be': {
      const n = Number.parseInt(value, 10);
      if (!Number.isFinite(n) || n < -32768 || n > 32767) {
        throw new Error('Int16 deve estar entre -32768 e 32767.');
      }
      const buf = new ArrayBuffer(2);
      new DataView(buf).setInt16(0, n, false);
      return new Uint8Array(buf);
    }
    case 'uint16be': {
      const n = Number.parseInt(value, 10);
      if (!Number.isFinite(n) || n < 0 || n > 65535) {
        throw new Error('UInt16 deve estar entre 0 e 65535.');
      }
      const buf = new ArrayBuffer(2);
      new DataView(buf).setUint16(0, n, false);
      return new Uint8Array(buf);
    }
    case 'int32be': {
      const n = Number.parseInt(value, 10);
      if (!Number.isFinite(n) || n < -2147483648 || n > 2147483647) {
        throw new Error('Int32 deve ser um inteiro de 32 bits válido.');
      }
      const buf = new ArrayBuffer(4);
      new DataView(buf).setInt32(0, n, false);
      return new Uint8Array(buf);
    }
    case 'uint32be': {
      const n = Number.parseInt(value, 10);
      if (!Number.isFinite(n) || n < 0 || n > 4294967295) {
        throw new Error('UInt32 deve estar entre 0 e 4294967295.');
      }
      const buf = new ArrayBuffer(4);
      new DataView(buf).setUint32(0, n, false);
      return new Uint8Array(buf);
    }
    case 'float32be': {
      const n = Number.parseFloat(value.replace(',', '.'));
      if (!Number.isFinite(n)) {
        throw new Error('Float32 inválido.');
      }
      const buf = new ArrayBuffer(4);
      new DataView(buf).setFloat32(0, n, false);
      return new Uint8Array(buf);
    }
    case 'int32le': {
      const n = Number.parseInt(value, 10);
      if (!Number.isFinite(n)) throw new Error('Int32 inválido.');
      const buf = new ArrayBuffer(4);
      new DataView(buf).setInt32(0, n, true);
      return new Uint8Array(buf);
    }
    case 'float32le': {
      const n = Number.parseFloat(value.replace(',', '.'));
      if (!Number.isFinite(n)) throw new Error('Float32 inválido.');
      const buf = new ArrayBuffer(4);
      new DataView(buf).setFloat32(0, n, true);
      return new Uint8Array(buf);
    }
  }
}

export function applyHexPatchRules(
  source: Uint8Array,
  rules: HexPatchRule[]
): { patched: Uint8Array; appliedCount: number; errors: string[] } {
  const out = new Uint8Array(source);
  let appliedCount = 0;
  const errors: string[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const offset = parseHexOffset(rule.offsetHex);
    if (offset === null) {
      errors.push(`Regra "${rule.name}": offset inválido (${rule.offsetHex}).`);
      continue;
    }
    try {
      const encoded = encodeHexRuleBytes(rule.type, rule.value);
      if (offset + encoded.length > out.length) {
        errors.push(
          `Regra "${rule.name}": ultrapassa o tamanho do arquivo (${formatHexOffset(offset)} + ${encoded.length}B > ${out.length}B).`
        );
        continue;
      }
      out.set(encoded, offset);
      appliedCount++;
    } catch (err) {
      errors.push(`Regra "${rule.name}": ${err instanceof Error ? err.message : 'erro ao codificar'}.`);
    }
  }

  return { patched: out, appliedCount, errors };
}

export interface DecodedOffsetValues {
  uint8: number;
  int16be: number | null;
  uint16be: number | null;
  int32be: number | null;
  uint32be: number | null;
  float32be: number | null;
  int32le: number | null;
  ascii16: string;
}

export function decodeBytesAtOffset(data: Uint8Array, offset: number): DecodedOffsetValues | null {
  if (offset < 0 || offset >= data.length) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const rem = data.length - offset;

  return {
    uint8: data[offset],
    int16be: rem >= 2 ? view.getInt16(offset, false) : null,
    uint16be: rem >= 2 ? view.getUint16(offset, false) : null,
    int32be: rem >= 4 ? view.getInt32(offset, false) : null,
    uint32be: rem >= 4 ? view.getUint32(offset, false) : null,
    float32be: rem >= 4 ? view.getFloat32(offset, false) : null,
    int32le: rem >= 4 ? view.getInt32(offset, true) : null,
    ascii16: bytesToAsciiPreview(data.slice(offset, Math.min(data.length, offset + 16))),
  };
}

export function searchInBinary(
  data: Uint8Array,
  query: string,
  mode: 'ascii' | 'utf16be' | 'hex' | 'int32be' | 'float32be'
): number[] {
  let needle: Uint8Array;
  try {
    if (mode === 'ascii') {
      needle = encodeHexRuleBytes('ascii', query);
    } else if (mode === 'utf16be') {
      needle = encodeHexRuleBytes('utf16be', query);
    } else if (mode === 'hex') {
      needle = encodeHexRuleBytes('hex', query);
    } else if (mode === 'int32be') {
      needle = encodeHexRuleBytes('int32be', query);
    } else {
      needle = encodeHexRuleBytes('float32be', query);
    }
  } catch {
    return [];
  }

  if (needle.length === 0 || needle.length > data.length) return [];

  const matches: number[] = [];
  const limit = data.length - needle.length;
  for (let i = 0; i <= limit; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (data[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      matches.push(i);
      if (matches.length >= 100) break;
    }
  }
  return matches;
}

export function createSampleFootballBinary(variant: 'original' | 'modified'): Uint8Array {
  const buf = new Uint8Array(512).fill(0);
  const view = new DataView(buf.buffer);

  const writeAscii = (offset: number, text: string, maxLen: number) => {
    for (let i = 0; i < maxLen; i++) {
      buf[offset + i] = i < text.length ? text.charCodeAt(i) & 0xff : 0;
    }
  };

  // Header
  writeAscii(0x00, 'X360FBDB', 8);
  view.setUint32(0x08, variant === 'original' ? 2013 : 2026, false); // Season year (Big-Endian)
  view.setFloat32(0x0c, variant === 'original' ? 1.0 : 1.15, false); // Game speed multiplier (Big-Endian)

  // League Name
  writeAscii(0x20, variant === 'original' ? 'LIGA_NACIONAL_13' : 'BRASILEIRAO_2026', 24);

  // Player 1 record at 0x50
  writeAscii(0x50, variant === 'original' ? 'JOGADOR_CLASSICO' : 'ESTEVAO_WILLIAN ', 20);
  view.setUint16(0x64, variant === 'original' ? 76 : 85, false); // Overall
  view.setUint16(0x66, variant === 'original' ? 29 : 19, false); // Age
  view.setUint8(0x68, variant === 'original' ? 10 : 41); // Shirt number

  // Player 2 record at 0x80
  writeAscii(0x80, variant === 'original' ? 'ATACANTE_RESERVA' : 'ENDRICK_FELIPE  ', 20);
  view.setUint16(0x94, variant === 'original' ? 73 : 84, false); // Overall
  view.setUint16(0x96, variant === 'original' ? 26 : 20, false); // Age
  view.setUint8(0x98, variant === 'original' ? 19 : 9); // Shirt number

  // Stadium Name at 0xC0
  writeAscii(0xc0, variant === 'original' ? 'ESTADIO_GENERICO_A' : 'ARENA_MARACANA_HD ', 24);

  return buf;
}
