import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  FileUp,
  FlaskConical,
  FolderUp,
  Play,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { ModProject } from '../types/modding';
import { extractFilesFromDataTransfer, type DroppedFileWithPath } from '../utils/autoOrganizer';
import { formatFileSize, triggerBinaryDownload } from '../utils/binaryPatch';
import {
  buildTesterReportTxt,
  inspectUploadedModFiles,
  runProjectIntegritySuite,
  runRoundTripEngineTest,
  verifyPatchOnOriginal,
  type CheckSeverity,
  type DiagnosticCheckItem,
  type InspectedModFile,
  type PatchVerifyResult,
} from '../utils/modTester';

interface ModTesterViewProps {
  project: ModProject;
}

export function ModTesterView({ project }: ModTesterViewProps) {
  const [checks, setChecks] = useState<DiagnosticCheckItem[]>([]);
  const [inspectedFiles, setInspectedFiles] = useState<InspectedModFile[]>([]);
  const [running, setRunning] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Patch simulator state
  const [origFileName, setOrigFileName] = useState('');
  const [origBytes, setOrigBytes] = useState<Uint8Array | null>(null);
  const [patchFileName, setPatchFileName] = useState('');
  const [patchBytes, setPatchBytes] = useState<Uint8Array | null>(null);
  const [patchResult, setPatchResult] = useState<PatchVerifyResult | null>(null);

  const runFullDiagnostics = async () => {
    setRunning(true);
    try {
      const projChecks = runProjectIntegritySuite(project);
      const engineChecks = await runRoundTripEngineTest();
      setChecks([...projChecks, ...engineChecks]);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    void runFullDiagnostics();
  }, [project]);

  const handleInspectFiles = async (items: DroppedFileWithPath[]) => {
    if (items.length === 0) return;
    setRunning(true);
    try {
      const result = await inspectUploadedModFiles(items);
      setInspectedFiles(result);
    } finally {
      setRunning(false);
    }
  };

  const handleRunPatchSimulation = async () => {
    if (!origBytes || !patchBytes) return;
    const res = await verifyPatchOnOriginal(origBytes, patchBytes, patchFileName);
    setPatchResult(res);
  };

  const summary = useMemo(() => {
    const allStatuses: CheckSeverity[] = [
      ...checks.map((c) => c.status),
      ...inspectedFiles.map((f) => f.status),
    ];
    if (patchResult) {
      allStatuses.push(patchResult.ok ? 'pass' : 'fail');
    }
    const total = allStatuses.length;
    const pass = allStatuses.filter((s) => s === 'pass').length;
    const warn = allStatuses.filter((s) => s === 'warn').length;
    const fail = allStatuses.filter((s) => s === 'fail').length;
    const scorePct = total > 0 ? Math.round((pass / total) * 100) : 100;
    return { total, pass, warn, fail, scorePct };
  }, [checks, inspectedFiles, patchResult]);

  const folderInputAttrs = {
    webkitdirectory: '',
    directory: '',
  } as React.InputHTMLAttributes<HTMLInputElement>;

  const renderStatusBadge = (status: CheckSeverity) => {
    if (status === 'pass') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-sm">
          <CheckCircle2 className="w-3 h-3" />
          OK
        </span>
      );
    }
    if (status === 'warn') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/30 rounded-sm">
          <AlertTriangle className="w-3 h-3" />
          Aviso
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-red-600/20 text-red-300 border border-red-500/30 rounded-sm">
        <XCircle className="w-3 h-3" />
        Falha
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Testador e Validador de Modificações
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Verifique se configurações, regras Hex, carros, armas, elencos, arquivos do mod (.xex, .ips, .dds, .gsc, .zip) e patches estão 100% íntegros antes de copiar para o console.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              triggerBinaryDownload(
                buildTesterReportTxt(project, checks, inspectedFiles),
                `relatorio_teste_${project.titleId}.txt`,
                'text/plain'
              )
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar Relatório (.TXT)
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => void runFullDiagnostics()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-md transition-colors whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            {running ? 'Testando...' : 'Reexecutar Todos os Testes'}
          </button>
        </div>
      </div>

      {/* Verdict & KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Índice de Integridade</div>
          <div
            className={`text-2xl font-bold mt-1 tabular-nums ${
              summary.fail > 0
                ? 'text-red-400'
                : summary.warn > 0
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}
          >
            {summary.scorePct}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {summary.fail === 0 && summary.warn === 0
              ? 'Tudo funcionando 100%'
              : summary.fail > 0
              ? 'Corrija as falhas abaixo'
              : 'Aprovado com avisos'}
          </div>
        </div>
        <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Verificações Aprovadas</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
            {summary.pass}
          </div>
        </div>
        <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Avisos</div>
          <div className="text-2xl font-bold text-amber-400 mt-1 tabular-nums">
            {summary.warn}
          </div>
        </div>
        <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Falhas Críticas</div>
          <div className="text-2xl font-bold text-red-400 mt-1 tabular-nums">
            {summary.fail}
          </div>
        </div>
      </div>

      {/* Project & Engine Diagnostics */}
      <section className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">
              Auditoria do Projeto Ativo ({project.name}) e Motores do Estúdio
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {checks.length} teste(s)
          </span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {checks.map((item) => (
            <div
              key={item.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono uppercase text-slate-400">
                    [{item.area}]
                  </span>
                  <span className="text-sm font-medium text-white">{item.title}</span>
                </div>
                <p className="text-xs text-slate-300">{item.detail}</p>
              </div>
              <div className="shrink-0 self-start sm:self-center">
                {renderStatusBadge(item.status)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mod Files & Folder Inspector */}
      <section className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">
              Inspecionar Pasta ou Arquivos Finais do Mod (.XEX, .IPS, .DDS, .GSC, .ZIP)
            </h2>
          </div>
          {inspectedFiles.length > 0 && (
            <button
              type="button"
              onClick={() => setInspectedFiles([])}
              className="text-xs text-slate-400 hover:text-white self-start sm:self-auto"
            >
              Limpar Lista
            </button>
          )}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setDragActive(false);
            const extracted = await extractFilesFromDataTransfer(e.dataTransfer);
            await handleInspectFiles(extracted);
          }}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive ? 'border-emerald-500 bg-emerald-950/20' : 'border-slate-700 bg-[#0B111E]'
          }`}
        >
          <p className="text-xs text-slate-300">
            Arraste a pasta do seu mod já pronto (ou arquivos individuais) para verificar assinaturas binárias, dimensões de texturas DDS, sintaxe de scripts GSC e calcular CRC-32 / SHA-256.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer">
              <FolderUp className="w-3.5 h-3.5" />
              Testar Pasta Inteira
              <input
                type="file"
                multiple
                {...folderInputAttrs}
                className="hidden"
                onChange={async (e) => {
                  if (e.target.files?.length) {
                    const wrapped: DroppedFileWithPath[] = Array.from(e.target.files).map((f) => ({
                      file: f,
                      relativePath:
                        (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
                    }));
                    await handleInspectFiles(wrapped);
                  }
                  e.target.value = '';
                }}
              />
            </label>
            <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md cursor-pointer">
              <FileUp className="w-3.5 h-3.5" />
              Testar Arquivos Soltos
              <input
                type="file"
                multiple
                className="hidden"
                onChange={async (e) => {
                  if (e.target.files?.length) {
                    const wrapped: DroppedFileWithPath[] = Array.from(e.target.files).map((f) => ({
                      file: f,
                      relativePath: f.name,
                    }));
                    await handleInspectFiles(wrapped);
                  }
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        {inspectedFiles.length > 0 && (
          <div className="overflow-x-auto border border-slate-800 rounded-md">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0E1525] border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-2.5 px-3">Arquivo</th>
                  <th className="py-2.5 px-3">Formato</th>
                  <th className="py-2.5 px-3">Diagnóstico</th>
                  <th className="py-2.5 px-3">CRC-32 / SHA-256</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {inspectedFiles.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 max-w-[220px]">
                      <div className="font-medium text-white truncate">{f.fileName}</div>
                      <div className="text-[11px] font-mono text-slate-500 truncate">
                        {f.relativePath} · {formatFileSize(f.size)}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                      {f.detectedType}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 min-w-[240px]">
                      {f.summary}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap tabular-nums">
                      <div>CRC32: {f.crc32Hex}</div>
                      <div>SHA: {f.sha256Short}...</div>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {renderStatusBadge(f.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Patch Application Tester */}
      <section className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <FlaskConical className="w-4 h-4 text-emerald-400" />
          <h2 className="text-base font-semibold text-white">
            Simulador de Aplicação de Patch (.IPS ou .x360patch.json)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2 p-4 bg-[#0B111E] border border-slate-800 rounded-md cursor-pointer hover:border-slate-600">
            <span className="text-xs font-medium text-slate-300">
              1. Arquivo Original do Jogo
            </span>
            <span className="text-xs font-mono text-emerald-300 truncate">
              {origFileName || 'Clique para selecionar o arquivo original...'}
            </span>
            <input
              type="file"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setOrigFileName(f.name);
                  setOrigBytes(new Uint8Array(await f.arrayBuffer()));
                  setPatchResult(null);
                }
                e.target.value = '';
              }}
            />
          </label>

          <label className="flex flex-col gap-2 p-4 bg-[#0B111E] border border-slate-800 rounded-md cursor-pointer hover:border-slate-600">
            <span className="text-xs font-medium text-slate-300">
              2. Arquivo de Patch (.ips ou .x360patch.json)
            </span>
            <span className="text-xs font-mono text-emerald-300 truncate">
              {patchFileName || 'Clique para selecionar o patch...'}
            </span>
            <input
              type="file"
              accept=".ips,.json,.x360patch.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setPatchFileName(f.name);
                  setPatchBytes(new Uint8Array(await f.arrayBuffer()));
                  setPatchResult(null);
                }
                e.target.value = '';
              }}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!origBytes || !patchBytes}
            onClick={() => void handleRunPatchSimulation()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-md transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Testar Aplicação do Patch Agora
          </button>

          {patchResult?.ok && patchResult.patchedBytes && (
            <button
              type="button"
              onClick={() =>
                triggerBinaryDownload(
                  patchResult.patchedBytes!,
                  `testado_${origFileName || 'arquivo.bin'}`
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar Resultado Testado
            </button>
          )}
        </div>

        {patchResult && (
          <div
            className={`p-4 rounded-md border text-xs space-y-1.5 ${
              patchResult.ok
                ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200'
                : 'bg-red-950/40 border-red-700/50 text-red-200'
            }`}
          >
            <div className="font-semibold">{patchResult.message}</div>
            {patchResult.ok && (
              <div className="font-mono text-[11px] text-slate-300 tabular-nums">
                Tamanho final: {formatFileSize(patchResult.outputSize)} · CRC-32:{' '}
                {patchResult.crc32Hex} · SHA-256: {patchResult.sha256Hex.slice(0, 24)}...
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
