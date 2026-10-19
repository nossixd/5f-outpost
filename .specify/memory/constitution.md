
# Konstytucja projektu 5f-outpost

## Zasady podstawowe

### I. Cel użytkowy i kontrola zakresu
Aplikacja służy dyspozytorom firmy transportowej do monitorowania transportów, wykrywania
opóźnień, obsługi zgłoszeń i analizy kosztów. Każda zmiana MUSI odpowiadać zatwierdzonej
potrzebie użytkownika lub wymaganiu projektu. Zakres MUSI pozostać ograniczony do
zatwierdzonych wymagań; jego rozszerzenie wymaga jawnej decyzji i aktualizacji dokumentacji
SDD.

### II. SDD, źródło wymagań i identyfikowalność
Projekt MUSI stosować Specification-Driven Development z użyciem procesu GitHub Spec Kit.
Podstawowym źródłem wymagań jest `docs/diagram.png`. Specyfikacje MUSZĄ zachowywać
identyfikatory FR-01–FR-04 i NFR-01–NFR-10 oraz zapewniać śledzenie każdego wymagania od
źródła przez kryteria akceptacji do weryfikacji. Dokumentacja projektowa MUSI być tworzona
i utrzymywana w języku polskim.

### III. Jednoznaczność i weryfikowalność
Każde wymaganie MUSI opisywać jednoznaczny, obserwowalny rezultat i sposób jego weryfikacji.
Wartości parametrów i kryteria z zatwierdzonego źródła MUSZĄ być przenoszone bez samowolnej
zmiany. Nie wolno dopisywać nowych wymagań jako zatwierdzonych. Gdy źródło nie rozstrzyga
znaczenia, zakresu lub metody pomiaru wymagania, dokumentacja MUSI oznaczyć je jako
wymagające doprecyzowania; nie wolno zastępować brakującej decyzji założeniem.

### IV. Bezpieczeństwo i ochrona danych
Zmiany MUSZĄ uwzględniać walidację danych wejściowych, kontrolę uprawnień i ochronę informacji
wrażliwych. Nie wolno umieszczać sekretów i danych wrażliwych w repozytorium ani ujawniać ich
w logach, błędach lub testach. Wymagania bezpieczeństwa MUSZĄ być powiązane z identyfikatorami
i kryteriami weryfikacji; dodatkowe wymagania wymagają zatwierdzenia zgodnie z procesem zmian.

### V. Prostota i utrzymywalność
Implementacja MUSI używać zatwierdzonych technologii i istniejących konwencji repozytorium.
Nowe zależności, abstrakcje i konfiguracje MUSZĄ mieć uzasadnienie wynikające z zatwierdzonych
wymagań. Zmiany MUSZĄ aktualizować bezpośrednio powiązaną dokumentację, a błędy MUSZĄ być
sygnalizowane jawnie, bez pozorowania powodzenia.

## Ograniczenia projektu

Projekt jest aplikacją internetową dla dyspozytorów firmy transportowej, działającą
w przeglądarce. Zatwierdzony stos technologiczny obejmuje Node.js, TypeScript i PostgreSQL.
Nie określono tu dodatkowych frameworków, dostawców ani wdrożeniowych założeń.

Poniższy katalog utrwala identyfikatory i kryteria wskazane w `docs/diagram.png`; nie stanowi
zgody na ich zmianę ani na dodanie kolejnych wymagań:

| ID | Wymaganie z diagramu | Kryterium lub parametr z diagramu |
|---|---|---|
| FR-01 | Monitorowanie transportów | Pozycja GPS, status, czas aktualizacji |
| FR-02 | Wykrywanie opóźnień | ETA i powiadomienie o opóźnieniu |
| FR-03 | Obsługa zgłoszeń | Rejestracja, statusy, historia |
| FR-04 | Analiza kosztów | Raporty kosztów i koszt/km |
| NFR-01 | Dostępność | Dostępność >= 99.5% |
| NFR-02 | Przywracanie usługi | MTTR <= 60 min |
| NFR-03 | Czas między awariami | MTBF >= 720 h |
| NFR-04 | Czas odpowiedzi | p95 <= 2 s |
| NFR-05 | Aktualność pozycji | Opóźnienie aktualizacji <= 30 s |
| NFR-06 | Kontrola dostępu | 100% testów uprawnień |
| NFR-07 | Ochrona transmisji | HTTPS/TLS |
| NFR-08 | Poprawność raportów | 100% zgodności w testach |
| NFR-09 | Integralność zgłoszeń | 100% wymaganych pól |
| NFR-10 | Odtwarzanie po awarii | RPO <= 15 min; RTO <= 60 min |

Wartości i treść powyższej tabeli MUSZĄ pozostać zgodne ze źródłem. Ich zmiana wymaga
zatwierdzonej zmiany źródła i aktualizacji powiązanej specyfikacji oraz identyfikowalności.

## Proces wytwórczy

Dla nowej lub zmienianej funkcjonalności zespół MUSI najpierw przygotować specyfikację
w procesie GitHub Spec Kit, a następnie rozstrzygnąć zgłoszone niejasności i uzyskać akceptację
wymagań przed planowaniem oraz implementacją. Specyfikacja MUSI zachować identyfikatory
źródłowe, kryteria akceptacji, powiązanie z testami i jawny status kwestii nierozstrzygniętych.
Planowanie, zadania i implementacja następują dopiero po uzgodnieniu specyfikacji. Sama
konstytucja nie zastępuje tych artefaktów.

Przed przeglądem zmiany zespół MUSI uruchomić adekwatne testy i dostępne kontrole jakości. Wyniki
MUSZĄ weryfikować kryteria akceptacji; niewykonane lub niezaliczone kontrole MUSZĄ być jawnie
opisane i nie mogą być przedstawiane jako zaliczone. Przegląd MUSI sprawdzić zgodność
implementacji i dokumentacji z zatwierdzoną specyfikacją oraz niniejszą konstytucją.

## Zasady zarządzania

Konstytucja obowiązuje przy planowaniu, implementacji i przeglądzie zmian. Poprawki MUSZĄ być
przedstawione do przeglądu wraz z uzasadnieniem, wskazaniem zmienianych zasad i wpływu na
zależne specyfikacje. Zmiany wymagań MUSZĄ być zatwierdzone oraz odzwierciedlone w źródle wymagań i odpowiednich
artefaktach Spec Kit; zatwierdzonych wymagań nie wolno zmieniać poza tym procesem.

Wersja konstytucji MUSI stosować semantyczne wersjonowanie: MAJOR oznacza niezgodną wstecz
zmianę zasad, MINOR dodanie zasady lub istotne rozszerzenie wymagań, a PATCH doprecyzowanie
bez zmiany znaczenia. Przegląd każdej zmiany MUSI potwierdzić zgodność z konstytucją,
zatwierdzoną specyfikacją, identyfikatorami oraz kryteriami weryfikacji. Zmiany konstytucji
zatwierdzają opiekunowie projektu.

**Wersja**: 1.1.0 | **Data ratyfikacji**: TODO(RATIFICATION_DATE): nieznana pierwotna data | **Ostatnia zmiana**: 2026-10-18
