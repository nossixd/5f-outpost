# Stan realizacji względem „Zajęcia 5 — Ocena 2”

## Gotowe

- Historia 2 ze slajdu 18: oznaczenie ryzyka, powiadomienie w aplikacji, szczegóły,
  komunikat o niewystarczających danych. Widok przeglądarkowy i API.
- ADR-005–ADR-007 w ADR.md, specyfikacja i plan FR-02.
- Trzy alerty startowe, zatwierdzenie opóźnienia, odrzucenie niewiarygodnej prognozy
  z wymaganiem nowego ETA, daty decyzji i edycja ETA.
- Opis 4+1 i źródła diagramów dla zaimplementowanej historii: UML Component,
  Communication, Sequence, ERD i DFD w `docs/architektura.md`.
- Testy FR-02: 11/11 zaliczonych na Node.js 22.22.1 (logika, lokalny HTTP oraz zdarzenia interfejsu w symulowanym DOM).

## Czego jeszcze brakuje

Do materiałów na ocenę:

- Wyrenderowania źródeł UML do obrazów/PDF oraz sprawdzenia ich czytelności w prezentacji.
- Rozszerzenia projektu architektury i modelu danych na cały zakres FR-01–FR-04,
  jeżeli prowadzący wymaga diagramów całej aplikacji, a nie zrealizowanego wycinka.
- Uzgodnienia rozbieżności JavaScript (ADR i kod) / TypeScript (specyfikacja i konstytucja).
- Próby adaptera na docelowej bazie PostgreSQL. Interfejs sprawdzono w bezgłowym
  Firefoxie: trzy alerty, zatwierdzenie, odrzucenie, edycja ETA, ponowna ocena,
  zachowanie zmian po odświeżeniu i układ mobilny. Próg i etykietę danych usunięto z UI.
- Przeglądu zespołowego dokumentacji i rzeczywistego udziału AI przed oddaniem.

Do wdrożenia produkcyjnego (poza tą historią demonstracyjną):

- Dostawcy ETA i zasad oceny wiarygodności/aktualności danych; zatwierdzonego progu ryzyka.
- Uwierzytelniania i kontroli uprawnień (NFR-06), TLS (NFR-07).
- Pomiarów i potwierdzenia NFR-01–NFR-05 oraz NFR-10; kopii zapasowych i monitoringu.
- Pozostałych historii: monitorowania GPS, rejestracji i obsługi zgłoszeń, raportów kosztów.
  Nie są wymagane do wykazania jednej historii na tę ocenę.

Powiadomienia są wyliczane przy odczycie i prezentowane w aplikacji. Nie są wysyłane
przez e-mail/push i nie są automatycznie odświeżane w tle. Zapisywana jest ostatnia
decyzja z datą, bez pełnej historii zmian. Stan lokalny żyje do restartu procesu.

## Wykorzystanie AI

| Technologia AI | Obszar zastosowania | Rezultaty | Objętość pracy wykonanej z AI |
|---|---|---|---|
| OpenAI Codex (sesja asystenta; dokładna wersja modelu niepotwierdzona) | Analiza slajdów, implementacja FR-02, testy i dokumentacja | Kod serwera i interfejsu, ocena ryzyka, adaptery danych, testy, ADR i źródła diagramów | Niemal całość nowych zmian tej sesji przygotowana przez AI; nie jest to procent całego repozytorium ani pomiar czasu pracy zespołu |

Nie wykonano commitów ani pushowania. Praca pozostaje na gałęzi `nosal`.
