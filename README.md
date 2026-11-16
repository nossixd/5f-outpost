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

Integracja mapy nie wymaga migracji ani ponownego seedowania. Dla istniejącej,
działającej bazy zachowaj aktualny `.env` i `DB_NAME=outpost_db`; poniższe polecenia
tworzenia bazy/schematu dotyczą wyłącznie nowej instalacji. Nie wykonuj ich ponownie
na bazie zawierającej dane, aby uruchomić mapę.

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

### 3. Utwórz/zmigruj schemat

Z katalogu głównego projektu wykonaj:

```powershell
psql -h 127.0.0.1 -p 5432 -U outpost_user -d outpost -f src/database/schema.sql
psql -h 127.0.0.1 -p 5432 -U outpost_user -d outpost -f src/database/migrations/003-complete-transport.sql
psql -h 127.0.0.1 -p 5432 -U outpost_user -d outpost -f src/database/migrations/004-fleet-monitoring.sql
```

Schemat i migracje są idempotentne i nie usuwają ani nie nadpisują istniejących
rekordów. Migracja 003 dodaje status zakończenia. Migracja 004 tworzy tabele
`vehicles`, `vehicle_routes`, `vehicle_locations`, powiązania i pięć symulowanych
pojazdów z pozycjami, prędkością, adresem i geometrią trasy. Dane są dodawane przez
`ON CONFLICT DO NOTHING`. Wszystkie pojazdy demo są powiązane ze zleceniami
`TR-001`–`TR-005`; migracja dodaje brakujące `TR-004` i `TR-005` bez zmiany rekordów,
które już istnieją. Pozycje są symulowanymi zapisami bazy, nie danymi fizycznego GPS.

W zakładce „Monitoring floty” API `GET /api/vehicles` łączy pozycję, trasę i aktualny
status zlecenia z PostgreSQL. Tabela pokazuje też ocenę ETA z istniejącej logiki
FR-02. Pozycja starsza niż 30 sekund jest oznaczana jako nieaktualna; nie ma fizycznego
odbiornika ani automatycznego generatora nowych pomiarów.

W odpowiedzi `GET /api/delays` pole `status` zachowuje dotychczasowe znaczenie oceny
ETA, a `transportStatus` opisuje wykonanie. Odpowiedź PATCH zakończenia zwraca
dodatkowo `order.status=completed` i `order.delayStatus` dla oceny ETA.

### Klucz Google Maps

1. W Google Cloud wybierz projekt, włącz billing i otwórz **APIs & Services → Library**.
   Włącz wyłącznie **Maps JavaScript API** dla mapy przeglądarkowej.
2. W **APIs & Services → Credentials** utwórz API key. Ustaw **Application
   restrictions → Websites (HTTP referrers)** i dodaj
   `http://localhost:3000/*` oraz `http://127.0.0.1:3000/*`. W **API restrictions**
   ogranicz klucz do **Maps JavaScript API**. Jeśli używasz innego portu lub domeny,
   dodaj dokładny referrer. Nie commituj klucza.
3. W **Google Maps Platform → Map Management** utwórz [Map ID](https://developers.google.com/maps/documentation/javascript/map-ids/get-map-id)
   (opcjonalnie wybierz styl mapy). Ustaw własny identyfikator jako
   `GOOGLE_MAPS_MAP_ID`; bez niego aplikacja używa `DEMO_MAP_ID`, przeznaczonego do
   testów.
4. W lokalnym `.env` ustaw `GOOGLE_MAPS_API_KEY` i, jeśli masz własny, `GOOGLE_MAPS_MAP_ID`,
   następnie uruchom ponownie aplikację z `DATA_SOURCE=postgres`.

Klucz przeglądarkowy będzie widoczny w żądaniu klienta, dlatego jego ograniczenia są
obowiązkowe. Bez klucza lista pojazdów nadal działa, a mapa pokaże komunikat.

Widok korzysta z aktualnego [`AdvancedMarkerElement`](https://developers.google.com/maps/documentation/javascript/advanced-markers/migration)
i biblioteki `marker`; wymaga Map ID. Domyślne `DEMO_MAP_ID` jest przeznaczone
wyłącznie do testów. Mapa dopasowuje granice do pojazdów, aktualizuje istniejące
znaczniki i wyświetla zapisane wielopunktowe geometrie.

Ładowanie mapy wymaga włączonego billing i może być rozliczane za map loads
(Dynamic Maps); nie dodajemy Places ani innych dodatkowych bibliotek. Przed użyciem
sprawdź [bieżące zasady billing Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/usage-and-billing)
i skonfiguruj alerty budżetowe/limity.

Bez klucza Maps nadal działa lista pojazdów; mapa pokazuje czytelny komunikat. Pozycje
i geometrie tras są pobierane z PostgreSQL. Zapisane geometrie mają kilka punktów i są
wyłącznie uproszczonymi liniami podglądowymi — nie przedstawiają dokładnej drogi.

#### Opcjonalna trasa drogowa (Google Routes API)

Domyślnie aplikacja nie wywołuje Google Routes API. Kliknięcie pojazdu pokazuje trasę
zapisanych punktów. Dopiero jawne użycie przycisku „Wyznacz trasę po drogach” i
potwierdzenie komunikatu uruchamia pojedyncze żądanie Routes API. Wynik jest
wyświetlany w przeglądarce i nie jest zapisywany w PostgreSQL. Używa punktu początkowego,
końcowego i pośrednich punktów zapisanych w `vehicle_routes`.

Routes API wymaga osobnego włączenia **Routes API**, włączonego billing i osobnego
klucza serwerowego `GOOGLE_ROUTES_API_KEY`. Nie używaj klucza przeglądarkowego do tego
celu. Ogranicz klucz Routes do Routes API i adresu IP serwera, ustaw limity/alerty
celu. W Google Cloud włącz **Routes API**, utwórz oddzielny klucz, ogranicz jego
API do Routes i aplikację do IP wyjściowego serwera, następnie zapisz go jako
`GOOGLE_ROUTES_API_KEY` w lokalnym `.env`. Ogranicz dzienny/na minutę quota i ustaw
alert budżetowy; nie udostępniaj klucza klientowi. Żądanie używa podstawowego `DRIVE`
bez danych ruchu i maksymalnie 10 punktów pośrednich. Google rozlicza Compute Routes
według użytych funkcji i bieżącego cennika, a także wymaga billing nawet przy użyciu
w ramach dostępnych progów bezpłatnych. Sprawdź aktualne [zasady użycia i rozliczeń Routes API](https://developers.google.com/maps/documentation/routes/usage-and-billing)
przed włączeniem. Google wyznacza trasę samochodową, która może nie uwzględniać
ograniczeń dla ciężarówek. Nie włączaj tej opcji, jeśli nie akceptujesz kosztu
pojedynczego ręcznie zainicjowanego żądania.

### 4. Uruchom i sprawdź połączenie

```powershell
node db_test.js
$env:DATA_SOURCE = "postgres"
$env:DEMO_COMPLETION_AUTH = "true"
npm.cmd start
```

Domyślny host aplikacji to `127.0.0.1`, a port `3000`. Demonstracyjna autoryzacja
umożliwia lokalne używanie historii bez logowania, ale nie rozpoznaje tożsamości
użytkownika. Działa tylko dla połączeń loopback. Bez `DEMO_COMPLETION_AUTH=true`
tryb PostgreSQL odmawia zakończenia transportu (HTTP 403). **Nie wystawiaj
demonstracyjnej autoryzacji do sieci**; wdrożenie wymaga prawdziwego uwierzytelniania
i serwerowego autoryzatora `authorizeCompletion`. `completed_by` pozostaje NULL,
chyba że autoryzator przekazuje zaufany identyfikator.

### 5. Sprawdź zapis w bazie

Po zakończeniu zlecenia, np. `TR-001`, połącz się z bazą:

```powershell
psql -h 127.0.0.1 -p 5432 -U outpost_user -d outpost -c "SELECT id, status, completed_at, completed_by FROM transport_orders WHERE id = 'TR-001';"
```

Wynik powinien zawierać `completed` i czas `completed_at`. Odświeżenie aplikacji lub
restart procesu w trybie PostgreSQL odczytuje ten sam stan z bazy.

## Testy

```powershell
npm.cmd test
node db_test.js
```

Zestaw testów obejmuje logikę FR-02, HTTP i UI, konflikt współbieżny, status i czas
zakończenia, uprawnienia, błędne żądania oraz błąd bazy. Testy integracyjne PostgreSQL
są pomijane, jeżeli `TEST_DATABASE_URL` nie jest ustawiony. Aby je
uruchomić, dodaj do lokalnego `.env` adres testowej bazy (po wykonaniu schematu i
migracji), np. `TEST_DATABASE_URL=postgresql://outpost_user:<hasło-URL-encoded>@127.0.0.1:5432/outpost`,
a następnie ponownie uruchom `npm.cmd test`. Test tworzy i usuwa wyłącznie rekord o
losowym identyfikatorze `IT-*`.

Testy floty sprawdzają API przez atrapę adaptera PostgreSQL i UI przez atrapę Google
Maps, w tym Advanced Markers, odświeżanie bez ponownego tworzenia mapy, brak klucza
oraz jawne wywołanie Routes API. Weryfikacja rzeczywistej migracji wymaga PostgreSQL;
mapa w przeglądarce wymaga prawidłowego klucza i Map ID. Opcjonalne trasy drogowe
wymagają osobnego klucza Routes API i włączonego billing; nie są testowane przez
automatyczne testy i nie są wywoływane podczas zwykłego pobrania floty.

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
