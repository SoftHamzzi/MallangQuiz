#!/usr/bin/env node
/**
 * collect.js
 * 포스트 디렉터리를 스캔하여 랜덤으로 quizCount개를 선택하고,
 * 이미지가 있는 포스트는 이미지 수집까지 한번에 처리합니다.
 * 결과를 JSON으로 stdout에 출력합니다.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const ignore = require('ignore');

// ── Config ───────────────────────────────────────────────────────────────────

const configPath = path.resolve(process.cwd(), 'mallang-quiz.config.json');
if (!fs.existsSync(configPath)) {
  process.stderr.write('mallang-quiz.config.json 파일을 찾을 수 없습니다.\n');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const postsDir = path.resolve(config.postsDir);
const excludePatterns = config.excludePatterns ?? [];
const quizCount = config.quizCount ?? 5;
const language = config.language ?? 'ko';
const outputDir = path.resolve(config.outputDir ?? './quiz-output');
const cacheDir = path.resolve(process.cwd(), '.quiz-cache', 'images');

if (!fs.existsSync(postsDir)) {
  process.stderr.write(`포스트 디렉터리가 없습니다: ${postsDir}\n`);
  process.exit(1);
}

// ── 출력 폴더명 생성 ──────────────────────────────────────────────────────────

function formatDatetime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

const outputFolder = path.join(outputDir, formatDatetime(new Date()));

// ── Post scan helpers ─────────────────────────────────────────────────────────

const IMAGE_RE = /!\[[^\]]*\]\((?!\s*\{\{)(?!\s*\{%)[^)"'\s]+/;

function extractTitle(content, filename) {
  const fm = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fm) {
    const t = fm[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
    if (t) return t[1].trim();
  }
  const h = content.match(/^#\s+(.+)$/m);
  if (h) return h[1].trim();
  return filename.replace(/\.[^.]+$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

// ── Image helpers ─────────────────────────────────────────────────────────────

function hashPrefix(str) {
  return crypto.createHash('md5').update(str).digest('hex').slice(0, 6);
}

function safeBasename(name) {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 60);
}

function makeFilename(src, originalName) {
  const ext = path.extname(originalName) || '.jpg';
  const base = safeBasename(path.basename(originalName, ext));
  return `${hashPrefix(src)}_${base}${ext}`;
}

function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    const cleanup = () => { try { fs.unlinkSync(destPath); } catch {} };

    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.destroy(); cleanup();
        downloadImage(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.destroy(); cleanup();
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', (err) => { cleanup(); reject(err); });
    }).on('error', (err) => { cleanup(); reject(err); });
  });
}

function extractImages(content) {
  const regex = /!\[([^\]]*)\]\(([^)"'\s]+)/g;
  const images = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const src = match[2];
    if (src.includes('{{') || src.includes('{%')) continue;
    images.push({ alt: match[1], src });
  }
  return images;
}

async function resolveImage(img, postDir) {
  const { alt, src } = img;
  if (src.startsWith('http://') || src.startsWith('https://')) {
    fs.mkdirSync(cacheDir, { recursive: true });
    const originalName = path.basename(new URL(src).pathname) || 'image';
    const filename = makeFilename(src, originalName);
    const destPath = path.join(cacheDir, filename);
    if (!fs.existsSync(destPath)) {
      try {
        await downloadImage(src, destPath);
      } catch (err) {
        process.stderr.write(`  이미지 다운로드 실패 (스킵): ${src}\n  → ${err.message}\n`);
        return null;
      }
    }
    return { alt, path: destPath, filename, source: 'external', originalUrl: src };
  } else {
    const abs = path.resolve(postDir, src);
    if (!fs.existsSync(abs)) return null;
    const filename = makeFilename(abs, path.basename(abs));
    return { alt, path: abs, filename, source: 'local' };
  }
}

// ── Scan posts ────────────────────────────────────────────────────────────────

const ig = ignore().add(excludePatterns);
const posts = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, entry);
    const rel = path.relative(postsDir, full).replace(/\\/g, '/');
    if (ig.ignores(rel)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (stat.isFile() && path.extname(entry).toLowerCase() === '.md') {
      const content = fs.readFileSync(full, 'utf-8');
      posts.push({
        title: extractTitle(content, entry),
        relativePath: rel,
        absolutePath: full,
        hasImages: IMAGE_RE.test(content),
      });
    }
  }
}

walk(postsDir);

// ── Random pick ───────────────────────────────────────────────────────────────

function pickRandom(arr, n) {
  const picked = [];
  for (let i = 0; i < n; i++) {
    picked.push(arr[Math.floor(Math.random() * arr.length)]);
  }
  return picked;
}

const picked = pickRandom(posts, quizCount);

// ── Image collection for picked posts ────────────────────────────────────────

async function main() {
  const imageMap = {};

  for (const post of picked) {
    if (!post.hasImages) continue;
    const content = fs.readFileSync(post.absolutePath, 'utf-8');
    const rawImages = extractImages(content);
    const postDir = path.dirname(post.absolutePath);
    process.stderr.write(`이미지 수집: ${path.basename(post.absolutePath)} (${rawImages.length}개)\n`);
    const resolved = [];
    for (const img of rawImages) {
      const r = await resolveImage(img, postDir);
      if (r) resolved.push(r);
    }
    imageMap[post.absolutePath] = resolved;
  }

  const result = {
    outputFolder,
    quizCount,
    language,
    totalPosts: posts.length,
    posts: picked,
    imageMap,
  };

  process.stdout.write(JSON.stringify(result, null, 2));
  process.stderr.write(`\n완료: ${posts.length}개 중 ${quizCount}개 선택됨\n`);
}

main().catch((err) => {
  process.stderr.write(`오류: ${err.message}\n`);
  process.exit(1);
});
