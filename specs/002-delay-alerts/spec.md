# FR-02 — Historia 2: informowanie o opóźnieniu

Źródło: prezentacja, slajdy 12, 18 i 22; istniejąca specyfikacja FR-02.
Zakres autoryzowany przez użytkownika: jedna historia z prezentacji.

## Kryteria akceptacji

1. Gdy wiarygodne ETA przekracza plan dostawy o więcej niż ustawiony próg,
   zlecenie otrzymuje oznaczenie ryzyka i powiadomienie w aplikacji.
2. Otwarcie powiadomienia pokazuje numer zlecenia, plan, ETA i opóźnienie.
3. Brak planu, ETA lub wiarygodności ETA daje informację o niewystarczających danych,
   bez zgadywania opóźnienia i bez alertu.

Próg nie jest ustalony w prezentacji: w prototypie jest jawnym parametrem formularza
(5 minut na starcie demonstracji), a nie zatwierdzoną regułą biznesową.
Równość progu nie oznacza jego przekroczenia. Jedno powiadomienie na zlecenie w bieżącej
ocenie; ponowne odświeżenie nie dodaje duplikatów.

Dane demonstracyjne zastępują zewnętrzny system ETA. Produkcyjny próg, zasady wiarygodności
ETA i sposób uwierzytelnienia wymagają doprecyzowania przed wdrożeniem.
