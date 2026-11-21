import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileUp,
  FlaskConical,
  Layers,
} from 'lucide-react';
import { ModProject, X360JsonPatchFile } from '../types/modding';
import {
  applyIpsPatch,
  applyJsonPatchPackage,
  buildBinaryDiff,
  buildJsonPatchPackage,
  createSampleFootballBinary,
  formatFileSize,
  formatHexOffset,
  triggerBinaryDownload,
} from '../utils/binaryPatch';

interface BinaryPatcherViewProps {
  project: ModProject;
}

interface LoadedFile {
  name: string;
  data: Uint8Array;
}

export function BinaryPatcherView({ project }: BinaryPatcherViewProps) {
  const [mode, setMode] = useState<'create' | 'apply'>('create');

  // Create mode state
  const [originalFile, setOriginalFile] = useState<LoadedFile | null>(null);
  const [modifiedFile, setModifiedFile] = useState<LoadedFile | null>(null);
  const [patchNotes, setPatchNotes] = useState('');

  // Apply mode state
  const [targetBaseFile, setTargetBaseFile] = useState<LoadedFile | null>(null);
  const [patchFile, setPatchFile] = useState<LoadedFile | null>(null);
  const [applyStatus, setApplyStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const readFileAsBytes = async (file: File): Promise<LoadedFile> => {
    const buffer = await file.arrayBuffer();
    return { name: file.name, data: new Uint8Array(buffer) };
  };

  const handleLoadSampleDiff = () => {
    setOriginalFile({
      name: 'elenco_2013_original.bin',
      data: createSampleFootballBinary('original'),
    });
    setModifiedFile({
      name: 'elenco_2026_modificado.bin',
      data: createSampleFootballBinary('modified'),
    });
    setPatchNotes('Atualização de exemplo: temporada 2026, liga nacional e overalls.');
  };

  const diffResult = useMemo(() => {
    if (!originalFile || !modifiedFile) return null;
    return buildBinaryDiff(originalFile.data, modifiedFile.data);
  }, [originalFile, modifiedFile]);

  const handleDownloadIps = () => {
    if (!diffResult?.ipsBytes) return;
    const baseName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'mod';
    triggerBinaryDownload(diffResult.ipsBytes, `${baseName}.ips`);
  };

  const handleDownloadJsonPatch = () => {
    if (!originalFile || !modifiedFile) return;
    const pkg = buildJsonPatchPackage(originalFile.data, modifiedFile.data, {
      projectName: project.name,
      gameTitle: project.gameTitle,
      titleId: project.titleId,
      version: project.patchVersion,
      author: project.author,
      originalFileName: originalFile.name,
      originalSize: originalFile.data.length,
      modifiedSize: modifiedFile.data.length,
      notes: patchNotes || project.description,
    });
    const baseName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'mod';
    triggerBinaryDownload(JSON.stringify(pkg, null, 2), `${baseName}.x360patch.json`, 'application/json');
  };

  const handleApplyAndDownload = () => {
    if (!targetBaseFile || !patchFile) return;
    setApplyStatus(null);
    try {
      const lowerName = patchFile.name.toLowerCase();
      let patchedBytes: Uint8Array;
      let recordCount = 0;

      if (lowerName.endsWith('.json')) {
        const text = new TextDecoder().decode(patchFile.data);
        const pkg = JSON.parse(text) as X360JsonPatchFile;
        const res = applyJsonPatchPackage(targetBaseFile.data, pkg);
        patchedBytes = res.patched;
        recordCount = res.recordCount;
      } else {
        const res = applyIpsPatch(targetBaseFile.data, patchFile.data);
        patchedBytes = res.patched;
        recordCount = res.recordCount;
      }

      const dotIdx = targetBaseFile.name.lastIndexOf('.');
      const outName =
        dotIdx > 0
          ? `${targetBaseFile.name.slice(0, dotIdx)}_modded${targetBaseFile.name.slice(dotIdx)}`
          : `${targetBaseFile.name}_modded`;

      triggerBinaryDownload(patchedBytes, outName);
      setApplyStatus({
        type: 'success',
        message: `Patch aplicado com sucesso (${recordCount} blocos gravados). Arquivo "${outName}" baixado.`,
      });
    } catch (err) {
      setApplyStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Falha ao aplicar o arquivo de patch.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Criador e Aplicador de Patch Binário
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Compare arquivos originais e modificados para gerar patches IPS ou pacotes X360 estruturados sem distribuir o arquivo inteiro do jogo.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-[#141D2F] border border-slate-800 rounded-lg self-start shrink-0">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'create'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Criar Patch
          </button>
          <button
            type="button"
            onClick={() => setMode('apply')}
            className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'apply'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Aplicar Patch
          </button>
        </div>
      </div>

      {mode === 'create' ? (
        <>
          <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="text-sm font-semibold text-white">
                1. Selecione os arquivos para comparação
              </div>
              <button
                type="button"
                onClick={handleLoadSampleDiff}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-800/60 hover:bg-emerald-900/50 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Carregar Exemplo (Mod de Futebol)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block p-4 bg-[#0E1525] border border-dashed border-slate-700 hover:border-emerald-500/60 rounded-lg cursor-pointer transition-colors">
                <input
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setOriginalFile(await readFileAsBytes(f));
                  }}
                />
                <div className="flex items-start gap-3">
                  <FileUp className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">Arquivo Original (Base)</div>
                    {originalFile ? (
                      <div className="text-xs text-emerald-400 font-mono tabular-nums mt-1 truncate">
                        {originalFile.name} · {formatFileSize(originalFile.data.length)}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 mt-1">
                        Clique para selecionar arquivo .bin, .db, .ini ou .xex descriptografado
                      </div>
                    )}
                  </div>
                </div>
              </label>

              <label className="block p-4 bg-[#0E1525] border border-dashed border-slate-700 hover:border-emerald-500/60 rounded-lg cursor-pointer transition-colors">
                <input
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setModifiedFile(await readFileAsBytes(f));
                  }}
                />
                <div className="flex items-start gap-3">
                  <FileUp className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">Arquivo Modificado (Seu Mod)</div>
                    {modifiedFile ? (
                      <div className="text-xs text-emerald-400 font-mono tabular-nums mt-1 truncate">
                        {modifiedFile.name} · {formatFileSize(modifiedFile.data.length)}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 mt-1">
                        Clique para selecionar a versão editada do mesmo arquivo
                      </div>
                    )}
                  </div>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Notas do Patch (salvo no pacote .x360patch.json)
              </label>
              <input
                type="text"
                value={patchNotes}
                onChange={(e) => setPatchNotes(e.target.value)}
                placeholder="Ex: Atualiza elencos 2026, corrige nomes de clubes e ajusta velocidade."
                className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {diffResult && originalFile && modifiedFile ? (
            <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Resultado da Comparação Binária
                  </h2>
                  <div className="text-xs text-slate-400 mt-1 font-mono tabular-nums flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>Blocos alterados: {diffResult.chunks.length}</span>
                    <span aria-hidden="true">·</span>
                    <span>Bytes modificados: {diffResult.totalChangedBytes}</span>
                    <span aria-hidden="true">·</span>
                    <span>Tamanho base: {formatFileSize(originalFile.data.length)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Tamanho final: {formatFileSize(modifiedFile.data.length)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    type="button"
                    disabled={!diffResult.ipsBytes || diffResult.chunks.length === 0}
                    onClick={handleDownloadIps}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    Baixar Patch .IPS
                  </button>
                  <button
                    type="button"
                    disabled={diffResult.chunks.length === 0}
                    onClick={handleDownloadJsonPatch}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    Baixar .x360patch.json
                  </button>
                </div>
              </div>

              {diffResult.exceedsIpsLimit && (
                <div className="flex items-start gap-2.5 p-3.5 bg-amber-950/40 border border-amber-700/50 rounded-md text-xs text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Este arquivo ultrapassa 16 MB (limite do formato IPS clássico). Use o botão{' '}
                    <strong>Baixar .x360patch.json</strong>, que suporta arquivos maiores sem perda de offsets.
                  </span>
                </div>
              )}

              {diffResult.chunks.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  Os dois arquivos são idênticos. Nenhuma diferença encontrada para gerar patch.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-md">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#0E1525] border-b border-slate-800 text-xs font-medium text-slate-400">
                        <th className="py-2.5 px-3">Offset</th>
                        <th className="py-2.5 px-3 text-right">Tamanho</th>
                        <th className="py-2.5 px-3">Original (Hex)</th>
                        <th className="py-2.5 px-3">Modificado (Hex)</th>
                        <th className="py-2.5 px-3">Texto ASCII</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-xs font-mono tabular-nums">
                      {diffResult.chunks.slice(0, 120).map((chunk, idx) => (
                        <tr key={`${chunk.offset}-${idx}`} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 text-emerald-400 whitespace-nowrap">
                            {formatHexOffset(chunk.offset)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-300 whitespace-nowrap">
                            {chunk.length} B{chunk.isRle ? ' (RLE)' : ''}
                          </td>
                          <td className="py-2 px-3 text-slate-400 max-w-[220px] truncate">
                            {chunk.originalHex}
                          </td>
                          <td className="py-2 px-3 text-slate-100 max-w-[220px] truncate">
                            {chunk.modifiedHex}
                          </td>
                          <td className="py-2 px-3 text-slate-300 max-w-[180px] truncate">
                            {chunk.asciiPreview}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {diffResult.chunks.length > 120 && (
                    <div className="px-3 py-2 text-xs text-slate-400 bg-[#0E1525] border-t border-slate-800">
                      Exibindo os primeiros 120 de {diffResult.chunks.length} blocos modificados. Todos serão incluídos no arquivo baixado.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-10 text-center">
              <Layers className="w-8 h-8 text-slate-500 mx-auto mb-3" />
              <div className="text-sm font-medium text-white">
                Nenhum arquivo carregado para comparação
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Selecione o arquivo original e o arquivo editado acima, ou clique em &ldquo;Carregar Exemplo (Mod de Futebol)&rdquo; para testar a geração de patch agora.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white">
              Aplicar Patch em Arquivo Original
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Selecione o arquivo original do jogo e o arquivo de patch (.ips ou .x360patch.json) para gerar a versão modificada pronta para copiar ao Xbox 360.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block p-4 bg-[#0E1525] border border-dashed border-slate-700 hover:border-emerald-500/60 rounded-lg cursor-pointer transition-colors">
              <input
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setTargetBaseFile(await readFileAsBytes(f));
                }}
              />
              <div className="flex items-start gap-3">
                <FileUp className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white">Arquivo Base Original</div>
                  {targetBaseFile ? (
                    <div className="text-xs text-emerald-400 font-mono tabular-nums mt-1 truncate">
                      {targetBaseFile.name} · {formatFileSize(targetBaseFile.data.length)}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 mt-1">
                      Arquivo original extraído do jogo
                    </div>
                  )}
                </div>
              </div>
            </label>

            <label className="block p-4 bg-[#0E1525] border border-dashed border-slate-700 hover:border-emerald-500/60 rounded-lg cursor-pointer transition-colors">
              <input
                type="file"
                accept=".ips,.json,.x360patch.json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setPatchFile(await readFileAsBytes(f));
                }}
              />
              <div className="flex items-start gap-3">
                <FileUp className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white">Arquivo de Patch (.ips / .json)</div>
                  {patchFile ? (
                    <div className="text-xs text-emerald-400 font-mono tabular-nums mt-1 truncate">
                      {patchFile.name} · {formatFileSize(patchFile.data.length)}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 mt-1">
                      Patch gerado anteriormente
                    </div>
                  )}
                </div>
              </div>
            </label>
          </div>

          {applyStatus && (
            <div
              className={`flex items-start gap-2.5 p-3.5 rounded-md border text-xs ${
                applyStatus.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200'
                  : 'bg-red-950/40 border-red-700/50 text-red-200'
              }`}
            >
              {applyStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <span>{applyStatus.message}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!targetBaseFile || !patchFile}
              onClick={handleApplyAndDownload}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              Aplicar Patch e Baixar Arquivo Modificado
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
