import type { ModProject } from '../types/modding';
import {
  createZipArchive,
  crc32,
  isIgnoredSystemFile,
  type DroppedFileWithPath,
} from './autoOrganizer';
import {
  applyHexPatchRules,
  applyIpsPatch,
  applyJsonPatchPackage,
  buildBinaryDiff,
  buildJsonPatchPackage,
  createSampleFootballBinary,
  encodeHexRuleBytes,
  formatFileSize,
  formatHexOffset,
  parseHexOffset,
} from './binaryPatch';
import { generateLaunchIni, parseLaunchIni } from './dashLaunch';

export type CheckSeverity = 'pass' | 'warn' | 'fail';

export interface DiagnosticCheckItem {
  id: string;
  area: 'Projeto' | 'Hex PowerPC' | 'Veículos' | 'Armas' | 'Elenco' | 'DashLaunch' | 'Motor';
  title: string;
  status: CheckSeverity;
  detail: string;
}

export interface InspectedModFile {
  id: string;
  relativePath: string;
  fileName: string;
  size: number;
  detectedType: string;
  status: CheckSeverity;
  summary: string;
  crc32Hex: string;
  sha256Short: string;
}

export interface PatchVerifyResult {
  ok: boolean;
  message: string;
  recordCount: number;
  outputSize: number;
  crc32Hex: string;
  sha256Hex: string;
  patchedBytes?: Uint8Array;
}

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const hashBuffer = await crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function formatCrc32Hex(bytes: Uint8Array): string {
  return crc32(bytes).toString(16).toUpperCase().padStart(8, '0');
}

export function runProjectIntegritySuite(project: ModProject): DiagnosticCheckItem[] {
  const checks: DiagnosticCheckItem[] = [];

  // 1. Title ID check
  const tid = project.titleId.trim().toUpperCase();
  if (!/^[0-9A-F]{8}$/.test(tid)) {
    checks.push({
      id: 'proj-tid',
      area: 'Projeto',
      title: 'Title ID do Jogo',
      status: 'fail',
      detail: `Title ID "${project.titleId}" inválido. Deve ter exatamente 8 dígitos hexadecimais (ex: 4B4E084F).`,
    });
  } else if (tid === '00000000') {
    checks.push({
      id: 'proj-tid',
      area: 'Projeto',
      title: 'Title ID do Jogo',
      status: 'warn',
      detail: 'Title ID está zerado (00000000). Informe o ID real do jogo para pastas Content/Aurora corretas.',
    });
  } else {
    checks.push({
      id: 'proj-tid',
      area: 'Projeto',
      title: 'Title ID do Jogo',
      status: 'pass',
      detail: `Title ID ${tid} válido (8 hex dígitos).`,
    });
  }

  // 2. Install target path
  const target = project.installTarget.trim();
  if (!target || (!target.toLowerCase().startsWith('hdd') && !target.toLowerCase().startsWith('usb'))) {
    checks.push({
      id: 'proj-path',
      area: 'Projeto',
      title: 'Pasta Alvo no Console',
      status: 'warn',
      detail: `Caminho "${target || '(vazio)'}" não inicia com Hdd1:\\ ou Usb0:\\.`,
    });
  } else {
    checks.push({
      id: 'proj-path',
      area: 'Projeto',
      title: 'Pasta Alvo no Console',
      status: 'pass',
      detail: `Destino configurado: ${target}`,
    });
  }

  // 3. Hex rules validation & overlap detection
  const enabledHex = project.hexRules.filter((r) => r.enabled);
  if (enabledHex.length === 0) {
    checks.push({
      id: 'hex-empty',
      area: 'Hex PowerPC',
      title: 'Regras Hex PowerPC',
      status: 'pass',
      detail: 'Nenhuma regra Hex ativa no projeto (sem conflitos).',
    });
  } else {
    const spans: Array<{ name: string; start: number; end: number }> = [];
    let hexErrors = 0;

    for (const rule of enabledHex) {
      const off = parseHexOffset(rule.offsetHex);
      if (off === null) {
        hexErrors++;
        checks.push({
          id: `hex-err-${rule.id}`,
          area: 'Hex PowerPC',
          title: `Regra Hex "${rule.name}"`,
          status: 'fail',
          detail: `Offset hexadecimal inválido: "${rule.offsetHex}".`,
        });
        continue;
      }
      try {
        const bytes = encodeHexRuleBytes(rule.type, rule.value);
        if (bytes.length === 0) {
          hexErrors++;
          checks.push({
            id: `hex-len-${rule.id}`,
            area: 'Hex PowerPC',
            title: `Regra Hex "${rule.name}"`,
            status: 'fail',
            detail: 'Valor codificado resultou em 0 bytes.',
          });
        } else {
          spans.push({ name: rule.name, start: off, end: off + bytes.length - 1 });
        }
      } catch (err) {
        hexErrors++;
        checks.push({
          id: `hex-enc-${rule.id}`,
          area: 'Hex PowerPC',
          title: `Regra Hex "${rule.name}"`,
          status: 'fail',
          detail: err instanceof Error ? err.message : 'Erro ao codificar valor.',
        });
      }
    }

    // Check overlaps
    let overlaps = 0;
    for (let i = 0; i < spans.length; i++) {
      for (let j = i + 1; j < spans.length; j++) {
        const a = spans[i];
        const b = spans[j];
        if (a.start <= b.end && b.start <= a.end) {
          overlaps++;
          checks.push({
            id: `hex-overlap-${i}-${j}`,
            area: 'Hex PowerPC',
            title: 'Sobreposição de Offsets Hex',
            status: 'fail',
            detail: `Regra "${a.name}" (${formatHexOffset(a.start)}..${formatHexOffset(a.end)}) colide com "${b.name}" (${formatHexOffset(b.start)}..${formatHexOffset(b.end)}).`,
          });
        }
      }
    }

    if (hexErrors === 0 && overlaps === 0) {
      checks.push({
        id: 'hex-ok',
        area: 'Hex PowerPC',
        title: 'Regras Hex PowerPC',
        status: 'pass',
        detail: `${enabledHex.length} regra(s) ativa(s) validadas sem conflitos ou sobreposições.`,
      });
    }
  }

  // 4. Vehicle mods checks
  if (project.vehicleMods.length > 0) {
    const slotMap = new Map<string, string>();
    let carIssues = 0;
    for (const v of project.vehicleMods) {
      const slotKey = v.replacesSlot.trim().toLowerCase();
      if (slotKey && slotMap.has(slotKey)) {
        carIssues++;
        checks.push({
          id: `veh-dup-${v.id}`,
          area: 'Veículos',
          title: `Conflito de Slot (${v.replacesSlot})`,
          status: 'fail',
          detail: `"${v.vehicleName}" usa o mesmo slot de "${slotMap.get(slotKey)}".`,
        });
      } else if (slotKey) {
        slotMap.set(slotKey, v.vehicleName);
      }
      if (v.topSpeedKmh <= 0 || v.massKg <= 0 || v.grip <= 0) {
        carIssues++;
        checks.push({
          id: `veh-phys-${v.id}`,
          area: 'Veículos',
          title: `Física do Veículo "${v.vehicleName}"`,
          status: 'fail',
          detail: 'Velocidade, massa e aderência devem ser maiores que zero.',
        });
      }
      if (!v.assetPath.trim()) {
        carIssues++;
        checks.push({
          id: `veh-path-${v.id}`,
          area: 'Veículos',
          title: `Caminho do Modelo "${v.vehicleName}"`,
          status: 'warn',
          detail: 'Caminho do asset está em branco.',
        });
      }
    }
    if (carIssues === 0) {
      checks.push({
        id: 'veh-ok',
        area: 'Veículos',
        title: 'Pacote de Veículos / Handling',
        status: 'pass',
        detail: `${project.vehicleMods.length} veículo(s) sem conflitos de slot e com física válida.`,
      });
    }
  }

  // 5. Weapon mods checks
  if (project.weaponMods.length > 0) {
    const idSet = new Set<string>();
    let wepIssues = 0;
    for (const w of project.weaponMods) {
      const key = w.baseWeaponId.trim().toLowerCase();
      if (key && idSet.has(key)) {
        wepIssues++;
        checks.push({
          id: `wep-dup-${w.id}`,
          area: 'Armas',
          title: `ID Base Duplicado (${w.baseWeaponId})`,
          status: 'warn',
          detail: `Arma "${w.weaponName}" reutiliza o mesmo ID base de outro item.`,
        });
      } else if (key) {
        idSet.add(key);
      }
      if (w.damage <= 0 || w.fireRateRpm <= 0 || w.magazineSize <= 0) {
        wepIssues++;
        checks.push({
          id: `wep-stat-${w.id}`,
          area: 'Armas',
          title: `Atributos de "${w.weaponName}"`,
          status: 'fail',
          detail: 'Dano, cadência (RPM) e carregador precisam ser positivos.',
        });
      }
    }
    if (wepIssues === 0) {
      checks.push({
        id: 'wep-ok',
        area: 'Armas',
        title: 'Pacote de Armas / Balística',
        status: 'pass',
        detail: `${project.weaponMods.length} arma(s) configurada(s) com parâmetros válidos.`,
      });
    }
  }

  // 6. Football roster checks
  if (project.rosterUpdates.length > 0) {
    const clubShirt = new Set<string>();
    let rosIssues = 0;
    for (const r of project.rosterUpdates) {
      if (r.overall < 1 || r.overall > 99) {
        rosIssues++;
        checks.push({
          id: `ros-ovr-${r.id}`,
          area: 'Elenco',
          title: `Overall Inválido (${r.playerName})`,
          status: 'fail',
          detail: `Overall ${r.overall} fora da faixa permitida (1 a 99).`,
        });
      }
      const key = `${r.club.trim().toLowerCase()}#${r.shirtNumber}`;
      if (r.changeType !== 'Aposentado' && clubShirt.has(key)) {
        rosIssues++;
        checks.push({
          id: `ros-num-${r.id}`,
          area: 'Elenco',
          title: `Camisa Repetida (${r.club})`,
          status: 'warn',
          detail: `Camisa #${r.shirtNumber} aparece mais de uma vez no clube ${r.club}.`,
        });
      } else {
        clubShirt.add(key);
      }
    }
    if (rosIssues === 0) {
      checks.push({
        id: 'ros-ok',
        area: 'Elenco',
        title: 'Elencos e Transferências',
        status: 'pass',
        detail: `${project.rosterUpdates.length} registro(s) de elenco validados.`,
      });
    }
  }

  // 7. DashLaunch round-trip & safety checks
  const dl = project.dashLaunch;
  const iniText = generateLaunchIni(dl);
  const reparsed = parseLaunchIni(iniText);
  const roundTripOk =
    reparsed.paths.defaultPath === dl.paths.defaultPath &&
    reparsed.settings.liveblock === dl.settings.liveblock &&
    reparsed.settings.livestrong === dl.settings.livestrong &&
    reparsed.settings.contpatch === dl.settings.contpatch;

  if (!roundTripOk) {
    checks.push({
      id: 'dl-rt',
      area: 'DashLaunch',
      title: 'Conversão launch.ini',
      status: 'fail',
      detail: 'Falha ao validar leitura e escrita do launch.ini.',
    });
  } else if (!dl.settings.liveblock || !dl.settings.livestrong) {
    checks.push({
      id: 'dl-safe',
      area: 'DashLaunch',
      title: 'Proteção Xbox Live (launch.ini)',
      status: 'warn',
      detail: 'liveblock ou livestrong está desativado. Recomenda-se ativar ambos em consoles RGH/JTAG.',
    });
  } else {
    checks.push({
      id: 'dl-ok',
      area: 'DashLaunch',
      title: 'DashLaunch (launch.ini)',
      status: 'pass',
      detail: 'launch.ini gerado e revalidado com liveblock e livestrong ativos.',
    });
  }

  return checks;
}

export async function runRoundTripEngineTest(): Promise<DiagnosticCheckItem[]> {
  const results: DiagnosticCheckItem[] = [];

  // Test 1: IPS + JSON Patch round-trip
  try {
    const orig = createSampleFootballBinary('original');
    const mod = createSampleFootballBinary('modified');
    const diff = buildBinaryDiff(orig, mod);
    if (!diff.ipsBytes) {
      throw new Error('Falha ao gerar buffer IPS.');
    }
    const appliedIps = applyIpsPatch(orig, diff.ipsBytes);
    const ipsExact =
      appliedIps.patched.length === mod.length &&
      appliedIps.patched.every((b, idx) => b === mod[idx]);

    const jsonPkg = buildJsonPatchPackage(orig, mod, {
      projectName: 'AutoTeste',
      gameTitle: 'Teste',
      titleId: '4B4E084F',
      version: 'v1.0',
      author: 'Studio',
      originalFileName: 'orig.bin',
      originalSize: orig.length,
      modifiedSize: mod.length,
      notes: '',
    });
    const appliedJson = applyJsonPatchPackage(orig, jsonPkg);
    const jsonExact =
      appliedJson.patched.length === mod.length &&
      appliedJson.patched.every((b, idx) => b === mod[idx]);

    results.push({
      id: 'eng-patch',
      area: 'Motor',
      title: 'Motor de Patch IPS & JSON (Round-Trip)',
      status: ipsExact && jsonExact ? 'pass' : 'fail',
      detail:
        ipsExact && jsonExact
          ? `100% íntegro: ${diff.chunks.length} bloco(s) aplicados byte a byte (CRC32 ${formatCrc32Hex(mod)}).`
          : 'Diferença detectada após aplicar patch de teste.',
    });
  } catch (err) {
    results.push({
      id: 'eng-patch',
      area: 'Motor',
      title: 'Motor de Patch IPS & JSON',
      status: 'fail',
      detail: err instanceof Error ? err.message : 'Erro no motor de patch.',
    });
  }

  // Test 2: Hex PowerPC Big-Endian encoder
  try {
    const base = new Uint8Array(64).fill(0);
    const res = applyHexPatchRules(base, [
      {
        id: 't1',
        name: 'Ano 2026 BE',
        offsetHex: '0x00000004',
        type: 'uint32be',
        value: '2026',
        enabled: true,
      },
      {
        id: 't2',
        name: 'Float 1.5 BE',
        offsetHex: '0x00000008',
        type: 'float32be',
        value: '1.5',
        enabled: true,
      },
    ]);
    const dv = new DataView(res.patched.buffer);
    const ok =
      res.appliedCount === 2 &&
      res.errors.length === 0 &&
      dv.getUint32(4, false) === 2026 &&
      Math.abs(dv.getFloat32(8, false) - 1.5) < 0.0001;
    results.push({
      id: 'eng-hex',
      area: 'Motor',
      title: 'Codificador PowerPC Big-Endian',
      status: ok ? 'pass' : 'fail',
      detail: ok
        ? 'UInt32 BE e Float32 BE gravados e lidos exatamente nos offsets.'
        : 'Falha na leitura Big-Endian.',
    });
  } catch (err) {
    results.push({
      id: 'eng-hex',
      area: 'Motor',
      title: 'Codificador PowerPC Big-Endian',
      status: 'fail',
      detail: err instanceof Error ? err.message : 'Erro no motor Hex.',
    });
  }

  // Test 3: ZIP packager integrity
  try {
    const payload = new TextEncoder().encode('X360_ZIP_SELF_TEST_OK');
    const zip = createZipArchive([{ path: 'Games/Teste/check.txt', data: payload }]);
    const hasPkHeader =
      zip[0] === 0x50 && zip[1] === 0x4b && zip[2] === 0x03 && zip[3] === 0x04;
    const eocdOffset = zip.length - 22;
    const hasEocd =
      eocdOffset >= 0 &&
      zip[eocdOffset] === 0x50 &&
      zip[eocdOffset + 1] === 0x4b &&
      zip[eocdOffset + 2] === 0x05 &&
      zip[eocdOffset + 3] === 0x06;
    results.push({
      id: 'eng-zip',
      area: 'Motor',
      title: 'Empacotador .ZIP (PKZIP / CRC-32)',
      status: hasPkHeader && hasEocd ? 'pass' : 'fail',
      detail:
        hasPkHeader && hasEocd
          ? `Assinatura PK0304 e EOCD válidas (${formatFileSize(zip.length)}).`
          : 'Estrutura PKZIP inválida.',
    });
  } catch (err) {
    results.push({
      id: 'eng-zip',
      area: 'Motor',
      title: 'Empacotador .ZIP',
      status: 'fail',
      detail: err instanceof Error ? err.message : 'Erro ao gerar ZIP.',
    });
  }

  return results;
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

function inspectIpsStructure(bytes: Uint8Array): { status: CheckSeverity; summary: string } {
  if (bytes.length < 8) {
    return { status: 'fail', summary: 'Arquivo IPS menor que o mínimo (8 bytes).' };
  }
  const magic = String.fromCharCode(...bytes.slice(0, 5));
  if (magic !== 'PATCH') {
    return { status: 'fail', summary: 'Cabeçalho IPS inválido (esperado "PATCH").' };
  }
  let pos = 5;
  let records = 0;
  let foundEof = false;
  while (pos + 3 <= bytes.length) {
    if (bytes[pos] === 0x45 && bytes[pos + 1] === 0x4f && bytes[pos + 2] === 0x46) {
      foundEof = true;
      break;
    }
    if (pos + 5 > bytes.length) {
      return { status: 'fail', summary: `Registro IPS #${records + 1} truncado antes do EOF.` };
    }
    const size = (bytes[pos + 3] << 8) | bytes[pos + 4];
    pos += 5;
    if (size === 0) {
      if (pos + 3 > bytes.length) {
        return { status: 'fail', summary: `Registro RLE #${records + 1} corrompido.` };
      }
      pos += 3;
    } else {
      if (pos + size > bytes.length) {
        return { status: 'fail', summary: `Dados do registro #${records + 1} ultrapassam o arquivo.` };
      }
      pos += size;
    }
    records++;
  }
  if (!foundEof) {
    return { status: 'fail', summary: 'Marcador final EOF não encontrado no arquivo IPS.' };
  }
  return {
    status: 'pass',
    summary: `IPS íntegro: ${records} bloco(s) de alteração e marcador EOF válido.`,
  };
}

export async function inspectUploadedModFiles(
  items: DroppedFileWithPath[]
): Promise<InspectedModFile[]> {
  const out: InspectedModFile[] = [];

  for (let i = 0; i < items.length; i++) {
    const { file, relativePath } = items[i];
    const rel = relativePath || file.name;
    const lower = file.name.toLowerCase();
    const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : '';
    const bytes = new Uint8Array(await file.arrayBuffer());
    const crcHex = formatCrc32Hex(bytes);
    const shaFull = await computeSha256Hex(bytes);
    const shaShort = shaFull.slice(0, 16);

    let detectedType = ext ? `Arquivo .${ext.toUpperCase()}` : 'Binário';
    let status: CheckSeverity = 'pass';
    let summary = 'Arquivo legível com integridade verificada.';

    if (isIgnoredSystemFile(file.name)) {
      detectedType = 'Lixo de Sistema (SO)';
      status = 'warn';
      summary = 'Arquivo oculto de Windows/macOS detectado. Recomenda-se remover antes de copiar ao Xbox 360.';
    } else if (bytes.length === 0) {
      status = 'fail';
      summary = 'Arquivo vazio (0 bytes). Pode travar ou corromper o carregamento do jogo.';
    } else if (ext === 'xex') {
      detectedType = 'Executável Xbox 360 (.XEX)';
      const magic = bytes.length >= 4 ? String.fromCharCode(...bytes.slice(0, 4)) : '';
      if (magic !== 'XEX2') {
        status = 'fail';
        summary = `Cabeçalho XEX2 não encontrado (encontrado "${magic || 'inválido'}"). Arquivo pode estar corrompido.`;
      } else if (bytes.length < 24) {
        status = 'fail';
        summary = 'Cabeçalho XEX2 truncado (< 24 bytes).';
      } else {
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const modFlags = dv.getUint32(4, false);
        summary = `Assinatura XEX2 válida · ModuleFlags 0x${modFlags.toString(16).toUpperCase().padStart(8, '0')}.`;
      }
    } else if (ext === 'ips') {
      detectedType = 'Patch Binário (.IPS)';
      const ipsCheck = inspectIpsStructure(bytes);
      status = ipsCheck.status;
      summary = ipsCheck.summary;
    } else if (lower.endsWith('.x360patch.json')) {
      detectedType = 'Pacote Patch JSON';
      try {
        const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
          format?: string;
          records?: unknown[];
        };
        if (parsed.format === 'x360-patch-v1' && Array.isArray(parsed.records)) {
          summary = `JSON Patch válido com ${parsed.records.length} registro(s).`;
        } else {
          status = 'fail';
          summary = 'Formato JSON incompatível com x360-patch-v1.';
        }
      } catch {
        status = 'fail';
        summary = 'JSON malformado ou ilegível.';
      }
    } else if (ext === 'dds') {
      detectedType = 'Textura DDS';
      const magic = bytes.length >= 4 ? String.fromCharCode(...bytes.slice(0, 4)) : '';
      if (magic !== 'DDS ' || bytes.length < 128) {
        status = 'fail';
        summary = 'Cabeçalho DDS inválido ou menor que 128 bytes.';
      } else {
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const dwSize = dv.getUint32(4, true);
        const height = dv.getUint32(12, true);
        const width = dv.getUint32(16, true);
        if (dwSize !== 124) {
          status = 'warn';
          summary = `DDS com dwSize incomum (${dwSize}) · ${width}×${height} px.`;
        } else if (!isPowerOfTwo(width) || !isPowerOfTwo(height)) {
          status = 'warn';
          summary = `DDS ${width}×${height} px: dimensões não são potência de 2 (alguns jogos X360 exigem 128/256/512/1024).`;
        } else {
          summary = `DDS válido ${width}×${height} px (alinhado em potência de 2).`;
        }
      }
    } else if (ext === 'png') {
      detectedType = 'Imagem .PNG (Capa/UI)';
      const isPng =
        bytes.length >= 24 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47;
      if (!isPng) {
        status = 'fail';
        summary = 'Assinatura PNG inválida ou arquivo corrompido.';
      } else {
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const w = dv.getUint32(16, false);
        const h = dv.getUint32(20, false);
        summary = `PNG válido (${w}×${h} px) pronto para Aurora / Freestyle / Homebrew.`;
      }
    } else if (ext === 'tga') {
      detectedType = 'Textura .TGA (True-Color)';
      if (bytes.length < 18) {
        status = 'fail';
        summary = 'Cabeçalho TGA incompleto (< 18 bytes).';
      } else {
        const imgType = bytes[2];
        const w = bytes[12] | (bytes[13] << 8);
        const h = bytes[14] | (bytes[15] << 8);
        const bpp = bytes[16];
        if ((imgType !== 2 && imgType !== 10) || w <= 0 || h <= 0) {
          status = 'warn';
          summary = `TGA tipo ${imgType} (${w}×${h} px, ${bpp}-bit) — verifique compatibilidade.`;
        } else {
          summary = `TGA válido ${w}×${h} px (${bpp}-bit) pronto para Xbox 360.`;
        }
      }
    } else if (ext === 'zip') {
      detectedType = 'Arquivo .ZIP';
      const hasPk = bytes.length >= 22 && bytes[0] === 0x50 && bytes[1] === 0x4b;
      if (!hasPk) {
        status = 'fail';
        summary = 'Cabeçalho PKZIP inválido ou arquivo corrompido.';
      } else {
        summary = `Arquivo ZIP válido (${formatFileSize(bytes.length)}).`;
      }
    } else if (ext === 'gsc') {
      detectedType = 'Script GSC';
      const text = new TextDecoder().decode(bytes);
      if (text.includes('\u0000')) {
        status = 'warn';
        summary = 'Script GSC contém bytes nulos (possível script compilado/binário).';
      } else {
        let balance = 0;
        for (const ch of text) {
          if (ch === '{') balance++;
          if (ch === '}') balance--;
          if (balance < 0) break;
        }
        if (balance !== 0) {
          status = 'fail';
          summary = 'Chaves { } desbalanceadas no script GSC (pode gerar erro de sintaxe no jogo).';
        } else {
          summary = 'Script GSC texto com chaves { } balanceadas.';
        }
      }
    } else if (ext === 'ini' || ext === 'cfg') {
      detectedType = `Configuração (.${ext.toUpperCase()})`;
      const text = new TextDecoder().decode(bytes);
      const nonEmptyLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
      if (nonEmptyLines === 0) {
        status = 'warn';
        summary = 'Arquivo de configuração sem linhas ativas.';
      } else {
        summary = `Texto válido com ${nonEmptyLines} linha(s) configurada(s).`;
      }
    } else if (bytes.length >= 4) {
      const m4 = String.fromCharCode(...bytes.slice(0, 4));
      if (m4 === 'CON ' || m4 === 'LIVE' || m4 === 'PIRS') {
        detectedType = `Contêiner Xbox 360 (${m4.trim()})`;
        summary =
          bytes.length >= 0x400
            ? `Assinatura ${m4.trim()} válida e cabeçalho completo.`
            : `Assinatura ${m4.trim()} detectada, mas tamanho muito pequeno (< 1 KB).`;
        if (bytes.length < 0x400) status = 'warn';
      }
    }

    out.push({
      id: `insp-${Date.now()}-${i}`,
      relativePath: rel,
      fileName: file.name,
      size: bytes.length,
      detectedType,
      status,
      summary,
      crc32Hex: crcHex,
      sha256Short: shaShort,
    });
  }

  return out;
}

export async function verifyPatchOnOriginal(
  originalBytes: Uint8Array,
  patchBytes: Uint8Array,
  patchFileName: string
): Promise<PatchVerifyResult> {
  try {
    let patched: Uint8Array;
    let recordCount: number;

    if (patchFileName.toLowerCase().endsWith('.json')) {
      const parsed = JSON.parse(new TextDecoder().decode(patchBytes));
      const res = applyJsonPatchPackage(originalBytes, parsed);
      patched = res.patched;
      recordCount = res.recordCount;
    } else {
      const res = applyIpsPatch(originalBytes, patchBytes);
      patched = res.patched;
      recordCount = res.recordCount;
    }

    const sha256Hex = await computeSha256Hex(patched);
    const crc32Hex = formatCrc32Hex(patched);

    return {
      ok: true,
      message: `Patch aplicado 100% com sucesso! ${recordCount} bloco(s) gravados sem erros.`,
      recordCount,
      outputSize: patched.length,
      crc32Hex,
      sha256Hex,
      patchedBytes: patched,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Falha ao aplicar patch de teste.',
      recordCount: 0,
      outputSize: 0,
      crc32Hex: '00000000',
      sha256Hex: '',
    };
  }
}

export function buildTesterReportTxt(
  project: ModProject,
  checks: DiagnosticCheckItem[],
  inspectedFiles: InspectedModFile[]
): string {
  const passes = checks.filter((c) => c.status === 'pass').length;
  const warns = checks.filter((c) => c.status === 'warn').length;
  const fails = checks.filter((c) => c.status === 'fail').length;

  const lines: string[] = [
    '============================================================',
    `RELATORIO DE TESTE E VERIFICACAO - ${project.name}`,
    '============================================================',
    `Jogo Base: ${project.gameTitle} (Title ID: ${project.titleId})`,
    `Data: ${new Date().toLocaleString('pt-BR')}`,
    `Resultado Geral: ${passes} OK | ${warns} Avisos | ${fails} Falhas`,
    '',
    '[VERIFICACOES DO PROJETO & MOTORES]',
    ...checks.map(
      (c) => `[${c.status.toUpperCase()}] (${c.area}) ${c.title}: ${c.detail}`
    ),
    '',
  ];

  if (inspectedFiles.length > 0) {
    lines.push('[ARQUIVOS DO MOD TESTADOS]');
    for (const f of inspectedFiles) {
      lines.push(
        `[${f.status.toUpperCase()}] ${f.relativePath} | ${f.detectedType} | CRC32:${f.crc32Hex} | ${f.summary}`
      );
    }
  }

  return lines.join('\n');
}
