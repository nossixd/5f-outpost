# Architektura 4+1 — FR-01 i prototyp FR-02

## +1: przypadki użycia

Wymagania ogólne: `specs/001-transport-dispatch/spec.md` i diagramy przypadków użycia
w `docs/`. Implementowana historia: slajd 18 oraz `specs/002-delay-alerts/spec.md`.
Dokument przedstawia wyłącznie zaimplementowany wycinek systemu.

Historia 3 (FR-01) umożliwia uprawnionemu użytkownikowi zakończenie zlecenia. Nie
dotyczy obsługi zgłoszeń FR-03. Zlecenie ma niezależne `transportStatus` w odpowiedzi
aplikacji oraz `status` w PostgreSQL (`in_progress` / `completed`), czas `completed_at`
i opcjonalne `completed_by`. Żądanie `PATCH /api/orders/:id/complete` wymaga
potwierdzenia w UI i serwerowej autoryzacji. PostgreSQL zmienia stan atomowo przez
warunkowy UPDATE; restart nie usuwa zapisu. Demo zachowuje zmiany do restartu procesu.
Bez logowania autoryzacja demonstracyjna jest lokalna; w trybie PostgreSQL wymaga
jawnego włączenia i działa tylko na loopback.

Monitoring tras i floty jest jedną zakładką w serwowanej stronie `public/index.html`.
`GET /api/vehicles` pobiera z PostgreSQL aktywne pojazdy, najnowszą lokalizację,
geometrię trasy oraz status i dane ETA powiązanego zlecenia. Stare tabele są zachowane,
a migracja 005 kopiuje je do tabel ERD: `company`, `app_user`, `client`, `driver`,
`vehicle`, `"order"`, `order_status_history`, `route`, `gps_location`, `report`,
`cost`, `raw_cost_data` i `external_system`.

Mapa używa lokalnego Leaflet 1.9.4 i kafelków OpenStreetMap. L.marker pokazuje pojazd,
L.popup jego szczegóły, L.polyline zapisaną geometrię planowaną, a L.featureGroup oraz
fitBounds dobierają widok. „Wszystkie pojazdy” usuwa wybór i dopasowuje granice.
Pomiar starszy niż 30 sekund jest oznaczany jako nieaktualny. Projekt nie wywołuje
routingu drogowego i nie udaje, że planowana linia jest przebiegiem po drogach.

Aktualizacja FR-02: ADR-007 rozszerza historię o decyzje i ręczną zmianę ETA. Próg 5 minut
jest regułą serwera, bez ustawienia w przeglądarce. PATCH /api/orders/:id przyjmuje
action (approve/reject/reschedule) i opcjonalne eta. Magazyn zapisuje decyzję i czas
lub aktualizuje ETA oraz czyści poprzednią decyzję. Następuje ponowna ocena
i zwrot aktualnej listy. Lokalny magazyn jest w pamięci procesu; PostgreSQL jest trwały.
Pole `status` w istniejącym wyniku FR-02 nadal oznacza ocenę ETA; stan realizacji
transportu znajduje się w `transportStatus`. Dodatkowe pole `order` w odpowiedzi
zakończenia udostępnia `status` wykonania i `delayStatus` dla oceny ETA.
Rozdzielenie zachowuje kompatybilność dotychczasowego kontraktu alertów.

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
component "Adapter floty" as Fleet
component "Leaflet JS" as Maps
database "PostgreSQL" as DB
component "Dane demonstracyjne" as Demo
Dyspozytor --> UI
UI --> API : GET /api/delays
API --> Risk : evaluateDelay
API --> Adapter : loadOrders
Adapter --> DB : SELECT / warunkowy UPDATE
Adapter --> Demo : tryb demo
UI --> API : GET /api/vehicles
API --> Fleet : listVehicles
Fleet --> DB : SELECT pozycje, trasy, zlecenia
UI --> Maps : Markery, popupy i polilinie
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

### Monitorowanie floty

```plantuml
@startuml
actor Dyspozytor
participant "Przeglądarka" as UI
participant "Serwer HTTP" as API
participant "Adapter floty" as Fleet
database PostgreSQL as DB
participant "Leaflet JS" as Maps
Dyspozytor -> UI : wybiera Monitoring floty
UI -> API : GET /api/vehicles
API -> Fleet : list()
Fleet -> DB : SELECT pojazdy + ostatnia pozycja + trasa + zlecenie
DB --> Fleet : rekordy z PostgreSQL
Fleet -> Fleet : wiek GPS i ocena ETA FR-02
Fleet --> API : dane pojazdów, tras i statusów
API --> UI : JSON
UI -> Maps : znaczniki pojazdów
Dyspozytor -> UI : klika znacznik
UI -> Maps : polilinia zapisanej geometrii trasy
UI --> Dyspozytor : trasa, prędkość, adres, status, czas GPS
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

Byty PostgreSQL obejmują istniejące zlecenia, pojazdy, przypisane trasy i historię
pozycji. Ocena ryzyka ETA pozostaje wyliczana przy odczycie.

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
        text status "in_progress / completed"
        timestamptz completed_at "opcjonalny"
        text completed_by "opcjonalny; zaufany kontekst"
    }
    VEHICLES {
        text id PK
        text registration UK
        text model
        boolean active
    }
    VEHICLE_ROUTES {
        text id PK
        text vehicle_id FK
        text order_id FK
        text name
        jsonb coordinates
        boolean active
    }
    VEHICLE_LOCATIONS {
        text id PK
        text vehicle_id FK
        text route_id FK
        text street
        text city
        text country
        double latitude
        double longitude
        numeric speed_kmh
        timestamptz updated_at
    }
    VEHICLES ||--o{ VEHICLE_ROUTES : has
    TRANSPORT_ORDERS ||--o{ VEHICLE_ROUTES : serves
    VEHICLE_ROUTES ||--o{ VEHICLE_LOCATIONS : records
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
    U -->|wybór Monitoring floty| F1((4. Pobranie floty))
    D -->|pozycje, geometria, pojazdy, zlecenia| F1
    F1 -->|wiek GPS i ocena ETA FR-02| F2((5. Ocena i prezentacja floty))
    F2 -->|pozycja, status, trasa, świeżość| U
    U -->|wybór pojazdu| F3((6. Mapa i polilinia))
    F3 -->|Leaflet i OpenStreetMap| U
```

## Zakończenie zlecenia: przebieg i współbieżność

```plantuml
@startuml
actor "Uprawniony użytkownik" as User
participant "Przeglądarka" as UI
participant "Serwer HTTP" as API
participant "Autoryzator serwera" as Auth
participant "Adapter zleceń" as Store
database PostgreSQL as DB
User -> UI : wybiera Zakończ transport
UI -> User : prośba o potwierdzenie
User -> UI : potwierdza
UI -> API : PATCH /api/orders/:id/complete
API -> Auth : authorizeCompletion(request)
Auth --> API : zaufany principal / odmowa
API -> Store : complete(id, principal.userId)
Store -> DB : UPDATE ... WHERE status='in_progress' RETURNING
DB --> Store : zaktualizowany rekord / brak wiersza
Store --> API : zakończono / konflikt / brak zlecenia
API --> UI : aktualny transport / 403 / 404 / 409 / 503
UI --> User : status i czas / czytelny błąd
@enduml
```

Warunek statusu w pojedynczym UPDATE jest punktem synchronizacji: tylko jedno
współbieżne żądanie może zmienić rekord. Próba kolejna odczytuje istniejący rekord
i zwraca konflikt, nie nadpisując pierwotnego czasu.

## Widok fizyczny

Lokalna przeglądarka komunikuje się z jednym procesem Node.js na 127.0.0.1:3000.
W trybie demo proces korzysta z pamięci dla alertów i zakończenia; widok floty wymaga
trybu postgres i istniejącego poola `pg`. Leaflet i OpenStreetMap są ładowane bez
klucza Google. Routing drogowy nie jest skonfigurowany. Nie skonfigurowano środowiska
produkcyjnego, reverse proxy, TLS ani fizycznego dostawcy GPS/ETA.


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
