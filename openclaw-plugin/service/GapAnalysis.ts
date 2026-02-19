/**
 * Gap analysis — re-exports from shared module.
 *
 * The canonical implementation lives in src/rules/gapAnalysis.ts so it can
 * be used both client-side (dashboard) and server-side (plugin).
 */

export { analyzeGaps } from '../../src/rules/gapAnalysis.ts'
export type { GapAnalysisResult, GapItem, GapPriority, GapCategory } from '../../src/rules/gapAnalysis.ts'
