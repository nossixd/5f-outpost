# FR-01 — Historia: monitorowanie floty

## Źródło i zakres

Źródło: `specs/001-transport-dispatch/spec.md`, FR-01 (monitorowanie transportów),
NFR-05 (aktualność pozycji, do 30 sekund) oraz historia dyspozytora: widok trasy,
pozycji GPS, statusu zlecenia i czasu aktualizacji.

Historia obejmuje monitorowanie floty w istniejącej aplikacji OUTPOST: pojazdy,
ostatnie lokalizacje, prędkości, trasy i powiązane zlecenia. Zakończenie zlecenia
z historii 3 (`specs/003-complete-transport/`) i wykrywanie opóźnień FR-02 pozostają
zachowane. Nie dodaje się fizycznej integracji z urządzeniami GPS. Lokalizacje
demonstracyjne są zapisane w PostgreSQL i odczytywane przez API, a nie przechowywane
w kodzie przeglądarki.

## Kryteria akceptacji

1. Istniejąca aplikacja ma nawigacyjną zakładkę „Monitoring floty”; nie powstaje
   odrębna aplikacja ani strona demonstracyjna.
2. `GET /api/vehicles` pobiera pojazdy, aktualną lokalizację, trasę i zlecenie
   z PostgreSQL. Frontend pobiera dane przez API i nie zawiera tablicy pojazdów.
   Brak lub błąd bazy jest sygnalizowany, a nie zastępowany danymi pozorującymi zapis.
3. Migracja tworzy tabele pojazdów, tras i lokalizacji z kluczami, ograniczeniami
   i powiązaniami do `transport_orders`; można ją wykonać ponownie i nie usuwa ani
   nie nadpisuje istniejących rekordów.
4. Migracja dodaje co najmniej 5 przykładowych pojazdów, każdy z zapisaną pozycją
   demonstracyjną, prędkością, adresem i trasą powiązaną z istniejącym zleceniem.
   Seed używa `ON CONFLICT DO NOTHING`.
5. Odpowiedź API zawiera dla każdego pojazdu prędkość w km/h, ulicę, miasto, kraj,
   współrzędne szerokości/długości geograficznej, czas ostatniej pozycji oraz
   powiązane zlecenie i jego status realizacji.
6. API zwraca wielopunktową geometrię zapisanej trasy i ocenę ETA wyliczoną przez
   istniejącą logikę FR-02; decyzje, ETA i progi FR-02 nie są modyfikowane.
7. Interfejs używa aktualnego Maps JavaScript API `AdvancedMarkerElement`; każdy
   pojazd ma osobny znacznik z ikoną pojazdu i krótką informacją przy najechaniu.
   Mapa jest dopasowana do wszystkich aktualnie dostępnych lokalizacji.
8. Kliknięcie znacznika lub pojazdu na liście pokazuje szczegóły oraz przybliża
   zapisaną trasę. Kliknięcie innego pojazdu zastępuje wyróżnioną trasę poprzednią.
   Najechanie na pozycję listy tymczasowo podświetla jej trasę; „Wszystkie pojazdy”
   przywraca pełny widok i dopasowuje mapę do wszystkich znaczników.
9. Każdy szczegół pokazuje model, rejestrację, zlecenie, prędkość, adres, status
   realizacji, czas i aktualność GPS, nazwę oraz punkty trasy.
10. Pozycja starsza niż 30 sekund jest widocznie oznaczona jako nieaktualna; pozycja
   mająca dokładnie 30 sekund nie przekracza progu. Brak lub nieprawidłowy czas jest
   oznaczony jako nieaktualny.
11. Gdy `GOOGLE_MAPS_API_KEY` nie jest skonfigurowany lub Google Maps nie może się
   załadować, aplikacja pokazuje czytelny komunikat i nadal może wyświetlić dane
   pojazdów. Klucz Maps jest kluczem klienta i musi być ograniczony do referrerów
   aplikacji i Maps JavaScript API. Mapy Advanced Markers używają Map ID.
12. Geometria z bazy jest jawnie opisana jako uproszczona, a nie dokładna droga.
   Opcjonalne Routes API może zostać wywołane tylko ręcznie po potwierdzeniu ryzyka
   kosztu; żądanie używa klucza serwerowego, nie zapisuje wyniku do bazy i nie jest
   automatycznie uruchamiane ani przy odczycie/odświeżeniu.
13. Symulacja korzysta z pozycji, prędkości i geometrii tras zapisanych w bazie;
    brak fizycznego GPS jest jawnie komunikowany. Czas pozycji służy do oznaczania
    jej świeżości, a nie jest przedstawiany jako rzeczywisty pomiar sprzętowy.
14. Dotychczasowe FR-02 i historia 3 FR-01 nadal przechodzą swoje testy.

## Scenariusze

### Monitorowanie pojazdu

- **Dany** użytkownik otwiera zakładkę „Monitoring floty”,
- **kiedy** API odczyta dane z PostgreSQL,
- **wtedy** widzi pozycje i statusy co najmniej pięciu pojazdów, prędkość, adres,
  czas aktualizacji, powiązane zlecenie i trasę na mapie.

### Wyświetlenie trasy

- **Dany** pojazd ma co najmniej dwa zapisane punkty trasy,
- **kiedy** użytkownik kliknie znacznik albo akcję „Pokaż trasę”,
- **wtedy** mapa pokazuje polilinię tej trasy i informacje o pojeździe/zleceniu.

### Wybór i podgląd na mapie

- **Dany** widok zawiera pojazdy z PostgreSQL,
- **kiedy** użytkownik najedzie na kartę pojazdu, kliknie kartę/znacznik albo wybierze
  „Wszystkie pojazdy”,
- **wtedy** trasa jest odpowiednio tymczasowo podświetlona, wybrana i przybliżona lub
  mapa wraca do widoku obejmującego wszystkie lokalizacje; odświeżenie aktualizuje
  znaczniki bez tworzenia mapy od nowa.

### Opcjonalna trasa drogowa

- **Dany** skonfigurowano osobny serwerowy klucz Routes API,
- **kiedy** użytkownik kliknie przycisk trasy drogowej i potwierdzi komunikat o
  możliwej opłacie,
- **wtedy** aplikacja wysyła jedno żądanie na bazie zapisanych punktów i prezentuje
  wynik Google jako trasę samochodową. Bez klucza przycisk nie jest dostępny; sam
  odczyt floty nigdy nie wywołuje Routes API.

### Nieaktualna lokalizacja

- **Dany** czas ostatniej aktualizacji starszy o ponad 30 sekund, brakujący lub
  nieprawidłowy,
- **wtedy** API i interfejs oznaczają dane jako nieaktualne; aktualizacja mająca
  dokładnie 30 sekund nie jest oznaczona jako starsza niż próg.

### Brak bazy lub klucza Google Maps

- Brak/niedostępność PostgreSQL skutkuje jawnym błędem API, bez zapasowej tablicy
  danych przeglądarkowych.
- Brak klucza Maps albo błąd biblioteki pozostawia tabelę danych dostępną i pokazuje
  informację, że mapa wymaga konfiguracji.

## Weryfikacja

Testy sprawdzają zapytanie do adaptera PostgreSQL i kształt odpowiedzi API, co
najmniej pięć rekordów testowych, powiązanie ze zleceniem i wyniki FR-02, próg
świeżości 30 sekund, błędy źródła danych, brak klucza Maps, Advanced Markers,
hover/click, dopasowanie mapy, brak jej ponownego tworzenia przy odświeżeniu,
opcjonalne żądanie Routes API i obsługę błędu. Test rzeczywistej migracji i odczytu
PostgreSQL wymaga skonfigurowanej bazy; test Google Maps w przeglądarce wymaga
ograniczonego klucza i Map ID, a trasa drogowa — osobnego klucza Routes API oraz
akceptacji kosztu. Żadna z tych zewnętrznych usług nie może być raportowana jako
faktycznie sprawdzona bez konfiguracji.
