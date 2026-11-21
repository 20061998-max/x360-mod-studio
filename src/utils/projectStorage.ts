import { ModProject } from '../types/modding';
import { DEFAULT_DASHLAUNCH_CONFIG } from './dashLaunch';

const STORAGE_KEY = 'x360_mod_studio_projects_v1';

export function createStarterProjects(): ModProject[] {
  return [
    {
      id: 'proj-futebol-2026',
      name: 'Patch Futebol Clássico 2026',
      gameTitle: 'Futebol Clássico Xbox 360',
      titleId: '4B4E084F',
      mediaId: '00000001',
      patchVersion: 'v1.0.0',
      author: 'Comunidade Mod',
      genre: 'Futebol',
      installTarget: 'Hdd1:\\Games\\Futebol_2026\\',
      description:
        'Atualização de elencos, overall dos jogadores, nome da liga e ajuste de ritmo de partida em Big-Endian.',
      updatedAt: new Date().toISOString(),
      hexRules: [
        {
          id: 'rule-season',
          name: 'Atualizar Ano da Temporada (2026)',
          offsetHex: '0x00000008',
          type: 'uint32be',
          value: '2026',
          enabled: true,
          notes: 'Campo UInt32 Big-Endian no cabeçalho do banco de exemplo.',
        },
        {
          id: 'rule-speed',
          name: 'Ajuste de Velocidade do Jogo (1.15x)',
          offsetHex: '0x0000000C',
          type: 'float32be',
          value: '1.15',
          enabled: true,
          notes: 'Float32 PowerPC Big-Endian para cadência da partida.',
        },
        {
          id: 'rule-league',
          name: 'Nome do Campeonato (BRASILEIRAO_2026)',
          offsetHex: '0x00000020',
          type: 'ascii',
          value: 'BRASILEIRAO_2026',
          enabled: true,
          notes: 'Substitui LIGA_NACIONAL_13 mantendo o limite de caracteres.',
        },
        {
          id: 'rule-ovr',
          name: 'Overall Jogador 1 (85)',
          offsetHex: '0x00000064',
          type: 'uint16be',
          value: '85',
          enabled: true,
          notes: 'Atributo UInt16 Big-Endian.',
        },
      ],
      modAssets: [
        {
          id: 'asset-1',
          category: 'Elenco / Database',
          targetPath: 'data\\db\\roster_update.bin',
          action: 'Aplicar Patch IPS/Hex',
          status: 'Pronto',
          notes: 'Database com transferências e overalls revisados.',
        },
        {
          id: 'asset-2',
          category: 'Uniformes / Texturas',
          targetPath: 'data\\kits\\kits_2026.cpk',
          action: 'Substituir',
          status: 'Em Testes',
          notes: 'Kits em DXT5 convertidos para o formato do jogo.',
        },
        {
          id: 'asset-3',
          category: 'Tradução / Textos',
          targetPath: 'data\\lang\\pt_br_strings.bin',
          action: 'Aplicar Patch IPS/Hex',
          status: 'Pronto',
          notes: 'Menus e placas de competição atualizados.',
        },
      ],
      rosterUpdates: [
        {
          id: 'r-1',
          club: 'Palmeiras',
          playerName: 'Estêvão Willian',
          position: 'PD',
          overall: 85,
          age: 19,
          nationality: 'Brasil',
          shirtNumber: 41,
          changeType: 'Atualização OVR',
        },
        {
          id: 'r-2',
          club: 'Real Madrid',
          playerName: 'Endrick Felipe',
          position: 'CA',
          overall: 84,
          age: 20,
          nationality: 'Brasil',
          shirtNumber: 16,
          changeType: 'Transferência',
        },
        {
          id: 'r-3',
          club: 'Flamengo',
          playerName: 'Pedro Guilherme',
          position: 'CA',
          overall: 84,
          age: 29,
          nationality: 'Brasil',
          shirtNumber: 9,
          changeType: 'Atualização OVR',
        },
      ],
      vehicleMods: [],
      weaponMods: [],
      dashLaunch: DEFAULT_DASHLAUNCH_CONFIG,
    },
    {
      id: 'proj-carros-armas',
      name: 'Pack Veículos & Armas Custom',
      gameTitle: 'Corrida / Shooter Xbox 360',
      titleId: '415608C3',
      mediaId: '00000001',
      patchVersion: 'v1.0.0',
      author: 'Comunidade Mod',
      genre: 'Tiro / FPS',
      installTarget: 'Hdd1:\\Games\\Mod_Pack_X360\\',
      description:
        'Configurações de substituição e balanceamento para carros customizados (handling) e armas personalizadas (GSC/INI).',
      updatedAt: new Date().toISOString(),
      hexRules: [],
      modAssets: [
        {
          id: 'asset-ca-1',
          category: 'Veículos / Handling',
          targetPath: 'common\\data\\handling_custom.cfg',
          action: 'Substituir',
          status: 'Pronto',
          notes: 'Parâmetros de física para carros adicionados nos slots base.',
        },
        {
          id: 'asset-ca-2',
          category: 'Armas / Balística',
          targetPath: 'maps\\mp\\gametypes\\_weapons_mod.gsc',
          action: 'Adicionar Novo',
          status: 'Em Testes',
          notes: 'Script de customização de dano, cadência e munição.',
        },
      ],
      rosterUpdates: [],
      vehicleMods: [
        {
          id: 'veh-1',
          vehicleName: 'Porsche 911 GT3 RS (Mod)',
          replacesSlot: 'COMET_SLOT_01',
          topSpeedKmh: 318,
          horsepower: 525,
          massKg: 1450,
          drivetrain: 'RWD',
          grip: 1.18,
          assetPath: 'vehicles\\custom\\porsche_gt3.bin',
          status: 'Pronto',
        },
        {
          id: 'veh-2',
          vehicleName: 'Nissan Skyline R34 (Mod)',
          replacesSlot: 'ELEGY_SLOT_04',
          topSpeedKmh: 295,
          horsepower: 480,
          massKg: 1540,
          drivetrain: 'AWD',
          grip: 1.24,
          assetPath: 'vehicles\\custom\\skyline_r34.bin',
          status: 'Em Testes',
        },
      ],
      weaponMods: [
        {
          id: 'wpn-1',
          weaponName: 'M4A1 Tática Custom',
          baseWeaponId: 'm4_mp',
          category: 'Rifle',
          damage: 42,
          fireRateRpm: 780,
          magazineSize: 40,
          recoil: 0.35,
          assetPath: 'weapons\\mp\\m4a1_custom',
          status: 'Pronto',
        },
        {
          id: 'wpn-2',
          weaponName: 'Barrett M82 Pesada',
          baseWeaponId: 'barrett_mp',
          category: 'Sniper',
          damage: 98,
          fireRateRpm: 120,
          magazineSize: 10,
          recoil: 0.85,
          assetPath: 'weapons\\mp\\barrett_heavy',
          status: 'Em Testes',
        },
      ],
      dashLaunch: DEFAULT_DASHLAUNCH_CONFIG,
    },
  ];
}

export function loadModProjects(): ModProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createStarterProjects();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (parsed as Partial<ModProject>[]).map((p) => ({
        ...createStarterProjects()[0],
        ...p,
        hexRules: Array.isArray(p.hexRules) ? p.hexRules : [],
        modAssets: Array.isArray(p.modAssets) ? p.modAssets : [],
        rosterUpdates: Array.isArray(p.rosterUpdates) ? p.rosterUpdates : [],
        vehicleMods: Array.isArray(p.vehicleMods) ? p.vehicleMods : [],
        weaponMods: Array.isArray(p.weaponMods) ? p.weaponMods : [],
      })) as ModProject[];
    }
  } catch {
    // Fallback to starter projects if storage is inaccessible or corrupted
  }
  return createStarterProjects();
}

export function saveModProjects(projects: ModProject[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // Ignore storage quota errors silently
  }
}

export function exportProjectModIni(project: ModProject): string {
  const lines = [
    `; Manifesto de Configuracao de Mod - X360 Mod Studio`,
    `[ModInfo]`,
    `Nome = ${project.name}`,
    `Jogo = ${project.gameTitle}`,
    `TitleID = ${project.titleId}`,
    `MediaID = ${project.mediaId}`,
    `Versao = ${project.patchVersion}`,
    `Autor = ${project.author}`,
    `Genero = ${project.genre}`,
    `PastaDestino = ${project.installTarget}`,
    ``,
    `[ArquivosModificados]`,
    ...project.modAssets.map(
      (a, idx) =>
        `Arquivo${idx + 1} = ${a.targetPath} | ${a.category} | ${a.action} | ${a.status}`
    ),
    ``,
    `[RegrasHexBigEndian]`,
    ...project.hexRules
      .filter((r) => r.enabled)
      .map((r, idx) => `Patch${idx + 1} = ${r.offsetHex} | ${r.type} | ${r.value} ; ${r.name}`),
    ``,
  ];
  return lines.join('\n');
}

export function exportRosterCsv(project: ModProject): string {
  const header = 'Clube,Jogador,Posicao,Overall,Idade,Nacionalidade,Camisa,TipoAlteracao';
  const rows = project.rosterUpdates.map((r) =>
    [
      `"${r.club.replace(/"/g, '""')}"`,
      `"${r.playerName.replace(/"/g, '""')}"`,
      r.position,
      r.overall,
      r.age,
      `"${r.nationality.replace(/"/g, '""')}"`,
      r.shirtNumber,
      `"${r.changeType}"`,
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

export function exportVehiclesHandlingCfg(project: ModProject): string {
  const lines = [
    `; Configuracao de Veiculos & Handling - ${project.name}`,
    `; Formato de referencia para substituicao de slots e ajuste de fisica`,
    `; Colunas: SLOT_BASE | NOME_CARRO | VEL_MAX_KMH | POTENCIA_CV | MASSA_KG | TRACAO | ADERENCIA | ARQUIVO`,
    ``,
  ];
  for (const v of project.vehicleMods) {
    lines.push(`[${v.replacesSlot}]`);
    lines.push(`Nome = ${v.vehicleName}`);
    lines.push(`VelocidadeMaxKmh = ${v.topSpeedKmh}`);
    lines.push(`PotenciaCV = ${v.horsepower}`);
    lines.push(`MassaKg = ${v.massKg}`);
    lines.push(`Tracao = ${v.drivetrain}`);
    lines.push(`Aderencia = ${v.grip.toFixed(2)}`);
    lines.push(`ArquivoAsset = ${v.assetPath}`);
    lines.push(`Status = ${v.status}`);
    lines.push(``);
  }
  return lines.join('\n');
}

export function exportWeaponsGscScript(project: ModProject): string {
  const header = [
    `// Script de Modificacao de Armas (Estilo GSC / CoD) - ${project.name}`,
    `// Gerado pelo X360 Mod Studio`,
    ``,
    `init_custom_weapons()`,
    `{`,
    `    level thread onPlayerConnectCustomWeapons();`,
    `}`,
    ``,
    `onPlayerConnectCustomWeapons()`,
    `{`,
    `    for(;;)`,
    `    {`,
    `        level waittill("connected", player);`,
    `        player thread applyCustomWeaponLoadout();`,
    `    }`,
    `}`,
    ``,
    `applyCustomWeaponLoadout()`,
    `{`,
    `    self endon("disconnect");`,
    `    for(;;)`,
    `    {`,
    `        self waittill("spawned_player");`,
    `        wait 0.1;`,
  ];

  const weaponLines = project.weaponMods.map((w, idx) => {
    const safeComment = `${w.weaponName} (${w.category}) | Dano:${w.damage} RPM:${w.fireRateRpm} Mag:${w.magazineSize} Recuo:${w.recoil}`;
    return [
      `        // ${idx + 1}. ${safeComment}`,
      `        // Asset esperado: ${w.assetPath}`,
      `        self giveWeapon("${w.baseWeaponId}");`,
      `        self setWeaponAmmoClip("${w.baseWeaponId}", ${w.magazineSize});`,
    ].join('\n');
  });

  const footer = [
    `    }`,
    `}`,
    ``,
    `/* Tabela de Parametros de Balistica (.ini)`,
    ...project.weaponMods.map(
      (w) =>
        `${w.baseWeaponId} => Nome="${w.weaponName}" Dano=${w.damage} RPM=${w.fireRateRpm} Carregador=${w.magazineSize} Recuo=${w.recoil}`
    ),
    `*/`,
    ``,
  ];

  return [...header, ...weaponLines, ...footer].join('\n');
}

export function exportInstallGuideTxt(project: ModProject): string {
  const assetList =
    project.modAssets.length > 0
      ? project.modAssets
          .map(
            (a, i) =>
              `  ${i + 1}. [${a.category}] ${a.targetPath}\n     Acao: ${a.action} (${a.status})\n     Obs: ${a.notes || '-'}`
          )
          .join('\n')
      : '  Nenhum arquivo listado ainda.';

  return [
    `============================================================`,
    `GUIA DE INSTALACAO - ${project.name}`,
    `============================================================`,
    `Jogo Base: ${project.gameTitle}`,
    `Title ID:  ${project.titleId} (Media ID: ${project.mediaId})`,
    `Versao:    ${project.patchVersion}`,
    `Autor:     ${project.author}`,
    ``,
    `Descricao:`,
    `${project.description || 'Sem descricao.'}`,
    ``,
    `------------------------------------------------------------`,
    `1. ONDE COPIAR NO XBOX 360 (RGH / JTAG / EXPLOIT)`,
    `------------------------------------------------------------`,
    `Pasta do jogo: ${project.installTarget}`,
    `Title Updates / DLCs (se aplicavel):`,
    `  Hdd1:\\Content\\0000000000000000\\${project.titleId}\\000B0000\\`,
    ``,
    `------------------------------------------------------------`,
    `2. ARQUIVOS DO MOD`,
    `------------------------------------------------------------`,
    assetList,
    ``,
    `------------------------------------------------------------`,
    `3. RECOMENDACOES`,
    `------------------------------------------------------------`,
    `- Sempre faca backup dos arquivos originais antes de substituir.`,
    `- Se usar Aurora, limpe/re-escaneie o banco de capas se alterar o Title Update.`,
    `- Arquivos .xex modificados exigem console com exploit/RGH/JTAG.`,
    ``,
  ].join('\n');
}
