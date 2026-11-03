# OUTPOST

Lokalna aplikacja historii 2 (FR-02) z prezentacji: ryzyko opóźnienia, powiadomienia,
szczegóły oraz zaakceptowane przez użytkownika akcje dyspozytora.

## Uruchomienie

Wymagany Node.js 22 lub nowszy. Bez dodatkowych zależności w trybie lokalnym:

```sh
npm start
```

Otwórz http://127.0.0.1:3000. Początkowe trzy alerty: TR-001 (+25 min), TR-002
(+40 min), TR-003 (+15 min). TR-004 pokazuje przypadek braku wiarygodnego ETA.

Zatwierdź i Odrzuć zapisują decyzję dotyczącą alertu, nie status realizacji transportu.
Zmień czas edytuje ETA (plan dostawy pozostaje bez zmian), czyści wcześniejszą decyzję
i ponownie ocenia ryzyko. Decyzje pozostają widoczne w tabeli wraz z datą.
Nie ma filtra progu; reguła serwera to opóźnienie większe niż 5 minut.

Stan lokalny jest zachowany po odświeżeniu strony i resetuje się po restarcie serwera.
To dane przykładowe bez integracji z dostawcą ETA. Próg produkcyjny do uzgodnienia.

## Testy

```sh
npm test
```

Testy obejmują ocenę ryzyka, API odczytu i zapisu, akcje interfejsu i błędy.
`node db_test.js` to osobny, ręczny test połączenia PostgreSQL.

## PostgreSQL

1. Wykonaj `npm ci`.
2. Ustaw `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` w środowisku
   lub lokalnym `.env`; nie umieszczaj sekretów w repozytorium.
3. Wykonaj `src/database/schema.sql` w bazie, także przy aktualizacji wcześniejszej
   wersji (dodaje kolumny decyzji bez usuwania istniejących rekordów).
4. Uruchom `DATA_SOURCE=postgres npm start`.

W tym trybie decyzje i ETA są trwale zapisywane w bazie. Zewnętrzny dostawca ETA nie jest
podłączony. `PORT` i `HOST` zmieniają adres serwera, domyślnie localhost:3000.
Brak logowania i TLS ogranicza aplikację do lokalnej prezentacji.

## Dokumentacja

- [Specyfikacja](specs/002-delay-alerts/spec.md), [plan](specs/002-delay-alerts/plan.md).
- [Decyzje architektoniczne](ADR.md), [architektura](docs/architektura.md).
- [Stan realizacji i tabela AI](docs/stan-realizacji.md).
- [Przebieg pokazu](docs/prezentacja-historii-2.md).
