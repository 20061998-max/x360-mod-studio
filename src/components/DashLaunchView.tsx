import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, FileUp, RotateCcw } from 'lucide-react';
import { DashLaunchConfig } from '../types/modding';
import { triggerBinaryDownload } from '../utils/binaryPatch';
import {
  DEFAULT_DASHLAUNCH_CONFIG,
  generateLaunchIni,
  parseLaunchIni,
} from '../utils/dashLaunch';

interface DashLaunchViewProps {
  config: DashLaunchConfig;
  onChange: (next: DashLaunchConfig) => void;
}

const SETTING_DESCRIPTIONS: Array<{
  key: keyof Omit<DashLaunchConfig['settings'], 'hddtimer'>;
  label: string;
  desc: string;
}> = [
  { key: 'liveblock', label: 'liveblock', desc: 'Bloqueia acesso aos servidores da Xbox Live (recomendado).' },
  { key: 'livestrong', label: 'livestrong', desc: 'Reforça o bloqueio de DNS da Xbox Live.' },
  { key: 'noupdater', label: 'noupdater', desc: 'Impede atualizações acidentais do sistema via disco/USB.' },
  { key: 'contpatch', label: 'contpatch', desc: 'Libera pacotes de conteúdo/DLCs e mods no console com exploit.' },
  { key: 'xblapatch', label: 'xblapatch', desc: 'Libera jogos e conteúdos XBLA.' },
  { key: 'licpatch', label: 'licpatch', desc: 'Patch de licença para homebrews e conteúdos locais.' },
  { key: 'pingpatch', label: 'pingpatch', desc: 'Remove limite de 30ms de ping para System Link / LiNK.' },
  { key: 'nxemini', label: 'nxemini', desc: 'Ativa atalhos estendidos no botão Guia / miniblade.' },
  { key: 'fatalreboot', label: 'fatalreboot', desc: 'Reinicia o console automaticamente em caso de erro fatal.' },
  { key: 'fatalfreeze', label: 'fatalfreeze', desc: 'Congela na tela de erro fatal (desative se usar fatalreboot).' },
  { key: 'signnotice', label: 'signnotice', desc: 'Exibe avisos ao entrar em perfis.' },
  { key: 'tempbcast', label: 'tempbcast', desc: 'Envia leituras de temperatura na rede local.' },
  { key: 'hddalive', label: 'hddalive', desc: 'Mantém HDs USB externos acordados periodicamente.' },
];

export function DashLaunchView({ config, onChange }: DashLaunchViewProps) {
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const iniOutput = useMemo(() => generateLaunchIni(config), [config]);

  const updatePath = (key: keyof DashLaunchConfig['paths'], val: string) => {
    onChange({ ...config, paths: { ...config.paths, [key]: val } });
  };

  const updatePlugin = (key: keyof DashLaunchConfig['plugins'], val: string) => {
    onChange({ ...config, plugins: { ...config.plugins, [key]: val } });
  };

  const toggleSetting = (key: keyof Omit<DashLaunchConfig['settings'], 'hddtimer'>) => {
    onChange({
      ...config,
      settings: { ...config.settings, [key]: !config.settings[key] },
    });
  };

  const applyPreset = (preset: 'aurora_hdd' | 'aurora_usb' | 'fsd_hdd') => {
    if (preset === 'aurora_hdd') {
      onChange({
        ...DEFAULT_DASHLAUNCH_CONFIG,
        paths: {
          ...DEFAULT_DASHLAUNCH_CONFIG.paths,
          defaultPath: 'Hdd:\\Aurora\\Aurora.xex',
          butX: 'Hdd:\\XeXMenu\\default.xex',
        },
      });
    } else if (preset === 'aurora_usb') {
      onChange({
        ...DEFAULT_DASHLAUNCH_CONFIG,
        paths: {
          ...DEFAULT_DASHLAUNCH_CONFIG.paths,
          defaultPath: 'Usb:\\Aurora\\Aurora.xex',
          butX: 'Usb:\\XeXMenu\\default.xex',
        },
      });
    } else {
      onChange({
        ...DEFAULT_DASHLAUNCH_CONFIG,
        paths: {
          ...DEFAULT_DASHLAUNCH_CONFIG.paths,
          defaultPath: 'Hdd:\\Freestyle\\default.xex',
          butX: 'Hdd:\\XeXMenu\\default.xex',
        },
      });
    }
  };

  const handleImportIni = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportError(null);
    try {
      const text = await f.text();
      onChange(parseLaunchIni(text));
    } catch {
      setImportError('Não foi possível ler o arquivo launch.ini selecionado.');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(iniOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in restricted frame
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Gerador de launch.ini (DashLaunch)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure o boot automático para Aurora ou Freestyle, atalhos do controle, plugins e patches de sistema para Xbox 360 com exploit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0">
            <FileUp className="w-3.5 h-3.5" />
            Importar launch.ini
            <input type="file" accept=".ini,.txt" className="hidden" onChange={handleImportIni} />
          </label>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_DASHLAUNCH_CONFIG)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Padrão
          </button>
          <button
            type="button"
            onClick={() => triggerBinaryDownload(iniOutput, 'launch.ini', 'text/plain')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar launch.ini
          </button>
        </div>
      </div>

      {importError && (
        <div className="p-3 bg-red-950/40 border border-red-700/50 rounded-md text-xs text-red-200">
          {importError}
        </div>
      )}

      {/* Quick Presets */}
      <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-300">Perfis Rápidos de Boot:</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyPreset('aurora_hdd')}
            className="px-3 py-1.5 text-xs font-medium bg-[#0B111E] hover:bg-slate-800 border border-slate-700 text-slate-200 rounded transition-colors whitespace-nowrap"
          >
            Aurora no HD Interno (Hdd:\)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('aurora_usb')}
            className="px-3 py-1.5 text-xs font-medium bg-[#0B111E] hover:bg-slate-800 border border-slate-700 text-slate-200 rounded transition-colors whitespace-nowrap"
          >
            Aurora no Pendrive (Usb:\)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('fsd_hdd')}
            className="px-3 py-1.5 text-xs font-medium bg-[#0B111E] hover:bg-slate-800 border border-slate-700 text-slate-200 rounded transition-colors whitespace-nowrap"
          >
            Freestyle 3 no HD (Hdd:\)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Form Controls */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4">
            <h2 className="text-base font-semibold text-white pb-2 border-b border-slate-800">
              Caminhos de Boot e Atalhos ([Paths])
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">
                  Default (Dashboard principal ao ligar)
                </label>
                <input
                  type="text"
                  value={config.paths.defaultPath}
                  onChange={(e) => updatePath('defaultPath', e.target.value)}
                  placeholder="Hdd:\Aurora\Aurora.xex"
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Segurar Botão A (BUT_A)</label>
                <input
                  type="text"
                  value={config.paths.butA}
                  onChange={(e) => updatePath('butA', e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Segurar Botão X (BUT_X)</label>
                <input
                  type="text"
                  value={config.paths.butX}
                  onChange={(e) => updatePath('butX', e.target.value)}
                  placeholder="Hdd:\XeXMenu\default.xex"
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Segurar Botão B (BUT_B)</label>
                <input
                  type="text"
                  value={config.paths.butB}
                  onChange={(e) => updatePath('butB', e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Segurar Botão Y (BUT_Y)</label>
                <input
                  type="text"
                  value={config.paths.butY}
                  onChange={(e) => updatePath('butY', e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4">
            <h2 className="text-base font-semibold text-white pb-2 border-b border-slate-800">
              Plugins de Sistema ([Plugins])
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['plugin1', 'plugin2', 'plugin3', 'plugin4', 'plugin5'] as const).map((pKey) => (
                <div key={pKey}>
                  <label className="block text-xs text-slate-400 mb-1 font-mono">{pKey}</label>
                  <input
                    type="text"
                    value={config.plugins[pKey]}
                    onChange={(e) => updatePlugin(pKey, e.target.value)}
                    placeholder={`Ex: Hdd:\\Plugins\\${pKey}.xex`}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4">
            <h2 className="text-base font-semibold text-white pb-2 border-b border-slate-800">
              Patches e Comportamento ([Settings])
            </h2>

            <div className="divide-y divide-slate-800/80">
              {SETTING_DESCRIPTIONS.map((item) => {
                const checked = config.settings[item.key];
                return (
                  <label
                    key={item.key}
                    className="flex items-start justify-between gap-4 py-2.5 cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-mono font-semibold text-slate-100">
                        {item.label}
                      </div>
                      <div className="text-xs text-slate-400">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSetting(item.key)}
                      className="mt-1 w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                    />
                  </label>
                );
              })}

              <div className="pt-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono font-semibold text-slate-100">hddtimer</div>
                  <div className="text-xs text-slate-400">
                    Intervalo em segundos para manter HD externo ativo (se hddalive = true).
                  </div>
                </div>
                <input
                  type="number"
                  min={10}
                  max={3600}
                  value={config.settings.hddtimer}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      settings: {
                        ...config.settings,
                        hddtimer: Number(e.target.value) || 210,
                      },
                    })
                  }
                  className="w-24 px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="xl:col-span-5 bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4 xl:sticky xl:top-20">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-base font-semibold text-white">Prévia do Arquivo launch.ini</h2>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors whitespace-nowrap"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>

          <pre className="p-4 bg-[#0B111E] border border-slate-800 rounded-md text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
            {iniOutput}
          </pre>

          <p className="text-xs text-slate-400 leading-relaxed">
            Para aplicar no console, copie o arquivo <span className="font-mono text-slate-200">launch.ini</span> para a raiz do seu pendrive (<span className="font-mono text-slate-200">Usb:\launch.ini</span>) ou HD interno (<span className="font-mono text-slate-200">Hdd:\launch.ini</span>) antes de iniciar o DashLaunch.
          </p>
        </div>
      </div>
    </div>
  );
}
