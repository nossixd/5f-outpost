# Plan FR-01 — monitoring floty

1. Zachować Node.js, CommonJS, natywne HTTP, `pg` i istniejące UI. Dodać widok
   „Monitoring floty” w aktualnej nawigacji, bez nowej aplikacji/frameworka.
2. Dodać idempotentną migrację do istniejącej bazy: pojazdy, trasy z geometrią
   JSONB, historię pozycji z adresem, prędkością i czasem oraz klucze obce do
   `transport_orders`. Wypełnić ją pięcioma przykładowymi pojazdami i powiązanymi
   zleceniami przez `ON CONFLICT DO NOTHING`.
3. Dodać `src/fleet.js`, korzystający z istniejącego poola DB, który pobiera
   najnowszą pozycję pojazdu, aktywną trasę i aktualne dane zlecenia. Logikę ETA
   obliczać przez istniejące `evaluateDelay`; nie duplikować ani nie modyfikować FR-02.
4. Dodać `GET /api/vehicles` i `GET /api/config`. API floty działa ze źródłem
   PostgreSQL, waliduje/współrzędne i ocenia świeżość po stronie serwera. W trybie
   demo bez bazy zwraca jawny HTTP 503 zamiast zastępczej tablicy.
5. Zmienić widok floty na listę i panel mapy responsywny. Korzystać z
   Leaflet (`L.map`, `L.marker`, `L.popup`, `L.polyline`, `L.featureGroup`);
   biblioteki asynchronicznie. Utrzymywać mapę i znaczniki, aktualizować pozycje oraz
   dopasowywać widok do wszystkich pojazdów bez tworzenia mapy ponownie.
6. Udostępnić podgląd trasy przy hover na liście, wybór i przybliżenie po kliknięciu,
   dymek po hover znacznika, szczegóły pojazdu i powrót do widoku wszystkich.
   Zapisana wielopunktowa geometria pozostaje wyraźnie oznaczona jako uproszczona.
7. Serwować Leaflet z wersjonowanej zależności npm, użyć OpenStreetMap i zaktualizować CSP.
   Brak konfiguracji mapy nie może ukrywać listy pojazdów.
8. Opcjonalne Routes API obsłużyć wyłącznie przez osobny klucz serwerowy i endpoint
   POST wywoływany po kliknięciu oraz potwierdzeniu użytkownika. Nie uruchamiać API
   przy starcie/odświeżeniu; nie zapisywać wyliczonej geometrii do PostgreSQL.
   Użyć podstawowego `DRIVE` bez danych ruchu i opisać koszty oraz ograniczenia dla
   pojazdów ciężarowych.
9. Dodać testy adaptera/API/świeżości/hover/click/aktualizacji markerów i błędów UI,
   uruchomić pełny zestaw, w tym historię 3 oraz FR-02. Testy z prawdziwym PostgreSQL
   i zewnętrznymi usługami oznaczyć jako wymagające konfiguracji.

Nowe pozycje są symulowanymi rekordami bazy, nie danymi sprzętowych lokalizatorów.
NFR-05 jest interpretowane dokładnie jako stale, gdy wiek pomiaru przekracza
30 sekund; odbiornik sprzętowy i automatyczne odświeżanie GPS pozostają poza zakresem.
