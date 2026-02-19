/**
 * Auto-detect which broker a CSV file came from and parse it.
 *
 * Currently supports Robinhood only.
 * Fidelity and Vanguard parsers can be added to ALL_PARSERS later.
 */

import { RobinhoodParser } from './robinhood'
import type { BrokerParser, ParseResult } from './types'

const ALL_PARSERS: BrokerParser[] = [
  new RobinhoodParser(),
]

export interface DetectionResult {
  parser: BrokerParser
  confidence: 'high' | 'medium' | 'low'
  result: ParseResult
}

export function autoDetectBroker(csv: string): DetectionResult {
  // Strategy 1: Header inspection
  const firstLines = csv.split('\n').slice(0, 5).join('\n').toLowerCase()

  if (firstLines.includes('robinhood')) {
    return tryParser(new RobinhoodParser(), csv, 'high')
  }

  // Strategy 2: Trial parsing — try all parsers, pick the one with
  // the most successful rows and fewest errors
  const results = ALL_PARSERS.map(parser => tryParser(parser, csv, 'medium'))
  const best = results
    .filter(r => r.result.errors.length === 0 && r.result.rowCounts.parsed > 0)
    .sort((a, b) => b.result.rowCounts.parsed - a.result.rowCounts.parsed)

  if (best.length > 0) {
    return best[0]
  }

  // Fallback: try Robinhood (most generic column patterns)
  return tryParser(new RobinhoodParser(), csv, 'low')
}

function tryParser(
  parser: BrokerParser,
  csv: string,
  confidence: 'high' | 'medium' | 'low',
): DetectionResult {
  try {
    const result = parser.parse(csv)
    return { parser, confidence, result }
  } catch (e) {
    return {
      parser,
      confidence: 'low',
      result: {
        transactions: [],
        warnings: [],
        errors: [e instanceof Error ? `Parse failed: ${e.message}` : 'Parse failed: unknown error'],
        rowCounts: { total: 0, parsed: 0, skipped: 0 },
      },
    }
  }
}
