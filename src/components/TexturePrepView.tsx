import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileUp,
  FlaskConical,
  FolderArchive,
  Image as ImageIcon,
} from 'lucide-react';
import { triggerBinaryDownload } from '../utils/binaryPatch';
import { canvasToPngBytes, encodeCanvasToDds32 } from '../utils/skinCreator';
import {
  buildFormattedImageZip,
  encodeCanvasToTga32WithFlip,
  renderFormattedX360Canvas,
  X360_IMAGE_CATEGORIES,
  X360_IMAGE_PRESETS,
  type X360BadgeStyle,
  type X360FitMode,
  type X360ImageCategory,
  type X360ImagePreset,
} from '../utils/xboxImageFormatter';

interface TexturePrepViewProps {
  defaultTitleId?: string;
}

export function TexturePrepView({ defaultTitleId = '4B4E084F' }: TexturePrepViewProps) {
  const [activeCategory, setActiveCategory] = useState<X360ImageCategory>('game_cover');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('aurora_cover');

  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);
  const [sourceName, setSourceName] = useState('capa_x360');
  const [fitMode, setFitMode] = useState<X360FitMode>('cover');
  const [bgColor, setBgColor] = useState('#0B111E');
  const [badgeStyle, setBadgeStyle] = useState<X360BadgeStyle>('xbox360');
  const [customTitle, setCustomTitle] = useState('');
  const [titleId, setTitleId] = useState(defaultTitleId);
  const [flipVerticalTga, setFlipVerticalTga] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const categoryPresets = useMemo(
    () => X360_IMAGE_PRESETS.filter((p) => p.category === activeCategory),
    [activeCategory]
  );

  const selectedPreset: X360ImagePreset = useMemo(
    () =>
      categoryPresets.find((p) => p.id === selectedPresetId) ??
      categoryPresets[0] ??
      X360_IMAGE_PRESETS[0],
    [categoryPresets, selectedPresetId]
  );

  const handleSelectCategory = (cat: X360ImageCategory) => {
    setActiveCategory(cat);
    const first = X360_IMAGE_PRESETS.find((p) => p.category === cat);
    if (first) {
      setSelectedPresetId(first.id);
    }
    if (cat === 'homebrew') {
      setBadgeStyle('homebrew');
    } else if (cat === 'game_cover' || cat === 'full_box') {
      setBadgeStyle('xbox360');
    } else {
      setBadgeStyle('none');
    }
  };

  const loadImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setExportNotice('Envie um arquivo de imagem válido (PNG, JPG, WebP, BMP ou SVG).');
      return;
    }
    const base = file.name.replace(/\.[^.]+$/, '');
    setSourceName(base || 'imagem_x360');
    setExportNotice(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSourceImg(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setExportNotice('Não foi possível decodificar essa imagem.');
    };
    img.src = url;
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadImageFile(f);
    e.target.value = '';
  };

  const handleDropImage = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) loadImageFile(f);
  };

  const handleLoadSampleGraphic = () => {
    const temp = document.createElement('canvas');
    temp.width = 700;
    temp.height = 1000;
    const ctx = temp.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 700, 1000);
    grad.addColorStop(0, '#091911');
    grad.addColorStop(1, '#14532D');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 700, 1000);

    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 14;
    ctx.strokeRect(48, 48, 604, 904);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 82px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('X360 MOD', 350, 440);

    ctx.fillStyle = '#86EFAC';
    ctx.font = 'bold 34px monospace';
    ctx.fillText('EDITION 2026', 350, 520);

    const img = new Image();
    img.onload = () => {
      setSourceImg(img);
      setSourceName('arte_exemplo_x360');
      setExportNotice(null);
    };
    img.src = temp.toDataURL('image/png');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImg) return;

    const rendered = renderFormattedX360Canvas(sourceImg, selectedPreset, {
      fitMode,
      bgColor,
      badgeStyle,
      customTitle,
      titleId,
      roundedPreview: false,
      flipVerticalTga,
    });

    canvas.width = rendered.width;
    canvas.height = rendered.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(rendered, 0, 0);
  }, [sourceImg, selectedPreset, fitMode, bgColor, badgeStyle, customTitle, titleId, flipVerticalTga]);

  const handleDownloadPng = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImg) return;
    const pngBytes = await canvasToPngBytes(canvas);
    triggerBinaryDownload(
      pngBytes,
      `${sourceName}_${selectedPreset.width}x${selectedPreset.height}.png`,
      'image/png'
    );
    setExportNotice('Arquivo .PNG baixado no formato exato para Xbox 360!');
  };

  const handleDownloadDds = () => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImg) return;
    const ddsBytes = encodeCanvasToDds32(canvas);
    triggerBinaryDownload(
      ddsBytes,
      `${sourceName}_${selectedPreset.width}x${selectedPreset.height}.dds`,
      'application/octet-stream'
    );
    setExportNotice('Textura .DDS (32-bit BGRA) baixada!');
  };

  const handleDownloadTga = () => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImg) return;
    const tgaBytes = encodeCanvasToTga32WithFlip(canvas, flipVerticalTga);
    triggerBinaryDownload(
      tgaBytes,
      `${sourceName}_${selectedPreset.width}x${selectedPreset.height}.tga`,
      'application/octet-stream'
    );
    setExportNotice('Imagem .TGA (32-bit) baixada!');
  };

  const handleDownloadZip = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImg) return;
    const { zipBytes, fileList } = await buildFormattedImageZip(
      canvas,
      selectedPreset,
      sourceName,
      titleId,
      flipVerticalTga
    );
    triggerBinaryDownload(
      zipBytes,
      `${sourceName}_${selectedPreset.id}_x360.zip`,
      'application/zip'
    );
    setExportNotice(
      `Pacote .ZIP gerado com ${fileList.length} arquivos (.PNG, .DDS, .TGA e instruções)!`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Criador de Capas, Homebrew &amp; Texturas Xbox 360
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Envie qualquer imagem do seu gosto para criar capas de games, ícones de homebrew, banners 720p ou texturas — tudo já formatado para Aurora, Freestyle 3 e Xbox 360 (.PNG / .DDS / .TGA / .ZIP).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleLoadSampleGraphic}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-800/60 hover:bg-emerald-900/50 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Arte Exemplo
          </button>
          <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0">
            <FileUp className="w-4 h-4" />
            Enviar Minha Imagem
            <input type="file" accept="image/*" className="hidden" onChange={handleUploadImage} />
          </label>
        </div>
      </div>

      {/* Category Selection Bar */}
      <section
        aria-label="Tipo de Arte Xbox 360"
        className="bg-[#141D2F] border border-slate-800 rounded-lg p-4 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Barra de Seleção · O que você deseja criar?
          </span>
          <span className="text-xs font-mono text-emerald-400 truncate">
            Destino: {selectedPreset.consolePathHint}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {X360_IMAGE_CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectCategory(cat.id)}
                className={`text-left p-3 rounded-md border transition-colors ${
                  active
                    ? 'bg-emerald-600/15 border-emerald-500 text-white'
                    : 'bg-[#0B111E] border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold">{cat.label}</div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">{cat.shortDesc}</div>
              </button>
            );
          })}
        </div>
      </section>

      {exportNotice && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-950/40 border border-emerald-700/50 rounded-md text-xs text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Controls */}
        <div className="xl:col-span-5 bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-5">
          {/* Quick Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDropImage}
            className={`border-2 border-dashed rounded-md p-4 text-center transition-colors ${
              dragActive
                ? 'border-emerald-400 bg-emerald-950/30'
                : 'border-slate-700 bg-[#0B111E] hover:border-slate-500'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <FileUp className="w-5 h-5 text-emerald-400" />
              <div className="text-xs font-medium text-white">
                {sourceImg
                  ? `Imagem carregada: ${sourceName}`
                  : 'Arraste ou envie sua imagem aqui'}
              </div>
              <p className="text-[11px] text-slate-400">
                Aceita PNG, JPG, WebP, BMP ou SVG — redimensiona sozinho para Xbox 360.
              </p>
              <label className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded cursor-pointer">
                Selecionar Imagem do PC / Celular
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadImage}
                />
              </label>
            </div>
          </div>

          {/* Preset selector inside category */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-300">
              Formato / Resolução Exata Xbox 360
            </span>
            <div className="space-y-1.5">
              {categoryPresets.map((preset) => {
                const active = selectedPreset.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={`w-full text-left px-3 py-2.5 text-xs rounded-md border transition-colors ${
                      active
                        ? 'bg-emerald-600/15 border-emerald-500/40 text-white'
                        : 'bg-[#0B111E] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{preset.label}</span>
                      <span className="font-mono tabular-nums text-emerald-400 shrink-0">
                        {preset.dimensionsLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{preset.usage}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Enquadramento */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-300">
              Ajuste da Sua Imagem
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'cover', label: 'Preencher (Recortar)' },
                  { id: 'contain_blur', label: 'Inteira + Fundo Blur' },
                  { id: 'contain_solid', label: 'Inteira + Cor Sólida' },
                  { id: 'stretch', label: 'Esticar 100%' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setFitMode(mode.id)}
                  className={`px-2.5 py-2 text-xs font-medium rounded-md border transition-colors ${
                    fitMode === mode.id
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-[#0B111E] text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            {fitMode === 'contain_solid' && (
              <label className="flex items-center justify-between px-3 py-2 bg-[#0B111E] border border-slate-800 rounded-md text-xs text-slate-300">
                <span>Cor das bordas / fundo</span>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-6 h-6 bg-transparent border-0 cursor-pointer"
                />
              </label>
            )}
          </div>

          {/* Selo e Texto Opcional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Selo / Faixa Superior
              </label>
              <select
                value={badgeStyle}
                onChange={(e) => setBadgeStyle(e.target.value as X360BadgeStyle)}
                className="w-full px-2.5 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              >
                <option value="none">Sem faixa (Imagem pura)</option>
                <option value="xbox360">Faixa Verde XBOX 360</option>
                <option value="homebrew">Faixa Azul HOMEBREW · RGH</option>
                <option value="xbla">Faixa XBOX LIVE ARCADE</option>
                <option value="mod">Faixa X360 MOD EDITION</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Title ID (8 dígitos hex)
              </label>
              <input
                type="text"
                maxLength={8}
                value={titleId}
                onChange={(e) => setTitleId(e.target.value.toUpperCase())}
                placeholder="4B4E084F"
                className="w-full px-2.5 py-2 text-xs font-mono uppercase bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Título na Capa / Ícone (opcional)
              </label>
              <input
                type="text"
                maxLength={34}
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Deixe em branco para manter apenas a imagem"
                className="w-full px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 placeholder:text-slate-500"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={flipVerticalTga}
              onChange={(e) => setFlipVerticalTga(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-emerald-600 rounded"
            />
            <span>
              Inverter eixo vertical ao exportar <strong>.TGA</strong> (compatibilidade com ferramentas antigas DXT/DDS).
            </span>
          </label>

          {/* Export Buttons */}
          <div className="pt-3 border-t border-slate-800 space-y-2.5">
            <button
              type="button"
              disabled={!sourceImg}
              onClick={() => void handleDownloadZip()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-md transition-colors"
            >
              <FolderArchive className="w-4 h-4" />
              Baixar Pacote Pronto (.ZIP com PNG + DDS + TGA)
            </button>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={!sourceImg}
                onClick={() => void handleDownloadPng()}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 border border-slate-700 rounded-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                .PNG
              </button>
              <button
                type="button"
                disabled={!sourceImg}
                onClick={handleDownloadDds}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-emerald-300 border border-slate-700 rounded-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                .DDS
              </button>
              <button
                type="button"
                disabled={!sourceImg}
                onClick={handleDownloadTga}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 border border-slate-700 rounded-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                .TGA
              </button>
            </div>
          </div>
        </div>

        {/* Right Preview */}
        <div className="xl:col-span-7 bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <span className="text-sm font-semibold text-white">
                Prévia Formatada — {selectedPreset.label}
              </span>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                {selectedPreset.consolePathHint}
              </div>
            </div>
            <span className="text-xs font-mono tabular-nums text-emerald-400">
              {selectedPreset.width} × {selectedPreset.height} px
            </span>
          </div>

          {sourceImg ? (
            <div className="flex items-center justify-center p-6 bg-[#0B111E] border border-slate-800 rounded-md min-h-[380px]">
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-[500px] border border-slate-700 rounded shadow-lg"
              />
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDropImage}
              className="flex flex-col items-center justify-center p-12 bg-[#0B111E] border border-slate-800 rounded-md min-h-[380px] text-center"
            >
              <ImageIcon className="w-10 h-10 text-slate-500 mb-3" />
              <div className="text-sm font-medium text-white">
                Envie sua imagem para formatar no padrão Xbox 360
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                Arraste qualquer capa, foto, logotipo ou arte para cá (ou clique em &ldquo;Enviar Minha Imagem&rdquo;). O sistema ajusta automaticamente para{' '}
                <span className="font-mono text-emerald-300">
                  {selectedPreset.width}×{selectedPreset.height}
                </span>{' '}
                e exporta em .PNG, .DDS, .TGA e .ZIP.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
