/**
 * script.js
 * Handles logic for the Time Entry Tool with dashboard and editing.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- Constants ---
    const STORAGE_KEY = 'timeEntriesApp';
    const MAX_RECENT_ENTRIES = 5;
    const TIME_TOLERANCE = 0.01;
    const MIN_TASK_TIME = 0.1;
    const RECALC_FLASH_DURATION = 1500; // ms for green flash

    // --- State Variables ---
    let currentEditId = null;

    // --- Element References ---
    // (Keep all element references from the previous version)
    const dashboard = document.getElementById('dashboard');
    const createNewEntryBtn = document.getElementById('createNewEntryBtn');
    const recentEntriesList = document.getElementById('recentEntriesList');
    const entryModal = document.getElementById('entryModal');
    const modalTitle = document.getElementById('modalTitle');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const saveEntryBtn = document.getElementById('saveEntryBtn');
    const cancelEntryBtn = document.getElementById('cancelEntryBtn');
    const form = document.getElementById('timeEntryForm');
    const entryIdInput = document.getElementById('entryId');
    const matterNameInput = document.getElementById('matterName');
    const totalTimeInput = document.getElementById('totalTime');
    const mainNarrativeInput = document.getElementById('mainNarrative');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const tasksContainer = document.getElementById('tasksContainer');
    const taskTemplate = document.getElementById('taskTemplate');
    const feedbackArea = document.getElementById('feedbackArea');
    const timeMatchWarning = document.getElementById('timeMatchWarning');

    // --- Initialization ---
    function initApp() {
        setupEventListeners();
        renderDashboard();
        console.log("App Initialized");
    }

    // --- Local Storage Functions ---
    // (Keep loadEntries, saveEntries, addOrUpdateEntry, getEntryById - identical to previous version)
    function loadEntries() {
        try {
            const entriesJson = localStorage.getItem(STORAGE_KEY);
            if (!entriesJson) return [];
            const entries = JSON.parse(entriesJson);
            return Array.isArray(entries) ? entries : [];
        } catch (e) { console.error("Error loading entries:", e); return []; }
    }
    function saveEntries(entries) {
        try {
            if (!Array.isArray(entries)) { console.error("Attempted to save non-array:", entries); return; }
            const entriesJson = JSON.stringify(entries);
            localStorage.setItem(STORAGE_KEY, entriesJson);
        } catch (e) { console.error("Error saving entries:", e); }
    }
    function addOrUpdateEntry(entryData) {
        const entries = loadEntries(); const now = new Date().toISOString();
        if (entryData.id) {
            const index = entries.findIndex(e => String(e.id) === String(entryData.id)); // Use string comparison
            if (index !== -1) {
                entries[index] = { ...entries[index], ...entryData, updatedAt: now };
            } else {
                entryData.id = Date.now(); entryData.createdAt = now; entries.unshift(entryData);
            }
        } else {
            entryData.id = Date.now(); entryData.createdAt = now; entries.unshift(entryData);
        }
        saveEntries(entries.slice(0, MAX_RECENT_ENTRIES));
    }
    function getEntryById(id) {
        const entries = loadEntries();
        return entries.find(e => String(e.id) === String(id));
    }


    // --- Dashboard Rendering ---
    // (Keep renderDashboard - identical to previous version)
    function renderDashboard() {
        const entries = loadEntries(); recentEntriesList.innerHTML = '';
        if (entries.length === 0) { recentEntriesList.innerHTML = '<li>No recent entries found.</li>'; return; }
        entries.forEach(entry => {
            const li = document.createElement('li');
            const createdAtDate = entry.createdAt ? new Date(entry.createdAt) : null;
            const formattedDate = createdAtDate ? `${createdAtDate.toLocaleDateString()} ${createdAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'N/A';
            let displayNarrative = entry.finalNarrative || 'N/A';
            if (displayNarrative.length > 100) { displayNarrative = displayNarrative.substring(0, 97) + '...'; }
            li.innerHTML = `
                <div class="entry-details">
                    <strong>Matter:</strong> ${entry.matterName || 'N/A'} &nbsp;|&nbsp;
                    <strong>Time:</strong> ${entry.totalTime || 'N/A'}h <br>
                    <strong>Narrative:</strong> ${displayNarrative}
                    <div class="entry-meta">Created: ${formattedDate}</div>
                </div>
                <div class="entry-actions">
                    <button class="edit-entry-btn button-secondary" data-id="${entry.id}">Edit</button>
                </div>
            `;
            recentEntriesList.appendChild(li);
        });
        recentEntriesList.querySelectorAll('.edit-entry-btn').forEach(button => {
            button.addEventListener('click', handleEditButtonClick);
        });
    }


    // --- Modal Handling ---
    // (Keep openModal, closeModal, resetForm, populateForm - identical to previous version)
     function openModal(mode = 'create', entryId = null) {
        resetForm();
        if (mode === 'edit' && entryId) {
            const entryData = getEntryById(entryId);
            if (entryData) {
                currentEditId = entryData.id; modalTitle.textContent = "Edit Time Entry"; populateForm(entryData);
            } else {
                console.error("Entry not found:", entryId); showFeedback("Could not find entry.", "error", true); return;
            }
        } else {
            currentEditId = null; modalTitle.textContent = "Create New Time Entry";
        }
        entryModal.style.display = 'flex';
        requestAnimationFrame(() => matterNameInput.focus());
    }
    function closeModal() { entryModal.style.display = 'none'; resetForm(); currentEditId = null; }
    function resetForm() {
        form.reset(); tasksContainer.innerHTML = ''; entryIdInput.value = '';
        mainNarrativeInput.required = true; timeMatchWarning.textContent = ''; clearFeedback();
        tasksContainer.querySelectorAll('.task-item').forEach(task => task.style.outline = "none");
        updateLiveNarrative(); // Clear live narrative on reset
    }
     function populateForm(entryData) {
        entryIdInput.value = entryData.id || ''; matterNameInput.value = entryData.matterName || '';
        totalTimeInput.value = entryData.totalTime || ''; mainNarrativeInput.value = entryData.finalNarrative || '';
        tasksContainer.innerHTML = ''; const narrative = entryData.finalNarrative || '';
        const taskRegex = /(.+?)\s*\((\d+\.?\d*)\)/g; let match; let parsedTasks = [];
        let looksLikeTasks = narrative.includes(';') && narrative.includes('(') && narrative.includes(')');
        if (looksLikeTasks) {
            while ((match = taskRegex.exec(narrative)) !== null) {
                if (match[1] && match[2]) { parsedTasks.push({ narrative: match[1].trim(), time: match[2] }); }
            }
            const reconstructedLength = parsedTasks.reduce((len, t) => len + t.narrative.length + t.time.length + 4, 0);
            if (parsedTasks.length > 0 && Math.abs(reconstructedLength - narrative.length) > narrative.length * 0.2) {
                 console.warn("Task parsing mismatch."); parsedTasks = [];
            }
        }
        if (parsedTasks.length > 0) {
            mainNarrativeInput.value = ''; mainNarrativeInput.required = false;
            parsedTasks.forEach(taskData => {
                const newTaskItem = addTask();
                if (newTaskItem) {
                    const narrativeInput = newTaskItem.querySelector('.taskNarrative');
                    const timeInput = newTaskItem.querySelector('.taskTime');
                    if (narrativeInput) narrativeInput.value = taskData.narrative;
                    if (timeInput) {
                        timeInput.value = parseFloat(taskData.time).toFixed(1);
                        newTaskItem.dataset.manualSet = 'true'; timeInput.dataset.previousValue = timeInput.value;
                    }
                }
            });
            checkTaskTimeSum(); updateLiveNarrative(); // Update live narrative after populating
        } else { mainNarrativeInput.required = true; updateLiveNarrative(); } // Also update if no tasks parsed
    }


    // --- Form/Task Calculation Logic ---

    /**
     * Adds a new task item. (Identical to previous version)
     */
    function addTask() {
        if (!taskTemplate || !tasksContainer) { console.error("Task template/container not found!"); return null; }
        try {
            const taskClone = taskTemplate.content.cloneNode(true);
            const taskItem = taskClone.querySelector('.task-item');
            const timeInput = taskItem?.querySelector('.taskTime');
            if (!taskItem) { console.error("Cloned template missing '.task-item'"); return null; }
            taskItem.dataset.manualSet = 'false';
            if (timeInput) { timeInput.dataset.previousValue = ''; }
            tasksContainer.appendChild(taskItem);
            mainNarrativeInput.required = false;
            updateLiveNarrative(); // Update live narrative when task added
            return tasksContainer.lastElementChild;
        } catch (error) { console.error("Error adding task:", error); return null; }
    }

    /**
     * Removes a task item.
     */
     function removeTask(button) {
        const taskItem = button.closest('.task-item');
        if (taskItem) {
            taskItem.remove();
            recalculateAndDistributeTimes(); // Recalculate after removing
            if (getTaskItems().length === 0) {
                mainNarrativeInput.required = true;
            }
             updateLiveNarrative(); // Update live narrative when task removed
        }
    }


    /**
     * **MODIFIED**: Recalculates task times. Distributes evenly if no tasks are manually set.
     */
    function recalculateAndDistributeTimes(options = {}) {
        const { changedInput = null, totalTimeChanged = false } = options;

        const taskItems = getTaskItems();
        const numTasks = taskItems.length;
        let totalTime = parseFloat(totalTimeInput.value) || 0;

        if (numTasks === 0) { checkTaskTimeSum(); updateLiveNarrative(); return; } // Update narrative on clear

        // --- Pre-calculation Check: Ensure Total Time is Sufficient ---
        const minRequiredTotal = numTasks * MIN_TASK_TIME;
        if (totalTime < minRequiredTotal && totalTime > 0) {
            if (!totalTimeChanged) { totalTime = minRequiredTotal; totalTimeInput.value = totalTime.toFixed(1); }
        } else if (totalTime <= 0 && numTasks > 0) {
            totalTime = minRequiredTotal; totalTimeInput.value = totalTime.toFixed(1);
        }

        let tasksToAdjust = [];
        let manuallySetTasks = [];
        let fixedTimeSum = 0;
        let anyTaskManuallySet = false; // *** NEW flag ***

        // Determine if *any* task has been manually set
        taskItems.forEach(item => {
            if (item.dataset.manualSet === 'true') {
                anyTaskManuallySet = true;
            }
        });

        // --- Logic Branching: Even vs Proportional Distribution ---

        if (!anyTaskManuallySet && !changedInput && !totalTimeChanged) {
            // *** NEW: Scenario: No manual edits yet, task added/removed -> Distribute Evenly ***
             tasksToAdjust = taskItems; // Adjust all tasks evenly
             applyRoundingAndSetValues(tasksToAdjust.map(item => ({ // Map to expected format for helper
                 item,
                 timeInput: item.querySelector('.taskTime'),
                 value: totalTime / numTasks // Equal share before rounding
             })), totalTime);

        } else if (totalTimeChanged) {
            // *** Scenario: Total time changed -> Distribute ALL proportionally ***
            fixedTimeSum = 0;
            tasksToAdjust = taskItems; // Adjust all based on previous proportions
            manuallySetTasks = []; // Reset manual tasks for this calc type
            distributeProportionally(tasksToAdjust, totalTime, true); // Use helper

        } else {
            // *** Scenario: At least one task manually set OR direct input change -> Proportional/Fixed Logic ***
            // Identify fixed tasks (excluding the one being changed right now)
             taskItems.forEach(item => {
                 if (item.dataset.manualSet === 'true' && item !== changedInput?.closest('.task-item')) {
                     manuallySetTasks.push(item);
                     fixedTimeSum += parseFloat(item.querySelector('.taskTime')?.value || '0');
                 }
             });

            // Handle the currently changed input (if any)
             if (changedInput) {
                 const manuallyChangedItem = changedInput.closest('.task-item');
                 if (manuallyChangedItem) {
                     manuallyChangedItem.dataset.manualSet = 'true'; // Mark as manual
                     anyTaskManuallySet = true; // Set flag because manual change occurred
                     let manualValue = parseFloat(changedInput.value) || 0;
                     // Clamp value
                     const minAllowed=MIN_TASK_TIME, otherTasksMinSum=(numTasks - 1)*MIN_TASK_TIME, maxAllowed=Math.max(MIN_TASK_TIME, totalTime - otherTasksMinSum);
                     if (manualValue < minAllowed) manualValue = minAllowed;
                     else if (manualValue > maxAllowed && numTasks > 1) manualValue = maxAllowed;
                     else if (numTasks === 1 && manualValue > totalTime) manualValue = totalTime;
                     if (Math.abs(manualValue - (parseFloat(changedInput.value) || 0)) > TIME_TOLERANCE) { changedInput.value = manualValue.toFixed(1); }
                     fixedTimeSum += manualValue;
                     manuallySetTasks.push(manuallyChangedItem);
                 }
             }

             // Determine tasks to auto-adjust
             tasksToAdjust = taskItems.filter(item => !manuallySetTasks.includes(item));
             let remainingTime = totalTime - fixedTimeSum;
             const numToAdjust = tasksToAdjust.length;

             if (numToAdjust > 0) {
                 const minRequiredForAdjust = numToAdjust * MIN_TASK_TIME;
                 if (remainingTime < minRequiredForAdjust) { remainingTime = minRequiredForAdjust; }
                 distributeProportionally(tasksToAdjust, remainingTime, false, changedInput ? tasksToAdjust : null); // Pass tasksToAdjust for flash feedback if triggered by input change
             } else if (Math.abs(totalTime - fixedTimeSum) > TIME_TOLERANCE) { /* Edge case */ }
        }


        // Store current values as previous for the *next* totalTime change
        taskItems.forEach(item => {
            const input = item.querySelector('.taskTime'); if (input) { input.dataset.previousValue = input.value; }
        });

        checkTaskTimeSum(); // Final validation check
        updateLiveNarrative(); // Update narrative after time changes
    }

    /**
     * **NEW HELPER**: Distributes targetTime proportionally among specified tasks.
     * @param {Array<HTMLElement>} tasks - The task items to distribute time among.
     * @param {number} targetTime - The total time to distribute.
     * @param {boolean} usePreviousValue - If true, use data-previous-value as basis for proportion.
     * @param {Array<HTMLElement>|null} flashTargets - Optional array of tasks to apply flash feedback to.
     */
    function distributeProportionally(tasks, targetTime, usePreviousValue, flashTargets = null) {
        let basisSum = 0;
        tasks.forEach(item => {
            const input = item.querySelector('.taskTime');
            const basisValue = usePreviousValue
                ? parseFloat(input?.dataset.previousValue || '1') || 1
                : parseFloat(input?.value || '1') || 1;
            basisSum += basisValue;
        });

        const unroundedTimes = [];
        const numToAdjust = tasks.length;

        tasks.forEach(item => {
            const timeInput = item.querySelector('.taskTime'); if (!timeInput) return;
            let newTime;
            const basisValue = usePreviousValue
                ? parseFloat(timeInput.dataset.previousValue || '1') || 1
                : parseFloat(timeInput.value || '1') || 1;

            if (basisSum > TIME_TOLERANCE && targetTime > 0) {
                const proportion = basisValue / basisSum; newTime = targetTime * proportion;
            } else { newTime = targetTime / numToAdjust; } // Fallback to equal if basis is 0

            newTime = Math.max(MIN_TASK_TIME, newTime);
            unroundedTimes.push({ item, timeInput, value: newTime });
        });

        applyRoundingAndSetValues(unroundedTimes, targetTime, flashTargets); // Pass flash targets
    }


    /**
     * **MODIFIED**: Applies rounding and sets values. Optionally applies flash feedback.
     */
    function applyRoundingAndSetValues(unroundedTimes, targetSum, flashTargets = null) {
        if (unroundedTimes.length === 0) return;
        let currentSum = 0;
        const roundedTimes = unroundedTimes.map(t => {
            const rounded = parseFloat(t.value.toFixed(1)); const clamped = Math.max(MIN_TASK_TIME, rounded);
            currentSum += clamped; return { ...t, roundedValue: clamped };
        });
        let difference = parseFloat((targetSum - currentSum).toFixed(2));
        unroundedTimes.sort((a, b) => (b.value - Math.floor(b.value * 10) / 10) - (a.value - Math.floor(a.value * 10) / 10));
        let adjustIndex = 0; const maxAdjustIterations = roundedTimes.length * 2;
        while (Math.abs(difference) >= 0.05 && adjustIndex < maxAdjustIterations) {
            const sortedTaskInfo = unroundedTimes[adjustIndex % unroundedTimes.length];
            const taskToAdjust = roundedTimes.find(rt => rt.item === sortedTaskInfo.item); if (!taskToAdjust) { adjustIndex++; continue; }
            const adjustment = difference > 0 ? 0.1 : -0.1;
            if (taskToAdjust.roundedValue + adjustment >= MIN_TASK_TIME - TIME_TOLERANCE) {
                taskToAdjust.roundedValue = parseFloat((taskToAdjust.roundedValue + adjustment).toFixed(1));
                difference = parseFloat((difference - adjustment).toFixed(2));
            }
            adjustIndex++;
        }
        if (Math.abs(difference) > TIME_TOLERANCE && Math.abs(difference) < 0.05 && roundedTimes.length > 0) {
             const firstSortedTask = roundedTimes.find(rt => rt.item === unroundedTimes[0].item);
             if(firstSortedTask) {
                 const finalAdjustedValue = parseFloat((firstSortedTask.roundedValue + difference).toFixed(1));
                 if (finalAdjustedValue >= MIN_TASK_TIME - TIME_TOLERANCE) { firstSortedTask.roundedValue = finalAdjustedValue; }
             }
        }

        // Update values and apply flash if needed
        roundedTimes.forEach(t => {
            const finalValueStr = t.roundedValue.toFixed(1);
            const valueChanged = t.timeInput.value !== finalValueStr;
            if (valueChanged) {
                t.timeInput.value = finalValueStr;
                // *** NEW: Apply flash if this task is in the flashTargets list ***
                if (flashTargets && flashTargets.includes(t.item)) {
                    t.item.classList.add('recalculated-flash');
                    // Remove class after duration
                    setTimeout(() => {
                        t.item.classList.remove('recalculated-flash');
                    }, RECALC_FLASH_DURATION);
                }
            }
        });
    }


    /**
     * Checks task time sum against total. (Identical function as provided previously)
     */
      function checkTaskTimeSum() {
         const taskItems = getTaskItems(); if (taskItems.length === 0) { timeMatchWarning.textContent = ''; return true; }
         const totalTime = parseFloat(totalTimeInput.value) || 0; const taskTimeSum = calculateTaskTimeSum();
         if (Math.abs(totalTime - taskTimeSum) > TIME_TOLERANCE * 2) {
             timeMatchWarning.textContent = `Task Σ (${taskTimeSum.toFixed(1)}) ≠ Total (${totalTime.toFixed(1)})`; return false;
         } else { timeMatchWarning.textContent = ''; return true; }
     }

    /**
     * Calculates sum of task times. (Identical function as provided previously)
     */
     function calculateTaskTimeSum() {
         return getTaskItems().reduce((sum, task) => {
             const timeInput = task.querySelector('.taskTime'); return sum + (parseFloat(timeInput?.value || '0'));
         }, 0);
     }

        /**
     * **MODIFIED**: Renamed and updates the main narrative input field LIVE.
     * Uses underscores for empty task narratives in the live view.
     */
    function updateLiveNarrative() {
        const taskItems = getTaskItems();
        if (taskItems.length === 0) {
             // If no tasks, keep existing main narrative (user might be typing there)
             // Or clear it? Let's keep it for now.
             // mainNarrativeInput.value = ''; // Optional: clear if no tasks
            return;
        }

        const narrativeParts = [];
        const blankPlaceholder = "_________________________________"; // Define the placeholder

        taskItems.forEach((task, index) => {
            const narrativeInput = task.querySelector('.taskNarrative');
            // Use the underscore placeholder if narrative is empty
            const narrative = narrativeInput?.value.trim() || blankPlaceholder; // <-- CHANGE HERE
            const timeInput = task.querySelector('.taskTime');
            // Use placeholder or 0.0 if time is missing/invalid for the live view
            const timeValue = parseFloat(timeInput?.value || '0');
            const timeDisplay = !isNaN(timeValue) ? timeValue.toFixed(1) : '?.?';

            narrativeParts.push(`${narrative} (${timeDisplay})`);
        });

        mainNarrativeInput.value = narrativeParts.join('; ');
    }

     /**
      * Gets final narrative for SAVING (stricter validation).
      */
     function getFinalNarrativeForSave() {
         const taskItems = getTaskItems();
         if (taskItems.length === 0) {
             // If saving with no tasks, the main narrative must be non-empty
             if (!mainNarrativeInput.value.trim()) return null; // Indicate failure
             return mainNarrativeInput.value.trim();
         }

         // If saving with tasks, construct from tasks and validate strictly
         const narrativeParts = [];
         let allTasksValid = true;
         taskItems.forEach(task => {
             const narrativeInput = task.querySelector('.taskNarrative');
             const narrative = narrativeInput?.value.trim() || '';
             const timeInput = task.querySelector('.taskTime');
             const timeValue = parseFloat(timeInput?.value || '0');

             if (!narrative || timeValue < MIN_TASK_TIME) { // Strict check for save
                 allTasksValid = false;
                 task.style.outline = "1px solid red";
             } else {
                 task.style.outline = "none";
             }
             narrativeParts.push(`${narrative} (${timeValue.toFixed(1)})`);
         });

         if (!allTasksValid) {
              showFeedback(`Cannot save. Please fill in all task narratives and ensure task times are at least ${MIN_TASK_TIME}. Check highlighted tasks.`, 'error');
              return null; // Indicate failure
         }
         return narrativeParts.join('; ');
     }


    // --- Event Handlers ---

    function setupEventListeners() {
        // Dashboard
        createNewEntryBtn.addEventListener('click', () => openModal('create'));

        // Modal General
        closeModalBtn.addEventListener('click', closeModal);
        cancelEntryBtn.addEventListener('click', closeModal);
        saveEntryBtn.addEventListener('click', handleSaveEntry);
        entryModal.querySelector('.modal-overlay').addEventListener('click', closeModal);

        // Form specific (inside Modal)
        addTaskBtn.addEventListener('click', handleAddTaskButtonClick);
        tasksContainer.addEventListener('click', handleTaskContainerClick); // For remove buttons
        tasksContainer.addEventListener('change', handleTaskTimeInputChange); // For task time manual changes
        totalTimeInput.addEventListener('input', () => recalculateAndDistributeTimes({ totalTimeChanged: true }));

        // *** NEW: Live update listener for task narratives ***
        tasksContainer.addEventListener('input', handleTaskNarrativeInput);

        // Global listeners
        document.addEventListener('keydown', handleKeyboardShortcuts);
    }

     function handleAddTaskButtonClick() {
        const newTaskItem = addTask();
        if(newTaskItem) {
            recalculateAndDistributeTimes(); // Recalculate *after* adding
            requestAnimationFrame(() => {
                newTaskItem.querySelector('.taskNarrative')?.focus();
            });
        }
     }

    /**
     * **NEW**: Handles input events on task narrative textareas for live updates.
     */
    function handleTaskNarrativeInput(event) {
         if (event.target.classList.contains('taskNarrative')) {
              updateLiveNarrative();
         }
    }

    /**
     * **MODIFIED**: Uses getFinalNarrativeForSave for validation before saving.
     */
    function handleSaveEntry() {
        clearFeedback();
        getTaskItems().forEach(task => task.style.outline = "none");

        // Basic Validation
        if (!matterNameInput.value.trim()) { showFeedback('Please enter a Matter Name.', 'error'); matterNameInput.focus(); return; }
        const totalTime = parseFloat(totalTimeInput.value);
        const taskItems = getTaskItems(); const numTasks = taskItems.length;
        if (isNaN(totalTime) || totalTime <= 0) { showFeedback('Please enter a valid Total Time Worked (> 0).', 'error'); totalTimeInput.focus(); return; }
        const minRequiredTotal = numTasks * MIN_TASK_TIME;
        if (numTasks > 0 && totalTime < minRequiredTotal - TIME_TOLERANCE) { showFeedback(`Total time (${totalTime.toFixed(1)}) is insufficient for ${numTasks} tasks (min ${minRequiredTotal.toFixed(1)}).`, 'error'); totalTimeInput.focus(); return; }

        // Time Sum Check
        if (numTasks > 0 && !checkTaskTimeSum()) {
             showFeedback('Task times do not sum correctly to the total time.', 'error'); return;
        }

        // Get and Validate Final Narrative
        const finalNarrative = getFinalNarrativeForSave();
        if (finalNarrative === null) {
             // Feedback is shown by getFinalNarrativeForSave
             return;
        }

        // Prepare Data and Save
        const entryData = {
            id: currentEditId,
            matterName: matterNameInput.value.trim(),
            totalTime: parseFloat(totalTimeInput.value).toFixed(1),
            finalNarrative: finalNarrative
        };

        addOrUpdateEntry(entryData);
        closeModal();
        renderDashboard();
    }


    function handleEditButtonClick(event) {
        const button = event.target;
        const entryId = button.dataset.id;
        if (entryId) { openModal('edit', entryId); }
        else { console.error("Edit button missing entry ID."); }
    }


    function handleTaskContainerClick(event) {
        if (event.target.classList.contains('removeTaskBtn')) {
            removeTask(event.target); // removeTask now calls updateLiveNarrative
        }
    }

    function handleTaskTimeInputChange(event) {
        const target = event.target;
        if (target.classList.contains('taskTime')) {
            // recalculateAndDistributeTimes handles updating narrative and flash
            recalculateAndDistributeTimes({ changedInput: target });
        }
    }

    function handleKeyboardShortcuts(event) {
        const modalIsOpen = entryModal.style.display === 'flex';
        if (!modalIsOpen) return; // Shortcuts only active in modal

        // Alt + K -> Add Task
        if (!event.ctrlKey && event.altKey && !event.metaKey && event.key.toLowerCase() === 'k') {
            event.preventDefault(); handleAddTaskButtonClick();
        }
        // Ctrl + Enter -> Save Entry
        if (event.ctrlKey && event.key === 'Enter') {
             event.preventDefault(); handleSaveEntry();
        }
         // Escape -> Close Modal
         if (event.key === 'Escape') {
              event.preventDefault(); closeModal();
         }
    }

    // --- Utility Functions ---
    // (Keep getTaskItems, showFeedback, clearFeedback - identical)
     function getTaskItems() { return Array.from(tasksContainer.querySelectorAll('.task-item')); }
     function showFeedback(message, type = 'info', temporary = false) {
        if (temporary) { alert(`Feedback [${type.toUpperCase()}]: ${message}`); }
        else { feedbackArea.textContent = message; feedbackArea.className = `feedback ${type}`; feedbackArea.style.display = 'block'; }
     }
     function clearFeedback() { feedbackArea.textContent = ''; feedbackArea.style.display = 'none'; feedbackArea.className = 'feedback'; }


    // --- Start the Application ---
    initApp();

}); // End of DOMContentLoaded