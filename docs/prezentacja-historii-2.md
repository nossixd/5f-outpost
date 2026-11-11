# Pokaz historii 2 — ryzyko opóźnienia

Uruchom `npm start`, otwórz http://127.0.0.1:3000.

„Prezentuję historię dyspozytora, który otrzymuje informacje o opóźnieniach,
aby wcześniej reagować na problemy z dostawą.

W sekcji Dostawy wymagające uwagi widzimy trzy zlecenia. Każda karta pokazuje
trasę, planowaną dostawę, ETA i opóźnienie. Górne Powiadomienia otwierają tę samą
listę w oknie. Szczegóły pokazują komplet informacji o wybranej dostawie.

Przy TR-001 wybieram Zatwierdź opóźnienie. To oznacza przyjęcie informacji o opóźnieniu.
Alert znika z listy uwagi, a w tabeli zostaje potwierdzone opóźnienie 25 minut i data decyzji.

Przy TR-002 wybieram Odrzuć prognozę. Uznaję ETA za niewiarygodne, nie anuluję transportu.
Dostawa pozostaje na liście uwagi z oznaczeniem Wymaga aktualizacji ETA. System nie
oblicza opóźnienia z odrzuconego czasu. Wybieram Zmień czas i podaję poprawne ETA.
Po zapisie system ponownie ocenia ryzyko.

Przy TR-003 wybieram Zmień czas. Wpisuję nowy przewidywany czas przyjazdu,
np. 02.11.2026 o 15:55, i zapisuję. System ponownie porównuje ETA z planem 16:00.
Ponieważ dostawa nie jest już opóźniona, znika z listy uwagi. Nowe ETA widać w tabeli.

Po odświeżeniu strony decyzje i zmieniony czas są nadal widoczne.”

Godziny powyżej zakładają strefę Europe/Warsaw. Po restarcie serwera w trybie lokalnym
wracają początkowe trzy alerty. W PostgreSQL zmiany są trwałe. Makiety pozostałych
modułów nie są działającymi historiami. System nadal nie pobiera ETA z telematyki.
