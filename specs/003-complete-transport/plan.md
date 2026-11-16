# Plan FR-01 — zakończenie zlecenia transportowego

1. Zachować stos Node.js/JavaScript, natywne HTTP, HTML/CSS/JavaScript i istniejące
   adaptery; bez Express, SPA ani nowego modułu bazy.
2. Rozszerzyć `transport_orders` o `status`, `completed_at` i opcjonalne
   `completed_by`, bez usuwania danych. Użyć `in_progress` dla istniejących rekordów,
   ograniczeń CHECK i idempotentnego skryptu migracji.
3. Rozszerzyć istniejący `src/orders.js`: lista zwraca statusy wykonania; zakończenie
   demo zmienia stan w pamięci, a PostgreSQL używa pojedynczego warunkowego UPDATE
   (`status = 'in_progress'`) z `RETURNING`, rozróżniając brak rekordu od konfliktu.
   Warunek SQL zapewnia bezpieczeństwo współbieżności.
4. Dodać `PATCH /api/orders/:id/complete` z walidacją identyfikatora, JSON i pustego
   obiektu. Najpierw weryfikować zaufany autoryzator serwera, potem zakończyć zlecenie.
   Demo ma jawny, lokalny kontekst demonstracyjnego uprawnionego użytkownika;
   PostgreSQL domyślnie odmawia bez serwerowej autoryzacji. Nie ufać danym tożsamości
   z treści żądania ani nagłówkom ustawianym przez przeglądarkę.
5. Zintegrować istniejący widok tabeli z oznaczeniem statusu, potwierdzeniem,
   czasem zakończenia i komunikatami; nie zmieniać sposobu działania FR-02.
6. Udokumentować konfigurację środowiska, migrację i weryfikację PostgreSQL dla
   PowerShell; nie umieszczać sekretów w repozytorium.
7. Dodać testy adaptera/API/UI i opcjonalny test integracyjny PostgreSQL; uruchomić
   pełny zestaw istniejących i nowych testów.

Historia 3 jest realizacją zakończenia zlecenia w ramach FR-01, a nie FR-03.
Uwierzytelnianie produkcyjne pozostaje poza zakresem; identyfikator kończącego może
być zapisany wyłącznie po przekazaniu przez zaufany kontekst serwera.
