# 4321 Puzzle

[Українська](#українська) | [English](#english)

---

## <a name="українська"></a>🇺🇦 Українська

Репозиторій розділений на дві версії:

### 1. `release/` — Полегшена версія для GitHub Pages
- **Призначення**: Публічна версія для гравців на [GitHub Pages](https://kharakhash.github.io/).
- **Особливості**:
  - Класичний геймплей на квадратних полях (від 3х3 до 10х10).
  - Режими гри: Нескінченний (Infinity) та Квест (Quest).
  - Перемикач мови інтерфейсу UKR / ENG у налаштуваннях із збереженням у `localStorage`.
  - Підтримка темної та світлої тем, плавні анімації, перемикач відображення значень.
  - Виправлено дублювання записів у статистиці.
  - Оптимізовано без експериментальних гексагональних полів та конструктора.

### 2. `project/` — Повна версія з розширеними можливостями
- **Призначення**: Повний проект з усіма експериментальними модулями та інструментами розробника.
- **Особливості**:
  - Повна модульна архітектура (`EventBus`, `StateManager`, `StorageService`, `AnimationService`, `ModeRules`, `GameCore`, `I18nService`).
  - Підтримка перемикання мов UKR / ENG на льоту.
  - Режими гри: Нескінченний (Infinity), Квест (Quest) та Акуре (Akure).
  - Підтримка гексагональних полів (3х3х3, 5х5х5) з розрахунком кубічних координат та стільникової сітки.
  - Екранний контролер `hexControlsPad` та керування 6 напрямками (клавіатура, свайпи).
  - Конструктор рівнів (Level Editor) із DSL-парсером та збереженням у файли.
  - Повний набір автоматизованих модульних тестів.

### Запуск та тестування
- **Запуск усіх тестів**:
  ```bash
  npm test
  ```
- **Запуск тестів лише для project**:
  ```bash
  npm run test:project
  ```
- **Запуск тестів лише для release**:
  ```bash
  npm run test:release
  ```
- **Локальний запуск веб-сервера**:
  ```bash
  python3 -m http.server 8000
  ```
  - `http://localhost:8000/` — кореневий шлюз автоматично перенаправляє на `./release/`
  - `http://localhost:8000/release/` — запуск версії release
  - `http://localhost:8000/project/` — запуск версії project

---

## <a name="english"></a>🇬🇧 English

The repository is divided into two versions:

### 1. `release/` — Lightweight Version for GitHub Pages
- **Target**: Public deployment for players on [GitHub Pages](https://kharakhash.github.io/).
- **Features**:
  - Classic gameplay on square grids (3x3 up to 10x10).
  - Game modes: Infinity and Quest.
  - Interactive UKR / ENG language switcher in Settings with `localStorage` persistence.
  - Dark and light theme support, smooth animations, value toggle.
  - Fixed duplicate records in statistics.
  - Cleaned up without experimental hex boards or level builder.

### 2. `project/` — Full Version with Extended Features
- **Target**: Complete project with all experimental modules and developer tools.
- **Features**:
  - Modular architecture (`EventBus`, `StateManager`, `StorageService`, `AnimationService`, `ModeRules`, `GameCore`, `I18nService`).
  - Real-time UKR / ENG language switching.
  - Game modes: Infinity, Quest, and Akure.
  - Hexagonal grid support (3x3x3, 5x5x5) using cubic coordinates and axial offsets.
  - On-screen `hexControlsPad` and 6-direction movement (keyboard & touch swipe).
  - Custom Level Editor with DSL parser/serializer and file export/import.
  - Comprehensive automated test suite.

### Running and Testing
- **Run all automated tests**:
  ```bash
  npm test
  ```
- **Run project tests only**:
  ```bash
  npm run test:project
  ```
- **Run release tests only**:
  ```bash
  npm run test:release
  ```
- **Run local server**:
  ```bash
  python3 -m http.server 8000
  ```
  - `http://localhost:8000/` — root gateway automatically redirects to `./release/`
  - `http://localhost:8000/release/` — launch release version
  - `http://localhost:8000/project/` — launch project version
