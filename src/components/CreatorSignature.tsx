import React, { useEffect, useState } from 'react';
import { Camera, Check, Download, FileUp, Trash2, X } from 'lucide-react';
import { triggerBinaryDownload } from '../utils/binaryPatch';

const LOCAL_PHOTO_KEY = 'x360_creator_photo_v1';
const PHOTO_EVENT = 'x360-creator-photo-changed';

export function isSafeCreatorPhotoUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return /^https?:\/\/.+/i.test(trimmed) || /^(\/|\.\/)[a-zA-Z0-9._/-]+$/.test(trimmed);
}

function loadLocalCreatorPhoto(): string {
  try {
    return localStorage.getItem(LOCAL_PHOTO_KEY) || '';
  } catch {
    return '';
  }
}

function saveLocalCreatorPhoto(dataUrl: string): void {
  try {
    if (dataUrl) {
      localStorage.setItem(LOCAL_PHOTO_KEY, dataUrl);
    } else {
      localStorage.removeItem(LOCAL_PHOTO_KEY);
    }
    window.dispatchEvent(new CustomEvent(PHOTO_EVENT));
  } catch {
    // Ignore storage quota issues
  }
}

async function cropImageFileToSquareDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Falha ao carregar foto.'));
      el.src = url;
    });
    const size = 200;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível.');

    const scale = Math.max(size / img.width, size / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
    return canvas.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface CreatorSignatureProps {
  variant?: 'sidebar' | 'footer';
  photoUrl?: string;
  isAdmin?: boolean;
  onSavePhotoUrl?: (nextUrl: string) => Promise<void>;
}

export function CreatorSignature({
  variant = 'footer',
  photoUrl = '',
  isAdmin = false,
  onSavePhotoUrl,
}: CreatorSignatureProps) {
  const [localPhoto, setLocalPhoto] = useState<string>(() => loadLocalCreatorPhoto());
  const [imgFailed, setImgFailed] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [urlInput, setUrlInput] = useState(photoUrl);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setUrlInput(photoUrl);
    setImgFailed(false);
  }, [photoUrl]);

  useEffect(() => {
    const onSync = () => {
      setLocalPhoto(loadLocalCreatorPhoto());
      setImgFailed(false);
    };
    window.addEventListener(PHOTO_EVENT, onSync);
    return () => window.removeEventListener(PHOTO_EVENT, onSync);
  }, []);

  const remoteValidUrl = isSafeCreatorPhotoUrl(photoUrl) ? photoUrl.trim() : '';
  const activePhotoSrc = !imgFailed ? localPhoto || remoteValidUrl : '';

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const cropped = await cropImageFileToSquareDataUrl(file);
      saveLocalCreatorPhoto(cropped);
      setLocalPhoto(cropped);
      setImgFailed(false);
      setNotice(
        'Foto aplicada neste dispositivo! Para exibir para todos os visitantes online, cole um link HTTPS ou baixe creator-photo.jpg para a pasta public/.'
      );
    } catch {
      setNotice('Não foi possível processar essa imagem.');
    }
  };

  const handleDownloadStaticPhoto = async () => {
    if (!localPhoto) return;
    const res = await fetch(localPhoto);
    const bytes = new Uint8Array(await res.arrayBuffer());
    triggerBinaryDownload(bytes, 'creator-photo.jpg', 'image/jpeg');
  };

  const handleSaveUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSavePhotoUrl) return;
    const trimmed = urlInput.trim();
    if (trimmed && !isSafeCreatorPhotoUrl(trimmed)) {
      setNotice('Informe uma URL válida começando com https:// ou /');
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await onSavePhotoUrl(trimmed);
      setNotice(
        trimmed
          ? 'Link da foto salvo para todos os visitantes!'
          : 'Foto pública removida.'
      );
      setEditorOpen(false);
    } catch {
      setNotice('Erro ao salvar link da foto no banco.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAllPhotos = async () => {
    saveLocalCreatorPhoto('');
    setLocalPhoto('');
    setUrlInput('');
    if (onSavePhotoUrl && photoUrl) {
      try {
        await onSavePhotoUrl('');
      } catch {
        // Ignore
      }
    }
    setNotice('Foto removida.');
  };

  if (variant === 'sidebar') {
    return (
      <div className="px-3.5 py-2.5 border-t border-slate-800/80 bg-[#0B111E]/70 shrink-0">
        <div className="flex items-center gap-2.5">
          {activePhotoSrc ? (
            <img
              src={activePhotoSrc}
              alt="Josuel Roque"
              onError={() => setImgFailed(true)}
              className="w-9 h-9 rounded-md object-cover border border-emerald-500/60 shrink-0 bg-slate-900"
            />
          ) : (
            <div className="w-9 h-9 rounded-md bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-mono font-bold tracking-tighter text-emerald-400">
                JR
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
              Assinatura Oficial
            </div>
            <div className="font-signature text-2xl leading-none text-emerald-300 truncate pt-0.5">
              Josuel Roque
            </div>
            <svg
              viewBox="0 0 140 8"
              className="w-28 h-2 text-emerald-500/80 mt-0.5"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 5.5C34 1.5 92 1.2 138 4.2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <footer className="mt-12 pt-6 border-t border-slate-800/90 space-y-3">
      <div className="bg-[#0E1525] border border-slate-800 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {/* Creator Photo / Monogram Seal */}
          <div className="relative shrink-0">
            {activePhotoSrc ? (
              <img
                src={activePhotoSrc}
                alt="Foto de Josuel Roque"
                onError={() => setImgFailed(true)}
                className="w-14 h-14 rounded-md object-cover border-2 border-emerald-500/70 bg-slate-900 shadow-sm"
              />
            ) : (
              <div className="w-14 h-14 rounded-md bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center">
                <svg
                  viewBox="0 0 40 40"
                  className="w-9 h-9"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="3"
                    y="3"
                    width="34"
                    height="34"
                    rx="5"
                    stroke="#10B981"
                    strokeWidth="1.5"
                    strokeOpacity="0.6"
                  />
                  <text
                    x="20"
                    y="24"
                    textAnchor="middle"
                    fill="#34D399"
                    fontSize="14"
                    fontWeight="700"
                    fontFamily="monospace"
                    letterSpacing="-0.5"
                  >
                    JR
                  </text>
                </svg>
              </div>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={() => setEditorOpen((v) => !v)}
                title="Adicionar ou alterar foto ao lado da assinatura"
                className="absolute -bottom-1.5 -right-1.5 p-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white border border-[#0E1525] shadow transition-colors"
              >
                <Camera className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-emerald-400 font-semibold">
              Criado &amp; Assinado por
            </div>
            <div className="flex flex-col">
              <span className="font-signature text-3xl sm:text-4xl text-white leading-none pt-1 tracking-wide">
                Josuel Roque
              </span>
              <svg
                viewBox="0 0 220 12"
                className="w-44 sm:w-52 h-3 text-emerald-500 mt-0.5"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 8.5C52 2.5 142 1.8 216 6.2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M28 10.5C78 7.5 135 7.2 178 9.2"
                  stroke="currentColor"
                  strokeOpacity="0.45"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="sm:text-right space-y-1.5 shrink-0">
          <div className="text-xs font-semibold text-slate-200">
            X360 Mod Studio · Edição Oficial
          </div>
          <div className="text-[11px] text-slate-400">
            Desenvolvimento, Ferramentas RGH/JTAG &amp; Skins · © {new Date().getFullYear()} Josuel Roque
          </div>
          {isAdmin && (
            <div className="flex sm:justify-end">
              <button
                type="button"
                onClick={() => setEditorOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded transition-colors"
              >
                <Camera className="w-3 h-3" />
                {activePhotoSrc ? 'Alterar Foto da Assinatura' : 'Colocar Foto na Assinatura'}
              </button>
            </div>
          )}
        </div>
      </div>

      {isAdmin && editorOpen && (
        <div className="bg-[#141D2F] border border-slate-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">
              Foto ao Lado da Assinatura (Josuel Roque)
            </span>
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="text-slate-400 hover:text-white"
              aria-label="Fechar editor de foto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div className="p-3 bg-[#0B111E] border border-slate-800 rounded-md space-y-2">
              <div className="text-xs font-medium text-slate-200">
                1. Enviar Foto do PC / Celular
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer">
                  <FileUp className="w-3.5 h-3.5" />
                  Escolher Foto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void handleUploadPhoto(e)}
                  />
                </label>
                {localPhoto && (
                  <button
                    type="button"
                    onClick={() => void handleDownloadStaticPhoto()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar creator-photo.jpg
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Recorte quadrado automático (200×200). Ao publicar no GitHub, coloque{' '}
                <span className="font-mono text-slate-200">public/creator-photo.jpg</span> e salve{' '}
                <span className="font-mono text-emerald-300">./creator-photo.jpg</span> ao lado para todo visitante ver.
              </p>
            </div>

            <form
              onSubmit={(e) => void handleSaveUrl(e)}
              className="p-3 bg-[#0B111E] border border-slate-800 rounded-md space-y-2"
            >
              <label className="block text-xs font-medium text-slate-200">
                2. Link Público da Foto (HTTPS ou ./creator-photo.jpg)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={500}
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://... ou ./creator-photo.jpg"
                  className="flex-1 px-2.5 py-1.5 text-xs bg-[#141D2F] border border-slate-700 rounded text-slate-100"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  Salvar
                </button>
              </div>
              {activePhotoSrc && (
                <button
                  type="button"
                  onClick={() => void handleRemoveAllPhotos()}
                  className="inline-flex items-center gap-1 text-[11px] text-red-300 hover:text-red-200"
                >
                  <Trash2 className="w-3 h-3" />
                  Remover foto atual
                </button>
              )}
            </form>
          </div>

          {notice && <div className="text-xs text-emerald-300">{notice}</div>}
        </div>
      )}
    </footer>
  );
}
