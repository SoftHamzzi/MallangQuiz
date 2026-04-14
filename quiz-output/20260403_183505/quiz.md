# 말랑말랑 퀴즈 📝

**날짜:** 2026-04-03
**문제 수:** 5문제

---

## Q1. 🟢 쉬움

다음 중 관계형 데이터베이스(RDBMS)와 NoSQL의 차이에 대한 설명으로 **옳은** 것은?

- A. RDBMS는 레코드가 트리나 구조체 형태를 가질 수 있어 유연한 스키마 변경에 강하다
- B. RDBMS에서 레코드가 1억 개인 테이블에 새 필드를 추가하면, `null`을 허용하더라도 장시간 시스템이 멈출 수 있다
- C. NoSQL은 리스트·배열 구조만 지원하며, 중첩된 계층형 데이터를 표현할 수 없다
- D. NoSQL은 RDBMS보다 항상 더 빠른 읽기 성능을 보장한다

> **출처:** `server/game_server/8/2026-03-08-game_server_8_1.md`

**📝 내 선택:** (  )

---

## Q2. 🟡 보통

다음 명제가 참(O)인지 거짓(X)인지 판단하라.

> 아래처럼 `clearCache()`, `clearHistory()`, `removeCookies()`를 묶어 일괄 실행하는 기능은, 클래스의 데이터를 직접 다루는 동작이 없더라도 `WebBrowser`의 멤버 함수 `clearEverything()`으로 구현하는 것이 비멤버 함수보다 캡슐화 측면에서 더 바람직하다.
>
> ```cpp
> class WebBrowser {
> public:
>     void clearCache();
>     void clearHistory();
>     void removeCookies();
>
>     void clearEverything(); // clearCache + clearHistory + removeCookies 호출
> };
> ```

> **출처:** `game_dev/cpp/chapter4/2025-06-24-cpp_4_23.md`

**📝 내 답:** O / X

---

## Q3. 🔴 어려움

아래 코드는 메뉴 배경을 교체하는 함수이다.

```cpp
void PrettyMenu::changeBackground(std::istream& imgSrc) {
    lock(&mutex);

    delete bgImage;
    ++imageChanges;
    bgImage = new Image(imgSrc);

    unlock(&mutex);
}
```

1. 이 코드에서 발생할 수 있는 예외 안전성 문제 2가지를 설명하시오.
2. C++ 예외 안전성의 세 가지 보장 수준(기본적인 보장, 강력한 보장, 예외불가 보장)의 차이를 서술하시오.
3. **복사 후 맞바꾸기(copy-and-swap)** 패턴이 위 함수에 어떻게 적용되어 강력한 보장을 달성하는지 설명하시오.

> **출처:** `game_dev/cpp/chapter5/2025-09-14-cpp_5_29.md`

**📝 내 풀이:**

<풀이를 여기에 작성하세요>

---

## Q4. 🟢 쉬움

빈칸을 채우시오.

- ___①은(는) 실행 전 상태로, 코드와 데이터로 구성된 파일이다.
- ___②은(는) ①이 실행되어 메모리에 적재된 상태이며, 코드·데이터 영역 외에 ___③(동적 메모리)과 ___④(함수 호출 기록 및 로컬 변수) 영역이 추가된다.
- 여러 개의 ②가 동시에 실행되는 것을 ___⑤이라 한다.

> **출처:** `server/game_server/1/2025-04-25-game_server_1_1.md`

**📝 내 답:** (빈칸 수에 맞게 작성하세요)

---

## Q5. 🟡 보통

게임 서버 DB를 설계할 때, `Character` 테이블의 `OwnerUserAccountID` 컬럼은 `UserAccount` 테이블의 기본 키(ID)를 참조하는 외래 키이며, **한 유저가 여러 캐릭터를 소유할 수 있다.**

이 컬럼에 설정할 인덱스로 가장 적절한 것은?

- A. 기본 키(Primary Key) — 값이 유일해야 하고 NULL을 허용하지 않는다
- B. 유니크 인덱스(Unique Index) — 중복 값을 허용하지 않는 인덱스
- C. 논유니크 인덱스(Non-unique Index) — 중복 값을 허용하면서 검색 속도를 높이는 인덱스
- D. 인덱스 없음 — 외래 키 컬럼에는 별도 인덱스가 필요 없다

> **출처:** `server/game_server/7/2026-03-04-game_server_7_8.md`

**📝 내 선택:** (  )

---
