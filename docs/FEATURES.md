# air-J — Feature Reference Documentation

> **Last updated:** 2026-06-14
> **Maintained by:** Antigravity AI + User
>
> This document is the canonical reference for every feature in the air-J task manager.
> Each feature has a unique name that both human and AI collaborators can reference
> unambiguously in future conversations. Update this file whenever core files change.

---

## Table of Contents

1. [Kanban Board](#1-kanban-board)
2. [Task CRUD](#2-task-crud)
3. [Task Card](#3-task-card)
4. [Quick Shift Controls](#4-quick-shift-controls)
5. [Drag & Drop](#5-drag--drop)
6. [Category System](#6-category-system)
7. [Category Filtering](#7-category-filtering)
8. [Priority Filtering](#8-priority-filtering)
9. [Global Search](#9-global-search)
10. [Day Review Panel](#10-day-review-panel)
11. [Theme Switcher](#11-theme-switcher)
12. [Dashboard Overview](#12-dashboard-overview)
13. [Progress Analytics](#13-progress-analytics)
14. [Mobile Responsive Layout](#14-mobile-responsive-layout)
15. [Toast Notifications](#15-toast-notifications)
16. [Data Persistence](#16-data-persistence)
17. [Design System](#17-design-system)
18. [Branding](#18-branding)
19. [Scrum Mode & Backlog](#19-scrum-mode--backlog)
20. [Sprint Lifecycle & Header Widget](#20-sprint-lifecycle--header-widget)
21. [Sprint Review Bottom Sheet](#21-sprint-review-bottom-sheet)
22. [Sprint History & Storage Limits](#22-sprint-history--storage-limits)

---

## 1. Kanban Board

**Description:**
The primary workspace area that organises tasks into three status columns: **To Do**, **Doing**, and **Done**. Tasks are rendered as cards within their respective columns, and each column displays a live count of its filtered tasks.

**Files & DOM IDs:**

| File | Reference |
|---|---|
| `src/index.html` | `#column-todo`, `#column-doing`, `#column-done` |
| `src/index.html` | `#todo-cards-list`, `#doing-cards-list`, `#done-cards-list` |
| `src/index.html` | `#todo-count`, `#doing-count`, `#done-count` |
| `src/app.js` | `renderAppUI()` — main render loop |
| `src/styles.css` | `.kanban-board`, `.kanban-column`, `.column-cards-list` |

**Rendering Logic:**
- `renderAppUI()` clears all three column card lists, then iterates through the filtered task array
- Each task is passed to `createTaskCardDOM(task)` and appended to the appropriate column based on `task.status`
- After rendering, `renderEmptyStatePlaceholder()` is called for each column to show a dashed placeholder if empty
- Column header counts are updated via `updateStatsAndBadges(counts)`

**Sorting / Ordering:**
- Tasks are rendered in **array insertion order** — there is no explicit sort applied
- New tasks are appended to the end of the `tasks[]` array via `tasks.push()`
- The order in each column reflects the order tasks appear in the master array, filtered by status

**Empty States:**
- `renderEmptyStatePlaceholder(listEl, columnStatus)` inserts a styled placeholder with contextual messaging:
  - To Do → "No tasks to do"
  - Doing → "Nothing active in progress"
  - Done → "No completed tasks yet"

**Platform Behaviour:**

| Aspect | Desktop (≥768px) | Mobile (<768px) |
|---|---|---|
| Layout | 3-column CSS grid (`grid-template-columns: repeat(3, 1fr)`) | Single column (`grid-template-columns: 1fr`) |
| Column visibility | All three visible simultaneously | Only the active tab's column is visible (`display: none` / `.active-tab`) |
| Column headers | Visible with status dot, title, count badge, and add button | Hidden (`display: none`) — replaced by the segmented tab control |
| Column max height | `max-height: 75vh` with scroll | No max height, full stretch |
| Column styling | Surface background, border, border-radius, box-shadow | Transparent background, no border, no shadow |
| Entry animation | Card fade-in only | Column switches animate with `tabFadeIn` (slide from right) |

---

## 2. Task CRUD

**Description:**
The create, read, update, and delete lifecycle for tasks. All mutations go through a single modal dialog that operates in either **Create** or **Edit** mode. Deletion uses a native `confirm()` dialog.

**Files & DOM IDs:**

| File | Reference |
|---|---|
| `src/index.html` | `#task-modal`, `#task-creation-form`, `#edit-task-id` |
| `src/index.html` | `#form-task-title`, `#form-task-desc`, `#form-task-category`, `#form-task-priority`, `#form-task-status`, `#form-task-due` |
| `src/index.html` | `#modal-action-title`, `#form-submit-btn`, `#form-cancel-btn`, `#modal-close-btn` |
| `src/app.js` | `openTaskDialog(task?)`, `closeTaskDialog()`, form submit handler, `deleteTask(id)` |

**Task Data Model:**

```js
{
    id: Number,          // Unique ID — Date.now() for new tasks, integer for defaults
    title: String,       // Required — task name
    description: String, // Optional — additional context
    category: String,    // Category name string (e.g. "Work")
    priority: String,    // "Low" | "Medium" | "High"
    status: String,      // "todo" | "doing" | "done"
    dueDate: String      // ISO date string "YYYY-MM-DD" or empty string
}
```

**Field Validations:**

| Field | Validation | Enforced by |
|---|---|---|
| `title` | **Required** — must be non-empty after `.trim()` | JS: `if (!title) return;` — silently prevents submission |
| `title` | HTML `required` attribute on the input | Browser native validation |
| `description` | Optional — no length limit enforced | — |
| `category` | Always populated from the `<select>` dropdown | Defaults to first category if none selected |
| `priority` | Always populated from the `<select>` dropdown | Defaults to `"Medium"` (HTML `selected` attribute) |
| `status` | Always populated from the `<select>` dropdown | Defaults to `"todo"` or matches `window.activeColumnShortcut` |
| `dueDate` | Optional — browser-native date picker | No custom validation; empty string if not set |

**Create Flow:**
1. User clicks Create Task button (header, FAB, or column `+` button)
2. `openTaskDialog()` called with no argument → Create mode
3. Form is reset; `#edit-task-id` set to empty string
4. Title reads "Create Task", submit button reads "Save Task"
5. If triggered from a column `+` button, `window.activeColumnShortcut` pre-sets the status dropdown
6. On submit: new task object created with `id: Date.now()`, pushed to `tasks[]`
7. `saveTasks()` → `closeTaskDialog()` → `renderAppUI()`

**Edit Flow:**
1. User clicks the card body (`.card-edit-trigger`)
2. `openTaskDialog(task)` called with the existing task object → Edit mode
3. All form fields pre-populated from the task object
4. Title reads "Edit Task Flow", submit button reads "Update Task"
5. `#edit-task-id` set to the task's ID
6. On submit: existing task found by ID in `tasks[]`, properties mutated in-place
7. `saveTasks()` → `closeTaskDialog()` → `renderAppUI()`

**Delete Flow:**
1. User clicks the trash icon (`.delete-card-trigger`) on a card
2. `deleteTask(id)` called
3. Native `confirm()` dialog shown: `Are you sure you want to remove "<title>"?`
4. If confirmed: `tasks` filtered to exclude the ID, `saveTasks()`, `renderAppUI()`

**Key Functions:**

| Function | Signature | Purpose |
|---|---|---|
| `openTaskDialog` | `(task?: Object) → void` | Opens modal in Create (no arg) or Edit (with task) mode |
| `closeTaskDialog` | `() → void` | Closes modal, restores scroll, clears `activeColumnShortcut` |
| `deleteTask` | `(id: Number) → void` | Confirms and removes task from array |

**Platform Behaviour:**

| Aspect | Desktop (≥768px) | Mobile (<768px) |
|---|---|---|
| Modal appearance | Centered overlay with scale-in animation | Same overlay (drag handle visible at top) |
| Trigger buttons | Header "Create Task" button + column `+` buttons + FAB | FAB only (header and dashboard hidden) |
| Scroll lock | `document.body.style.overflow = 'hidden'` on open | Same |

---

## 3. Task Card

**Description:**
The visual card component rendered for each task inside a Kanban column. Displays the task's category badge, priority pill, title, truncated description, due date with contextual styling, and action controls.

**Files & Functions:**

| File | Reference |
|---|---|
| `src/app.js` | `createTaskCardDOM(task)` — builds and returns the card DOM element |
| `src/app.js` | `escapeHTML(str)` — XSS protection for title and description |
| `src/styles.css` | `.task-card`, `.task-card-header`, `.task-card-body`, `.task-card-footer` |

**Card Structure:**
```
┌─────────────────────────────────────┐
│ [Category Badge] [Priority Pill]  🗑 │  ← .task-card-header
│                                     │
│ Task Title                          │  ← .task-card-body (.card-edit-trigger)
│ Description text (2 lines max)...   │
│                                     │
│ 📅 Jun 15 (Today)       [← →]      │  ← .task-card-footer
└─────────────────────────────────────┘
```

**Due Date Visual Treatment:**
- Rendered only when `task.dueDate` is non-empty
- Date formatted as `"Mon DD"` (e.g. "Jun 15") via `toLocaleDateString('en-US', { month: 'short', day: 'numeric' })`
- Contextual CSS classes applied (only when `task.status !== 'done'`):

| Condition | CSS Class | Visual Effect |
|---|---|---|
| `dueDate < today` | `.overdue` | Red text (`#EF4444`) + "(Overdue)" suffix |
| `dueDate === today` | `.today` | Amber text (`#F59E0B`) + "(Today)" suffix |
| `dueDate > today` | (none) | Default muted text |

- Timezone handling: due date parsed as `task.dueDate + 'T23:59:59'` to prevent date-shifting across timezones

**Description Truncation:**
- CSS line clamp: `-webkit-line-clamp: 2` — descriptions are truncated to 2 visible lines with ellipsis overflow

**XSS Protection:**
- `escapeHTML(str)` replaces `& < > ' "` with HTML entities before injecting into innerHTML
- Applied to both `task.title` and `task.description`

**Card DOM ID Pattern:**
- Each card gets `id="task-id-{task.id}"` for direct DOM targeting

**Card Animations:**
- Entry: `taskCardFadeIn` keyframe — fades in and slides up 10px over 0.3s
- Hover: border highlights to accent colour, lifts 2px (`translateY(-2px)`), shadow deepens
- Dragging: opacity 0.4, dashed border, scales down to 0.96

**Platform Behaviour:**

| Aspect | Desktop (≥768px) | Mobile (<768px) |
|---|---|---|
| Card padding | 16px | 14px |
| Title font size | 14px | 13px |
| Description font size | 12px | 11px |
| Border radius | `--radius-md` (14px) | `--radius-sm` (10px) |
| Cursor | `grab` / `grabbing` | Default (no drag) |

---

## 4. Quick Shift Controls

**Description:**
Arrow buttons on each task card's footer that allow one-tap status transitions. These provide a touch-friendly alternative to drag-and-drop, and are the **primary status-change mechanism on mobile**.

**Files & Functions:**

| File | Reference |
|---|---|
| `src/app.js` | `shiftTaskStatus(task, direction)` |
| `src/app.js` | Quick shift button event listeners inside `createTaskCardDOM()` |
| `src/styles.css` | `.card-nav-controls`, `.quick-shift-btn` |

**Status Sequence:**
```
todo  ←→  doing  ←→  done
```
The sequence is defined as `['todo', 'doing', 'done']`. Movement is bounded — you cannot shift left from "todo" or right from "done".

**Buttons Per Column:**

| Current Status | Buttons Shown | Direction | Action |
|---|---|---|---|
| `todo` | → (right arrow) | `next` | Move to `doing` |
| `doing` | ← (left arrow) + ✓ (checkmark) | `prev` / `next` | Move to `todo` / Move to `done` |
| `done` | ← (left arrow) | `prev` | Move to `doing` |

**Function: `shiftTaskStatus(task, direction)`**
- Accepts a task object and `"next"` or `"prev"` direction string
- Calculates the new index in the status sequence
- If the index changed: mutates `task.status`, calls `saveTasks()`, `renderAppUI()`, and shows a contextual toast

**Toast Messages:**
- → doing: `"Task started (Moving to Doing)."`
- → done: `"Task completed (Moving to Done)."`
- → todo: `"Task deferred (Moving to To Do)."`

**Platform Behaviour:**
Identical on both platforms. However, on mobile these buttons are the **only** way to change task status since drag-and-drop is not available.

---

## 5. Drag & Drop

**Description:**
Desktop-only HTML5 drag-and-drop that allows tasks to be moved between Kanban columns by dragging a card and releasing it over a target column.

**Files & Functions:**

| File | Reference |
|---|---|
| `src/app.js` | `setupDragAndDropHandlers()` — registers column-level listeners |
| `src/app.js` | `dragstart` / `dragend` listeners inside `createTaskCardDOM()` |
| `src/styles.css` | `.task-card.dragging`, `.kanban-column.drag-over` |

**Implementation Details:**
- Each task card has `draggable="true"` set as an HTML attribute
- `dragstart`: adds `.dragging` class to card, sets `dataTransfer` with `task.id` as plain text
- `dragend`: removes `.dragging` class
- Column listeners (`dragenter`, `dragover`): prevent default, add `.drag-over` visual feedback class
- `dragleave`: removes `.drag-over` class
- `drop`: reads task ID from `dataTransfer`, finds task in array, updates `task.status` to the target column's `data-status`, saves and re-renders

**Visual Feedback:**
- Dragging card: opacity 0.4, dashed accent border, scale 0.96, no shadow
- Target column: accent border, hover background, slight scale-up (1.01), glow shadow

**Platform Behaviour:**

| Aspect | Desktop (≥768px) | Mobile (<768px) |
|---|---|---|
| Availability | Fully functional | **Not available** — HTML5 drag events don't fire on touch |
| Alternative | — | Quick Shift Controls (Feature #4) |
| Visual feedback | `.drag-over` column highlighting | N/A |

---

## 6. Category System

**Description:**
A user-manageable tagging system for organising tasks by project or context. Categories have a name and a colour. The system includes a dedicated management modal for creating and deleting categories.

**Files & DOM IDs:**

| File | Reference |
|---|---|
| `src/index.html` | `#category-manager-modal`, `#category-manager-list`, `#add-category-form` |
| `src/index.html` | `#new-cat-name`, `#new-cat-color-picker` |
| `src/index.html` | `#sidebar-manage-cat-btn`, `#form-manage-cat-btn`, `#cat-modal-close-btn` |
| `src/app.js` | `setupCategoryManager()`, `getCategoryColor(catName)`, `populateCategoryDropdowns()` |

**Category Data Model:**
```js
{
    id: String,    // Unique ID — e.g. "work" (default) or "cat_1717000000000" (user-created)
    name: String,  // Display name (e.g. "Work")
    color: String  // Hex colour string (e.g. "#3B82F6")
}
```

**Default Categories:**

| ID | Name | Colour |
|---|---|---|
| `work` | Work | `#3B82F6` (Blue) |
| `wellness` | Wellness | `#10B981` (Green) |
| `personal` | Personal | `#8B5CF6` (Purple) |

**Available Colour Swatches:**
`#3B82F6`, `#10B981`, `#8B5CF6`, `#F59E0B`, `#EF4444`, `#06B6D4`, `#EC4899`

**Validation Rules:**

| Rule | Enforcement |
|---|---|
| Name required | `if (!name) return;` — silent prevention |
| Name max length | HTML `maxlength="20"` on input |
| No duplicate names | Case-insensitive check: `categories.some(c => c.name.toLowerCase() === name.toLowerCase())` — toast: "Category already exists." |
| Cannot delete last category | `if (categories.length <= 1)` — toast: "Cannot delete the last category." |
| Cannot delete category in use | `if (tasks.some(t => t.category === cat.name))` — toast: "Cannot delete category in use by tasks." |

**Colour Fallback:**
- `getCategoryColor(catName)` returns the category's colour or `#6B7280` (grey) if the category name is not found

**Access Points:**
- "Manage" button in sidebar category section header
- "Edit" button next to the Category label in the task form

**Platform Behaviour:**
Identical on both platforms — the Category Manager modal uses the same centered overlay style.

---

## 7. Category Filtering

**Description:**
Allows the user to filter visible tasks by category. Available on both desktop (sidebar list) and mobile (horizontal pill bar). Selecting a category filter causes the Kanban Board to re-render showing only matching tasks.

**Files & DOM IDs:**

| File | Reference |
|---|---|
| `src/index.html` | `#category-filter-list` (desktop sidebar) |
| `src/index.html` | `#mobile-category-filters` (mobile pill bar) |
| `src/app.js` | `updateSidebarCategoryBadges()`, `currentCategoryFilter` state variable |

**State Variable:**
- `currentCategoryFilter` — `String` — defaults to `'all'`, set to a category name when a filter is selected

**Filtering Logic (in `renderAppUI()`):**
```js
const catMatch = currentCategoryFilter === 'all' || task.category === currentCategoryFilter;
```

**Badge Counts:**
- `updateSidebarCategoryBadges()` calculates task counts per category from the **full unfiltered** `tasks[]` array
- "All Tasks" shows `tasks.length`
- Each category shows the count of tasks matching that category name

**Dynamic Rendering:**
- Both the sidebar list and mobile pill bar are rebuilt on every `renderAppUI()` call
- Click listeners are re-attached after each rebuild
- The active filter gets visual highlighting (`.active` class)

**Platform Behaviour:**

| Aspect | Desktop (≥768px) | Mobile (<768px) |
|---|---|---|
| Component | Sidebar vertical button list with count badges | Horizontal scrollable pill bar |
| Location | Left sidebar, under "Project Categories" heading | Below the segmented tab control, above the cards |
| Styling | `.filter-item` with dot + name + count badge | `.mobile-filter-pill` with name + count in parentheses |
| Active style | Accent border + accent text | Inverted colours (text-main background, bg-color text) |
| Scroll | No scroll (vertical list) | Horizontal scroll with hidden scrollbar |

---

## 8. Priority Filtering

**Description:**
Sidebar-only filter that narrows visible tasks to a specific priority level: All, High, Medium, or Low.

**Files & DOM IDs:**

| File | Reference |
|---|---|
| `src/index.html` | `#priority-filter-list`, `[data-priority-filter]` buttons |
| `src/app.js` | `currentPriorityFilter` state variable, listener in `setupApplicationListeners()` |

**State Variable:**
- `currentPriorityFilter` — `String` — defaults to `'all'`, or `"High"` / `"Medium"` / `"Low"`

**Filtering Logic (in `renderAppUI()`):**
```js
const prioMatch = currentPriorityFilter === 'all' || task.priority === currentPriorityFilter;
```

**Filter Options (hardcoded in HTML):**

| Button Label | `data-priority-filter` value |
|---|---|
| All Priorities | `all` |
| 🔴 High Priority | `High` |
| 🟡 Medium Priority | `Medium` |
| 🔵 Low Priority | `Low` |

**Platform Behaviour:**

| Aspect | Desktop (≥768px) | Mobile (<768px) |
|---|---|---|
| Visibility | Shown in sidebar under "Priority" heading | **Not accessible** — sidebar is hidden on mobile |
| Workaround | — | No mobile equivalent exists; priority filtering is desktop-only |

---

## 9. Global Search

**Description:**
A text search input that filters tasks in real-time by matching against task titles and descriptions. Includes a clear button that resets the search.

**Files & DOM IDs:**

| File | Reference |
|---|---|
| `src/index.html` | `#global-search-input`, `#search-clear-btn`, `#mobile-search-panel` |
| `src/index.html` | `#mobile-search-toggle-btn` (FAB mini button) |
| `src/app.js` | `searchQuery` state variable, input listener in `setupApplicationListeners()` |
| `src/styles.css` | `.workspace-toolbar`, `.search-box-wrapper`, `.search-clear-btn` |

**State Variable:**
- `searchQuery` — `String` — stores the lowercase trimmed search input value

**Search Logic (in `renderAppUI()`):**
```js
const titleText = task.title.toLowerCase();
const descText = (task.description || '').toLowerCase();
const searchMatch = !searchQuery || titleText.includes(searchQuery) || descText.includes(searchQuery);
```
- Matching is **case-insensitive substring** search
- Matches against both `title` and `description`
- Empty search query matches all tasks
- Search combines with category and priority filters (all three must match)

**Clear Button:**
- Appears (`.visible` class) only when `searchQuery` is non-empty
- On click: clears input value, resets `searchQuery` to `''`, re-renders, refocuses the input

**Platform Behaviour:**

| Aspect | Desktop (≥768px) | Mobile (<768px) |
|---|---|---|
| Visibility | Always visible in the workspace toolbar | Hidden by default (`max-height: 0`, `opacity: 0`) |
| Toggle mechanism | N/A — always shown | Mini-FAB search button (`#mobile-search-toggle-btn`) toggles `.search-open` class |
| Animation | None | Slides open with `max-height` / `opacity` transition (0.32s) |
| Mutual exclusion | N/A | Opening search closes the Day Review panel and vice versa |
| Close behaviour | N/A | Closes on outside click (document-level listener) |

---

## 10. Day Review Panel

**Description:**
A summary panel that surfaces important tasks across three smart sections: **In Progress** (currently "doing"), **Due Soon** (due within the next 3 days), and **High Priority** (priority "High", not done). Clicking a task in the review opens it for editing.

**Files & DOM IDs:**

| File | Reference |
|---|---|
| `src/index.html` | `#review-bottom-sheet`, `#review-sheet-backdrop` |
| `src/index.html` | `#review-in-progress-list`, `#review-due-soon-list`, `#review-high-priority-list` |
| `src/index.html` | `#review-doing-count`, `#review-due-count`, `#review-high-count` |
| `src/index.html` | `#review-sheet-title`, `#review-sheet-date`, `#review-sheet-close-btn` |
| `src/index.html` | `#mobile-review-toggle-btn` (FAB mini button) |
| `src/app.js` | `openReviewSheet()`, `closeReviewSheet()`, `buildReviewLists()` |
| `src/styles.css` | `.review-bottom-sheet`, `.review-sheet-backdrop`, `.review-section` |

**Section Filters:**

| Section | Filter Logic |
|---|---|
| In Progress | `task.status === 'doing'` |
| Due Soon | `task.status !== 'done' && task.dueDate >= today && task.dueDate <= today+3days` |
| High Priority | `task.status !== 'done' && task.priority === 'High'` |

**Due Soon Window:**
- Calculated as: `today` to `today + 3 days` (inclusive on both ends)
- Uses ISO date string comparison (`YYYY-MM-DD` format)
- Only includes tasks that are **not done**

**Empty State:**
- Each section shows `"No active items in this category"` in italic muted text when its filter yields zero results

**Task Item Click:**
- Clicking a review task item calls `closeReviewSheet()` then `openTaskDialog(task)` — opening the task in edit mode

**Date Display:**
- Sheet header shows current date formatted as `"Monday, Jun 1"` etc.

**Key Functions:**

| Function | Signature | Purpose |
|---|---|---|
| `openReviewSheet` | `() → void` | Populates lists, shows sheet + backdrop, locks scroll |
| `closeReviewSheet` | `() → void` | Hides sheet + backdrop, restores scroll |
| `buildReviewLists` | `() → void` | Filters tasks into 3 sections, renders items, updates counts |

**Platform Behaviour:**

| Aspect | Desktop (≥768px) | Mobile (<768px) |
|---|---|---|
| Presentation | Centered overlay card (like a modal) | Bottom sheet sliding up from bottom edge |
| Positioning | `top: 50%; left: 50%; transform: translate(-50%, -50%)` | `bottom: 0; left: 0; right: 0;` |
| Border radius | `--radius-lg` (20px) all corners | `24px 24px 0 0` (top corners only) |
| Max height | `80vh` | `85vh` |
| Min/max width | `min-width: 480px; max-width: 600px` | Full width, `max-width: 600px` |
| Open animation | Scale from 0.96 → 1 + fade in | Slide up (`translateY(100%) → 0`) |
| Trigger | Mini-FAB review button (visible on mobile only by default) | Same mini-FAB button |
| Drag handle | Present but less relevant | Visual affordance for sheet interaction |
| Mutual exclusion | N/A | Opening review closes the search panel |

---

## 11. Theme Switcher

**Description:**
Toggles between two visual themes: **Deep Ocean Abyss** (dark, default) and **Frosted Foam** (light). The preference persists across sessions via localStorage.

**Files & DOM IDs:**

| File | Reference |
|---|---|
| `src/index.html` | `#theme-toggle`, `#theme-icon` |
| `src/app.js` | `applyTheme(lightMode)`, `isLightTheme` state variable |
| `src/styles.css` | `body.dark-theme`, `body.light-theme` — all CSS custom properties |

**State Variable:**
- `isLightTheme` — `Boolean` — `false` by default (dark mode)

**Theme Token Comparison:**

| Token | Dark (Deep Ocean Abyss) | Light (Frosted Foam) |
|---|---|---|
| `--primary` | `#0D9488` (Lagoon Teal) | `#0D9488` (Lagoon Teal) |
| `--accent` | `#2DD4BF` (Cyan Glow) | `#0F766E` (Tide Teal) |
| `--bg-color` | `#081017` (Abyss Black) | `#F0FDFB` (Frosted Foam) |
| `--surface-color` | `#0F1E2C` (Trench Slate) | `#FFFFFF` (White Coral) |
| `--surface-hover` | `#172F44` (Deep Slate Hover) | `#E6FAF8` (Light Teal Hover) |
| `--text-main` | `#F8FAFC` (Sea Mist) | `#0F172A` (Slate Shadow) |
| `--text-muted` | `#94A3B8` (Slate Grey) | `#475569` (Slate Muted) |
| `--border-color` | `#1E293B` | `#E2E8F0` |
| `--btn-text` | `#081017` | `#FFFFFF` |

**Icon Swap:**
- Dark mode → Moon SVG icon
- Light mode → Sun SVG icon
- Icon is replaced via `innerHTML` on the `#theme-toggle` button

**OS-Level Detection:**
- Listens for `window.matchMedia('(prefers-color-scheme: dark)')` changes
- Only applies OS preference if no explicit user theme is saved in localStorage
- Compatible with older Safari via `addListener` fallback

**Toast Messages:**
- Dark → `"Deep Ocean Abyss dark theme applied."`
- Light → `"Frosted Foam light theme applied."`

**Storage Key:** `airj-theme` — stores `"light"` or `"dark"`

**Platform Behaviour:**
Identical on both platforms.

---

## 12. Dashboard Overview

**Description:**
A welcome banner at the top of the workspace that displays the current date, a time-of-day greeting, and a summary of active tasks. Includes the desktop "Create Task" button.

**Files & DOM IDs:**

| File | Reference |
|---|---|
| `src/index.html` | `#current-date-string`, `#welcome-message-header`, `#dashboard-subtitle-string` |
| `src/index.html` | `#header-add-task-btn` |
| `src/app.js` | `updateDateDisplay()`, `updateWelcomeGreeting()`, subtitle logic inside `updateStatsAndBadges()` |
| `src/styles.css` | `.dashboard-overview`, `.dashboard-welcome`, `.dashboard-actions` |

**Dynamic Date:**
- `updateDateDisplay()` sets the date string using `toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })`
- Example output: "Saturday, Jun 14"
- Called once on `DOMContentLoaded`

**Time-of-Day Greeting:**
- `updateWelcomeGreeting()` sets the heading based on current hour:

| Time Range | Greeting |
|---|---|
| Before 12:00 | "Good morning, User" |
| 12:00 – 16:59 | "Flow through your afternoon, User" |
| 17:00+ | "Review your day, User" |

- Called on `DOMContentLoaded` and refreshed every 60 seconds via `setInterval`

**Subtitle Summary (in `updateStatsAndBadges()`):**
- Zero tasks: `"Start fresh. Create a task to map your workflow today."`
- With tasks: `"You have {N} active task(s) in progress today ({X}% completed)."`

**Platform Behaviour:**

| Aspect | Desktop (≥768px) | Mobile (<768px) |
|---|---|---|
| Banner | Visible — surface-coloured card with shadow | `display: none` — completely hidden |
| Create Task button | Visible in banner | Hidden (FAB is the only creation trigger) |
| Greeting | Visible | Not displayed (no banner on mobile) |

---

## 13. Progress Analytics

**Description:**
A circular progress ring in the desktop sidebar that visualises task completion percentage, accompanied by per-status counters.

**Files & DOM IDs:**

| File | Reference |
|---|---|
| `src/index.html` | `#progress-circle-fill`, `#progress-percentage-label` |
| `src/index.html` | `#stats-todo-count`, `#stats-doing-count`, `#stats-done-count` |
| `src/app.js` | `updateStatsAndBadges(counts)` |
| `src/styles.css` | `.progress-card`, `.circular-chart`, `.circle-progress` |

**Calculation:**
```js
const percentage = total > 0 ? Math.round((counts.done / total) * 100) : 0;
```
- Based on **filtered** task counts (respects current category/priority/search filters)
- Percentage represents the ratio of "done" tasks to total visible tasks

**SVG Progress Ring:**
- Uses `stroke-dasharray` on an SVG circle path: `"{percentage}, 100"`
- Animated via CSS transition: `stroke-dasharray 0.6s cubic-bezier(0.4, 0, 0.2, 1)`
- The ring fills clockwise from the top

**Counter Labels:**
- Three separate counters in the sidebar: Todo, Doing, Done
- Updated from the `counts` object passed to `updateStatsAndBadges()`

**Platform Behaviour:**

| Aspect | Desktop (≥768px) | Mobile (<768px) |
|---|---|---|
| Visibility | Shown in sidebar `.progress-card` | **Not visible** — sidebar is hidden |
| Data accuracy | Still calculated (stats/badges update regardless) | Counts used for mobile tab badges instead |

---

## 14. Mobile Responsive Layout

**Description:**
The responsive system that transforms the desktop layout into a mobile-optimised experience at the `768px` breakpoint. This includes the segmented tab control, mobile FAB cluster, and layout restructuring.

**Files & DOM IDs:**

| File | Reference |
|---|---|
| `src/index.html` | `#column-segmented-control`, `#tab-todo-btn`, `#tab-doing-btn`, `#tab-done-btn` |
| `src/index.html` | `#badge-todo-count`, `#badge-doing-count`, `#badge-done-count` |
| `src/index.html` | `#global-add-task-fab`, `#mobile-search-toggle-btn`, `#mobile-review-toggle-btn` |
| `src/app.js` | `setupMobileTabSwitcher()`, `activeMobileTab` state variable |
| `src/styles.css` | `.mobile-view-tabs`, `.segmented-control`, `.tab-trigger`, `.segmented-slider` |
| `src/styles.css` | `@media (max-width: 767px)` — all mobile overrides |
| `src/styles.css` | `.fab-cluster`, `.floating-fab`, `.mini-fab` |

**Segmented Tab Control:**
- Three tabs: To Do, Doing, Done — each with a live badge count
- Animated slider (`.segmented-slider`) moves between positions using CSS transforms:
  - `todo` → `translateX(0)`
  - `doing` → `translateX(100%)`
  - `done` → `translateX(200%)`
- Slider has gradient background matching primary → accent
- Active tab text colour switches to `--btn-text` (contrasts against slider)
- Switching tabs toggles `.active-tab` class on the corresponding Kanban column

**FAB Cluster:**

| Button | ID | Desktop | Mobile |
|---|---|---|---|
| Main FAB (+ icon) | `#global-add-task-fab` | Visible | Visible |
| Search mini-FAB | `#mobile-search-toggle-btn` | Hidden (`display: none`) | Visible (`display: flex`) |
| Review mini-FAB | `#mobile-review-toggle-btn` | Hidden (`display: none`) | Visible (`display: flex`) |

**FAB Animations:**
- Main FAB: pulsing glow ring (`fabPulse` keyframe), rotates 90° on hover
- Mini-FABs: scale up on hover, active state gets gradient background

**Layout Changes at `≤767px`:**
- `.app-container`: switches from `flex-row` to `flex-column`
- `.sidebar`: `display: none`
- `.app-header`: reduced height (56px vs 64px), tighter padding
- `.workspace-container`: reduced padding (16px vs 24px), no gap
- `.dashboard-overview`: hidden
- `.kanban-board`: single column grid
- `.kanban-column`: hidden by default, shown with `.active-tab`
- `.column-header`: hidden
- `.mobile-view-tabs`: `display: block` (hidden on desktop)
- `.mobile-category-filters`: `display: flex` (hidden on desktop)

**State Variable:**
- `activeMobileTab` — `String` — tracks current visible column tab, defaults to `'todo'`

---

## 15. Toast Notifications

**Description:**
Ephemeral feedback messages that appear at the bottom-center of the screen to confirm user actions. Auto-dismisses after 3 seconds.

**Files & DOM IDs:**

| File | Reference |
|---|---|
| `src/index.html` | `#app-toast`, `#toast-message-text` |
| `src/app.js` | `showToastNotification(message)` |
| `src/styles.css` | `.toast`, `.toast.show`, `.toast-dot` |

**Function: `showToastNotification(message)`**
- Sets the message text
- Adds `.show` class to trigger the slide-up animation
- Clears any existing timer (`window.toastTimer`) to prevent early dismissal if a new toast fires
- Sets a new 3-second timeout to remove `.show`

**Animation:**
- Hidden: `transform: translate(-50%, 50px); opacity: 0`
- Shown: `transform: translate(-50%, 0); opacity: 1`
- Transition: 0.3s with bounce easing (`cubic-bezier(0.175, 0.885, 0.32, 1.275)`)

**Pulsing Dot:**
- `.toast-dot` — small accent-coloured circle with the `fabPulse` animation (1.5s infinite)

**All Toast Messages Used:**

| Trigger | Message |
|---|---|
| Task created | `"Task saved to flow."` |
| Task updated | `"Task flow updated."` |
| Task deleted | `"Task removed from flow."` |
| Shift → doing | `"Task started (Moving to Doing)."` |
| Shift → done | `"Task completed (Moving to Done)."` |
| Shift → todo | `"Task deferred (Moving to To Do)."` |
| Drag to doing | `"Task started (Moving to Doing)."` |
| Drag to done | `"Task completed (Moving to Done)."` |
| Drag to todo | `"Task deferred (Moving to To Do)."` |
| Theme → dark | `"Deep Ocean Abyss dark theme applied."` |
| Theme → light | `"Frosted Foam light theme applied."` |
| Category created | `"Category created."` |
| Category already exists | `"Category already exists."` |
| Delete last category | `"Cannot delete the last category."` |
| Delete in-use category | `"Cannot delete category in use by tasks."` |
| Save error | `"Error saving task. Check console."` |

**Platform Behaviour:**
Identical on both platforms. Toast sits at `z-index: 2000` (above all other layers).

---

## 16. Data Persistence

**Description:**
All application state (tasks, categories, theme preference) is persisted to the browser's `localStorage`. On first load, default data is seeded. A safe wrapper prevents crashes if localStorage is unavailable.

**Files & Functions:**

| File | Reference |
|---|---|
| `src/app.js` | `safeStorage` object, `loadAppData()`, `saveTasks()`, `saveCategories()` |

**Storage Keys:**

| Key | Contents | Format |
|---|---|---|
| `airj-tasks` | Full task array | JSON string (array of task objects) |
| `airj-categories` | Full category array | JSON string (array of category objects) |
| `airj-theme` | Theme preference | Plain string: `"light"` or `"dark"` |

**Safe Storage Wrapper:**
```js
const safeStorage = {
    get: function(key) { try { return localStorage.getItem(key); } catch(e) { return null; } },
    set: function(key, val) { try { localStorage.setItem(key, val); } catch(e) {} }
};
```
- Wraps all `localStorage` calls in try/catch to handle private browsing, disabled storage, or quota errors

**Load Sequence (`loadAppData()`):**
1. Load theme from `airj-theme` → apply via `applyTheme()`
2. Load tasks from `airj-tasks` → parse JSON, validate is array, fallback to `DEFAULT_TASKS` on error
3. Load categories from `airj-categories` → parse JSON, validate is non-empty array, fallback to `DEFAULT_CATEGORIES` on error

**Default Data Seeding:**
- If no saved data exists (or it's `"null"`), the defaults are loaded and immediately saved
- `DEFAULT_TASKS`: 4 starter tasks across different statuses/categories/priorities
- `DEFAULT_CATEGORIES`: 3 starter categories (Work, Wellness, Personal)

**Save Triggers:**
- `saveTasks()` called after: create, edit, delete, status shift, drag-drop
- `saveCategories()` called after: create category, delete category

**Platform Behaviour:**
Identical on both platforms.

---

## 17. Design System

**Description:**
The foundational CSS custom property system, typography stack, colour palette, spacing tokens, and ambient visual effects that define the air-J visual identity.

**File:** `src/styles.css` (`:root` and theme selectors)

**Typography:**

| Token | Font Family | Usage |
|---|---|---|
| `--font-heading` | `'Outfit', sans-serif` | Headings, brand name, percentage labels, column titles |
| `--font-body` | `'Plus Jakarta Sans', sans-serif` | Body text, form inputs, buttons, labels |
| `--font-code` | `'Fira Code', monospace` | Reserved (not currently used in UI) |

**Border Radii:**

| Token | Value | Usage |
|---|---|---|
| `--radius-lg` | `20px` | Kanban columns, dashboard banner, modal cards |
| `--radius-md` | `14px` | Task cards, progress card, profile card, search input |
| `--radius-sm` | `10px` | Buttons, form inputs, filter items |
| `--radius-xs` | `6px` | Small buttons, scrollbar thumb |

**Transitions:**

| Token | Value | Usage |
|---|---|---|
| `--transition-smooth` | `all 0.35s cubic-bezier(0.25, 0.8, 0.25, 1)` | Layout changes, theme transitions, column effects |
| `--transition-snappy` | `all 0.2s cubic-bezier(0.16, 1, 0.3, 1)` | Button hovers, input focus, quick interactions |

**Priority Colours (CSS classes):**

| Class | `--priority-color` | `--priority-bg` |
|---|---|---|
| `.priority-high` | `#EF4444` (Red) | `rgba(239, 68, 68, 0.12)` |
| `.priority-medium` | `#F59E0B` (Amber) | `rgba(245, 158, 11, 0.12)` |
| `.priority-low` | `#10B981` (Green) | `rgba(16, 185, 129, 0.12)` |

**Ambient Blobs:**
- Two fixed-position blurred circles (`filter: blur(120px)`) that provide a subtle gradient glow behind all content
- `blob-1`: primary colour, top-right, 400×400px, opacity 0.12
- `blob-2`: accent colour, bottom-left, 500×500px, opacity 0.15
- Container opacity: 0.4, `z-index: -1`, `pointer-events: none`

**Custom Scrollbars:**
- Width/height: 6px
- Track: transparent
- Thumb: `--border-color`, hover → `--text-muted`

**Glassmorphism:**
- Used on the app header: `backdrop-filter: blur(12px)`, `background-color: var(--glass-bg)`
- Modal overlay: `backdrop-filter: blur(6px)`

**Animations:**

| Name | Effect | Duration | Usage |
|---|---|---|---|
| `taskCardFadeIn` | Fade in + slide up 10px | 0.3s | New task cards, review items |
| `tabFadeIn` | Fade in + slide from right 15px | 0.3s | Mobile tab column switch |
| `fabPulse` | Scale 1 → 1.4 + fade out | 2s (infinite) | FAB glow ring, toast dot |

**Platform Behaviour:**
The design system is shared across both platforms. Mobile overrides are handled through media queries that modify layout, sizing, and visibility — not the core tokens.

---

## 18. Branding

**Description:**
The air-J visual identity elements: the SVG logo mark, the wordmark, and the user avatar badge.

**File:** `src/index.html` (header section)

**Logo:**
- Custom SVG path in the header (`.brand-logo`, 32×32px)
- Uses a linear gradient (`#header-logo-grad`) from `--primary` to `--accent`
- Stroke-based design: 8px stroke width, round line caps/joins
- Features an abstract ascending arrow motif integrated into a flowing path

**Wordmark:**
- Text: `air` in `--text-main` + `-J` in `--accent` colour
- Font: `--font-heading` (Outfit), 24px desktop / 20px mobile
- Weight: 700 base, 800 for the `-J` span
- Letter spacing: -0.75px

**User Avatar:**
- Circular badge (36×36px) with initials "UO" (User Ocean)
- Gradient background: `linear-gradient(135deg, var(--primary), var(--accent))`
- Appears in two locations: header (`.app-header`) and sidebar profile card
- Font: `--font-heading`, 13px, weight 800

**Profile Car## 19. Scrum Mode & Backlog

**Description:**
Scrum Mode introduces a time-boxed sprint workflow. Tasks in Scrum mode are isolated from Kanban mode and start in the Backlog, a persistent pool of uncommitted tasks. From the Backlog, users can commit tasks to an active sprint or edit/delete them.

**Files & DOM IDs:**

| File | Reference |
|---|---|
| `src/index.html` | `.scrum-backlog-panel`, `#backlog-cards-list`, `#backlog-count` |
| `src/index.html` | `.quick-add-backlog-row`, `#quick-add-backlog-input`, `#quick-add-backlog-btn` |
| `src/app.js` | `switchMode(mode)`, `renderScrumView()`, `renderBacklogList()`, `addQuickBacklogTask()` |
| `src/styles.css` | `.scrum-backlog-panel`, `.backlog-task-item`, `.backlog-empty-state`, `.quick-add-backlog-row` |

**Workflow & Rules:**
- Users toggle between Kanban and Scrum mode in the header (persisted as `currentMode` in localStorage `airj-mode`).
- Tasks are created in the active mode. In Scrum mode, new tasks default to the Backlog (with `sprintId: null`).
- Toggling category/priority/search filters dynamically filters the Backlog list.
- **Mobile Quick-Add**: A text input row at the top of the mobile backlog allows rapid task addition. Tasks are silently created with the first available category and a "Medium" priority.

---

## 20. Sprint Lifecycle & Header Widget

**Description:**
A sprint is a time-boxed period (1–4 weeks) during which committed tasks are worked on. When a sprint is active, a Sprint Board (reusing the 3-column Kanban structure) displays sprint tasks. A compact Sprint Header Widget displays the status, live progress bar, and days remaining.

**Files & DOM IDs:**

| File | Reference |
|---|---|
| `src/index.html` | `#sprint-header-widget`, `#sprint-progress-fill` |
| `src/index.html` | `#sprint-progress-ratio`, `#sprint-days-remaining`, `#sprint-end-btn` (sprint footer actions) |
| `src/index.html` | `#sprint-planning-placeholder`, `#start-sprint-btn`, `#sprint-planning-modal` |
| `src/index.html` | `#sprint-cart-banner`, `#sprint-cart-sheet`, `#sprint-cart-review-btn`, `#sprint-cart-start-btn` |
| `src/app.js` | `createSprint(durationWeeks)`, `updateSprintHeaderWidget()`, `checkSprintExpiry()`, `endSprint(abandoned)` |
| `src/app.js` | `updateMobileCartBanner()`, `openSprintCartSheet()`, `closeSprintCartSheet()`, `renderCartSheetStagedTasks()` |
| `src/styles.css` | `.sprint-header-widget`, `.sprint-progress-bar-track`, `.sprint-progress-bar-fill`, `.sprint-days-badge`, `.sprint-footer-actions` |
| `src/styles.css` | `.sprint-cart-banner`, `.sprint-cart-sheet`, `.cart-duration-btn` |

**Rules:**
- A sprint duration is locked once started.
- Users can commit/remove tasks to/from an active sprint directly.
- The progress bar fills dynamically as tasks in the sprint are moved to "Done".
- Sprint expiry checks run on load and every minute. Sprints can be ended early using the "End Sprint" button at the bottom of the page.
- **Mobile Sprint Cart**: On mobile, a dedicated "Next Sprint" cart acts as the planning stage when no sprint is active:
  - Backlog tasks can be committed/staged into the cart via a `+` action button.
  - A sticky **Sprint Cart Banner** (`#sprint-cart-banner`) slides up at `bottom: 20px` to indicate staged count.
  - While the cart banner is visible, the **FAB cluster** (`.fab-cluster`) automatically slides up to `bottom: 104px` via a CSS sibling transition to prevent layout overlap.
  - Tapping "Review & Start" opens a slide-up **Sprint Cart Sheet** (`#sprint-cart-sheet`) containing list review, removal controls, inline duration picker (1–4 weeks), and the "Start Sprint" action.

---

## 21. Sprint Review Bottom Sheet

**Description:**
Upon sprint completion or normal expiry, a Sprint Review modal/bottom sheet automatically opens. It lists completed and incomplete tasks side-by-side, forcing the user to resolve each incomplete task (Move to Next Sprint, Move to Backlog, or Delete) before finalizing the review.

**Files & DOM IDs:**

| File | Reference |
|---|---|
| `src/index.html` | `#sprint-review-sheet`, `#sprint-review-backdrop` |
| `src/index.html` | `#sprint-review-completed-list`, `#sprint-review-incomplete-list`, `#sprint-review-finish-btn` |
| `src/app.js` | `openSprintReview()`, `finishSprintReview()` |
| `src/styles.css` | `.sprint-review-sheet`, `.incomplete-task-actions`, `.incomplete-action-btn` |

**Rules:**
- All incomplete tasks default to "Move to Next Sprint" (`sprintId: 'next_sprint'`).
- Sprints cannot be completed without resolving all incomplete tasks.
- Tasks chosen for "Next Sprint" are automatically committed when the user starts the next sprint.

---

## 22. Sprint History & Storage Limits

**Description:**
Stores read-only records of past sprints. Accessible from the Scrum sidebar, clicking a past sprint displays its completion rates and resolved tasks in a read-only view of the Sprint Review sheet.

**Files & DOM IDs:**

| File | Reference |
|---|---|
| `src/index.html` | `#sprint-history-list` |
| `src/app.js` | `renderSprintHistoryList()`, `openSprintHistoryDetails()`, `pruneSprintHistory()` |
| `src/styles.css` | `.sprint-history-panel`, `.sprint-history-entry` |

**Rules:**
- Capped at a maximum age of 8 weeks (56 days) or 200 tasks in total history, whichever hits first, to keep localStorage usage low.

---

## Appendix: Initialisation Sequence

The app bootstraps on `DOMContentLoaded` in this order:

```
1. updateDateDisplay()         → Set current date string
2. updateWelcomeGreeting()     → Set time-based greeting
3. setInterval(updateWelcomeGreeting, 60000)  → Refresh greeting every minute
4. loadAppData()               → Load theme, tasks, categories from localStorage
5. renderAppUI()               → Initial board render
6. setupApplicationListeners() → Register all event handlers (includes setupCategoryManager())
7. setupDragAndDropHandlers()  → Register column drag/drop listeners
8. setupMobileTabSwitcher()    → Register segmented tab control
9. checkSprintExpiry()         → Scan for and transition expired sprints
```

**Source:** `src/app.js` lines 2418–2438

---

## Appendix: Complete State Variables

| Variable | Type | Default | Purpose |
|---|---|---|---|
| `tasks` | `Array<Object>` | `[]` (loaded from storage or defaults) | Master task database |
| `categories` | `Array<Object>` | `[]` (loaded from storage or defaults) | Category definitions |
| `currentCategoryFilter` | `String` | `'all'` | Active category filter |
| `currentPriorityFilter` | `String` | `'all'` | Active priority filter |
| `searchQuery` | `String` | `''` | Current search input (lowercase) |
| `activeMobileTab` | `String` | `'todo'` | Currently visible mobile column |
| `isLightTheme` | `Boolean` | `false` | Current theme mode |
| `currentMode` | `String` | `'kanban'` | Current active mode ('kanban' or 'scrum') |
| `sprints` | `Array<Object>` | `[]` | Array containing current active/planning sprints |
| `sprintHistory` | `Array<Object>` | `[]` | Array of completed sprint history logs |
| `sprintCounter` | `Number` | `0` | Auto-increment counter used to name sprints |
| `cartSelectedWeeks` | `Number` | `1` | Selected duration in weeks in the mobile cart |
| `window.activeColumnShortcut` | `String\|null` | `null` | Pre-set status when creating from a column `+` button |
| `window.toastTimer` | `Number\|null` | `null` | Active toast dismiss timeout ID |

---

## Appendix: File Map

| File | Purpose | Size |
|---|---|---|
| `src/index.html` | Document structure, all DOM elements, SVG icons | 710 lines |
| `src/app.js` | Application logic, state management, event handling | 2466 lines |
| `src/styles.css` | Design system, component styles, responsive breakpoints | 2965 lines |
| `FEATURES.md` | This document | — |
| `mobile-ux-options/` | Exploratory mobile UX design prototypes (not part of core app) | 2 HTML files |
| `patch_app.py` | Utility script (not part of core app) | — |
| `test_bug.js` | Test script (not part of core app) | — |
