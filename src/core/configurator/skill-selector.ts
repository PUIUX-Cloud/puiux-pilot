/**
 * Skill Selector
 * Selects relevant skills based on project DNA
 */

import type { ProjectDNA } from "../../shared/types.js";

interface SkillSelection {
  universal: string[];
  projectSpecific: string[];
}

/** Select skills based on project DNA */
export function selectSkills(dna: ProjectDNA): SkillSelection {
  const universal: string[] = [
    "clean-code",
    "e2e-delivery",
    "code-quality",
  ];

  const projectSpecific: string[] = [];

  // Add based on project characteristics
  if (dna.structure.hasUI) {
    universal.push("design-standards");
    if (dna.dependencies.cssFramework === "tailwind") {
      projectSpecific.push("tailwind");
    }
  }

  if (dna.structure.hasAPI) {
    universal.push("full-stack");
    universal.push("spec-first");
  }

  if (dna.structure.hasDocker) {
    universal.push("build-deploy");
  }

  // Language-specific
  switch (dna.identity.runtime) {
    case "rust":
      projectSpecific.push("rust");
      break;
    case "python":
      projectSpecific.push("python");
      break;
    case "go":
      projectSpecific.push("go");
      break;
  }

  // Framework-specific
  if (dna.identity.type === "nextjs") {
    projectSpecific.push("nextjs");
  } else if (dna.identity.type === "react" || dna.dependencies.uiFramework === "react") {
    projectSpecific.push("react");
  }

  return { universal: [...new Set(universal)], projectSpecific };
}
