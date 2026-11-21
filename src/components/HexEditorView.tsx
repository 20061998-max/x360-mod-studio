import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileUp,
  FlaskConical,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { HexPatchRule, HexValueType, ModProject } from '../types/modding';
import {
  applyHexPatchRules,
  bytesToAsciiPreview,
  createSampleFootballBinary,
  decodeBytesAtOffset,
  formatFileSize,
  formatHexOffset,
  parseHexOffset,
  searchInBinary,
  triggerBinaryDownload,
} from '../utils/binaryPatch';

interface HexEditorViewProps {
  project: ModProject;
  onUpdateRules: (rules: HexPatchRule[]) => void;
}

const VALUE_TYPE_LABELS: Array<{ value: HexValueType; label: string }> = [
  { value: 'hex', label: 'Bytes Hex (ex: 63 00 FF)' },
  { value: 'ascii', label: 'Texto ASCII' },
  { value: 'utf16be', label: 'Texto UTF-16 Big-Endian (Xbox 360)' },
  { value: 'uint16be', label: 'UInt16 Big-Endian' },
  { value: 'int16be', label: 'Int16 Big-Endian' },
  { value: 'uint32be', label: 'UInt32 Big-Endian (PowerPC)' },
  { value: 'int32be', label: 'Int32 Big-Endian (PowerPC)' },
  { value: 'float32be', label: 'Float32 Big-Endian (Física/Câmera)' },
  { value: 'int32le', label: 'Int32 Little-Endian' },
  { value: 'float32le', label: 'Float32 Little-Endian' },
];

const BYTES_PER_ROW = 16;
const ROWS_PER_PAGE = 16; // 256 bytes per page

export function HexEditorView({ project, onUpdateRules }: HexEditorViewProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [binaryData, setBinaryData] = useState<Uint8Array | null>(null);
  const [pageOffset, setPageOffset] = useState(0);
  const [selectedOffset, setSelectedOffset] = useState(0);
  const [jumpInput, setJumpInput] = useState('0x00000000');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'ascii' | 'utf16be' | 'hex' | 'int32be' | 'float32be'>('ascii');
  const [searchHits, setSearchHits] = useState<number[]>([]);

  // New rule state
  const [ruleName, setRuleName] = useState('');
  const [ruleOffset, setRuleOffset] = useState('0x00000008');
  const [ruleType, setRuleType] = useState<HexValueType>('uint32be');
  const [ruleValue, setRuleValue] = useState('2026');
  const [ruleNotes, setRuleNotes] = useState('');
  const [applyFeedback, setApplyFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleLoadSample = () => {
    const sample = createSampleFootballBinary('original');
    setFileName('database_futebol_exemplo.bin');
    setBinaryData(sample);
    setPageOffset(0);
    setSelectedOffset(0x08);
    setJumpInput('0x00000008');
    setApplyFeedback(null);
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const buf = new Uint8Array(await f.arrayBuffer());
    setFileName(f.name);
    setBinaryData(buf);
    setPageOffset(0);
    setSelectedOffset(0);
    setJumpInput('0x00000000');
    setSearchHits([]);
    setApplyFeedback(null);
  };

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    if (!binaryData) return;
    const parsed = parseHexOffset(jumpInput);
    if (parsed === null) return;
    const clamped = Math.min(Math.max(0, parsed), Math.max(0, binaryData.length - 1));
    setSelectedOffset(clamped);
    setRuleOffset(formatHexOffset(clamped));
    setPageOffset(Math.floor(clamped / (BYTES_PER_ROW * ROWS_PER_PAGE)) * (BYTES_PER_ROW * ROWS_PER_PAGE));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!binaryData || !searchQuery.trim()) return;
    const hits = searchInBinary(binaryData, searchQuery, searchMode);
    setSearchHits(hits);
    if (hits.length > 0) {
      const first = hits[0];
      setSelectedOffset(first);
      setRuleOffset(formatHexOffset(first));
      setPageOffset(Math.floor(first / (BYTES_PER_ROW * ROWS_PER_PAGE)) * (BYTES_PER_ROW * ROWS_PER_PAGE));
    }
  };

  const decoded = useMemo(() => {
    if (!binaryData) return null;
    return decodeBytesAtOffset(binaryData, selectedOffset);
  }, [binaryData, selectedOffset]);

  const hexRows = useMemo(() => {
    if (!binaryData) return [];
    const rows: Array<{ rowOffset: number; bytes: Uint8Array }> = [];
    for (let r = 0; r < ROWS_PER_PAGE; r++) {
      const start = pageOffset + r * BYTES_PER_ROW;
      if (start >= binaryData.length) break;
      rows.push({
        rowOffset: start,
        bytes: binaryData.slice(start, Math.min(binaryData.length, start + BYTES_PER_ROW)),
      });
    }
    return rows;
  }, [binaryData, pageOffset]);

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !ruleValue.trim()) return;
    const parsed = parseHexOffset(ruleOffset);
    const normalizedOffset = parsed !== null ? formatHexOffset(parsed) : ruleOffset.trim();

    const newRule: HexPatchRule = {
      id: `hex-${Date.now()}`,
      name: ruleName.trim(),
      offsetHex: normalizedOffset,
      type: ruleType,
      value: ruleValue,
      enabled: true,
      notes: ruleNotes.trim(),
    };

    onUpdateRules([...project.hexRules, newRule]);
    setRuleName('');
    setRuleNotes('');
  };

  const handleToggleRule = (id: string) => {
    onUpdateRules(
      project.hexRules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleDeleteRule = (id: string) => {
    onUpdateRules(project.hexRules.filter((r) => r.id !== id));
  };

  const handleApplyRulesAndDownload = (download: boolean) => {
    if (!binaryData) return;
    const result = applyHexPatchRules(binaryData, project.hexRules);
    if (result.errors.length > 0) {
      setApplyFeedback({
        type: 'error',
        message: result.errors.join(' | '),
      });
      return;
    }
    setBinaryData(result.patched);
    setApplyFeedback({
      type: 'success',
      message: `${result.appliedCount} regra(s) aplicadas na memória${
        download ? ' e arquivo modificado baixado.' : '.'
      }`,
    });
    if (download && fileName) {
      const dot = fileName.lastIndexOf('.');
      const outName =
        dot > 0 ? `${fileName.slice(0, dot)}_patched${fileName.slice(dot)}` : `${fileName}_patched`;
      triggerBinaryDownload(result.patched, outName);
    }
  };

  const pageBytes = BYTES_PER_ROW * ROWS_PER_PAGE;
  const maxPageOffset = binaryData
    ? Math.max(0, Math.floor((binaryData.length - 1) / pageBytes) * pageBytes)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Editor Hex & Regras Big-Endian (PowerPC)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Inspecione offsets em Big-Endian (padrão Xbox 360), busque textos ou atributos numéricos e salve regras reutilizáveis de mod.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-800/60 hover:bg-emerald-900/50 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Carregar Exemplo Futebol
          </button>
          <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0">
            <FileUp className="w-4 h-4" />
            Abrir Arquivo
            <input type="file" className="hidden" onChange={handleUploadFile} />
          </label>
        </div>
      </div>

      {binaryData && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Hex Grid */}
          <div className="xl:col-span-8 bg-[#141D2F] border border-slate-800 rounded-lg p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="text-xs font-mono tabular-nums text-slate-300 truncate">
                {fileName} · {formatFileSize(binaryData.length)} ({binaryData.length} bytes)
              </div>

              <form onSubmit={handleJump} className="flex items-center gap-2">
                <input
                  type="text"
                  value={jumpInput}
                  onChange={(e) => setJumpInput(e.target.value)}
                  placeholder="0x00000000"
                  className="w-28 px-2.5 py-1.5 text-xs font-mono bg-[#0B111E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors whitespace-nowrap"
                >
                  Ir ao Offset
                </button>
              </form>
            </div>

            <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
              <select
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value as typeof searchMode)}
                className="px-2.5 py-1.5 text-xs bg-[#0B111E] border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="ascii">Texto ASCII</option>
                <option value="utf16be">UTF-16 BE</option>
                <option value="hex">Hex</option>
                <option value="int32be">Int32 BE</option>
                <option value="float32be">Float32 BE</option>
              </select>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar no arquivo (ex: LIGA, 2013, 4B 4E)..."
                className="flex-1 min-w-[180px] px-3 py-1.5 text-xs bg-[#0B111E] border border-slate-700 rounded text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded transition-colors whitespace-nowrap"
              >
                <Search className="w-3.5 h-3.5" />
                Buscar
              </button>
            </form>

            {searchHits.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-400 mr-1">Ocorrências ({searchHits.length}):</span>
                {searchHits.slice(0, 10).map((hit) => (
                  <button
                    key={hit}
                    type="button"
                    onClick={() => {
                      setSelectedOffset(hit);
                      setRuleOffset(formatHexOffset(hit));
                      setPageOffset(Math.floor(hit / pageBytes) * pageBytes);
                    }}
                    className={`px-2 py-0.5 font-mono tabular-nums rounded border transition-colors ${
                      selectedOffset === hit
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-[#0B111E] border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {formatHexOffset(hit, 6)}
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-x-auto border border-slate-800 rounded-md bg-[#0B111E] p-3">
              <table className="w-full font-mono tabular-nums text-xs border-collapse">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="text-left pb-2 pr-3 font-medium">Offset</th>
                    <th className="text-left pb-2 pr-3 font-medium">00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F</th>
                    <th className="text-left pb-2 font-medium">ASCII</th>
                  </tr>
                </thead>
                <tbody>
                  {hexRows.map((row) => (
                    <tr key={row.rowOffset} className="hover:bg-slate-900/70">
                      <td className="py-1 pr-3 text-slate-500 select-none whitespace-nowrap">
                        {formatHexOffset(row.rowOffset, 8)}
                      </td>
                      <td className="py-1 pr-3 whitespace-nowrap">
                        <div className="inline-flex gap-1">
                          {Array.from(row.bytes).map((byte, idx) => {
                            const absOffset = row.rowOffset + idx;
                            const isSelected = absOffset === selectedOffset;
                            return (
                              <button
                                key={absOffset}
                                type="button"
                                onClick={() => {
                                  setSelectedOffset(absOffset);
                                  setRuleOffset(formatHexOffset(absOffset));
                                  setJumpInput(formatHexOffset(absOffset));
                                }}
                                className={`w-6 text-center rounded transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white font-semibold'
                                    : byte === 0
                                    ? 'text-slate-600 hover:bg-slate-800'
                                    : 'text-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                {byte.toString(16).toUpperCase().padStart(2, '0')}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-1 text-slate-400 whitespace-nowrap">
                        {bytesToAsciiPreview(row.bytes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <button
                type="button"
                disabled={pageOffset === 0}
                onClick={() => setPageOffset(Math.max(0, pageOffset - pageBytes))}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded transition-colors"
              >
                Página Anterior
              </button>
              <span className="font-mono tabular-nums">
                Exibindo {formatHexOffset(pageOffset, 6)} –{' '}
                {formatHexOffset(Math.min(binaryData.length - 1, pageOffset + pageBytes - 1), 6)}
              </span>
              <button
                type="button"
                disabled={pageOffset >= maxPageOffset}
                onClick={() => setPageOffset(Math.min(maxPageOffset, pageOffset + pageBytes))}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded transition-colors"
              >
                Próxima Página
              </button>
            </div>
          </div>

          {/* PowerPC Inspector */}
          <div className="xl:col-span-4 bg-[#141D2F] border border-slate-800 rounded-lg p-4 space-y-4">
            <div className="pb-3 border-b border-slate-800">
              <div className="text-sm font-semibold text-white">Inspetor PowerPC (Big-Endian)</div>
              <div className="text-xs font-mono tabular-nums text-emerald-400 mt-0.5">
                Offset selecionado: {formatHexOffset(selectedOffset)}
              </div>
            </div>

            {decoded && (
              <dl className="divide-y divide-slate-800/80 text-xs">
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-slate-400">UInt8 (1 byte)</dt>
                  <dd className="font-mono tabular-nums text-slate-100">{decoded.uint8}</dd>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-slate-400">UInt16 Big-Endian</dt>
                  <dd className="font-mono tabular-nums text-slate-100">
                    {decoded.uint16be ?? '—'}
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-slate-400">Int16 Big-Endian</dt>
                  <dd className="font-mono tabular-nums text-slate-100">
                    {decoded.int16be ?? '—'}
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-slate-400">UInt32 Big-Endian</dt>
                  <dd className="font-mono tabular-nums text-slate-100">
                    {decoded.uint32be ?? '—'}
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-slate-400">Int32 Big-Endian</dt>
                  <dd className="font-mono tabular-nums text-slate-100">
                    {decoded.int32be ?? '—'}
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-slate-400">Float32 Big-Endian</dt>
                  <dd className="font-mono tabular-nums text-slate-100">
                    {decoded.float32be !== null ? decoded.float32be.toFixed(4) : '—'}
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-slate-400">Int32 Little-Endian</dt>
                  <dd className="font-mono tabular-nums text-slate-400">
                    {decoded.int32le ?? '—'}
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-slate-400">ASCII (16B)</dt>
                  <dd className="font-mono text-slate-200 truncate max-w-[160px]">
                    {decoded.ascii16}
                  </dd>
                </div>
              </dl>
            )}

            <div className="pt-2 border-t border-slate-800 space-y-2.5">
              <button
                type="button"
                onClick={() => handleApplyRulesAndDownload(false)}
                className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-md transition-colors"
              >
                Testar Regras Ativas na Memória
              </button>
              <button
                type="button"
                onClick={() => handleApplyRulesAndDownload(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
              >
                <Download className="w-4 h-4" />
                Aplicar Regras e Baixar Arquivo
              </button>
            </div>

            {applyFeedback && (
              <div
                className={`flex items-start gap-2 p-3 rounded-md border text-xs ${
                  applyFeedback.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200'
                    : 'bg-red-950/40 border-red-700/50 text-red-200'
                }`}
              >
                {applyFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <span>{applyFeedback.message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hex Patch Rules Manager (always accessible per project) */}
      <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-5">
        <div className="pb-3 border-b border-slate-800">
          <h2 className="text-base font-semibold text-white">
            Regras de Modificação por Offset ({project.hexRules.length})
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Salve alterações de ano, nome de liga, atributos de jogadores ou multiplicadores de física para aplicar com 1 clique no arquivo do jogo.
          </p>
        </div>

        <form onSubmit={handleAddRule} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <label className="block text-xs text-slate-400 mb-1">Nome da Regra</label>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="Ex: Overall Atacante 88"
              className="w-full px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Offset (Hex)</label>
            <input
              type="text"
              value={ruleOffset}
              onChange={(e) => setRuleOffset(e.target.value)}
              placeholder="0x00000064"
              className="w-full px-3 py-2 text-xs font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs text-slate-400 mb-1">Formato (Xbox 360)</label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as HexValueType)}
              className="w-full px-2.5 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              {VALUE_TYPE_LABELS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Novo Valor</label>
            <input
              type="text"
              value={ruleValue}
              onChange={(e) => setRuleValue(e.target.value)}
              placeholder="Ex: 88 ou BRASIL"
              className="w-full px-3 py-2 text-xs font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </div>
        </form>

        {project.hexRules.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 border border-slate-800 rounded-md">
            Nenhuma regra cadastrada neste projeto ainda. Adicione uma regra acima.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-md">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0E1525] border-b border-slate-800 text-xs font-medium text-slate-400">
                  <th className="py-2.5 px-3 w-12">Ativa</th>
                  <th className="py-2.5 px-3">Regra</th>
                  <th className="py-2.5 px-3">Offset</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Valor</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {project.hexRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => handleToggleRule(rule.id)}
                        aria-label={`Ativar regra ${rule.name}`}
                        className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-slate-100 font-medium">
                      <div>{rule.name}</div>
                      {rule.notes && <div className="text-[11px] text-slate-400">{rule.notes}</div>}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-emerald-400 whitespace-nowrap">
                      {rule.offsetHex}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                      {rule.type}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-100 whitespace-nowrap">
                      {rule.value}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {binaryData && (
                        <button
                          type="button"
                          onClick={() => {
                            const pos = parseHexOffset(rule.offsetHex);
                            if (pos !== null && pos < binaryData.length) {
                              setSelectedOffset(pos);
                              setPageOffset(Math.floor(pos / pageBytes) * pageBytes);
                            }
                          }}
                          className="text-xs text-slate-300 hover:text-emerald-400 mr-3"
                        >
                          Ir
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-slate-400 hover:text-red-400"
                        title="Remover regra"
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
    </div>
  );
}
