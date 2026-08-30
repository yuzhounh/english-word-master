# english-word-enriched

Pre-enriched English word library for [WordMaster](https://github.com/yuzhounh/english-word-master).

Based on [lilinji/English](https://github.com/lilinji/English), with 949 word books and 80,470 complete dictionary entries containing phonetics, definitions, and bilingual example sentences.

## Format: `wordmaster-enriched-v1`

```
english-word-enriched/
├── meta.json              # Package metadata & stats
├── tree.json              # Folder tree (same structure as source library)
├── dictionary.json.gz     # All unique words (stored once)
└── books/
    └── {category}/{book}.json   # Word ID lists only
```

### dictionary.json.gz

Compact keys per word:

| Field | Meaning |
|-------|---------|
| `w` | word |
| `p` | phonetic (default) |
| `uk` | UK phonetic |
| `us` | US phonetic |
| `c` | Chinese definition |
| `e` | English example |
| `cn` | Chinese example translation |

### books/*.json

```json
{
  "name": "四级核心词汇",
  "path": "3.四级/四级核心词汇",
  "wordCount": 1200,
  "wordIds": ["abandon", "ability", "..."]
}
```

## Why not xlsx?

- **80k words stored once** instead of 2M+ duplicated rows
- **Git-friendly** text/JSON, readable diffs
- **Fast web loading** — merge book wordIds with dictionary in O(n)

## Usage with WordMaster

Set environment variables:

```
WORD_LIBRARY_REPO=your-user/english-word-enriched
WORD_LIBRARY_FORMAT=enriched
```

Or bundle locally:

```
WORD_LIBRARY_LOCAL_PATH=./data/english-word-enriched
```

## Regenerate

From the WordMaster repo:

```bash
npx tsx scripts/collect-library-words.ts
npx tsx scripts/build-word-dictionary.ts
npx tsx scripts/build-book-index.ts
npx tsx scripts/build-enriched-package.ts
```

## License

Derived from lilinji/English. See source repository for original terms.
