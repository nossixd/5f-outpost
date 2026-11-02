# OUTPOST

Lokalny prototyp historii 2 z prezentacji (slajd 18): informowanie dyspozytora o ryzyku
opóźnienia. Zawiera ocenę progu, powiadomienia, szczegóły i obsługę braku wiarygodnego ETA.

## Uruchomienie

Wymagany Node.js 22 lub nowszy.

```sh
npm start
```

Otwórz http://127.0.0.1:3000. Domyślnie aplikacja działa na stałych danych demonstracyjnych,
bez instalowania paczek. TR-001 generuje alert przy progu 5 minut; TR-002 nie przekracza
progu; TR-003 nie ma ETA; TR-004 ma niewiarygodne ETA. Kliknij alert, aby zobaczyć szczegóły.
Zmiana progu na 25 usuwa alert TR-001 (równość nie jest przekroczeniem).

```sh
npm test
```

Testy obejmują logikę FR-02 i API HTTP. Istniejący `db_test.js` jest osobnym, ręcznym
testem połączenia PostgreSQL: `node db_test.js` (wymaga zależności i bazy).

## Opcjonalne PostgreSQL

1. Wykonaj `npm ci`.
2. Przygotuj bazę i ustaw `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
   w środowisku lub lokalnym `.env` (nie umieszczaj sekretów w repozytorium).
3. Wykonaj `src/database/schema.sql` w tej bazie, np. przez psql.
4. Uruchom `DATA_SOURCE=postgres npm start`.

Adapter odczytuje tabelę `transport_orders`. System zewnętrzny powinien uzupełniać ETA
oraz jego wiarygodność; w prototypie można zmieniać rekordy ręcznie. Przycisk ponawia odczyt.
`PORT` i `HOST` zmieniają adres serwera; domyślnie nasłuchuje tylko na localhost.
Nie ma logowania ani TLS — prototyp jest przeznaczony do lokalnej prezentacji.

## Dokumentacja

- [Specyfikacja historii](specs/002-delay-alerts/spec.md) i [plan](specs/002-delay-alerts/plan.md).
- [Decyzje architektoniczne](ADR.md).
- [Architektura 4+1 i diagramy](docs/architektura.md).
- [Braki do oddania i udział AI](docs/stan-realizacji.md).
