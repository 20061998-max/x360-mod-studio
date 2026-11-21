import { createZipArchive, type ZipInputEntry } from './autoOrganizer';
import {
  canvasToPngBytes,
  encodeCanvasToDds32,
  encodeCanvasToTga32,
  sanitizeSkinFolderName,
} from './skinCreator';

export type X360ImageCategory =
  | 'game_cover'
  | 'homebrew'
  | 'banner_bg'
  | 'full_box'
  | 'game_texture';

export type X360FitMode = 'cover' | 'contain_blur' | 'contain_solid' | 'stretch';

export type X360BadgeStyle = 'none' | 'xbox360' | 'homebrew' | 'xbla' | 'mod';

export interface X360ImagePreset {
  id: string;
  category: X360ImageCategory;
  label: string;
  dimensionsLabel: string;
  width: number;
  height: number;
  usage: string;
  consolePathHint: string;
  defaultFileBase: string;
}

export const X360_IMAGE_CATEGORIES: Array<{
  id: X360ImageCategory;
  label: string;
  shortDesc: string;
}> = [
  { id: 'game_cover', label: 'Capas de Games', shortDesc: 'Boxart Aurora / FSD' },
  { id: 'homebrew', label: 'Homebrew & Apps', shortDesc: 'Ícones e capas emuladores' },
  { id: 'banner_bg', label: 'Banners / Fundos', shortDesc: '720p atrás do jogo' },
  { id: 'full_box', label: 'Capa 3D Completa', shortDesc: 'Frente + lombada + verso' },
  { id: 'game_texture', label: 'Texturas de Jogo', shortDesc: 'Potência-de-2 (DDS/TGA)' },
];

export const X360_IMAGE_PRESETS: X360ImagePreset[] = [
  {
    id: 'aurora_cover',
    category: 'game_cover',
    label: 'Capa Padrão Aurora / FSD',
    dimensionsLabel: '350 × 500',
    width: 350,
    height: 500,
    usage: 'Boxart frontal clássica para listas e CoverFlow na Aurora e Freestyle 3.',
    consolePathHint: 'Aurora\\Data\\GameData\\<TitleID>\\Cover.png (ou .dds)',
    defaultFileBase: 'cover',
  },
  {
    id: 'aurora_cover_hd',
    category: 'game_cover',
    label: 'Capa HD Aurora CoverFlow',
    dimensionsLabel: '600 × 850',
    width: 600,
    height: 850,
    usage: 'Boxart de alta definição na proporção oficial 7:10 para TVs 720p/1080p.',
    consolePathHint: 'Aurora\\Data\\GameData\\<TitleID>\\CoverHD.png (ou .dds)',
    defaultFileBase: 'cover_hd',
  },
  {
    id: 'homebrew_icon',
    category: 'homebrew',
    label: 'Ícone de Homebrew / Emulador',
    dimensionsLabel: '256 × 256',
    width: 256,
    height: 256,
    usage: 'Ícone quadrado para emuladores, XeXMenu, Aurora e utilitários RGH.',
    consolePathHint: 'Hdd1:\\Homebrew\\<App>\\icon.png (ou .dds)',
    defaultFileBase: 'icon',
  },
  {
    id: 'homebrew_nxe',
    category: 'homebrew',
    label: 'Capa Quadrada Homebrew / XBLA',
    dimensionsLabel: '512 × 512',
    width: 512,
    height: 512,
    usage: 'Arte em alta resolução para Live Arcade, DashLaunch e tiles NXE.',
    consolePathHint: 'Hdd1:\\Homebrew\\<App>\\nxeart.png (ou .dds)',
    defaultFileBase: 'nxeart',
  },
  {
    id: 'homebrew_mini',
    category: 'homebrew',
    label: 'Miniatura Title / CON (64×64)',
    dimensionsLabel: '64 × 64',
    width: 64,
    height: 64,
    usage: 'Ícone pequeno padrão de pacotes CON / LIVE / Title Icon do Xbox 360.',
    consolePathHint: 'Content\\0000000000000000\\<TitleID>\\thumbnail.png',
    defaultFileBase: 'thumbnail',
  },
  {
    id: 'game_banner',
    category: 'banner_bg',
    label: 'Fundo / Fanart do Jogo (720p)',
    dimensionsLabel: '1280 × 720',
    width: 1280,
    height: 720,
    usage: 'Imagem widescreen exibida atrás do jogo selecionado na Aurora ou FSD.',
    consolePathHint: 'Aurora\\Data\\GameData\\<TitleID>\\Background.png (ou .dds)',
    defaultFileBase: 'background',
  },
  {
    id: 'banner_wide',
    category: 'banner_bg',
    label: 'Banner Widescreen (1024×512)',
    dimensionsLabel: '1024 × 512',
    width: 1024,
    height: 512,
    usage: 'Banner de título ou placa/anúncio interno potência-de-2 para jogos.',
    consolePathHint: 'Hdd1:\\Games\\<Jogo>\\banner.dds',
    defaultFileBase: 'banner',
  },
  {
    id: 'full_box_3d',
    category: 'full_box',
    label: 'Capa Completa (Frente + Verso)',
    dimensionsLabel: '1024 × 680',
    width: 1024,
    height: 680,
    usage: 'Textura completa de caixa 3D (verso + lombada + frente) na Aurora/FSD.',
    consolePathHint: 'Aurora\\Data\\GameData\\<TitleID>\\BoxartFull.png (ou .dds)',
    defaultFileBase: 'boxart_full',
  },
  {
    id: 'tex_128',
    category: 'game_texture',
    label: 'Textura HUD / Arma (128×128)',
    dimensionsLabel: '128 × 128',
    width: 128,
    height: 128,
    usage: 'Ícone de arma, mira ou elemento de HUD em DDS/TGA 32-bit.',
    consolePathHint: 'Hdd1:\\Games\\<Jogo>\\textures\\',
    defaultFileBase: 'texture_128',
  },
  {
    id: 'tex_256',
    category: 'game_texture',
    label: 'Escudo / Emblema (256×256)',
    dimensionsLabel: '256 × 256',
    width: 256,
    height: 256,
    usage: 'Escudos de clubes, logos de equipes ou decalques em DDS/TGA 32-bit.',
    consolePathHint: 'Hdd1:\\Games\\<Jogo>\\textures\\',
    defaultFileBase: 'texture_256',
  },
  {
    id: 'tex_512',
    category: 'game_texture',
    label: 'Textura HD / Pintura (512×512)',
    dimensionsLabel: '512 × 512',
    width: 512,
    height: 512,
    usage: 'Pinturas de carros, uniformes de futebol e texturas de mapa em HD.',
    consolePathHint: 'Hdd1:\\Games\\<Jogo>\\textures\\',
    defaultFileBase: 'texture_512',
  },
];

export interface X360ImageFormatOptions {
  fitMode: X360FitMode;
  bgColor: string;
  badgeStyle: X360BadgeStyle;
  customTitle: string;
  titleId: string;
  roundedPreview: boolean;
  flipVerticalTga: boolean;
}

export function renderFormattedX360Canvas(
  sourceImg: HTMLImageElement,
  preset: X360ImagePreset,
  options: X360ImageFormatOptions
): HTMLCanvasElement {
  const { width, height } = preset;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, width, height);

  // 1. Background fill when needed
  if (options.fitMode === 'contain_solid') {
    ctx.fillStyle = options.bgColor || '#0B111E';
    ctx.fillRect(0, 0, width, height);
  } else if (options.fitMode === 'contain_blur') {
    // Draw blurred cover backdrop so any aspect ratio fits cleanly without black bars
    const bgScale = Math.max(width / sourceImg.width, height / sourceImg.height);
    const bw = sourceImg.width * bgScale;
    const bh = sourceImg.height * bgScale;
    ctx.save();
    ctx.filter = 'blur(18px) brightness(0.55)';
    ctx.drawImage(sourceImg, (width - bw) / 2 - 12, (height - bh) / 2 - 12, bw + 24, bh + 24);
    ctx.restore();
  }

  // 2. Main user image placement
  if (options.fitMode === 'stretch') {
    ctx.drawImage(sourceImg, 0, 0, width, height);
  } else {
    const scale =
      options.fitMode === 'cover'
        ? Math.max(width / sourceImg.width, height / sourceImg.height)
        : Math.min(width / sourceImg.width, height / sourceImg.height);
    const drawW = sourceImg.width * scale;
    const drawH = sourceImg.height * scale;
    const drawX = (width - drawW) / 2;
    const drawY = (height - drawH) / 2;
    ctx.drawImage(sourceImg, drawX, drawY, drawW, drawH);
  }

  // 3. Optional Xbox 360 / Homebrew header ribbon
  if (options.badgeStyle !== 'none') {
    const barH = Math.max(16, Math.round(height * 0.085));
    const badgeColors: Record<Exclude<X360BadgeStyle, 'none'>, { bg: string; text: string; label: string }> = {
      xbox360: { bg: '#16A34A', text: '#FFFFFF', label: 'XBOX 360' },
      homebrew: { bg: '#0284C7', text: '#FFFFFF', label: 'HOMEBREW · RGH' },
      xbla: { bg: '#EA580C', text: '#FFFFFF', label: 'XBOX LIVE ARCADE' },
      mod: { bg: '#15803D', text: '#FFFFFF', label: 'X360 MOD EDITION' },
    };
    const style = badgeColors[options.badgeStyle];

    ctx.save();
    ctx.fillStyle = style.bg;
    ctx.fillRect(0, 0, width, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(0, barH - 2, width, 2);

    ctx.fillStyle = style.text;
    ctx.font = `bold ${Math.max(10, Math.round(barH * 0.56))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.label, width / 2, barH / 2 + 1);
    ctx.restore();
  }

  // 4. Optional bottom title overlay
  const trimmedTitle = options.customTitle.trim();
  if (trimmedTitle.length > 0) {
    const bandH = Math.max(22, Math.round(height * 0.16));
    ctx.save();
    const grad = ctx.createLinearGradient(0, height - bandH * 1.4, 0, height);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.55, 'rgba(8,12,20,0.82)');
    grad.addColorStop(1, 'rgba(8,12,20,0.94)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, height - bandH * 1.4, width, bandH * 1.4);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.max(11, Math.round(height * 0.055))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(trimmedTitle.slice(0, 34), width / 2, height - bandH * 0.45, width * 0.9);
    ctx.restore();
  }

  return canvas;
}

export function encodeCanvasToTga32WithFlip(
  canvas: HTMLCanvasElement,
  flipVertical: boolean
): Uint8Array {
  if (!flipVertical) {
    return encodeCanvasToTga32(canvas);
  }
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Contexto 2D indisponível.');
  const rgba = ctx.getImageData(0, 0, width, height).data;

  const header = new Uint8Array(18);
  header[2] = 2;
  header[12] = width & 0xff;
  header[13] = (width >> 8) & 0xff;
  header[14] = height & 0xff;
  header[15] = (height >> 8) & 0xff;
  header[16] = 32;
  header[17] = 0x08; // bottom-left origin

  const pixelBytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const srcIdx = (srcY * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      pixelBytes[dstIdx] = rgba[srcIdx + 2];
      pixelBytes[dstIdx + 1] = rgba[srcIdx + 1];
      pixelBytes[dstIdx + 2] = rgba[srcIdx];
      pixelBytes[dstIdx + 3] = rgba[srcIdx + 3];
    }
  }

  const out = new Uint8Array(18 + pixelBytes.length);
  out.set(header, 0);
  out.set(pixelBytes, 18);
  return out;
}

export async function buildFormattedImageZip(
  canvas: HTMLCanvasElement,
  preset: X360ImagePreset,
  fileBaseName: string,
  titleId: string,
  flipVerticalTga: boolean
): Promise<{ zipBytes: Uint8Array; fileList: string[] }> {
  const enc = new TextEncoder();
  const cleanTitleId =
    titleId.trim().toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 8) || '00000000';
  const slug = sanitizeSkinFolderName(fileBaseName || preset.defaultFileBase);

  let folderPrefix = `X360_Assets/${slug}`;
  if (preset.category === 'game_cover' || preset.category === 'banner_bg' || preset.category === 'full_box') {
    folderPrefix = `Aurora/GameData/${cleanTitleId}_${slug}`;
  } else if (preset.category === 'homebrew') {
    folderPrefix = `Homebrew/${slug}`;
  } else if (preset.category === 'game_texture') {
    folderPrefix = `Games/${cleanTitleId}/Textures`;
  }

  const pngBytes = await canvasToPngBytes(canvas);
  const ddsBytes = encodeCanvasToDds32(canvas);
  const tgaBytes = encodeCanvasToTga32WithFlip(canvas, flipVerticalTga);

  const assetName = preset.defaultFileBase;
  const entries: ZipInputEntry[] = [
    { path: `${folderPrefix}/${assetName}.png`, data: pngBytes },
    { path: `${folderPrefix}/${assetName}.dds`, data: ddsBytes },
    { path: `${folderPrefix}/${assetName}.tga`, data: tgaBytes },
    {
      path: `${folderPrefix}/LEIA_ME_X360.txt`,
      data: enc.encode(
        [
          `Arquivo formatado para Xbox 360: ${preset.label} (${preset.width}x${preset.height})`,
          `Categoria: ${preset.category}`,
          `Title ID informado: ${cleanTitleId}`,
          `Destino sugerido no console: ${preset.consolePathHint}`,
          '',
          'Arquivos gerados:',
          `- ${assetName}.png (Aurora / Freestyle / Homebrew)`,
          `- ${assetName}.dds (Textura 32-bit BGRA padrão Xbox 360)`,
          `- ${assetName}.tga (True-Color 32-bit para ferramentas de mod e FSD)`,
        ].join('\n')
      ),
    },
  ];

  return {
    zipBytes: createZipArchive(entries),
    fileList: entries.map((e) => e.path),
  };
}
