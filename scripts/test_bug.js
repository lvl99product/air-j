const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('../src/index.html', 'utf8');
const js = fs.readFileSync('../src/app.js', 'utf8');

const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "http://localhost"
});

dom.window.localStorage.clear();

// Mock Toast Notification if missing
dom.window.showToastNotification = function(msg) { console.log('TOAST:', msg); };

try {
    const scriptEl = dom.window.document.createElement("script");
    scriptEl.textContent = js;
    dom.window.document.body.appendChild(scriptEl);

    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    console.log("App initialized.");

    // Simulate clicking Add Task
    dom.window.document.getElementById('global-add-task-fab').click();
    console.log("Task modal opened.");

    // Fill form
    dom.window.document.getElementById('form-task-title').value = "My Test Task";
    
    // Simulate Submit
    dom.window.document.getElementById('task-creation-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
    console.log("Task submitted.");

    const tasks = JSON.parse(dom.window.localStorage.getItem('airj-tasks') || '[]');
    console.log("Tasks after submit:", tasks.length);

} catch(e) {
    console.error("ERROR:", e);
}
