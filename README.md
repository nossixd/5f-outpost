# OUTPOST

Lokalna aplikacja Node.js dla dyspozytorów transportu. Projekt zachowuje JavaScript,
natywne HTTP i PostgreSQL (`pg`); nie używa Express ani frameworka frontendowego.

Monitorowanie floty implementuje FR-01. Historia 3 implementuje również
**zakończenie zlecenia transportowego w ramach FR-01** — nie rejestrację ani zamykanie
zgłoszeń FR-03. Historia 2 obsługuje wykrywanie opóźnień (FR-02).

## Wymagania

- Node.js 22 lub nowszy.
- Tryb demo nie wymaga PostgreSQL.
- Tryb PostgreSQL wymaga serwera PostgreSQL, klienta `psql` i konfiguracji środowiska.

Leaflet nie wymaga klucza ani migracji mapowej. Monitoring PostgreSQL używa tabel
docelowego schematu ERD, który należy przygotować świadomie osobną migracją. Zachowaj
istniejący `.env`; testy migracji poniżej są ograniczone do osobnej bazy `outpost_test`
i nigdy nie uruchamiają migracji na `outpost_db`.

Jeżeli PostgreSQL nie jest zainstalowany, zainstaluj serwer PostgreSQL dla Windows
([instalator Windows](https://www.postgresql.org/download/windows/); wybierz także
Command Line Tools) i port 5432. Po instalacji sprawdź usługę i klienta w PowerShell:

```powershell
Get-Service *postgres*
psql --version
```

Jeśli `psql` nie jest w `PATH`, dodaj katalog `bin` właściwej wersji na czas bieżącej
sesji, np.:

```powershell
$env:Path = "C:\Program Files\PostgreSQL\17\bin;" + $env:Path
```

W razie potrzeby uruchom usługę jako administrator (`Start-Service postgresql-x64-17`;
użyj nazwy zwróconej przez `Get-Service`).

## Uruchomienie demonstracyjne

W terminalu PowerShell w VS Code:

```powershell
npm.cmd ci
$env:DATA_SOURCE = "demo"
npm.cmd start
```

Otwórz http://127.0.0.1:3000. Tryb demo ma cztery przykładowe zlecenia, obsługuje
historię 3 i FR-02. Zmiany demo są zachowane w pamięci do restartu. Dostęp
demonstracyjny do zakończenia transportu działa wyłącznie lokalnie; nie identyfikuje
rzeczywistego użytkownika. Monitoring floty wymaga `DATA_SOURCE=postgres`; w trybie
demo API celowo zwraca informację o braku bazy, zamiast używać tablic przykładowych
w przeglądarce.

## Konfiguracja PostgreSQL w Windows

### 1. Utwórz bazę i użytkownika

Uruchom `psql -U postgres`, a w konsoli PostgreSQL (ustaw własne hasło przez bezpieczny
prompt `\password`, nie zapisuj go w repozytorium):

```sql
CREATE USER outpost_user WITH LOGIN;
\password outpost_user
CREATE DATABASE outpost OWNER outpost_user;
\q
```

Jeśli baza lub użytkownik już istnieją, pomiń ich tworzenie.

### 2. Skonfiguruj zmienne środowiskowe

W katalogu projektu utwórz lokalny plik `.env` na podstawie przykładu i uzupełnij
`DB_PASSWORD`:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Jeżeli `.env` już istnieje, zachowaj jego ustawienia bazy i uzupełnij wyłącznie
brakujące zmienne; nie nadpisuj istniejących danych logowania. Ustaw
`DATA_SOURCE=postgres`, `DB_HOST=127.0.0.1`, `DB_PORT=5432`, nazwę istniejącej bazy,
użytkownika i hasło. `.env` jest ignorowany przez Git; nie dodawaj go do repozytorium.

### 3. Osobna baza testowa i migracja ERD

Nie uruchamiaj migracji 005 na `outpost_db` w ramach testów ani uruchamiania aplikacji.
Najpierw utwórz oddzielną bazę testową:

```powershell
createdb -h 127.0.0.1 -p 5432 -U outpost_user outpost_test
```

W katalogu głównym projektu przygotuj w `outpost_test` legacy schemat, na którym
testowana będzie migracja:

```powershell
psql -h 127.0.0.1 -p 5432 -U outpost_user -d outpost_test -v ON_ERROR_STOP=1 -f src/database/schema.sql
psql -h 127.0.0.1 -p 5432 -U outpost_user -d outpost_test -v ON_ERROR_STOP=1 -f src/database/migrations/003-complete-transport.sql
psql -h 127.0.0.1 -p 5432 -U outpost_user -d outpost_test -v ON_ERROR_STOP=1 -f src/database/migrations/004-fleet-monitoring.sql
```

Migracja 004 wprowadza pięć demonstracyjnych rekordów legacy do bazy testowej.
**Nie kopiuj ani nie uruchamiaj jej ponownie na bazie produkcyjnej z własnymi danymi.**
Ustaw `TEST_DATABASE_URL` w ignorowanym przez Git pliku `.env`, wskazując wyłącznie
dedykowaną bazę `outpost_test` (nie umieszczaj connection stringa w logach ani
repozytorium), po czym uruchom:

```powershell
psql -h 127.0.0.1 -p 5432 -U outpost_user -d outpost_test -v ON_ERROR_STOP=1 -f src/database/migrations/005-erd-schema.sql
npm.cmd test
```

Integracyjny test przed modyfikacją sprawdza, czy nazwa bazy zaczyna się od
`outpost_test`, ponownie uruchamia 005 i weryfikuje zachowanie pięciu pojazdów,
tras, GPS, statusów, decyzji i ETA. Konflikty migracji używają `DO NOTHING`, więc
ponowne uruchomienie nie nadpisuje nowszych danych docelowych starymi. Stare tabele
pozostają zachowane.

Migracja 003 dodaje status zakończenia. Migracja 004 tworzy tabele
`vehicles`, `vehicle_routes`, `vehicle_locations`, powiązania i pięć symulowanych
pojazdów z pozycjami, prędkością, adresem i geometrią trasy. Dane są dodawane przez
`ON CONFLICT DO NOTHING`. Wszystkie pojazdy demo są powiązane ze zleceniami
`TR-001`–`TR-005`; migracja dodaje brakujące `TR-004` i `TR-005` bez zmiany rekordów,
które już istnieją. Pozycje są symulowanymi zapisami bazy, nie danymi fizycznego GPS.

W zakładce „Monitorowanie tras” API `GET /api/vehicles` pobiera pozycję, trasę i aktualny
status zlecenia z docelowych tabel ERD. Tabela pokazuje też ocenę ETA z istniejącej logiki
FR-02. Pozycja starsza niż 30 sekund jest oznaczana jako nieaktualna; nie ma fizycznego
odbiornika ani automatycznego generatora nowych pomiarów.

Lista i liczniki są odświeżane bezpośrednio z tabeli `vehicle`. Każdy aktywny pojazd
pojawia się także bez zlecenia, trasy lub GPS; brak tych danych nie tworzy znacznika
ani fikcyjnego ETA.

W odpowiedzi `GET /api/delays` pole `status` zachowuje dotychczasowe znaczenie oceny
ETA, a `transportStatus` opisuje wykonanie. Odpowiedź PATCH zakończenia zwraca
dodatkowo `order.status=completed` i `order.delayStatus` dla oceny ETA.

### Mapa Leaflet i OpenStreetMap

Widok „Monitorowanie tras” korzysta z pakietu `leaflet@1.9.4` serwowanego lokalnie
z `node_modules` oraz kafelków OpenStreetMap. Żadne klucze Google ani konto billing
nie są wymagane. CSP dopuszcza wyłącznie zasoby własne i kafelki `tile.openstreetmap.org`.

Po kliknięciu pojazdu Leaflet pokazuje jego położenie, zapisane punkty trasy i popup.
Trasa pochodzi z geometrii PostgreSQL i jest oznaczana jako planowana. Projekt nie
wykonuje publicznego routingu drogowego ani nie udaje, że linia jest rzeczywistą
trasą po drogach.

### 4. Uruchom i sprawdź połączenie

Po migracji testowej uruchom aplikację jawnie na `outpost_test`, nie na
`outpost_db`:

```powershell
$env:DB_NAME = "outpost_test"
$env:DATA_SOURCE = "postgres"
npm.cmd start
```

Wartości `DB_HOST`, `DB_PORT`, `DB_USER` i `DB_PASSWORD` pochodzą z lokalnego `.env`;
nie wypisuj ich w terminalu ani logach. Domyślny host aplikacji to `127.0.0.1`, a port
`3000`. Autoryzacja zakończenia transportu pozostaje aktywna; bez skonfigurowanego
autoryzatora endpoint kończenia odpowiada HTTP 403. Integracyjny test używa wyłącznie
testowego autoryzatora i nie zmienia konfiguracji bezpieczeństwa aplikacji.

### 5. Sprawdź dane w bazie testowej

```powershell
psql -h 127.0.0.1 -p 5432 -U outpost_user -d outpost_test -c 'SELECT legacy_vehicle_id, registration_number FROM vehicle ORDER BY vehicle_id;'
psql -h 127.0.0.1 -p 5432 -U outpost_user -d outpost_test -c 'SELECT legacy_order_id, status, eta, decision FROM "order" ORDER BY order_id;'
```

Uruchom aplikację na `outpost_test`, a następnie sprawdź `GET /api/vehicles` i
`GET /api/delays`. Testy integracyjne w `npm.cmd test` dodatkowo potwierdzają update
ETA, kończenie i spójność między tymi endpointami.

## Testy

```powershell
npm.cmd test
node db_test.js
```

Zestaw testów obejmuje logikę FR-02, HTTP i UI, konflikt współbieżny, status i czas
zakończenia, uprawnienia, błędne żądania oraz błąd bazy. Testy integracyjne PostgreSQL
są pomijane, jeżeli `TEST_DATABASE_URL` nie jest ustawiony. Aby je
uruchomić, ustaw `TEST_DATABASE_URL` w lokalnym `.env` na wcześniej przygotowaną
bazę `outpost_test`, a następnie ponownie uruchom `npm.cmd test`. Test zapisuje
wyłącznie rekordy o losowych identyfikatorach `IT-*` i usuwa tylko te rekordy.

Testy floty sprawdzają adapter PostgreSQL, świeżość GPS, aktywny endpoint pojazdów,
obecność kontrol Leaflet oraz brak osobnego widoku i integracji Google. Rzeczywista
migracja 005 wymaga PostgreSQL; test integracyjny jest pomijany bez `TEST_DATABASE_URL`.

## Dokumentacja

- [Specyfikacja i plan historii 3 (FR-01)](specs/003-complete-transport/spec.md),
  [plan](specs/003-complete-transport/plan.md) i
  [zadania](specs/003-complete-transport/tasks.md).
- [Specyfikacja monitorowania floty FR-01](specs/004-fleet-monitoring/spec.md),
  [plan](specs/004-fleet-monitoring/plan.md) i
  [zadania](specs/004-fleet-monitoring/tasks.md).
- [Specyfikacja historii 2 (FR-02)](specs/002-delay-alerts/spec.md).
- [Decyzje architektoniczne](ADR.md), [architektura](docs/architektura.md) i
  [stan realizacji](docs/stan-realizacji.md).
