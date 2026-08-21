/**
 * @typedef {Object} ProjectFile
 * @property {string} path - Relative path within the project (e.g., 'src/index.ts')
 * @property {string} content - File contents as a UTF-8 string
 * @property {number} [priority] - Architectural importance score (0 = entry point, 6 = test)
 */

/**
 * @typedef {Object} ProjectMetadata
 * @property {string|undefined} packageName - The "name" field from package.json (or equivalent)
 * @property {string|undefined} description - The "description" field from package.json
 * @property {string[]} scripts - Script names from package.json (empty if no package.json)
 * @property {number} fileCount - Number of source files collected during scanning
 */

/**
 * @typedef {Object} ProjectContext
 * @property {string} directory - Absolute path to the inspected directory
 * @property {string} name - Detected project name (from package.json name, README heading, or directory basename)
 * @property {string|null} summary - Structured project analysis (type, language, framework, entry points, dependencies) or null for bare directories
 * @property {ProjectMetadata} metadata - High-level project metadata extracted from package.json
 * @property {string} sample - Bounded source sample: files sorted by priority, concatenated with path headers, capped at 12,000 characters by default or 36,000 in crawl mode
 * @property {boolean} crawl - Whether the context was built with a directory-wide crawl
 * @property {string} tree - Newline-delimited layout of source/configuration files discovered by a crawl
 * @property {ProjectFile[]} files - All collected source files with their content and priority scores
 * @property {Object} dependencies - Categorized dependency lists extracted from package.json
 * @property {string[]} dependencies.runtime - Runtime dependency names
 * @property {string[]} dependencies.dev - Dev dependency names
 * @property {string[]} dependencies.firebase - Firebase-related runtime dependencies
 * @property {string[]} dependencies.aws - AWS-related runtime dependencies
 * @property {string[]} dependencies.ai - AI/ML-related runtime dependencies
 * @property {string[]} entryPoints - Paths to detected entry point files (e.g., ['index.js', 'main.ts'])
 * @property {string|null} detectedLanguage - Primary language by file count (e.g., 'TypeScript', 'Python') or null
 * @property {string|null} detectedFramework - Detected framework from dependencies (e.g., 'Next.js', 'React') or null
 * @property {string|null} detectedProjectType - Detected project type (e.g., 'fullstack app', 'CLI tool', 'library / package') or null
 */

/**
 * @typedef {Object} Suggestion
 * @property {string} title - Feature idea title (exactly 3-4 words)
 * @property {string} prompt - Complete, actionable coding prompt (at least 80 characters)
 */

/**
 * @typedef {'balanced' | 'growth' | 'ux' | 'technical' | 'wild'} SuggestionMode
 */

/**
 * @typedef {Object} AskResponseFit
 * @property {true} fit - The feature is a good fit for this project
 * @property {string} reasoning - 1-2 sentence assessment
 * @property {string} prompt - Complete actionable coding prompt (at least 80 characters)
 */

/**
 * @typedef {Object} AskResponseNoFit
 * @property {false} fit - The feature is not a good fit for this project
 * @property {string} reasoning - 1-2 sentence assessment acknowledging the idea but explaining the mismatch
 * @property {string} alternative - A different feature suggestion that would be a better fit (at least 80 characters)
 */

/**
 * @typedef {AskResponseFit | AskResponseNoFit} AskResponse
 */

/**
 * @typedef {Object} FeatureFit
 * @property {string} feature - The proposed feature text as supplied in the feature file
 * @property {string} title - Feature title (3-4 words) used when rendering the coding prompt
 * @property {string} reasoning - 1-2 sentence explanation of why the feature fits
 * @property {string} prompt - Complete, actionable coding prompt (at least 80 characters)
 */

/**
 * @typedef {Object} FeatureMisfit
 * @property {string} feature - The proposed feature text as supplied in the feature file
 * @property {string} reasoning - 1-2 sentence explanation of why the feature does not fit this project
 * @property {string} alternative - A better-fitting feature prompt (at least 80 characters)
 */

/**
 * @typedef {Object} FeatureReview
 * @property {string|undefined} source - Name of the reviewed feature file, when one was supplied
 * @property {number} total - Number of features reviewed
 * @property {number} fitCount - Number of features judged a good fit
 * @property {number} misfitCount - Number of features judged a poor fit
 * @property {FeatureFit[]} fits - Good fits, each with a full coding prompt
 * @property {FeatureMisfit[]} misfits - Poor fits, each with a reason and an alternative
 */

/**
 * @typedef {Object} FeatureFileResult
 * @property {string} path - Absolute path to the feature file
 * @property {string} name - File basename
 * @property {string} content - Raw file contents
 * @property {string[]} features - Parsed feature list (one entry per line or list item)
 */

/**
 * @typedef {Object} HistoryEntry
 * @property {number} timestamp - Unix timestamp (Date.now()) when the selection was made
 * @property {string} mode - The suggestion mode used when the selection was made
 * @property {string} title - The title of the selected suggestion
 */

/**
 * @typedef {Object} SuggestionOptions
 * @property {boolean} [mock=false] - Use deterministic offline suggestions (skips LLM and history)
 * @property {SuggestionMode} [mode='balanced'] - Suggestion generation mode
 */

/**
 * @typedef {Object} AskOptions
 * @property {boolean} [mock=false] - Use deterministic offline evaluation (skips LLM and history)
 */

/**
 * @typedef {Object} Environment
 * @property {string} [OPENAI_API_KEY]
 * @property {string} [DIRGEST_PROVIDER]
 * @property {string} [DIRGEST_MODEL]
 * @property {string} [DIRGEST_BRIDGE_URL]
 * @property {string} [DIRGEST_BRIDGE_MODEL]
 * @property {string} [GROQ_API_KEY]
 * @property {string} [OPENCODE_ZEN_API_KEY]
 * @property {string} [key: string] - Any environment variable may be present
 */

/**
 * @typedef {Object} ModelConfiguration
 * @property {string} provider - The resolved provider ID (e.g., 'openai', 'groq', 'opencode-zen')
 * @property {string} model - The resolved model ID
 * @property {boolean} usesModelHitchConfiguration - Whether the config came from ModelHitch auto-detection
 * @property {Object} [credentials] - Optional credentials (apiKey, baseUrl) for bridge/direct providers
 */
