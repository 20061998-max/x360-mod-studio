export type WorkspaceTab =
  | 'modpack'
  | 'organizer'
  | 'editgame'
  | 'binary'
  | 'hex'
  | 'textures'
  | 'skins'
  | 'dashlaunch'
  | 'tester'
  | 'showcase'
  | 'manual'
  | 'plans'
  | 'admin';

export type HexValueType =
  | 'hex'
  | 'ascii'
  | 'utf16be'
  | 'int16be'
  | 'uint16be'
  | 'int32be'
  | 'uint32be'
  | 'float32be'
  | 'int32le'
  | 'float32le';

export interface HexPatchRule {
  id: string;
  name: string;
  offsetHex: string; // e.g. "0x00000120"
  type: HexValueType;
  value: string;
  enabled: boolean;
  notes?: string;
}

export interface BinaryDiffChunk {
  offset: number;
  length: number;
  originalHex: string;
  modifiedHex: string;
  asciiPreview: string;
  isRle: boolean;
}

export interface X360JsonPatchRecord {
  offset: number;
  originalHex: string;
  modifiedHex: string;
}

export interface X360JsonPatchFile {
  format: 'x360-patch-v1';
  createdAt: string;
  metadata: {
    projectName: string;
    gameTitle: string;
    titleId: string;
    version: string;
    author: string;
    originalFileName: string;
    originalSize: number;
    modifiedSize: number;
    notes: string;
  };
  records: X360JsonPatchRecord[];
}

export type ModAssetCategory =
  | 'Elenco / Database'
  | 'Uniformes / Texturas'
  | 'Veículos / Handling'
  | 'Armas / Balística'
  | 'Estádios / Cenários'
  | 'Áudio / Narração'
  | 'Tradução / Textos'
  | 'Física / Jogabilidade'
  | 'Executável / Config';

export interface ModAssetEntry {
  id: string;
  category: ModAssetCategory;
  targetPath: string;
  action: 'Substituir' | 'Aplicar Patch IPS/Hex' | 'Adicionar Novo';
  status: 'Pronto' | 'Em Testes' | 'Pendente';
  notes: string;
}

export interface FootballRosterEntry {
  id: string;
  club: string;
  playerName: string;
  position: string;
  overall: number;
  age: number;
  nationality: string;
  shirtNumber: number;
  changeType: 'Transferência' | 'Atualização OVR' | 'Novo Jogador' | 'Aposentado';
}

export interface RacingVehicleEntry {
  id: string;
  vehicleName: string;
  replacesSlot: string;
  topSpeedKmh: number;
  horsepower: number;
  massKg: number;
  drivetrain: 'RWD' | 'FWD' | 'AWD';
  grip: number;
  assetPath: string;
  status: 'Pronto' | 'Em Testes' | 'Pendente';
}

export interface WeaponModEntry {
  id: string;
  weaponName: string;
  baseWeaponId: string;
  category: 'Rifle' | 'Submetralhadora' | 'Sniper' | 'Escopeta' | 'Pistola' | 'Especial';
  damage: number;
  fireRateRpm: number;
  magazineSize: number;
  recoil: number;
  assetPath: string;
  status: 'Pronto' | 'Em Testes' | 'Pendente';
}

export interface DashLaunchConfig {
  paths: {
    defaultPath: string;
    butA: string;
    butB: string;
    butX: string;
    butY: string;
    start: string;
    back: string;
  };
  plugins: {
    plugin1: string;
    plugin2: string;
    plugin3: string;
    plugin4: string;
    plugin5: string;
  };
  settings: {
    nxemini: boolean;
    pingpatch: boolean;
    contpatch: boolean;
    xblapatch: boolean;
    licpatch: boolean;
    liveblock: boolean;
    livestrong: boolean;
    noupdater: boolean;
    signnotice: boolean;
    fatalfreeze: boolean;
    fatalreboot: boolean;
    tempbcast: boolean;
    hddalive: boolean;
    hddtimer: number;
  };
}

export interface ModProject {
  id: string;
  name: string;
  gameTitle: string;
  titleId: string;
  mediaId: string;
  patchVersion: string;
  author: string;
  genre: 'Futebol' | 'Corrida' | 'Tiro / FPS' | 'Ação / Mundo Aberto' | 'Luta' | 'Outro';
  installTarget: string;
  description: string;
  updatedAt: string;
  hexRules: HexPatchRule[];
  modAssets: ModAssetEntry[];
  rosterUpdates: FootballRosterEntry[];
  vehicleMods: RacingVehicleEntry[];
  weaponMods: WeaponModEntry[];
  dashLaunch: DashLaunchConfig;
}
