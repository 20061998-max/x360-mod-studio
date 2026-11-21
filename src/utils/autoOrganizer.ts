import { ModAssetCategory, ModProject } from '../types/modding';

export interface OrganizedModFile {
  id: string;
  fileName: string;
  sourceRelativePath: string;
  size: number;
  detectedFormat: string;
  category: ModAssetCategory;
  targetRelativePath: string;
  action: 'Substituir' | 'Aplicar Patch IPS/Hex' | 'Adicionar Novo';
  data: Uint8Array;
}

const IGNORED_SYSTEM_FILES = new Set(['desktop.ini', 'thumbs.db', '.ds_store']);

export function isIgnoredSystemFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return IGNORED_SYSTEM_FILES.has(lower) || lower.startsWith('._');
}

export interface DroppedFileWithPath {
  file: File;
  relativePath: string;
}

interface WebkitEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  file?: (success: (file: File) => void, error?: (err: unknown) => void) => void;
  createReader?: () => {
    readEntries: (
      success: (entries: WebkitEntryLike[]) => void,
      error?: (err: unknown) => void
    ) => void;
  };
}

async function readEntryRecursively(entry: WebkitEntryLike): Promise<DroppedFileWithPath[]> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => {
      entry.file!(resolve, reject);
    });
    const rel = entry.fullPath.replace(/^\/+/, '') || file.name;
    return [{ file, relativePath: rel }];
  }

  if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    const allEntries: WebkitEntryLike[] = [];

    // readEntries returns batches (typically up to 100 entries per call)
    while (true) {
      const batch = await new Promise<WebkitEntryLike[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
      if (!batch.length) break;
      allEntries.push(...batch);
    }

    const nested = await Promise.all(allEntries.map((child) => readEntryRecursively(child)));
    return nested.flat();
  }

  return [];
}

export async function extractFilesFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<DroppedFileWithPath[]> {
  const items = Array.from(dataTransfer.items || []);
  const entries: WebkitEntryLike[] = [];

  for (const item of items) {
    if (typeof item.webkitGetAsEntry === 'function') {
      const entry = item.webkitGetAsEntry() as unknown as WebkitEntryLike | null;
      if (entry) entries.push(entry);
    }
  }

  if (entries.length > 0) {
    const collected = await Promise.all(entries.map((entry) => readEntryRecursively(entry)));
    return collected.flat().filter((item) => !isIgnoredSystemFile(item.file.name));
  }

  return Array.from(dataTransfer.files || [])
    .filter((file) => !isIgnoredSystemFile(file.name))
    .map((file) => ({
      file,
      relativePath:
        (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    }));
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipInputEntry {
  path: string;
  data: Uint8Array;
}

export function createZipArchive(entries: ZipInputEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const now = new Date();
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((now.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((Math.max(1980, now.getFullYear()) - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);

  for (const entry of entries) {
    const cleanPath = entry.path.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    const nameBytes = encoder.encode(cleanPath);
    const fileCrc = crc32(entry.data);
    const size = entry.data.length;

    // Local File Header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // Version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // Compression: STORE (0)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, fileCrc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, entry.data);

    // Central Directory Header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, fileCrc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + size;
  }

  const centralSize = centralParts.reduce((acc, p) => acc + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalSize = offset + centralSize + eocd.length;
  const archive = new Uint8Array(totalSize);
  let cursor = 0;

  for (const part of localParts) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  archive.set(eocd, cursor);

  return archive;
}

function getGameFolderSegment(project: ModProject): string {
  const clean = project.gameTitle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `Games/${clean || 'Xbox360_Mod'}`;
}

function readMagicAscii(bytes: Uint8Array, length = 4): string {
  if (bytes.length < length) return '';
  return String.fromCharCode(...bytes.slice(0, length));
}

function stripTopUploadedFolder(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 1) return parts[0] || normalized;
  return parts.slice(1).join('/');
}

export function classifyModBytes(
  fileName: string,
  bytes: Uint8Array,
  project: ModProject,
  sourceRelativePath = fileName,
  preserveSubfolders = false
): Omit<OrganizedModFile, 'id'> {
  const lower = fileName.toLowerCase();
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : '';
  const magic4 = readMagicAscii(bytes, 4);
  const magic5 = readMagicAscii(bytes, 5);
  const gameRoot = getGameFolderSegment(project);
  const titleId = (project.titleId || '00000000').toUpperCase();

  let detectedFormat = ext ? `Arquivo .${ext.toUpperCase()}` : 'Arquivo Binário';
  let category: ModAssetCategory = 'Executável / Config';
  let targetRelativePath = `${gameRoot}/mods/${fileName}`;
  let action: OrganizedModFile['action'] = 'Adicionar Novo';

  const KNOWN_PLUGIN_XEX = new Set([
    'xbdm.xex',
    'jrpc2.xex',
    'jrpc.xex',
    'xrpc.xex',
    'rpc.xex',
    'proto.xex',
    'fsdplugin.xex',
    'aurora.xex',
  ]);

  // 1. Magic byte inspection (most reliable for Xbox 360)
  if (magic4 === 'XEX2' || ext === 'xex') {
    if (KNOWN_PLUGIN_XEX.has(lower) && lower !== 'aurora.xex') {
      detectedFormat = 'Plugin DashLaunch (.XEX)';
      category = 'Executável / Config';
      targetRelativePath = `Plugins/${fileName}`;
      action = 'Adicionar Novo';
    } else {
      detectedFormat = magic4 === 'XEX2' ? 'Executável Xbox 360 (XEX2)' : 'Executável .XEX';
      category = 'Executável / Config';
      targetRelativePath = `${gameRoot}/${fileName}`;
      action = 'Substituir';
    }
  } else if (
    magic4 === 'CON ' ||
    magic4 === 'LIVE' ||
    magic4 === 'PIRS' ||
    lower.startsWith('tu') ||
    sourceRelativePath.includes('00007000') ||
    sourceRelativePath.includes('000D0000')
  ) {
    const isTu = lower.startsWith('tu') || lower.includes('update');
    const isGod = sourceRelativePath.includes('00007000');
    const isXbla = sourceRelativePath.includes('000D0000');
    const subFolder = isTu ? '000B0000' : isGod ? '00007000' : isXbla ? '000D0000' : '00000002';
    detectedFormat = `Pacote Xbox 360 (${magic4.trim() || (isGod ? 'GOD' : isXbla ? 'XBLA' : 'TU/DLC')})`;
    category = 'Executável / Config';
    targetRelativePath = `Content/0000000000000000/${titleId}/${subFolder}/${fileName}`;
    action = 'Adicionar Novo';
  } else if (lower === 'skin.xml' || lower === 'colors.xml' || lower === 'coverflow.xml') {
    const skinFolder = (project.name || 'MinhaSkin').replace(/[^a-zA-Z0-9_-]+/g, '_');
    detectedFormat = 'Skin Dashboard (Aurora / FSD)';
    category = 'Uniformes / Texturas';
    targetRelativePath =
      lower === 'skin.xml'
        ? `Aurora/Skins/${skinFolder}/${fileName}`
        : `Aurora/Skins/${skinFolder}/Skin/${fileName}`;
    action = 'Adicionar Novo';
  } else if (magic5 === 'PATCH' || ext === 'ips' || lower.endsWith('.x360patch.json')) {
    detectedFormat = magic5 === 'PATCH' ? 'Patch Binário IPS' : 'Pacote de Patch';
    category = 'Executável / Config';
    targetRelativePath = `${gameRoot}/patches/${fileName}`;
    action = 'Aplicar Patch IPS/Hex';
  } else if (magic4 === 'DDS ' || ext === 'dds') {
    detectedFormat = 'Textura DirectDraw (DDS)';
    category = 'Uniformes / Texturas';
    targetRelativePath = `${gameRoot}/textures/${fileName}`;
    action = 'Substituir';
  } else if (ext === 'gsc') {
    detectedFormat = 'Script GSC (Call of Duty)';
    category = 'Armas / Balística';
    targetRelativePath = `${gameRoot}/maps/mp/gametypes/${fileName}`;
    action = 'Adicionar Novo';
  } else if (ext === 'ff') {
    detectedFormat = 'FastFile (.ff)';
    category = 'Armas / Balística';
    targetRelativePath = `${gameRoot}/zone/${fileName}`;
    action = 'Substituir';
  } else if (lower.includes('handling') || lower.includes('vehicle') || lower.includes('car')) {
    detectedFormat = `Dados de Veículo (.${ext || 'cfg'})`;
    category = 'Veículos / Handling';
    targetRelativePath = `${gameRoot}/common/data/${fileName}`;
    action = 'Substituir';
  } else if (ext === 'cfg' || ext === 'dat' || ext === 'xml' || ext === 'meta') {
    detectedFormat = `Configuração (.${ext.toUpperCase()})`;
    category = 'Física / Jogabilidade';
    targetRelativePath = `${gameRoot}/common/data/${fileName}`;
    action = 'Substituir';
  } else if (ext === 'ini') {
    detectedFormat = 'Configuração INI';
    category = 'Executável / Config';
    targetRelativePath = lower === 'launch.ini' ? 'launch.ini' : `${gameRoot}/config/${fileName}`;
    action = 'Substituir';
  } else if (ext === 'cpk' || ext === 'afs' || ext === 'rpf' || ext === 'arc' || ext === 'pak') {
    detectedFormat = `Arquivo Empacotado (.${ext.toUpperCase()})`;
    category = project.genre === 'Futebol' ? 'Uniformes / Texturas' : 'Estádios / Cenários';
    targetRelativePath = `${gameRoot}/data/${fileName}`;
    action = 'Substituir';
  } else if (ext === 'bin' || ext === 'db' || ext === 'sqlite' || ext === 'csv') {
    detectedFormat = `Banco de Dados (.${ext.toUpperCase()})`;
    category = project.genre === 'Futebol' ? 'Elenco / Database' : 'Física / Jogabilidade';
    targetRelativePath = `${gameRoot}/data/db/${fileName}`;
    action = 'Substituir';
  } else if (ext === 'tga' || ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'bmp') {
    const isCover = lower.includes('cover') || lower.includes('capa') || lower.includes('icon');
    detectedFormat = `Imagem / Textura (.${ext.toUpperCase()})`;
    category = 'Uniformes / Texturas';
    targetRelativePath = isCover
      ? `Aurora/Covers/${titleId}/${fileName}`
      : `${gameRoot}/textures/${fileName}`;
    action = 'Substituir';
  } else if (ext === 'xma' || ext === 'wav' || ext === 'ogg' || ext === 'adx' || ext === 'mp3') {
    detectedFormat = `Áudio (.${ext.toUpperCase()})`;
    category = 'Áudio / Narração';
    targetRelativePath = `${gameRoot}/sound/${fileName}`;
    action = 'Substituir';
  }

  if (preserveSubfolders && sourceRelativePath.includes('/')) {
    const innerSubpath = stripTopUploadedFolder(sourceRelativePath);
    if (innerSubpath) {
      const lowerInner = innerSubpath.toLowerCase();
      if (lowerInner.startsWith('content/') || lowerInner.startsWith('games/') || lowerInner === 'launch.ini') {
        targetRelativePath = innerSubpath;
      } else {
        targetRelativePath = `${gameRoot}/${innerSubpath}`;
      }
    }
  }

  return {
    fileName,
    sourceRelativePath,
    size: bytes.length,
    detectedFormat,
    category,
    targetRelativePath,
    action,
    data: bytes,
  };
}

export function createSampleUploadBatch(project: ModProject): OrganizedModFile[] {
  const enc = new TextEncoder();
  const samples: Array<{ name: string; sourcePath: string; bytes: Uint8Array }> = [
    {
      name: 'default_mod.xex',
      sourcePath: 'Pacote_Mod_Exemplo/default_mod.xex',
      bytes: new Uint8Array([0x58, 0x45, 0x58, 0x32, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x08, 0x00]),
    },
    {
      name: '_weapons_custom.gsc',
      sourcePath: 'Pacote_Mod_Exemplo/maps/mp/gametypes/_weapons_custom.gsc',
      bytes: enc.encode('// Script GSC de exemplo\ninit() { level thread custom_weapons(); }\n'),
    },
    {
      name: 'handling_custom.cfg',
      sourcePath: 'Pacote_Mod_Exemplo/common/data/handling_custom.cfg',
      bytes: enc.encode('; Handling customizado\nPORCHE_GT3 1450.0 5.5 85 0.0 -0.15\n'),
    },
    {
      name: 'pintura_carro.dds',
      sourcePath: 'Pacote_Mod_Exemplo/textures/pintura_carro.dds',
      bytes: new Uint8Array([0x44, 0x44, 0x53, 0x20, 0x7c, 0x00, 0x00, 0x00]),
    },
    {
      name: 'tu00000001_00000000',
      sourcePath: 'Pacote_Mod_Exemplo/tu00000001_00000000',
      bytes: new Uint8Array([0x4c, 0x49, 0x56, 0x45, 0x00, 0x00, 0x00, 0x00]),
    },
    {
      name: 'elenco_2026.bin',
      sourcePath: 'Pacote_Mod_Exemplo/data/db/elenco_2026.bin',
      bytes: enc.encode('X360FBDB_ROSTER_2026'),
    },
  ];

  return samples.map((s, idx) => ({
    id: `org-sample-${Date.now()}-${idx}`,
    ...classifyModBytes(s.name, s.bytes, project, s.sourcePath, false),
  }));
}
