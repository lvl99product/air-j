import re

with open('../src/app.js', 'r') as f:
    content = f.read()

# 1. Add categories to state and DEFAULT_CATEGORIES
content = re.sub(
    r'let tasks = \[\];\nlet currentCategoryFilter = \'all\';',
    "let tasks = [];\nlet categories = [];\nlet currentCategoryFilter = 'all';",
    content
)

content = re.sub(
    r'// Default Mock Tasks \(Premium starter kit\)',
    "// Default Mock Categories\nconst DEFAULT_CATEGORIES = [\n    { id: 'work', name: 'Work', color: '#3B82F6' },\n    { id: 'wellness', name: 'Wellness', color: '#10B981' },\n    { id: 'personal', name: 'Personal', color: '#8B5CF6' }\n];\n\n// Default Mock Tasks (Premium starter kit)",
    content
)

# 2. Update loadAppData and saveTasks
load_app_data_replacement = """    // 2. Load Tasks
    const savedTasks = localStorage.getItem('airj-tasks');
    if (savedTasks) {
        try {
            tasks = JSON.parse(savedTasks);
        } catch (e) {
            console.error("Error parsing tasks, resetting to default", e);
            tasks = [...DEFAULT_TASKS];
            saveTasks();
        }
    } else {
        tasks = [...DEFAULT_TASKS];
        saveTasks();
    }

    // 3. Load Categories
    const savedCategories = localStorage.getItem('airj-categories');
    if (savedCategories) {
        try {
            categories = JSON.parse(savedCategories);
        } catch (e) {
            console.error("Error parsing categories", e);
            categories = [...DEFAULT_CATEGORIES];
            saveCategories();
        }
    } else {
        categories = [...DEFAULT_CATEGORIES];
        saveCategories();
    }"""
content = re.sub(
    r'    // 2\. Load Tasks\n.*?    \}\n',
    load_app_data_replacement + "\n",
    content,
    flags=re.DOTALL
)

save_tasks_replacement = """function saveTasks() {
    localStorage.setItem('airj-tasks', JSON.stringify(tasks));
}

function saveCategories() {
    localStorage.setItem('airj-categories', JSON.stringify(categories));
}

function getCategoryColor(catName) {
    const cat = categories.find(c => c.name === catName);
    return cat ? cat.color : '#6B7280';
}"""
content = content.replace("function saveTasks() {\n    localStorage.setItem('airj-tasks', JSON.stringify(tasks));\n}", save_tasks_replacement)

# 3. Update task badge creation
content = re.sub(
    r'<span class="tag-badge tag-\$\{task\.category\.toLowerCase\(\)\}">\$\{task\.category\}</span>',
    r'<span class="tag-badge" style="color: ${getCategoryColor(task.category)}; background-color: ${getCategoryColor(task.category)}20;">${task.category}</span>',
    content
)

# 4. Replace updateSidebarCategoryBadges
update_sidebar_replacement = """function updateSidebarCategoryBadges() {
    let totals = { all: tasks.length };
    categories.forEach(c => totals[c.name] = 0);
    
    tasks.forEach(t => {
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
            sidebarHTML += `
                <button class="filter-item ${currentCategoryFilter === cat.name ? 'active' : ''}" data-category-filter="${cat.name}">
                    <span class="filter-label"><span class="sidebar-dot" style="background-color: ${cat.color};"></span>${cat.name}</span>
                    <span class="filter-count">${totals[cat.name] || 0}</span>
                </button>
            `;
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
            mobileHTML += `
                <div class="mobile-filter-pill ${currentCategoryFilter === cat.name ? 'active' : ''}" data-category-filter="${cat.name}">${cat.name} (${totals[cat.name] || 0})</div>
            `;
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
"""

content = re.sub(
    r'function updateSidebarCategoryBadges\(\) \{.*?\}\n',
    update_sidebar_replacement + "\n",
    content,
    flags=re.DOTALL
)

# 5. Populate dropdowns on task dialog open
content = re.sub(
    r'function openTaskDialog\(task = null\) \{',
    "function openTaskDialog(task = null) {\n    populateCategoryDropdowns();",
    content
)

# 6. Bug Fix: Update closeReviewSheet bindings
close_bindings_replacement = """    if (reviewCloseBtn) {
        reviewCloseBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closeReviewSheet(); });
    }
    if (reviewBackdrop) {
        reviewBackdrop.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closeReviewSheet(); });
    }"""
content = re.sub(
    r'    if \(reviewCloseBtn\) \{\n        reviewCloseBtn\.addEventListener\(\'click\', closeReviewSheet\);\n    \}\n    if \(reviewBackdrop\) \{\n        reviewBackdrop\.addEventListener\(\'click\', closeReviewSheet\);\n    \}',
    close_bindings_replacement,
    content
)

# 7. Add setupCategoryManager() call to DOMContentLoaded or setupApplicationListeners
content = content.replace(
    "function setupApplicationListeners() {",
    "function setupApplicationListeners() {\n    setupCategoryManager();"
)

# 8. Remove the old static category filters listener block (Block 4)
content = re.sub(
    r'    // 4\. Sidebar Project Category Filter selectors \(Desktop\)\n    document\.querySelectorAll\(\'\[data-category-filter\]\'\)\.forEach\(item => \{\n        item\.addEventListener\(\'click\', \(\) => \{\n            document\.querySelectorAll\(\'\[data-category-filter\]\'\)\.forEach\(b => b\.classList\.remove\(\'active\'\)\);\n            item\.classList\.add\(\'active\'\);\n            currentCategoryFilter = item\.dataset\.categoryFilter;\n            renderAppUI\(\);\n        \}\);\n    \}\);\n',
    '',
    content
)

with open('../src/app.js', 'w') as f:
    f.write(content)

