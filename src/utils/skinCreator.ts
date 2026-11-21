import { createZipArchive, type ZipInputEntry } from './autoOrganizer';

export type SkinDashboardTarget = 'aurora' | 'freestyle' | 'xexmenu' | 'nxe';

export interface DashboardTargetMeta {
  id: SkinDashboardTarget;
  label: string;
  shortLabel: string;
  installPath: string;
  description: string;
  mainAssets: string[];
}

export const DASHBOARD_TARGETS: DashboardTargetMeta[] = [
  {
    id: 'aurora',
    label: 'Aurora Dashboard',
    shortLabel: 'Aurora',
    installPath: 'Hdd1:\\Aurora\\Skins\\',
    description:
      'Gera skin.xml, Colors.xml, CoverFlow.xml, fundo 1280×720 (.png e .dds), ícone 256×256 e miniatura 640×360 no padrão Aurora.',
    mainAssets: ['skin.xml', 'Skin/Colors.xml', 'Skin/CoverFlow.xml', 'Media/Background.png', 'Media/Background.dds', 'Media/Icon.png', 'Media/Preview.png'],
  },
  {
    id: 'freestyle',
    label: 'Freestyle 3 (FSD)',
    shortLabel: 'Freestyle 3',
    installPath: 'Hdd1:\\Freestyle\\Skins\\',
    description:
      'Gera Skin.xml, configurações de tema, fundo 1280×720 (.png e .dds), moldura de capa 350×500 e ícone de seleção para FSD3.',
    mainAssets: ['Skin.xml', 'Images/background.png', 'Images/background.dds', 'Images/cover_frame.png', 'Images/icon.png', 'Scripts/skin_settings.ini'],
  },
  {
    id: 'xexmenu',
    label: 'XeXMenu 1.1 / 1.2',
    shortLabel: 'XeXMenu',
    installPath: 'Hdd1:\\XeXMenu\\',
    description:
      'Gera plano de fundo 1280×720 em .TGA 32-bit e .PNG mais arquivo de paleta de cores pronto para substituir no XeXMenu.',
    mainAssets: ['background.tga', 'background.png', 'xexmenu_theme.ini'],
  },
  {
    id: 'nxe',
    label: 'Tema NXE / Xbox Original',
    shortLabel: 'NXE / Tema',
    installPath: 'Content\\0000000000000000\\FFFE07D1\\00030000\\',
    description:
      'Gera papel de parede 1280×720 (.dds e .png), tile 512×512 e manifesto de tema para dashboard clássica/personalizada.',
    mainAssets: ['Wallpaper_1280x720.dds', 'Wallpaper_1280x720.png', 'AvatarTile_512x512.png', 'ThemeConfig.ini'],
  },
];

export interface SkinConfig {
  target: SkinDashboardTarget;
  skinName: string;
  author: string;
  version: string;
  description: string;
  bgColorStart: string;
  bgColorEnd: string;
  accentColor: string;
  panelColor: string;
  textColor: string;
  overlayOpacity: number; // 0..85
  showGridPattern: boolean;
  coverFlowStyle: 'CoverFlow' | 'Lista' | 'Grade';
  includeDds: boolean;
  includeTga: boolean;
  bgFitMode?: 'cover' | 'contain_blur';
}

export interface SkinPresetTheme {
  id: string;
  name: string;
  bgColorStart: string;
  bgColorEnd: string;
  accentColor: string;
  panelColor: string;
  textColor: string;
}

export const SKIN_COLOR_PRESETS: SkinPresetTheme[] = [
  {
    id: 'xbox-emerald',
    name: 'Xbox Esmeralda',
    bgColorStart: '#07140D',
    bgColorEnd: '#0F2E1C',
    accentColor: '#16A34A',
    panelColor: '#0E1C14',
    textColor: '#F8FAFC',
  },
  {
    id: 'midnight-cyber',
    name: 'Azul Aurora',
    bgColorStart: '#091224',
    bgColorEnd: '#13274B',
    accentColor: '#0EA5E9',
    panelColor: '#0F1A30',
    textColor: '#F1F5F9',
  },
  {
    id: 'crimson-pro',
    name: 'Vermelho Turbo',
    bgColorStart: '#1A0A0D',
    bgColorEnd: '#331118',
    accentColor: '#E11D48',
    panelColor: '#1E1014',
    textColor: '#FFF1F2',
  },
  {
    id: 'gold-arena',
    name: 'Ouro Campeonato',
    bgColorStart: '#141108',
    bgColorEnd: '#2B220B',
    accentColor: '#EAB308',
    panelColor: '#1A160B',
    textColor: '#FEFCE8',
  },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function sanitizeSkinFolderName(name: string): string {
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || 'MinhaSkinX360';
}

export function encodeCanvasToDds32(canvas: HTMLCanvasElement): Uint8Array {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Contexto 2D indisponível.');

  const rgba = ctx.getImageData(0, 0, width, height).data;
  const header = new Uint8Array(128);
  const dv = new DataView(header.buffer);

  // Magic "DDS "
  header[0] = 0x44;
  header[1] = 0x44;
  header[2] = 0x53;
  header[3] = 0x20;

  // DDS_HEADER
  dv.setUint32(4, 124, true); // dwSize
  dv.setUint32(8, 0x0000100f, true); // CAPS | HEIGHT | WIDTH | PITCH | PIXELFORMAT
  dv.setUint32(12, height, true);
  dv.setUint32(16, width, true);
  dv.setUint32(20, width * 4, true); // dwPitchOrLinearSize
  dv.setUint32(24, 0, true); // dwDepth
  dv.setUint32(28, 1, true); // dwMipMapCount

  // DDS_PIXELFORMAT at offset 76
  dv.setUint32(76, 32, true); // dwSize
  dv.setUint32(80, 0x00000041, true); // DDPF_ALPHAPIXELS | DDPF_RGB
  dv.setUint32(84, 0, true); // dwFourCC
  dv.setUint32(88, 32, true); // dwRGBBitCount
  dv.setUint32(92, 0x00ff0000, true); // R
  dv.setUint32(96, 0x0000ff00, true); // G
  dv.setUint32(100, 0x000000ff, true); // B
  dv.setUint32(104, 0xff000000, true); // A

  dv.setUint32(108, 0x00001000, true); // DDSCAPS_TEXTURE

  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    pixels[idx] = rgba[idx + 2]; // B
    pixels[idx + 1] = rgba[idx + 1]; // G
    pixels[idx + 2] = rgba[idx]; // R
    pixels[idx + 3] = rgba[idx + 3]; // A
  }

  const out = new Uint8Array(128 + pixels.length);
  out.set(header, 0);
  out.set(pixels, 128);
  return out;
}

export function encodeCanvasToTga32(canvas: HTMLCanvasElement): Uint8Array {
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
  header[17] = 0x28; // top-left origin

  const pixelBytes = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    pixelBytes[idx] = rgba[idx + 2];
    pixelBytes[idx + 1] = rgba[idx + 1];
    pixelBytes[idx + 2] = rgba[idx];
    pixelBytes[idx + 3] = rgba[idx + 3];
  }

  const out = new Uint8Array(18 + pixelBytes.length);
  out.set(header, 0);
  out.set(pixelBytes, 18);
  return out;
}

export async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Falha ao converter canvas para PNG.'));
    }, 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export function renderSkinWallpaperCanvas(
  config: SkinConfig,
  bgImage: HTMLImageElement | null,
  logoImage: HTMLImageElement | null,
  width = 1280,
  height = 720,
  withDashboardUiMockup = false
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 1. Base Gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, config.bgColorStart);
  grad.addColorStop(1, config.bgColorEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 2. Uploaded Background Image (cover or contain_blur)
  if (bgImage) {
    if (config.bgFitMode === 'contain_blur') {
      const bgScale = Math.max(width / bgImage.width, height / bgImage.height);
      const bw = bgImage.width * bgScale;
      const bh = bgImage.height * bgScale;
      ctx.save();
      ctx.filter = 'blur(18px) brightness(0.55)';
      ctx.drawImage(bgImage, (width - bw) / 2 - 12, (height - bh) / 2 - 12, bw + 24, bh + 24);
      ctx.restore();

      const fgScale = Math.min(width / bgImage.width, height / bgImage.height);
      const fw = bgImage.width * fgScale;
      const fh = bgImage.height * fgScale;
      ctx.drawImage(bgImage, (width - fw) / 2, (height - fh) / 2, fw, fh);
    } else {
      const scale = Math.max(width / bgImage.width, height / bgImage.height);
      const dw = bgImage.width * scale;
      const dh = bgImage.height * scale;
      ctx.drawImage(bgImage, (width - dw) / 2, (height - dh) / 2, dw, dh);
    }
  }

  // 3. Tint / Dimming Overlay
  if (config.overlayOpacity > 0) {
    ctx.fillStyle = config.panelColor;
    ctx.globalAlpha = Math.min(0.9, Math.max(0, config.overlayOpacity / 100));
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  // 4. Optional Subtle Tech Grid
  if (config.showGridPattern) {
    ctx.strokeStyle = config.accentColor;
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = 1;
    const step = Math.max(32, Math.round(width / 24));
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // 5. Top/Bottom Accent Glow Bar
  ctx.fillStyle = config.accentColor;
  ctx.fillRect(0, 0, width, Math.max(4, Math.round(height * 0.008)));

  // 6. Optional Logo
  if (logoImage) {
    const maxLogoW = width * 0.24;
    const maxLogoH = height * 0.14;
    const ratio = Math.min(maxLogoW / logoImage.width, maxLogoH / logoImage.height);
    const lw = logoImage.width * ratio;
    const lh = logoImage.height * ratio;
    ctx.drawImage(logoImage, width * 0.045, height * 0.055, lw, lh);
  }

  // 7. Dashboard UI Mockup Overlay (Preview Only!)
  if (withDashboardUiMockup) {
    drawDashboardMockupOverlay(ctx, config, width, height, Boolean(logoImage));
  }

  return canvas;
}

function drawDashboardMockupOverlay(
  ctx: CanvasRenderingContext2D,
  config: SkinConfig,
  w: number,
  h: number,
  hasLogo: boolean
) {
  ctx.save();

  // Header bar
  ctx.fillStyle = config.panelColor;
  ctx.globalAlpha = 0.78;
  ctx.fillRect(0, 0, w, h * 0.14);
  ctx.globalAlpha = 1;

  if (!hasLogo) {
    ctx.fillStyle = config.textColor;
    ctx.font = `bold ${Math.round(h * 0.04)}px sans-serif`;
    ctx.fillText(config.skinName || 'Aurora Skin', w * 0.045, h * 0.085);
  }

  // Right status info
  ctx.fillStyle = config.accentColor;
  ctx.font = `bold ${Math.round(h * 0.025)}px monospace`;
  ctx.textAlign = 'right';
  const badgeLabel =
    config.target === 'aurora'
      ? 'AURORA 0.7b+ · 720p'
      : config.target === 'freestyle'
      ? 'FREESTYLE 3 · FSD'
      : config.target === 'xexmenu'
      ? 'XEXMENU 1.2'
      : 'XBOX 360 NXE';
  ctx.fillText(badgeLabel, w * 0.955, h * 0.08);
  ctx.textAlign = 'left';

  if (config.target === 'aurora' || config.target === 'freestyle') {
    // CoverFlow cards mockup
    const cardCount = 5;
    const centerIdx = 2;
    for (let i = 0; i < cardCount; i++) {
      const isCenter = i === centerIdx;
      const cw = isCenter ? w * 0.17 : w * 0.125;
      const ch = isCenter ? h * 0.44 : h * 0.33;
      const cx =
        w * 0.5 + (i - centerIdx) * (w * 0.165) - cw / 2;
      const cy = h * 0.52 - ch / 2;

      ctx.fillStyle = config.panelColor;
      ctx.globalAlpha = isCenter ? 0.94 : 0.72;
      ctx.fillRect(cx, cy, cw, ch);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = isCenter ? config.accentColor : 'rgba(255,255,255,0.22)';
      ctx.lineWidth = isCenter ? 4 : 1.5;
      ctx.strokeRect(cx, cy, cw, ch);

      ctx.fillStyle = config.textColor;
      ctx.font = `bold ${Math.round(h * (isCenter ? 0.028 : 0.02))}px sans-serif`;
      ctx.textAlign = 'center';
      const titles = ['Forza Horizon', 'Call of Duty BO2', 'Futebol Mod 26', 'God of War Mod', 'GTA V X360'];
      ctx.fillText(titles[i], cx + cw / 2, cy + ch * 0.86);
    }
    ctx.textAlign = 'left';
  } else if (config.target === 'xexmenu') {
    // File browser list mockup
    ctx.fillStyle = config.panelColor;
    ctx.globalAlpha = 0.82;
    ctx.fillRect(w * 0.06, h * 0.2, w * 0.88, h * 0.62);
    ctx.globalAlpha = 1;

    const rows = ['Hdd1:\\Games\\Futebol_2026\\default.xex', 'Hdd1:\\Games\\Forza_Mod\\default.xex', 'Hdd1:\\Content\\0000000000000000\\', 'Usb0:\\Patches\\mod_pack.zip'];
    rows.forEach((row, idx) => {
      const ry = h * 0.26 + idx * (h * 0.11);
      if (idx === 0) {
        ctx.fillStyle = config.accentColor;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(w * 0.08, ry - h * 0.04, w * 0.84, h * 0.08);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = config.textColor;
      ctx.font = `${Math.round(h * 0.028)}px monospace`;
      ctx.fillText(row, w * 0.1, ry + h * 0.012);
    });
  } else {
    // NXE Blades / Tiles mockup
    const tiles = ['Jogar Agora', 'Biblioteca de Jogos', 'Sistema / RGH', 'Configurações'];
    tiles.forEach((t, idx) => {
      const tx = w * 0.07 + idx * (w * 0.22);
      const ty = h * 0.32;
      const tw = w * 0.19;
      const th = h * 0.34;
      ctx.fillStyle = idx === 0 ? config.accentColor : config.panelColor;
      ctx.globalAlpha = idx === 0 ? 0.9 : 0.78;
      ctx.fillRect(tx, ty, tw, th);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(tx, ty, tw, th);
      ctx.fillStyle = config.textColor;
      ctx.font = `bold ${Math.round(h * 0.024)}px sans-serif`;
      ctx.fillText(t, tx + tw * 0.1, ty + th * 0.82);
    });
  }

  // Footer hints bar
  ctx.fillStyle = config.panelColor;
  ctx.globalAlpha = 0.82;
  ctx.fillRect(0, h * 0.88, w, h * 0.12);
  ctx.globalAlpha = 1;
  ctx.fillStyle = config.textColor;
  ctx.font = `${Math.round(h * 0.024)}px sans-serif`;
  ctx.fillText('(A) Selecionar    (B) Voltar    (Y) Detalhes    (Back) Menu Rápido', w * 0.045, h * 0.95);

  ctx.restore();
}

export function renderSkinIconCanvas(
  config: SkinConfig,
  bgImage: HTMLImageElement | null,
  logoImage: HTMLImageElement | null,
  width: number,
  height: number,
  customIconImage: HTMLImageElement | null = null
): HTMLCanvasElement {
  const effectiveBg = customIconImage ?? bgImage;
  const canvas = renderSkinWallpaperCanvas(
    config,
    effectiveBg,
    customIconImage ? null : logoImage,
    width,
    height,
    false
  );
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.strokeStyle = config.accentColor;
  ctx.lineWidth = Math.max(4, Math.round(width * 0.02));
  ctx.strokeRect(0, 0, width, height);

  if (!customIconImage) {
    ctx.fillStyle = config.panelColor;
    ctx.globalAlpha = 0.82;
    ctx.fillRect(0, height * 0.7, width, height * 0.3);
    ctx.globalAlpha = 1;

    ctx.fillStyle = config.textColor;
    ctx.font = `bold ${Math.round(height * 0.12)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      (config.skinName || 'X360 SKIN').slice(0, 18),
      width / 2,
      height * 0.85
    );
  }

  return canvas;
}

export function generateAuroraSkinXml(config: SkinConfig): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<Skin>',
    `  <Title>${escapeXml(config.skinName)}</Title>`,
    `  <Author>${escapeXml(config.author || 'X360 Mod Studio')}</Author>`,
    `  <Version>${escapeXml(config.version || '1.0')}</Version>`,
    `  <Description>${escapeXml(config.description || 'Skin gerada no X360 Mod Studio')}</Description>`,
    '  <Resolution>1280x720</Resolution>',
    '  <TargetDashboard>Aurora</TargetDashboard>',
    '  <Assets>',
    '    <Background>Media\\Background.png</Background>',
    '    <BackgroundDDS>Media\\Background.dds</BackgroundDDS>',
    '    <Icon>Media\\Icon.png</Icon>',
    '    <Preview>Media\\Preview.png</Preview>',
    '  </Assets>',
    '</Skin>',
    '',
  ].join('\n');
}

export function generateAuroraColorsXml(config: SkinConfig): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<Colors>',
    `  <Accent>${escapeXml(config.accentColor)}</Accent>`,
    `  <BackgroundStart>${escapeXml(config.bgColorStart)}</BackgroundStart>`,
    `  <BackgroundEnd>${escapeXml(config.bgColorEnd)}</BackgroundEnd>`,
    `  <Panel>${escapeXml(config.panelColor)}</Panel>`,
    `  <TextPrimary>${escapeXml(config.textColor)}</TextPrimary>`,
    `  <OverlayOpacity>${config.overlayOpacity}</OverlayOpacity>`,
    '</Colors>',
    '',
  ].join('\n');
}

export function generateAuroraCoverFlowXml(config: SkinConfig): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<CoverFlow>',
    `  <Layout>${escapeXml(config.coverFlowStyle)}</Layout>`,
    '  <ShowReflections>true</ShowReflections>',
    '  <ShowTitleBanner>true</ShowTitleBanner>',
    `  <HighlightColor>${escapeXml(config.accentColor)}</HighlightColor>`,
    '</CoverFlow>',
    '',
  ].join('\n');
}

export function generateFreestyleSkinXml(config: SkinConfig): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<Skin>',
    `  <Name>${escapeXml(config.skinName)}</Name>`,
    `  <Author>${escapeXml(config.author || 'X360 Mod Studio')}</Author>`,
    `  <Version>${escapeXml(config.version || '1.0')}</Version>`,
    '  <MinFSDVersion>3.0</MinFSDVersion>',
    `  <Description>${escapeXml(config.description || 'Skin Freestyle 3 gerada no X360 Mod Studio')}</Description>`,
    '  <Colors>',
    `    <Accent>${escapeXml(config.accentColor)}</Accent>`,
    `    <Panel>${escapeXml(config.panelColor)}</Panel>`,
    `    <Text>${escapeXml(config.textColor)}</Text>`,
    '  </Colors>',
    '</Skin>',
    '',
  ].join('\n');
}

export async function buildSkinPackageZip(
  config: SkinConfig,
  bgImage: HTMLImageElement | null,
  logoImage: HTMLImageElement | null,
  customIconImage: HTMLImageElement | null = null
): Promise<{ zipBytes: Uint8Array; fileList: string[] }> {
  const enc = new TextEncoder();
  const folderSlug = sanitizeSkinFolderName(config.skinName);

  const wallCanvas = renderSkinWallpaperCanvas(config, bgImage, logoImage, 1280, 720, false);
  const previewCanvas = renderSkinWallpaperCanvas(config, bgImage, logoImage, 640, 360, true);
  const iconCanvas = renderSkinIconCanvas(config, bgImage, logoImage, 256, 256, customIconImage);

  const wallPng = await canvasToPngBytes(wallCanvas);
  const previewPng = await canvasToPngBytes(previewCanvas);
  const iconPng = await canvasToPngBytes(iconCanvas);

  const entries: ZipInputEntry[] = [];

  if (config.target === 'aurora') {
    const base = `Aurora/Skins/${folderSlug}`;
    entries.push({ path: `${base}/skin.xml`, data: enc.encode(generateAuroraSkinXml(config)) });
    entries.push({ path: `${base}/Skin/Colors.xml`, data: enc.encode(generateAuroraColorsXml(config)) });
    entries.push({ path: `${base}/Skin/CoverFlow.xml`, data: enc.encode(generateAuroraCoverFlowXml(config)) });
    entries.push({ path: `${base}/Media/Background.png`, data: wallPng });
    entries.push({ path: `${base}/Media/Preview.png`, data: previewPng });
    entries.push({ path: `${base}/Media/Icon.png`, data: iconPng });
    if (config.includeDds) {
      entries.push({ path: `${base}/Media/Background.dds`, data: encodeCanvasToDds32(wallCanvas) });
    }
    if (config.includeTga) {
      entries.push({ path: `${base}/Media/Background.tga`, data: encodeCanvasToTga32(wallCanvas) });
    }
    entries.push({
      path: `${base}/LEIA_ME_AURORA.txt`,
      data: enc.encode(
        [
          `Skin Aurora: ${config.skinName}`,
          `Copie a pasta "${folderSlug}" para Hdd1:\\Aurora\\Skins\\${folderSlug}\\`,
          'Depois abra a Aurora, pressione Start -> Skins e selecione a nova skin.',
        ].join('\n')
      ),
    });
  } else if (config.target === 'freestyle') {
    const base = `Freestyle/Skins/${folderSlug}`;
    entries.push({ path: `${base}/Skin.xml`, data: enc.encode(generateFreestyleSkinXml(config)) });
    entries.push({
      path: `${base}/Scripts/skin_settings.ini`,
      data: enc.encode(
        [
          '[FreestyleSkin]',
          `Name=${config.skinName}`,
          `AccentColor=${config.accentColor}`,
          `PanelColor=${config.panelColor}`,
          `TextColor=${config.textColor}`,
          `Layout=${config.coverFlowStyle}`,
        ].join('\n')
      ),
    });
    entries.push({ path: `${base}/Images/background.png`, data: wallPng });
    entries.push({ path: `${base}/Images/preview.png`, data: previewPng });
    entries.push({ path: `${base}/Images/icon.png`, data: iconPng });
    const coverCanvas = renderSkinIconCanvas(config, bgImage, logoImage, 350, 500);
    entries.push({ path: `${base}/Images/cover_frame.png`, data: await canvasToPngBytes(coverCanvas) });
    if (config.includeDds) {
      entries.push({ path: `${base}/Images/background.dds`, data: encodeCanvasToDds32(wallCanvas) });
    }
    if (config.includeTga) {
      entries.push({ path: `${base}/Images/background.tga`, data: encodeCanvasToTga32(wallCanvas) });
    }
    entries.push({
      path: `${base}/LEIA_ME_FREESTYLE.txt`,
      data: enc.encode(
        [
          `Skin Freestyle 3 (FSD): ${config.skinName}`,
          `Copie a pasta "${folderSlug}" para Hdd1:\\Freestyle\\Skins\\${folderSlug}\\`,
          'Na FSD3, acesse Settings -> Customize Skins e ative.',
        ].join('\n')
      ),
    });
  } else if (config.target === 'xexmenu') {
    const base = `XeXMenu_${folderSlug}`;
    entries.push({ path: `${base}/background.png`, data: wallPng });
    entries.push({ path: `${base}/background.tga`, data: encodeCanvasToTga32(wallCanvas) });
    if (config.includeDds) {
      entries.push({ path: `${base}/background.dds`, data: encodeCanvasToDds32(wallCanvas) });
    }
    entries.push({
      path: `${base}/xexmenu_theme.ini`,
      data: enc.encode(
        [
          '[XeXMenuTheme]',
          `Skin=${config.skinName}`,
          `Accent=${config.accentColor}`,
          `Text=${config.textColor}`,
        ].join('\n')
      ),
    });
    entries.push({
      path: `${base}/LEIA_ME_XEXMENU.txt`,
      data: enc.encode(
        'Copie background.tga / background.png para a pasta do XeXMenu no seu Hdd1:\\ ou Usb0:\\.'
      ),
    });
  } else {
    const base = `Content/0000000000000000/FFFE07D1/00030000/${folderSlug}`;
    entries.push({ path: `${base}/Wallpaper_1280x720.png`, data: wallPng });
    entries.push({ path: `${base}/Wallpaper_1280x720.dds`, data: encodeCanvasToDds32(wallCanvas) });
    const tileCanvas = renderSkinIconCanvas(config, bgImage, logoImage, 512, 512);
    entries.push({ path: `${base}/AvatarTile_512x512.png`, data: await canvasToPngBytes(tileCanvas) });
    if (config.includeTga) {
      entries.push({ path: `${base}/Wallpaper_1280x720.tga`, data: encodeCanvasToTga32(wallCanvas) });
    }
    entries.push({
      path: `${base}/ThemeConfig.ini`,
      data: enc.encode(
        [
          '[NXETheme]',
          `Name=${config.skinName}`,
          `Author=${config.author}`,
          `AccentColor=${config.accentColor}`,
        ].join('\n')
      ),
    });
  }

  return {
    zipBytes: createZipArchive(entries),
    fileList: entries.map((e) => e.path),
  };
}
