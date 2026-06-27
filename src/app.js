/* ==========================================================================
   air-J TASK MANAGER - CORE ENGINE
   ========================================================================== */

// --- Dynamic Date Handler ---
function updateDateDisplay() {
    const dateStrEl = document.getElementById('current-date-string');
    if (dateStrEl) {
        const options = { weekday: 'long', month: 'short', day: 'numeric' };
        dateStrEl.textContent = new Date().toLocaleDateString('en-US', options);
    }
}

// --- Task Database & State Model ---
let tasks = [];
let categories = [];
let currentCategoryFilter = 'all';
let currentPriorityFilter = 'all';
let searchQuery = '';
let activeMobileTab = 'todo';
let isLightTheme = false;
let userName = "User";
let workspaceName = "Workspace";

// --- Onboarding State ---
let isFirstVisit = false;
let onboardingComplete = false;
let cyclesOnboardingComplete = false;
let onboardingTourActive = false;

// --- Dynamic Profile Greeting ---
function updateWelcomeGreeting() {
    const welcomeHeader = document.getElementById('welcome-message-header');
    if (welcomeHeader) {
        const hour = new Date().getHours();
        let greeting = `Manage your flow, ${userName}`;
        if (hour < 12) greeting = `Good morning, ${userName}`;
        else if (hour < 17) greeting = `Flow through your afternoon, ${userName}`;
        else greeting = `Review your day, ${userName}`;
        welcomeHeader.textContent = greeting;
    }
}

function updateProfileUI() {
    const avatarLetter = userName ? userName.charAt(0).toUpperCase() : "U";
    const avatars = document.querySelectorAll('.user-avatar');
    avatars.forEach(avatar => avatar.textContent = avatarLetter);
    
    const nameEls = document.querySelectorAll('.profile-name, .profile-dropdown-header strong');
    nameEls.forEach(el => el.textContent = userName || "User");
    
    const workspaceEls = document.querySelectorAll('.profile-title, .profile-dropdown-header span');
    workspaceEls.forEach(el => el.textContent = workspaceName || "Workspace");
    
    updateWelcomeGreeting();
}

// Dual Mode State variables
let currentMode = 'kanban';         // 'kanban' | 'scrum'
let sprints = [];                    // Active/current sprints
let sprintHistory = [];              // Completed sprint reviews
let sprintCounter = 0;               // Naming counter for Sprints

// Default Mock Categories
const DEFAULT_CATEGORIES = [
    { id: 'work', name: 'Work', color: '#3B82F6' },
    { id: 'wellness', name: 'Wellness', color: '#10B981' },
    { id: 'personal', name: 'Personal', color: '#8B5CF6' }
];

// Default Mock Tasks (Premium starter kit)
const DEFAULT_TASKS = [
    {
        id: 1,
        title: "Review Aero-Loop J logo visual guidelines",
        description: "Verify contrast on deep ocean canvas and confirm scale properties on mobile status bars.",
        category: "Work",
        priority: "High",
        status: "todo",
        dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0] // 2 days from now
    },
    {
        id: 2,
        title: "Optimize thumb-zone layouts on mobile forms",
        description: "Re-examine floating action button reachability and form bottom-sheet vertical heights.",
        category: "Work",
        priority: "Medium",
        status: "doing",
        dueDate: new Date().toISOString().split('T')[0] // Today
    },
    {
        id: 3,
        title: "Deep breathing mindfulness exercises",
        description: "Fulfill a 10-minute quiet focus flow to recharge momentum and calm cognitive strain.",
        category: "Wellness",
        priority: "Low",
        status: "done",
        dueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0] // Yesterday
    },
    {
        id: 4,
        title: "Draft PWA configurations for native wrapper",
        description: "Prepare manifest.json and service-worker configurations for responsive deployment.",
        category: "Personal",
        priority: "High",
        status: "todo",
        dueDate: ""
    }
];

// --- Persistent Storage Managers ---
const safeStorage = {
    get: function(key) {
        try { return localStorage.getItem(key); } catch(e) { return null; }
    },
    set: function(key, val) {
        try { localStorage.setItem(key, val); } catch(e) {}
    }
};

function loadAppData() {
    // 1. Load Theme
    const savedTheme = safeStorage.get('airj-theme');
    isLightTheme = savedTheme === 'light';
    applyTheme(isLightTheme);

    // 2. Load Tasks
    const savedTasks = safeStorage.get('airj-tasks');
    if (savedTasks && savedTasks !== "null") {
        try {
            const parsed = JSON.parse(savedTasks);
            tasks = Array.isArray(parsed) ? parsed : [...DEFAULT_TASKS];
            
            // Migration: Ensure all tasks have mode and sprintId fields
            let tasksMigrated = false;
            tasks.forEach(task => {
                if (!task.mode) {
                    task.mode = 'kanban';
                    task.sprintId = null;
                    tasksMigrated = true;
                }
            });
            if (tasksMigrated) {
                saveTasks();
            }
        } catch (e) {
            console.error("Error parsing tasks, resetting to default", e);
            tasks = [...DEFAULT_TASKS];
            // Initialize default tasks with mode/sprintId fields
            tasks.forEach(t => {
                t.mode = 'kanban';
                t.sprintId = null;
            });
            saveTasks();
        }
    } else {
        // First visit: check if onboarding has been completed before
        const onboardingFlag = safeStorage.get('airj-onboarding-complete');
        if (!onboardingFlag) {
            // True first visit — start with empty board for genuine onboarding
            isFirstVisit = true;
            tasks = [];
            saveTasks();
        } else {
            // Onboarding was completed/skipped before but tasks were cleared
            tasks = [...DEFAULT_TASKS];
            tasks.forEach(t => {
                t.mode = 'kanban';
                t.sprintId = null;
            });
            saveTasks();
        }
    }

    // 3. Load Categories
    const savedCategories = safeStorage.get('airj-categories');
    if (savedCategories && savedCategories !== "null") {
        try {
            const parsed = JSON.parse(savedCategories);
            categories = Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_CATEGORIES];
        } catch (e) {
            console.error("Error parsing categories", e);
            categories = [...DEFAULT_CATEGORIES];
            saveCategories();
        }
    } else {
        categories = [...DEFAULT_CATEGORIES];
        saveCategories();
    }

    // 4. Load Mode
    const savedMode = safeStorage.get('airj-mode');
    currentMode = (savedMode === 'kanban' || savedMode === 'scrum') ? savedMode : 'kanban';
    
    // Set initial body class
    document.body.classList.remove('mode-kanban', 'mode-scrum');
    document.body.classList.add(`mode-${currentMode}`);

    // 5. Load Sprints
    const savedSprints = safeStorage.get('airj-sprints');
    if (savedSprints) {
        try { sprints = JSON.parse(savedSprints) || []; } catch(e) { sprints = []; }
    }

    // 6. Load Sprint History
    const savedHistory = safeStorage.get('airj-sprint-history');
    if (savedHistory) {
        try { sprintHistory = JSON.parse(savedHistory) || []; } catch(e) { sprintHistory = []; }
    }

    // 7. Load Sprint Counter
    const savedCounter = safeStorage.get('airj-sprint-counter');
    if (savedCounter) {
        sprintCounter = parseInt(savedCounter) || 0;
    }

    // 8. Load Personalization
    userName = safeStorage.get('airj-username') || "User";
    workspaceName = safeStorage.get('airj-workspace') || "Workspace";
    updateProfileUI();

    // 9. Load Onboarding State
    const onboardingFlag = safeStorage.get('airj-onboarding-complete');
    onboardingComplete = !!onboardingFlag;
    cyclesOnboardingComplete = onboardingFlag === 'all';
}

function savePersonalization() {
    safeStorage.set('airj-username', userName);
    safeStorage.set('airj-workspace', workspaceName);
}

function saveTasks() {
    safeStorage.set('airj-tasks', JSON.stringify(tasks));
}

function saveCategories() {
    safeStorage.set('airj-categories', JSON.stringify(categories));
}

function saveMode() {
    safeStorage.set('airj-mode', currentMode);
}

function saveSprints() {
    safeStorage.set('airj-sprints', JSON.stringify(sprints));
}

function saveSprintHistory() {
    safeStorage.set('airj-sprint-history', JSON.stringify(sprintHistory));
}

function saveSprintCounter() {
    safeStorage.set('airj-sprint-counter', sprintCounter.toString());
}

function getCategoryColor(catName) {
    const cat = categories.find(c => c.name === catName);
    return cat ? cat.color : '#6B7280';
}

// --- Theme Switcher Core ---
function applyTheme(lightMode) {
    const iconBtn = document.getElementById('theme-toggle');
    if (lightMode) {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        safeStorage.set('airj-theme', 'light');
        if (iconBtn) {
            const iconContainer = document.getElementById('theme-toggle-icon-container');
            const labelEl = document.getElementById('theme-toggle-label');
            const sunSvg = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
            `;
            if (iconContainer) {
                iconContainer.innerHTML = sunSvg;
            } else {
                iconBtn.innerHTML = sunSvg;
            }
            if (labelEl) {
                labelEl.textContent = 'Light Theme';
            }
        }
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        safeStorage.set('airj-theme', 'dark');
        if (iconBtn) {
            const iconContainer = document.getElementById('theme-toggle-icon-container');
            const labelEl = document.getElementById('theme-toggle-label');
            const moonSvg = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
            `;
            if (iconContainer) {
                iconContainer.innerHTML = moonSvg;
            } else {
                iconBtn.innerHTML = moonSvg;
            }
            if (labelEl) {
                labelEl.textContent = 'Dark Theme';
            }
        }
    }
}

// --- Mode Switcher Core ---
function switchMode(mode) {
    if (mode !== 'kanban' && mode !== 'scrum') return;
    currentMode = mode;
    currentCategoryFilter = 'all'; // Reset category filter when switching modes
    saveMode();
    
    // Update body classes
    document.body.classList.remove('mode-kanban', 'mode-scrum');
    document.body.classList.add(`mode-${mode}`);
    
    // Update header toggle slider position / active state
    const modeToggleWrapper = document.getElementById('header-mode-toggle');
    if (modeToggleWrapper) {
        modeToggleWrapper.setAttribute('data-active-mode', mode);
        modeToggleWrapper.querySelectorAll('.mode-toggle-btn').forEach(btn => {
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    // Re-render UI
    renderAppUI();
    showToastNotification(`Switched to ${mode === 'scrum' ? 'Cycles' : 'Flow'} mode.`);

    // Trigger Cycles onboarding on first switch to scrum
    if (mode === 'scrum' && !cyclesOnboardingComplete && !onboardingTourActive) {
        setTimeout(() => initCyclesOnboarding(), 600);
    }
}

// --- Dynamic UI Rendering Engine ---
function renderAppUI() {
    if (currentMode === 'scrum') {
        renderScrumView();
        return;
    }

    // Columns DOM references
    const todoListEl = document.getElementById('todo-cards-list');
    const doingListEl = document.getElementById('doing-cards-list');
    const doneListEl = document.getElementById('done-cards-list');

    if (!todoListEl || !doingListEl || !doneListEl) return;

    // Clear list boxes
    todoListEl.innerHTML = '';
    doingListEl.innerHTML = '';
    doneListEl.innerHTML = '';

    // Filter tasks based on selected categories, priorities, and search query
    let filteredTasks = tasks.filter(task => {
        const modeMatch = task.mode === 'kanban';
        const catMatch = currentCategoryFilter === 'all' || task.category === currentCategoryFilter;
        const prioMatch = currentPriorityFilter === 'all' || task.priority === currentPriorityFilter;
        
        const titleText = task.title.toLowerCase();
        const descText = (task.description || '').toLowerCase();
        const searchMatch = !searchQuery || titleText.includes(searchQuery) || descText.includes(searchQuery);
        
        return modeMatch && catMatch && prioMatch && searchMatch;
    });

    // Tracking Counters
    let counts = { todo: 0, doing: 0, done: 0 };

    // Render loop
    filteredTasks.forEach(task => {
        counts[task.status]++;
        
        const card = createTaskCardDOM(task);
        
        if (task.status === 'todo') {
            todoListEl.appendChild(card);
        } else if (task.status === 'doing') {
            doingListEl.appendChild(card);
        } else if (task.status === 'done') {
            doneListEl.appendChild(card);
        }
    });

    // Check for empty states and render placeholders if empty
    renderEmptyStatePlaceholder(todoListEl, 'todo');
    renderEmptyStatePlaceholder(doingListEl, 'doing');
    renderEmptyStatePlaceholder(doneListEl, 'done');

    // Update stats counters
    updateStatsAndBadges(counts);

    // Update mobile cart banner (hide it if in Kanban mode)
    updateMobileCartBanner();
}

function renderScrumView() {
    const activeSprint = sprints.find(s => s.status === 'active');
    const planningSprint = sprints.find(s => s.status === 'planning');
    const currentSprint = activeSprint || planningSprint;
    
    // Toggle active sprint classes/DOM states
    const placeholder = document.getElementById('sprint-planning-placeholder');
    const backlogColumn = document.getElementById('backlog-column');
    const collapsedBacklogContainer = document.getElementById('collapsed-backlog-container');
    const kanbanBoard = document.querySelector('.kanban-board');
    const nextSprintColumn = document.getElementById('column-next-sprint');
    
    if (activeSprint) {
        document.body.classList.add('sprint-active');
        document.body.classList.remove('sprint-planning');
        if (placeholder) placeholder.style.display = 'none';
        
        if (backlogColumn && collapsedBacklogContainer) {
            collapsedBacklogContainer.appendChild(backlogColumn);
            backlogColumn.classList.add('collapsed-mode');
            backlogColumn.classList.remove('expanded-mode');
        }
        
        // Show standard column lists
        const todoListEl = document.getElementById('todo-cards-list');
        const doingListEl = document.getElementById('doing-cards-list');
        const doneListEl = document.getElementById('done-cards-list');
        
        if (todoListEl && doingListEl && doneListEl) {
            todoListEl.innerHTML = '';
            doingListEl.innerHTML = '';
            doneListEl.innerHTML = '';
            
            // Filter tasks committed to the active sprint
            const sprintTasks = tasks.filter(task => {
                const modeMatch = task.mode === 'scrum' && task.sprintId === activeSprint.id;
                const catMatch = currentCategoryFilter === 'all' || task.category === currentCategoryFilter;
                const prioMatch = currentPriorityFilter === 'all' || task.priority === currentPriorityFilter;
                
                const titleText = task.title.toLowerCase();
                const descText = (task.description || '').toLowerCase();
                const searchMatch = !searchQuery || titleText.includes(searchQuery) || descText.includes(searchQuery);
                
                return modeMatch && catMatch && prioMatch && searchMatch;
            });
            
            let counts = { todo: 0, doing: 0, done: 0 };
            
            sprintTasks.forEach(task => {
                counts[task.status]++;
                const card = createTaskCardDOM(task);
                
                if (task.status === 'todo') todoListEl.appendChild(card);
                else if (task.status === 'doing') doingListEl.appendChild(card);
                else if (task.status === 'done') doneListEl.appendChild(card);
            });
            
            renderEmptyStatePlaceholder(todoListEl, 'todo');
            renderEmptyStatePlaceholder(doingListEl, 'doing');
            renderEmptyStatePlaceholder(doneListEl, 'done');
            
            // Update stats counters
            updateStatsAndBadges(counts);
        }
        
        // Update sprint header widget UI
        updateSprintHeaderWidget(activeSprint);
        
    } else if (planningSprint) {
        document.body.classList.remove('sprint-active');
        document.body.classList.add('sprint-planning');
        if (placeholder) placeholder.style.display = 'none';
        
        // Move backlog back to board
        if (backlogColumn && kanbanBoard && nextSprintColumn) {
            kanbanBoard.insertBefore(backlogColumn, nextSprintColumn);
            backlogColumn.classList.remove('collapsed-mode', 'expanded-mode');
        }
        
        // Render Next Sprint column tasks
        const nextListEl = document.getElementById('next-sprint-cards-list');
        const nextCountEl = document.getElementById('next-sprint-count');
        const startSprintLockBtn = document.getElementById('start-sprint-lock-btn');
        
        if (startSprintLockBtn) startSprintLockBtn.style.display = 'flex';
        
        if (nextListEl) {
            nextListEl.innerHTML = '';
            const sprintTasks = tasks.filter(task => {
                const modeMatch = task.mode === 'scrum' && task.sprintId === planningSprint.id;
                const catMatch = currentCategoryFilter === 'all' || task.category === currentCategoryFilter;
                const prioMatch = currentPriorityFilter === 'all' || task.priority === currentPriorityFilter;
                const titleText = task.title.toLowerCase();
                const descText = (task.description || '').toLowerCase();
                const searchMatch = !searchQuery || titleText.includes(searchQuery) || descText.includes(searchQuery);
                return modeMatch && catMatch && prioMatch && searchMatch;
            });
            
            if (nextCountEl) nextCountEl.textContent = sprintTasks.length;
            
            if (sprintTasks.length === 0) {
                renderEmptyStatePlaceholder(nextListEl, 'next-sprint');
            } else {
                sprintTasks.forEach(task => {
                    const card = createTaskCardDOM(task);
                    nextListEl.appendChild(card);
                });
            }
        }
        
        updateStatsAndBadges({ todo: 0, doing: 0, done: 0 });
        updateSprintHeaderWidget(null);
        
    } else {
        document.body.classList.remove('sprint-active', 'sprint-planning');
        const nextTasks = tasks.filter(task => task.mode === 'scrum' && task.sprintId === 'next_sprint');
        
        if (placeholder) {
            placeholder.style.display = nextTasks.length > 0 ? 'none' : '';
        }
        
        if (backlogColumn && kanbanBoard && placeholder) {
            kanbanBoard.insertBefore(backlogColumn, placeholder);
            backlogColumn.classList.remove('collapsed-mode', 'expanded-mode');
        }
        
        // Ensure Next Sprint is after Backlog and Placeholder
        if (nextSprintColumn && kanbanBoard && placeholder) {
            // Next sprint is already after placeholder in DOM, but just to be sure we don't mess up order
            // actually we don't need to move nextSprintColumn here.
        }
        
        const nextListEl = document.getElementById('next-sprint-cards-list');
        const nextCountEl = document.getElementById('next-sprint-count');
        const startSprintLockBtn = document.getElementById('start-sprint-lock-btn');
        
        // Hide Next Sprint column completely if empty
        if (nextSprintColumn) {
            nextSprintColumn.style.display = nextTasks.length > 0 ? '' : 'none';
        }
        
        // Show start button if there are tasks staged for next sprint
        if (startSprintLockBtn) {
            startSprintLockBtn.style.display = nextTasks.length > 0 ? 'flex' : 'none';
        }
        
        if (nextListEl) {
            nextListEl.innerHTML = '';
            const nextTasks = tasks.filter(task => {
                const modeMatch = task.mode === 'scrum' && task.sprintId === 'next_sprint';
                const catMatch = currentCategoryFilter === 'all' || task.category === currentCategoryFilter;
                const prioMatch = currentPriorityFilter === 'all' || task.priority === currentPriorityFilter;
                const titleText = task.title.toLowerCase();
                const descText = (task.description || '').toLowerCase();
                const searchMatch = !searchQuery || titleText.includes(searchQuery) || descText.includes(searchQuery);
                return modeMatch && catMatch && prioMatch && searchMatch;
            });
            
            if (nextCountEl) nextCountEl.textContent = nextTasks.length;
            
            if (nextTasks.length === 0) {
                renderEmptyStatePlaceholder(nextListEl, 'next-sprint');
            } else {
                nextTasks.forEach(task => {
                    const card = createTaskCardDOM(task);
                    nextListEl.appendChild(card);
                });
            }
        }
        
        // Clear board lists
        const todoListEl = document.getElementById('todo-cards-list');
        const doingListEl = document.getElementById('doing-cards-list');
        const doneListEl = document.getElementById('done-cards-list');
        if (todoListEl && doingListEl && doneListEl) {
            todoListEl.innerHTML = '';
            doingListEl.innerHTML = '';
            doneListEl.innerHTML = '';
            renderEmptyStatePlaceholder(todoListEl, 'todo');
            renderEmptyStatePlaceholder(doingListEl, 'doing');
            renderEmptyStatePlaceholder(doneListEl, 'done');
        }
        
        // Clear board stats when no active sprint
        updateStatsAndBadges({ todo: 0, doing: 0, done: 0 });
        
        // Hide/clear sprint header widget UI
        updateSprintHeaderWidget(null);
    }
    
    // Always render backlog list and history in Scrum mode
    renderBacklogList();
    renderSprintHistoryList();
    
    // Update mobile cart banner (no-op on desktop)
    updateMobileCartBanner();
}

function renderBacklogList() {
    const backlogCardsEl = document.getElementById('backlog-cards-list');
    const backlogCountEl = document.getElementById('backlog-count');
    if (!backlogCardsEl) return;
    
    backlogCardsEl.innerHTML = '';
    
    // Filter backlog tasks
    const backlogTasks = tasks.filter(task => {
        const modeMatch = task.mode === 'scrum' && task.sprintId === null;
        const catMatch = currentCategoryFilter === 'all' || task.category === currentCategoryFilter;
        const prioMatch = currentPriorityFilter === 'all' || task.priority === currentPriorityFilter;
        
        const titleText = task.title.toLowerCase();
        const descText = (task.description || '').toLowerCase();
        const searchMatch = !searchQuery || titleText.includes(searchQuery) || descText.includes(searchQuery);
        
        return modeMatch && catMatch && prioMatch && searchMatch;
    });
    
    if (backlogCountEl) {
        backlogCountEl.textContent = backlogTasks.length;
    }
    
    if (backlogTasks.length === 0) {
        backlogCardsEl.innerHTML = `
            <div class="backlog-empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px; margin-bottom: 8px; color: var(--text-muted);">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>Backlog is empty</span>
            </div>
        `;
        return;
    }
    
    const activeSprint = sprints.find(s => s.status === 'active');
    
    backlogTasks.forEach(task => {
        const item = document.createElement('div');
        item.className = 'backlog-task-item';
        item.id = `backlog-task-id-${task.id}`;
        
        const categoryColor = getCategoryColor(task.category);
        const priorityClass = task.priority.toLowerCase();
        
        let commitBtnHTML = `
            <button class="icon-btn commit-sprint-btn" data-task-id="${task.id}" title="Add to sprint">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; color: var(--accent);">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </button>
        `;
        
        item.innerHTML = `
            <div class="backlog-task-info">
                <h4 class="backlog-task-title">${escapeHTML(task.title)}</h4>
                <div class="backlog-task-meta">
                    <span class="tag-badge" style="color: ${categoryColor}; background-color: ${categoryColor}20; font-size: 10px; padding: 1px 6px;">${task.category}</span>
                    <span class="priority-pill priority-${priorityClass}" style="font-size: 10px; padding: 1px 6px;">${task.priority}</span>
                </div>
            </div>
            <div class="backlog-task-actions">
                ${commitBtnHTML}
                <button class="icon-btn delete-backlog-btn" data-task-id="${task.id}" title="Delete Task">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; color: #EF4444;">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
        
        // Add click listener to edit task
        item.addEventListener('click', (e) => {
            // If clicked on an action button, do not open edit dialog
            if (e.target.closest('.icon-btn')) return;
            openTaskDialog(task);
        });
        
        // Delete task click handler
        item.querySelector('.delete-backlog-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTask(task.id);
        });
        
        // Commit task click handler
        item.querySelector('.commit-sprint-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            commitTaskToSprint(task.id);
        });
        
        backlogCardsEl.appendChild(item);
    });
}

function commitTaskToSprint(taskId) {
    const task = tasks.find(t => t.id === taskId);
    const activeSprint = sprints.find(s => s.status === 'active');
    const planningSprint = sprints.find(s => s.status === 'planning');
    const targetSprint = activeSprint || planningSprint;
    
    if (task) {
        if (targetSprint) {
            task.sprintId = targetSprint.id;
        } else {
            task.sprintId = 'next_sprint';
        }
        saveTasks();
        renderAppUI();
        updateMobileCartBanner();
        const toastMsg = targetSprint && targetSprint.status === 'active'
            ? "Task committed to active sprint."
            : "Task staged for Next Sprint.";
        showToastNotification(toastMsg);
    }
}

function renderSprintHistoryList() {
    const listEl = document.getElementById('sprint-history-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    
    if (sprintHistory.length === 0) {
        listEl.innerHTML = `
            <div style="font-size: 11px; color: var(--text-muted); font-style: italic; padding: 8px 12px; text-align: center;">
                No sprint history
            </div>
        `;
        return;
    }
    
    sprintHistory.forEach(entry => {
        const item = document.createElement('button');
        item.className = 'filter-item';
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'stretch';
        item.style.gap = '2px';
        item.style.padding = '8px 12px';
        item.style.cursor = 'pointer';
        item.style.width = '100%';
        item.style.background = 'transparent';
        item.style.border = 'none';
        
        // Count totals
        const compCount = entry.completedTasks ? entry.completedTasks.length : 0;
        const total = compCount + (entry.incompleteTasks ? entry.incompleteTasks.length : 0);
        
        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span class="filter-label" style="font-weight: 600; color: var(--text-main); font-size: 12px;">${entry.sprintName}</span>
                <span class="filter-count" style="font-size: 9px; padding: 1px 6px;">${compCount}/${total} Done</span>
            </div>
            <span style="font-size: 9px; color: var(--text-muted); text-align: left;">
                ${new Date(entry.completedAt).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
            </span>
        `;
        
        item.addEventListener('click', () => {
            openSprintHistoryDetails(entry);
        });
        
        listEl.appendChild(item);
    });
}

function openSprintHistoryDetails(entry) {
    const sheet = document.getElementById('sprint-review-sheet');
    const backdrop = document.getElementById('sprint-review-backdrop');
    if (!sheet || !backdrop) return;
    
    const subtitleEl = document.getElementById('sprint-review-subtitle');
    if (subtitleEl) subtitleEl.textContent = `${entry.sprintName} Summary (Completed)`;
    
    const completedList = document.getElementById('sprint-review-completed-list');
    const incompleteList = document.getElementById('sprint-review-incomplete-list');
    
    completedList.innerHTML = '';
    incompleteList.innerHTML = '';
    
    document.getElementById('sprint-review-completed-count').textContent = entry.completedTasks.length;
    document.getElementById('sprint-review-incomplete-count').textContent = entry.incompleteTasks.length;
    
    // Render completed tasks
    if (entry.completedTasks.length === 0) {
        completedList.innerHTML = `<div class="review-empty-state">No completed tasks this sprint.</div>`;
    } else {
        entry.completedTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'review-task-item';
            item.innerHTML = `
                <div class="review-task-item-info">
                    <h4 class="review-task-item-title">${escapeHTML(task.title)}</h4>
                    <div class="review-task-item-meta">
                        <span class="tag-badge" style="color: ${getCategoryColor(task.category)}; background-color: ${getCategoryColor(task.category)}20; font-size: 10px; padding: 1px 6px;">${task.category}</span>
                        <span class="priority-pill priority-${task.priority.toLowerCase()}" style="font-size: 10px; padding: 1px 6px;">${task.priority}</span>
                    </div>
                </div>
            `;
            completedList.appendChild(item);
        });
    }
    
    // Render incomplete tasks
    if (entry.incompleteTasks.length === 0) {
        incompleteList.innerHTML = `<div class="review-empty-state">No uncompleted tasks!</div>`;
    } else {
        entry.incompleteTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'review-task-item';
            item.style.flexDirection = 'column';
            item.style.alignItems = 'stretch';
            item.style.gap = '8px';
            
            const resolutionText = task.resolution === 'next' ? 'Moved to Next Sprint' : task.resolution === 'backlog' ? 'Sent to Backlog' : 'Deleted';
            const resolutionBadgeColor = task.resolution === 'next' ? 'var(--accent)' : task.resolution === 'backlog' ? 'var(--primary)' : '#EF4444';
            
            item.innerHTML = `
                <div class="review-task-item-info">
                    <h4 class="review-task-item-title">${escapeHTML(task.title)}</h4>
                    <div class="review-task-item-meta">
                        <span class="tag-badge" style="color: ${getCategoryColor(task.category)}; background-color: ${getCategoryColor(task.category)}20; font-size: 10px; padding: 1px 6px;">${task.category}</span>
                        <span class="priority-pill priority-${task.priority.toLowerCase()}" style="font-size: 10px; padding: 1px 6px;">${task.priority}</span>
                    </div>
                </div>
                <div style="font-size: 10px; font-weight: 700; color: ${resolutionBadgeColor}; margin-top: 4px;">
                    Resolution: ${resolutionText}
                </div>
            `;
            incompleteList.appendChild(item);
        });
    }
    
    // Temporarily hide the "Finish Review" submit button
    const finishBtn = document.getElementById('sprint-review-finish-btn');
    if (finishBtn) finishBtn.style.display = 'none';
    
    // Make sure closing the sheet restores the finish review button
    const closeHandler = () => {
        if (finishBtn) finishBtn.style.display = 'block';
        document.getElementById('sprint-review-close-btn').removeEventListener('click', closeHandler);
        document.getElementById('sprint-review-backdrop').removeEventListener('click', closeHandler);
    };
    document.getElementById('sprint-review-close-btn').addEventListener('click', closeHandler);
    document.getElementById('sprint-review-backdrop').addEventListener('click', closeHandler);
    
    // Open sheet and backdrop
    sheet.classList.add('open');
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function updateSprintHeaderWidget(sprint) {
    const widget = document.getElementById('sprint-header-widget');
    if (!widget) return;
    
    if (sprint) {
        widget.style.display = 'flex';
        
        const nameEl = document.getElementById('sprint-widget-name');
        if (nameEl) nameEl.textContent = sprint.name;
        
        // Calculate days remaining
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = new Date(sprint.endDate + 'T23:59:59');
        const diffMs = end.getTime() - today.getTime();
        const diffDays = Math.ceil(diffMs / 86400000);
        const daysRemaining = diffDays >= 0 ? diffDays : 0;
        
        const countdownEl = document.getElementById('sprint-days-remaining');
        if (countdownEl) countdownEl.textContent = daysRemaining;
        
        // Calculate progress ratio
        const sprintTasks = tasks.filter(t => t.mode === 'scrum' && t.sprintId === sprint.id);
        const completedTasks = sprintTasks.filter(t => t.status === 'done');
        
        const ratioEl = document.getElementById('sprint-progress-ratio');
        if (ratioEl) {
            ratioEl.textContent = `${completedTasks.length}/${sprintTasks.length} Completed`;
        }
        
        const fillEl = document.getElementById('sprint-progress-fill');
        if (fillEl) {
            const percentage = sprintTasks.length > 0 ? Math.round((completedTasks.length / sprintTasks.length) * 100) : 0;
            fillEl.style.width = `${percentage}%`;
        }
    } else {
        widget.style.display = 'none';
    }
}

function removeTaskFromSprint(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.sprintId = null;
        saveTasks();
        
        // If the cart sheet is open, refresh it in place instead of full re-render
        const sheet = document.getElementById('sprint-cart-sheet');
        if (sheet && sheet.classList.contains('open')) {
            renderCartSheetStagedTasks();
            updateMobileCartBanner();
            renderBacklogList(); // refresh backlog so the task reappears
        } else {
            renderAppUI();
        }
        showToastNotification("Task returned to backlog.");
    }
}

function openSprintPlanningModal() {
    const modal = document.getElementById('sprint-planning-modal');
    if (modal) {
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
}

function closeSprintPlanningModal() {
    const modal = document.getElementById('sprint-planning-modal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }
}

function createSprint(durationWeeks) {
    sprintCounter++;
    saveSprintCounter();
    
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 86400000 * 7 * durationWeeks);
    
    const formatDate = (d) => d.toISOString().split('T')[0];
    
    const newSprint = {
        id: "sprint_" + Date.now(),
        name: `Sprint ${sprintCounter}`,
        number: sprintCounter,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        durationWeeks: durationWeeks,
        status: "planning"
    };
    
    sprints = [newSprint]; // Only keep active/current sprint in current pool
    saveSprints();
    
    // Automatically assign any tasks tagged for the next sprint
    tasks.forEach(t => {
        if (t.mode === 'scrum' && t.sprintId === 'next_sprint') {
            t.sprintId = newSprint.id;
        }
    });
    saveTasks();
    
    closeSprintPlanningModal();
    renderAppUI();
}

function startSprint() {
    const planningSprint = sprints.find(s => s.status === 'planning');
    if (planningSprint) {
        planningSprint.status = 'active';
        // Reset start and end dates to "now" since planning could take time
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + 86400000 * 7 * planningSprint.durationWeeks);
        const formatDate = (d) => d.toISOString().split('T')[0];
        planningSprint.startDate = formatDate(startDate);
        planningSprint.endDate = formatDate(endDate);
        
        saveSprints();
        renderAppUI();
        showToastNotification(`${planningSprint.name} started successfully.`);
    }
}

let pendingReviewActions = {};

function endSprint(abandoned = false) {
    const activeSprint = sprints.find(s => s.status === 'active');
    if (!activeSprint) return;
    
    if (abandoned) {
        // Move all tasks back to backlog
        tasks.forEach(t => {
            if (t.mode === 'scrum' && t.sprintId === activeSprint.id) {
                t.sprintId = null;
            }
        });
        saveTasks();
        sprints = [];
        saveSprints();
        renderAppUI();
        showToastNotification("Sprint ended early. Incomplete tasks returned to backlog.");
    } else {
        // Active sprint is completing normally. Start review process.
        const completedTasks = tasks.filter(t => t.mode === 'scrum' && t.sprintId === activeSprint.id && t.status === 'done');
        const incompleteTasks = tasks.filter(t => t.mode === 'scrum' && t.sprintId === activeSprint.id && t.status !== 'done');
        
        openSprintReview(activeSprint, completedTasks, incompleteTasks);
    }
}

function openSprintReview(sprint, completedTasks, incompleteTasks) {
    const sheet = document.getElementById('sprint-review-sheet');
    const backdrop = document.getElementById('sprint-review-backdrop');
    if (!sheet || !backdrop) return;
    
    const subtitleEl = document.getElementById('sprint-review-subtitle');
    if (subtitleEl) subtitleEl.textContent = `${sprint.name} Summary`;
    
    // Clear lists
    const completedList = document.getElementById('sprint-review-completed-list');
    const incompleteList = document.getElementById('sprint-review-incomplete-list');
    
    completedList.innerHTML = '';
    incompleteList.innerHTML = '';
    
    document.getElementById('sprint-review-completed-count').textContent = completedTasks.length;
    document.getElementById('sprint-review-incomplete-count').textContent = incompleteTasks.length;
    
    // Reset pending choices
    pendingReviewActions = {};
    
    // Render completed tasks
    if (completedTasks.length === 0) {
        completedList.innerHTML = `<div class="review-empty-state">No completed tasks this sprint.</div>`;
    } else {
        completedTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'review-task-item';
            item.innerHTML = `
                <div class="review-task-item-info">
                    <h4 class="review-task-item-title">${escapeHTML(task.title)}</h4>
                    <div class="review-task-item-meta">
                        <span class="tag-badge" style="color: ${getCategoryColor(task.category)}; background-color: ${getCategoryColor(task.category)}20; font-size: 10px; padding: 1px 6px;">${task.category}</span>
                        <span class="priority-pill priority-${task.priority.toLowerCase()}" style="font-size: 10px; padding: 1px 6px;">${task.priority}</span>
                    </div>
                </div>
            `;
            completedList.appendChild(item);
        });
    }
    
    // Render incomplete tasks with resolution buttons
    if (incompleteTasks.length === 0) {
        incompleteList.innerHTML = `<div class="review-empty-state">All tasks were completed! Excellent work.</div>`;
    } else {
        incompleteTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'review-task-item';
            item.style.flexDirection = 'column';
            item.style.alignItems = 'stretch';
            item.style.gap = '8px';
            
            // Default action to "next"
            pendingReviewActions[task.id] = 'next';
            
            item.innerHTML = `
                <div class="review-task-item-info">
                    <h4 class="review-task-item-title">${escapeHTML(task.title)}</h4>
                    <div class="review-task-item-meta">
                        <span class="tag-badge" style="color: ${getCategoryColor(task.category)}; background-color: ${getCategoryColor(task.category)}20; font-size: 10px; padding: 1px 6px;">${task.category}</span>
                        <span class="priority-pill priority-${task.priority.toLowerCase()}" style="font-size: 10px; padding: 1px 6px;">${task.priority}</span>
                    </div>
                </div>
                <div class="incomplete-task-actions">
                    <button class="incomplete-action-btn action-next selected" data-task-id="${task.id}" data-action="next">Move to Next Sprint</button>
                    <button class="incomplete-action-btn action-backlog" data-task-id="${task.id}" data-action="backlog">Backlog</button>
                    <button class="incomplete-action-btn action-delete" data-task-id="${task.id}" data-action="delete">Delete</button>
                </div>
            `;
            
            // Wire action buttons
            item.querySelectorAll('.incomplete-action-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    const taskId = parseInt(btn.dataset.taskId);
                    
                    pendingReviewActions[taskId] = action;
                    
                    // Toggle selection states
                    item.querySelectorAll('.incomplete-action-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                });
            });
            
            incompleteList.appendChild(item);
        });
    }
    
    // Open sheets
    sheet.classList.add('open');
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeSprintReview() {
    const sheet = document.getElementById('sprint-review-sheet');
    const backdrop = document.getElementById('sprint-review-backdrop');
    if (sheet) sheet.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    document.body.style.overflow = '';
}

function finishSprintReview() {
    const activeSprint = sprints.find(s => s.status === 'active');
    if (!activeSprint) return;
    
    // Snapshots for history
    const completedTasksSnapshot = tasks.filter(t => t.mode === 'scrum' && t.sprintId === activeSprint.id && t.status === 'done');
    const incompleteTasksSnapshot = tasks.filter(t => t.mode === 'scrum' && t.sprintId === activeSprint.id && t.status !== 'done');
    
    // Process incomplete task resolution choices
    Object.keys(pendingReviewActions).forEach(taskIdStr => {
        const taskId = parseInt(taskIdStr);
        const action = pendingReviewActions[taskId];
        const task = tasks.find(t => t.id === taskId);
        
        if (task) {
            if (action === 'next') {
                task.sprintId = 'next_sprint'; // Tagged to be pulled into next sprint on creation
            } else if (action === 'backlog') {
                task.sprintId = null; // Sent back to backlog
            } else if (action === 'delete') {
                tasks = tasks.filter(t => t.id !== taskId); // Deleted
            }
        }
    });
    
    // Create Sprint History Entry
    const historyEntry = {
        sprintId: activeSprint.id,
        sprintName: activeSprint.name,
        startDate: activeSprint.startDate,
        endDate: activeSprint.endDate,
        completedAt: new Date().toISOString(),
        wasAbandoned: false,
        completedTasks: completedTasksSnapshot.map(t => ({...t})),
        incompleteTasks: incompleteTasksSnapshot.map(t => ({
            ...t,
            resolution: pendingReviewActions[t.id] || 'next'
        }))
    };
    
    sprintHistory.unshift(historyEntry);
    pruneSprintHistory();
    saveSprintHistory();
    
    // Close the current active sprint
    sprints = [];
    saveSprints();
    saveTasks();
    
    closeSprintReview();
    renderAppUI();
    
    showToastNotification(`${activeSprint.name} review completed. History updated.`);
}

function pruneSprintHistory() {
    // Keep max 8 weeks (56 days) of sprints OR max 200 tasks in history, whichever hits first
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 56);
    const cutoffDateStr = cutoffDate.toISOString();
    
    // Filter out sprints older than 8 weeks
    sprintHistory = sprintHistory.filter(sprint => sprint.completedAt >= cutoffDateStr);
    
    let totalTasksInHistory = 0;
    let cutoffIndex = -1;
    
    for (let i = 0; i < sprintHistory.length; i++) {
        const sprint = sprintHistory[i];
        const completedCount = sprint.completedTasks ? sprint.completedTasks.length : 0;
        const incompleteCount = sprint.incompleteTasks ? sprint.incompleteTasks.length : 0;
        totalTasksInHistory += (completedCount + incompleteCount);
        
        if (totalTasksInHistory > 200) {
            cutoffIndex = i;
            break;
        }
    }
    
    if (cutoffIndex !== -1) {
        sprintHistory = sprintHistory.slice(0, cutoffIndex);
    }
}

function checkSprintExpiry() {
    const activeSprint = sprints.find(s => s.status === 'active');
    if (!activeSprint) return;
    
    const todayStr = new Date().toISOString().split('T')[0];
    if (activeSprint.endDate < todayStr) {
        endSprint(false); // End sprint normal way -> launches review modal
    }
}

// Create a premium Task Card Element
function createTaskCardDOM(task) {
    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority.toLowerCase()}`;
    card.id = `task-id-${task.id}`;
    
    // Disable native HTML5 drag on mobile to prevent touch events from being swallowed
    if (window.innerWidth >= 768) {
        card.setAttribute('draggable', 'true');
    }

    // Due Date Visual Treatment
    let dueDateHTML = '';
    if (task.dueDate) {
        const todayStr = new Date().toISOString().split('T')[0];
        const dueObj = new Date(task.dueDate + 'T23:59:59'); // Prevent time-zone shifting
        const formattedDate = dueObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        let dueClass = '';
        if (task.status !== 'done') {
            if (task.dueDate < todayStr) {
                dueClass = 'overdue';
            } else if (task.dueDate === todayStr) {
                dueClass = 'today';
            }
        }

        dueDateHTML = `
            <div class="task-due-date ${dueClass}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span>${formattedDate}${dueClass === 'overdue' ? ' (Overdue)' : dueClass === 'today' ? ' (Today)' : ''}</span>
            </div>
        `;
    }

    // Quick mobile action arrows based on current column status
    let quickActionsHTML = '';
    if (task.status === 'todo') {
        quickActionsHTML = `
            <button class="quick-shift-btn next" data-shift-dir="next" title="Start task (Move to Doing)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
            </button>
        `;
    } else if (task.status === 'doing') {
        quickActionsHTML = `
            <button class="quick-shift-btn prev" data-shift-dir="prev" title="Defer task (Move to To Do)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
            </button>
            <button class="quick-shift-btn next" data-shift-dir="next" title="Complete task (Move to Done)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            </button>
        `;
    } else if (task.status === 'done') {
        quickActionsHTML = `
            <button class="quick-shift-btn prev" data-shift-dir="prev" title="Reopen task (Move to Doing)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
            </button>
        `;
    }

    card.innerHTML = `
        <div class="task-card-header">
            <div class="task-tags-row">
                <span class="tag-badge" style="color: ${getCategoryColor(task.category)}; background-color: ${getCategoryColor(task.category)}20;">${task.category}</span>
                <span class="priority-pill">${task.priority}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
                ${task.mode === 'scrum' && task.sprintId ? `
                <button class="column-add-btn send-backlog-trigger" title="Move Task to Backlog">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                        <path d="M17 1l4 4-4 4"/>
                        <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                        <path d="M7 23l-4-4 4-4"/>
                        <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                    </svg>
                </button>
                ` : ''}
                <button class="column-add-btn delete-card-trigger" title="Delete Task">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="task-card-body">
            <h4 class="task-title">${escapeHTML(task.title)}</h4>
            ${task.description ? `<p class="task-desc">${escapeHTML(task.description)}</p>` : ''}
        </div>
        <div class="task-card-footer">
            ${dueDateHTML}
            <div class="card-nav-controls">
                ${quickActionsHTML}
            </div>
        </div>
    `;

    // --- Dynamic Card Listeners ---
    
    // 1. Drag & Drop hooks (Desktop)
    card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
    });

    // 2. Open View Overlay (fixes iOS Safari div click bug)
    card.onclick = (e) => {
        // Only open if they didn't click a quick action button
        if (!e.target.closest('button')) {
            openTaskViewModal(task);
        }
    };

    // 3. Delete Action Hook
    card.querySelector('.delete-card-trigger').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTask(task.id);
    });

    // 3.1. Send to Backlog Hook (Scrum Mode only)
    const backlogTrigger = card.querySelector('.send-backlog-trigger');
    if (backlogTrigger) {
        backlogTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            removeTaskFromSprint(task.id);
        });
    }

    // 4. Quick-shift controls (Mobile)
    card.querySelectorAll('.quick-shift-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const direction = btn.dataset.shiftDir;
            shiftTaskStatus(task, direction);
        });
    });

    return card;
}

// Render empty states for clean look
function renderEmptyStatePlaceholder(listEl, columnStatus) {
    if (listEl.children.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.className = 'column-empty-state';
        
        let statusMsg = "No tasks to do";
        if (columnStatus === 'doing') statusMsg = "Nothing active in progress";
        if (columnStatus === 'done') statusMsg = "No completed tasks yet";

        placeholder.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>${statusMsg}</span>
        `;
        listEl.appendChild(placeholder);
    }
}

// Dynamic dashboard counters and progress ring updates
function updateStatsAndBadges(counts) {
    // 1. Update Column Title Counts
    document.getElementById('todo-count').textContent = counts.todo;
    document.getElementById('doing-count').textContent = counts.doing;
    document.getElementById('done-count').textContent = counts.done;

    // 2. Update Mobile Tab Badge Counts
    document.getElementById('badge-todo-count').textContent = counts.todo;
    document.getElementById('badge-doing-count').textContent = counts.doing;
    document.getElementById('badge-done-count').textContent = counts.done;

    // 3. Update Sidebar Stats Panel
    document.getElementById('stats-todo-count').textContent = counts.todo;
    document.getElementById('stats-doing-count').textContent = counts.doing;
    document.getElementById('stats-done-count').textContent = counts.done;

    // 4. Calculate total and completion rate
    const total = counts.todo + counts.doing + counts.done;
    const percentage = total > 0 ? Math.round((counts.done / total) * 100) : 0;

    // 5. Update Dynamic Completion Circular Chart (Desktop)
    const progressFillCircle = document.getElementById('progress-circle-fill');
    const progressLabel = document.getElementById('progress-percentage-label');
    
    if (progressFillCircle && progressLabel) {
        progressFillCircle.setAttribute('stroke-dasharray', `${percentage}, 100`);
        progressLabel.textContent = `${percentage}%`;
    }

    // 6. Update Welcome Overview Text Summary
    const overviewSubtitle = document.getElementById('dashboard-subtitle-string');
    if (overviewSubtitle) {
        if (total === 0) {
            overviewSubtitle.textContent = "Start fresh. Create a task to map your workflow today.";
        } else {
            const activeMsg = counts.doing === 1 ? "1 active task" : `${counts.doing} active tasks`;
            overviewSubtitle.textContent = `You have ${activeMsg} in progress today (${percentage}% completed).`;
        }
    }

    // 7. Update Project Sidebar count badges dynamically based on entire DB
    updateSidebarCategoryBadges();
}

// Recalculate complete dashboard counts for category items
function updateSidebarCategoryBadges() {
    let modeTasks;
    if (currentMode === 'scrum') {
        const activeSprint = sprints.find(s => s.status === 'active');
        const planningSprint = sprints.find(s => s.status === 'planning');
        if (activeSprint) {
            modeTasks = tasks.filter(t => t.mode === 'scrum' && t.sprintId === activeSprint.id);
        } else if (planningSprint) {
            modeTasks = tasks.filter(t => t.mode === 'scrum' && t.sprintId === planningSprint.id);
        } else {
            modeTasks = tasks.filter(t => t.mode === 'scrum');
        }
    } else {
        modeTasks = tasks.filter(t => t.mode === 'kanban');
    }
    
    // Status (state) filter logic
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
        if (activeMobileTab === 'todo') {
            modeTasks = modeTasks.filter(t => t.status === 'todo');
        } else if (activeMobileTab === 'doing') {
            modeTasks = modeTasks.filter(t => t.status === 'doing');
        } else if (activeMobileTab === 'done') {
            modeTasks = modeTasks.filter(t => t.status === 'done');
        }
    } else {
        // Desktop: category counts represent active work (exclude done tasks)
        modeTasks = modeTasks.filter(t => t.status !== 'done');
    }
    
    let totals = { all: modeTasks.length };
    categories.forEach(c => totals[c.name] = 0);
    
    modeTasks.forEach(t => {
        if (totals[t.category] !== undefined) {
            totals[t.category]++;
        }
    });

    const sidebarList = document.getElementById('category-filter-list');
    const mobileList = document.getElementById('mobile-category-filters');
    
    if (sidebarList) {
        let sidebarHTML = `
            <button class="filter-item ${currentCategoryFilter === 'all' ? 'active' : ''}" data-category-filter="all">
                <span class="filter-label"><span class="sidebar-dot" style="background-color: var(--text-muted);"></span>All Tasks</span>
                <span class="filter-count" id="count-all">${totals.all}</span>
            </button>
        `;
        categories.forEach(cat => {
            if (totals[cat.name] > 0 || currentCategoryFilter === cat.name) {
                sidebarHTML += `
                    <button class="filter-item ${currentCategoryFilter === cat.name ? 'active' : ''}" data-category-filter="${cat.name}">
                        <span class="filter-label"><span class="sidebar-dot" style="background-color: ${cat.color};"></span>${cat.name}</span>
                        <span class="filter-count">${totals[cat.name] || 0}</span>
                    </button>
                `;
            }
        });
        sidebarList.innerHTML = sidebarHTML;
        
        document.querySelectorAll('#category-filter-list [data-category-filter]').forEach(item => {
            item.addEventListener('click', () => {
                currentCategoryFilter = item.dataset.categoryFilter;
                renderAppUI();
            });
        });
    }

    if (mobileList) {
        let mobileHTML = `
            <div class="mobile-filter-pill ${currentCategoryFilter === 'all' ? 'active' : ''}" data-category-filter="all">All Tasks (${totals.all})</div>
        `;
        categories.forEach(cat => {
            if (totals[cat.name] > 0 || currentCategoryFilter === cat.name) {
                mobileHTML += `
                    <div class="mobile-filter-pill ${currentCategoryFilter === cat.name ? 'active' : ''}" data-category-filter="${cat.name}">${cat.name} (${totals[cat.name] || 0})</div>
                `;
            }
        });
        mobileList.innerHTML = mobileHTML;
        
        document.querySelectorAll('#mobile-category-filters .mobile-filter-pill').forEach(item => {
            item.addEventListener('click', () => {
                currentCategoryFilter = item.dataset.categoryFilter;
                renderAppUI();
            });
        });
    }
}

function populateCategoryDropdowns() {
    const select = document.getElementById('form-task-category');
    if (select) {
        const currentVal = select.value;
        select.innerHTML = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        if (currentVal && categories.find(c => c.name === currentVal)) {
            select.value = currentVal;
        }
    }
}

// --- Task Flow Mutations ---

function shiftTaskStatus(task, direction) {
    const statusSequence = ['todo', 'doing', 'done'];
    const currentIndex = statusSequence.indexOf(task.status);
    
    let nextIndex = currentIndex;
    if (direction === 'next' && currentIndex < 2) {
        nextIndex = currentIndex + 1;
    } else if (direction === 'prev' && currentIndex > 0) {
        nextIndex = currentIndex - 1;
    }

    if (nextIndex !== currentIndex) {
        const oldStatus = task.status;
        task.status = statusSequence[nextIndex];
        saveTasks();
        renderAppUI();
        
        let label = task.status === 'doing' ? 'started (Moving to Doing)' : task.status === 'done' ? 'completed (Moving to Done)' : 'deferred (Moving to To Do)';
        showToastNotification(`Task ${label}.`);
    }
}

function deleteTask(id) {
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    showConfirmDialog(
        "Delete Task",
        `Are you sure you want to remove "${escapeHTML(taskToDelete.title)}"?`,
        "Delete",
        true,
        () => {
            tasks = tasks.filter(t => t.id !== id);
            saveTasks();
            renderAppUI();
            showToastNotification("Task removed from flow.");
        }
    );
}

// --- Responsive Creator Dialog Handler ---
// ========== TASK VIEW MODAL LOGIC ==========
let currentViewTask = null;
const viewModal = document.getElementById('task-view-modal');

function openTaskViewModal(task) {
    currentViewTask = task;
    document.getElementById('view-task-title').textContent = task.title;
    document.getElementById('view-task-category').textContent = task.category;
    document.getElementById('view-task-priority').textContent = task.priority;
    
    // Set category badge color
    const catBadge = document.getElementById('view-task-category');
    catBadge.style.color = getCategoryColor(task.category);
    catBadge.style.backgroundColor = `${getCategoryColor(task.category)}20`;

    const descEl = document.getElementById('view-task-desc');
    if (task.description) {
        descEl.textContent = task.description;
        descEl.style.display = 'block';
    } else {
        descEl.style.display = 'none';
    }

    // Status format
    let statusText = 'To Do';
    if (task.status === 'doing') statusText = 'Doing';
    if (task.status === 'done') statusText = 'Done';
    document.getElementById('view-task-status').textContent = statusText;

    // Due date format
    if (task.dueDate) {
        const dueObj = new Date(task.dueDate + 'T23:59:59');
        document.getElementById('view-task-due').textContent = dueObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else {
        document.getElementById('view-task-due').textContent = 'No Date';
    }

    viewModal.classList.add('open');
}

document.getElementById('view-modal-close-btn').addEventListener('click', () => {
    viewModal.classList.remove('open');
    currentViewTask = null;
});

viewModal.addEventListener('click', (e) => {
    if (e.target === viewModal) {
        viewModal.classList.remove('open');
        currentViewTask = null;
    }
});

document.getElementById('view-modal-edit-btn').addEventListener('click', () => {
    viewModal.classList.remove('open');
    if (currentViewTask) {
        openTaskDialog(currentViewTask);
    }
});

function openTaskDialog(task = null) {
    populateCategoryDropdowns();
    const modal = document.getElementById('task-modal');
    const form = document.getElementById('task-creation-form');
    const editIdInput = document.getElementById('edit-task-id');
    const actionTitle = document.getElementById('modal-action-title');
    const submitBtn = document.getElementById('form-submit-btn');

    if (!modal || !form) return;

    form.reset();

    // Set Default Due Date to today for convenient input
    document.getElementById('form-task-due').value = '';

    if (task) {
        // Mode: EDIT Mode
        actionTitle.textContent = "Edit Task Flow";
        submitBtn.textContent = "Update Task";
        editIdInput.value = task.id;
        
        document.getElementById('form-task-title').value = task.title;
        document.getElementById('form-task-desc').value = task.description || '';
        document.getElementById('form-task-category').value = task.category;
        document.getElementById('form-task-priority').value = task.priority;
        document.getElementById('form-task-status').value = task.status;
        document.getElementById('form-task-due').value = task.dueDate || '';
    } else {
        // Mode: CREATE Mode
        actionTitle.textContent = "Create Task";
        submitBtn.textContent = "Save Task";
        editIdInput.value = '';
        
        // Match default columns if launched from a column '+' button
        const formStatus = document.getElementById('form-task-status');
        if (window.activeColumnShortcut && ['todo', 'doing', 'done'].includes(window.activeColumnShortcut)) {
            formStatus.value = window.activeColumnShortcut;
        } else {
            formStatus.value = 'todo';
        }
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden'; // Lock base scroll
}

function closeTaskDialog() {
    const modal = document.getElementById('task-modal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = ''; // Release scroll
        window.activeColumnShortcut = null; // Flush active shortcuts
    }
}

// --- Toast Feedback Alert ---
function showToastNotification(message) {
    const toast = document.getElementById('app-toast');
    const toastLabel = document.getElementById('toast-message-text');
    if (toast && toastLabel) {
        toastLabel.textContent = message;
        toast.classList.add('show');
        
        if (window.toastTimer) {
            clearTimeout(window.toastTimer);
        }
        
        window.toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// --- Native Confirm Dialog ---
function showConfirmDialog(title, message, confirmText, isDanger, onConfirm) {
    const modal = document.getElementById('native-confirm-modal');
    if (!modal) return;
    
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;
    
    const actionBtn = document.getElementById('confirm-modal-action-btn');
    actionBtn.textContent = confirmText;
    
    if (isDanger) {
        if (!actionBtn.classList.contains('btn-primary')) actionBtn.classList.add('btn-primary');
        actionBtn.style.background = '#EF4444';
        actionBtn.style.color = 'white';
        actionBtn.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
    } else {
        if (!actionBtn.classList.contains('btn-primary')) actionBtn.classList.add('btn-primary');
        actionBtn.style.background = '';
        actionBtn.style.color = '';
        actionBtn.style.boxShadow = '';
    }
    
    modal.classList.add('open');
    
    const cancelBtn = document.getElementById('confirm-modal-cancel-btn');
    
    // Create new clean handlers to avoid stacking multiple listeners
    const closeAndCleanup = () => {
        modal.classList.remove('open');
        cancelBtn.removeEventListener('click', onCancelClick);
        actionBtn.removeEventListener('click', onActionClick);
    };
    
    const onCancelClick = () => closeAndCleanup();
    const onActionClick = () => {
        closeAndCleanup();
        if (onConfirm) onConfirm();
    };
    
    cancelBtn.addEventListener('click', onCancelClick);
    actionBtn.addEventListener('click', onActionClick);
}

// --- Desktop HTML5 Drag & Drop Logic ---
function setupDragAndDropHandlers() {
    const boardColumns = document.querySelectorAll('.kanban-column');
    
    boardColumns.forEach(column => {
        const cardsListBox = column.querySelector('.column-cards-list');
        const columnStatus = column.dataset.status;

        // Visual drag hover feedback
        column.addEventListener('dragenter', (e) => {
            e.preventDefault();
            column.classList.add('drag-over');
        });

        column.addEventListener('dragover', (e) => {
            e.preventDefault();
            column.classList.add('drag-over');
        });

        column.addEventListener('dragleave', () => {
            column.classList.remove('drag-over');
        });

        column.addEventListener('drop', (e) => {
            e.preventDefault();
            column.classList.remove('drag-over');

            const taskId = parseInt(e.dataTransfer.getData('text/plain'));
            const draggedTask = tasks.find(t => t.id === taskId);

            if (draggedTask && draggedTask.status !== columnStatus) {
                draggedTask.status = columnStatus;
                saveTasks();
                renderAppUI();
                
                let label = columnStatus === 'doing' ? 'started (Moving to Doing)' : columnStatus === 'done' ? 'completed (Moving to Done)' : 'deferred (Moving to To Do)';
                showToastNotification(`Task ${label}.`);
            }
        });
    });
}

// --- Mobile Segmented Columns switcher ---
function setupMobileTabSwitcher() {
    const tabTriggers = document.querySelectorAll('.tab-trigger');
    const segmentedControl = document.getElementById('column-segmented-control');

    tabTriggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const targetStatus = trigger.dataset.tabTarget;
            
            // Update active states on buttons
            tabTriggers.forEach(btn => btn.classList.remove('active'));
            trigger.classList.add('active');

            // Slide the backing indicator slider
            if (segmentedControl) {
                segmentedControl.setAttribute('data-active-tab', targetStatus);
            }

            // Sync layout view on mobile Columns
            document.querySelectorAll('.kanban-column').forEach(column => {
                column.classList.remove('active-tab');
                if (column.dataset.status === targetStatus) {
                    column.classList.add('active-tab');
                }
            });

            activeMobileTab = targetStatus;
            updateSidebarCategoryBadges();
        });
    });
}


// --- Sprint Cart (Mobile) ---

let cartSelectedWeeks = 1;

function updateMobileCartBanner() {
    const banner = document.getElementById('sprint-cart-banner');
    const reviewBtn = document.getElementById('sprint-cart-review-btn');
    if (!banner) return;

    // Only relevant in Scrum mode with no active/planning sprint
    const activeSprint = sprints.find(s => s.status === 'active');
    const planningSprint = sprints.find(s => s.status === 'planning');
    if (activeSprint || planningSprint || currentMode !== 'scrum') {
        banner.classList.remove('visible');
        banner.setAttribute('aria-hidden', 'true');
        return;
    }

    const stagedTasks = tasks.filter(t => t.mode === 'scrum' && t.sprintId === 'next_sprint');
    
    // Always show banner when in Scrum mode and no sprint is active/planning
    banner.classList.add('visible');
    banner.setAttribute('aria-hidden', 'false');

    const subtitleEl = banner.querySelector('.cart-banner-subtitle');

    if (stagedTasks.length > 0) {
        if (subtitleEl) {
            subtitleEl.innerHTML = `<span id="cart-task-count">${stagedTasks.length}</span> Tasks Staged`;
        }
        if (reviewBtn) {
            reviewBtn.disabled = false;
        }
    } else {
        if (subtitleEl) {
            subtitleEl.textContent = 'Tap + on backlog tasks to plan';
        }
        if (reviewBtn) {
            reviewBtn.disabled = true;
        }
        closeSprintCartSheet();
    }
}

function renderCartSheetStagedTasks() {
    const listEl = document.getElementById('cart-sheet-staged-list');
    if (!listEl) return;

    const stagedTasks = tasks.filter(t => t.mode === 'scrum' && t.sprintId === 'next_sprint');
    listEl.innerHTML = '';

    if (stagedTasks.length === 0) {
        listEl.innerHTML = `<div class="review-empty-state" style="padding: 24px; text-align: center; color: var(--text-muted);">No tasks staged yet. Tap + on backlog tasks to add them.</div>`;
        return;
    }

    stagedTasks.forEach(task => {
        const categoryColor = getCategoryColor(task.category);
        const item = document.createElement('div');
        item.className = 'cart-staged-item';
        item.innerHTML = `
            <div class="cart-staged-item-info">
                <h4 class="cart-staged-item-title">${escapeHTML(task.title)}</h4>
                <div class="backlog-task-meta" style="gap: 6px;">
                    <span class="tag-badge" style="color: ${categoryColor}; background-color: ${categoryColor}20; font-size: 10px; padding: 1px 6px;">${task.category}</span>
                    <span class="priority-pill priority-${task.priority.toLowerCase()}" style="font-size: 10px; padding: 1px 6px;">${task.priority}</span>
                </div>
            </div>
            <button class="cart-remove-btn" data-task-id="${task.id}" title="Remove from sprint cart">&times;</button>
        `;
        item.querySelector('.cart-remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            removeTaskFromSprint(parseInt(e.currentTarget.dataset.taskId));
        });
        listEl.appendChild(item);
    });
}

function openSprintCartSheet() {
    const sheet = document.getElementById('sprint-cart-sheet');
    if (!sheet) return;
    renderCartSheetStagedTasks();
    sheet.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeSprintCartSheet() {
    const sheet = document.getElementById('sprint-cart-sheet');
    if (sheet) sheet.classList.remove('open');
    document.body.style.overflow = '';
}

function addQuickBacklogTask() {
    const input = document.getElementById('quick-add-backlog-input');
    if (!input) return;
    const title = input.value.trim();
    if (!title) return;

    // Use first available category and default to Medium priority
    const defaultCategory = categories.length > 0 ? categories[0].name : 'Work';

    const newTask = {
        id: Date.now(),
        title,
        description: '',
        category: defaultCategory,
        priority: 'Medium',
        status: 'todo',
        dueDate: '',
        mode: 'scrum',
        sprintId: null
    };

    tasks.push(newTask);
    saveTasks();
    renderBacklogList();
    updateMobileCartBanner();
    input.value = '';
    showToastNotification('Task added to backlog.');
}

// --- Set Event Listeners & Controllers ---
function setupApplicationListeners() {
    // 1. Modal Dialog Close actions
    document.getElementById('modal-close-btn').addEventListener('click', closeTaskDialog);
    document.getElementById('form-cancel-btn').addEventListener('click', closeTaskDialog);
    
    // Close overlay if user clicks outside card
    document.getElementById('task-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('task-modal')) {
            closeTaskDialog();
        }
    });

    // 2. Add Task Form Submit Handler
    document.getElementById('task-creation-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        try {
            const title = document.getElementById('form-task-title').value.trim();
            const desc = document.getElementById('form-task-desc').value.trim();
            const categoryEl = document.getElementById('form-task-category');
            const category = categoryEl ? categoryEl.value : 'Work';
            const priorityEl = document.getElementById('form-task-priority');
            const priority = priorityEl ? priorityEl.value : 'Medium';
            const statusEl = document.getElementById('form-task-status');
            const status = statusEl ? statusEl.value : 'todo';
            const dueDate = document.getElementById('form-task-due').value;
            const editId = document.getElementById('edit-task-id').value;

            if (!title) return;
            
            if (!Array.isArray(tasks)) tasks = [];

            if (editId) {
                // Mode: EDIT - update existing
                const targetTask = tasks.find(t => t.id === parseInt(editId));
                if (targetTask) {
                    targetTask.title = title;
                    targetTask.description = desc;
                    targetTask.category = category;
                    targetTask.priority = priority;
                    targetTask.status = status;
                    targetTask.dueDate = dueDate;
                    showToastNotification("Task flow updated.");
                }
            } else {
                // Mode: CREATE - add new
                const newTask = {
                    id: Date.now(),
                    title,
                    description: desc,
                    category,
                    priority,
                    status,
                    dueDate,
                    mode: currentMode,
                    sprintId: null
                };
                tasks.push(newTask);
                showToastNotification("Task saved to flow.");
            }

            saveTasks();
            closeTaskDialog();
            renderAppUI();
        } catch (err) {
            console.error("Task Save Error:", err);
            showToastNotification("Error saving task. Check console.");
        }
    });

    // 3. Create Task Buttons hooks
    document.getElementById('global-add-task-fab').addEventListener('click', () => openTaskDialog());
    document.getElementById('header-add-task-btn').addEventListener('click', () => openTaskDialog());
    
    const backlogAddBtn = document.getElementById('backlog-add-task-btn');
    if (backlogAddBtn) {
        backlogAddBtn.addEventListener('click', () => {
            window.activeColumnShortcut = 'todo';
            openTaskDialog();
        });
    }
    
    // Column header '+' buttons shortcut hooks
    document.querySelectorAll('[data-column-add]').forEach(btn => {
        btn.addEventListener('click', () => {
            const defaultColumnStatus = btn.dataset.columnAdd;
            window.activeColumnShortcut = defaultColumnStatus;
            openTaskDialog();
        });
    });

    // 4. Sidebar Project Category Filter selectors (Desktop)
    // Managed dynamically by updateSidebarCategoryBadges()

    // 5. Sidebar Priority Filter selectors
    document.querySelectorAll('[data-priority-filter]').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('[data-priority-filter]').forEach(b => b.classList.remove('active'));
            item.classList.add('active');
            currentPriorityFilter = item.dataset.priorityFilter;
            renderAppUI();
        });
    });

    // Listen for OS-level theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e) => {
        if (!safeStorage.get('airj-theme')) {
            isLightTheme = !e.matches;
            applyTheme(isLightTheme);
        }
    };
    
    // Support older Safari versions that don't have addEventListener on matchMedia
    if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleMediaChange);
    } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleMediaChange);
    }

    // 6. Global Theme Mode Switcher
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Avoid closing profile dropdown immediately
            isLightTheme = !isLightTheme;
            applyTheme(isLightTheme);
            showToastNotification(isLightTheme ? "Frosted Foam light theme applied." : "Deep Ocean Abyss dark theme applied.");
        });
    }

    // 6.1. Profile Avatar Dropdown Toggler
    const profileAvatar = document.getElementById('profile-avatar');
    const profileDropdownWrapper = document.getElementById('profile-dropdown-wrapper');
    if (profileAvatar && profileDropdownWrapper) {
        profileAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdownWrapper.classList.toggle('open');
            const isOpen = profileDropdownWrapper.classList.contains('open');
            profileAvatar.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (profileDropdownWrapper.classList.contains('open')) {
                if (!profileDropdownWrapper.contains(e.target)) {
                    profileDropdownWrapper.classList.remove('open');
                    profileAvatar.setAttribute('aria-expanded', 'false');
                }
            }
        });
    }

    // 6.2. Header Mode Toggle Switcher
    const modeToggle = document.getElementById('header-mode-toggle');
    if (modeToggle) {
        modeToggle.querySelectorAll('.mode-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetMode = btn.dataset.mode;
                switchMode(targetMode);
            });
        });
        
        // Initial setup for the slider position
        modeToggle.setAttribute('data-active-mode', currentMode);
        modeToggle.querySelectorAll('.mode-toggle-btn').forEach(btn => {
            if (btn.dataset.mode === currentMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // 7. Global Search Input Controller
    const searchInput = document.getElementById('global-search-input');
    const searchClearBtn = document.getElementById('search-clear-btn');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            if (searchClearBtn) {
                if (searchQuery) {
                    searchClearBtn.classList.add('visible');
                } else {
                    searchClearBtn.classList.remove('visible');
                }
            }
            renderAppUI();
        });
    }

    if (searchClearBtn && searchInput) {
        searchClearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            searchClearBtn.classList.remove('visible');
            renderAppUI();
            searchInput.focus();
        });
    }

    // 8. Mobile Action Toolbar Toggles (Search & Day Review)
    const mobileSearchToggle = document.getElementById('mobile-search-toggle-btn');
    const mobileReviewToggle = document.getElementById('mobile-review-toggle-btn');
    const mobileSearchPanel = document.getElementById('mobile-search-panel');

    if (mobileSearchToggle && mobileSearchPanel) {
        mobileSearchToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = mobileSearchPanel.classList.contains('search-open');
            if (isOpen) {
                // Close search
                mobileSearchPanel.classList.remove('search-open');
                mobileSearchToggle.classList.remove('active');
            } else {
                // Close review sheet if open
                closeReviewSheet();
                // Open search
                mobileSearchPanel.classList.add('search-open');
                mobileSearchToggle.classList.add('active');
                if (searchInput) {
                    searchInput.focus();
                }
            }
        });

        // Close search panel on outside click
        document.addEventListener('click', (e) => {
            if (mobileSearchPanel.classList.contains('search-open')) {
                if (!mobileSearchPanel.contains(e.target) && !mobileSearchToggle.contains(e.target)) {
                    mobileSearchPanel.classList.remove('search-open');
                    mobileSearchToggle.classList.remove('active');
                }
            }
        });
    }

    if (mobileReviewToggle) {
        mobileReviewToggle.addEventListener('click', () => {
            const reviewSheet = document.getElementById('review-bottom-sheet');
            const isOpen = reviewSheet && reviewSheet.classList.contains('open');
            if (isOpen) {
                closeReviewSheet();
            } else {
                // Close search if open
                if (mobileSearchPanel) {
                    mobileSearchPanel.classList.remove('search-open');
                }
                if (mobileSearchToggle) {
                    mobileSearchToggle.classList.remove('active');
                }
                openReviewSheet();
            }
        });
    }

    // 9. Day Review Close controls
    const reviewCloseBtn = document.getElementById('review-sheet-close-btn');
    const reviewBackdrop = document.getElementById('review-sheet-backdrop');

    if (reviewCloseBtn) {
        reviewCloseBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closeReviewSheet(); });
    }
    if (reviewBackdrop) {
        reviewBackdrop.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closeReviewSheet(); });
    }

    // 10. Sprint Planning Modal & Widget listeners
    const planFirstSprintBtn = document.getElementById('plan-first-sprint-btn');
    if (planFirstSprintBtn) {
        planFirstSprintBtn.addEventListener('click', openSprintPlanningModal);
    }
    const sprintModalCloseBtn = document.getElementById('sprint-modal-close-btn');
    if (sprintModalCloseBtn) {
        sprintModalCloseBtn.addEventListener('click', closeSprintPlanningModal);
    }
    const sprintCancelBtn = document.getElementById('sprint-cancel-btn');
    if (sprintCancelBtn) {
        sprintCancelBtn.addEventListener('click', closeSprintPlanningModal);
    }
    const sprintPlanningModal = document.getElementById('sprint-planning-modal');
    if (sprintPlanningModal) {
        sprintPlanningModal.addEventListener('click', (e) => {
            if (e.target === sprintPlanningModal) {
                closeSprintPlanningModal();
            }
        });
    }
    
    const startSprintLockBtn = document.getElementById('start-sprint-lock-btn');
    if (startSprintLockBtn) {
        startSprintLockBtn.addEventListener('click', () => {
            const planningSprint = sprints.find(s => s.status === 'planning');
            if (planningSprint) {
                startSprint();
            } else {
                openSprintPlanningModal();
            }
        });
    }
    const durationOptions = document.querySelectorAll('.sprint-duration-option');
    let selectedWeeks = 1;
    durationOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            durationOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedWeeks = parseInt(opt.dataset.weeks) || 1;
        });
    });
    const sprintPlanningForm = document.getElementById('sprint-planning-form');
    if (sprintPlanningForm) {
        sprintPlanningForm.addEventListener('submit', (e) => {
            e.preventDefault();
            createSprint(selectedWeeks);
        });
    }
    const sprintEndBtn = document.getElementById('sprint-end-btn');
    if (sprintEndBtn) {
        sprintEndBtn.addEventListener('click', () => {
            endSprint(false);
        });
    }

    // 10.1. Sprint Review sheet listeners
    const sprintReviewCloseBtn = document.getElementById('sprint-review-close-btn');
    if (sprintReviewCloseBtn) {
        sprintReviewCloseBtn.addEventListener('click', closeSprintReview);
    }
    const sprintReviewBackdrop = document.getElementById('sprint-review-backdrop');
    if (sprintReviewBackdrop) {
        sprintReviewBackdrop.addEventListener('click', closeSprintReview);
    }
    const sprintReviewFinishBtn = document.getElementById('sprint-review-finish-btn');
    if (sprintReviewFinishBtn) {
        sprintReviewFinishBtn.addEventListener('click', finishSprintReview);
    }

    setupCategoryManager();

    // 14. Sprint Header Widget Review Trigger
    const sprintHeaderWidget = document.getElementById('sprint-header-widget');
    if (sprintHeaderWidget) {
        sprintHeaderWidget.addEventListener('click', (e) => {
            // Prevent if clicking on end sprint button (if it was there, but it's not)
            const activeSprint = sprints.find(s => s.status === 'active');
            if (activeSprint) {
                const sprintTasks = tasks.filter(t => t.mode === 'scrum' && t.sprintId === activeSprint.id);
                const completedTasks = sprintTasks.filter(t => t.status === 'done');
                const incompleteTasks = sprintTasks.filter(t => t.status !== 'done');
                openSprintReview(activeSprint, completedTasks, incompleteTasks);
            }
        });
        sprintHeaderWidget.style.cursor = 'pointer';
    }

    // 15. Backlog Collapse/Expand Toggle
    const backlogHeader = document.querySelector('.backlog-header');
    const backlogColumn = document.getElementById('backlog-column');
    if (backlogHeader && backlogColumn) {
        backlogHeader.addEventListener('click', (e) => {
            // Only toggle if in collapsed mode state (which means sprint is active)
            if (document.body.classList.contains('sprint-active')) {
                // If they clicked an action button, ignore
                if (e.target.closest('.backlog-actions')) return;
                
                if (backlogColumn.classList.contains('collapsed-mode')) {
                    backlogColumn.classList.remove('collapsed-mode');
                    backlogColumn.classList.add('expanded-mode');
                } else if (backlogColumn.classList.contains('expanded-mode')) {
                    backlogColumn.classList.remove('expanded-mode');
                    backlogColumn.classList.add('collapsed-mode');
                }
            }
        });
    }

    // 16. Sprint Cart Banner (mobile)
    const sprintCartReviewBtn = document.getElementById('sprint-cart-review-btn');
    if (sprintCartReviewBtn) {
        sprintCartReviewBtn.addEventListener('click', openSprintCartSheet);
    }

    const sprintCartCloseBtn = document.getElementById('sprint-cart-close-btn');
    if (sprintCartCloseBtn) {
        sprintCartCloseBtn.addEventListener('click', closeSprintCartSheet);
    }

    // Cart duration buttons
    document.querySelectorAll('.cart-duration-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.cart-duration-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            cartSelectedWeeks = parseInt(btn.dataset.cartWeeks) || 1;
        });
    });

    // Cart Start Sprint button
    const sprintCartStartBtn = document.getElementById('sprint-cart-start-btn');
    if (sprintCartStartBtn) {
        sprintCartStartBtn.addEventListener('click', () => {
            closeSprintCartSheet();
            createSprint(cartSelectedWeeks);
            // createSprint transitions to planning state; then start immediately
            startSprint();
        });
    }

    // 17. Quick Add Backlog (mobile)
    const quickAddInput = document.getElementById('quick-add-backlog-input');
    const quickAddBtn = document.getElementById('quick-add-backlog-btn');

    if (quickAddInput) {
        quickAddInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addQuickBacklogTask();
            }
        });
    }
    if (quickAddBtn) {
        quickAddBtn.addEventListener('click', addQuickBacklogTask);
    }
}

// --- Day Review Bottom Sheet Engine ---
function openReviewSheet() {
    const reviewSheet = document.getElementById('review-bottom-sheet');
    const backdrop = document.getElementById('review-sheet-backdrop');
    const mobileReviewToggle = document.getElementById('mobile-review-toggle-btn');
    const dateEl = document.getElementById('review-sheet-date');

    if (!reviewSheet || !backdrop) return;

    // Set active class on the toggle button
    if (mobileReviewToggle) {
        mobileReviewToggle.classList.add('active');
    }

    // Update current date string in sheet header
    if (dateEl) {
        const options = { weekday: 'long', month: 'short', day: 'numeric' };
        dateEl.textContent = new Date().toLocaleDateString('en-US', options);
    }

    // Populate review lists dynamically
    buildReviewLists();

    // Open sheet and backdrop
    reviewSheet.classList.add('open');
    backdrop.classList.add('open');

    // Lock page scroll
    document.body.style.overflow = 'hidden';
}

function closeReviewSheet() {
    const reviewSheet = document.getElementById('review-bottom-sheet');
    const backdrop = document.getElementById('review-sheet-backdrop');
    const mobileReviewToggle = document.getElementById('mobile-review-toggle-btn');

    if (reviewSheet) {
        reviewSheet.classList.remove('open');
    }
    if (backdrop) {
        backdrop.classList.remove('open');
    }
    if (mobileReviewToggle) {
        mobileReviewToggle.classList.remove('active');
    }

    // Restore page scroll
    document.body.style.overflow = '';
}

function buildReviewLists() {
    const doingListEl = document.getElementById('review-in-progress-list');
    const dueListEl = document.getElementById('review-due-soon-list');
    const highListEl = document.getElementById('review-high-priority-list');

    const doingCountEl = document.getElementById('review-doing-count');
    const dueCountEl = document.getElementById('review-due-count');
    const highCountEl = document.getElementById('review-high-count');

    if (!doingListEl || !dueListEl || !highListEl) return;

    // Clear lists
    doingListEl.innerHTML = '';
    dueListEl.innerHTML = '';
    highListEl.innerHTML = '';

    // Calculate dates
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const threeDaysLater = new Date(today.getTime() + 86400000 * 3);
    const threeDaysStr = threeDaysLater.toISOString().split('T')[0];

    // Filter data by current mode
    const modeTasks = tasks.filter(t => t.mode === currentMode);

    const doingTasks = modeTasks.filter(t => t.status === 'doing');
    const dueTasks = modeTasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate >= todayStr && t.dueDate <= threeDaysStr);
    const highTasks = modeTasks.filter(t => t.status !== 'done' && t.priority === 'High');

    // Update count labels
    if (doingCountEl) doingCountEl.textContent = doingTasks.length;
    if (dueCountEl) dueCountEl.textContent = dueTasks.length;
    if (highCountEl) highCountEl.textContent = highTasks.length;

    // Helper to render items
    const renderReviewSection = (taskList, containerEl) => {
        if (taskList.length === 0) {
            containerEl.innerHTML = `<div class="review-empty-state">No active items in this category</div>`;
            return;
        }

        taskList.forEach(task => {
            const item = document.createElement('div');
            item.className = 'review-task-item';
            item.style.cursor = 'pointer';

            // Due date HTML
            let dueDateHTML = '';
            if (task.dueDate) {
                const dueObj = new Date(task.dueDate + 'T23:59:59');
                const formattedDate = dueObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                dueDateHTML = `
                    <div class="review-due-tag">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <span>${formattedDate}</span>
                    </div>
                `;
            }

            item.innerHTML = `
                <div class="review-task-item-info">
                    <h4 class="review-task-item-title">${escapeHTML(task.title)}</h4>
                    <div class="review-task-item-meta">
                        <span class="tag-badge" style="color: ${getCategoryColor(task.category)}; background-color: ${getCategoryColor(task.category)}20;">${task.category}</span>
                        <span class="priority-pill priority-${task.priority.toLowerCase()}">${task.priority}</span>
                        ${dueDateHTML}
                    </div>
                </div>
            `;

            // Open task editor on click
            item.addEventListener('click', () => {
                closeReviewSheet();
                openTaskDialog(task);
            });

            containerEl.appendChild(item);
        });
    };

    // Render lists
    renderReviewSection(doingTasks, doingListEl);
    renderReviewSection(dueTasks, dueListEl);
    renderReviewSection(highTasks, highListEl);
}

// --- Custom Category Manager Logic ---
function setupCategoryManager() {
    const modal = document.getElementById('category-manager-modal');
    const closeBtn = document.getElementById('cat-modal-close-btn');
    const sidebarBtn = document.getElementById('sidebar-manage-cat-btn');
    const formBtn = document.getElementById('form-manage-cat-btn');
    const listContainer = document.getElementById('category-manager-list');
    const addForm = document.getElementById('add-category-form');
    
    if(!modal) return;

    function openCatModal() {
        renderCatList();
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    
    function closeCatModal() {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }
    
    function renderCatList() {
        listContainer.innerHTML = categories.map(cat => `
            <div class="category-list-item">
                <div class="category-list-item-info">
                    <div class="category-color-dot" style="background-color: ${cat.color};"></div>
                    <span class="category-list-item-name">${cat.name}</span>
                </div>
                <button class="category-delete-btn" data-delete-cat="${cat.id}" title="Delete Category">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
                        <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            </div>
        `).join('');
        
        listContainer.querySelectorAll('.category-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.deleteCat;
                if (categories.length <= 1) {
                    showToastNotification("Cannot delete the last category.");
                    return;
                }
                const cat = categories.find(c => c.id === id);
                if (tasks.some(t => t.category === cat.name)) {
                    showToastNotification("Cannot delete category in use by tasks.");
                    return;
                }
                categories = categories.filter(c => c.id !== id);
                saveCategories();
                renderCatList();
                renderAppUI();
                populateCategoryDropdowns();
            });
        });
    }
    
    if (sidebarBtn) sidebarBtn.addEventListener('click', openCatModal);
    if (formBtn) formBtn.addEventListener('click', openCatModal);
    if (closeBtn) closeBtn.addEventListener('click', closeCatModal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeCatModal();
    });
    
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
            swatch.classList.add('selected');
        });
    });
    
    if (addForm) {
        addForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('new-cat-name');
            const name = nameInput.value.trim();
            if (!name) return;
            
            if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
                showToastNotification("Category already exists.");
                return;
            }
            
            const selectedSwatch = document.querySelector('.color-swatch.selected');
            const color = selectedSwatch ? selectedSwatch.dataset.color : '#3B82F6';
            
            categories.push({ id: 'cat_' + Date.now(), name, color });
            saveCategories();
            nameInput.value = '';
            renderCatList();
            renderAppUI();
            populateCategoryDropdowns();
            showToastNotification("Category created.");
        });
    }
}

// --- Initialization Entry Point ---
window.addEventListener('DOMContentLoaded', () => {
    // 1. Initialise Dynamic Dates & Greets
    updateDateDisplay();
    updateWelcomeGreeting();
    setInterval(updateWelcomeGreeting, 60000); // Check greeting every minute

    // 2. Load Local Data Storage & Theme variables
    loadAppData();

    // 3. Render initial workspace Board
    renderAppUI();

    // 4. Register listeners
    setupApplicationListeners();
    setupDragAndDropHandlers();
    setupMobileTabSwitcher();
    setupDataManagementListeners();
    setupPersonalizationListeners();

    // 5. Sprint Expiry Checks
    checkSprintExpiry();
    setInterval(checkSprintExpiry, 60000); // Check every minute

    // 6. Onboarding Tour (first visit)
    initOnboarding();
    setupReplayTourListener();
});

// --- Utilities ---
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// --- Data Management (Export/Import) ---
function setupDataManagementListeners() {
    const dataBtn = document.getElementById('data-management-btn');
    const dataModal = document.getElementById('data-sync-modal');
    const closeBtn = document.getElementById('data-sync-close-btn');
    const exportBtn = document.getElementById('export-data-btn');
    const importBtn = document.getElementById('import-data-btn');
    const fileInput = document.getElementById('import-file-input');

    if (dataBtn && dataModal) {
        dataBtn.addEventListener('click', () => {
            const dropdown = document.getElementById('profile-dropdown');
            if (dropdown) dropdown.classList.remove('active');
            dataModal.classList.add('open');
        });
    }

    if (closeBtn && dataModal) {
        closeBtn.addEventListener('click', () => {
            dataModal.classList.remove('open');
        });
    }

    if (dataModal) {
        dataModal.addEventListener('click', (e) => {
            if (e.target === dataModal) dataModal.classList.remove('open');
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }

    if (importBtn && fileInput) {
        importBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                const strategy = document.getElementById('import-strategy').value;
                importData(file, strategy);
                fileInput.value = ''; // Reset input so same file can be loaded again if needed
            }
        });
    }
}

// --- Personalization ---
function setupPersonalizationListeners() {
    const personalizeBtn = document.getElementById('personalize-btn');
    const personalizeModal = document.getElementById('personalize-modal');
    const closeBtn = document.getElementById('personalize-close-btn');
    const cancelBtn = document.getElementById('personalize-cancel-btn');
    const form = document.getElementById('personalize-form');
    
    if (personalizeBtn && personalizeModal) {
        personalizeBtn.addEventListener('click', () => {
            const dropdown = document.getElementById('profile-dropdown');
            if (dropdown) dropdown.classList.remove('active');
            
            // Populate form with current values
            document.getElementById('form-user-name').value = userName;
            document.getElementById('form-workspace-name').value = workspaceName;
            
            personalizeModal.classList.add('open');
        });
    }

    const closeModal = () => {
        if (personalizeModal) personalizeModal.classList.remove('open');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    if (personalizeModal) {
        personalizeModal.addEventListener('click', (e) => {
            if (e.target === personalizeModal) closeModal();
        });
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('form-user-name').value.trim();
            const workspaceInput = document.getElementById('form-workspace-name').value.trim();
            
            if (nameInput) userName = nameInput;
            if (workspaceInput) workspaceName = workspaceInput;
            
            savePersonalization();
            updateProfileUI();
            closeModal();
            showToastNotification("Personalization saved.");
        });
    }
}

function exportData() {
    const exportObj = {
        'airj-tasks': safeStorage.get('airj-tasks'),
        'airj-categories': safeStorage.get('airj-categories'),
        'airj-theme': safeStorage.get('airj-theme'),
        'airj-mode': safeStorage.get('airj-mode'),
        'airj-sprints': safeStorage.get('airj-sprints'),
        'airj-sprint-history': safeStorage.get('airj-sprint-history'),
        'airj-sprint-counter': safeStorage.get('airj-sprint-counter'),
        'exportDate': new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
    const dlAnchorElem = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `air-j-backup-${dateStr}.json`);
    dlAnchorElem.click();
    showToastNotification("Backup file exported successfully.");
}

function importData(file, strategy) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            if (!importedData['airj-tasks'] && !importedData['airj-categories']) {
                showToastNotification("Invalid backup file format.");
                return;
            }

            if (strategy === 'replace') {
                showConfirmDialog(
                    "Overwrite Data",
                    "This will overwrite all your current tasks and settings. Are you sure?",
                    "Overwrite",
                    true,
                    () => {
                        if (importedData['airj-tasks']) safeStorage.set('airj-tasks', importedData['airj-tasks']);
                        if (importedData['airj-categories']) safeStorage.set('airj-categories', importedData['airj-categories']);
                        if (importedData['airj-theme']) safeStorage.set('airj-theme', importedData['airj-theme']);
                        if (importedData['airj-mode']) safeStorage.set('airj-mode', importedData['airj-mode']);
                        if (importedData['airj-sprints']) safeStorage.set('airj-sprints', importedData['airj-sprints']);
                        if (importedData['airj-sprint-history']) safeStorage.set('airj-sprint-history', importedData['airj-sprint-history']);
                        if (importedData['airj-sprint-counter']) safeStorage.set('airj-sprint-counter', importedData['airj-sprint-counter']);
                        
                        loadAppData();
                        renderAppUI();
                        if (typeof populateCategoryDropdowns === 'function') populateCategoryDropdowns();
                        if (typeof renderCatList === 'function') renderCatList();
                        
                        document.getElementById('data-sync-modal').classList.remove('open');
                        showToastNotification("Data successfully replaced.");
                    }
                );
            } else if (strategy === 'merge') {
                const importedTasks = importedData['airj-tasks'] ? JSON.parse(importedData['airj-tasks']) : [];
                const importedCats = importedData['airj-categories'] ? JSON.parse(importedData['airj-categories']) : [];
                
                let tasksAdded = 0;
                importedTasks.forEach(impTask => {
                    if (!tasks.some(t => t.id === impTask.id)) {
                        tasks.push(impTask);
                        tasksAdded++;
                    }
                });
                
                let catsAdded = 0;
                importedCats.forEach(impCat => {
                    if (!categories.some(c => c.name === impCat.name)) {
                        categories.push({ id: 'cat_' + Date.now() + Math.floor(Math.random() * 1000), name: impCat.name, color: impCat.color });
                        catsAdded++;
                    }
                });

                if (tasksAdded > 0 || catsAdded > 0) {
                    saveTasks();
                    saveCategories();
                    renderAppUI();
                    if (typeof populateCategoryDropdowns === 'function') populateCategoryDropdowns();
                    if (typeof renderCatList === 'function') renderCatList();
                    showToastNotification(`Merged: ${tasksAdded} tasks, ${catsAdded} categories added.`);
                } else {
                    showToastNotification("No new data to merge.");
                }
                document.getElementById('data-sync-modal').classList.remove('open');
            }
        } catch (error) {
            console.error("Import failed:", error);
            showToastNotification("Failed to read backup file.");
        }
    };
    reader.readAsText(file);
}

/* ==========================================================================
   ONBOARDING TOUR SYSTEM
   ========================================================================== */

// --- Flow Tour Step Definitions ---
function getFlowTourSteps() {
    const isMobile = window.innerWidth < 768;
    const steps = [
        {
            id: 'welcome',
            target: null,
            placement: 'center',
            title: 'Welcome to air-J \u{1F44B}',
            body: 'Your personal task manager for tracking daily work. Let\'s take a quick tour of the key features — it only takes a minute.',
            centerCard: true
        },
        {
            id: 'mode-toggle',
            target: '#header-mode-toggle',
            placement: 'bottom',
            title: 'Flow & Cycles',
            body: 'Switch between <strong>Flow</strong> (Kanban) for daily tasks and <strong>Cycles</strong> (Sprints) for time-boxed work. You\'re in Flow mode right now.'
        },
        {
            id: 'categories',
            target: isMobile ? '#mobile-category-filters' : '#category-filter-list',
            placement: isMobile ? 'bottom' : 'right',
            title: 'Project Categories',
            body: 'Organise tasks by project. Filter your board to focus on what matters. You can create custom categories too.'
        },
        {
            id: 'columns',
            target: isMobile ? '#column-segmented-control' : '#column-todo',
            placement: 'bottom',
            title: 'Your Task Columns',
            body: 'Tasks flow through three stages: <strong>To Do</strong> \u2192 <strong>Doing</strong> \u2192 <strong>Done</strong>. Drag tasks between columns or use the quick-shift arrows to track progress.'
        }
    ];

    // Desktop-only column detail steps
    if (!isMobile) {
        steps.push({
            id: 'doing-col',
            target: '#column-doing',
            placement: 'bottom',
            title: 'Work In Progress',
            body: 'Tasks you\'re actively working on live here. The dashboard tracks your active count at a glance.'
        });
        steps.push({
            id: 'done-col',
            target: '#column-done',
            placement: 'bottom',
            title: 'Completed Work',
            body: 'Finished tasks land here. Your progress ring on the sidebar tracks your completion rate.'
        });
    }

    steps.push({
        id: 'create-prompt',
        target: isMobile ? '#global-add-task-fab' : '#header-add-task-btn',
        placement: isMobile ? 'top' : 'bottom',
        title: 'Create Your First Task \u2728',
        body: 'Let\'s add your first task! Click the button below to open the task form.',
        type: 'action',
        actionTarget: isMobile ? '#global-add-task-fab' : '#header-add-task-btn'
    });

    steps.push({
        id: 'fill-task',
        target: null,
        placement: 'bottom-right',
        title: 'Fill In Your Task',
        body: 'Give it a title, pick a category and priority, then hit <strong>Save Task</strong>. We\'ll wait right here!',
        type: 'interactive',
        waitFor: 'task-submit'
    });

    steps.push({
        id: 'complete',
        target: null,
        placement: 'center',
        title: 'You\'re All Set! \u{1F389}',
        body: 'Your first task is on the board! Drag it between columns as you work. Try switching to <strong>Cycles</strong> mode when you\'re ready for sprint-based workflows.',
        centerCard: true,
        isFinal: true
    });

    return steps;
}

// --- Cycles Tour Step Definitions ---
function getCyclesTourSteps() {
    return [
        {
            id: 'cycles-welcome',
            target: '#header-mode-toggle',
            placement: 'bottom',
            title: 'Welcome to Cycles \u{1F504}',
            body: 'Cycles mode lets you plan work into time-boxed <strong>sprints</strong>. Let\'s see how it works.'
        },
        {
            id: 'backlog',
            target: '#backlog-column',
            placement: 'right',
            title: 'Your Backlog',
            body: 'All unplanned tasks live here. Add tasks to your backlog, then commit them to a sprint.'
        },
        {
            id: 'sprint-planning',
            target: '#sprint-planning-placeholder',
            placement: 'bottom',
            title: 'Sprint Planning',
            body: 'Stage tasks from the backlog into a sprint, pick a duration (1\u20134 weeks), and start the clock.'
        },
        {
            id: 'sprint-board',
            target: '.kanban-board',
            placement: 'bottom',
            title: 'Sprint Board',
            body: 'During an active sprint, tasks flow through <strong>To Do</strong> \u2192 <strong>Doing</strong> \u2192 <strong>Done</strong> — scoped to your sprint commitment.'
        },
        {
            id: 'sprint-lifecycle',
            target: '#sprint-end-btn',
            placement: 'top',
            title: 'Sprint Lifecycle',
            body: 'When the sprint ends, you\'ll get a review summary. Completed tasks are celebrated, and unfinished items return to the backlog.',
            isFinal: true
        }
    ];
}

// --- Onboarding Initialization ---
function initOnboarding() {
    if (!isFirstVisit || onboardingComplete) return;
    // Delay to let CSS animations settle and initial render complete
    setTimeout(() => {
        startOnboardingTour(getFlowTourSteps(), 'flow');
    }, 900);
}

function initCyclesOnboarding() {
    if (cyclesOnboardingComplete || onboardingTourActive) return;
    startOnboardingTour(getCyclesTourSteps(), 'cycles');
}

function setupReplayTourListener() {
    const replayBtn = document.getElementById('replay-tour-btn');
    if (replayBtn) {
        replayBtn.addEventListener('click', () => {
            // Close profile dropdown
            const dropdown = document.getElementById('profile-dropdown');
            if (dropdown) dropdown.classList.remove('active');

            // Determine which tour to replay based on current mode
            if (currentMode === 'scrum') {
                startOnboardingTour(getCyclesTourSteps(), 'replay');
            } else {
                startOnboardingTour(getFlowTourSteps(), 'replay');
            }
        });
    }
}

// --- Core Tour Engine ---
function startOnboardingTour(steps, tourType) {
    if (onboardingTourActive) return;
    onboardingTourActive = true;

    let currentStep = 0;
    let overlayEl = null;
    let tooltipEl = null;
    let previousTarget = null;
    let taskSubmitWatcher = null;

    // Create overlay
    overlayEl = document.createElement('div');
    overlayEl.className = 'onboarding-overlay fade-enter';
    document.body.appendChild(overlayEl);

    // Create tooltip
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'onboarding-tooltip';
    tooltipEl.innerHTML = `
        <div class="onboarding-tooltip-arrow"></div>
        <div class="onboarding-step-counter"></div>
        <div class="onboarding-title"></div>
        <div class="onboarding-body"></div>
        <div class="onboarding-actions">
            <button class="onboarding-btn-skip" data-action="skip">Skip tour</button>
            <div class="onboarding-actions-right">
                <button class="onboarding-btn-back" data-action="back">Back</button>
                <button class="onboarding-btn-next" data-action="next">Next</button>
            </div>
        </div>
    `;
    document.body.appendChild(tooltipEl);

    // Trigger overlay fade-in
    requestAnimationFrame(() => {
        overlayEl.classList.remove('fade-enter');
        overlayEl.classList.add('fade-active');
    });

    // Event delegation for buttons
    tooltipEl.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (!action) return;

        if (action === 'next') {
            const step = steps[currentStep];
            if (step.type === 'action') {
                // Click the action target to open the modal, then advance
                const actionBtn = document.querySelector(step.actionTarget);
                if (actionBtn) actionBtn.click();
                // Short delay for modal to open
                setTimeout(() => advanceStep(1), 350);
            } else {
                advanceStep(1);
            }
        } else if (action === 'back') {
            advanceStep(-1);
        } else if (action === 'skip') {
            completeTour();
        }
    });

    // Prevent overlay click from closing (but allow target interaction)
    overlayEl.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    function advanceStep(direction) {
        const nextIndex = currentStep + direction;
        if (nextIndex >= steps.length) {
            completeTour();
            return;
        }
        if (nextIndex < 0) return;

        // Hide tooltip during transition
        tooltipEl.classList.remove('visible');

        setTimeout(() => {
            currentStep = nextIndex;
            showStep(currentStep);
        }, 200);
    }

    function showStep(index) {
        const step = steps[index];
        if (!step) return;

        // Clean up previous target highlight
        if (previousTarget) {
            previousTarget.classList.remove('onboarding-target-highlight');
            previousTarget = null;
        }

        // Remove interactive watcher if present
        if (taskSubmitWatcher) {
            document.removeEventListener('submit', taskSubmitWatcher, true);
            taskSubmitWatcher = null;
        }

        // Reset task modal z-index from any previous interactive step
        const taskModal = document.getElementById('task-modal');
        if (taskModal) taskModal.style.zIndex = '';

        // Update step counter with dots
        const counterEl = tooltipEl.querySelector('.onboarding-step-counter');
        let dotsHtml = '<div class="onboarding-step-dots">';
        for (let i = 0; i < steps.length; i++) {
            const cls = i < index ? 'completed' : (i === index ? 'active' : '');
            dotsHtml += `<span class="onboarding-step-dot ${cls}"></span>`;
        }
        dotsHtml += '</div>';
        counterEl.innerHTML = `Step ${index + 1} of ${steps.length} ${dotsHtml}`;

        // Update content
        tooltipEl.querySelector('.onboarding-title').textContent = step.title;
        tooltipEl.querySelector('.onboarding-body').innerHTML = step.body;

        // Reset arrow display (may have been hidden by center-card step)
        const arrowEl = tooltipEl.querySelector('.onboarding-tooltip-arrow');
        if (arrowEl) arrowEl.style.display = '';

        // Update buttons
        const backBtn = tooltipEl.querySelector('[data-action="back"]');
        const nextBtn = tooltipEl.querySelector('[data-action="next"]');
        const skipBtn = tooltipEl.querySelector('[data-action="skip"]');

        backBtn.style.display = index === 0 ? 'none' : '';
        skipBtn.style.display = step.isFinal ? 'none' : '';

        if (step.isFinal) {
            nextBtn.textContent = 'Finish';
            nextBtn.dataset.action = 'skip'; // Finish = complete tour
            nextBtn.style.display = '';
        } else if (step.type === 'action') {
            nextBtn.textContent = 'Open Task Form';
            nextBtn.dataset.action = 'next';
            nextBtn.style.display = '';
        } else if (step.type === 'interactive') {
            nextBtn.style.display = 'none'; // Hidden during interactive step
            nextBtn.dataset.action = 'next';
            // Promote task modal above overlay so user can interact with it
            if (taskModal) taskModal.style.zIndex = '9999';
            setupInteractiveStep(step);
        } else {
            nextBtn.textContent = 'Next';
            nextBtn.dataset.action = 'next';
            nextBtn.style.display = '';
        }

        // Center card vs positioned
        tooltipEl.classList.toggle('center-card', !!step.centerCard);

        // Find and highlight target
        const targetEl = step.target ? document.querySelector(step.target) : null;

        if (targetEl) {
            // Scroll target into view
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            // Apply highlight
            targetEl.classList.add('onboarding-target-highlight');
            previousTarget = targetEl;

            // Position spotlight overlay clip-path
            setTimeout(() => {
                updateSpotlight(targetEl);
                positionTooltip(targetEl, tooltipEl, step.placement);
                tooltipEl.classList.add('visible');
            }, 150);
        } else {
            // Center placement (no target)
            clearSpotlight();
            positionNoTarget(tooltipEl, step.placement);
            tooltipEl.classList.add('visible');
        }
    }

    function setupInteractiveStep(step) {
        if (step.waitFor === 'task-submit') {
            // Pre-fill the task form with suggested content
            setTimeout(() => {
                const titleInput = document.getElementById('form-task-title');
                if (titleInput && !titleInput.value) {
                    titleInput.value = 'Take the rubbish out';
                    titleInput.focus();
                }
            }, 400);

            // Watch for task form submission to advance
            taskSubmitWatcher = function(e) {
                const form = document.getElementById('task-creation-form');
                if (e.target === form) {
                    document.removeEventListener('submit', taskSubmitWatcher, true);
                    taskSubmitWatcher = null;

                    // Wait for render, then advance to final step
                    setTimeout(() => {
                        advanceStep(1);
                    }, 500);
                }
            };
            document.addEventListener('submit', taskSubmitWatcher, true);
        }
    }

    function updateSpotlight(targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const padding = 8;
        const x = rect.left - padding;
        const y = rect.top - padding;
        const w = rect.width + padding * 2;
        const h = rect.height + padding * 2;
        const r = 10; // border radius for cutout

        // Create an SVG-style clip-path with rounded rect cutout using polygon evenodd
        // We use an inset-based approach with a CSS mask instead for simplicity
        overlayEl.style.clipPath = `polygon(
            evenodd,
            0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
            ${x}px ${y + r}px,
            ${x + r}px ${y}px,
            ${x + w - r}px ${y}px,
            ${x + w}px ${y + r}px,
            ${x + w}px ${y + h - r}px,
            ${x + w - r}px ${y + h}px,
            ${x + r}px ${y + h}px,
            ${x}px ${y + h - r}px,
            ${x}px ${y + r}px
        )`;
    }

    function clearSpotlight() {
        overlayEl.style.clipPath = '';
    }

    function positionTooltip(targetEl, tooltip, placement) {
        const rect = targetEl.getBoundingClientRect();
        const gap = 16;
        const isMobile = window.innerWidth < 768;

        // Remove old placement classes
        tooltip.classList.remove('placement-top', 'placement-bottom', 'placement-left', 'placement-right');

        // On mobile, force top or bottom only
        if (isMobile) {
            placement = (rect.top > window.innerHeight / 2) ? 'top' : 'bottom';
        }

        let top, left;
        const tooltipRect = tooltip.getBoundingClientRect();

        switch (placement) {
            case 'bottom':
                top = rect.bottom + gap;
                left = rect.left + rect.width / 2 - tooltipRect.width / 2;
                tooltip.classList.add('placement-bottom');
                tooltip.setAttribute('data-arrow', 'top');
                break;
            case 'top':
                top = rect.top - tooltipRect.height - gap;
                left = rect.left + rect.width / 2 - tooltipRect.width / 2;
                tooltip.classList.add('placement-top');
                tooltip.setAttribute('data-arrow', 'bottom');
                break;
            case 'left':
                top = rect.top + rect.height / 2 - tooltipRect.height / 2;
                left = rect.left - tooltipRect.width - gap;
                tooltip.classList.add('placement-left');
                tooltip.setAttribute('data-arrow', 'right');
                break;
            case 'right':
                top = rect.top + rect.height / 2 - tooltipRect.height / 2;
                left = rect.right + gap;
                tooltip.classList.add('placement-right');
                tooltip.setAttribute('data-arrow', 'left');
                break;
            default:
                positionNoTarget(tooltip, placement);
                return;
        }

        // Clamp to viewport
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (!isMobile) {
            left = Math.max(12, Math.min(left, vw - tooltipRect.width - 12));
        }
        top = Math.max(12, Math.min(top, vh - tooltipRect.height - 12));

        tooltip.style.top = `${top}px`;
        if (!isMobile) {
            tooltip.style.left = `${left}px`;
        }

        // Update arrow position to point at target center
        const arrowEl = tooltip.querySelector('.onboarding-tooltip-arrow');
        if (arrowEl) {
            // Reset any previous inline styles
            arrowEl.style.left = '';
            arrowEl.style.top = '';
            arrowEl.style.marginLeft = '';
            arrowEl.style.marginTop = '';

            if (placement === 'top' || placement === 'bottom') {
                const targetCenter = rect.left + rect.width / 2;
                const tooltipLeft = isMobile ? 16 : left;
                const arrowOffset = Math.max(20, Math.min(targetCenter - tooltipLeft, (isMobile ? vw - 32 : tooltipRect.width) - 20));
                arrowEl.style.left = `${arrowOffset}px`;
                arrowEl.style.marginLeft = '0';
            } else if (placement === 'left' || placement === 'right') {
                const targetCenter = rect.top + rect.height / 2;
                const tooltipTop = top;
                const arrowOffset = Math.max(20, Math.min(targetCenter - tooltipTop, tooltipRect.height - 20));
                arrowEl.style.top = `${arrowOffset}px`;
                arrowEl.style.marginTop = '0';
            }
        }
    }

    function positionNoTarget(tooltip, placement) {
        tooltip.classList.remove('placement-top', 'placement-bottom', 'placement-left', 'placement-right');
        tooltip.removeAttribute('data-arrow');
        tooltip.querySelector('.onboarding-tooltip-arrow').style.display = 'none';

        const tooltipRect = tooltip.getBoundingClientRect();
        const isMobile = window.innerWidth < 768;
        
        if (placement === 'bottom-right') {
            tooltip.style.top = `${window.innerHeight - tooltipRect.height - 24}px`;
            if (isMobile) {
                tooltip.style.left = '16px';
            } else {
                tooltip.style.left = `${window.innerWidth - tooltipRect.width - 24}px`;
            }
        } else {
            // center
            tooltip.style.top = `${(window.innerHeight - tooltipRect.height) / 2}px`;
            if (!isMobile) {
                tooltip.style.left = `${(window.innerWidth - tooltipRect.width) / 2}px`;
            }
        }
    }

    function completeTour() {
        onboardingTourActive = false;

        // Clean up highlight
        if (previousTarget) {
            previousTarget.classList.remove('onboarding-target-highlight');
        }

        // Remove interactive watcher
        if (taskSubmitWatcher) {
            document.removeEventListener('submit', taskSubmitWatcher, true);
        }

        // Reset task modal z-index in case tour was skipped during interactive step
        const taskModal = document.getElementById('task-modal');
        if (taskModal) taskModal.style.zIndex = '';

        // Fade out and remove
        if (tooltipEl) {
            tooltipEl.classList.remove('visible');
        }
        if (overlayEl) {
            overlayEl.classList.remove('fade-active');
            overlayEl.classList.add('fade-enter');
        }

        setTimeout(() => {
            if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
            if (tooltipEl && tooltipEl.parentNode) tooltipEl.parentNode.removeChild(tooltipEl);
            overlayEl = null;
            tooltipEl = null;
        }, 400);

        // Persist completion (skip for replays)
        if (tourType === 'flow') {
            onboardingComplete = true;
            safeStorage.set('airj-onboarding-complete', 'flow');
        } else if (tourType === 'cycles') {
            cyclesOnboardingComplete = true;
            safeStorage.set('airj-onboarding-complete', 'all');
        }
        // 'replay' type doesn't change flags
    }

    // Start the tour
    showStep(0);

    // Update spotlight on resize/scroll
    const resizeHandler = () => {
        if (previousTarget && overlayEl) {
            updateSpotlight(previousTarget);
            positionTooltip(previousTarget, tooltipEl, steps[currentStep].placement);
        }
    };
    window.addEventListener('resize', resizeHandler);
    window.addEventListener('scroll', resizeHandler, true);

    // Store cleanup ref for teardown
    const originalCompleteTour = completeTour;
    completeTour = function() {
        window.removeEventListener('resize', resizeHandler);
        window.removeEventListener('scroll', resizeHandler, true);
        originalCompleteTour();
    };
}
