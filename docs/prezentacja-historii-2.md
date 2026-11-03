# Pokaz historii 2 — informowanie o ryzyku opóźnienia

Uruchom `npm start` i otwórz http://127.0.0.1:3000.
Wygląd działającego widoku dopasowano do eksportu z folderu `strona/`:
ciemne tło, lewy panel OUTPOST / TRANS-LOGIC, aktywne „Monitorowanie tras”,
górny pasek oraz niebieskie akcenty. Pozostałe pozycje menu są opisami zakresu
projektu; nie uruchamiają innych historii. Profil jest demonstracyjny.

## Wypowiedź podczas pokazu

„Prezentuję historię dyspozytora, który chce otrzymywać informacje o ryzyku
opóźnienia, aby wcześniej reagować i planować działania.

Po lewej widzimy panel OUTPOST z zaznaczonym monitorowaniem tras. W głównym
obszarze znajduje się widok ryzyka opóźnień: ustawienie progu, powiadomienia
oraz tabela zleceń. Niebieski komunikat informuje, że korzystamy z danych demonstracyjnych.

Próg ustawiam na 5 minut; ocena przelicza się automatycznie. System porównuje przewidywany czas przyjazdu, czyli ETA,
z planowaną dostawą. Dla TR-001 plan to 14:00, a ETA to 14:25, więc opóźnienie
wynosi 25 minut. Jest większe od progu, dlatego zlecenie ma oznaczenie ryzyka,
a nad tabelą pojawia się powiadomienie.

Klikam powiadomienie. Otwiera się okno ze szczegółami: numerem zlecenia, trasą,
planowanym czasem, ETA i opóźnieniem. Dyspozytor ma informacje potrzebne do podjęcia działania.

W tabeli widzimy też TR-002, które nie przekracza progu. TR-003 nie ma ETA,
a TR-004 ma niewiarygodne ETA. W tych przypadkach system informuje o braku
wystarczających danych i nie zgaduje opóźnienia.

Na koniec zmieniam próg na 25 minut i wynik automatycznie się aktualizuje (można też kliknąć Oceń ryzyko). Alert TR-001 znika,
ponieważ opóźnienie jest równe progowi, a reguła wymaga jego przekroczenia.
W ten sposób pokazujemy wszystkie trzy kryteria historii: wykrycie ryzyka,
podgląd szczegółów i obsługę brakujących danych.”

Godziny wyświetlane są w strefie czasowej przeglądarki; powyższy przykład zakłada Europe/Warsaw.
Nie prezentujemy mapy GPS ani automatycznych powiadomień w tle — nie są zaimplementowane.
