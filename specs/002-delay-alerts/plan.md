# Plan FR-02

1. Czysta funkcja oceny ETA, wspólna dla każdego źródła danych.
2. Serwer HTTP Node.js, API oceny i statyczny interfejs przeglądarkowy.
3. Lokalny magazyn zleceń w pamięci procesu oraz opcjonalny odczyt/zapis PostgreSQL.
4. Akcje zatwierdzenia, odrzucenia i zmiany ETA przez PATCH; testy obliczeń, zapisu i interfejsu.
5. ADR, architektura 4+1 i zestawienie braków oraz udziału AI.

Wybrano JavaScript zgodnie z przyjętym ADR 1 i istniejącym kodem; rozbieżność
ze wzmianką o TypeScript w specyfikacji pozostaje jawna w zestawieniu braków.
