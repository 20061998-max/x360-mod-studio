import { DashLaunchConfig } from '../types/modding';

export const DEFAULT_DASHLAUNCH_CONFIG: DashLaunchConfig = {
  paths: {
    defaultPath: 'Hdd:\\Aurora\\Aurora.xex',
    butA: '',
    butB: '',
    butX: 'Hdd:\\XeXMenu\\default.xex',
    butY: '',
    start: '',
    back: '',
  },
  plugins: {
    plugin1: '',
    plugin2: '',
    plugin3: '',
    plugin4: '',
    plugin5: '',
  },
  settings: {
    nxemini: true,
    pingpatch: true,
    contpatch: true,
    xblapatch: true,
    licpatch: true,
    liveblock: true,
    livestrong: true,
    noupdater: true,
    signnotice: false,
    fatalfreeze: false,
    fatalreboot: true,
    tempbcast: false,
    hddalive: false,
    hddtimer: 210,
  },
};

export function generateLaunchIni(config: DashLaunchConfig): string {
  const lines: string[] = [
    '; Configuracao gerada pelo X360 Mod Studio',
    '; Copie este arquivo launch.ini para a raiz do seu Hdd: ou Usb:',
    '',
    '[Paths]',
    `Default = ${config.paths.defaultPath}`,
    `BUT_A = ${config.paths.butA}`,
    `BUT_B = ${config.paths.butB}`,
    `BUT_X = ${config.paths.butX}`,
    `BUT_Y = ${config.paths.butY}`,
    `Start = ${config.paths.start}`,
    `Back = ${config.paths.back}`,
    '',
    '[Plugins]',
    `plugin1 = ${config.plugins.plugin1}`,
    `plugin2 = ${config.plugins.plugin2}`,
    `plugin3 = ${config.plugins.plugin3}`,
    `plugin4 = ${config.plugins.plugin4}`,
    `plugin5 = ${config.plugins.plugin5}`,
    '',
    '[Settings]',
    `nxemini = ${config.settings.nxemini}`,
    `pingpatch = ${config.settings.pingpatch}`,
    `contpatch = ${config.settings.contpatch}`,
    `xblapatch = ${config.settings.xblapatch}`,
    `licpatch = ${config.settings.licpatch}`,
    `liveblock = ${config.settings.liveblock}`,
    `livestrong = ${config.settings.livestrong}`,
    `noupdater = ${config.settings.noupdater}`,
    `signnotice = ${config.settings.signnotice}`,
    `fatalfreeze = ${config.settings.fatalfreeze}`,
    `fatalreboot = ${config.settings.fatalreboot}`,
    `tempbcast = ${config.settings.tempbcast}`,
    `hddalive = ${config.settings.hddalive}`,
    `hddtimer = ${config.settings.hddtimer}`,
    '',
  ];

  return lines.join('\n');
}

export function parseLaunchIni(content: string): DashLaunchConfig {
  const result: DashLaunchConfig = {
    paths: { ...DEFAULT_DASHLAUNCH_CONFIG.paths },
    plugins: { ...DEFAULT_DASHLAUNCH_CONFIG.plugins },
    settings: { ...DEFAULT_DASHLAUNCH_CONFIG.settings },
  };

  let currentSection = '';
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1).trim().toLowerCase();
      continue;
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim().toLowerCase();
    const val = line.slice(eqIdx + 1).trim();
    const boolVal = val.toLowerCase() === 'true' || val === '1';

    if (currentSection === 'paths') {
      if (key === 'default') result.paths.defaultPath = val;
      if (key === 'but_a') result.paths.butA = val;
      if (key === 'but_b') result.paths.butB = val;
      if (key === 'but_x') result.paths.butX = val;
      if (key === 'but_y') result.paths.butY = val;
      if (key === 'start') result.paths.start = val;
      if (key === 'back') result.paths.back = val;
    } else if (currentSection === 'plugins') {
      if (key === 'plugin1') result.plugins.plugin1 = val;
      if (key === 'plugin2') result.plugins.plugin2 = val;
      if (key === 'plugin3') result.plugins.plugin3 = val;
      if (key === 'plugin4') result.plugins.plugin4 = val;
      if (key === 'plugin5') result.plugins.plugin5 = val;
    } else if (currentSection === 'settings') {
      if (key === 'nxemini') result.settings.nxemini = boolVal;
      if (key === 'pingpatch') result.settings.pingpatch = boolVal;
      if (key === 'contpatch') result.settings.contpatch = boolVal;
      if (key === 'xblapatch') result.settings.xblapatch = boolVal;
      if (key === 'licpatch') result.settings.licpatch = boolVal;
      if (key === 'liveblock') result.settings.liveblock = boolVal;
      if (key === 'livestrong') result.settings.livestrong = boolVal;
      if (key === 'noupdater') result.settings.noupdater = boolVal;
      if (key === 'signnotice') result.settings.signnotice = boolVal;
      if (key === 'fatalfreeze') result.settings.fatalfreeze = boolVal;
      if (key === 'fatalreboot') result.settings.fatalreboot = boolVal;
      if (key === 'tempbcast') result.settings.tempbcast = boolVal;
      if (key === 'hddalive') result.settings.hddalive = boolVal;
      if (key === 'hddtimer') {
        const num = Number.parseInt(val, 10);
        if (Number.isFinite(num)) result.settings.hddtimer = num;
      }
    }
  }

  return result;
}
