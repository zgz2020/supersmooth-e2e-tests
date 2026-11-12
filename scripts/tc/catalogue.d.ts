/** Types for catalogue.js (plain ES module shared by Node scripts and utils/testCase.ts). */
export interface CatalogueCase {
  id: string;
  title: string;
  file: string;
  line: number;
  fields: Record<string, string>;
  hasSteps: boolean;
  priority?: string;
  automation?: string;
}

export interface Catalogue {
  cases: CatalogueCase[];
  errors: string[];
}

export const REPO_ROOT: string;
export const CATALOGUE_DIR: string;
export const TC_ANNOTATION_TYPE: string;
export const ID_PATTERN: RegExp;
export const PRIORITIES: string[];
export const AUTOMATION_STATUSES: string[];
export function parseCatalogueFile(content: string, file: string): Catalogue;
export function loadCatalogue(dir?: string): Catalogue;
export function priorityTag(priority: string | undefined): string | undefined;
