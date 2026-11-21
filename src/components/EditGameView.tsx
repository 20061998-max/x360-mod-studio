import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  FileUp,
  FlaskConical,
  FolderOpen,
  FolderUp,
  Layers,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { ModProject } from '../types/modding';
import {
  extractFilesFromDataTransfer,
  type DroppedFileWithPath,
} from '../utils/autoOrganizer';
import { formatFileSize, triggerBinaryDownload } from '../utils/binaryPatch';
import {
  applyOverlayFiles,
  buildEditGameReportTxt,
  buildMergedGameZip,
  buildOriginalEntries,
  createSampleEditGameSession,
  type EditGameEntry,
  type EditGameFileStatus,
} from '../utils/editGame';

interface EditGameViewProps {
  project: ModProject;
}

type FilterMode = 'all' | EditGameFileStatus;

export function EditGameView({ project }: EditGameViewProps) {
  const [entries, setEntries] = useState<EditGameEntry[]>([]);
  const [matchByFileName, setMatchByFileName] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dragOriginals, setDragOriginals] = useState(false);
  const [dragOverlay, setDragOverlay] = useState(false);
  const [buildingZip, setBuildingZip] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const folderInputAttrs = {
    webkitdirectory: '',
    directory: '',
  } as React.InputHTMLAttributes<HTMLInputElement>;

  const toDroppedList = (fileList: FileList): DroppedFileWithPath[] =>
    Array.from(fileList).map((file) => ({
      file,
      relativePath:
        (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    }));

  const handleLoadOriginals = (items: DroppedFileWithPath[]) => {
    const built = buildOriginalEntries(items, true);
    if (built.length === 0) return;
    setEntries(built);
    setStatusMessage(
      `${built.length} arquivo(s) originais do jogo carregados. Agora cole ou envie os novos arquivos por cima.`
    );
  };

  const handleApplyOverlay = (items: DroppedFileWithPath[]) => {
    if (items.length === 0) return;
    const result = applyOverlayFiles(entries, items, matchByFileName);
    setEntries(result.entries);
    setStatusMessage(
      `Atualização aplicada: ${result.replacedCount} arquivo(s) substituído(s) e ${result.addedCount} novo(s) adicionado(s).`
    );
  };

  const handleReplaceSingleRow = (entryId: string, file: File) => {
    setEntries((prev) =>
      prev.map((item) => {
        if (item.id !== entryId) return item;
        return {
          ...item,
          status:
            item.originalSize > 0 || item.originalFile || item.originalBytes
              ? 'replaced'
              : 'added',
          newSize: file.size,
          newFile: file,
          newBytes: undefined,
          matchedBy: 'manual',
        };
      })
    );
    setStatusMessage(`Arquivo "${file.name}" substituído manualmente na lista.`);
  };

  const handleRestoreOriginal = (entryId: string) => {
    setEntries((prev) =>
      prev
        .map((item) => {
          if (item.id !== entryId) return item;
          if (item.status === 'added') return null;
          return {
            ...item,
            status: 'original' as const,
            newSize: undefined,
            newFile: undefined,
            newBytes: undefined,
            matchedBy: undefined,
          };
        })
        .filter((x): x is EditGameEntry => x !== null)
    );
  };

  const handleToggleRemove = (entryId: string) => {
    setEntries((prev) =>
      prev
        .map((item) => {
          if (item.id !== entryId) return item;
          if (item.status === 'added') return null;
          if (item.status === 'removed') {
            return {
              ...item,
              status: item.newFile || item.newBytes ? ('replaced' as const) : ('original' as const),
            };
          }
          return { ...item, status: 'removed' as const };
        })
        .filter((x): x is EditGameEntry => x !== null)
    );
  };

  const handleUpdateRelativePath = (entryId: string, nextPath: string) => {
    const clean = nextPath.replace(/\\/g, '/').replace(/^\/+/, '');
    setEntries((prev) =>
      prev.map((item) =>
        item.id === entryId ? { ...item, relativePath: clean } : item
      )
    );
  };

  const handleLoadSample = () => {
    const sample = createSampleEditGameSession();
    setEntries(sample.updated);
    setStatusMessage(
      'Exemplo carregado: 5 arquivos base com 2 substituídos por cima e 1 arquivo novo adicionado.'
    );
  };

  const handleExportZip = async (onlyChanged: boolean) => {
    if (entries.length === 0 || buildingZip) return;
    setBuildingZip(true);
    setProgressText('Preparando arquivos...');
    try {
      const { zipBytes, includedCount } = await buildMergedGameZip(
        entries,
        onlyChanged,
        (done, total) => setProgressText(`Empacotando ${done} de ${total}...`)
      );
      if (includedCount === 0) {
        setStatusMessage('Nenhum arquivo selecionado para exportar.');
        return;
      }
      const slug =
        project.gameTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'jogo_xbox360';
      const suffix = onlyChanged ? '_arquivos_atualizados' : '_edit_game_completo';
      triggerBinaryDownload(zipBytes, `${slug}${suffix}.zip`, 'application/zip');
      setStatusMessage(
        `Pacote "${slug}${suffix}.zip" gerado com ${includedCount} arquivo(s)!`
      );
    } catch {
      setStatusMessage('Erro ao gerar o pacote .ZIP. Verifique os arquivos carregados.');
    } finally {
      setBuildingZip(false);
      setProgressText(null);
    }
  };

  const handleExportReport = () => {
    if (entries.length === 0) return;
    const txt = buildEditGameReportTxt(project, entries);
    const slug =
      project.gameTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'jogo_xbox360';
    triggerBinaryDownload(txt, `${slug}_relatorio_edit_game.txt`, 'text/plain');
  };

  const stats = useMemo(() => {
    let original = 0;
    let replaced = 0;
    let added = 0;
    let removed = 0;
    let finalBytes = 0;

    for (const e of entries) {
      if (e.status === 'original') {
        original++;
        finalBytes += e.originalSize;
      } else if (e.status === 'replaced') {
        replaced++;
        finalBytes += e.newSize ?? e.originalSize;
      } else if (e.status === 'added') {
        added++;
        finalBytes += e.newSize ?? 0;
      } else {
        removed++;
      }
    }

    return {
      totalFinal: original + replaced + added,
      original,
      replaced,
      added,
      removed,
      finalBytes,
    };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return entries.filter((item) => {
      if (filterMode !== 'all' && item.status !== filterMode) return false;
      if (q && !item.relativePath.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, filterMode, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Edit Game (Substituir Arquivos)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Função separada de patch binário: carregue a pasta original do jogo e cole os novos arquivos diretamente por cima para atualizar o game pronto para rodar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-800/60 hover:bg-emerald-900/50 rounded-md transition-colors whitespace-nowrap"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Testar Exemplo
          </button>
          <button
            type="button"
            disabled={stats.replaced + stats.added === 0 || buildingZip}
            onClick={() => void handleExportZip(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 border border-slate-700 rounded-md transition-colors whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5" />
            Baixar Só Atualizados (.ZIP)
          </button>
          <button
            type="button"
            disabled={stats.totalFinal === 0 || buildingZip}
            onClick={() => void handleExportZip(false)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-md transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            {buildingZip ? progressText || 'Gerando...' : 'Baixar Jogo Atualizado (.ZIP)'}
          </button>
        </div>
      </div>

      {/* Step 1 & Step 2 Drop Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Step 1: Original Game */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOriginals(true);
          }}
          onDragLeave={() => setDragOriginals(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setDragOriginals(false);
            const extracted = await extractFilesFromDataTransfer(e.dataTransfer);
            handleLoadOriginals(extracted);
          }}
          className={`bg-[#141D2F] border-2 border-dashed rounded-lg p-6 space-y-4 transition-colors ${
            dragOriginals ? 'border-emerald-500 bg-emerald-950/20' : 'border-slate-700'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-slate-800 border border-slate-700 rounded-md text-slate-200 shrink-0">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Passo 1 · Base do Jogo
              </div>
              <h2 className="text-base font-bold text-white mt-0.5">
                Pasta ou Arquivos Originais do Game
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Selecione ou arraste a pasta extraída do jogo original para mapear todos os arquivos e subpastas.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-md cursor-pointer transition-colors">
              <FolderUp className="w-3.5 h-3.5" />
              Selecionar Pasta Original
              <input
                type="file"
                multiple
                {...folderInputAttrs}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleLoadOriginals(toDroppedList(e.target.files));
                  }
                  e.target.value = '';
                }}
              />
            </label>
            <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-[#0B111E] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md cursor-pointer transition-colors">
              <FileUp className="w-3.5 h-3.5" />
              Arquivos Soltos
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleLoadOriginals(toDroppedList(e.target.files));
                  }
                  e.target.value = '';
                }}
              />
            </label>
            {entries.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setEntries([]);
                  setStatusMessage(null);
                }}
                className="px-3 py-2 text-xs text-slate-400 hover:text-white"
              >
                Limpar Tudo
              </button>
            )}
          </div>
        </div>

        {/* Step 2: Replacement Files */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverlay(true);
          }}
          onDragLeave={() => setDragOverlay(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setDragOverlay(false);
            const extracted = await extractFilesFromDataTransfer(e.dataTransfer);
            handleApplyOverlay(extracted);
          }}
          className={`bg-[#141D2F] border-2 border-dashed rounded-lg p-6 space-y-4 transition-colors ${
            dragOverlay ? 'border-emerald-500 bg-emerald-950/20' : 'border-emerald-700/50'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-600/20 border border-emerald-500/30 rounded-md text-emerald-400 shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Passo 2 · Colar por Cima
              </div>
              <h2 className="text-base font-bold text-white mt-0.5">
                Novos Arquivos de Atualização / Mod
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Arraste ou selecione os arquivos novos (ou uma pasta inteira de mod) para substituir os originais automaticamente por caminho ou nome.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer transition-colors">
              <FolderUp className="w-3.5 h-3.5" />
              Colar Pasta de Novos Arquivos
              <input
                type="file"
                multiple
                {...folderInputAttrs}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleApplyOverlay(toDroppedList(e.target.files));
                  }
                  e.target.value = '';
                }}
              />
            </label>
            <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md cursor-pointer transition-colors">
              <FileUp className="w-3.5 h-3.5" />
              Colar Arquivos Soltos
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleApplyOverlay(toDroppedList(e.target.files));
                  }
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={matchByFileName}
              onChange={(e) => setMatchByFileName(e.target.checked)}
              className="rounded border-slate-600 bg-[#0B111E] text-emerald-500"
            />
            Substituir automaticamente pelo nome do arquivo quando vier solto (sem subpastas)
          </label>
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-950/40 border border-emerald-700/50 rounded-md text-xs text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Arquivos no Jogo Final</div>
          <div className="text-2xl font-bold text-white mt-1 tabular-nums">
            {stats.totalFinal}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5 tabular-nums">
            {formatFileSize(stats.finalBytes)}
          </div>
        </div>
        <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Substituídos (Novos)</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
            {stats.replaced}
          </div>
        </div>
        <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Adicionados (Extras)</div>
          <div className="text-2xl font-bold text-sky-400 mt-1 tabular-nums">
            {stats.added}
          </div>
        </div>
        <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Originais Mantidos</div>
          <div className="text-2xl font-bold text-slate-200 mt-1 tabular-nums">
            {stats.original}
          </div>
        </div>
      </div>

      {/* File Table */}
      <section className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `Todos (${entries.length})` },
                { id: 'replaced', label: `Substituídos (${stats.replaced})` },
                { id: 'added', label: `Adicionados (${stats.added})` },
                { id: 'original', label: `Originais (${stats.original})` },
                { id: 'removed', label: `Removidos (${stats.removed})` },
              ] as Array<{ id: FilterMode; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors tabular-nums ${
                  filterMode === tab.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#0B111E] text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar caminho ou arquivo..."
              className="w-full md:w-60 px-3 py-1.5 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {entries.length > 0 && (
              <button
                type="button"
                onClick={handleExportReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md whitespace-nowrap"
                title="Baixar relatório de arquivos modificados"
              >
                <FileText className="w-3.5 h-3.5" />
                Relatório .TXT
              </button>
            )}
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 max-w-lg mx-auto space-y-2">
            <p>
              Carregue a pasta original do jogo no <strong>Passo 1</strong> e depois envie os novos arquivos no <strong>Passo 2</strong> (ou arraste os arquivos novos direto mesmo sem pasta base para montar um pacote de substituição).
            </p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Nenhum arquivo corresponde ao filtro atual.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-md">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0E1525] border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-2.5 px-3">Caminho no Jogo (Editável)</th>
                  <th className="py-2.5 px-3">Situação</th>
                  <th className="py-2.5 px-3 text-right">Tamanho</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredEntries.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 min-w-[260px]">
                      <input
                        type="text"
                        value={item.relativePath}
                        onChange={(e) =>
                          handleUpdateRelativePath(item.id, e.target.value)
                        }
                        className={`w-full px-2.5 py-1 text-xs font-mono bg-[#0B111E] border border-slate-800 rounded focus:outline-none focus:border-emerald-500 ${
                          item.status === 'removed'
                            ? 'line-through text-slate-500'
                            : item.status === 'replaced'
                            ? 'text-emerald-300'
                            : item.status === 'added'
                            ? 'text-sky-300'
                            : 'text-slate-200'
                        }`}
                      />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-sm border ${
                          item.status === 'replaced'
                            ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30'
                            : item.status === 'added'
                            ? 'bg-sky-600/20 text-sky-300 border-sky-500/30'
                            : item.status === 'removed'
                            ? 'bg-red-600/20 text-red-300 border-red-500/30'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {item.status === 'replaced'
                          ? 'Substituído'
                          : item.status === 'added'
                          ? 'Adicionado'
                          : item.status === 'removed'
                          ? 'Removido'
                          : 'Original'}
                      </span>
                      {item.matchedBy && (
                        <span className="ml-2 text-[11px] text-slate-500">
                          ({item.matchedBy})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-300">
                      {item.status === 'replaced' ? (
                        <span>
                          <span className="text-slate-500 line-through mr-1.5">
                            {formatFileSize(item.originalSize)}
                          </span>
                          <span className="text-emerald-300">
                            {formatFileSize(item.newSize ?? 0)}
                          </span>
                        </span>
                      ) : item.status === 'added' ? (
                        <span className="text-sky-300">
                          {formatFileSize(item.newSize ?? 0)}
                        </span>
                      ) : (
                        formatFileSize(item.originalSize)
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <label className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded cursor-pointer">
                          Substituir
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleReplaceSingleRow(item.id, f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        {item.status === 'replaced' && (
                          <button
                            type="button"
                            onClick={() => handleRestoreOriginal(item.id)}
                            title="Restaurar original"
                            className="p-1 text-slate-400 hover:text-amber-300"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleRemove(item.id)}
                          title={
                            item.status === 'removed'
                              ? 'Incluir novamente'
                              : 'Remover da exportação'
                          }
                          className="p-1 text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
