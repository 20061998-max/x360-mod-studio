import type { ModProject } from '../types/modding';
import {
  createZipArchive,
  isIgnoredSystemFile,
  type DroppedFileWithPath,
  type ZipInputEntry,
} from './autoOrganizer';

export type EditGameFileStatus = 'original' | 'replaced' | 'added' | 'removed';

export interface EditGameEntry {
  id: string;
  relativePath: string;
  fileName: string;
  status: EditGameFileStatus;
  originalSize: number;
  originalFile?: File;
  originalBytes?: Uint8Array;
  newSize?: number;
  newFile?: File;
  newBytes?: Uint8Array;
  matchedBy?: 'caminho-exato' | 'nome-arquivo' | 'manual' | 'novo-arquivo';
}

export function normalizeGameRelativePath(
  rawPath: string,
  stripFirstFolder: boolean
): string {
  const cleaned = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length === 0) return '';
  if (stripFirstFolder && parts.length > 1) {
    return parts.slice(1).join('/');
  }
  return parts.join('/');
}

export function detectSharedRootPrefix(items: DroppedFileWithPath[]): boolean {
  const paths = items.map((i) => i.relativePath.replace(/\\/g, '/').replace(/^\/+/, ''));
  if (paths.length === 0) return false;
  const firstSegments = new Set(
    paths.filter((p) => p.includes('/')).map((p) => p.split('/')[0])
  );
  // If every item with a slash shares the exact same top folder (selected folder name), strip that wrapper folder
  return firstSegments.size === 1 && paths.every((p) => p.includes('/'));
}

export function buildOriginalEntries(
  items: DroppedFileWithPath[],
  stripRootFolder = true
): EditGameEntry[] {
  const shouldStrip = stripRootFolder && detectSharedRootPrefix(items);
  const byPath = new Map<string, EditGameEntry>();

  items.forEach((item, idx) => {
    if (isIgnoredSystemFile(item.file.name)) return;
    const rel =
      normalizeGameRelativePath(item.relativePath || item.file.name, shouldStrip) ||
      item.file.name;
    const key = rel.toLowerCase();
    byPath.set(key, {
      id: `orig-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      relativePath: rel,
      fileName: item.file.name,
      status: 'original',
      originalSize: item.file.size,
      originalFile: item.file,
    });
  });

  return Array.from(byPath.values()).sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath)
  );
}

export interface OverlayApplyResult {
  entries: EditGameEntry[];
  replacedCount: number;
  addedCount: number;
}

export function applyOverlayFiles(
  current: EditGameEntry[],
  overlayItems: DroppedFileWithPath[],
  matchByFileNameFallback: boolean
): OverlayApplyResult {
  const validOverlay = overlayItems.filter((i) => !isIgnoredSystemFile(i.file.name));
  if (validOverlay.length === 0) {
    return { entries: current, replacedCount: 0, addedCount: 0 };
  }

  const shouldStrip = detectSharedRootPrefix(validOverlay);
  const next = current.map((e) => ({ ...e }));

  // Build lookup indexes
  const pathIndex = new Map<string, number>();
  const fileNameIndex = new Map<string, number[]>();

  next.forEach((entry, idx) => {
    pathIndex.set(entry.relativePath.toLowerCase(), idx);
    const fname = entry.fileName.toLowerCase();
    const list = fileNameIndex.get(fname) ?? [];
    list.push(idx);
    fileNameIndex.set(fname, list);
  });

  let replacedCount = 0;
  let addedCount = 0;

  for (let i = 0; i < validOverlay.length; i++) {
    const item = validOverlay[i];
    const rel =
      normalizeGameRelativePath(item.relativePath || item.file.name, shouldStrip) ||
      item.file.name;
    const relLower = rel.toLowerCase();
    const nameLower = item.file.name.toLowerCase();

    // 1. Exact relative path match
    if (pathIndex.has(relLower)) {
      const idx = pathIndex.get(relLower)!;
      const target = next[idx];
      next[idx] = {
        ...target,
        status: target.originalSize > 0 || target.originalFile || target.originalBytes ? 'replaced' : 'added',
        newSize: item.file.size,
        newFile: item.file,
        newBytes: undefined,
        matchedBy: 'caminho-exato',
      };
      if (next[idx].status === 'replaced') replacedCount++;
      continue;
    }

    // 2. Filename match fallback (e.g., user dropped loose replacement file onto game)
    if (matchByFileNameFallback && fileNameIndex.has(nameLower)) {
      const candidates = fileNameIndex.get(nameLower)!;
      // Match the first candidate (or all if single match; prioritize exact suffix if multiple)
      let chosenIdx = candidates[0];
      if (candidates.length > 1 && relLower.includes('/')) {
        const suffixMatch = candidates.find((cIdx) =>
          next[cIdx].relativePath.toLowerCase().endsWith(relLower)
        );
        if (suffixMatch !== undefined) chosenIdx = suffixMatch;
      }
      const target = next[chosenIdx];
      next[chosenIdx] = {
        ...target,
        status: 'replaced',
        newSize: item.file.size,
        newFile: item.file,
        newBytes: undefined,
        matchedBy: 'nome-arquivo',
      };
      replacedCount++;
      continue;
    }

    // 3. New file to add into game
    const newEntry: EditGameEntry = {
      id: `add-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      relativePath: rel,
      fileName: item.file.name,
      status: 'added',
      originalSize: 0,
      newSize: item.file.size,
      newFile: item.file,
      matchedBy: 'novo-arquivo',
    };
    const newIdx = next.length;
    next.push(newEntry);
    pathIndex.set(relLower, newIdx);
    const list = fileNameIndex.get(nameLower) ?? [];
    list.push(newIdx);
    fileNameIndex.set(nameLower, list);
    addedCount++;
  }

  next.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return { entries: next, replacedCount, addedCount };
}

export async function buildMergedGameZip(
  entries: EditGameEntry[],
  onlyChanged: boolean,
  onProgress?: (done: number, total: number) => void
): Promise<{ zipBytes: Uint8Array; includedCount: number }> {
  const included = entries.filter((entry) => {
    if (entry.status === 'removed') return false;
    if (onlyChanged) {
      return entry.status === 'replaced' || entry.status === 'added';
    }
    return true;
  });

  const zipInputs: ZipInputEntry[] = [];
  for (let i = 0; i < included.length; i++) {
    const entry = included[i];
    let bytes: Uint8Array;
    if (entry.status === 'replaced' || entry.status === 'added') {
      if (entry.newBytes) {
        bytes = entry.newBytes;
      } else if (entry.newFile) {
        bytes = new Uint8Array(await entry.newFile.arrayBuffer());
      } else {
        bytes = new Uint8Array(0);
      }
    } else {
      if (entry.originalBytes) {
        bytes = entry.originalBytes;
      } else if (entry.originalFile) {
        bytes = new Uint8Array(await entry.originalFile.arrayBuffer());
      } else {
        bytes = new Uint8Array(0);
      }
    }

    zipInputs.push({
      path: entry.relativePath,
      data: bytes,
    });
    onProgress?.(i + 1, included.length);
  }

  return {
    zipBytes: createZipArchive(zipInputs),
    includedCount: zipInputs.length,
  };
}

export function buildEditGameReportTxt(
  project: ModProject,
  entries: EditGameEntry[]
): string {
  const replaced = entries.filter((e) => e.status === 'replaced');
  const added = entries.filter((e) => e.status === 'added');
  const removed = entries.filter((e) => e.status === 'removed');
  const kept = entries.filter((e) => e.status === 'original');

  const lines: string[] = [
    '============================================================',
    `RELATORIO EDIT GAME - ${project.gameTitle} (${project.titleId})`,
    '============================================================',
    `Projeto: ${project.name} ${project.patchVersion}`,
    `Pasta alvo no console: ${project.installTarget}`,
    `Data: ${new Date().toLocaleString('pt-BR')}`,
    '',
    `Resumo:`,
    `- Substituidos por arquivos novos: ${replaced.length}`,
    `- Adicionados (arquivos novos): ${added.length}`,
    `- Mantidos originais: ${kept.length}`,
    `- Removidos da exportacao: ${removed.length}`,
    '',
  ];

  if (replaced.length > 0) {
    lines.push('[ARQUIVOS SUBSTITUIDOS]');
    replaced.forEach((e) => {
      lines.push(`- ${e.relativePath} (${e.originalSize} B -> ${e.newSize ?? 0} B)`);
    });
    lines.push('');
  }

  if (added.length > 0) {
    lines.push('[ARQUIVOS ADICIONADOS]');
    added.forEach((e) => {
      lines.push(`+ ${e.relativePath} (${e.newSize ?? 0} B)`);
    });
    lines.push('');
  }

  if (removed.length > 0) {
    lines.push('[ARQUIVOS REMOVIDOS]');
    removed.forEach((e) => {
      lines.push(`x ${e.relativePath}`);
    });
    lines.push('');
  }

  lines.push('Como aplicar no Xbox 360:');
  lines.push('Extraia o .ZIP gerado e cole o conteudo dentro da pasta do jogo no HD interno ou pendrive.');

  return lines.join('\n');
}

export function createSampleEditGameSession(): {
  originals: EditGameEntry[];
  updated: EditGameEntry[];
} {
  const enc = new TextEncoder();
  const baseBytes = {
    xex: new Uint8Array([0x58, 0x45, 0x58, 0x32, 0x00, 0x00, 0x00, 0x01]),
    db: enc.encode('ROSTER_2018_ORIG_DATA_V1'),
    handling: enc.encode('; Original handling\nCAR_STD 1500.0 4.2 70\n'),
    tex: new Uint8Array([0x44, 0x44, 0x53, 0x20, 0x7c, 0x00, 0x00, 0x00]),
    audio: enc.encode('XMA_COMMENTARY_ORIG'),
  };

  const originals: EditGameEntry[] = [
    {
      id: 'smp-1',
      relativePath: 'default.xex',
      fileName: 'default.xex',
      status: 'original',
      originalSize: baseBytes.xex.length,
      originalBytes: baseBytes.xex,
    },
    {
      id: 'smp-2',
      relativePath: 'data/db/players.bin',
      fileName: 'players.bin',
      status: 'original',
      originalSize: baseBytes.db.length,
      originalBytes: baseBytes.db,
    },
    {
      id: 'smp-3',
      relativePath: 'common/data/handling.cfg',
      fileName: 'handling.cfg',
      status: 'original',
      originalSize: baseBytes.handling.length,
      originalBytes: baseBytes.handling,
    },
    {
      id: 'smp-4',
      relativePath: 'textures/kits_home.dds',
      fileName: 'kits_home.dds',
      status: 'original',
      originalSize: baseBytes.tex.length,
      originalBytes: baseBytes.tex,
    },
    {
      id: 'smp-5',
      relativePath: 'sound/narracao.xma',
      fileName: 'narracao.xma',
      status: 'original',
      originalSize: baseBytes.audio.length,
      originalBytes: baseBytes.audio,
    },
  ];

  const newDb = enc.encode('ROSTER_2026_ATUALIZADO_ELENCO_NOVO');
  const newHandling = enc.encode('; Handling atualizado\nCAR_GT3 1380.0 6.1 95\n');
  const newExtra = enc.encode('SCRIPT_CUSTOM_MOD_V2');

  const updated: EditGameEntry[] = originals.map((item) => {
    if (item.relativePath === 'data/db/players.bin') {
      return {
        ...item,
        status: 'replaced',
        newSize: newDb.length,
        newBytes: newDb,
        matchedBy: 'caminho-exato',
      };
    }
    if (item.relativePath === 'common/data/handling.cfg') {
      return {
        ...item,
        status: 'replaced',
        newSize: newHandling.length,
        newBytes: newHandling,
        matchedBy: 'nome-arquivo',
      };
    }
    return item;
  });

  updated.push({
    id: 'smp-6',
    relativePath: 'mods/custom_weapons.gsc',
    fileName: 'custom_weapons.gsc',
    status: 'added',
    originalSize: 0,
    newSize: newExtra.length,
    newBytes: newExtra,
    matchedBy: 'novo-arquivo',
  });

  return { originals, updated };
}
