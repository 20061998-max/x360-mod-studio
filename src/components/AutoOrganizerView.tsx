import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileUp,
  FlaskConical,
  FolderCheck,
  FolderTree,
  FolderUp,
  Trash2,
} from 'lucide-react';
import { ModAssetEntry, ModProject } from '../types/modding';
import {
  classifyModBytes,
  createSampleUploadBatch,
  createZipArchive,
  DroppedFileWithPath,
  extractFilesFromDataTransfer,
  isIgnoredSystemFile,
  OrganizedModFile,
  ZipInputEntry,
} from '../utils/autoOrganizer';
import { formatFileSize, triggerBinaryDownload } from '../utils/binaryPatch';
import { generateLaunchIni } from '../utils/dashLaunch';
import {
  exportInstallGuideTxt,
  exportProjectModIni,
  exportRosterCsv,
  exportVehiclesHandlingCfg,
  exportWeaponsGscScript,
} from '../utils/projectStorage';

interface AutoOrganizerViewProps {
  project: ModProject;
  onSyncAssetsToProject: (assets: ModAssetEntry[]) => void;
}

export function AutoOrganizerView({
  project,
  onSyncAssetsToProject,
}: AutoOrganizerViewProps) {
  const [files, setFiles] = useState<OrganizedModFile[]>([]);
  const [preserveSubfolders, setPreserveSubfolders] = useState(false);
  const [includeProjectConfigs, setIncludeProjectConfigs] = useState(true);
  const [includeLaunchIni, setIncludeLaunchIni] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [readingFolder, setReadingFolder] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const ingestDroppedItems = async (items: DroppedFileWithPath[]) => {
    const valid = items.filter((item) => !isIgnoredSystemFile(item.file.name));
    if (valid.length === 0) return;

    const classified: OrganizedModFile[] = [];
    for (let i = 0; i < valid.length; i++) {
      const { file, relativePath } = valid[i];
      const bytes = new Uint8Array(await file.arrayBuffer());
      const item = classifyModBytes(
        file.name,
        bytes,
        project,
        relativePath || file.name,
        preserveSubfolders
      );
      classified.push({
        id: `org-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        ...item,
      });
    }

    setFiles((prev) => [...prev, ...classified]);
    setStatusMessage(
      `${classified.length} arquivo(s) lidos da pasta/seleção e organizados automaticamente.`
    );
  };

  const ingestFileList = async (fileList: FileList | File[]) => {
    const wrapped: DroppedFileWithPath[] = Array.from(fileList).map((file) => ({
      file,
      relativePath:
        (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    }));
    await ingestDroppedItems(wrapped);
  };

  const handleLoadSampleBatch = () => {
    const sample = createSampleUploadBatch(project);
    setFiles(sample);
    setStatusMessage('Lote de exemplo carregado e organizado nas pastas padrão do Xbox 360.');
  };

  const handleReclassifyAll = (nextPreserve = preserveSubfolders) => {
    setFiles((prev) =>
      prev.map((item) => ({
        ...item,
        ...classifyModBytes(
          item.fileName,
          item.data,
          project,
          item.sourceRelativePath,
          nextPreserve
        ),
      }))
    );
    setStatusMessage(
      nextPreserve
        ? 'Estrutura de subpastas da pasta enviada preservada dentro do jogo.'
        : 'Caminhos mapeados automaticamente para a estrutura padrão do Xbox 360.'
    );
  };

  const handleUpdatePath = (id: string, nextPath: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, targetRelativePath: nextPath } : f))
    );
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSyncToProject = () => {
    if (files.length === 0) return;
    const mapped: ModAssetEntry[] = files.map((f) => ({
      id: f.id,
      category: f.category,
      targetPath: f.targetRelativePath.replace(/\//g, '\\'),
      action: f.action,
      status: 'Pronto',
      notes: `${f.detectedFormat} (${formatFileSize(f.size)})`,
    }));

    const existingPaths = new Set(project.modAssets.map((a) => a.targetPath.toLowerCase()));
    const merged = [
      ...project.modAssets,
      ...mapped.filter((m) => !existingPaths.has(m.targetPath.toLowerCase())),
    ];
    onSyncAssetsToProject(merged);
    setStatusMessage('Lista de arquivos sincronizada no Pacote de Mod do projeto.');
  };

  const packageEntries = useMemo(() => {
    const enc = new TextEncoder();
    const list: ZipInputEntry[] = files.map((f) => ({
      path: f.targetRelativePath,
      data: f.data,
    }));

    if (includeProjectConfigs) {
      const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'mod';
      list.push({
        path: 'mod_config.ini',
        data: enc.encode(exportProjectModIni(project)),
      });
      list.push({
        path: 'LEIA_ME_INSTALACAO.txt',
        data: enc.encode(exportInstallGuideTxt(project)),
      });
      if (project.vehicleMods.length > 0) {
        list.push({
          path: `configs/${slug}_handling.cfg`,
          data: enc.encode(exportVehiclesHandlingCfg(project)),
        });
      }
      if (project.weaponMods.length > 0) {
        list.push({
          path: `configs/${slug}_weapons.gsc`,
          data: enc.encode(exportWeaponsGscScript(project)),
        });
      }
      if (project.rosterUpdates.length > 0) {
        list.push({
          path: `configs/${slug}_elencos.csv`,
          data: enc.encode(exportRosterCsv(project)),
        });
      }
    }

    if (includeLaunchIni) {
      list.push({
        path: 'launch.ini',
        data: enc.encode(generateLaunchIni(project.dashLaunch)),
      });
    }

    return list;
  }, [files, includeProjectConfigs, includeLaunchIni, project]);

  const totalBytes = useMemo(
    () => packageEntries.reduce((acc, e) => acc + e.data.length, 0),
    [packageEntries]
  );

  const handleBuildAndDownloadZip = () => {
    if (packageEntries.length === 0) return;
    const zipBytes = createZipArchive(packageEntries);
    const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'pacote_xbox360';
    triggerBinaryDownload(zipBytes, `${slug}_pronto_x360.zip`, 'application/zip');
    setStatusMessage(
      `Pacote "${slug}_pronto_x360.zip" gerado com ${packageEntries.length} arquivos organizados!`
    );
  };

  const folderInputAttrs = {
    webkitdirectory: '',
    directory: '',
  } as React.InputHTMLAttributes<HTMLInputElement>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Auto-Organizador de Arquivos & Empacotador (.ZIP)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Envie uma pasta inteira de uma só vez (ou arraste a pasta aqui). O sistema lê todas as subpastas, organiza no padrão do Xbox 360 e gera o .ZIP pronto para copiar no pendrive ou FTP.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleLoadSampleBatch}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-800/60 hover:bg-emerald-900/50 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Testar com Lote Exemplo
          </button>
          <button
            type="button"
            disabled={packageEntries.length === 0}
            onClick={handleBuildAndDownloadZip}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            Baixar Pacote Organizado (.ZIP)
          </button>
        </div>
      </div>

      {/* Drop Zone supporting full folders */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragActive(false);
          setReadingFolder(true);
          try {
            const extracted = await extractFilesFromDataTransfer(e.dataTransfer);
            await ingestDroppedItems(extracted);
          } finally {
            setReadingFolder(false);
          }
        }}
        className={`bg-[#141D2F] border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive ? 'border-emerald-500 bg-emerald-950/20' : 'border-slate-700'
        }`}
      >
        <FolderUp className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
        <div className="text-sm font-semibold text-white">
          {readingFolder
            ? 'Lendo arquivos da pasta selecionada...'
            : 'Arraste uma pasta inteira do seu PC para cá ou selecione abaixo'}
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-xl mx-auto">
          Todos os arquivos e subpastas dentro da pasta escolhida serão importados automaticamente de uma só vez (ignorando arquivos ocultos do Windows/macOS).
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer transition-colors whitespace-nowrap">
            <FolderUp className="w-4 h-4" />
            Selecionar Pasta Inteira
            <input
              type="file"
              multiple
              {...folderInputAttrs}
              className="hidden"
              onChange={async (e) => {
                if (e.target.files?.length) {
                  setReadingFolder(true);
                  try {
                    await ingestFileList(e.target.files);
                  } finally {
                    setReadingFolder(false);
                  }
                }
                e.target.value = '';
              }}
            />
          </label>

          <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md cursor-pointer transition-colors whitespace-nowrap">
            <FileUp className="w-4 h-4" />
            Selecionar Arquivos Soltos
            <input
              type="file"
              multiple
              className="hidden"
              onChange={async (e) => {
                if (e.target.files?.length) await ingestFileList(e.target.files);
                e.target.value = '';
              }}
            />
          </label>

          {files.length > 0 && (
            <button
              type="button"
              onClick={() => setFiles([])}
              className="px-3.5 py-2.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors whitespace-nowrap"
            >
              Limpar Lista
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-950/40 border border-emerald-700/50 rounded-md text-xs text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Package Options & Table */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-white">
                Arquivos Classificados ({files.length})
              </h2>
              <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                Title ID alvo: {project.titleId} · Total no pacote: {packageEntries.length} itens ({formatFileSize(totalBytes)})
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 p-1 bg-[#0B111E] border border-slate-800 rounded-md">
                <button
                  type="button"
                  onClick={() => {
                    setPreserveSubfolders(false);
                    if (files.length > 0) handleReclassifyAll(false);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                    !preserveSubfolders
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Auto-Mapear X360
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreserveSubfolders(true);
                    if (files.length > 0) handleReclassifyAll(true);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                    preserveSubfolders
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Manter Subpastas Originais
                </button>
              </div>

              {files.length > 0 && (
                <button
                  type="button"
                  onClick={handleSyncToProject}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded transition-colors whitespace-nowrap"
                >
                  <FolderCheck className="w-3.5 h-3.5" />
                  Salvar no Projeto
                </button>
              )}
            </div>
          </div>

          {files.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Nenhuma pasta ou arquivo enviado ainda. Clique em &ldquo;Selecionar Pasta Inteira&rdquo;, arraste sua pasta acima ou clique em &ldquo;Testar com Lote Exemplo&rdquo;.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-md">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0E1525] border-b border-slate-800 text-xs font-medium text-slate-400">
                    <th className="py-2.5 px-3">Arquivo Enviado</th>
                    <th className="py-2.5 px-3">Tipo Detectado</th>
                    <th className="py-2.5 px-3">Destino no Pacote (Editável)</th>
                    <th className="py-2.5 px-3 text-right">Tamanho</th>
                    <th className="py-2.5 px-3 text-right">Remover</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs">
                  {files.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 max-w-[200px]">
                        <div className="font-medium text-white truncate">{item.fileName}</div>
                        {item.sourceRelativePath !== item.fileName && (
                          <div className="text-[11px] font-mono text-slate-500 truncate">
                            {item.sourceRelativePath}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                        <div>{item.detectedFormat}</div>
                        <div className="text-[11px] text-slate-500">{item.category}</div>
                      </td>
                      <td className="py-2.5 px-3 min-w-[240px]">
                        <input
                          type="text"
                          value={item.targetRelativePath}
                          onChange={(e) => handleUpdatePath(item.id, e.target.value)}
                          className="w-full px-2.5 py-1 text-xs font-mono bg-[#0B111E] border border-slate-700 rounded text-emerald-300 focus:outline-none focus:border-emerald-500"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                        {formatFileSize(item.size)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(item.id)}
                          className="text-slate-400 hover:text-red-400 p-1"
                          title="Remover arquivo"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Folder Tree Preview & Bundle Options */}
        <div className="xl:col-span-4 bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <FolderTree className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Estrutura Final do .ZIP</h2>
          </div>

          <div className="space-y-2.5 text-xs">
            <label className="flex items-start gap-2.5 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={includeProjectConfigs}
                onChange={(e) => setIncludeProjectConfigs(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-600 rounded"
              />
              <span>
                Incluir configurações do projeto (<span className="font-mono">mod_config.ini</span>,{' '}
                <span className="font-mono">LEIA_ME</span>, <span className="font-mono">handling.cfg</span> /{' '}
                <span className="font-mono">weapons.gsc</span>).
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={includeLaunchIni}
                onChange={(e) => setIncludeLaunchIni(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-600 rounded"
              />
              <span>
                Incluir <span className="font-mono">launch.ini</span> na raiz do pacote (DashLaunch).
              </span>
            </label>
          </div>

          <div className="p-3 bg-[#0B111E] border border-slate-800 rounded-md max-h-[320px] overflow-y-auto space-y-1 font-mono text-[11px] text-slate-300">
            {packageEntries.length === 0 ? (
              <div className="text-slate-500">Pacote vazio.</div>
            ) : (
              packageEntries.map((entry, idx) => (
                <div key={`${entry.path}-${idx}`} className="flex items-center justify-between gap-2">
                  <span className="truncate text-emerald-300">{entry.path}</span>
                  <span className="text-slate-500 tabular-nums shrink-0">
                    {formatFileSize(entry.data.length)}
                  </span>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            disabled={packageEntries.length === 0}
            onClick={handleBuildAndDownloadZip}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-md transition-colors"
          >
            <Download className="w-4 h-4" />
            Gerar e Baixar .ZIP Organizado
          </button>
        </div>
      </div>
    </div>
  );
}
