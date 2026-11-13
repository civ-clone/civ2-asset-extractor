import { FileDefinition } from './extractSprites';
export declare const toSlug: (name: string) => string;
export declare const readSection: (rules: string, section: string) => string[];
export declare const withUnitNames: (
  definition: FileDefinition,
  rules: string
) => FileDefinition;
export type AdvanceReference = string;
export type Comment = string | null;
export declare const parseInteger: (token: string) => number;
export declare const parseBits: (token: string) => number;
export interface CosmicRecord {
  roadMoveMultiplier: number;
  triremeLossChance: number;
  foodPerCitizen: number;
  foodBoxRows: number;
  shieldBoxRows: number;
  settlerFoodLow: number;
  settlerFoodHigh: number;
  unhappySize: number;
  riotFactor: number;
  aqueductSize: number;
  sewerSize: number;
  techParadigm: number;
  transformTime: number;
  monarchyFreeSupport: number;
  communismFreeSupport: number;
  fundamentalismFreeSupport: number;
  communismPalaceDistance: number;
  fundamentalismScienceLoss: number;
  changePenalty: number;
  paradropRange: number;
  massThrustParadigm: number;
  fundamentalismMaxScience: number;
}
export declare const cosmicLimits: {
  [K in keyof CosmicRecord]: [min: number, max: number];
};
export interface Cosmic {
  raw: CosmicRecord;
  effective: CosmicRecord;
}
export declare const readCosmic: (rules: string) => Cosmic;
export interface AdvanceRecord {
  name: string;
  aiValue: number;
  civilizedModifier: number;
  prerequisites: [AdvanceReference, AdvanceReference];
  epoch: number;
  category: number;
  comment: Comment;
}
export declare const readCivilize: (rules: string) => AdvanceRecord[];
export declare const isAdvanceAvailable: ({
  prerequisites,
}: AdvanceRecord) => boolean;
export declare const improvementCount = 39;
export declare const wonderCount = 28;
export interface ImprovementRecord {
  name: string;
  cost: number;
  upkeep: number;
  prerequisite: AdvanceReference;
}
export declare const readImprovements: (rules: string) => ImprovementRecord[];
export interface EndWonderRecord {
  expiresWith: AdvanceReference;
  comment: Comment;
}
export declare const readEndWonder: (rules: string) => EndWonderRecord[];
export interface UnitRecord {
  name: string;
  obsoleteBy: AdvanceReference;
  domain: number;
  move: number;
  range: number;
  attack: number;
  defence: number;
  hitPoints: number;
  firepower: number;
  cost: number;
  hold: number;
  role: number;
  prerequisite: AdvanceReference;
  flags: number;
}
export declare enum UnitRole {
  Attack = 0,
  Defend = 1,
  NavalSuperiority = 2,
  AirSuperiority = 3,
  SeaTransport = 4,
  Settle = 5,
  Diplomacy = 6,
  Trade = 7,
}
export declare enum UnitFlag {
  SeesTwoSpaces = 1,
  IgnoresZonesOfControl = 2,
  Amphibious = 4,
  Submarine = 8,
  AttacksAir = 16,
  CoastBound = 32,
  IgnoresCityWalls = 64,
  CarriesAir = 128,
  Paradrops = 256,
  TreatsAllAsRoad = 512,
  DefenceBonusVsMounted = 1024,
  FundamentalismFreeSupport = 2048,
  DestroyedAfterAttacking = 4096,
  DefenceBonusVsAir = 8192,
  DetectsSubmarines = 16384,
}
export declare const readUnits: (rules: string) => UnitRecord[];
export declare const isUnitAvailable: ({ prerequisite }: UnitRecord) => boolean;
export declare const terrainCount = 11;
export interface TerrainChange {
  result: string;
  bonus: number;
  turns: number;
  aiGovernment: number;
}
export interface TerrainRecord {
  name: string;
  terrain: number;
  special: 0 | 1 | 2;
  moveCost: number;
  defence: number;
  food: number;
  shields: number;
  trade: number;
  irrigation: TerrainChange | null;
  mining: TerrainChange | null;
  transform: string | null;
  comment: Comment;
}
export declare const readTerrain: (rules: string) => TerrainRecord[];
export interface GovernmentRecord {
  name: string;
  maleTitle: string;
  femaleTitle: string;
}
export declare const readGovernments: (rules: string) => GovernmentRecord[];
export interface LeaderTitle {
  government: number;
  male: string;
  female: string;
}
export interface LeaderRecord {
  maleName: string;
  femaleName: string;
  female: number;
  colour: number;
  cityStyle: number;
  plural: string;
  adjective: string;
  attack: number;
  expand: number;
  civilize: number;
  titles: LeaderTitle[];
}
export declare const readLeaders: (rules: string) => LeaderRecord[];
export interface DifficultyRecord {
  name: string;
}
export declare const readDifficulty: (rules: string) => DifficultyRecord[];
