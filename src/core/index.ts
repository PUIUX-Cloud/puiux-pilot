/**
 * PUIUX Pilot — Core Engine
 * Re-exports all core modules for programmatic use
 */

export { scanProject, quickScan, findProjectRoot } from "./scanner/index.js";
export { selectHooks, autoSelectProfile, summarizeSelection } from "./configurator/hook-selector.js";
export { selectMCPs } from "./configurator/mcp-selector.js";
export { selectSkills } from "./configurator/skill-selector.js";
export {
  installConfiguration,
  writeProjectSettings,
  uninstallConfiguration,
} from "./configurator/settings-writer.js";
export { calculateScore, formatScoreReport } from "./scorer/calculator.js";
export type { ProjectDNA, HookMetadata, PilotManifest } from "../shared/types.js";
