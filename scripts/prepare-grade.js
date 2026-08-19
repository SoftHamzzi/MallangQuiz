#!/usr/bin/env node
/**
 * prepare-grade.js
 * 블로그 폴더에 복사해 풀어 놓은 말랑 퀴즈 문제지(*_quiz.md)를 찾아
 *  - 대응하는 quiz-output 해답지(answers.md)
 *  - 각 문제의 출처 문서 절대 경로
 *  - 사용자가 작성한 답안
 * 을 매칭해서 JSON으로 stdout에 출력합니다.
 */

const fs = require('fs');
const path = require('path');

// ── Config ───────────────────────────────────────────────────────────────────

const configPath = path.resolve(process.cwd(), 'mallang-quiz.config.json');
if (!fs.existsSync(configPath)) {
  process.stderr.write('mallang-quiz.config.json 파일을 찾을 수 없습니다.\n');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const postsDir = path.resolve(config.postsDir);
const outputDir = path.resolve(config.outputDir ?? './quiz-output');

const arg = process.argv[2];
if (!arg) {
  process.stderr.write('사용법: node scripts/prepare-grade.js <문제지 파일명 또는 경로>\n');
  process.exit(1);
}

// ── 마크다운 파싱 헬퍼 ────────────────────────────────────────────────────────

/** 해당 위치가 코드 펜스(```) 안쪽인지 판정 */
function insideFence(content, index) {
  const fences = content.slice(0, index).match(/^```/gm);
  return fences ? fences.length % 2 === 1 : false;
}

/** 코드 펜스 밖에 있는 매치만 수집 */
function matchesOutsideFence(content, regex) {
  const out = [];
  let m;
  regex.lastIndex = 0;
  while ((m = regex.exec(content)) !== null) {
    if (!insideFence(content, m.index)) out.push(m);
  }
  return out;
}

const SOURCE_RE = /^>\s*\*\*출처:\*\*\s*`([^`]+)`/gm;
const HEADING_RE = /^##\s+Q(\d+)\.\s*(.+)$/gm;
const ANSWER_MARKER_RE = /\*\*📝\s*내\s*(선택|풀이|답)\s*:\*\*/;

/** 템플릿이 남겨 둔 기본 플레이스홀더 (그대로면 미응답으로 간주) */
const PLACEHOLDERS = [
  '<풀이를 여기에 작성하세요>',
  '(  )',
  '( )',
  '()',
  '(빈칸 수에 맞게 작성하세요)',
  'O / X',
  'O/X',
];

function normalize(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function isPlaceholder(text) {
  const n = normalize(text);
  if (n === '') return true;
  return PLACEHOLDERS.some((p) => normalize(p) === n);
}

function extractSources(content) {
  return matchesOutsideFence(content, SOURCE_RE).map((m) => m[1].trim());
}

// ── 문제지 파일 찾기 ──────────────────────────────────────────────────────────

function findTargetFile(input) {
  const direct = path.resolve(process.cwd(), input);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
    return { file: direct, candidates: [] };
  }

  const base = path.basename(input).toLowerCase();
  const wanted = base.endsWith('.md') ? base : `${base}.md`;
  const matches = [];

  (function walk(dir) {
    for (const entry of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (entry.toLowerCase() === wanted) matches.push(full);
    }
  })(postsDir);

  if (matches.length === 1) return { file: matches[0], candidates: [] };
  return { file: null, candidates: matches };
}

const found = findTargetFile(arg);
if (!found.file) {
  if (found.candidates.length === 0) {
    process.stderr.write(`문제지 파일을 찾을 수 없습니다: ${arg}\n검색 위치: ${postsDir}\n`);
  } else {
    process.stderr.write(
      `같은 이름의 파일이 여러 개입니다. 전체 경로로 다시 지정하세요:\n` +
        found.candidates.map((c) => `  - ${c}`).join('\n') +
        '\n'
    );
  }
  process.exit(1);
}

const quizPath = found.file;
const quizContent = fs.readFileSync(quizPath, 'utf-8');

// ── frontmatter / preamble ───────────────────────────────────────────────────

const fmMatch = quizContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
const frontmatter = fmMatch ? fmMatch[0] : null;

let quizTitle = null;
let postDate = null;
if (fmMatch) {
  const t = fmMatch[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
  if (t) quizTitle = t[1].trim();
  const d = fmMatch[1].match(/^date:\s*(\d{4}-\d{2}-\d{2})/m);
  if (d) postDate = d[1];
}
if (!postDate) {
  const fromName = path.basename(quizPath).match(/^(\d{4}-\d{2}-\d{2})-/);
  if (fromName) postDate = fromName[1];
}

/** 문제지 title → 해답지 title */
function toAnswerTitle(title) {
  if (!title) return null;
  return /문제\s*$/.test(title) ? title.replace(/문제\s*$/, '해답') : `${title} 해답`;
}

/** frontmatter의 title 줄만 해답용으로 교체 */
function toAnswerFrontmatter(fm, answerTitle) {
  if (!fm || !answerTitle) return fm;
  return fm.replace(/^(title:[ \t]*)["']?.+?["']?[ \t]*$/m, `$1"${answerTitle}"`);
}

const answerTitle = toAnswerTitle(quizTitle);
const answerFrontmatter = toAnswerFrontmatter(frontmatter, answerTitle);

// frontmatter 종료 ~ 첫 `# ` 제목 사이의 안내 문구 (블로그 공지 등)
let preamble = '';
if (fmMatch) {
  const after = quizContent.slice(fmMatch[0].length);
  const firstH1 = after.search(/^#\s+/m);
  preamble = (firstH1 === -1 ? '' : after.slice(0, firstH1)).trim();
}

// ── 문제 블록 파싱 ────────────────────────────────────────────────────────────

const headings = matchesOutsideFence(quizContent, HEADING_RE);
const questions = headings.map((h, i) => {
  const start = h.index;
  const end = i + 1 < headings.length ? headings[i + 1].index : quizContent.length;
  const block = quizContent.slice(start, end);

  const srcMatch = matchesOutsideFence(block, SOURCE_RE)[0];
  const source = srcMatch ? srcMatch[1].trim() : null;
  const sourceAbsolutePath = source ? path.join(postsDir, source) : null;

  const marker = block.match(ANSWER_MARKER_RE);
  let userAnswer = '';
  if (marker) {
    userAnswer = block
      .slice(marker.index + marker[0].length)
      .replace(/\n\s*---\s*$/, '')
      .trim();
  }

  return {
    number: Number(h[1]),
    difficulty: h[2].trim(),
    source,
    sourceAbsolutePath,
    sourceExists: sourceAbsolutePath ? fs.existsSync(sourceAbsolutePath) : false,
    answerLabel: marker ? marker[1] : null,
    userAnswer,
    unanswered: isPlaceholder(userAnswer),
  };
});

const quizSources = questions.map((q) => q.source);

// ── quiz-output 해답지 매칭 ───────────────────────────────────────────────────

const dateCompact = postDate ? postDate.replace(/-/g, '') : '';

function listOutputFolders() {
  if (!fs.existsSync(outputDir)) return [];
  return fs
    .readdirSync(outputDir)
    .filter((name) => {
      const full = path.join(outputDir, name);
      return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'answers.md'));
    })
    .sort()
    .reverse();
}

const scored = listOutputFolders().map((folder) => {
  const answersPath = path.join(outputDir, folder, 'answers.md');
  const sources = extractSources(fs.readFileSync(answersPath, 'utf-8'));
  const set = new Set(sources);

  let ordered = 0;
  for (let i = 0; i < Math.min(sources.length, quizSources.length); i++) {
    if (sources[i] && sources[i] === quizSources[i]) ordered++;
  }
  const overlap = quizSources.filter((s) => s && set.has(s)).length;

  return {
    folder,
    answersPath,
    sources,
    ordered,
    overlap,
    dateMatch: dateCompact !== '' && folder.startsWith(dateCompact),
  };
});

scored.sort((a, b) => {
  if (b.ordered !== a.ordered) return b.ordered - a.ordered;
  if (b.overlap !== a.overlap) return b.overlap - a.overlap;
  if (b.dateMatch !== a.dateMatch) return b.dateMatch ? 1 : -1;
  return b.folder.localeCompare(a.folder);
});

const best = scored[0];
const matchedOutput =
  best && (best.ordered > 0 || best.overlap > 0)
    ? {
        folder: best.folder,
        answersPath: best.answersPath,
        quizPath: path.join(outputDir, best.folder, 'quiz.md'),
        orderedMatches: best.ordered,
        overlapMatches: best.overlap,
        dateMatch: best.dateMatch,
        exact: best.ordered === quizSources.length && quizSources.length > 0,
      }
    : null;

// ── 출력 파일 경로 ────────────────────────────────────────────────────────────

const quizBase = path.basename(quizPath);
const answerBase = /_quiz\.md$/i.test(quizBase)
  ? quizBase.replace(/_quiz\.md$/i, '_answer.md')
  : quizBase.replace(/\.md$/i, '_answer.md');
const answerPath = path.join(path.dirname(quizPath), answerBase);

// ── 경고 수집 ─────────────────────────────────────────────────────────────────

const warnings = [];
if (!matchedOutput) warnings.push('대응하는 quiz-output 해답지를 찾지 못했습니다. 출처 문서만으로 채점해야 합니다.');
else if (!matchedOutput.exact) warnings.push(`해답지 출처가 일부만 일치합니다 (${matchedOutput.orderedMatches}/${quizSources.length}). 문제 본문을 대조해 확인하세요.`);
if (questions.length === 0) warnings.push('문제 블록(## Q<번호>.)을 하나도 찾지 못했습니다.');
for (const q of questions) {
  if (!q.source) warnings.push(`Q${q.number}: 출처 표기를 찾지 못했습니다.`);
  else if (!q.sourceExists) warnings.push(`Q${q.number}: 출처 문서가 존재하지 않습니다 (${q.source}).`);
  if (!q.answerLabel) warnings.push(`Q${q.number}: '내 풀이/선택/답' 표기를 찾지 못했습니다.`);
}
if (fs.existsSync(answerPath)) warnings.push(`해답 파일이 이미 존재합니다: ${answerPath} (덮어쓰기 전 사용자에게 확인하세요.)`);

// ── 출력 ──────────────────────────────────────────────────────────────────────

process.stdout.write(
  JSON.stringify(
    {
      quizPath,
      answerPath,
      answerExists: fs.existsSync(answerPath),
      postDate,
      quizTitle,
      answerTitle,
      answerFrontmatter,
      preamble,
      questionCount: questions.length,
      questions,
      matchedOutput,
      warnings,
    },
    null,
    2
  )
);
process.stderr.write(
  `\n문제지: ${quizPath}\n문제 수: ${questions.length}\n해답지 매칭: ${matchedOutput ? matchedOutput.folder : '실패'}\n`
);
