# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 성격

마크다운 블로그 포스트에서 퀴즈를 생성하고, 사용자가 푼 답안을 채점하는 도구입니다.
**애플리케이션이 아니라 Claude Code 워크플로 자체가 제품입니다.** 실행 주체는 슬래시 커맨드이고, Node 스크립트는 그 보조입니다.

빌드·테스트·린트 설정이 없습니다. `package.json`의 스크립트는 `collect` 하나뿐입니다.

## 명령어

```bash
npm install                                    # 의존성: ignore 하나
npm run collect                                # = node scripts/collect.js
node scripts/prepare-grade.js "<문제지 경로|파일명>"
node scripts/wrongnote.js pick                 # 오답노트에서 재출제할 문제 뽑기
node scripts/wrongnote.js record --input <채점 결과 JSON>  # 오답노트 갱신
```

두 스크립트 모두 **인자 없이 단독 실행 가능**하며, 결과를 stdout에 JSON으로 뱉습니다. 동작을 확인할 때는 슬래시 커맨드를 거치지 말고 스크립트를 직접 돌려 JSON을 보는 편이 빠릅니다.

슬래시 커맨드 (`.claude/commands/`):

| 커맨드 | 역할 |
|---|---|
| `/quiz` | 포스트에서 퀴즈 5문제 생성(+오답노트에서 일부 재출제) → `quiz-output/{YYYYMMDD_HHMMSS}/quiz.md` + `answers.md` |
| `/grade <문제지>` | 풀어 놓은 문제지 채점 → 같은 폴더에 `*_quiz.md` → `*_answer.md` 생성, 오답노트 갱신 |
| `/clear-cache` | `.quiz-cache` 삭제 |
| `/clear-output` | `quiz-output` 삭제 |

## 아키텍처: 2계층 분리

이 저장소의 핵심 설계 원칙입니다. 새 기능을 추가할 때도 이 경계를 지키세요.

```
슬래시 커맨드 (.claude/commands/*.md)  ← 판단: 템플릿 선택, 문제 출제, 채점, 피드백
        │  Bash로 스크립트 실행 → JSON 수신
        ▼
Node 스크립트 (scripts/*.js)           ← 기계적 작업: 파일 탐색, 정규식 파싱, 경로 해석, 다운로드
```

- **스크립트는 LLM을 호출하지 않고, 판단하지 않습니다.** 파일을 찾고 파싱해서 JSON을 넘길 뿐입니다.
- **커맨드는 경로를 직접 조합하지 않습니다.** 스크립트가 준 절대경로를 그대로 씁니다.
- 규약: **stdout = JSON 결과, stderr = 진행 로그.** 커맨드가 stdout만 파싱하므로 진단 메시지를 stdout에 쓰면 안 됩니다.

### 데이터 흐름

```
mallang-quiz.config.json (postsDir → 저장소 외부의 블로그 _posts)
        │
   collect.js ──► 랜덤 포스트 N개 + 이미지 ─┐
   wrongnote.js pick ──► 오답노트 K개 ──────┼─► /quiz가 문제 출제 → quiz-output/{날짜시간}/
                                            │                              │
                                            │            사용자가 quiz.md를 블로그 폴더로 복사해 풀이
                                            │                              ▼
                          prepare-grade.js ──► 문제지 + 원본 answers.md + 출처 문서 매칭 → /grade가 채점 → *_answer.md
                                                                              │
                                                                              ▼
                                                              wrongnote.js record ──► .quiz-wrongnote/wrongnotes.json 갱신
```

`postsDir`은 **이 저장소 밖**(블로그 리포)을 가리킵니다. 문서 내 상대 경로는 항상 `postsDir` 기준으로 해석됩니다.

## 알아야 할 규약

### `> **출처:** \`경로\`` 줄은 장식이 아니라 구조적 키

생성된 문제마다 붙는 출처 줄을 `prepare-grade.js`가 파싱해 두 가지에 씁니다 ([scripts/prepare-grade.js:51](scripts/prepare-grade.js:51)).

1. **원본 해답지 폴더 매칭** — 문제지의 출처 목록과 `quiz-output/*/answers.md`의 출처 목록을 **순서까지 대조**해 짝을 찾습니다. 날짜가 아니라 내용으로 매칭하므로 폴더명이 달라도 동작합니다.
2. **채점 근거 문서 경로** — `postsDir`와 합쳐 절대경로를 만들고, `/grade`가 그 문서들을 읽어 정답 여부를 판단합니다.

**템플릿에서 이 줄의 형식을 바꾸면 `/grade`가 조용히 깨집니다.**

### 템플릿은 코드가 아니라 데이터

`quiz-templates/*.md` 각 파일 = 문제 유형 하나. frontmatter의 `name`/`description`, 본문의 `### 문제지 형식` / `### 해답지 형식` 블록으로 구성됩니다.

`/quiz`가 이 폴더를 **`*.md`로 통째로 glob해서 전부 문제 유형으로 취급**하므로, 문제 유형이 아닌 파일(공통 서식, 부분 조각 등)을 여기 두면 안 됩니다. 유형 무관한 형식은 커맨드 파일 안에 직접 씁니다 — 채점 블록 형식이 `quiz-templates/`가 아니라 `.claude/commands/grade.md`에 있는 이유입니다.

새 문제 유형 추가는 파일 하나 추가로 끝나며, 코드 수정이 필요 없습니다.

### 마크다운 파싱은 코드 펜스를 인지해야 함

퀴즈 본문에 C++ 코드 블록이 들어갑니다. 헤딩이나 출처 줄을 정규식으로 찾을 때 ``` 안쪽 매치를 걸러내지 않으면 오작동합니다. `prepare-grade.js`의 `insideFence()` / `matchesOutsideFence()`가 그 역할을 하며, 새 파서를 쓸 때도 같은 처리가 필요합니다.

### 채점 기준은 `grade.md`에 있음

문제당 10점, 유형별 배점(객관식 10/0, OX 판단 7 + 근거 3, 빈칸은 개수 균등 배분, 서술형은 논점별 부분 점수), 판정 기호(⭕/🔺/❌/⬜), 등급 구간이 전부 [.claude/commands/grade.md](.claude/commands/grade.md)에 서술돼 있습니다. 채점 로직을 바꾸려면 그 파일을 고치면 됩니다.

정답의 기준은 **원본 `answers.md`**, 출처 문서는 "표현만 다른 건지 진짜 틀린 건지"를 가리는 **근거**로 씁니다. 둘의 역할이 다릅니다.

`/grade`는 문제지(`*_quiz.md`)를 절대 수정하지 않습니다. 쓰는 파일은 `*_answer.md` 하나뿐입니다.

### 오답노트: `.quiz-wrongnote/wrongnotes.json`

말해보카식 복습 큐입니다. 자세한 설계 배경은 [docs/wrong-note-plan.md](docs/wrong-note-plan.md) 참고.

- **저장 항목**: 문제/해답 블록 전체가 아니라 `source`(출처), `template`, `difficulty`, `concept`(무엇을 테스트하는지 한 줄 요약), `recentQuestions`(최근 낸 문구, 중복 방지용)만 저장합니다. 재출제할 때마다 `/quiz`가 이 정보를 바탕으로 **매번 새 문구로 변형해서** 다시 출제하기 때문에, 저장해둔 문제 원문 자체는 필요 없습니다.
- **stage 2단계**: `stage 0` → 만점(⭕) → `stage 1` → 또 만점 → **마스터, 삭제**. 만점이 아닌 판정(🔺/❌/⬜)은 언제든 즉시 `stage 0`으로 리셋합니다. 연속 두 번 만점이어야 사라집니다.
- **`> **오답노트:** \`wn-xxxxxxxx\`** 줄**: `> **출처:**` 줄처럼 구조적 키입니다. `prepare-grade.js`가 파싱해 `questions[].wrongNoteId`로 내려주고, `/grade`가 이 ID로 `wrongnote.js record`를 호출해 **정확히 그 항목만** 갱신합니다. 텍스트 유사도 비교 같은 모호한 매칭이 없습니다 — 이 줄 형식을 바꾸면 오답노트 갱신이 조용히 끊깁니다 (출처 줄과 동일한 주의사항).
- **정답 기준은 그대로**: 오답노트 문제도 그날의 `quiz-output/{날짜시간}/`에 일반 문제와 함께 생성되므로, `/grade`의 기존 출처-목록 순서 매칭이 수정 없이 정답 기준 파일을 찾습니다. ID는 오답노트 항목 갱신에만 쓰입니다.
- **`/quiz`가 뽑는 개수**: `mallang-quiz.config.json`의 `wrongNote.ratio`(기본 0.2) × `quizCount`를 반올림. `wrongNote.enabled=false`면 뽑지 않습니다.

### 출력 파일은 Jekyll 포스트

블로그로 옮겨진 문제지에는 Jekyll frontmatter가 붙습니다. `prepare-grade.js`가 `title`의 `... 문제` → `... 해답`만 치환하고 **나머지 줄과 공백을 그대로 보존한** `answerFrontmatter`를 넘겨줍니다. 커맨드는 그걸 그대로 써야 합니다 — 직접 재구성하지 마세요.

## 주의사항

- **`quiz-output/`을 함부로 지우지 마세요.** `/grade`가 원본 `answers.md`를 정답 기준으로 삼습니다. `/clear-output`을 돌리면 이후 채점 정확도가 떨어집니다.
- **`.quiz-wrongnote/`도 함부로 지우지 마세요.** `quiz-output/`과 마찬가지로 `/clear-cache`, `/clear-output` 대상이 아닙니다. 지우면 그동안 쌓인 복습 이력(stage)이 전부 초기화됩니다.
- **`.gitignore`가 비어 있고 `node_modules/`가 커밋되어 있습니다.** 의존성 관련 작업 시 대량 diff가 생길 수 있습니다.
- **`scripts/fetch-images.js`는 현재 쓰이지 않습니다.** `collect.js`가 동일한 이미지 수집 로직(`downloadImage`/`extractImages`/`resolveImage`)을 자체적으로 갖고 있고, 어디서도 `fetch-images.js`를 호출하지 않습니다. 이미지 처리를 고칠 때는 `collect.js` 쪽을 보세요.
- 이미지는 `.quiz-cache/images/`에 해시 prefix를 붙여 받지만, **결과 마크다운에는 원본 URL(`originalSrc`)을 씁니다.** 로컬 캐시 경로를 출력에 넣으면 블로그에서 깨집니다.
- Windows 환경입니다. 스크립트는 경로 구분자를 정규화해 처리하지만(`relativePath`는 `/`로 통일), 셸 명령에서 경로를 다룰 때 주의하세요.
- 사용자 대면 출력(문제·해설·피드백·스크립트 로그)은 전부 한국어입니다.
