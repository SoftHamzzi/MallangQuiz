# 말랑말랑 퀴즈 📝

**날짜:** 2026-03-18
**문제 수:** 5문제

---

## Q1. 🟡 보통

다음 중 C++의 public 상속에 관한 설명으로 **올바른** 것은?

- A. `Square`가 `Rectangle`을 public 상속하면, `Rectangle`의 모든 동작이 `Square`에도 그대로 적용 가능하다.
- B. 펭귄(`Penguin`)이 새(`Bird`)를 public 상속할 때, `fly()` 함수를 오버라이드해서 런타임 에러를 던지는 것이 올바른 설계다.
- C. `Student`가 `Person`을 public 상속하면, `Person`을 인자로 받는 함수에 `Student` 객체를 전달할 수 있다.
- D. 수학적으로 is-a 관계가 성립하면 C++ public 상속으로 표현하는 것이 항상 옳다.

> **출처:** `game_dev/cpp/chapter6/2025-10-18-cpp_6_32.md`

**📝 내 선택:** (  )

---

## Q2. 🟢 쉬움

빈칸을 채우시오.

아래 코드는 `AtomicExchange`를 사용한다. 연산이 완료된 후 변수 `r`과 `a`의 값을 각각 빈칸에 채우시오.

```cpp
volatile int a = 3;
int r = AtomicExchange(&a, 10);
// 연산 후: r == ①___, a == ②___
```

> **출처:** `server/game_server/1/2025-06-19-game_server_1_15.md`

**📝 내 답:** (빈칸 수에 맞게 작성하세요)

---

## Q3. 🔴 어려움

아래 팩토리 함수 설계의 문제점을 설명하고, `shared_ptr`을 반환하도록 변경했을 때 얻을 수 있는 이점 두 가지를 서술하시오.

```cpp
// 변경 전
Investment* createInvestment();

// 변경 후
shared_ptr<Investment> createInvestment();
```

> **출처:** `game_dev/cpp/chapter4/2025-06-16-cpp_4_18.md`

**📝 내 풀이:**

<풀이를 여기에 작성하세요>

---

## Q4. 🟢 쉬움

다음 명제가 참(O)인지 거짓(X)인지 판단하라.

> C++에서 복합 대입 연산자(`+=`, `-=` 등)는 일반 대입 연산자(`=`)와 달리, `*this`의 참조자를 반환하지 않아도 된다.

> **출처:** `game_dev/cpp/chapter2/2025-05-30-cpp_2_10.md`

**📝 내 답:** O / X

---

## Q5. 🟡 보통

아래는 서버 측 TCP 소켓 프로그래밍의 일반적인 흐름이다. 각 함수의 동작 설명 중 **틀린** 것은?

```cpp
s = socket(TCP);   // 1
s.bind(5959);      // 2
s.listen();        // 3
s2 = s.accept();   // 4
r = s2.recv();     // 5
```

- A. `bind(5959)` — 5959번 포트를 점유 시도하며, 이미 사용 중이라면 실패한다.
- B. `listen()` — 소켓을 리스닝 소켓으로 전환하며, 즉시 리턴된다(블로킹 아님).
- C. `accept()` — 클라이언트가 접속하면 리스닝 소켓(`s`)과 **동일한 포트**를 사용하는 새 소켓을 반환한다.
- D. `recv()` — 수신 버퍼에 데이터가 없으면 데이터가 들어올 때까지 블로킹된다.

> **출처:** `server/game_server/3/2026-02-03-game_server_3_4.md`

**📝 내 선택:** (  )

---
