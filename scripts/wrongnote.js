#!/usr/bin/env node
/**
 * wrongnote.js
 * 오답노트(.quiz-wrongnote/wrongnotes.json) 저장소를 읽고 쓰는 기계적 작업 전용 CLI입니다.
 * LLM 판단은 하지 않습니다 — 전이 규칙 적용, 정렬, 경로 조합, ID 발급만 합니다.
 *
 * 서브커맨드:
 *   node scripts/wrongnote.js record --input <채점 결과 JSON 파일 경로>
 *   node scripts/wrongnote.js pick [--count <N>] [--exclude-sources a.md,b.md]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Config ───────────────────────────────────────────────────────────────────

const configPath = path.resolve(process.cwd(), 'mallang-quiz.config.json');
if (!fs.existsSync(configPath)) {
  process.stderr.write('mallang-quiz.config.json 파일을 찾을 수 없습니다.\n');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const postsDir = path.resolve(config.postsDir);
const quizCount = config.quizCount ?? 5;
const wrongNoteConfig = config.wrongNote ?? {};
const enabled = wrongNoteConfig.enabled ?? true;
const ratio = wrongNoteConfig.ratio ?? 0.2;
const maxStage = wrongNoteConfig.maxStage ?? 2;

const storePath = path.resolve(process.cwd(), '.quiz-wrongnote', 'wrongnotes.json');

// ── 저장소 IO ─────────────────────────────────────────────────────────────────

function loadStore() {
  if (!fs.existsSync(storePath)) return { items: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    return { items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch (err) {
    process.stderr.write(`경고: wrongnotes.json 파싱 실패, 빈 저장소로 시작합니다. (${err.message})\n`);
    return { items: [] };
  }
}

function saveStore(store) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8');
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function newId(existingIds) {
  let id;
  do {
    id = `wn-${crypto.randomBytes(4).toString('hex')}`;
  } while (existingIds.has(id));
  return id;
}

// ── 인자 파싱 ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[key] = value;
    }
  }
  return out;
}

const [, , subcommand, ...rest] = process.argv;
const args = parseArgs(rest);

// ── record ────────────────────────────────────────────────────────────────────

function runRecord() {
  if (!args.input) {
    process.stderr.write('사용법: node scripts/wrongnote.js record --input <채점 결과 JSON 파일 경로>\n');
    process.exit(1);
  }
  const inputPath = path.resolve(process.cwd(), args.input);
  if (!fs.existsSync(inputPath)) {
    process.stderr.write(`입력 파일을 찾을 수 없습니다: ${inputPath}\n`);
    process.exit(1);
  }

  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  } catch (err) {
    process.stderr.write(`입력 JSON 파싱 실패: ${err.message}\n`);
    process.exit(1);
  }
  if (!Array.isArray(entries)) {
    process.stderr.write('입력 JSON은 배열이어야 합니다.\n');
    process.exit(1);
  }

  const store = loadStore();
  const byId = new Map(store.items.map((it) => [it.id, it]));
  const existingIds = new Set(store.items.map((it) => it.id));
  const removeIds = new Set();

  let added = 0;
  let advanced = 0;
  let reset = 0;
  let mastered = 0;
  let ignored = 0;

  for (const entry of entries) {
    const { wrongNoteId, source, template, difficulty, concept, questionText, score, judgment } = entry;
    const isPerfect = judgment === '⭕';
    const date = today();

    if (wrongNoteId) {
      const item = byId.get(wrongNoteId);
      if (!item) {
        process.stderr.write(`경고: 알 수 없는 오답노트 ID (${wrongNoteId}) — 건너뜁니다.\n`);
        ignored++;
        continue;
      }
      item.history.push({ date, score, judgment });
      item.recentQuestions = [questionText, ...(item.recentQuestions ?? [])].filter(Boolean).slice(0, 3);
      item.lastSeenDate = date;
      item.reviewCount = (item.reviewCount ?? 0) + 1;
      if (concept) item.concept = concept;

      if (isPerfect) {
        item.stage += 1;
        if (item.stage >= maxStage) {
          removeIds.add(item.id);
          mastered++;
        } else {
          advanced++;
        }
      } else {
        item.stage = 0;
        reset++;
      }
      continue;
    }

    if (isPerfect) {
      // 원래 오답노트 대상이 아니었던 일반 문제 — 아무 동작 없음
      continue;
    }

    // 신규 오답 등록
    const id = newId(existingIds);
    existingIds.add(id);
    const item = {
      id,
      source,
      template,
      difficulty,
      concept: concept ?? '',
      stage: 0,
      maxStage,
      recentQuestions: questionText ? [questionText] : [],
      history: [{ date, score, judgment }],
      addedDate: date,
      lastSeenDate: date,
      reviewCount: 1,
    };
    store.items.push(item);
    byId.set(id, item);
    added++;
  }

  store.items = store.items.filter((it) => !removeIds.has(it.id));
  saveStore(store);

  const summary = { added, advanced, reset, mastered, ignored, totalItems: store.items.length };
  process.stdout.write(JSON.stringify(summary, null, 2));
  process.stderr.write(
    `\n오답노트 갱신 완료: 신규 ${added}, 단계상승 ${advanced}, 리셋 ${reset}, 마스터(제거) ${mastered}, 총 ${store.items.length}개 보관 중\n`
  );
}

// ── pick ──────────────────────────────────────────────────────────────────────

function runPick() {
  const store = loadStore();

  if (!enabled) {
    process.stdout.write(JSON.stringify({ items: [], reason: 'disabled' }, null, 2));
    process.stderr.write('\n오답노트 기능이 비활성화되어 있습니다 (wrongNote.enabled=false).\n');
    return;
  }

  const excludeSources = new Set(
    typeof args['exclude-sources'] === 'string'
      ? args['exclude-sources'].split(',').map((s) => s.trim()).filter(Boolean)
      : []
  );

  const count = args.count !== undefined ? Number(args.count) : Math.round(quizCount * ratio);

  const candidates = store.items
    .filter((it) => !excludeSources.has(it.source))
    .slice()
    .sort((a, b) => {
      if (a.stage !== b.stage) return a.stage - b.stage;
      return a.lastSeenDate < b.lastSeenDate ? -1 : a.lastSeenDate > b.lastSeenDate ? 1 : 0;
    });

  const picked = candidates.slice(0, Math.max(0, count)).map((it) => {
    const sourceAbsolutePath = path.join(postsDir, it.source);
    return {
      id: it.id,
      source: it.source,
      sourceAbsolutePath,
      sourceExists: fs.existsSync(sourceAbsolutePath),
      template: it.template,
      difficulty: it.difficulty,
      concept: it.concept,
      recentQuestions: it.recentQuestions ?? [],
      stage: it.stage,
      addedDate: it.addedDate,
      reviewCount: it.reviewCount ?? 0,
      nextReviewNumber: (it.reviewCount ?? 0) + 1,
    };
  });

  process.stdout.write(JSON.stringify({ items: picked, requestedCount: count, poolSize: store.items.length }, null, 2));
  process.stderr.write(`\n오답노트 뽑기: 요청 ${count}개 중 ${picked.length}개 반환 (전체 보관 ${store.items.length}개)\n`);
}

// ── entry ─────────────────────────────────────────────────────────────────────

if (subcommand === 'record') {
  runRecord();
} else if (subcommand === 'pick') {
  runPick();
} else {
  process.stderr.write(
    '사용법:\n' +
      '  node scripts/wrongnote.js record --input <채점 결과 JSON 파일 경로>\n' +
      '  node scripts/wrongnote.js pick [--count <N>] [--exclude-sources a.md,b.md]\n'
  );
  process.exit(1);
}
