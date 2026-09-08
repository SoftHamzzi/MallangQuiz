# 오답노트 시스템 계획 (v2 — 설계 확정)

> **상태:** 계획 단계 — 아직 구현되지 않았습니다. v1에서 열려 있던 질문들이 이번 논의로 확정되어, 이 문서는 그대로 구현 착수 가능한 수준의 설계입니다.

## 동기

말해보카(어학 앱)의 복습 방식에서 착안했습니다.

- 이전에 틀린 문제들을 **마스터리 단계 기준 오름차순**(가장 못 맞힌 것부터)으로 줄 세워 둔다.
- 매일 새 문제를 낼 때, 이 오답 리스트에서 일정 **비율(%)**을 뽑아 새 문제 사이에 섞는다. 예: 10문제 중 20% → 오답노트에서 2문제.
- 오답을 다시 풀어서 맞히면 리스트 안에서 **후순위로 밀려난다** (덜 자주 나옴).
- 연속으로 잘 맞혀서 **마스터에 도달하는 순간 리스트에서 제거**된다. 한 번 맞혔다고 바로 사라지지 않는다.

말랑퀴즈는 매번 랜덤 포스트에서 새 문제만 뽑기 때문에, 한 번 틀린 개념을 다시 만날 보장이 없습니다. 오답노트는 이 문제를 해결합니다.

## 확정된 결정 사항

1. **섞는 비율의 의미**: `ratio`는 "오답노트 문제가 전체 문제 수에서 차지하는 비율"입니다. `quizCount=10`, `ratio=0.2` → 오답노트 문제 2개 + 새 문제 8개. 개수는 `round(quizCount × ratio)`로 계산합니다.
2. **스테이지 규칙**: 5단계는 과하다 — 이미 `/grade`가 부분 점수(0~10)를 매기고 있으므로, 오답노트는 **"완전히 맞혔는가"만 보는 2단계**로 단순화합니다.
   - `stage 0` (최초 등록 또는 리셋됨) → 이번 재출제에서 **`⭕ 정답`(만점)** → `stage 1`
   - `stage 1` → 다음 재출제에서 또 **`⭕ 정답`** → **마스터, 리스트에서 제거**
   - `stage 0` 또는 `stage 1`에서 **`⭕`가 아닌 모든 결과(🔺/❌/⬜)** → 즉시 `stage 0`으로 리셋
   - 즉, **연속으로 두 번 만점을 받아야** 오답노트에서 빠집니다. 부분 점수는 "아직 완전하지 않다"는 신호로만 쓰고 단계 계산은 이분법(만점 / 만점 아님)으로 갑니다.
3. **재출제 방식**: 저장해둔 문제를 그대로 복사하지 않고 **매번 변형해서 재출제**합니다. 같은 출처·같은 개념·같은 템플릿 유형을 유지하되, 이전에 냈던 질문 문구와는 다른 각도로 새로 생성합니다 (정답 암기가 아니라 개념 이해를 검증하기 위함).
4. **오답노트 채점 시 매칭**: 아래 [오답노트 식별자와 grade 매칭](#오답노트-식별자와-grade-매칭-최적화)에서 설명하는 **결정적 ID 방식**으로 처리합니다. 원본 `answers.md`를 다시 찾을 필요 없이, 그날 생성된 `answers.md`가 곧 정답 기준이 되고, ID만으로 오답노트 항목을 정확히 갱신합니다.
5. **quiz.md 표시**: 오답노트 문제는 **표시합니다.** 처음 틀린 날짜와 몇 번째 복습인지도 함께 보여줍니다 (동기부여 + 진행 상황 인지).
6. **오답노트 부족 시**: 요청한 개수만큼 못 채우면 남는 슬롯은 기존처럼 새 포스트 문제로 채웁니다. (스크립트는 그냥 있는 만큼만 반환 → 부족분은 커맨드가 `collect.js` 결과로 메움. 별도 처리 불필요.)
7. **정렬**: `stage` 오름차순 → 동점이면 `lastSeenDate` 오름차순(오래 안 본 것 우선).

## 기존 아키텍처와의 관계

[CLAUDE.md](../CLAUDE.md)의 2계층 분리 원칙을 그대로 따릅니다.

```
슬래시 커맨드 (판단)                     Node 스크립트 (기계적 작업)
──────────────────────────────         ──────────────────────────
/grade  채점 + 오답노트 항목 매칭 판단   →  wrongnote.js record  (JSON 저장/전이 규칙 적용)
/quiz   오답노트 문제 변형 출제 판단     →  wrongnote.js pick    (우선순위 정렬 후 상위 K개 반환)
```

- 스크립트는 이번에도 **LLM 판단을 하지 않습니다.** JSON 읽기/쓰기, 정렬, stage 전이 계산(단순 사칙연산), 절대경로 조합만 합니다.
- "이 문제를 어떻게 변형할지", "오답노트 항목과 이번 채점 결과를 어떻게 연결할지"의 실질적 판단은 커맨드(Claude Code)가 하되, **연결 자체는 결정적 ID로 하기 때문에 판단이 아니라 단순 조회**가 됩니다 (아래 참고).

## 데이터 모델

새 저장소: `.quiz-wrongnote/wrongnotes.json` (프로젝트 루트, `quiz-output/`처럼 함부로 지우면 안 되는 파일 — `/clear-cache`, `/clear-output` 대상에서 제외)

```json
{
  "items": [
    {
      "id": "wn-3f9a2b1c",
      "source": "server/game_server/3/2026-02-03-game_server_3_5.md",
      "template": "fill-in-the-blank",
      "difficulty": "🟡 보통",
      "concept": "TCP 수신 버퍼가 가득 찼을 때 송신 측이 블로킹되는 이유",
      "stage": 0,
      "maxStage": 2,
      "recentQuestions": [
        "TCP에서 수신 버퍼가 가득 차면 송신 측의 ___가 블로킹되고..."
      ],
      "history": [
        { "date": "2026-08-19", "score": 3.0, "judgment": "❌" },
        { "date": "2026-08-27", "score": 6.5, "judgment": "🔺" }
      ],
      "addedDate": "2026-08-19",
      "lastSeenDate": "2026-08-27",
      "reviewCount": 2
    }
  ]
}
```

- `recentQuestions`: 최근 낸 문제 문구(최대 3개, 오래된 것부터 제거). **변형 시 "이런 문구는 이미 썼다"는 참고 자료**로만 씁니다.
- `concept`: 이 항목이 정확히 무엇을 테스트하는지 한 줄 요약. `/grade`가 채점하며 이미 파악한 내용을 그대로 적습니다. `/quiz`가 변형 문제를 만들 때 "같은 개념, 다른 문구"를 지키는 기준점이 됩니다.
- `questionBlock`/`answerBlock` 전체를 저장하던 v1 설계는 폐기합니다 — 어차피 매번 새로 생성하므로 저장해봐야 다음 회차에 그대로 쓰지 않습니다. 대신 `concept` + `recentQuestions`만 저장해 가볍게 유지합니다.

## 오답노트 식별자와 grade 매칭 최적화

**문제**: 오답노트 문제는 매번 그 날의 `quiz-output/{날짜시간}/` 폴더에 다른 포스트 문제들과 섞여 생성됩니다. `/grade`가 이 문제를 채점할 때 두 가지가 필요합니다.
1. **정답 기준** — 어차피 그 날 `/quiz`가 만든 `answers.md`에 이 변형 문제의 정답도 함께 들어있으므로, 기존 `prepare-grade.js`의 "출처 목록 순서 대조" 매칭 로직이 **수정 없이 그대로** 정답 기준 파일을 찾아줍니다. (오답노트 문제도 그날 세션의 `quiz.md`/`answers.md`에 동일한 순서로 존재하기 때문.)
2. **오답노트 항목 갱신 대상 찾기** — 이건 기존 매칭으로 안 됩니다. "이 문제가 `wrongnotes.json`의 어떤 `item`에 대응하는가"를 알아야 stage를 전이시킬 수 있습니다.

**해결책**: 2번을 위해 `/quiz`가 변형 문제를 낼 때 문제 블록에 **오답노트 ID를 눈에 보이는 형태로 박아둡니다.**

```
> **출처:** `server/game_server/3/2026-02-03-game_server_3_5.md`
> **오답노트:** `wn-3f9a2b1c` · 2026-08-19 최초 오답 · 이번이 3번째 복습
```

- `prepare-grade.js`가 `출처` 줄을 파싱하듯 이 `오답노트` 줄도 같은 방식(코드 펜스 인지 포함)으로 파싱해 `questions[].wrongNoteId`로 내려줍니다.
- `/grade`는 채점 후 `wrongnote.js record`를 호출할 때 문항별 payload에 `wrongNoteId`(있으면)를 그대로 실어 보냅니다.
- `wrongnote.js record`는 `wrongNoteId`가 있으면 **O(1) 조회**로 해당 항목을 찾아 전이 규칙을 적용합니다. 텍스트 유사도 비교, 출처 매칭 같은 모호한 로직이 전혀 필요 없습니다 — 이게 "가장 최적화된" 방식인 이유입니다.
- `wrongNoteId`가 없는데 판정이 `⭕`이 아니면 → **새 오답노트 항목 생성** (처음 틀린 문제).
- `wrongNoteId`가 없는데 판정이 `⭕`이면 → 아무 것도 하지 않음 (원래도 오답노트 대상이 아니었던 일반 문제).

이 방식 덕분에 "오답노트 문제인지 아닌지", "어떤 항목인지"를 커맨드가 추론할 필요가 없고, ID 하나로 결정됩니다.

## quiz.md 표시 형식

오답노트에서 나온 문제는 일반 문제와 같은 템플릿 형식을 쓰되, 출처 줄 아래에 오답노트 배지를 추가합니다.

```markdown
## Q3. 🟡 보통 · 📌 오답노트 (3번째 복습)

TCP에서 흐름 제어가 동작하는 구체적인 상황을 설명하고, ...

> **출처:** `server/game_server/3/2026-02-03-game_server_3_5.md`
> **오답노트:** `wn-3f9a2b1c` · 2026-08-19 최초 오답 · 이번이 3번째 복습

**📝 내 답:** (답을 작성하세요)
```

- 제목 줄의 `📌 오답노트 (N번째 복습)`으로 한눈에 구분되고, "오답노트" 줄에서 최초로 틀린 날짜까지 확인할 수 있습니다.
- `answers.md`에도 동일한 배지/줄을 남겨 일관성을 유지합니다.

## 데이터 흐름

```
/grade 채점 완료
  │  (문제별 판정 ⭕/🔺/❌/⬜, 점수, wrongNoteId(있으면) — prepare-grade.js가 파싱해 이미 알고 있음)
  ▼
node scripts/wrongnote.js record --input <임시 JSON 파일>
  │  각 문항 payload: { wrongNoteId?, source, template, difficulty, concept, questionText, score, judgment }
  │
  │  - wrongNoteId 있음 + judgment=⭕   → stage += 1. stage === maxStage 면 항목 삭제(마스터 완료)
  │  - wrongNoteId 있음 + judgment≠⭕   → stage = 0 로 리셋
  │  - wrongNoteId 없음 + judgment≠⭕   → 신규 항목 생성 (stage=0, id 발급)
  │  - wrongNoteId 없음 + judgment=⭕   → 아무 동작 없음
  │  (갱신되는 항목은 history/recentQuestions/lastSeenDate/reviewCount도 함께 갱신)
  ▼
.quiz-wrongnote/wrongnotes.json 갱신 완료


/quiz 실행
  │
  ▼
node scripts/collect.js  (기존과 동일: 새 포스트 quizCount개 랜덤 선택)
  │
  ▼
node scripts/wrongnote.js pick --count <round(quizCount×ratio)> --exclude-sources <새로 뽑힌 포스트 출처>
  │  - wrongnotes.json을 stage 오름차순 → lastSeenDate 오름차순으로 정렬
  │  - 상위 N개 반환. 각 항목에 sourceAbsolutePath/sourceExists 포함 (postsDir와 조합, 커맨드가 직접 조합 안 함)
  │  - 부족하면 있는 만큼만 반환 (에러 아님)
  ▼
Claude Code:
  - 새 포스트 문제: 기존 로직 그대로 생성
  - 오답노트 문제: 각 항목의 sourceAbsolutePath를 Read → concept/recentQuestions를 참고해
    "같은 개념, 다른 문구"의 새 문제를 해당 template 형식으로 생성 →
    출처 줄 + 오답노트 배지(id, addedDate, reviewCount+1) 삽입
  → quiz.md/answers.md 생성 (한 세션 폴더 안에 전부 포함되므로 /grade 매칭은 기존 로직 그대로 동작)
```

## 필요한 변경 사항

### 1. 신규 스크립트 — `scripts/wrongnote.js`

`collect.js`/`prepare-grade.js`와 같은 스타일(stdout=JSON, stderr=로그)의 CLI. 서브커맨드 두 개:

- `node scripts/wrongnote.js record --input <path>`
  - 입력: 문항별 `{ wrongNoteId?, source, template, difficulty, concept?, questionText, score, judgment }` 배열
  - 위 전이 규칙을 그대로 적용해 `wrongnotes.json` 갱신
  - 출력: `{ added: N, advanced: N, reset: N, mastered: N }` 같은 요약 JSON
- `node scripts/wrongnote.js pick --count <N> [--exclude-sources <a,b,c>]`
  - `stage` 오름차순 → `lastSeenDate` 오름차순 정렬 후 상위 N개
  - 각 항목에 `sourceAbsolutePath`(= `postsDir` + `source`), `sourceExists` 포함
  - `wrongnotes.json`이 없거나 비어 있으면 빈 배열 반환 (정상 상태, 에러 아님)

두 서브커맨드 모두 파일 존재 확인, JSON 파싱/직렬화, 정렬, 경로 조합, ID 발급(`wn-` + 랜덤 hex 8자리)만 하며 LLM을 호출하지 않습니다.

### 2. `.claude/commands/grade.md` 수정

- 1단계 출력(`questions[]`)에 `wrongNoteId`가 추가되므로, 3단계 채점 시 이 값을 그대로 유지해 4단계에서 사용
- 4단계(해답 파일 작성) 이후 5단계로 "오답노트 갱신" 추가:
  - 문항별로 `{ wrongNoteId, source, template, difficulty, concept, questionText, score, judgment }` 구성
    - `concept`은 신규 오답 항목일 때만 필요 — 채점하며 파악한 "무엇을 놓쳤는지"를 한 줄로 요약해 채워 넣음
  - `wrongnote.js record` 호출
  - 결과를 최종 보고에 한 줄 덧붙임 (예: "오답노트: 1문제 신규 등록, 1문제 stage 상승, 1문제 마스터 완료(제거)")

### 3. `.claude/commands/quiz.md` 수정

- 1단계(포스트 수집) 다음에 "오답노트 뽑기" 단계 추가: `wrongnote.js pick` 호출
- 4단계(문제 생성)에서 오답노트로 뽑힌 항목은 새 포스트와 다른 절차를 탑니다:
  - `sourceAbsolutePath` Read
  - `concept`을 중심으로, `recentQuestions`와 겹치지 않는 새로운 질문을 같은 `template`/`difficulty`로 생성
  - 출처 줄 아래 오답노트 배지 삽입 (id, `addedDate`, `reviewCount + 1`)
  - 제목 줄에 `📌 오답노트 (N번째 복습)` 표시
- 새 포스트 문제와 오답노트 문제를 합쳐 quiz.md/answers.md 작성 (기존 형식 유지, 배지만 추가)

### 4. `mallang-quiz.config.json` 신규 필드

```json
{
  "wrongNote": {
    "enabled": true,
    "ratio": 0.2,
    "maxStage": 2
  }
}
```

`ratio`는 `quizCount`에 곱해 오답노트 문제 개수를 정함: `round(quizCount × ratio)`. 예: `quizCount=10`, `ratio=0.2` → 2문제.

### 5. `.gitignore` / 정리 커맨드

- `.quiz-wrongnote/`는 `quiz-output/`과 마찬가지로 **자동 삭제 대상에서 제외**합니다. `/clear-cache`, `/clear-output` 어느 것도 건드리지 않습니다.
- 필요하면 별도 `/clear-wrongnote` 커맨드를 나중에 추가할 수 있으나 1차 구현 범위는 아닙니다.

## 남은 세부 구현 메모

큰 방향은 확정됐고, 구현하면서 자연스럽게 정해질 사소한 부분만 남았습니다.

- `wn-` ID 충돌 방지: 랜덤 hex 8자리면 충분하지만, 생성 시 기존 `items`와 중복 체크만 해두면 안전합니다.
- `concept` 품질: `/grade`가 매번 다른 표현으로 요약하면 `recentQuestions`와 함께 봤을 때 변형 문제의 일관성이 떨어질 수 있습니다 — 실제 사용해보며 프롬프트 지침을 다듬을 여지가 있습니다.
- `exclude-sources`: 오답노트 문제와 그날 새로 뽑힌 포스트 문제가 같은 출처를 중복으로 다루지 않도록 하는 보조 옵션이며, 필수는 아닙니다 (겹쳐도 치명적이지 않음).
