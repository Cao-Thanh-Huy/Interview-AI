/**
 * asrCorrection.ts
 *
 * Corrects common ASR (Deepgram) mishearings of technical data-engineering terms
 * before the transcript enters RAG retrieval or the LLM prompt.
 *
 * Strategy:
 *   - Case-insensitive phrase matching (whole-phrase boundary aware)
 *   - Longer phrases matched first to prevent partial clobbers
 *   - Each technical term has 4–6 phonetic variants based on:
 *       • Vietnamese-accented English pronunciation
 *       • Deepgram common mis-transcriptions of proper nouns
 *       • Network/mic noise producing dropped syllables
 *
 * Usage:
 *   import { correctASRTranscript } from './asrCorrection.js'
 *   const clean = correctASRTranscript(rawTranscript)
 */

interface PhoneticEntry {
  correct: string    // Canonical technical term to substitute in
  variants: string[] // What ASR may produce instead (literal strings, case-insensitive)
}

// ─────────────────────────────────────────────────────────────────────────────
//  PHONETIC MAP — 50 technical terms, ~5 variants each
//  Ordered longest → shortest within each entry so multi-word phrases win first.
// ─────────────────────────────────────────────────────────────────────────────
const PHONETIC_MAP: PhoneticEntry[] = [
  // ── Cloud Data Platforms ──────────────────────────────────────────────────
  {
    correct: 'Snowflake',
    variants: ['snow flake', 'no flag', 'no flake', 'snow flag', 'no lake', 'snow fake'],
  },
  {
    correct: 'Databricks',
    variants: ['data bricks', 'day to bricks', 'data breaks', 'data bridge', 'data brakes', 'data brick'],
  },
  {
    correct: 'Snowpipe',
    variants: ['snow pipe', 'no pipe', 'snoh pipe', 'snow pie'],
  },
  {
    correct: 'Redshift',
    variants: ['red shift', 'red swift', 'red chip', 'rate shift'],
  },

  // ── AWS Services ──────────────────────────────────────────────────────────
  {
    correct: 'Athena',
    variants: ['a thena', 'ate henna', 'a tina', 'ethernet', 'a dinner', 'a thinner'],
  },
  {
    correct: 'AWS Glue',
    variants: ['aws glu', 'aws blue', 'aws clue', 'a ws glue', 'amazon glue'],
  },
  {
    correct: 'CloudWatch',
    variants: ['cloud watch', 'cloud clock', 'cloud watcher', 'clout watch'],
  },
  {
    correct: 'Lambda',
    variants: ['lam da', 'lam bda', 'lamba', 'lambda function'],
  },
  {
    correct: 'API Gateway',
    variants: ['api gate way', 'api gate', 'a p i gateway', 'ap gateway'],
  },
  {
    correct: 'Lake Formation',
    variants: ['lake former', 'lake form', 'lake formation', 'lake formulation'],
  },
  {
    correct: 'DynamoDB',
    variants: ['dynamo db', 'dynamo d b', 'die namo', 'di namo db', 'dynamodb'],
  },
  {
    correct: 'EMR',
    variants: ['e m r', 'elastic map reduce', 'e mr', 'em ar'],
  },
  {
    correct: 'SageMaker',
    variants: ['sage maker', 'say maker', 'stage maker', 'sage make'],
  },

  // ── Storage & File Formats ────────────────────────────────────────────────
  {
    correct: 'Parquet',
    variants: ['par keh', 'par kay', 'parker', 'par ket', 'park it', 'par ke'],
  },
  {
    correct: 'Iceberg',
    variants: ['ice berg', 'icy berg', 'ice burg', 'iced berg'],
  },
  {
    correct: 'Delta Lake',
    variants: ['delta lack', 'delta leg', 'delta late', 'del ta lake'],
  },
  {
    correct: 'Apache Hudi',
    variants: ['apache hoodie', 'apache hoody', 'apache hoodi', 'apache hoodee'],
  },
  {
    correct: 'Hudi',
    variants: ['hoodie', 'hoody', 'hoodi', 'hoodee'],
  },
  {
    correct: 'MinIO',
    variants: ['mini o', 'meanie o', 'min io', 'mini io', 'minio', 'mini oh'],
  },
  {
    correct: 'ADLS',
    variants: ['a d l s', 'a dls', 'ad ls', 'a del s'],
  },

  // ── Query Engines ─────────────────────────────────────────────────────────
  {
    correct: 'Trino',
    variants: ['tree no', 'treen o', 'try no', 'train o', 'tree noh'],
  },
  {
    correct: 'Presto',
    variants: ['press to', 'pres to', 'presto' /* already correct but normalise casing */],
  },
  {
    correct: 'Apache Flink',
    variants: ['apache fleek', 'apache fling', 'apache flank'],
  },
  {
    correct: 'Flink',
    variants: ['fleek', 'fling', 'flank', 'flin'],
  },
  {
    correct: 'Kafka',
    variants: ['cap fa', 'kappa', 'cap fah', 'kaf ka', 'caf ka'],
  },

  // ── Orchestration & Pipeline Tools ───────────────────────────────────────
  {
    correct: 'Dagster',
    variants: ['dag star', 'dagger', 'dog star', 'dag store', 'dag ster', 'dog store'],
  },
  {
    correct: 'Airflow',
    variants: ['air flow', 'air flu', 'air flo', 'air floe'],
  },
  {
    correct: 'dbt',
    variants: ['d b t', 'debit', 'db t', 'de bt', 'd-b-t'],
  },
  {
    correct: 'Fivetran',
    variants: ['five tran', 'fiber tran', 'five tren', 'five train', 'fiver tran'],
  },
  {
    correct: 'Airbyte',
    variants: ['air bite', 'air byte', 'air bright', 'air bight'],
  },

  // ── Database & Warehouse ──────────────────────────────────────────────────
  {
    correct: 'Project Nessie',
    variants: ['project nessy', 'project nestle', 'project net sea', 'project nessy'],
  },
  {
    correct: 'Nessie',
    variants: ['nessy', 'nestle', 'net sea', 'nes sea', 'ness sea'],
  },
  {
    correct: 'PostgreSQL',
    variants: ['post gres', 'post greek', 'post grace', 'postgres', 'post gresque'],
  },
  {
    correct: 'MySQL',
    variants: ['my sequel', 'my sql', 'my cycle', 'mi sequel'],
  },
  {
    correct: 'SQLite',
    variants: ['sequel lite', 'sql lite', 'sequel light', 'sequel lyt'],
  },
  {
    correct: 'SQL',
    variants: ['sequel', 'ess q l', 's q l'],
  },

  // ── Azure Services ────────────────────────────────────────────────────────
  {
    correct: 'Azure Synapse',
    variants: ['azure synapse', 'azure synapses', 'azure sign up', 'azure cynapse', 'azure sign apse'],
  },
  {
    correct: 'Synapse',
    variants: ['synapses', 'sign up', 'cynapse', 'sign apse', 'sigh naps'],
  },
  {
    correct: 'Azure',
    variants: ['as sure', 'a sure', 'a zur', 'a zure', 'as ure'],
  },

  // ── ML & AI Tooling ───────────────────────────────────────────────────────
  {
    correct: 'Cortex AI',
    variants: ['cortex a i', 'court tex', 'core tex ai', 'cortex ay'],
  },
  {
    correct: 'Cortex',
    variants: ['court tex', 'core tex', 'cortecs'],
  },
  {
    correct: 'MLflow',
    variants: ['ml flow', 'em el flow', 'm l flow', 'em el flo', 'ml flo'],
  },
  {
    correct: 'FastAPI',
    variants: ['fast api', 'fast happy', 'fast a p i', 'fast ap eye', 'fas tapi'],
  },

  // ── Infrastructure & DevOps ───────────────────────────────────────────────
  {
    correct: 'Terraform',
    variants: ['terra form', 'tear reform', 'terror form', 'terra farm', 'terra from'],
  },
  {
    correct: 'Kubernetes',
    variants: ['cube bernetties', 'cube net ease', 'cube bernetes', 'cube net is', 'cube nettles'],
  },
  {
    correct: 'Docker',
    variants: ['dock her', 'dork er', 'dok er', 'doker'],
  },
  {
    correct: 'Unity Catalog',
    variants: ['unity catalogue', 'unity catalog' /* normalise */, 'unit catalog'],
  },
  {
    correct: 'Databricks AutoLoader',
    variants: ['data bricks auto loader', 'databricks auto load', 'data bricks auto load'],
  },
  {
    correct: 'AutoLoader',
    variants: ['auto loader', 'auto load', 'auto loading'],
  },

  // ── Data Architecture Terms ───────────────────────────────────────────────
  {
    correct: 'Lakehouse',
    variants: ['lake how', 'lake house', 'lake hows', 'lay house'],
  },
  {
    correct: 'Data Vault',
    variants: ['data bolt', 'data volt', 'data vaulted', 'data vult'],
  },
  {
    correct: 'Glue Catalog',
    variants: ['glue catalog', 'glue catalogue', 'glue cat a log', 'blue catalog'],
  },
  {
    correct: 'Hive Metastore',
    variants: ['hive meta store', 'hive meta', 'hive meter store', 'high metastore'],
  },
  {
    correct: 'Power BI',
    variants: ['power b i', 'power buy', 'power be i', 'power bi'],
  },

  // ── Company / Project names in CV ─────────────────────────────────────────
  {
    correct: 'Resimac',
    variants: ['resi mac', 'reza mac', 'resi mack', 're simac', 'residmac'],
  },
  {
    correct: 'Humana',
    variants: ['hew mana', 'human a', 'you mana', 'huma na'],
  },
  {
    correct: 'Deckand',
    variants: ['deck and', 'deck hand', 'deck end', 'dek and'],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  Build compiled regex list once at module load (not per-call)
// ─────────────────────────────────────────────────────────────────────────────
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface CompiledEntry {
  pattern: RegExp
  correct: string
}

// Sort all variants longest-first so multi-word phrases are matched before substrings
const COMPILED: CompiledEntry[] = PHONETIC_MAP
  .flatMap((entry) =>
    entry.variants.map((v) => ({
      // Use word boundary at start/end of phrase — handles multi-word patterns
      pattern: new RegExp(`(?<![\\w])${escapeRegex(v)}(?![\\w])`, 'gi'),
      correct: entry.correct,
    }))
  )
  .sort((a, b) => {
    // Longer source pattern = higher priority
    const lenA = a.pattern.source.length
    const lenB = b.pattern.source.length
    return lenB - lenA
  })

// ─────────────────────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply phonetic ASR correction to a raw Deepgram transcript.
 * Replaces known mis-transcriptions of technical terms with the canonical form.
 *
 * @param transcript - Raw text from Deepgram
 * @returns Corrected transcript (same string if no corrections needed)
 */
export function correctASRTranscript(transcript: string): string {
  if (!transcript?.trim()) return transcript

  let result = transcript
  for (const { pattern, correct } of COMPILED) {
    result = result.replace(pattern, correct)
  }
  return result
}

/**
 * Returns a human-readable diff of what was corrected — useful for debugging.
 */
export function getASRCorrections(transcript: string): Array<{ from: string; to: string }> {
  const corrections: Array<{ from: string; to: string }> = []
  for (const entry of PHONETIC_MAP) {
    for (const variant of entry.variants) {
      const pattern = new RegExp(`(?<![\\w])${escapeRegex(variant)}(?![\\w])`, 'gi')
      let match: RegExpExecArray | null
      while ((match = pattern.exec(transcript)) !== null) {
        corrections.push({ from: match[0], to: entry.correct })
      }
    }
  }
  return corrections
}
