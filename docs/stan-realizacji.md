# Stan realizacji względem „Zajęcia 5 — Ocena 2”

## Historia 3 — zakończenie transportu (FR-01)

- Zaimplementowano wybór istniejącego zlecenia, podgląd statusu realizacji, przycisk
  zakończenia z potwierdzeniem oraz prezentację statusu i czasu zakończenia.
- Dodano `PATCH /api/orders/:id/complete`; nie przyjmuje tożsamości z przeglądarki.
  Demo jest ograniczone do połączeń lokalnych. PostgreSQL domyślnie odmawia operacji;
  jawny tryb demonstracyjny jest lokalny i nie zastępuje logowania.
- Dodano warunkowy atomowy zapis statusu i `completed_at`, migrację zachowującą dane,
  konflikt ponownego/równoczesnego zakończenia i odpowiedzi 400/403/404/409/503.
- Historia 3 realizuje zakończenie zlecenia transportowego w ramach FR-01, a nie
  obsługę zgłoszeń FR-03.
- Zakończenie jest objęte pełnym zestawem testów automatycznych. Test trwałości po
  restarcie wymaga `TEST_DATABASE_URL`; bieżące połączenie z `outpost_db` sprawdzono
  wyłącznie zapytaniami odczytującymi.

## Monitorowanie floty — FR-01

- Dodano jedną zakładkę „Monitorowanie tras” z funkcjami floty, API `GET /api/vehicles`, adapter PostgreSQL,
  zapytanie łączące pojazdy, trasy, lokalizacje i istniejące zlecenia oraz ocenę ETA
  przez FR-02.
- Migracja 004 tworzy trzy tabele i pięć symulowanych pojazdów z adresem, GPS,
  prędkością, trasą wielopunktową i powiązanym zleceniem; nie usuwa ani nie nadpisuje
  istniejących danych. Wiek lokalizacji powyżej 30 sekund jest sygnalizowany.
- Mapa używa Leaflet 1.9.4 i OpenStreetMap, oznacza świeżość GPS, umożliwia wybór pojazdu,
  popup, trasę planowaną i dopasowanie widoku przyciskiem „Wszystkie pojazdy”.
- Zapisane geometrie z PostgreSQL są opisane jako planowane; routing drogowy nie jest
  implementowany ani nie jest udawany.
- Testy nowych i istniejących funkcji: **22 zaliczone, 0 błędów, 2 pominięte**
  (automatyczne testy integracyjne wymagają `TEST_DATABASE_URL`). Test mapy używa
  stałych danych. Rzeczywistej mapy z kafelkami nie zweryfikowano automatycznie.
- Wykonano odczytowy test połączenia z `outpost_db`: baza zawiera pięć pojazdów, a
  API adaptera odczytuje wszystkie pięć z pozycjami, trasami i zleceniami. Test
  używał transakcji `READ ONLY` i zakończył ją przez `ROLLBACK`; nie uruchamiano
  migracji ani nie zmieniano danych. Wszystkie zapisane pozycje są obecnie starsze
  niż 30 sekund i poprawnie oznaczane jako nieaktualne.
- Dodano migrację 005 ERD. Nie uruchomiono jej na działającej bazie; przed wykonaniem
  wymagane są kopia zapasowa i świadome potwierdzenie operatora.

## Gotowe

- Monitorowanie tras i floty FR-01: jedno UI, API i mapa Leaflet z danymi z PostgreSQL,
  migracja starych tabel oraz ERD kompatybilna migracja 005.
- Historia 3 FR-01: interfejs, walidowane API, autoryzacja demonstracyjna, adaptery
  demo/PostgreSQL oraz idempotentna migracja.
- Historia 2 ze slajdu 18: oznaczenie ryzyka, powiadomienie w aplikacji, szczegóły,
  komunikat o niewystarczających danych. Widok przeglądarkowy i API.
- ADR-005–ADR-007 w ADR.md, specyfikacja i plan FR-02.
- Trzy alerty startowe, zatwierdzenie opóźnienia, odrzucenie niewiarygodnej prognozy
  z wymaganiem nowego ETA, daty decyzji i edycja ETA.
- Opis 4+1 i źródła diagramów dla zaimplementowanej historii: UML Component,
  Communication, Sequence, ERD i DFD w `docs/architektura.md`.
- Testy FR-02 oraz FR-01 uruchomione razem; testy trwałości wymagają osobnego
  `TEST_DATABASE_URL`.

## Czego jeszcze brakuje

Do materiałów na ocenę:

- Wyrenderowania źródeł UML do obrazów/PDF oraz sprawdzenia ich czytelności w prezentacji.
- Rozszerzenia projektu architektury i modelu danych na cały zakres FR-01–FR-04,
  jeżeli prowadzący wymaga diagramów całej aplikacji, a nie zrealizowanego wycinka.
- Uzgodnienia rozbieżności JavaScript (ADR i kod) / TypeScript (specyfikacja i konstytucja).
- Ręcznej weryfikacji kafelków Leaflet/OpenStreetMap i rzeczywistego przebiegu mapy.
  Test trwałości po restarcie wymaga osobnego
  `TEST_DATABASE_URL`; nie przeprowadzono migracji na działającej bazie.
- Przeglądu zespołowego dokumentacji i rzeczywistego udziału AI przed oddaniem.

Do wdrożenia produkcyjnego (poza tą historią demonstracyjną):

- Dostawcy ETA i zasad oceny wiarygodności/aktualności danych; zatwierdzonego progu ryzyka.
- Uwierzytelniania i kontroli uprawnień (NFR-06), TLS (NFR-07).
- Pomiarów i potwierdzenia NFR-01–NFR-05 oraz NFR-10; kopii zapasowych i monitoringu.
- Źródła fizycznych lokalizacji GPS i automatycznego strumienia aktualizacji; obecna
  flota korzysta z pięciu statycznych, symulowanych pozycji w bazie.
- Pozostałych historii: rejestracji i obsługi zgłoszeń oraz raportów kosztów. Nie są
  wymagane do wykazania zrealizowanych historii.

Powiadomienia są wyliczane przy odczycie i prezentowane w aplikacji. Nie są wysyłane
przez e-mail/push i nie są automatycznie odświeżane w tle. Zapisywana jest ostatnia
decyzja z datą, bez pełnej historii zmian. Stan lokalny żyje do restartu procesu.

## Wykorzystanie AI

| Technologia AI | Obszar zastosowania | Rezultaty | Objętość pracy wykonanej z AI |
|---|---|---|---|
| OpenAI Codex (sesja asystenta; dokładna wersja modelu niepotwierdzona) | Analiza slajdów, implementacja FR-02, testy i dokumentacja | Kod serwera i interfejsu, ocena ryzyka, adaptery danych, testy, ADR i źródła diagramów | Niemal całość nowych zmian tej sesji przygotowana przez AI; nie jest to procent całego repozytorium ani pomiar czasu pracy zespołu |

Nie wykonano commitów ani pushowania. Praca pozostaje na gałęzi `nosal`.
