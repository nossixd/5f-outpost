# Specyfikacja wymagań oprogramowania: 5f-outpost

**Grupa:** 5F  
**Przedmiot:** Inżynieria Oprogramowania  

## 1. Cel i opis projektu

5f-outpost to aplikacja internetowa działająca w przeglądarce, przeznaczona dla firmy
transportowej. Jej głównym użytkownikiem jest dyspozytor transportu, który zarządza
przewozami zamówionych przedmiotów i monitoruje ich realizację. Projekt jest prototypem
ewolucyjnym. Przyjęty stos technologiczny obejmuje Node.js, TypeScript i PostgreSQL.

## 2. Zakres funkcjonalny

Zakres aplikacji obejmuje:

- monitorowanie lokalizacji i statusu transportów;
- ocenę ryzyka opóźnienia i informowanie o nim;
- rejestrację, wyszukiwanie i obsługę zgłoszeń dotyczących dostaw;
- analizę kosztów transportu i raportowanie kosztu na kilometr.

## 3. Użytkownicy i systemy zewnętrzne

### Użytkownicy systemu

| Aktor | Rola w systemie |
|---|---|
| Dyspozytor transportu | Monitoruje trasy, lokalizację, aktualność danych i opóźnienia. |
| Uprawniony użytkownik | Kończy zlecenie transportowe. |
| Pracownik obsługi klienta | Rejestruje zgłoszenia odbiorców, wyszukuje zgłoszenia oraz zarządza ich obsługą i historią. |
| Kierownik firmy transportowej | Analizuje koszty transportów i koszt na kilometr oraz generuje raporty kosztowe. |

### Zewnętrzne systemy współpracujące

| System | Rola |
|---|---|
| System GPS / telematyczny | Współpracuje z wyświetlaniem pozycji pojazdu i czasu ostatniej aktualizacji lokalizacji. |
| System lokalizacyjny / szacowania ETA | Współpracuje z pobieraniem danych do oszacowania przewidywanego czasu przyjazdu (ETA). |

Systemy GPS / telematyczny i lokalizacyjny / szacowania ETA są aktorami zewnętrznymi, a nie
użytkownikami aplikacji.

## 4. Wymagania funkcjonalne

| ID | Nazwa | Wymaganie |
|---|---|---|
| FR-01 | Monitorowanie transportów | System udostępnia dyspozytorowi trasę transportu, pozycję pojazdu na mapie, status zlecenia i czas ostatniej aktualizacji GPS. Sprawdza aktualność danych lokalizacyjnych i informuje o danych nieaktualnych. Uprawniony użytkownik może zakończyć zlecenie; system zapisuje jego nowy status. |
| FR-02 | Wykrywanie opóźnień | System pobiera dane potrzebne do oszacowania ETA, porównuje ETA z planowanym czasem dostawy i ocenia ryzyko opóźnienia. Po przekroczeniu progu oznacza zlecenie jako zagrożone opóźnieniem i generuje powiadomienie. Dyspozytor może wyświetlić szczegóły opóźnienia po otwarciu powiadomienia. Gdy brakuje danych do oceny, system informuje o ich niewystarczającej ilości. |
| FR-03 | Obsługa zgłoszeń | System umożliwia pracownikowi obsługi klienta rejestrowanie zgłoszeń od odbiorców, wprowadzanie i weryfikację wymaganych danych oraz zapis zgłoszenia z unikalnym identyfikatorem. Umożliwia wyszukiwanie zgłoszeń według zlecenia, wyświetlanie ich statusów i chronologicznej historii, dodawanie notatek z autorem i datą utworzenia oraz zmianę statusu z zapisem daty i czasu. Zgłoszenie można zamknąć po weryfikacji wymaganego podsumowania rozwiązania. |
| FR-04 | Analiza kosztów | System umożliwia kierownikowi firmy transportowej wybór okresu raportowania, analizę kosztów transportów i generowanie raportów kosztowych. Raport obejmuje łączny koszt transportu, koszty poszczególnych zleceń i koszty zrealizowanych zleceń. System oblicza koszt na kilometr według wzoru: **Koszt/km = łączny koszt zlecenia / przejechane kilometry**. Obliczenie jest możliwe wyłącznie przy dostępnej wartości kosztu zlecenia i dodatniej liczbie przejechanych kilometrów. W przypadku braku danych kosztowych system wyświetla informację o ich braku. |

## 5. Wymagania niefunkcjonalne

| ID | Nazwa | Kryterium |
|---|---|---|
| NFR-01 | Dostępność | Availability >= 99.5% |
| NFR-02 | Przywracanie usługi | MTTR <= 60 min |
| NFR-03 | Czas między awariami | MTBF >= 720 h |
| NFR-04 | Czas odpowiedzi | p95 <= 2 s |
| NFR-05 | Aktualność pozycji | Opóźnienie aktualizacji <= 30 s |
| NFR-06 | Kontrola dostępu | 100% testów uprawnień |
| NFR-07 | Ochrona transmisji | HTTPS/TLS |
| NFR-08 | Poprawność raportów | 100% zgodności w testach |
| NFR-09 | Integralność zgłoszeń | 100% wymaganych pól |
| NFR-10 | Odtwarzanie po awarii | RPO <= 15 min; RTO <= 60 min |

## 6. Przypadki użycia i historie użytkowników

| Aktor | Główne czynności |
|---|---|
| Dyspozytor transportu | Monitoruje trasę i aktualność lokalizacji transportu oraz korzysta z informacji o ryzyku opóźnienia. |
| Uprawniony użytkownik | Kończy zlecenie transportowe. |
| Pracownik obsługi klienta | Rejestruje i wyszukuje zgłoszenia oraz zarządza ich statusem, historią i notatkami. |
| Kierownik firmy transportowej | Analizuje koszty transportów i koszt na kilometr oraz generuje raporty. |

System GPS / telematyczny współpracuje z wyświetlaniem lokalizacji i czasu jej ostatniej
aktualizacji. System lokalizacyjny / szacowania ETA współpracuje z pobieraniem danych do
oszacowania ETA.

### Historie użytkowników

- Jako dyspozytor chcę widzieć trasę, pozycję GPS, status i czas aktualizacji transportu,
  aby monitorować jego przebieg i rozpoznać nieaktualne dane.
- Jako dyspozytor chcę otrzymywać informację o ryzyku opóźnienia i móc sprawdzić jego
  szczegóły, aby wiedzieć, które zlecenia wymagają uwagi.
- Jako uprawniony użytkownik chcę zakończyć zlecenie transportowe, aby zapisać jego nowy
  status.
- Jako pracownik obsługi klienta chcę rejestrować zgłoszenia oraz śledzić ich status,
  notatki i historię, aby nadzorować ich obsługę do zamknięcia.
- Jako kierownik firmy transportowej chcę analizować koszty w wybranym okresie i przeglądać
  koszt na kilometr, aby oceniać koszty transportu.

## 7. Scenariusze i kryteria akceptacji

| ID / zakres | Scenariusz | Kryterium akceptacji |
|---|---|---|
| FR-01 | Dyspozytor monitoruje wybrany transport. | System udostępnia pozycję pojazdu na mapie, status zlecenia i czas ostatniej aktualizacji GPS; aktualność danych jest sprawdzana, a dane nieaktualne są sygnalizowane. Opóźnienie aktualizacji pozycji spełnia NFR-05. |
| FR-01 | Uprawniony użytkownik kończy zlecenie transportowe. | Zakończenie zlecenia powoduje zapis jego nowego statusu. |
| FR-02 | System ocenia ryzyko opóźnienia na podstawie dostępnych danych. | ETA jest porównywane z planowanym czasem dostawy. Po przekroczeniu progu zlecenie jest oznaczane jako zagrożone opóźnieniem, a system generuje powiadomienie. Po otwarciu powiadomienia dyspozytor może wyświetlić szczegóły. |
| FR-02 | Brakuje danych do oceny opóźnienia. | System informuje o braku wystarczających danych. |
| FR-03 | Pracownik obsługi klienta rejestruje zgłoszenie odbiorcy. | System weryfikuje wymagane dane, zapisuje zgłoszenie i nadaje mu unikalny identyfikator. Kompletność wymaganych pól spełnia NFR-09. |
| FR-03 | Pracownik wyszukuje zgłoszenia według zlecenia i obsługuje zgłoszenie. | System wyświetla znalezione zgłoszenia ze statusami i historią w porządku chronologicznym. Dodana notatka ma autora i datę utworzenia; zmiana statusu zapisuje datę i czas. Zgłoszenie można zamknąć dopiero po weryfikacji wymaganego podsumowania rozwiązania. |
| FR-04 | Kierownik wybiera okres i generuje raport kosztowy. | Raport prezentuje łączny koszt transportu oraz koszty poszczególnych zleceń i zleceń zrealizowanych. Poprawność raportu spełnia NFR-08. |
| FR-04 | Kierownik analizuje koszt na kilometr. | Koszt/km jest obliczany jako łączny koszt zlecenia podzielony przez przejechane kilometry, jeżeli koszt zlecenia jest dostępny, a liczba kilometrów jest dodatnia. Przy braku danych kosztowych system wyświetla informację o ich braku. |

## 8. Powiązania między wymaganiami

### Relacje wymagań funkcjonalnych i niefunkcjonalnych

| Wymaganie źródłowe | Relacja | Wymaganie powiązane |
|---|---|---|
| FR-01 | `refine` | NFR-05 |
| FR-02 | `refine` | NFR-04 |
| FR-03 | `refine` | NFR-09 |
| FR-04 | `refine` | NFR-08 |
| NFR-01 | `deriveReq` | NFR-02 |
| NFR-01 | `deriveReq` | NFR-03 |
| NFR-01 | `deriveReq` | NFR-10 |

Relacje `include` i `extend` oraz warunki ich wykonania przedstawiono na diagramach
przypadków użycia: [monitorowanie transportów](../../docs/monitorowanie.png),
[wykrywanie opóźnień](../../docs/opoznienia.png),
[rejestracja zgłoszeń](../../docs/rejestracja_zgloszen.png),
[obsługa zgłoszeń](../../docs/obsluga_zgloszen.png) i
[analiza kosztów](../../docs/koszty.png).
