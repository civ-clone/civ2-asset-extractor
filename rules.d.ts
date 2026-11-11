import { FileDefinition } from './extractSprites';
export declare const toSlug: (name: string) => string;
export declare const readSection: (rules: string, section: string) => string[];
export declare const withUnitNames: (
  definition: FileDefinition,
  rules: string
) => FileDefinition;
