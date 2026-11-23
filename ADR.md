1. Język programowania

Status: Przyjęty

Kontekst: Należy wybrać język do stworzenia strony internetowej.

Rozwiązania: Javascript

Decyzja: W projekcie wykorzystamy język javascript.

Konsekwencje: W projekcie wykorzystamy język javascript.

2. Framework Javascript

Status: Przyjęty

Kontekst: Do stworzenia projektu wykorzystujemy framework dla języka javascript.

Rozwiązania: Node.js

Decyzja: Framework Node.js nada się do projektu jaki chcemy zrealizować.

Konsekwencje: Projekt powstanie w oparciu o Node.js

3. System baz danych

Status: Przyjęty

Kontekst: Należy wybrać system do zarządzania bazami danych.

Rozwiązania: PostgreSQL

Decyzja: W projekcie wykorzystamy system PostgreSQL.

Konsekwencje: Projektowymi bazami danych będziemy zarządzać przy pomocy systemu PostgreSQL.

4. Moduł mapy

Status: Zaproponowany

Kontekst: Należy wybrać moduł do wyświetlania mapy ulic.

Rozwiązania: Leaflet

Decyzja: -

Konsekwencje: -

## ADR-005: Realizacja FR-02 jako niewielkiej aplikacji HTTP

Status: Przyjęty dla prototypu historii 2.

Kontekst: Repozytorium zawiera Node.js i sterownik PostgreSQL, ale nie ma interfejsu
ani integracji z dostawcą ETA. Prezentacja wymaga jednej działającej historii.

Decyzja: Natywny serwer HTTP Node.js, interfejs HTML/CSS/JavaScript oraz oddzielna,
czysta funkcja oceny ryzyka. Zachowujemy JavaScript zgodnie z ADR-001. TypeScript
wymieniony w specyfikacji pozostaje rozbieżnością do uzgodnienia przez zespół.

Alternatywy: Framework serwerowy lub SPA zwiększyłyby liczbę zależności bez potrzeby
wynikającej z tej historii.

Konsekwencje: Demo działa bez instalacji zależności. Tryb PostgreSQL wymaga `npm ci`
i inicjalizacji tabeli. Brak uwierzytelniania ogranicza zastosowanie do lokalnego demo.

## ADR-006: Ocena ryzyka i powiadomienia wyliczane przy odczycie

Status: Przyjęty dla prototypu; reguła produkcyjnego progu do uzgodnienia.

Kontekst: Slajd 18 wymaga przekroczenia ustalonego progu, lecz nie podaje wartości.

Decyzja: Próg jest jawnym parametrem, początkowo 5 minut w demonstracji. Alert powstaje
wyłącznie dla wiarygodnego ETA i prawidłowego planu, gdy różnica przekracza próg.
Powiadomienia są prezentowane w aplikacji, a ich szczegóły po kliknięciu. Wynik oceny
nie jest zapisywany; odświeżenie zastępuje poprzedni zestaw powiadomień.

Konsekwencje: Nie ma historii powiadomień ani dostarczania w tle. Dane ETA dostarcza
adapter demonstracyjny lub tabela PostgreSQL; integracja telematyczna pozostaje do zrobienia.

## ADR-007: Decyzje dyspozytora i ręczna korekta ETA

Status: Przyjęty w rozszerzeniu zleconym przez użytkownika. Zastępuje interaktywny
próg i ograniczenie do odczytu opisane w ADR-006.

Kontekst: Użytkownik usuwa filtr progu i chce trzy alerty z akcjami Zatwierdź,
Odrzuć i Zmień czas.

Decyzja: Próg 5 minut pozostaje wewnętrzną regułą prototypu. Serwer obsługuje
PATCH /api/orders/:id. Zatwierdzenie i odrzucenie zapisują decyzję z czasem, tłumiąc
alert, bez zmiany planu lub statusu transportu. Korekta ETA resetuje decyzję i ponawia
ocenę. Dane lokalne są w pamięci procesu; PostgreSQL przechowuje decyzje i ETA trwale.

Konsekwencje: Odświeżenie strony zachowuje zmiany; restart lokalnego procesu je resetuje.
Przed aktualizacją PostgreSQL należy wykonać idempotentny schema.sql dodający kolumny.

## ADR-008: Odrzucenie prognozy wymaga aktualizacji ETA

Status: Przyjęty na wyraźne zlecenie użytkownika. Doprecyzowuje ADR-007:
odrzucenie prognozy nie oznacza już jedynie wyciszenia alertu.

Decyzja: Zatwierdzenie zachowuje wiarygodne ETA i potwierdzone opóźnienie w tabeli,
obsługując powiadomienie. Odrzucenie ustawia eta_reliable=false i decyzję rejected.
Ocena zwraca stan eta_update_required, bez obliczania opóźnienia, z powiadomieniem
wymagającym nowego ETA. Stare ETA jest widoczne wyłącznie jako odrzucone w szczegółach.
Nie można zatwierdzić niewiarygodnej prognozy przez API (HTTP 409). Edycja ETA czyści
decyzję, przywraca wiarygodność ręcznie podanej prognozy i ponawia ocenę.

Konsekwencje: Odrzucona dostawa pozostaje na liście uwagi do aktualizacji czasu.
Zmiana nie kończy ani nie anuluje transportu. Istniejące rekordy rejected są traktowane
jako niewiarygodne także wtedy, gdy starsza wersja nie zapisała eta_reliable=false.

## ADR-009: Zakończenie transportu i integracja PostgreSQL (FR-01)

Status: Przyjęty dla historii 3.

Kontekst: FR-01 wymaga zakończenia zlecenia przez uprawnionego użytkownika i trwałego
zapisu nowego statusu, ale projekt nie ma systemu logowania.

Decyzja: Zapis wykonania przechowuje się oddzielnie od decyzji ETA w kolumnach
`status`, `completed_at` i opcjonalnie `completed_by`. Migracja dodaje kolumny
idempotentnie, zachowując istniejące rekordy. `PATCH /api/orders/:id/complete`
wykonuje pojedynczy warunkowy `UPDATE ... WHERE status = 'in_progress' RETURNING`;
równoczesna/powtórna próba zwraca HTTP 409, brak rekordu 404. Demo działa lokalnie.
Tryb PostgreSQL odmawia domyślnie, a jawna autoryzacja demonstracyjna działa tylko
z loopback. Identyfikator użytkownika może pochodzić wyłącznie z serwerowego,
zaufanego autoryzatora.

Konsekwencje: Demo przechowuje stan do restartu procesu; PostgreSQL jest trwałym
źródłem prawdy w trybie postgres. Projekt nadal nie ma produkcyjnego uwierzytelniania
ani TLS. `status` zwracany przez istniejący endpoint FR-02 nadal opisuje ocenę ETA;
status realizacji jest zwracany osobno jako `transportStatus`, by zachować zgodność
wsteczną API. Odpowiedź endpointu zakończenia zwraca dodatkowe `order.status` jako
status wykonania i `order.delayStatus` jako ocenę ETA. Sekrety i konfiguracja
połączenia pochodzą ze zmiennych środowiskowych.

## ADR-010: Monitoring floty przez PostgreSQL i Leaflet (FR-01)

Status: Przyjęty dla historii monitorowania floty.

Kontekst: FR-01 wymaga trasy, pozycji, statusu zlecenia i aktualności GPS. Projekt nie
ma fizycznych urządzeń GPS; dane demonstracyjne muszą pozostać trwałe w bazie.

Decyzja: stare tabele `vehicles`, `vehicle_routes`, `vehicle_locations` i
`transport_orders` pozostają w bazie dla zgodności. Migracja 005 dodaje równoległy
schemat ERD, m.in. `company`, `app_user`, `client`, `driver`, `vehicle`, `"order"`,
`order_status_history`, `route`, `gps_location`, `report`, `cost`,
`raw_cost_data` i `external_system`; słowa `USER` oraz `ORDER` są cytowane.
Migracja kopiuje bez kasowania istniejące pojazdy, zlecenia, trasy i pozycje.
Klucze ERD pozostają liczbowe (`serial`/`bigserial`), a stare identyfikatory
tekstowe są przechowywane w `legacy_vehicle_id`, `legacy_order_id`,
`legacy_route_id` i `legacy_location_id`. Ponieważ tabele legacy nie zawierają
wiarygodnych danych firmy, klienta ani kierowcy, migracja nie tworzy fikcyjnych
rekordów tych encji; odpowiadające FK są nullable do czasu dostarczenia danych.
Migracja kopiuje rekordy tylko przy braku konfliktu, aby jej ponowne uruchomienie
nie nadpisało późniejszych zmian w schemacie docelowym.

`GET /api/vehicles` odczytuje dane z nowych tabel ERD, najnowszą pozycję, zlecenie i
ETA z PostgreSQL, a ocenę opóźnienia oblicza przez istniejącą funkcję FR-02.
W trybie demo endpoint floty jawnie zwraca 503, zamiast pozorować trwałe dane.
Wiek GPS powyżej 30 sekund oznacza pozycję nieaktualną.

Mapa w zakładce „Monitorowanie tras” używa Leaflet 1.9.4 i kafelków OpenStreetMap.
Znaczniki, popupy, polilinie, feature group i dopasowanie granic są realizowane po
stronie przeglądarki z danych API. Zapisana geometria jest oznaczana jako planowana;
projekt nie wywołuje usług routingu.

Konsekwencje: nie ma klucza ani billing mapowego. OpenStreetMap i zależność Leaflet
muszą być honorowane zgodnie z ich licencjami i zasadami użycia. Migracja wymaga
konsultacji i kopii zapasowej przed wykonaniem. Współrzędne demonstracyjne nie zastępują
fizycznego GPS ani procesu routingu. Mapę należy walidować ręcznie z rzeczywistą bazą.
