import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileUp,
  FolderTree,
  Image as ImageIcon,
  Palette,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { triggerBinaryDownload } from '../utils/binaryPatch';
import {
  buildSkinPackageZip,
  canvasToPngBytes,
  DASHBOARD_TARGETS,
  encodeCanvasToDds32,
  encodeCanvasToTga32,
  renderSkinWallpaperCanvas,
  sanitizeSkinFolderName,
  SKIN_COLOR_PRESETS,
  type SkinConfig,
  type SkinDashboardTarget,
} from '../utils/skinCreator';

export function SkinCreatorView() {
  const [config, setConfig] = useState<SkinConfig>({
    target: 'aurora',
    skinName: 'Aurora Esmeralda Pro',
    author: 'Josuel Roque',
    version: '1.0',
    description: 'Tema personalizado em 720p para Xbox 360 RGH/JTAG.',
    bgColorStart: '#07140D',
    bgColorEnd: '#0F2E1C',
    accentColor: '#16A34A',
    panelColor: '#0E1C14',
    textColor: '#F8FAFC',
    overlayOpacity: 35,
    showGridPattern: true,
    coverFlowStyle: 'CoverFlow',
    includeDds: true,
    includeTga: true,
    bgFitMode: 'cover',
  });

  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgFileName, setBgFileName] = useState<string | null>(null);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [iconImage, setIconImage] = useState<HTMLImageElement | null>(null);
  const [iconFileName, setIconFileName] = useState<string | null>(null);
  const [showUiMockup, setShowUiMockup] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeTargetMeta = useMemo(
    () =>
      DASHBOARD_TARGETS.find((t) => t.id === config.target) ?? DASHBOARD_TARGETS[0],
    [config.target]
  );

  const handleLoadImage = (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'bg' | 'logo' | 'icon'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (kind === 'bg') {
        setBgImage(img);
        setBgFileName(file.name);
      } else if (kind === 'logo') {
        setLogoImage(img);
        setLogoFileName(file.name);
      } else {
        setIconImage(img);
        setIconFileName(file.name);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
    e.target.value = '';
  };

  useEffect(() => {
    const targetCanvas = previewCanvasRef.current;
    if (!targetCanvas) return;
    const rendered = renderSkinWallpaperCanvas(
      config,
      bgImage,
      logoImage,
      1280,
      720,
      showUiMockup
    );
    targetCanvas.width = 1280;
    targetCanvas.height = 720;
    const ctx = targetCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 1280, 720);
      ctx.drawImage(rendered, 0, 0);
    }
  }, [config, bgImage, logoImage, showUiMockup]);

  const handleExportZip = async () => {
    setExporting(true);
    setStatusMessage(null);
    try {
      const { zipBytes, fileList } = await buildSkinPackageZip(
        config,
        bgImage,
        logoImage,
        iconImage
      );
      const slug = sanitizeSkinFolderName(config.skinName);
      triggerBinaryDownload(
        zipBytes,
        `${slug}_${config.target}_skin_x360.zip`,
        'application/zip'
      );
      setStatusMessage(
        `Skin "${config.skinName}" para ${activeTargetMeta.shortLabel} empacotada com ${fileList.length} arquivo(s)!`
      );
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadWallpaper = async (fmt: 'dds' | 'tga' | 'png') => {
    const cleanCanvas = renderSkinWallpaperCanvas(
      config,
      bgImage,
      logoImage,
      1280,
      720,
      false
    );
    const slug = sanitizeSkinFolderName(config.skinName);
    if (fmt === 'dds') {
      triggerBinaryDownload(encodeCanvasToDds32(cleanCanvas), `${slug}_Background_1280x720.dds`);
    } else if (fmt === 'tga') {
      triggerBinaryDownload(encodeCanvasToTga32(cleanCanvas), `${slug}_Background_1280x720.tga`);
    } else {
      const png = await canvasToPngBytes(cleanCanvas);
      triggerBinaryDownload(png, `${slug}_Background_1280x720.png`, 'image/png');
    }
  };

  const applyPreset = (presetId: string) => {
    const found = SKIN_COLOR_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setConfig((prev) => ({
      ...prev,
      bgColorStart: found.bgColorStart,
      bgColorEnd: found.bgColorEnd,
      accentColor: found.accentColor,
      panelColor: found.panelColor,
      textColor: found.textColor,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Criador de Skins Xbox 360 (Aurora, Freestyle &amp; Dash)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Escolha a dashboard na barra de seleção abaixo, personalize cores e fundo 1280×720 e exporte no formato de pastas, XML e texturas (.DDS / .TGA / .PNG) do console.
          </p>
        </div>

        <button
          type="button"
          disabled={exporting}
          onClick={() => void handleExportZip()}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-md transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
        >
          <Download className="w-4 h-4" />
          {exporting
            ? 'Gerando Skin...'
            : `Baixar Skin ${activeTargetMeta.shortLabel} (.ZIP)`}
        </button>
      </div>

      {/* Dashboard Target Selection Bar */}
      <section
        aria-label="Seleção de Dashboard"
        className="bg-[#141D2F] border border-slate-800 rounded-lg p-4 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Barra de Seleção · Para qual sistema deseja criar a Skin?
          </span>
          <span className="text-xs font-mono text-emerald-400">
            Destino: {activeTargetMeta.installPath}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {DASHBOARD_TARGETS.map((target) => {
            const active = config.target === target.id;
            return (
              <button
                key={target.id}
                type="button"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    target: target.id as SkinDashboardTarget,
                  }))
                }
                className={`text-left p-3 rounded-md border transition-colors ${
                  active
                    ? 'bg-emerald-600/15 border-emerald-500 text-white'
                    : 'bg-[#0B111E] border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                <div className="text-sm font-bold">{target.label}</div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                  {target.installPath}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-slate-300">{activeTargetMeta.description}</p>
      </section>

      {statusMessage && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-950/40 border border-emerald-700/50 rounded-md text-xs text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Main Editor + Live Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Controls */}
        <div className="xl:col-span-5 bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Palette className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">
              Identidade, Cores e Imagens
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nome da Skin
              </label>
              <input
                type="text"
                maxLength={60}
                value={config.skinName}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, skinName: e.target.value }))
                }
                className="w-full px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Autor
              </label>
              <input
                type="text"
                maxLength={40}
                value={config.author}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, author: e.target.value }))
                }
                className="w-full px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Versão
              </label>
              <input
                type="text"
                maxLength={16}
                value={config.version}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, version: e.target.value }))
                }
                className="w-full px-3 py-2 text-xs font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
            </div>
          </div>

          {/* Preset Themes */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-300">
              Temas Rápidos
            </span>
            <div className="grid grid-cols-2 gap-2">
              {SKIN_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className="flex items-center gap-2 px-2.5 py-2 text-xs bg-[#0B111E] hover:bg-slate-800 border border-slate-800 rounded-md text-slate-200 transition-colors"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-sm shrink-0 border border-white/20"
                    style={{ backgroundColor: preset.accentColor }}
                  />
                  <span className="truncate">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color Pickers */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(
              [
                { key: 'accentColor', label: 'Cor Destaque' },
                { key: 'bgColorStart', label: 'Fundo Topo' },
                { key: 'bgColorEnd', label: 'Fundo Base' },
                { key: 'panelColor', label: 'Cor Painéis' },
                { key: 'textColor', label: 'Cor Texto' },
              ] as const
            ).map((field) => (
              <label
                key={field.key}
                className="flex items-center justify-between gap-2 px-2.5 py-2 bg-[#0B111E] border border-slate-800 rounded-md text-xs text-slate-300 cursor-pointer"
              >
                <span className="truncate">{field.label}</span>
                <input
                  type="color"
                  value={config[field.key]}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="w-6 h-6 bg-transparent border-0 cursor-pointer shrink-0"
                />
              </label>
            ))}

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Layout CoverFlow
              </label>
              <select
                value={config.coverFlowStyle}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    coverFlowStyle: e.target.value as SkinConfig['coverFlowStyle'],
                  }))
                }
                className="w-full px-2 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              >
                <option value="CoverFlow">CoverFlow 3D</option>
                <option value="Grade">Grade de Capas</option>
                <option value="Lista">Lista</option>
              </select>
            </div>
          </div>

          {/* Image Uploads */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-200">
                  Imagem de Fundo (Wallpaper 1280×720)
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {bgFileName || 'Usando gradiente gerado'}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-md cursor-pointer">
                  <FileUp className="w-3.5 h-3.5" />
                  Enviar
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLoadImage(e, 'bg')}
                  />
                </label>
                {bgImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setBgImage(null);
                      setBgFileName(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-400"
                    title="Remover imagem"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-200">
                  Logotipo no Cabeçalho (opcional)
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {logoFileName || 'Nenhum logotipo enviado'}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-md cursor-pointer">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Logo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLoadImage(e, 'logo')}
                  />
                </label>
                {logoImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoImage(null);
                      setLogoFileName(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-400"
                    title="Remover logo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-200">
                  Ícone da Skin (256×256, opcional)
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {iconFileName || 'Gerado automaticamente com o fundo'}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-md cursor-pointer">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Ícone
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLoadImage(e, 'icon')}
                  />
                </label>
                {iconImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setIconImage(null);
                      setIconFileName(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-400"
                    title="Remover ícone"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {bgImage && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, bgFitMode: 'cover' }))}
                  className={`px-2.5 py-1.5 text-[11px] font-medium rounded border transition-colors ${
                    config.bgFitMode !== 'contain_blur'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                      : 'bg-[#0B111E] border-slate-800 text-slate-400'
                  }`}
                >
                  Fundo: Preencher 720p
                </button>
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, bgFitMode: 'contain_blur' }))}
                  className={`px-2.5 py-1.5 text-[11px] font-medium rounded border transition-colors ${
                    config.bgFitMode === 'contain_blur'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                      : 'bg-[#0B111E] border-slate-800 text-slate-400'
                  }`}
                >
                  Fundo: Inteiro + Blur
                </button>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                <span>Escurecimento sobre o fundo</span>
                <span className="font-mono tabular-nums">{config.overlayOpacity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={85}
                value={config.overlayOpacity}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    overlayOpacity: Number(e.target.value),
                  }))
                }
                className="w-full accent-emerald-600"
              />
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showGridPattern}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      showGridPattern: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-600 bg-[#0B111E] text-emerald-500"
                />
                Grade sutil no plano de fundo
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeDds}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, includeDds: e.target.checked }))
                  }
                  className="rounded border-slate-600 bg-[#0B111E] text-emerald-500"
                />
                Incluir textura <strong>.DDS</strong> (32-bit BGRA padrão Xbox 360)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeTga}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, includeTga: e.target.checked }))
                  }
                  className="rounded border-slate-600 bg-[#0B111E] text-emerald-500"
                />
                Incluir textura <strong>.TGA</strong> (32-bit) no pacote
              </label>
            </div>
          </div>
        </div>

        {/* Right Live Preview & Package Manifest */}
        <div className="xl:col-span-7 space-y-5">
          <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-white">
                  Prévia em Tela (1280 × 720 · {activeTargetMeta.shortLabel})
                </span>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showUiMockup}
                  onChange={(e) => setShowUiMockup(e.target.checked)}
                  className="rounded border-slate-600 bg-[#0B111E] text-emerald-500"
                />
                Simular interface da dashboard
              </label>
            </div>

            <div className="bg-[#0B111E] border border-slate-800 rounded-md p-2 overflow-hidden">
              <canvas
                ref={previewCanvasRef}
                className="w-full h-auto rounded border border-slate-800 block"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-xs text-slate-400">
                Exportar somente imagem de fundo (1280×720):
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownloadWallpaper('dds')}
                  className="px-3 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-md"
                >
                  .DDS
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadWallpaper('tga')}
                  className="px-3 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md"
                >
                  .TGA
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadWallpaper('png')}
                  className="px-3 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md"
                >
                  .PNG
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <FolderTree className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">
                Arquivos que serão gerados para {activeTargetMeta.label}
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px] text-emerald-300">
              {activeTargetMeta.mainAssets.map((asset) => (
                <div
                  key={asset}
                  className="px-3 py-2 bg-[#0B111E] border border-slate-800 rounded truncate"
                >
                  {asset}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
