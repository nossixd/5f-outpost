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
