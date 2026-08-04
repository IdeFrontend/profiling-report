# Отчёт: переиспользование Swimlane Webview в другом VS Code-плагине

> **Supersession notice (English, 2026-07-31)**  
> This document is an **archival** research note (Russian). For profiling-report decisions, prefer:
>
> - [PROJECT_GOALS.md](../context/PROJECT_GOALS.md)
> - [ARCHITECTURE.md](../specs/architecture/ARCHITECTURE.md) — packaging is a **Vue 3 library**, not a sealed HTML webview bundle
> - [SWIMLANE_IMPLEMENTATIONS.md](SWIMLANE_IMPLEMENTATIONS.md) — PyPTO Canvas vs Sudu WebGL vs hybrid
>
> **Still useful from this report:** PyPTO swimGraph structure, coupling risks, TraceModel DTO sketch, streaming chunk idea, capability flags, extraction risks (singletons, license check).  
> **Overridden:** primary delivery as `swimlane-webview` HTML bundle + host `postMessage` protocol. MSTT will import Vue components into its existing Vite webviews instead. PyPTO itself is not required to adopt the shared library in v1 (copy-paste allowed).

**Дата:** 30 июля 2026 года  
**Статус:** архитектурное исследование (**архив** / archived)  
**Область:** `vscode_plugins/pypto_toolkit`  

## 1. Цель исследования

Определить:

1. Как реализован текущий renderer swimlane.
2. Можно ли переиспользовать его в другом VS Code-плагине.
3. Можно ли вынести только webview-часть и унифицировать взаимодействие с ней.
4. Что будет быстрее: адаптация существующей реализации или новый renderer с нуля.

## 2. Итоговый вывод

Текущую реализацию **можно переиспользовать в другом VS Code-плагине**, однако она пока не является автономным Vue-компонентом или готовой библиотекой.

Рекомендуемый вариант — вынести её как **готовое webview-приложение** и определить версионируемый типизированный протокол обмена сообщениями между webview и host-плагином.

```text
┌────────────────────┐       ┌────────────────────┐
│ VS Code Plugin A   │       │ VS Code Plugin B   │
│                    │       │                    │
│ parser / cache     │       │ parser / cache     │
│ HostAdapter        │       │ HostAdapter        │
└─────────┬──────────┘       └─────────┬──────────┘
          │     единый postMessage API │
          └──────────────┬─────────────┘
                         ▼
              ┌──────────────────────┐
              │ Swimlane Webview     │
              │                      │
              │ Vue UI               │
              │ Canvas renderer      │
              │ Model / layout / LOD │
              └──────────────────────┘
```

Полный rewrite не рекомендуется, если требуется сохранить значительную часть существующей функциональности. Новый renderer будет быстрее только для намеренно ограниченного viewer: дорожки, timeline, базовый zoom/pan и выбор события.

## 3. Как устроена текущая реализация

### 3.1. Общий поток данных

```text
JSON / perf_swimlane / PMU / topology
                    │
                    ▼
          SwimGraphMsgHandler
       parsing / conversion / cache
                    │
                    ▼
             canonical SwimData
                    │ stream / compression
                    ▼
          swimGraphComplete.vue
       model / state / layout / scheduling
                    │
                    ▼
         многослойный Canvas renderer
     timeline / lanes / events / dependencies
```

### 3.2. Extension/backend

Открытие swimlane начинается через команду или service API:

- [`src/command/registerCommand.ts`](vscode_plugins/pypto_toolkit/src/command/registerCommand.ts) — открытие `swimGraph` и переход к событию по `seqNo/taskId`;
- [`src/view/routes.ts`](vscode_plugins/pypto_toolkit/src/view/routes.ts) — сопоставление route и `SwimGraphServer`;
- [`src/view/servers/swim-graph-server.ts`](vscode_plugins/pypto_toolkit/src/view/servers/swim-graph-server.ts) — API webview-сервера;
- [`src/handler/swimGraphMsgHandler.ts`](vscode_plugins/pypto_toolkit/src/handler/swimGraphMsgHandler.ts) — основная orchestration-логика.

Backend выполняет:

- определение входного формата;
- потоковое чтение больших JSON;
- преобразование `perf_swimlane` в Chrome Trace;
- чтение `tilefwk_prof_pmu.csv`;
- чтение `dyn_topo.txt`;
- расчёт зависимостей;
- построение процессов, потоков, событий и дорожек;
- SQLite-кеширование;
- сжатие через `@pypto/data-compress`;
- передачу данных во frontend пакетами.

Канонический parser находится в [`src/process.ts`](vscode_plugins/pypto_toolkit/src/process.ts), а преобразователь perf-формата — в [`src/converter/perfSwimlaneConverter.ts`](vscode_plugins/pypto_toolkit/src/converter/perfSwimlaneConverter.ts).

### 3.3. Webview/frontend

Корневой компонент — [`swimGraphComplete.vue`](vscode_plugins/pypto_toolkit/media/vue-project/src/components/swimGraph/swimGraphComplete.vue).

При монтировании он:

1. Запрашивает конфигурацию, путь и тип графа через `useViewServer()`.
2. Получает сжатые данные либо `ReadableStream`.
3. Собирает процессы, потоки и события.
4. Инициализирует `SwimDataManager`.
5. Строит mipmap/LOD для больших наборов событий.
6. Рассчитывает layout.
7. Создаёт и масштабирует Canvas.
8. Запускает общий render.

Корневой компонент одновременно выполняет роли:

- data loader;
- владельца состояния;
- координатора layout;
- render scheduler;
- VS Code adapter;
- UI shell.

### 3.4. Модель данных

[`swimData.ts`](vscode_plugins/pypto_toolkit/media/vue-project/src/components/swimGraph/swimData.ts) содержит `SwimDataManager`, который хранит:

- процессы и потоки;
- индекс событий;
- зависимости;
- mix/wrap-модель;
- порядок и координаты дорожек;
- поиск событий по `seqNo/taskId`.

Сейчас `SwimDataManager` является глобальным singleton. Это создаёт риск конфликтов при одновременном использовании нескольких экземпляров viewer в одной webview.

### 3.5. Renderer

Swimlane не использует D3 для основной отрисовки. Это собственный Canvas renderer.

Основная иерархия:

```text
swimGraphComplete.vue
├─ SwimGraphHeader
├─ SwimGraphTimeline
├─ SwimGraphProcesses
│  └─ SwimGraphProcessItem
│     ├─ SwimGraphProcessHeader
│     ├─ SwimGraphThreadLabels
│     └─ SwimGraphThreadEvents
├─ GlobalConnectionCanvas
├─ GlobalMeasureCanvas
├─ PinnedThreadsContainer
├─ detail / config / performance panels
└─ AICPU-specific panels
```

Для каждого процесса создаётся несколько Canvas-слоёв. Они определены в [`swimGraphThreadEvents.vue`](vscode_plugins/pypto_toolkit/media/vue-project/src/components/swimGraph/swimGraphProcesses/swimGraphThreadEvents.vue):

- события;
- текст и UI;
- зависимости;
- hover;
- background;
- selection;
- mix/wrap;
- three-column overlay.

Низкоуровневая отрисовка событий реализована в [`eventRender.ts`](vscode_plugins/pypto_toolkit/media/vue-project/src/components/swimGraph/swimGraphProcesses/render/eventRender.ts).

Для производительности используются:

- mipmap/LOD;
- фильтрация по видимой области;
- раздельные Canvas-слои;
- `requestAnimationFrame`;
- отдельные быстрый и полный resize-проходы;
- ручное преобразование координат при больших смещениях;
- потоковая загрузка;
- бинарное сжатие.

## 4. Текущее архитектурное сцепление

Физически код уже расположен в отдельном каталоге `components/swimGraph`, но архитектурно зависит от приложения.

Основные зависимости:

- `useViewServer()`;
- `getQuery()`;
- `pullState()` и `pushState()`;
- `window.vscode`;
- `window.staticPath`;
- `window.ascEventBus`;
- root inject темы;
- `vue-i18n`;
- Vue DevUI;
- three-column context;
- compute graph navigation;
- navbar и welcome guide;
- `@pypto/data-compress`;
- глобальные `swimDataManager`, `ctxs`, `canvasPool` и `threadCache`.

Корневой компонент передаёт дочерним компонентам большое количество состояния и методов через строковые `provide/inject`:

- `swimGraphState`;
- `swimGraphMethods`;
- `swimGraphSearch`;
- `swimGraphCfg`;
- `swimGraphPmuTotal`;
- `swimGraphPinnedState`.

Это внутренний неформальный API. Публичного контракта вида `data + config + events` сейчас нет.

## 5. Масштаб реализации

Приблизительный размер frontend-подсистемы:

| Элемент | Размер |
|---|---:|
| Каталог `components/swimGraph` | около 75 файлов |
| Общий объём | около 35 тысяч строк |
| Vue-компоненты | 36 |
| CSS-файлы | 21 |
| `swimGraphComplete.vue` | около 3780 строк |
| `swimGraphThreadEvents.vue` | около 4370 строк |
| `swimData.ts` | около 1367 строк |

Автоматизированных тестов, специально проверяющих swimlane renderer, в ходе исследования не найдено. Это основной риск как extraction, так и rewrite.

## 6. Можно ли вынести только webview

Да. Для нескольких VS Code-плагинов целесообразно вынести не только Vue-компонент, а **готовый собранный webview bundle**.

Преимущества готового bundle:

- host-плагин не обязан использовать Vue;
- host-плагин не зависит от версии Vue DevUI;
- CSS и frontend-зависимости собираются один раз;
- интеграция ограничивается HTML, CSP, asset URI и `postMessage`;
- один и тот же webview можно подключать в разных расширениях.

### 6.1. Что оставить внутри webview

- Vue UI;
- Canvas renderer;
- timeline;
- zoom/pan;
- selection и hit testing;
- поиск;
- layout;
- mipmap/LOD;
- внутренние индексы;
- панели деталей;
- визуализацию зависимостей;
- подготовку изображения для export.

### 6.2. Что оставить в host-плагине

- чтение файлов;
- VS Code API;
- file dialogs;
- настройки VS Code;
- кеш и storage;
- notifications;
- сохранение файлов;
- переход к другим view;
- получение темы и языка;
- специфичный parser, если плагины используют разные форматы.

## 7. Рекомендуемый протокол

Протокол должен быть:

- типизированным;
- версионируемым;
- сериализуемым;
- независимым от Vue и VS Code implementation details;
- поддерживающим потоковую передачу больших trace.

### 7.1. Host → webview

```typescript
type HostToWebviewMessage =
  | {
      type: 'initialize';
      protocolVersion: 1;
      theme: 'light' | 'dark';
      locale: string;
      capabilities: SwimlaneCapability[];
      config: SwimlaneConfig;
    }
  | {
      type: 'trace/start';
      requestId: string;
      metadata: TraceMetadata;
    }
  | {
      type: 'trace/chunk';
      requestId: string;
      chunk: TraceChunk;
    }
  | {
      type: 'trace/complete';
      requestId: string;
    }
  | {
      type: 'event/locate';
      seqNo: number;
      taskId: number;
    }
  | {
      type: 'theme/change';
      theme: 'light' | 'dark';
    };
```

### 7.2. Webview → host

```typescript
type WebviewToHostMessage =
  | { type: 'ready'; protocolVersion: 1 }
  | { type: 'event/selected'; event: SelectedEvent }
  | { type: 'export/save'; requestId: string; data: ArrayBuffer }
  | { type: 'notification/show'; level: string; text: string }
  | { type: 'compute-graph/open'; hash?: string }
  | { type: 'config/change'; config: Partial<SwimlaneConfig> }
  | { type: 'error'; error: SerializedError };
```

### 7.3. Потоковая передача

Большие trace не следует отправлять одним сообщением:

```text
trace/start
     ↓
trace/chunk × N
     ↓
trace/complete
```

Текущая реализация уже использует близкий подход: сначала передаётся общая структура, затем события пакетами.

## 8. Канонический wire-формат

Через протокол должны передаваться только сериализуемые DTO. Не следует отправлять `Map`, Vue `ref`, Canvas context, `renderInfo` или `drawData`.

Пример минимальной модели:

```typescript
interface TraceModel {
  processes: TraceProcess[];
  minTime: number;
  maxTime: number;
  metadata?: Record<string, unknown>;
}

interface TraceProcess {
  id: string;
  name: string;
  type: 'kernel' | 'aicpu' | 'counter' | 'custom';
  threads: TraceThread[];
}

interface TraceThread {
  id: string;
  name: string;
  events: TraceEvent[];
}

interface TraceEvent {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  args?: Record<string, unknown>;
  dependencies?: {
    predecessors: string[];
    successors: string[];
  };
}
```

После получения DTO webview самостоятельно строит:

- `Map` и индексы;
- mipmap;
- координаты;
- `renderInfo`;
- `drawData`;
- внутренний layout.

## 9. Capabilities

Разные плагины не обязаны поддерживать одинаковые возможности. Host должен передавать список доступных функций:

```typescript
type SwimlaneCapability =
  | 'export'
  | 'dependencies'
  | 'measurement'
  | 'pinning'
  | 'pmu'
  | 'computeGraphNavigation'
  | 'mixMode';
```

Webview скрывает или блокирует UI функций, отсутствующих у host-плагина.

## 10. Предлагаемая структура пакетов

```text
packages/
├── swimlane-protocol/
│   ├── messages.ts
│   ├── trace-model.ts
│   ├── capabilities.ts
│   └── version.ts
│
├── swimlane-webview/
│   ├── Vue/Vite application
│   ├── Canvas renderer
│   ├── model / layout / LOD
│   └── dist/
│
└── swimlane-parser/          # опционально
    └── raw input → TraceModel
```

Каждый VS Code-плагин:

1. Поставляет `swimlane-webview/dist` вместе с расширением.
2. Создаёт `WebviewPanel`.
3. Настраивает CSP и webview URI для ресурсов.
4. Реализует host-side обработчики `swimlane-protocol`.
5. Передаёт данные и capabilities.

## 11. Стратегия выделения

Не требуется сразу рефакторить всю подсистему.

### Этап 1. Зафиксировать поведение

- определить обязательный feature scope;
- выбрать репрезентативные trace fixtures;
- добавить protocol tests;
- добавить visual regression screenshots;
- зафиксировать performance baseline.

### Этап 2. Ввести внешний bridge

Создать интерфейс, скрывающий текущий `useViewServer()`:

```typescript
interface SwimlaneHostBridge {
  initialize(): Promise<HostConfiguration>;
  loadTrace(): AsyncIterable<TraceChunk>;
  saveFile(file: ExportedFile): Promise<void>;
  showMessage(message: HostMessage): Promise<void>;
  openComputeGraph?(target: ComputeGraphTarget): Promise<void>;
  updateConfiguration?(config: Partial<SwimlaneConfig>): Promise<void>;
}
```

На первом этапе допустимы:

- `CurrentPyPTOAdapter`;
- `FuturePluginAdapter`;
- `BrowserMockAdapter` для разработки и тестирования.

### Этап 3. Отделить загрузку от renderer

- перестать загружать trace непосредственно в `swimGraphComplete.vue`;
- принимать данные через bridge или `dataSource`;
- оставить существующие внутренние `provide/inject` без массовой переделки.

### Этап 4. Устранить глобальные singleton

- создавать `SwimDataManager` на экземпляр viewer;
- сделать Canvas registry instance-scoped;
- локализовать keyboard, measure и cache state.

### Этап 5. Упаковать webview

- отдельная Vite build-конфигурация;
- относительные или передаваемые asset URI;
- CSP-compatible загрузка;
- версионирование протокола;
- проверка интеграции минимум с двумя host adapters.

## 12. Сравнение вариантов

| Вариант | Когда подходит | Оценка | Риск |
|---|---|---:|---|
| Скопировать каталог без изменения API | Краткий одноразовый прототип | 3–7 дней | Высокий технический долг |
| Вынести webview + protocol | Два и более VS Code-плагина | 3–6 недель | Средний |
| Полностью reusable Vue package | Все потребители используют совместимый Vue stack | 6–12 недель | Средний–высокий |
| Новый базовый renderer | Только lanes/timeline/zoom/select | 4–8 недель | Средний |
| Полный rewrite с feature parity | Почти никогда | 4–7 месяцев | Очень высокий |

Оценки ориентировочные, для одного инженера, с учётом стабилизации API и тестирования.

## 13. Когда rewrite действительно выгоден

Новый renderer может быть быстрее, если достаточно следующего scope:

```text
Chrome Trace JSON
        ↓
process/thread lanes
        ↓
timeline + event rectangles
        ↓
zoom / pan / event selection
```

При этом должны быть явно исключены:

- PMU;
- AICPU;
- PerfSwim и MsProf;
- Mix/wrap;
- сложные зависимости;
- compression/cache;
- measurement;
- pinning;
- performance panel;
- three-column linkage;
- полная совместимость с текущим UI.

Если требуется значительная часть этого списка, переиспользование текущего renderer дешевле полного rewrite.

## 14. Риски

1. **Отсутствие тестовой oracle.** Перед extraction нужны fixtures и визуальные тесты.
2. **Неформальная внутренняя модель.** Большое количество `any` и мутаций входных объектов.
3. **Глобальное состояние.** Возможны конфликты нескольких экземпляров.
4. **Большие данные.** Необходимо сохранить streaming, compression и LOD.
5. **Скрытые DOM-зависимости.** Используются глобальные selectors и `window.*`.
6. **Версионирование.** Webview и host могут обновляться независимо.
7. **Лицензия.** Перед переносом в отдельный проект необходимо проверить условия `CANN Open Software License Agreement Version 2.0`.

## 15. Критерий принятия решения

Следует выбирать extraction существующего webview, если выполняется хотя бы одно условие:

- нужны большие trace;
- нужны PMU или AICPU;
- нужны dependencies, Mix или path locking;
- нужны measurement, pinning или search;
- требуется близкое визуальное и функциональное соответствие текущему viewer;
- viewer планируется использовать более чем в одном расширении.

Следует выбирать узкий rewrite, если:

- нужен только базовый timeline viewer;
- входной формат можно ограничить;
- допустима несовместимость с текущей реализацией;
- расширенные возможности точно не входят в roadmap.

## 16. Рекомендация

Для планируемого второго VS Code-плагина рекомендуется:

1. Не переписывать полный renderer с нуля.
2. Не публиковать текущий каталог `components/swimGraph` как есть.
3. Вынести готовое webview-приложение.
4. Определить отдельный пакет `swimlane-protocol`.
5. Передавать сериализуемый `TraceModel` потоковыми сообщениями.
6. Использовать capabilities для опциональных функций.
7. Реализовать adapter текущего PyPTO Toolkit как первый потребитель.
8. Новый плагин сразу проектировать под тот же протокол.
9. Вынести parser отдельно только при подтверждённой потребности обоих плагинов в одинаковых входных форматах.

Итоговая целевая граница:

```text
TraceSource / Parser
          │
          ▼
    typed TraceModel
          │
          ▼
 Layout + RenderCore
          │
          ▼
   Swimlane Webview
          │
          ├─ Current PyPTO HostAdapter
          └─ Future Plugin HostAdapter
```

Такой подход позволяет переиспользовать наиболее сложную и ценную часть системы — модель, layout, LOD и Canvas renderer — не перенося в новый плагин инфраструктуру текущего расширения.
