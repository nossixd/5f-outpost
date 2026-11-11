# FR-02 — Historia 2: informowanie o opóźnieniu

Źródło: prezentacja, slajdy 12, 18 i 22; specyfikacja FR-02.
Rozszerzenie zatwierdzone przez użytkownika: trzy dostawy wymagające uwagi,
zatwierdzanie/odrzucanie alertu, edycja czasu i usunięcie formularza progu.

## Kryteria akceptacji

1. Dla wiarygodnego ETA przekraczającego plan dostawy o ponad 5 minut powstaje alert.
   Pięć minut to wewnętrzny parametr prototypu, wymagający zatwierdzenia produkcyjnego.
   Nie ma filtra ani ustawienia progu w interfejsie.
2. Lista startowa zawiera TR-001 (+25 min), TR-002 (+40 min), TR-003 (+15 min).
3. Górne Powiadomienia otwierają okno z listą. Szczegóły pokazują plan, ETA i opóźnienie.
4. Zatwierdź opóźnienie zapisuje przyjęcie wiarygodnego ETA. Alert zostaje obsłużony,
   ale tabela zachowuje oznaczenie potwierdzonego opóźnienia wraz z liczbą minut.
   Odrzuć prognozę oznacza ETA jako niewiarygodne; dostawa pozostaje na liście uwagi
   ze stanem „Wymaga aktualizacji ETA” i akcją zmiany czasu. Nie oblicza się opóźnienia
   z odrzuconej prognozy. Zapisuje się decyzję i datę; odrzucone ETA pozostaje dostępne
   w szczegółach jako odrzucona wartość, a nie aktualna prognoza.
   Serwer odrzuca próbę zatwierdzenia niewiarygodnej prognozy (HTTP 409).
   Żadna z akcji nie anuluje ani nie kończy transportu i nie zmienia planu dostawy.
5. Zmień czas otwiera formularz ETA. Zapis zmienia ETA, oznacza ręczny odczyt jako
   wiarygodny, czyści wcześniejszą decyzję i ponownie ocenia ryzyko. Plan dostawy pozostaje bez zmian.
6. Decyzje i ETA są zapisywane po stronie serwera i zachowane po odświeżeniu strony.
   W trybie lokalnym dane są w pamięci procesu (restart przywraca listę początkową).
   W trybie PostgreSQL dane są trwałe.
7. Brak planu, ETA lub wiarygodności daje komunikat o braku danych. Jawne odrzucenie
   prognozy daje osobne powiadomienie o wymaganej aktualizacji ETA.
8. Nieudany zapis nie usuwa alertu i pokazuje błąd z możliwością ponowienia.

Dostawca ETA, produkcyjny próg, polityka uprawnień i zasady wiarygodności danych
pozostają do uzgodnienia przed wdrożeniem.
