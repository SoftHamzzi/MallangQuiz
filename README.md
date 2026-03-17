# 🐑 말랑말랑 퀴즈

마크다운으로 정리한 공부 내용을 AI가 매일 퀴즈로 만들어주는 도구입니다.
블로그 포스트를 오래 기억하기 위한 일일 복습 루틴을 자동화합니다.

## 시작 계기

이펙티브 C++, 게임 서버 프로그래밍, 대학 강의 자료 등을 마크다운으로 열심히 정리해도, 시간이 지나면 잊어버립니다.
AI가 없던 시절에는 퀴즈를 직접 만드는 수고 때문에 일일 루틴으로 만들기 어려웠지만, 지금은 다릅니다.

**말랑말랑 퀴즈**는 내 마크다운 포스트를 기반으로 AI가 매일 퀴즈를 생성해줍니다.

## 동작 방식

```
/quiz 입력
  └→ collect.js 실행 (포스트 스캔 + 랜덤 선택 + 이미지 수집)
       └→ Claude Code가 템플릿 읽기 → 포스트 읽기 → 퀴즈 생성
            └→ quiz-output/{날짜시간}/quiz.md + answers.md 생성
```

- **`collect.js`**: 포스트 디렉터리 탐색, 제외 패턴 적용, 이미지 다운로드 등 기계적인 작업
- **Claude Code**: 템플릿 선택, 포스트 내용 분석, 퀴즈 문제 생성 등 지능적인 작업

## 필수 조건

- [Claude Code](https://claude.ai/code) 설치 및 로그인
- Node.js 18 이상

## 설치

```bash
git clone https://github.com/your-username/MallangQuiz.git
cd MallangQuiz
npm install
```

## 설정

`mallang-quiz.config.json`을 수정합니다.

```json
{
  "postsDir": "/absolute/path/to/your/_posts",
  "outputDir": "./quiz-output",
  "excludePatterns": [
    "drafts/**",
    "*.private.md"
  ],
  "quizCount": 5,
  "language": "ko"
}
```

| 항목 | 설명 | 기본값 |
|------|------|--------|
| `postsDir` | 마크다운 포스트 폴더 절대 경로 | **(필수)** |
| `outputDir` | 퀴즈 결과 저장 폴더 | `./quiz-output` |
| `excludePatterns` | 제외할 파일 패턴 ([.gitignore 형식](https://git-scm.com/docs/gitignore)) | `[]` |
| `quizCount` | 생성할 문제 수 | `5` |
| `language` | 퀴즈 언어 (`ko` / `en`) | `ko` |

## 사용법

Claude Code에서 프로젝트 디렉터리를 열고 슬래시 커맨드를 입력합니다.

```
/quiz
```

## 퀴즈 템플릿

`quiz-templates/` 폴더에 문제 형식 템플릿이 있습니다. AI가 포스트 내용에 맞는 템플릿을 선택하며, 파일을 직접 편집해 형식을 커스터마이즈하거나 새 템플릿 파일을 추가할 수 있습니다.

| 파일 | 문제 형식 |
|------|-----------|
| `short-answer.md` | 주관식 (서술형) |
| `multiple-choice.md` | 객관식 (A/B/C/D) |
| `true-false.md` | OX 퀴즈 |
| `fill-in-the-blank.md` | 빈칸 채우기 |

각 문제에는 **내 풀이/내 선택/내 답** 공간이 포함되어 있어 직접 풀어볼 수 있습니다.

## 출력 결과

실행하면 `quiz-output/` 아래에 날짜+시간 폴더가 생성됩니다.

```
quiz-output/
└── 20260316_143022/
    ├── quiz.md       ← 문제지 (정답 없음, 내 풀이 공간 포함)
    └── answers.md    ← 해답지 (문제 + 정답 + 해설)
```

### quiz.md 예시

```markdown
# 말랑말랑 퀴즈 📝

**날짜:** 2026-03-17
**문제 수:** 5문제

---

## Q1. 🟡 보통

빈칸을 채우시오.

TCP에서 수신 버퍼가 가득 차면 송신 측의 `___`가 블로킹되고,
UDP에서는 초과 데이터가 `___`된다.

> **출처:** `server/game_server/3/2026-02-03-game_server_3_5.md`

**📝 내 답:** (빈칸 수에 맞게 작성하세요)

---

## Q2. 🟢 쉬움

다음 중 유니티/언리얼 엔진에 기본 내장된 네트워크 엔진은?

- A. 프라우드넷
- B. 포톤 서버
- C. 게임 스파크
- D. 락넷

> **출처:** `server/game_server/6/2026-02-18-game_server_6_1.md`

**📝 내 선택:** (  )

---
```

## 이미지 지원

마크다운 내 이미지가 있으면 퀴즈 생성에 함께 활용됩니다.

- 이미지는 `.quiz-cache/images/`에 다운로드되어 AI가 내용을 파악하는 데 사용됩니다.
- 결과 마크다운에서는 원본 URL/경로를 그대로 참조합니다. (로컬 복사 없음)
- 파일명 충돌 방지를 위해 캐시 파일명에 해시 prefix 적용 (`abc123_image.png`)

## 프로젝트 구조

```
MallangQuiz/
├── .claude/
│   └── commands/
│       ├── quiz.md              # /quiz 슬래시 커맨드 정의
│       ├── clear-cache.md       # /clear-cache 슬래시 커맨드
│       └── clear-output.md      # /clear-output 슬래시 커맨드
├── quiz-templates/
│   ├── short-answer.md          # 주관식 템플릿
│   ├── multiple-choice.md       # 객관식 템플릿
│   ├── true-false.md            # OX 퀴즈 템플릿
│   └── fill-in-the-blank.md     # 빈칸 채우기 템플릿
├── scripts/
│   └── collect.js               # 포스트 스캔 + 이미지 수집
├── mallang-quiz.config.json     # 설정 파일
└── package.json
```
