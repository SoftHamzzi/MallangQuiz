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
- `posts[]`: 랜덤으로 선택된 `quizCount`개의 포스트 `{ title, relativePath, absolutePath, hasImages, occurrenceIndex, totalOccurrences }`
  - `totalOccurrences > 1`이면 같은 포스트가 여러 번 선택된 것
  - `occurrenceIndex`는 해당 포스트가 몇 번째로 등장하는지 (1부터 시작)
- `imageMap`: `{ "<absolutePath>": [{ alt, path, filename, source, originalSrc }] }` (이미지 없는 포스트는 키 없음)

## 2단계: 오답노트 뽑기

Bash 도구로 아래 명령을 실행하고 JSON 출력을 저장하세요:

```bash
node scripts/wrongnote.js pick --exclude-sources "<1단계 posts[]의 relativePath를 콤마로 이어붙인 문자열>"
```

출력 JSON 구조:
- `items[]`: `{ id, source, sourceAbsolutePath, sourceExists, template, difficulty, concept, recentQuestions, stage, addedDate, reviewCount, nextReviewNumber }`
- `requestedCount`, `poolSize`

`items`가 비어 있으면(오답노트가 비었거나 `wrongNote.enabled=false`) 이후 단계는 오답노트 문제 없이 1단계 결과만으로 진행하세요 — 오류가 아닙니다.

## 3단계: 템플릿 읽기

Glob 도구로 `quiz-templates/*.md` 패턴으로 템플릿 파일 목록을 가져온 뒤, 모든 파일을 Read 도구로 읽으세요 (동시에 읽어도 됩니다).

각 템플릿 파일은 다음 구조를 가집니다:
- frontmatter의 `name`: 템플릿 이름
- frontmatter의 `description`: 언제 이 템플릿을 쓸지 설명
- `### 문제지 형식`: quiz.md에 사용할 마크다운 형식
- `### 해답지 형식`: answers.md에 사용할 마크다운 형식
- `{난이도}` 플레이스홀더는 이모지+텍스트를 함께 씁니다 (예: `🟢 쉬움` / `🟡 보통` / `🔴 어려움`)

## 4단계: 출력 폴더 생성

`outputFolder` 경로로 폴더를 생성하세요:

```bash
mkdir -p "<outputFolder>"
```

## 5단계: 포스트 읽기 및 퀴즈 생성

`posts[]`의 각 항목과 2단계 `items[]`의 각 항목이 합쳐서 문제 1개씩 대응합니다 (총 `posts.length + items.length`문제). `posts[]`는 아래 "새 문제" 절차로, `items[]`는 그 아래 "오답노트 문제" 절차로 만드세요.

### 새 문제 (posts[] 기반)

문제 생성 전 준비:
- `totalOccurrences > 1`인 포스트가 있으면, 해당 포스트의 모든 항목을 먼저 그룹으로 묶으세요. 포스트를 읽은 뒤 핵심 개념 목록을 `totalOccurrences`개 이상 추출하고, `occurrenceIndex` 순서대로 서로 다른 개념을 하나씩 배정하세요. 이후 각 항목은 배정된 개념으로만 문제를 만드세요.

각 항목마다:
1. Read 도구로 `absolutePath` 파일을 읽으세요 (5개 동시에 읽으세요)
2. 해당 포스트의 이미지가 있다면 `imageMap[absolutePath]`에서 이미지 정보를 가져오고, 각 이미지의 `path`도 Read 도구로 읽으세요 (이미지 내용 파악용)
3. 포스트 내용을 바탕으로 **가장 적합한 템플릿을 선택**하세요:
   - 각 템플릿의 `description`을 참고하여 해당 포스트 내용과 잘 맞는 것을 고르세요
   - 전체 문제에서 템플릿이 다양하게 분포되도록 하세요 (같은 템플릿 연속 3개 이상 금지)
4. 선택한 템플릿의 형식에 맞춰 문제를 만드세요
5. 문제에 이미지를 포함하기로 결정했다면 `image.originalSrc`를 그대로 사용하세요 (로컬 캐시 경로 직접 사용 금지):
   ```
   ![<image.alt>](<image.originalSrc>)
   ```

퀴즈 생성 기준:
- 핵심 개념·원리·구현 방법을 테스트하는 질문
- 단순 암기보다 이해를 확인하는 질문 선호
- 난이도: 쉬움 / 보통 / 어려움 혼합
- **문제는 반드시 자기완결적이어야 합니다**: 출처 마크다운을 읽지 않아도 문제 본문만으로 충분히 이해하고 풀 수 있어야 합니다. 필요한 배경 지식·코드·조건은 문제 안에 직접 포함하세요.

### 오답노트 문제 (items[] 기반)

`items[]`의 각 항목은 예전에 틀렸던(또는 아직 두 번 연속 만점을 받지 못한) 문제입니다. **같은 문제를 그대로 복사하지 말고, 같은 출처·같은 개념을 매번 다른 문구로 다시 물어보세요** — 정답을 외운 건지 개념을 이해한 건지 구분하기 위함입니다.

각 항목마다:
1. `sourceExists`가 `false`면 이 항목은 건너뛰고 최종 보고에 "출처 문서가 사라져 오답노트 Q 하나를 스킵함(`id`)"이라고 알리세요.
2. Read 도구로 `sourceAbsolutePath`를 읽으세요.
3. `item.template`과 동일한 템플릿, `item.difficulty`와 동일한 난이도로 새 문제를 만드세요 (템플릿을 새로 고르지 않습니다 — 이미 정해져 있습니다).
4. `item.concept`(이 항목이 정확히 무엇을 테스트하는지)을 중심으로 질문을 구성하되, `item.recentQuestions`에 있는 문구와 겹치지 않는 다른 각도·다른 표현으로 새로 작성하세요.
5. 선택한 템플릿의 "문제지 형식"/"해답지 형식"을 그대로 따르되, 아래 두 가지를 추가하세요.
   - 제목 줄 끝에 배지를 붙입니다: `## Q{번호}. {난이도} · 📌 오답노트 ({item.nextReviewNumber}번째 복습)`
   - `> **출처:**` 줄 바로 아래에 오답노트 줄을 추가합니다: `> **오답노트:** \`{item.id}\` · {item.addedDate} 최초 오답 · 이번이 {item.nextReviewNumber}번째 복습`

   객관식 예시 (문제지):
   ```markdown
   ## Q3. 🟡 보통 · 📌 오답노트 (3번째 복습)

   {새로 만든 문제내용}

   - A. {보기A}
   - B. {보기B}
   - C. {보기C}
   - D. {보기D}

   > **출처:** `{item.source}`
   > **오답노트:** `wn-3f9a2b1c` · 2026-08-19 최초 오답 · 이번이 3번째 복습

   **📝 내 선택:** (  )

   ---
   ```

   해답지에도 동일하게 제목 줄 배지와 `**오답노트:**` 줄을 포함하세요.

## 6단계: 결과 파일 생성

`outputFolder` 안에 두 파일을 작성하세요.

각 문제는 **3단계에서 읽은 템플릿의 형식**을 그대로 사용합니다 (오답노트 문제는 위 5단계 절차대로 배지를 추가). 아래는 파일 헤더 형식입니다. `N`은 `posts.length + items.length`입니다.

### quiz.md (문제지 — 정답 없음)

```markdown
# 말랑말랑 퀴즈 📝

**날짜:** {날짜}
**문제 수:** N문제

---

{각 문제를 선택한 템플릿의 "문제지 형식"으로 작성}
```

### answers.md (해답지 — 문제 + 정답)

```markdown
# 말랑말랑 퀴즈 — 해답지 ✅

**날짜:** {날짜}
**문제 수:** N문제

---

{각 문제를 선택한 템플릿의 "해답지 형식"으로 작성}
```

두 파일 생성 후 경로와 함께 **오답노트 문제 포함 개수**(예: "총 5문제 중 오답노트 2문제 포함")를 알려주세요.
