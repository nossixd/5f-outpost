# Architektura 4+1 — prototyp FR-02

## +1: przypadki użycia

Wymagania ogólne: `specs/001-transport-dispatch/spec.md` i diagramy przypadków użycia
w `docs/`. Implementowana historia: slajd 18 oraz `specs/002-delay-alerts/spec.md`.
Dokument przedstawia wyłącznie zaimplementowany wycinek systemu.

Aktualizacja: ADR-007 rozszerza historię o decyzje i ręczną zmianę ETA. Próg 5 minut
jest regułą serwera, bez ustawienia w przeglądarce. PATCH /api/orders/:id przyjmuje
action (approve/reject/reschedule) i opcjonalne eta. Magazyn zapisuje decyzję i czas
lub aktualizuje ETA oraz czyści poprzednią decyzję. Następuje ponowna ocena
i zwrot aktualnej listy. Lokalny magazyn jest w pamięci procesu; PostgreSQL jest trwały.

## Widok deweloperski: struktura

Moduły: przeglądarka (`public/`), serwer HTTP (`src/server.js`), logika oceny
(`src/delays.js`), adapter danych (`src/orders.js`), PostgreSQL (`src/database/`).
Poniżej źródło UML Component Diagram do renderowania w PlantUML.

```plantuml
@startuml
actor Dyspozytor
component "Przeglądarka HTML/JS" as UI
component "Serwer HTTP" as API
component "Ocena ryzyka" as Risk
component "Adapter zleceń" as Adapter
database "PostgreSQL (opcjonalne)" as DB
component "Dane demonstracyjne" as Demo
Dyspozytor --> UI
UI --> API : GET /api/delays
API --> Risk : evaluateDelay
API --> Adapter : loadOrders
Adapter --> DB : SELECT / UPDATE
Adapter --> Demo : tryb demo
@enduml
```

## Widok procesu: UML Sequence Diagram

```plantuml
@startuml
actor Dyspozytor
participant "Przeglądarka" as UI
participant "Serwer HTTP" as API
participant "Adapter danych" as Data
participant "Ocena ryzyka" as Risk
Dyspozytor -> UI : Odśwież dane
UI -> API : GET /api/delays
API -> Data : loadOrders()
Data --> API : zlecenia z planem i ETA
loop każde zlecenie
API -> Risk : evaluateDelay(zlecenie, próg)
Risk --> API : status + powiadomienie lub brak danych
end
API --> UI : JSON
UI --> Dyspozytor : lista i powiadomienia
Dyspozytor -> UI : otwórz powiadomienie
UI --> Dyspozytor : plan, ETA, opóźnienie, zlecenie
@enduml
```

## Widok procesu: UML Communication Diagram

```plantuml
@startuml
left to right direction
object "dyspozytor : Użytkownik" as User
object "widok : Przeglądarka" as UI
object "api : SerwerHTTP" as API
object "źródło : AdapterDanych" as Data
object "ocena : OcenaRyzyka" as Risk
User --> UI : 1: odśwież()
UI --> API : 1.1: GET /api/delays
API --> Data : 1.2: loadOrders()
Data --> API : 1.3: zlecenia
API --> Risk : 1.4*: evaluateDelay()
Risk --> API : 1.5*: wynik
API --> UI : 1.6: JSON
User --> UI : 2: otwórz alert
UI --> User : 2.1: szczegóły
@enduml
```

## Model danych: ERD

Jeden byt przechowywany w PostgreSQL w zakresie tej historii. Ocena i powiadomienie
są obiektami wyliczanymi przy odczycie, bez osobnych tabel i relacji.

```mermaid
erDiagram
    TRANSPORT_ORDERS {
        text id PK
        text route
        timestamptz planned_at "opcjonalny"
        timestamptz eta "opcjonalne"
        boolean eta_reliable
        text decision "approved / rejected / NULL"
        timestamptz decision_at "opcjonalny"
    }
```

## Przepływ danych: DFD, poziom 1

```mermaid
flowchart LR
    U[Dyspozytor] -->|żądanie odczytu| P1((1. Pobranie zleceń))
    D[(PostgreSQL lub zbiór demo)] -->|plan, ETA, wiarygodność| P1
    P1 -->|zlecenia i próg| P2((2. Ocena ryzyka))
    P2 -->|status, opóźnienie, powiadomienia| P3((3. Prezentacja))
    U -->|wybór alertu| P3
    P3 -->|lista i szczegóły lub informacja o braku danych| U
```

## Widok fizyczny

Lokalna przeglądarka komunikuje się z jednym procesem Node.js na 127.0.0.1:3000.
Opcjonalnie proces łączy się z PostgreSQL. Nie skonfigurowano środowiska produkcyjnego,
reverse proxy, TLS ani zewnętrznego dostawcy ETA.


## Aktualizacja procesu: decyzja lub zmiana czasu

```plantuml
@startuml
actor Dyspozytor
participant "Przeglądarka" as UI
participant "Serwer HTTP" as API
participant "Magazyn zleceń" as Store
participant "Ocena ryzyka" as Risk
Dyspozytor -> UI : Zatwierdź / Odrzuć / Zapisz czas
UI -> API : PATCH /api/orders/:id (JSON)
API -> API : walidacja akcji i ETA
API -> Store : update(id, action, eta)
Store --> API : zapisano / brak zlecenia
API -> Store : list()
Store --> API : aktualne dane
API -> Risk : evaluateDelay(zlecenia, 5)
Risk --> API : ocena i aktywne alerty
API --> UI : JSON / błąd
UI --> Dyspozytor : odświeżona lista i tabela / komunikat błędu
@enduml
```

## Rozróżnienie decyzji (ADR-008)

Zatwierdzenie pozostawia wiarygodną prognozę i potwierdzone opóźnienie, usuwając
powiadomienie z kolejki uwagi. Odrzucenie zapisuje eta_reliable=false i decision=rejected;
ocena zwraca eta_update_required oraz powiadomienie o koniecznej korekcie. W tym stanie
opóźnienie ma wartość null, nie jest obliczane z odrzuconego czasu. PATCH approve
z niewiarygodnym ETA zwraca 409. Reschedule zapisuje nowe ETA, przywraca wiarygodność,
czyści decyzję i ponawia ocenę. Dotyczy magazynu w pamięci oraz PostgreSQL.
