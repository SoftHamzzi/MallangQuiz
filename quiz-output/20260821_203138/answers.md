# 말랑말랑 퀴즈 — 해답지 ✅

**날짜:** 2026-08-21
**문제 수:** 5문제

---

## Q1. 🔴 어려움

**문제:** `AGameMode`에서 `NotifyBeginPlay()`가 호출되는 지점이 두 곳인 이유와 조건별 실행 경로를 설명하고, `Super::` 호출 이전에 `SpawnLoot()`를 도는 `AEPGameMode::HandleMatchHasStarted()`의 잠복 위험을 설명하시오.

```cpp
// 엔진 GameMode.cpp:148-161
void AGameMode::HandleMatchIsWaitingToStart()
{
    ...
    if (!ReadyToStartMatch())
    {
        GetWorldSettings()->NotifyBeginPlay();       // ①
    }
}

// 엔진 GameMode.cpp:203-221
void AGameMode::HandleMatchHasStarted()
{
    ...
    GetWorldSettings()->NotifyBeginPlay();           // ②
}
```

```cpp
void AEPGameMode::HandleMatchHasStarted()
{
    for (TActorIterator<AEPItemSpawner> It(GetWorld()); It; ++It)
        It->SpawnLoot();                 // ← Super 호출 이전

    Super::HandleMatchHasStarted();      // ← 여기서 NotifyBeginPlay()
    ...
}
```

**정답:**

**(1) `BeginPlay` 지점이 두 곳인 이유**

핵심은 엔진 주석 그대로다. **"대기가 발생하면 대기 시작 시점에, 대기 없이 바로 시작하면 매치 시작 시점에"** `BeginPlay`를 쏜다. 어느 경로든 **정확히 한 번만** 불리게 하려는 구조다.

갈림길은 `HandleMatchIsWaitingToStart()` 안의 `if (!ReadyToStartMatch())`다.

| `ReadyToStartMatch()` 최초 결과 | 의미 | `BeginPlay` 시점 |
| --- | --- | --- |
| **거짓** | 인원이 모자라 대기해야 함 | ① `HandleMatchIsWaitingToStart` |
| **참** | 조건 충족, 곧바로 시작 | ② `HandleMatchHasStarted` |

즉 `WaitingToStart`에서 실제로 **머무를 예정이면** 그 자리에서 먼저 `BeginPlay`를 돌려주고(액터들이 대기 중에도 정상 동작해야 하므로), 곧바로 `InProgress`로 넘어갈 거라면 굳이 여기서 쏘지 않고 `HandleMatchHasStarted`에 맡긴다.

`MinPlayersToStart`를 걸어 최소 인원을 요구하는 프로젝트라면 보통 **①번 경로**를 탄다. 그래서 **매치가 시작될 무렵에는 `BeginPlay`가 이미 끝나 있다.**

**(2) 잠복 위험**

문제는 **`SpawnLoot()`가 `Super::HandleMatchHasStarted()`보다 먼저 호출된다**는 점이다. `NotifyBeginPlay()`는 그 `Super::` 안에 있으므로, **②번 경로에서는 `SpawnLoot()`가 액터의 `BeginPlay`보다 먼저 돈다.**

```
① 경로 (인원 대기 O): BeginPlay(대기 시점) → ... → SpawnLoot() → Super::  ✅ 안전
② 경로 (즉시 시작)  : SpawnLoot() → Super:: → BeginPlay                  ⚠️ 역전
```

지금 안전한 이유는 **`AEPItemSpawner`에 `BeginPlay` 오버라이드가 없기 때문**이다. 초기화할 게 없으니 순서가 뒤집혀도 티가 나지 않는다.

따라서 실제 버그가 되는 조건은 **두 가지가 겹칠 때**다.

1. `AEPItemSpawner`가 `BeginPlay`에서 무언가를 초기화하도록 바뀌고 (예: 스폰 테이블 캐싱, 풀 준비)
2. `ReadyToStartMatch()`가 처음부터 참이 되는 상황 (즉시 시작 — 최소 인원 조건을 없애거나, 이미 인원이 다 찬 상태로 맵에 진입)

이때 **초기화되지 않은 상태에서 `SpawnLoot()`가 도는** 버그가 된다. 게다가 ①번 경로에서는 재현되지 않으므로 **특정 조건에서만 터지는 형태**라 더 까다롭다.

해결은 간단하다. `Super::HandleMatchHasStarted()`를 **먼저** 호출한 뒤 `SpawnLoot()`를 돌리면 두 경로 모두에서 `BeginPlay`가 앞선다.

> **보충 — `WaitingToStart`에 Pawn이 없는 이유**
>
> 같은 상태머신에서 헷갈리기 쉬운 지점이다. 접속 시 `HandleStartingNewPlayer` → `RestartPlayer` 경로를 타는데, 여기서 막힌다.
>
> ```cpp
> bool AGameMode::PlayerCanRestart_Implementation(APlayerController* Player)
> {
>     if (!IsMatchInProgress())
>     {
>         return false;                    // ← WaitingToStart면 여기서 끝
>     }
>     return Super::PlayerCanRestart_Implementation(Player);
> }
> ```
>
> 그래서 대기 중에 들어온 플레이어는 **PlayerController만 있고 Pawn이 없다.** `HandleMatchHasStarted`가 전원을 순회하며 `RestartPlayer`를 부르는 것도 이 때문이다.

> **출처:** `game_dev/devlog/2026-02-08-EP_Gameplay_Framework-3.md`

---

## Q2. 🟡 보통

**문제:** 분산 처리가 없는 단일 게임 서버에 동시접속자 수가 계속 늘어날 때 각 구성 요소에서 벌어지는 일에 대한 설명으로 가장 올바른 것은?

- A. 32비트 서버는 물리 메모리보다 많은 메모리를 할당해 대량의 메모리 스와핑이 발생하고, 64비트 서버는 `malloc()`이 null을 반환하며 비정상 종료한다.
- B. 서버의 CPU/RAM 사용량이 늘어나는 것은 메시지 수신 속도가 처리 속도를 앞지르고 요청 발생 속도가 송신 속도를 앞지르기 때문이며, 네트워크 기기 쪽에서는 라우터 과부하로 패킷이 유실되고 TCP 재전송 타임아웃으로 연결이 해제된다.
- C. 클라이언트가 겪는 증상은 메시지 응답 지연과 접속 지연뿐이며, 이미 맺어진 TCP 연결 자체는 끊기지 않는다.
- D. 데이터베이스는 질의 수가 디스크 최대 처리 속도를 넘지 않는 한 메모리 사용량이 늘어나지 않으므로 병목이 되지 않는다.

**정답: B**

**해설:**

과부하는 **서버 · 클라이언트 · DB · 네트워크 기기** 네 군데에서 동시에 드러난다.

- **B (정답):** 서버 자원 사용량이 늘어나는 메커니즘이 정확하다. **수신 속도 > 처리 속도**, **요청 발생 속도 > 송신 속도**가 되면 처리하지 못한 메시지가 쌓이면서 CPU와 RAM을 함께 갉아먹는다. 네트워크 기기 쪽 설명도 맞다. **라우터 과부하 → 패킷 유실 → TCP 재전송 타임아웃 → 연결 해제**로 이어지고, TCP 소켓에서는 `ECONNABORTED` 오류가 뜬다.
- **A (오답):** **32비트와 64비트가 뒤바뀌었다.** 32비트 서버는 주소 공간 한계 때문에 `malloc()`이 **null을 리턴하고 비정상 종료**한다. 64비트 서버는 주소 공간이 넉넉해서 곧장 죽지 않는 대신, ① 물리 메모리보다 많이 할당하고 → ② 대량 **메모리 스와핑**이 발생하고 → ③ 실행 속도가 떨어지면서 할당량이 더 늘고 → ④ 결국 메모리 할당 함수에서 문제가 터진다. **죽는 방식이 다르다는 게 요점이다.**
- **C (오답):** 응답 지연과 접속 지연에서 끝나지 않는다. **연결이 돌발적으로 해제된다.** 원인은 **TCP 재전송 타임아웃**과 **사용자 정의 킵얼라이브 메시징 타임아웃**이며, 접속 실패로 인한 타임아웃도 발생한다.
- **D (오답):** 인과가 반대로 서술됐다. DB에서도 **질의 수가 디스크 최대 처리 속도를 넘지 못하면서** 처리 대기가 쌓이고, 그 결과 **메모리 사용량이 증가**해 메모리 할당 함수에서 문제가 발생한다.

> **출처:** `server/game_server/9/2026-03-17-game_server_9_2.md`

---

## Q3. 🟢 쉬움

**문제:** 빈칸을 채우시오.

- **동기 분산 처리**: ① `___` 법칙이 심하게 작용한다.
- **데이터 복제 기반 분산 처리**: ② `___`이(가) 깨진다.

기능 단위로 서버를 따로 두는 방식을 기능적 분산 처리 또는 ③ `___` 분산 처리라고 부른다.

**정답:**

① 암달(Amdahl)
② 데이터 일관성
③ 수직

**해설:**

수평 분산 처리로 해결되지 않는 경우가 세 가지 있다.

| 방식 | 한계 |
| --- | --- |
| 동기 분산 처리 | **암달의 법칙**이 심하게 작용 |
| 비동기 분산 처리 | 요청과 응답을 주고받아야 함 |
| 데이터 복제 기반 분산 처리 | **데이터 일관성**이 깨짐 |

이럴 때 쓰는 것이 **기능적 분산 처리 = 수직 분산 처리**다. 같은 일을 하는 서버를 여러 대 늘리는(수평) 대신, **경매장 서버 · 채팅 서버**처럼 기능별로 서버를 나눈다.

```
클라이언트 ─┬─ 게임 서버 ─┬─ 경매장 서버
            └─ 채팅 서버   │
                 게임 서버 ─┘
```

경매장은 모든 플레이어가 같은 매물 목록을 봐야 해서 데이터를 쪼개거나 복제하기 어렵다. 그래서 **경매장 기능만 담당하는 서버 한 대**를 두고 게임 서버들이 거기에 붙는 식으로 푼다.

다만 **수평 분산 처리보다 분산 효율성이 떨어지므로 최후의 수단**으로 본다. 기능 단위로 나누는 것이라 나눌 수 있는 조각의 수가 기능 개수만큼으로 제한되고, 특정 기능에 부하가 몰리면 그 서버가 그대로 병목이 되기 때문이다.

> **출처:** `server/game_server/9/2026-03-20-game_server_9_8.md`

---

## Q4. 🔴 어려움

**문제:** 다음 명제가 참(O)인지 거짓(X)인지 판단하라.

> ```cpp
> typedef std::string AddressLines[4];
> std::string* pal = new AddressLines;
> delete pal;
> ```
>
> `new`를 호출할 때 `[]`를 쓰지 않았으므로, 해제도 `[]` 없이 `delete pal;`로 하는 것이 new와 delete의 형태를 맞춘 올바른 코드다.

**정답: X**

**해설:**

**`[]`가 눈에 보이느냐가 아니라, 실제로 배열을 할당했느냐가 기준이다.**

`AddressLines`가 `string[4]`의 typedef이므로 `new AddressLines`는 사실상 이것과 같다.

```cpp
std::string* pal = new std::string[4];   // ← new AddressLines의 실체
```

**배열을 할당한 것이므로 반드시 `delete[]`로 해제해야 한다.**

```cpp
delete pal;      // ❌ 정의되지 않은 동작
delete [] pal;   // ✅ 올바름
```

**왜 교차 사용이 안 되는가**

배열을 할당하면 런타임이 **배열 크기 정보까지 함께 저장**한다. `delete[]`가 각 원소의 소멸자를 정확한 횟수만큼 호출하려면 이 정보가 필요하다.

| 인덱스 | 0 | 1 | 2 | ... |
|:---|:---:|:---:|:---:|:---:|
| **배열** | 배열 크기 n | 객체 1 | 객체 2 | ... |
| **단일 객체** | 객체 1 | | | |

메모리 배치 자체가 다르기 때문에 `delete`와 `delete[]`는 **내부 동작이 완전히 다르다.** 배열에 `delete`를 쓰면 첫 번째 객체만 소멸되고 나머지 원소의 소멸자는 호출되지 않아 **정의되지 않은 동작**이 된다.

**이 문제의 진짜 함정**

`typedef`가 **배열이라는 사실을 감췄다는 것**이다. `new AddressLines`라는 표기에는 `[]`가 없어서 단일 객체처럼 보인다. 그래서 결론은 이렇다.

> **배열 타입을 `typedef`로 감추는 것은 피하는 것이 좋다.**

애초에 이런 실수가 불가능한 대안을 쓰는 편이 낫다.

```cpp
std::vector<std::string> pal(4);
```

해제가 자동이고, 생성자·소멸자 호출도 자동이며, 타입에 배열이라는 사실이 그대로 드러난다.

> **출처:** `game_dev/cpp/chapter3/2025-06-12-cpp_3_16.md`

---

## Q5. 🟡 보통

**문제:** 프라우드넷 채팅 서버의 `Chat()` 의사 코드에서 1·2·3번 단계가 하는 일, `CriticalSectionLock`이 필요한 이유, 클라이언트 `FrameMove()`의 역할을 설명하시오.

```cpp
MyGameC2S::Stub::Chat(senderHostID, rmiContext, text) {
    CriticalSectionLock lock(m_critSec, true);

    // 1
    shared_ptr<RemoteClient> sender =
        m_remoteClients.find(senderHostID).second;

    // 2
    vector<HostID> sendTo;
    for(auto r : m_remoteClients) {
        if(r.first != senderHostID)
            sendTo.push_back(r.first);
    }

    // 3
    m_s2cProxy.ShowChat(&r[0], r.size(), sender->m_name, text);
}
```

**정답:**

**(1) 1·2·3번 단계**

전체 흐름은 **클라이언트1이 `Chat()`을 서버로 보내면, 서버가 나머지 클라이언트들에게 `ShowChat()`을 뿌리는** 구조다.

- **1번:** `senderHostID`로 `m_remoteClients`를 조회해 **송신자의 정보를 알아낸다.** 3번에서 `sender->m_name`을 쓰기 위해 필요하다. 클라이언트가 자기 이름을 직접 실어 보내는 게 아니라 **서버가 갖고 있는 목록에서 꺼낸다**는 점이 중요하다.
- **2번:** 접속자 전체를 순회하며 **송신자를 제외한 수신자 목록**을 만든다. `if(r.first != senderHostID)`가 그 역할이다. 보낸 사람에게 자기 메시지를 되돌려 보낼 필요가 없기 때문이다.
- **3번:** 만든 목록을 대상으로 **멀티캐스트**한다. 수신자마다 따로 호출하는 것이 아니라 HostID 배열과 개수를 넘겨 한 번에 보낸다.

**(2) `CriticalSectionLock`이 필요한 이유**

`CNetServer`는 **기본적으로 멀티스레드로 동작**하기 때문이다. (설정에 따라 싱글스레드로 만들 수도 있다.)

그래서 **RMI나 이벤트 함수 호출이 여러 스레드에서 동시에 실행될 수 있다.** `m_remoteClients`는 그 함수들이 공유하는 자료구조다.

```cpp
OnClientJoin(clientInfo)  { ... m_remoteClients.Add(...); }     // 스레드 A
OnClientLeave(clientInfo) { ... m_remoteClients.Remove(...); }  // 스레드 B
Chat(...)                 { ... m_remoteClients 순회 ... }       // 스레드 C
```

보호하지 않으면 **한 스레드가 목록을 순회하는 도중 다른 스레드가 항목을 추가·삭제**할 수 있고, 컨테이너가 깨지거나 무효화된 반복자를 참조하게 된다. 그래서 접속·퇴장 처리와 채팅 처리 **모두** 같은 `m_critSec`으로 잠근다.

**(3) `FrameMove()`의 역할**

클라이언트의 **이벤트 및 수신 처리**를 진행하는 함수다.

```cpp
MainLoop() {
    while(true) {
        m_netClient->FrameMove();   // 네트워크 이벤트·수신 처리
        update_scene();
        render_scene();
    }
}
```

네트워크 처리를 별도 스레드가 알아서 하는 게 아니라, **메인 루프가 매 프레임 직접 호출해 쌓인 것을 꺼내 처리하는 폴링 방식**이다. 이 호출 안에서 `OnJoinServerComplete()`, `OnLeaveServer()`, 그리고 서버가 보낸 `ShowChat()` 같은 RMI 수신 처리가 일어난다.

> 참고로 `OnJoinServerComplete()`(서버 연결 성공/실패)와 `OnLeaveServer()`(연결 중도 해제)는 **직접 구현해야 하는** 이벤트 함수다.

> **출처:** `server/game_server/6/2026-02-27-game_server_6_8.md`

---
