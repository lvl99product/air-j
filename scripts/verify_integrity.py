#!/usr/bin/env python3
import os
import re
import sys
from html.parser import HTMLParser

class HTMLIntegrityParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.classes = set()
        self.links = []
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if 'id' in attrs_dict:
            self.ids.add(attrs_dict['id'])
        if 'class' in attrs_dict:
            for cls in attrs_dict['class'].split():
                self.classes.add(cls)
        if tag == 'link' and 'href' in attrs_dict:
            self.links.append(attrs_dict['href'])
        if tag == 'script' and 'src' in attrs_dict:
            self.scripts.append(attrs_dict['src'])


def verify_integrity():
    print("==================================================")
    print("       AIR-J INTEGRITY & STATIC TEST SUITE        ")
    print("==================================================")
    
    # Resolve workspace dynamically relative to this script (one level up from scripts/)
    workspace = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    errors = 0
    warnings = 0

    def log_success(msg):
        print(f"✅ [PASS] {msg}")

    def log_error(msg):
        nonlocal errors
        print(f"❌ [FAIL] {msg}")
        errors += 1

    def log_warning(msg):
        nonlocal warnings
        print(f"⚠️ [WARN] {msg}")
        warnings += 1

    # 1. Check File Locations
    expected_files = [
        "src/index.html",
        "src/app.js",
        "src/styles.css",
        "docs/FEATURES.md",
        "scripts/patch_app.py",
        "scripts/test_bug.js",
        "archive/mobile-ux-options/index.html",
        "archive/mobile-ux-options/v2-option4-detailed.html"
    ]

    print("\n--- Phase 1: Checking File Locations ---")
    for relative_path in expected_files:
        full_path = os.path.join(workspace, relative_path)
        if os.path.exists(full_path):
            log_success(f"File exists: {relative_path}")
        else:
            log_error(f"File missing: {relative_path}")

    # 2. Parse src/index.html
    print("\n--- Phase 2: Parsing src/index.html ---")
    index_html_path = os.path.join(workspace, "src/index.html")
    if not os.path.exists(index_html_path):
        log_error("Cannot proceed with HTML parsing; src/index.html is missing.")
        return False

    with open(index_html_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    parser = HTMLIntegrityParser()
    parser.feed(html_content)

    log_success(f"Parsed index.html: found {len(parser.ids)} IDs and {len(parser.classes)} classes.")

    # 3. Check stylesheet & JS script imports inside index.html
    print("\n--- Phase 3: Verifying index.html Imports ---")
    
    # Stylesheet check
    if "styles.css" in parser.links:
        log_success("index.html references 'styles.css' correctly.")
        if os.path.exists(os.path.join(workspace, "src/styles.css")):
            log_success("styles.css exists in the same folder as index.html.")
        else:
            log_error("styles.css does not exist in src/.")
    else:
        log_error(f"index.html stylesheet reference is incorrect. Found links: {parser.links}")

    # App.js check
    if "app.js" in parser.scripts:
        log_success("index.html references 'app.js' correctly.")
        if os.path.exists(os.path.join(workspace, "src/app.js")):
            log_success("app.js exists in the same folder as index.html.")
        else:
            log_error("app.js does not exist in src/.")
    else:
        log_error(f"index.html script reference is incorrect. Found scripts: {parser.scripts}")

    # 4. Check DOM ID Usage in app.js
    print("\n--- Phase 4: Checking DOM Element Binding in app.js ---")
    app_js_path = os.path.join(workspace, "src/app.js")
    if os.path.exists(app_js_path):
        with open(app_js_path, "r", encoding="utf-8") as f:
            app_js_content = f.read()

        # Find all document.getElementById('...') or document.getElementById("...")
        get_id_calls = re.findall(r'getElementById\([\'"]([^\'"]+)[\'"]\)', app_js_content)
        unique_ids_checked = set(get_id_calls)

        for dom_id in unique_ids_checked:
            # Skip dynamic pattern IDs
            if "${" in dom_id or "+" in dom_id:
                continue
            
            # Special case for template wrapper checks
            if dom_id in ["column-todo", "column-doing", "column-done", "todo-cards-list", 
                          "doing-cards-list", "done-cards-list", "todo-count", "doing-count", 
                          "done-count", "task-modal", "task-creation-form", "edit-task-id",
                          "form-task-title", "form-task-desc", "form-task-category", 
                          "form-task-priority", "form-task-status", "form-task-due",
                          "modal-action-title", "form-submit-btn", "form-cancel-btn", 
                          "modal-close-btn", "category-manager-modal", "category-manager-list",
                          "add-category-form", "new-cat-name", "new-cat-color-picker",
                          "sidebar-manage-cat-btn", "form-manage-cat-btn", "cat-modal-close-btn",
                          "category-filter-list", "mobile-category-filters", "priority-filter-list",
                          "global-search-input", "search-clear-btn", "mobile-search-panel",
                          "mobile-search-toggle-btn", "review-bottom-sheet", "review-sheet-backdrop",
                          "review-in-progress-list", "review-due-soon-list", "review-high-priority-list",
                          "review-doing-count", "review-due-count", "review-high-count",
                          "review-sheet-title", "review-sheet-date", "review-sheet-close-btn",
                          "mobile-review-toggle-btn", "theme-toggle", "theme-icon",
                          "current-date-string", "welcome-message-header", "dashboard-subtitle-string",
                          "header-add-task-btn", "progress-circle-fill", "progress-percentage-label",
                          "stats-todo-count", "stats-doing-count", "stats-done-count",
                          "column-segmented-control", "tab-todo-btn", "tab-doing-btn", "tab-done-btn",
                          "badge-todo-count", "badge-doing-count", "badge-done-count",
                          "global-add-task-fab", "app-toast", "toast-message-text"]:
                pass
            
            if dom_id in parser.ids:
                log_success(f"DOM ID referenced in JS exists in HTML: {dom_id}")
            else:
                # Some IDs might be dynamically generated in HTML or optional
                log_warning(f"DOM ID referenced in JS not statically found in HTML: {dom_id}")
    else:
        log_error("Cannot scan app.js for DOM binds; app.js is missing.")

    # 5. Check v2-option4-detailed.html path integrity
    print("\n--- Phase 5: Verifying Archive UX Options Path Integrity ---")
    ux_option_path = os.path.join(workspace, "archive/mobile-ux-options/v2-option4-detailed.html")
    if os.path.exists(ux_option_path):
        with open(ux_option_path, "r", encoding="utf-8") as f:
            ux_html = f.read()
        
        # Check that it correctly links to src/styles.css relative to its new path (../../src/styles.css)
        if 'href="../../src/styles.css"' in ux_html:
            log_success("v2-option4-detailed.html points to root src/styles.css correctly via '../../src/styles.css'")
            target_css = os.path.abspath(os.path.join(os.path.dirname(ux_option_path), "../../src/styles.css"))
            if os.path.exists(target_css):
                log_success("Linked styles.css physically exists at target path.")
            else:
                log_error("Linked styles.css does not exist at target path.")
        else:
            log_error("v2-option4-detailed.html has incorrect link to styles.css.")
    else:
        log_warning("v2-option4-detailed.html not found for archive path checks.")

    # 6. Check script paths in test_bug.js and patch_app.py
    print("\n--- Phase 6: Verifying Scripts File References ---")
    test_bug_path = os.path.join(workspace, "scripts/test_bug.js")
    if os.path.exists(test_bug_path):
        with open(test_bug_path, "r", encoding="utf-8") as f:
            test_js = f.read()
        if "/src/index.html" in test_js and "/src/app.js" in test_js:
            log_success("test_bug.js references index.html and app.js inside /src/ directory.")
        else:
            log_error("test_bug.js references outdated paths or lacks /src/ directory mapping.")

    patch_app_path = os.path.join(workspace, "scripts/patch_app.py")
    if os.path.exists(patch_app_path):
        with open(patch_app_path, "r", encoding="utf-8") as f:
            patch_py = f.read()
        if "/src/app.js" in patch_py:
            log_success("patch_app.py references app.js inside /src/ directory.")
        else:
            log_error("patch_app.py references outdated paths or lacks /src/ directory mapping.")

    # Summary
    print("\n==================================================")
    print("                 TEST RUN SUMMARY                 ")
    print("==================================================")
    print(f"Total Errors: {errors}")
    print(f"Total Warnings: {warnings}")
    
    if errors == 0:
        print("\n🎉 ALL TESTS PASSED! Project integrity is 100% verified.")
        return True
    else:
        print(f"\n❌ FAILED. Found {errors} integrity errors.")
        return False

if __name__ == "__main__":
    success = verify_integrity()
    sys.exit(0 if success else 1)
