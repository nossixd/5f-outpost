# FR-01 — Historia 3: zakończenie zlecenia transportowego

## Źródło i zakres

Źródło: `specs/001-transport-dispatch/spec.md`, wymaganie FR-01 i historia:
„Jako uprawniony użytkownik chcę zakończyć zlecenie transportowe, aby zapisać jego
nowy status”.

Historia 3 dotyczy **zakończenia zlecenia transportowego (FR-01)**. Nie dotyczy
rejestracji, obsługi ani zamykania zgłoszeń (FR-03). Status wykonania transportu jest
niezależny od prognozy ETA oraz decyzji o opóźnieniu przechowywanej w `decision`.

## Kryteria akceptacji

1. Lista zleceń pozwala wybrać istniejące zlecenie i pokazuje jego status wykonania.
2. Dla niezakończonego zlecenia interfejs pokazuje akcję „Zakończ transport”.
3. Przed zapisem użytkownik musi potwierdzić operację.
4. Uprawnione żądanie zmienia status na `completed` i zwraca aktualne dane zlecenia;
   odpowiedź zawiera `order.status=completed`, `order.completedAt` oraz osobne
   `order.delayStatus`, niezmieniające kontraktu oceny ETA.
5. Zapis statusu i automatycznego czasu `completed_at` jest atomowy i trwały w trybie
   PostgreSQL; po ponownym uruchomieniu aplikacji status oraz czas pozostają zapisane.
6. W trybie demo stan jest zachowany w pamięci procesu do restartu; UI i API działają
   także bez PostgreSQL.
7. Drugie ani równoczesne żądanie zakończenia tego samego transportu nie wykonuje
   ponownego przejścia stanu; odpowiedź konfliktu to HTTP 409.
8. Nieistniejące zlecenie zwraca HTTP 404. Błędne żądanie zwraca HTTP 400.
9. Brak uprawnienia zwraca HTTP 401 lub 403. Błąd/niedostępność PostgreSQL zwraca
   HTTP 503; szczegóły infrastruktury ani sekrety nie trafiają do odpowiedzi.
10. Użytkownik otrzymuje czytelny komunikat powodzenia lub błędu; zakończone zlecenie
    jest oznaczone, pokazuje czas zakończenia i nie oferuje ponownej akcji.
11. Żądania zakończenia nie przyjmują identyfikatora ani roli użytkownika jako dowodu
    uprawnień z przeglądarki. Bez systemu logowania dostęp jest jawnie ograniczonym
    mechanizmem demonstracyjnym; w trybie PostgreSQL operacja wymaga zaufanego
    kontekstu/autoryzatora serwera.
12. Zmiana nie narusza endpointów, decyzji, ETA ani obliczeń opóźnień FR-02.

## Scenariusze

### Wybór i zakończenie zlecenia

- **Dany** istniejące, niezakończone zlecenie widoczne na liście,
- **kiedy** uprawniony użytkownik wybierze „Zakończ transport” i potwierdzi,
- **wtedy** system atomowo zapisze `completed` i czas zakończenia, pokaże sukces
  i zaktualizuje listę.

### Anulowanie potwierdzenia

- **Dany** niezakończony transport,
- **kiedy** użytkownik anuluje potwierdzenie,
- **wtedy** dane transportu nie ulegną zmianie.

### Ponowienie lub równoczesna zmiana

- **Dany** transport już zakończony albo dwa współbieżne żądania,
- **kiedy** nadejdzie kolejne żądanie zakończenia,
- **wtedy** system zwróci HTTP 409 i zachowa pojedynczy czas zakończenia.

### Brak zlecenia, uprawnienia lub dostępności bazy

- Brak rekordu daje HTTP 404; brak uprawnienia HTTP 401/403; niepoprawne dane HTTP
  400; niedostępna baza HTTP 503. Żaden przypadek błędu nie jest prezentowany jako
  powodzenie.

## Weryfikacja

Testy jednostkowe adaptera i testy HTTP/UI sprawdzają przejście statusu, zachowanie
`completed_at`, konflikt powtórzenia, 404, autoryzację, walidację, awarię PostgreSQL,
utrwalenie danych przy odczycie po restarcie i regresję FR-02. Test integracyjny
PostgreSQL uruchamia się tylko z jawnie skonfigurowanym `TEST_DATABASE_URL` i po
wykonaniu schematu oraz migracji; bez niego nie jest raportowany jako zaliczony.
