#!/usr/bin/env node
/**
 * fetch-images.js
 * 선택된 포스트들의 이미지를 수집합니다.
 * - 외부 URL 이미지: .quiz-cache/images/ 에 다운로드
 * - 로컬 이미지: 절대 경로로 변환
 * - 모든 이미지에 해시 prefix를 붙여 파일명 충돌 방지
 *
 * 사용법: node scripts/fetch-images.js <paths_json_file>
 *   paths_json_file: 포스트 절대 경로 배열을 담은 JSON 파일 (공백 경로 안전)
 *   예) ["C:/Users/my name/blog/_posts/post.md", ...]
 *
 * 출력: JSON { "<absolutePath>": [{alt, path, filename}], ... }
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const cacheDir = path.resolve(process.cwd(), '.quiz-cache', 'images');

const jsonFile = process.argv[2];
if (!jsonFile) {
  process.stderr.write('사용법: node scripts/fetch-images.js <paths_json_file>\n');
  process.exit(1);
}
if (!fs.existsSync(jsonFile)) {
  process.stderr.write(`파일을 찾을 수 없습니다: ${jsonFile}\n`);
  process.exit(1);
}

const postPaths = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
if (!Array.isArray(postPaths) || postPaths.length === 0) {
  process.stderr.write('JSON 파일에 경로 배열이 없습니다.\n');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

    const cleanup = () => {
      try { fs.unlinkSync(destPath); } catch {}
    };

    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.destroy();
        cleanup();
        downloadImage(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.destroy();
        cleanup();
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

// ── Main ──────────────────────────────────────────────────────────────────────

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

async function main() {
  const result = {};

  for (const postPath of postPaths) {
    if (!fs.existsSync(postPath)) {
      process.stderr.write(`파일 없음 (스킵): ${postPath}\n`);
      continue;
    }

    const content = fs.readFileSync(postPath, 'utf-8');
    const rawImages = extractImages(content);
    const postDir = path.dirname(postPath);

    process.stderr.write(`이미지 수집: ${path.basename(postPath)} (${rawImages.length}개)\n`);

    const resolved = [];
    for (const img of rawImages) {
      const r = await resolveImage(img, postDir);
      if (r) resolved.push(r);
    }
    result[postPath] = resolved;
  }

  process.stdout.write(JSON.stringify(result, null, 2));
  process.stderr.write('\n이미지 수집 완료\n');
}

main().catch((err) => {
  process.stderr.write(`오류: ${err.message}\n`);
  process.exit(1);
});
