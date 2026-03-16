다음 절차에 따라 말랑말랑 퀴즈를 생성하세요.

## 1단계: 포스트 수집 및 이미지 수집

Bash 도구로 아래 명령을 실행하고 JSON 출력을 저장하세요:

```bash
node scripts/collect.js
```

출력 JSON 구조:
- `outputFolder`: 결과를 저장할 폴더 경로 (날짜+시간 포함, 스크립트가 결정)
- `quizCount`: 생성할 문제 수
- `language`: 퀴즈 언어 ("ko" 또는 "en")
- `posts[]`: 랜덤으로 선택된 `quizCount`개의 포스트 `{ title, relativePath, absolutePath, hasImages }`
- `imageMap`: `{ "<absolutePath>": [{ alt, path, filename, source }] }` (이미지 없는 포스트는 키 없음)

## 2단계: 출력 폴더 생성

`outputFolder` 경로로 폴더를 생성하세요:

```bash
mkdir -p "<outputFolder>/images"
```

## 3단계: 포스트 읽기 및 퀴즈 생성

선택된 각 포스트에 대해 **문제 1개**를 만드세요.
(총 문제 수가 포스트 수보다 많으면 일부 포스트에서 2개 생성)

각 포스트마다:
1. Read 도구로 `absolutePath` 파일을 읽으세요 (5개 동시에 읽으세요)
2. 해당 포스트의 이미지가 있다면 `imageMap[absolutePath]`에서 이미지 정보를 가져오고, 각 이미지의 `path`도 Read 도구로 읽으세요
3. 해당 포스트의 핵심 개념을 테스트하는 문제를 만드세요
4. 문제에 이미지를 포함하기로 결정했다면 출력 폴더로 복사하세요:
   ```bash
   cp "<image.path>" "<outputFolder>/images/<image.filename>"
   ```
   마크다운에서는 반드시 아래 형태로만 참조하세요 (원본/캐시 경로 직접 사용 금지):
   ```
   ![<image.alt>](images/<image.filename>)
   ```

퀴즈 생성 기준:
- 핵심 개념·원리·구현 방법을 테스트하는 질문
- 단순 암기보다 이해를 확인하는 질문 선호
- 난이도: easy / medium / hard 혼합

## 4단계: 결과 파일 생성

`outputFolder` 안에 두 파일을 작성하세요.

### quiz.md (문제지 — 정답 없음)

```markdown
# 말랑말랑 퀴즈 📝

**날짜:** {날짜}
**문제 수:** N문제

---

## Q1. 🟡 보통

{질문 내용}

![이미지설명](images/파일명.png)  ← 이미지가 있는 경우에만

> **출처:** `{relativePath}`

---

## Q2. 🔴 어려움

{질문 내용}

> **출처:** `{relativePath}`

---
```

### answers.md (해답지 — 문제 + 정답)

```markdown
# 말랑말랑 퀴즈 — 해답지 ✅

**날짜:** {날짜}
**문제 수:** N문제

---

## Q1. 🟡 보통

**문제:** {질문 내용}

![이미지설명](images/파일명.png)  ← 이미지가 있는 경우에만

**정답:**

{상세한 답변}

> **출처:** `{relativePath}`

---

## Q2. 🔴 어려움

**문제:** {질문 내용}

**정답:**

{상세한 답변}

> **출처:** `{relativePath}`

---
```

두 파일 생성 후 경로를 알려주세요.
