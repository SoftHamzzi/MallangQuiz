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
  └→ collect.js 실행 (포스트 스캔 + 이미지 수집)
       └→ Claude Code가 포스트 선택 → 파일 읽기 → 퀴즈 생성
            └→ quiz-output/{날짜시간}/quiz.md + answers.md 생성
```

- **`collect.js`**: 포스트 디렉터리 탐색, 제외 패턴 적용, 이미지 다운로드 등 기계적인 작업
- **Claude Code**: 포스트 선택, 내용 분석, 퀴즈 문제 생성 등 지능적인 작업

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

## 출력 결과

실행하면 `quiz-output/` 아래에 날짜+시간 폴더가 생성됩니다.

```
quiz-output/
└── 20260316_143022/
    ├── quiz.md       ← 문제지 (정답 없음)
    └── answers.md    ← 해답지 (문제 + 정답)
```

### quiz.md 예시

```markdown
# 말랑말랑 퀴즈 📝

**날짜:** 2026년 3월 16일 월요일
**문제 수:** 5문제

---

## Q1. 🟡 보통

템플릿과 제네릭의 차이점은 무엇인가요?

> **출처:** `effective-cpp/2024-01-15-item1.md`

---

## Q2. 🔴 어려움

IOCP에서 Completion Port가 스레드 풀과 연동되는 방식을 설명하세요.

> **출처:** `game-server/2024-03-10-iocp.md`

---

## Q3. 🟢 쉬움

...
```

### answers.md 예시

```markdown
# 말랑말랑 퀴즈 — 해답지 ✅

**날짜:** 2026년 3월 16일 월요일
**문제 수:** 5문제

---

## Q1. 🟡 보통

**문제:** 템플릿과 제네릭의 차이점은 무엇인가요?

**정답:**

C++ 템플릿은 컴파일 타임에 코드가 생성되며 ...

> **출처:** `effective-cpp/2024-01-15-item1.md`

---

## Q2. 🔴 어려움

**문제:** IOCP에서 Completion Port가 스레드 풀과 연동되는 방식을 설명하세요.

**정답:**

IOCP는 커널 오브젝트인 Completion Port를 통해 ...

> **출처:** `game-server/2024-03-10-iocp.md`
```

## 이미지 지원

마크다운 내 이미지가 있으면 퀴즈 생성에 함께 활용됩니다.
이미지 수집은 선택된 포스트에 대해서만 실행되므로 불필요한 다운로드가 없습니다.

- **로컬 이미지**: 절대 경로로 변환 후 출력 폴더의 `images/`로 복사
- **외부 URL 이미지**: `.quiz-cache/images/`에 다운로드 후 출력 폴더의 `images/`로 복사
- 결과 마크다운에서는 항상 `![alt](images/파일명)` 상대 경로로 참조
- 파일명 충돌 방지를 위해 모든 이미지에 해시 prefix 적용 (`abc123_image.png`)

## 프로젝트 구조

```
MallangQuiz/
├── .claude/
│   └── commands/
│       └── quiz.md              # /quiz 슬래시 커맨드 정의
├── scripts/
│   ├── collect.js               # 포스트 목록 스캔 (경량, 이미지 다운로드 없음)
│   └── fetch-images.js          # 선택된 포스트의 이미지만 수집
├── mallang-quiz.config.json     # 설정 파일
└── package.json
```
