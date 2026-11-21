import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  FootballRosterEntry,
  ModAssetCategory,
  ModAssetEntry,
  ModProject,
  RacingVehicleEntry,
  WeaponModEntry,
} from '../types/modding';
import { triggerBinaryDownload } from '../utils/binaryPatch';
import {
  exportInstallGuideTxt,
  exportProjectModIni,
  exportRosterCsv,
  exportVehiclesHandlingCfg,
  exportWeaponsGscScript,
} from '../utils/projectStorage';

interface ModPackageViewProps {
  project: ModProject;
  onUpdateProject: (updated: ModProject) => void;
}

const CATEGORIES: ModAssetCategory[] = [
  'Elenco / Database',
  'Uniformes / Texturas',
  'Veículos / Handling',
  'Armas / Balística',
  'Estádios / Cenários',
  'Áudio / Narração',
  'Tradução / Textos',
  'Física / Jogabilidade',
  'Executável / Config',
];

export function ModPackageView({ project, onUpdateProject }: ModPackageViewProps) {
  const [subTab, setSubTab] = useState<'assets' | 'roster' | 'vehicles' | 'weapons'>('assets');
  const [searchTerm, setSearchTerm] = useState('');

  // New Asset state
  const [assetCategory, setAssetCategory] = useState<ModAssetCategory>('Elenco / Database');
  const [assetPath, setAssetPath] = useState('');
  const [assetAction, setAssetAction] = useState<ModAssetEntry['action']>('Substituir');
  const [assetNotes, setAssetNotes] = useState('');

  // New Roster entry state
  const [club, setClub] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [position, setPosition] = useState('CA');
  const [overall, setOverall] = useState(80);
  const [age, setAge] = useState(22);
  const [shirtNumber, setShirtNumber] = useState(9);
  const [changeType, setChangeType] = useState<FootballRosterEntry['changeType']>('Transferência');

  // New Vehicle entry state
  const [vehicleName, setVehicleName] = useState('');
  const [replacesSlot, setReplacesSlot] = useState('CUSTOM_SLOT_01');
  const [topSpeedKmh, setTopSpeedKmh] = useState(310);
  const [horsepower, setHorsepower] = useState(520);
  const [massKg, setMassKg] = useState(1420);
  const [drivetrain, setDrivetrain] = useState<RacingVehicleEntry['drivetrain']>('AWD');
  const [grip, setGrip] = useState(1.15);
  const [vehicleAssetPath, setVehicleAssetPath] = useState('vehicles\\custom\\carro_01.bin');

  // New Weapon entry state
  const [weaponName, setWeaponName] = useState('');
  const [baseWeaponId, setBaseWeaponId] = useState('ak47_mp');
  const [weaponCategory, setWeaponCategory] = useState<WeaponModEntry['category']>('Rifle');
  const [damage, setDamage] = useState(45);
  const [fireRateRpm, setFireRateRpm] = useState(720);
  const [magazineSize, setMagazineSize] = useState(35);
  const [recoil, setRecoil] = useState(0.4);
  const [weaponAssetPath, setWeaponAssetPath] = useState('weapons\\mp\\arma_custom');

  const updateMeta = <K extends keyof ModProject>(field: K, value: ModProject[K]) => {
    onUpdateProject({
      ...project,
      [field]: value,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetPath.trim()) return;
    const nextAsset: ModAssetEntry = {
      id: `asset-${Date.now()}`,
      category: assetCategory,
      targetPath: assetPath.trim(),
      action: assetAction,
      status: 'Pronto',
      notes: assetNotes.trim(),
    };
    updateMeta('modAssets', [...project.modAssets, nextAsset]);
    setAssetPath('');
    setAssetNotes('');
  };

  const handleRemoveAsset = (id: string) => {
    updateMeta(
      'modAssets',
      project.modAssets.filter((a) => a.id !== id)
    );
  };

  const handleUpdateAssetStatus = (id: string, status: ModAssetEntry['status']) => {
    updateMeta(
      'modAssets',
      project.modAssets.map((a) => (a.id === id ? { ...a, status } : a))
    );
  };

  const handleAddRoster = (e: React.FormEvent) => {
    e.preventDefault();
    if (!club.trim() || !playerName.trim()) return;
    const entry: FootballRosterEntry = {
      id: `roster-${Date.now()}`,
      club: club.trim(),
      playerName: playerName.trim(),
      position: position.trim().toUpperCase() || 'MC',
      overall: Math.min(99, Math.max(40, Number(overall) || 75)),
      age: Math.min(50, Math.max(15, Number(age) || 22)),
      nationality: 'Brasil',
      shirtNumber: Math.min(99, Math.max(1, Number(shirtNumber) || 10)),
      changeType,
    };
    updateMeta('rosterUpdates', [...project.rosterUpdates, entry]);
    setPlayerName('');
  };

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleName.trim() || !replacesSlot.trim()) return;
    const entry: RacingVehicleEntry = {
      id: `veh-${Date.now()}`,
      vehicleName: vehicleName.trim(),
      replacesSlot: replacesSlot.trim().toUpperCase(),
      topSpeedKmh: Math.max(50, Number(topSpeedKmh) || 250),
      horsepower: Math.max(40, Number(horsepower) || 300),
      massKg: Math.max(400, Number(massKg) || 1400),
      drivetrain,
      grip: Math.max(0.1, Number(grip) || 1.0),
      assetPath: vehicleAssetPath.trim() || 'vehicles\\custom\\slot.bin',
      status: 'Pronto',
    };
    updateMeta('vehicleMods', [...project.vehicleMods, entry]);
    setVehicleName('');
  };

  const handleAddWeapon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!weaponName.trim() || !baseWeaponId.trim()) return;
    const entry: WeaponModEntry = {
      id: `wpn-${Date.now()}`,
      weaponName: weaponName.trim(),
      baseWeaponId: baseWeaponId.trim(),
      category: weaponCategory,
      damage: Math.max(1, Number(damage) || 40),
      fireRateRpm: Math.max(30, Number(fireRateRpm) || 600),
      magazineSize: Math.max(1, Number(magazineSize) || 30),
      recoil: Math.max(0, Number(recoil) || 0.4),
      assetPath: weaponAssetPath.trim() || 'weapons\\mp\\custom',
      status: 'Pronto',
    };
    updateMeta('weaponMods', [...project.weaponMods, entry]);
    setWeaponName('');
  };

  const filteredAssets = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return project.modAssets;
    return project.modAssets.filter(
      (a) =>
        a.targetPath.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.notes.toLowerCase().includes(q)
    );
  }, [project.modAssets, searchTerm]);

  const filteredRoster = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return project.rosterUpdates;
    return project.rosterUpdates.filter(
      (r) =>
        r.club.toLowerCase().includes(q) ||
        r.playerName.toLowerCase().includes(q) ||
        r.position.toLowerCase().includes(q)
    );
  }, [project.rosterUpdates, searchTerm]);

  const filteredVehicles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return project.vehicleMods;
    return project.vehicleMods.filter(
      (v) =>
        v.vehicleName.toLowerCase().includes(q) ||
        v.replacesSlot.toLowerCase().includes(q) ||
        v.assetPath.toLowerCase().includes(q)
    );
  }, [project.vehicleMods, searchTerm]);

  const filteredWeapons = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return project.weaponMods;
    return project.weaponMods.filter(
      (w) =>
        w.weaponName.toLowerCase().includes(q) ||
        w.baseWeaponId.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q)
    );
  }, [project.weaponMods, searchTerm]);

  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'mod_x360';

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Configurador de Pacote de Mod & Atualizações
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Estruture mods por Title ID e exporte configurações de elencos (futebol), veículos (corrida) e armas/scripts GSC (tiro).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => triggerBinaryDownload(exportProjectModIni(project), `${slug}_mod_config.ini`, 'text/plain')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            mod_config.ini
          </button>
          <button
            type="button"
            onClick={() => triggerBinaryDownload(exportVehiclesHandlingCfg(project), `${slug}_handling.cfg`, 'text/plain')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            handling.cfg
          </button>
          <button
            type="button"
            onClick={() => triggerBinaryDownload(exportWeaponsGscScript(project), `${slug}_weapons.gsc`, 'text/plain')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <FileCode className="w-3.5 h-3.5" />
            weapons.gsc
          </button>
          <button
            type="button"
            onClick={() => triggerBinaryDownload(exportRosterCsv(project), `${slug}_elencos.csv`, 'text/csv')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Elencos .CSV
          </button>
          <button
            type="button"
            onClick={() => triggerBinaryDownload(exportInstallGuideTxt(project), `LEIA_ME_${slug}.txt`, 'text/plain')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            Guia (.txt)
          </button>
        </div>
      </div>

      {/* Game & Title ID Metadata */}
      <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="pb-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-white">Identificação do Jogo e Destino no Console</h2>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            Title ID: {project.titleId} · Media ID: {project.mediaId}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome do Mod / Patch</label>
            <input
              type="text"
              value={project.name}
              onChange={(e) => updateMeta('name', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Jogo Base (Xbox 360)</label>
            <input
              type="text"
              value={project.gameTitle}
              onChange={(e) => updateMeta('gameTitle', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Title ID (8 dígitos Hex)</label>
            <input
              type="text"
              maxLength={8}
              value={project.titleId}
              onChange={(e) => updateMeta('titleId', e.target.value.toUpperCase())}
              className="w-full px-3 py-2 text-sm font-mono uppercase bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Versão do Patch</label>
            <input
              type="text"
              value={project.patchVersion}
              onChange={(e) => updateMeta('patchVersion', e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Gênero</label>
            <select
              value={project.genre}
              onChange={(e) => updateMeta('genre', e.target.value as ModProject['genre'])}
              className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="Futebol">Futebol</option>
              <option value="Corrida">Corrida</option>
              <option value="Tiro / FPS">Tiro / FPS</option>
              <option value="Ação / Mundo Aberto">Ação / Mundo Aberto</option>
              <option value="Luta">Luta</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Autor / Equipe</label>
            <input
              type="text"
              value={project.author}
              onChange={(e) => updateMeta('author', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Pasta de Destino no HD do Xbox 360</label>
            <input
              type="text"
              value={project.installTarget}
              onChange={(e) => updateMeta('installTarget', e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Descrição das Novidades do Mod</label>
          <textarea
            rows={2}
            value={project.description}
            onChange={(e) => updateMeta('description', e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#0B111E] border border-slate-800 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setSubTab('assets')}
              className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'assets'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Arquivos ({project.modAssets.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('vehicles')}
              className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'vehicles'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Carros / Corrida ({project.vehicleMods.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('weapons')}
              className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'weapons'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Armas / Tiro ({project.weaponMods.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('roster')}
              className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'roster'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Elencos / Futebol ({project.rosterUpdates.length})
            </button>
          </div>

          <div className="relative w-full lg:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar lista..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {subTab === 'assets' && (
          <div className="space-y-5">
            <form onSubmit={handleAddAsset} className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-3">
                <label className="block text-xs text-slate-400 mb-1">Categoria</label>
                <select
                  value={assetCategory}
                  onChange={(e) => setAssetCategory(e.target.value as ModAssetCategory)}
                  className="w-full px-2.5 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-4">
                <label className="block text-xs text-slate-400 mb-1">Caminho Relativo no Jogo</label>
                <input
                  type="text"
                  value={assetPath}
                  onChange={(e) => setAssetPath(e.target.value)}
                  placeholder="Ex: common\data\handling.dat"
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Ação</label>
                <select
                  value={assetAction}
                  onChange={(e) => setAssetAction(e.target.value as ModAssetEntry['action'])}
                  className="w-full px-2.5 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Substituir">Substituir</option>
                  <option value="Aplicar Patch IPS/Hex">Aplicar Patch</option>
                  <option value="Adicionar Novo">Adicionar Novo</option>
                </select>
              </div>
              <div className="md:col-span-3 flex items-end gap-2">
                <input
                  type="text"
                  value={assetNotes}
                  onChange={(e) => setAssetNotes(e.target.value)}
                  placeholder="Observação curta"
                  className="flex-1 px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Incluir
                </button>
              </div>
            </form>

            {filteredAssets.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-slate-800 rounded-md">
                Nenhum arquivo cadastrado para este filtro.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-md">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0E1525] border-b border-slate-800 text-xs font-medium text-slate-400">
                      <th className="py-2.5 px-3">Categoria</th>
                      <th className="py-2.5 px-3">Caminho do Arquivo</th>
                      <th className="py-2.5 px-3">Ação</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-right">Remover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs">
                    {filteredAssets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-slate-200 whitespace-nowrap">{asset.category}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-mono text-emerald-300">{asset.targetPath}</div>
                          {asset.notes && <div className="text-[11px] text-slate-400">{asset.notes}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{asset.action}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <select
                            value={asset.status}
                            onChange={(e) =>
                              handleUpdateAssetStatus(asset.id, e.target.value as ModAssetEntry['status'])
                            }
                            className={`px-2 py-1 text-xs bg-[#0B111E] border border-slate-700 rounded focus:outline-none ${
                              asset.status === 'Pronto'
                                ? 'text-emerald-400'
                                : asset.status === 'Em Testes'
                                ? 'text-amber-400'
                                : 'text-slate-300'
                            }`}
                          >
                            <option value="Pronto">Pronto</option>
                            <option value="Em Testes">Em Testes</option>
                            <option value="Pendente">Pendente</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveAsset(asset.id)}
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
        )}

        {subTab === 'vehicles' && (
          <div className="space-y-5">
            <div className="flex items-start gap-2.5 p-3 bg-[#0E1525] border border-slate-800 rounded-md text-xs text-slate-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Para adicionar carros que não existem no jogo, é necessário substituir um slot de veículo existente usando o modelo 3D/textura no formato da engine daquele jogo e configurar abaixo os parâmetros de física para exportar em <span className="font-mono text-white">handling.cfg</span>.
              </span>
            </div>

            <form onSubmit={handleAddVehicle} className="grid grid-cols-2 md:grid-cols-12 gap-3">
              <div className="col-span-2 md:col-span-3">
                <label className="block text-xs text-slate-400 mb-1">Nome do Carro Novo</label>
                <input
                  type="text"
                  value={vehicleName}
                  onChange={(e) => setVehicleName(e.target.value)}
                  placeholder="Ex: Lamborghini Aventador"
                  className="w-full px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div className="col-span-2 md:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Slot Base Substituído</label>
                <input
                  type="text"
                  value={replacesSlot}
                  onChange={(e) => setReplacesSlot(e.target.value)}
                  placeholder="INFERNUS_01"
                  className="w-full px-3 py-2 text-xs font-mono uppercase bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">Km/h</label>
                <input
                  type="number"
                  value={topSpeedKmh}
                  onChange={(e) => setTopSpeedKmh(Number(e.target.value))}
                  className="w-full px-2 py-2 text-xs font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">CV</label>
                <input
                  type="number"
                  value={horsepower}
                  onChange={(e) => setHorsepower(Number(e.target.value))}
                  className="w-full px-2 py-2 text-xs font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">Kg</label>
                <input
                  type="number"
                  value={massKg}
                  onChange={(e) => setMassKg(Number(e.target.value))}
                  className="w-full px-2 py-2 text-xs font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">Tração</label>
                <select
                  value={drivetrain}
                  onChange={(e) => setDrivetrain(e.target.value as RacingVehicleEntry['drivetrain'])}
                  className="w-full px-2 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="AWD">AWD</option>
                  <option value="RWD">RWD</option>
                  <option value="FWD">FWD</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-3 flex items-end gap-2">
                <input
                  type="text"
                  value={vehicleAssetPath}
                  onChange={(e) => setVehicleAssetPath(e.target.value)}
                  placeholder="Caminho do modelo 3D"
                  className="flex-1 px-2.5 py-2 text-xs font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar
                </button>
              </div>
            </form>

            {filteredVehicles.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-slate-800 rounded-md">
                Nenhum carro customizado cadastrado neste projeto ainda.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-md">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0E1525] border-b border-slate-800 text-xs font-medium text-slate-400">
                      <th className="py-2.5 px-3">Carro Novo</th>
                      <th className="py-2.5 px-3">Slot Base</th>
                      <th className="py-2.5 px-3 text-right">Vel. Máx</th>
                      <th className="py-2.5 px-3 text-right">Potência</th>
                      <th className="py-2.5 px-3 text-right">Massa</th>
                      <th className="py-2.5 px-3">Tração</th>
                      <th className="py-2.5 px-3">Asset</th>
                      <th className="py-2.5 px-3 text-right">Remover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs">
                    {filteredVehicles.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-medium text-white">{v.vehicleName}</td>
                        <td className="py-2.5 px-3 font-mono text-emerald-400 whitespace-nowrap">{v.replacesSlot}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200">{v.topSpeedKmh} km/h</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200">{v.horsepower} cv</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">{v.massKg} kg</td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{v.drivetrain}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400 truncate max-w-[180px]">{v.assetPath}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              updateMeta(
                                'vehicleMods',
                                project.vehicleMods.filter((item) => item.id !== v.id)
                              )
                            }
                            className="text-slate-400 hover:text-red-400 p-1"
                            title="Remover veículo"
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
        )}

        {subTab === 'weapons' && (
          <div className="space-y-5">
            <div className="flex items-start gap-2.5 p-3 bg-[#0E1525] border border-slate-800 rounded-md text-xs text-slate-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Para jogos de tiro (como Call of Duty no Xbox 360 com exploit), configure abaixo os parâmetros de balística e gere o script <span className="font-mono text-white">weapons.gsc</span> para aplicar nos slots de armas existentes ou em modelos customizados compilados para a engine.
              </span>
            </div>

            <form onSubmit={handleAddWeapon} className="grid grid-cols-2 md:grid-cols-12 gap-3">
              <div className="col-span-2 md:col-span-3">
                <label className="block text-xs text-slate-400 mb-1">Nome da Arma Nova</label>
                <input
                  type="text"
                  value={weaponName}
                  onChange={(e) => setWeaponName(e.target.value)}
                  placeholder="Ex: SCAR-H Modificada"
                  className="w-full px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">ID Base (Weapon Slot)</label>
                <input
                  type="text"
                  value={baseWeaponId}
                  onChange={(e) => setBaseWeaponId(e.target.value)}
                  placeholder="scar_mp"
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Classe</label>
                <select
                  value={weaponCategory}
                  onChange={(e) => setWeaponCategory(e.target.value as WeaponModEntry['category'])}
                  className="w-full px-2.5 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Rifle">Rifle</option>
                  <option value="Submetralhadora">SMG</option>
                  <option value="Sniper">Sniper</option>
                  <option value="Escopeta">Escopeta</option>
                  <option value="Pistola">Pistola</option>
                  <option value="Especial">Especial</option>
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">Dano</label>
                <input
                  type="number"
                  value={damage}
                  onChange={(e) => setDamage(Number(e.target.value))}
                  className="w-full px-2 py-2 text-xs font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">RPM</label>
                <input
                  type="number"
                  value={fireRateRpm}
                  onChange={(e) => setFireRateRpm(Number(e.target.value))}
                  className="w-full px-2 py-2 text-xs font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">Pente</label>
                <input
                  type="number"
                  value={magazineSize}
                  onChange={(e) => setMagazineSize(Number(e.target.value))}
                  className="w-full px-2 py-2 text-xs font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="col-span-2 md:col-span-2 flex items-end gap-2">
                <input
                  type="number"
                  step="0.05"
                  value={recoil}
                  onChange={(e) => setRecoil(Number(e.target.value))}
                  aria-label="Recuo"
                  title="Recuo"
                  className="w-16 px-2 py-2 text-xs font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Salvar
                </button>
              </div>
            </form>

            {filteredWeapons.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-slate-800 rounded-md">
                Nenhuma arma configurada neste projeto ainda.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-md">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0E1525] border-b border-slate-800 text-xs font-medium text-slate-400">
                      <th className="py-2.5 px-3">Arma Nova</th>
                      <th className="py-2.5 px-3">ID Base</th>
                      <th className="py-2.5 px-3">Classe</th>
                      <th className="py-2.5 px-3 text-right">Dano</th>
                      <th className="py-2.5 px-3 text-right">RPM</th>
                      <th className="py-2.5 px-3 text-right">Munição</th>
                      <th className="py-2.5 px-3 text-right">Recuo</th>
                      <th className="py-2.5 px-3 text-right">Remover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs">
                    {filteredWeapons.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-medium text-white">{w.weaponName}</td>
                        <td className="py-2.5 px-3 font-mono text-emerald-400 whitespace-nowrap">{w.baseWeaponId}</td>
                        <td className="py-2.5 px-3 text-slate-300">{w.category}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200">{w.damage}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200">{w.fireRateRpm}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200">{w.magazineSize}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">{w.recoil.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              updateMeta(
                                'weaponMods',
                                project.weaponMods.filter((item) => item.id !== w.id)
                              )
                            }
                            className="text-slate-400 hover:text-red-400 p-1"
                            title="Remover arma"
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
        )}

        {subTab === 'roster' && (
          <div className="space-y-5">
            <form onSubmit={handleAddRoster} className="grid grid-cols-2 md:grid-cols-12 gap-3">
              <div className="col-span-2 md:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Clube</label>
                <input
                  type="text"
                  value={club}
                  onChange={(e) => setClub(e.target.value)}
                  placeholder="Flamengo"
                  className="w-full px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="block text-xs text-slate-400 mb-1">Jogador</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">Pos.</label>
                <input
                  type="text"
                  maxLength={4}
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-mono uppercase bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">OVR</label>
                <input
                  type="number"
                  min={40}
                  max={99}
                  value={overall}
                  onChange={(e) => setOverall(Number(e.target.value))}
                  className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">Idade</label>
                <input
                  type="number"
                  min={15}
                  max={50}
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">Camisa</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={shirtNumber}
                  onChange={(e) => setShirtNumber(Number(e.target.value))}
                  className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="col-span-2 md:col-span-3 flex items-end gap-2">
                <select
                  value={changeType}
                  onChange={(e) =>
                    setChangeType(e.target.value as FootballRosterEntry['changeType'])
                  }
                  className="flex-1 px-2.5 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Transferência">Transferência</option>
                  <option value="Atualização OVR">Atualização OVR</option>
                  <option value="Novo Jogador">Novo Jogador</option>
                  <option value="Aposentado">Aposentado</option>
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Salvar
                </button>
              </div>
            </form>

            {filteredRoster.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-slate-800 rounded-md">
                Nenhum jogador registrado nesta tabela de atualização.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-md">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0E1525] border-b border-slate-800 text-xs font-medium text-slate-400">
                      <th className="py-2.5 px-3">Clube</th>
                      <th className="py-2.5 px-3">Jogador</th>
                      <th className="py-2.5 px-3">Pos.</th>
                      <th className="py-2.5 px-3 text-right">OVR</th>
                      <th className="py-2.5 px-3 text-right">Idade</th>
                      <th className="py-2.5 px-3 text-right">Nº</th>
                      <th className="py-2.5 px-3">Alteração</th>
                      <th className="py-2.5 px-3 text-right">Remover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs">
                    {filteredRoster.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-medium text-slate-200 whitespace-nowrap">
                          {item.club}
                        </td>
                        <td className="py-2.5 px-3 text-white">{item.playerName}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{item.position}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-400">
                          {item.overall}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                          {item.age}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                          {item.shirtNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                          {item.changeType}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              updateMeta(
                                'rosterUpdates',
                                project.rosterUpdates.filter((r) => r.id !== item.id)
                              )
                            }
                            className="text-slate-400 hover:text-red-400 p-1"
                            title="Remover jogador"
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
        )}
      </div>
    </div>
  );
}
