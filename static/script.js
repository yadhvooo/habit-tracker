document.addEventListener('DOMContentLoaded', () => {
    // Current State
    let currentDate = new Date();
    let habits = [];
    let logs = []; // {habit_id, date, completed}
    
    // DOM Elements
    const monthDisplay = document.getElementById('current-month-display');
    const settingsMonthDisplay = document.getElementById('settings-month-display');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    const gridHeader = document.getElementById('grid-header');
    const gridBody = document.getElementById('grid-body');
    
    const todayScoreEl = document.getElementById('today-score');
    const monthScoreEl = document.getElementById('month-score');
    
    const addHabitBtn = document.getElementById('add-habit-btn');
    const addHabitModal = document.getElementById('add-habit-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const saveHabitBtn = document.getElementById('save-habit-btn');
    const habitNameInput = document.getElementById('habit-name');
    
    const scoreHistoryBtn = document.getElementById('score-history-btn');
    const scoreHistoryModal = document.getElementById('score-history-modal');
    const closeScoreModalBtn = document.getElementById('close-score-modal');
    const statBestMonth = document.getElementById('stat-best-month');
    const statAvgMonth = document.getElementById('stat-avg-month');
    const statTotalCompletions = document.getElementById('stat-total-completions');
    const statActiveHabits = document.getElementById('stat-active-habits');
    
    // Settings Elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-modal');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const bgOptions = document.querySelectorAll('.bg-option');
    const bgMusicToggle = document.getElementById('bg-music-toggle');
    
    // Journal Elements
    const journalModal = document.getElementById('journal-modal');
    const closeJournalModalBtn = document.getElementById('close-journal-modal');
    const journalContent = document.getElementById('journal-content');
    const saveJournalBtn = document.getElementById('save-journal-btn');
    let currentJournalHabitId = null;
    let currentJournalDate = null;
    
    // Journals List Elements
    const viewJournalsBtn = document.getElementById('view-journals-btn');
    const journalsListModal = document.getElementById('journals-list-modal');
    const closeJournalsListModalBtn = document.getElementById('close-journals-list-modal');
    const journalSearchInput = document.getElementById('journal-search-input');
    const journalDateInput = document.getElementById('journal-date-input');
    const clearJournalFiltersBtn = document.getElementById('clear-journal-filters');
    const journalsListContainer = document.getElementById('journals-list-container');
    
    // Notes Elements
    const viewNotesBtn = document.getElementById('view-notes-btn');
    const notesModal = document.getElementById('notes-modal');
    const closeNotesModalBtn = document.getElementById('close-notes-modal');
    const addNoteBtn = document.getElementById('add-note-btn');
    const notesListContainer = document.getElementById('notes-list-container');
    
    // Initialize
    updateMonthDisplay();
    fetchData();
    fetchSettings();
    fetchNotesList(); // pre-load notes for hover
    initTiltEffect();
    
    // Event Listeners
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        updateMonthDisplay();
        fetchData();
    });
    
    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        updateMonthDisplay();
        fetchData();
    });
    
    // Modal Listeners
    addHabitBtn.addEventListener('click', () => {
        addHabitModal.classList.add('active');
        habitNameInput.focus();
    });
    
    scoreHistoryBtn.addEventListener('click', async () => {
        scoreHistoryModal.classList.add('active');
        
        try {
            const res = await fetch('/api/stats');
            if(res.ok) {
                const stats = await res.json();
                animateValue(statBestMonth, 0, stats.best_month_score, 800);
                animateValue(statAvgMonth, 0, Math.round(stats.avg_month_score), 800);
                animateValue(statTotalCompletions, 0, stats.total_completions, 800);
                animateValue(statActiveHabits, 0, stats.total_active_habits, 800);
            }
        } catch(e) {
            console.error("Error fetching stats", e);
        }
    });
    
    closeScoreModalBtn.addEventListener('click', () => {
        scoreHistoryModal.classList.remove('active');
    });
    
    scoreHistoryModal.addEventListener('click', (e) => {
        if(e.target === scoreHistoryModal) {
            closeScoreModalBtn.click();
        }
    });
    
    closeModalBtn.addEventListener('click', () => {
        addHabitModal.classList.remove('active');
        habitNameInput.value = '';
    });
    
    addHabitModal.addEventListener('click', (e) => {
        if(e.target === addHabitModal) {
            closeModalBtn.click();
        }
    });
    
    saveHabitBtn.addEventListener('click', async () => {
        const name = habitNameInput.value.trim();
        if(!name) return;
        
        try {
            const res = await fetch('/api/habits', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name})
            });
            if(res.ok) {
                closeModalBtn.click();
                fetchData();
            }
        } catch(e) {
            console.error("Error saving habit", e);
        }
    });

    if (saveJournalBtn) {
        saveJournalBtn.addEventListener('click', async () => {
            if (!currentJournalDate) return;
            const content = journalContent.value.trim();
            try {
                const res = await fetch('/api/journal', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({date: currentJournalDate, content})
                });
                if(res.ok) {
                    if(journalModal) journalModal.classList.remove('active');
                    
                    const isCompleted = content !== '';
                    await fetch('/api/logs', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({habit_id: currentJournalHabitId, date: currentJournalDate, completed: isCompleted})
                    });
                    
                    fetchData();
                }
            } catch(e) { console.error("Error saving journal", e); }
        });
    }

    if (closeJournalModalBtn) {
        closeJournalModalBtn.addEventListener('click', () => {
            journalModal.classList.remove('active');
        });
    }
    
    if (journalModal) {
        journalModal.addEventListener('click', (e) => {
            if(e.target === journalModal) {
                journalModal.classList.remove('active');
            }
        });
    }
    
    // View Journals List Logic
    let fetchJournalsTimeout = null;
    
    const fetchJournalsList = async () => {
        if (!journalsListContainer) return;
        const search = journalSearchInput ? journalSearchInput.value.trim() : '';
        const date = journalDateInput ? journalDateInput.value : '';
        try {
            const res = await fetch(`/api/journals?search=${encodeURIComponent(search)}&date=${encodeURIComponent(date)}`);
            if (res.ok) {
                const data = await res.json();
                
                const titleEl = document.getElementById('journals-modal-title');
                if (titleEl) {
                    titleEl.textContent = `Past Journals (${data.length})`;
                }
                
                journalsListContainer.innerHTML = '';
                if (data.length === 0) {
                    if (date) {
                        const emptyDiv = document.createElement('div');
                        emptyDiv.style.textAlign = 'center';
                        emptyDiv.style.padding = '40px 20px';
                        
                        const msg = document.createElement('div');
                        msg.style.color = '#aaa';
                        msg.style.marginBottom = '20px';
                        msg.textContent = 'No journal found for this date.';
                        
                        const addBtn = document.createElement('button');
                        addBtn.className = 'btn-primary';
                        addBtn.innerHTML = '<i class="ph ph-pencil"></i> Did you remember anything?';
                        addBtn.addEventListener('click', () => {
                            currentJournalDate = date;
                            const journalHabit = habits.find(h => h.name.toLowerCase() === 'journal');
                            currentJournalHabitId = journalHabit ? journalHabit.id : null;
                            
                            if(journalContent) journalContent.value = '';
                            if(journalsListModal) journalsListModal.classList.remove('active');
                            if(journalModal) {
                                journalModal.classList.add('active');
                                setTimeout(() => { if(journalContent) journalContent.focus(); }, 100);
                            }
                        });
                        
                        emptyDiv.appendChild(msg);
                        emptyDiv.appendChild(addBtn);
                        journalsListContainer.appendChild(emptyDiv);
                    } else {
                        journalsListContainer.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">No journals found.</div>';
                    }
                    return;
                }
                data.forEach(j => {
                    const card = document.createElement('div');
                    card.className = 'glass-panel';
                    card.style.padding = '15px';
                    card.style.borderRadius = '8px';
                    
                    const header = document.createElement('div');
                    header.style.display = 'flex';
                    header.style.justifyContent = 'space-between';
                    header.style.marginBottom = '10px';
                    
                    const dateSpan = document.createElement('span');
                    dateSpan.style.fontWeight = 'bold';
                    dateSpan.style.color = 'var(--accent-primary)';
                    dateSpan.textContent = j.date;
                    
                    const editBtn = document.createElement('button');
                    editBtn.className = 'btn-icon';
                    editBtn.innerHTML = '<i class="ph ph-pencil"></i>';
                    editBtn.title = "Edit Journal";
                    editBtn.style.color = '#aaa';
                    
                    editBtn.addEventListener('click', () => {
                        currentJournalDate = j.date;
                        const journalHabit = habits.find(h => h.name.toLowerCase() === 'journal');
                        currentJournalHabitId = journalHabit ? journalHabit.id : null;
                        
                        if(journalContent) journalContent.value = j.content;
                        if(journalsListModal) journalsListModal.classList.remove('active');
                        if(journalModal) {
                            journalModal.classList.add('active');
                            setTimeout(() => { if(journalContent) journalContent.focus(); }, 100);
                        }
                    });
                    
                    header.appendChild(dateSpan);
                    header.appendChild(editBtn);
                    
                    const body = document.createElement('div');
                    body.style.whiteSpace = 'pre-wrap';
                    body.style.color = '#ddd';
                    body.textContent = j.content;
                    
                    card.appendChild(header);
                    card.appendChild(body);
                    journalsListContainer.appendChild(card);
                });
            }
        } catch(e) { console.error("Error fetching journals list", e); }
    };
    
    if (viewJournalsBtn) {
        viewJournalsBtn.addEventListener('click', () => {
            if(journalsListModal) {
                journalsListModal.classList.add('active');
                fetchJournalsList();
            }
        });
    }
    
    if (closeJournalsListModalBtn) {
        closeJournalsListModalBtn.addEventListener('click', () => {
            if(journalsListModal) journalsListModal.classList.remove('active');
        });
    }
    
    if (journalSearchInput) {
        journalSearchInput.addEventListener('input', () => {
            clearTimeout(fetchJournalsTimeout);
            fetchJournalsTimeout = setTimeout(fetchJournalsList, 300);
        });
    }
    
    if (journalDateInput) {
        journalDateInput.addEventListener('change', fetchJournalsList);
    }
    
    if (clearJournalFiltersBtn) {
        clearJournalFiltersBtn.addEventListener('click', () => {
            if(journalSearchInput) journalSearchInput.value = '';
            if(journalDateInput) journalDateInput.value = '';
            fetchJournalsList();
        });
    }
    
    if (journalsListModal) {
        journalsListModal.addEventListener('click', (e) => {
            if(e.target === journalsListModal) {
                journalsListModal.classList.remove('active');
            }
        });
    }
    
    // Sticky Notes Logic
    let notesData = [];
    
    async function fetchNotesList() {
        if (!notesListContainer) return;
        try {
            const res = await fetch('/api/notes');
            if (res.ok) {
                notesData = await res.json();
                renderNotes();
            }
        } catch(e) { console.error("Error fetching notes", e); }
    }
    
    function renderNotes() {
        notesListContainer.innerHTML = '';
        if (notesData.length === 0) {
            notesListContainer.innerHTML = '<div style="grid-column: 1 / -1; color: #aaa; text-align: center; padding: 40px;">No active notes. Click "New Note" to create one!</div>';
            return;
        }
        
        notesData.forEach(note => {
            const card = document.createElement('div');
            card.className = 'glass-panel';
            card.style.padding = '15px';
            card.style.borderRadius = '8px';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.gap = '10px';
            card.style.background = 'rgba(0, 255, 128, 0.05)';
            card.style.border = '1px solid rgba(0, 255, 128, 0.2)';
            
            const textarea = document.createElement('textarea');
            textarea.value = note.content;
            textarea.placeholder = "Write your note here...";
            textarea.style.width = '100%';
            textarea.style.minHeight = '120px';
            textarea.style.background = 'transparent';
            textarea.style.border = 'none';
            textarea.style.color = 'white';
            textarea.style.resize = 'vertical';
            textarea.style.outline = 'none';
            textarea.style.fontFamily = 'inherit';
            
            const footer = document.createElement('div');
            footer.style.display = 'flex';
            footer.style.flexDirection = 'column';
            footer.style.gap = '8px';
            footer.style.borderTop = '1px solid rgba(255,255,255,0.1)';
            footer.style.paddingTop = '10px';
            
            const typeRow = document.createElement('div');
            typeRow.style.display = 'flex';
            typeRow.style.justifyContent = 'space-between';
            typeRow.style.alignItems = 'center';
            
            const typeSelect = document.createElement('select');
            typeSelect.style.background = 'rgba(0,0,0,0.2)';
            typeSelect.style.border = '1px solid #4a4d5d';
            typeSelect.style.color = 'white';
            typeSelect.style.borderRadius = '4px';
            typeSelect.style.padding = '4px 8px';
            typeSelect.style.fontSize = '0.8rem';
            typeSelect.style.outline = 'none';
            typeSelect.innerHTML = `
                <option value="forever">Forever</option>
                <option value="single">Specific Date</option>
                <option value="duration">Date Range</option>
            `;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-icon';
            deleteBtn.innerHTML = '<i class="ph ph-trash"></i>';
            deleteBtn.style.color = 'var(--danger)';
            deleteBtn.title = 'Delete Note';
            
            typeRow.appendChild(typeSelect);
            typeRow.appendChild(deleteBtn);
            
            const datesContainer = document.createElement('div');
            datesContainer.style.display = 'flex';
            datesContainer.style.gap = '5px';
            
            const date1 = document.createElement('input');
            date1.type = 'date';
            date1.style.background = 'rgba(0,0,0,0.2)';
            date1.style.border = '1px solid #4a4d5d';
            date1.style.color = 'white';
            date1.style.borderRadius = '4px';
            date1.style.padding = '3px';
            date1.style.fontSize = '0.75rem';
            date1.style.colorScheme = 'dark';
            date1.style.flex = '1';
            
            const date2 = document.createElement('input');
            date2.type = 'date';
            date2.style.background = 'rgba(0,0,0,0.2)';
            date2.style.border = '1px solid #4a4d5d';
            date2.style.color = 'white';
            date2.style.borderRadius = '4px';
            date2.style.padding = '3px';
            date2.style.fontSize = '0.75rem';
            date2.style.colorScheme = 'dark';
            date2.style.flex = '1';
            
            datesContainer.appendChild(date1);
            datesContainer.appendChild(date2);
            
            footer.appendChild(typeRow);
            footer.appendChild(datesContainer);
            
            card.appendChild(textarea);
            card.appendChild(footer);
            notesListContainer.appendChild(card);
            
            let currentMode = 'forever';
            if (note.start_date && note.expires_at && note.start_date === note.expires_at) {
                currentMode = 'single';
            } else if (note.start_date || note.expires_at) {
                currentMode = 'duration';
            }
            typeSelect.value = currentMode;
            date1.value = note.start_date || '';
            date2.value = note.expires_at || '';
            
            const updateUI = () => {
                if (typeSelect.value === 'forever') {
                    datesContainer.style.display = 'none';
                } else if (typeSelect.value === 'single') {
                    datesContainer.style.display = 'flex';
                    date1.style.display = 'block';
                    date2.style.display = 'none';
                } else {
                    datesContainer.style.display = 'flex';
                    date1.style.display = 'block';
                    date2.style.display = 'block';
                }
            };
            updateUI();
            
            let saveTimeout;
            const autoSave = async () => {
                const updatedContent = textarea.value;
                let start = '';
                let end = '';
                if (typeSelect.value === 'single') {
                    start = date1.value;
                    end = date1.value; // same date
                } else if (typeSelect.value === 'duration') {
                    start = date1.value;
                    end = date2.value;
                }
                
                try {
                    await fetch(`/api/notes/${note.id}`, {
                        method: 'PUT',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({content: updatedContent, start_date: start, expires_at: end})
                    });
                } catch(e) { console.error("Error auto-saving", e); }
            };
            
            textarea.addEventListener('input', () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(autoSave, 1000);
            });
            
            typeSelect.addEventListener('change', () => {
                if (typeSelect.value === 'single' && !date1.value) date1.value = getTodayString();
                if (typeSelect.value === 'duration') {
                    if (!date1.value) date1.value = getTodayString();
                    if (!date2.value) date2.value = getTodayString();
                }
                updateUI();
                autoSave();
            });
            
            date1.addEventListener('change', autoSave);
            date2.addEventListener('change', autoSave);
            
            deleteBtn.addEventListener('click', async () => {
                if(confirm("Delete this note?")) {
                    try {
                        const res = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
                        if(res.ok) fetchNotesList();
                    } catch(e) { console.error(e); }
                }
            });
        });
    };
    
    const getTodayNotesContent = () => {
        const today = getTodayString();
        const active = notesData.filter(n => {
            const started = !n.start_date || n.start_date <= today;
            const notExpired = !n.expires_at || n.expires_at >= today;
            const hasContent = n.content.trim() !== '';
            return started && notExpired && hasContent;
        });
        if (active.length === 0) return null;
        return active.map(n => n.content.trim()).filter(c => c).join('\n\n---\n\n');
    };

    if (viewNotesBtn) {
        viewNotesBtn.addEventListener('mouseenter', () => {
            const preview = document.getElementById('notes-hover-preview');
            const content = document.getElementById('notes-hover-content');
            if(preview && content) {
                const text = getTodayNotesContent();
                if (text) {
                    content.textContent = text;
                    preview.style.display = 'block';
                }
            }
        });
        
        viewNotesBtn.addEventListener('mouseleave', () => {
            const preview = document.getElementById('notes-hover-preview');
            if(preview) preview.style.display = 'none';
        });
        
        viewNotesBtn.addEventListener('click', () => {
            if(notesModal) {
                notesModal.classList.add('active');
                fetchNotesList();
            }
        });
    }
    
    if (closeNotesModalBtn) {
        closeNotesModalBtn.addEventListener('click', () => {
            if(notesModal) notesModal.classList.remove('active');
        });
    }
    
    if (notesModal) {
        notesModal.addEventListener('click', (e) => {
            if(e.target === notesModal) notesModal.classList.remove('active');
        });
    }
    
    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/notes', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({content: '', start_date: '', expires_at: ''})
                });
                if (res.ok) fetchNotesList();
            } catch(e) { console.error(e); }
        });
    }
    
    // Settings Logic
    let currentSettings = { bg_animation: 0, bg_music: false };
    let userInteracted = false;
    
    window.addEventListener('click', () => {
        if(!userInteracted) {
            userInteracted = true;
            applyMusicSetting();
        }
    }, {once: true});

    async function fetchSettings() {
        try {
            const res = await fetch('/api/settings');
            if(res.ok) {
                currentSettings = await res.json();
                applySettingsToUI();
                applyBgAnimation();
                if(userInteracted) applyMusicSetting();
            }
        } catch(e) {
            console.error("Error fetching settings", e);
        }
    }

    function applySettingsToUI() {
        bgOptions.forEach(opt => {
            if(parseInt(opt.dataset.bg) === currentSettings.bg_animation) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });
        if(bgMusicToggle) bgMusicToggle.checked = currentSettings.bg_music;
    }

    const bgAudio = document.getElementById('bg-audio');

    function applyBgAnimation() {
        window.dispatchEvent(new CustomEvent('changeBgAnimation', { detail: currentSettings.bg_animation }));
    }

    function applyMusicSetting() {
        if(!bgAudio) return;
        
        if(currentSettings.bg_music) {
            bgAudio.play().catch(e => console.log("Audio autoplay blocked until interaction:", e));
        } else {
            bgAudio.pause();
        }
    }

    if(settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('active');
            applySettingsToUI();
        });
    }
    
    if(closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.remove('active');
            fetchData(); 
        });
    }

    if(settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if(e.target === settingsModal) {
                closeSettingsBtn.click();
            }
        });
    }

    bgOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            bgOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        });
    });

    if(saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => {
            const selectedBg = document.querySelector('.bg-option.active');
            const bg_animation = selectedBg ? parseInt(selectedBg.dataset.bg) : 0;
            const bg_music = bgMusicToggle ? bgMusicToggle.checked : false;
            
            try {
                const res = await fetch('/api/settings', {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({bg_animation, bg_music})
                });
                
                if(res.ok) {
                    currentSettings = {bg_animation, bg_music};
                    applyBgAnimation();
                    applyMusicSetting();
                    closeSettingsBtn.click();
                }
            } catch(e) {
                console.error("Error saving settings", e);
            }
        });
    }
    
    function updateMonthDisplay() {
        const options = { month: 'long', year: 'numeric' };
        const text = currentDate.toLocaleDateString('en-US', options);
        if(monthDisplay) monthDisplay.textContent = text;
        if(settingsMonthDisplay) settingsMonthDisplay.textContent = text;
    }
    
    function initTiltEffect() {
        document.querySelectorAll('.score-card').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = ((y - centerY) / centerY) * -10;
                const rotateY = ((x - centerX) / centerX) * 10;
                
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
            });
        });
    }
    
    function getFormattedMonth() {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }
    
    function getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }
    
    function getTodayString() {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    
    function calculateStreak(habitId) {
        let streak = 0;
        let d = new Date();
        const todayStr = getTodayString();
        
        // Check if today is completed
        const todayLog = logs.find(l => l.habit_id === habitId && l.date === todayStr);
        if (todayLog && todayLog.completed) {
            streak++;
        }
        
        d.setDate(d.getDate() - 1); // Move to yesterday
        
        while (true) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${day}`;
            
            // Note: This only checks within the fetched logs (usually current month)
            // A full implementation might need an API endpoint for exact streaks
            const log = logs.find(l => l.habit_id === habitId && l.date === dateStr);
            if (log && log.completed) {
                streak++;
                d.setDate(d.getDate() - 1);
            } else {
                break;
            }
        }
        return streak;
    }
    
    async function fetchData() {
        try {
            const res = await fetch(`/api/habits?month=${getFormattedMonth()}`);
            if(!res.ok) {
                if(res.status === 401) window.location.href = '/login';
                return;
            }
            const data = await res.json();
            habits = data.habits;
            logs = data.logs;
            
            renderGrid();
            calculateScores();
        } catch(e) {
            console.error("Error fetching data", e);
        }
    }
    
    function renderGrid() {
        // Clear existing
        gridHeader.innerHTML = '<th class="habit-col">Habits</th>';
        gridBody.innerHTML = '';
        
        if(habits.length === 0) {
            gridBody.innerHTML = '<tr><td colspan="100%" class="text-muted p-4">No habits yet. Add one to get started!</td></tr>';
            return;
        }
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const monthStr = String(month + 1).padStart(2, '0');
        const todayStr = getTodayString();
        
        // Render Headers (Days)
        for(let day = 1; day <= daysInMonth; day++) {
            const dayStr = String(day).padStart(2, '0');
            const dateStr = `${year}-${monthStr}-${dayStr}`;
            const dateObj = new Date(year, month, day);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });
            
            const th = document.createElement('th');
            th.className = 'day-col';
            if(dateStr === todayStr) {
                th.style.backgroundColor = 'rgba(0, 210, 255, 0.15)';
                th.style.color = 'var(--accent-secondary)';
            }
            th.innerHTML = `<div>${dayStr}</div><div style="font-size: 0.7rem; font-weight: normal; margin-top: 2px;">${dayName}</div>`;
            gridHeader.appendChild(th);
        }
        
        let draggedRow = null;

        // Render Rows (Habits)
        habits.forEach((habit, index) => {
            const tr = document.createElement('tr');
            tr.className = 'habit-row';
            tr.setAttribute('draggable', 'true');
            tr.dataset.index = index;
            tr.dataset.id = habit.id;
            
            // Drag Events
            tr.addEventListener('dragstart', (e) => {
                draggedRow = tr;
                setTimeout(() => tr.classList.add('dragging'), 0);
            });
            tr.addEventListener('dragend', () => {
                tr.classList.remove('dragging');
                draggedRow = null;
                document.querySelectorAll('.habit-row').forEach(row => row.classList.remove('drag-over'));
            });
            tr.addEventListener('dragover', (e) => {
                e.preventDefault(); // Necessary to allow dropping
            });
            tr.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if(tr !== draggedRow) tr.classList.add('drag-over');
            });
            tr.addEventListener('dragleave', () => {
                tr.classList.remove('drag-over');
            });
            tr.addEventListener('drop', (e) => {
                e.preventDefault();
                tr.classList.remove('drag-over');
                if(tr !== draggedRow) {
                    reorderHabits(draggedRow.dataset.index, tr.dataset.index);
                }
            });
            
            // Habit Column (Sticky Left)
            const tdHabit = document.createElement('td');
            tdHabit.className = 'habit-col';
            
            const streak = calculateStreak(habit.id);
            const streakHtml = streak >= 2 ? `<span class="streak-badge" title="${streak} Day Streak!"><i class="ph-fill ph-fire"></i> ${streak}</span>` : '';
            
            tdHabit.innerHTML = `
                <div class="habit-header-content">
                    <i class="ph ph-dots-six-vertical drag-handle" title="Drag to reorder"></i>
                    <span class="habit-name" title="Double click to edit">${escapeHTML(habit.name)}${streakHtml}</span>
                    <button class="btn-delete" data-id="${habit.id}" title="Delete Habit">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            `;
            tr.appendChild(tdHabit);
            
            // Edit Name on Double Click
            const nameSpan = tdHabit.querySelector('.habit-name');
            nameSpan.addEventListener('dblclick', () => {
                if(nameSpan.querySelector('input')) return;
                
                const currentName = habit.name;
                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentName;
                input.className = 'edit-habit-input';
                
                nameSpan.innerHTML = '';
                nameSpan.appendChild(input);
                input.focus();
                
                const saveName = async () => {
                    const newName = input.value.trim();
                    if(newName && newName !== currentName) {
                        try {
                            const res = await fetch(`/api/habits/${habit.id}`, {
                                method: 'PUT',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({name: newName})
                            });
                            if(res.ok) {
                                habit.name = newName;
                            }
                        } catch(e) { console.error("Error updating name", e); }
                    }
                    
                    const streak = calculateStreak(habit.id);
                    const streakHtml = streak >= 2 ? `<span class="streak-badge" title="${streak} Day Streak!"><i class="ph-fill ph-fire"></i> ${streak}</span>` : '';
                    nameSpan.innerHTML = escapeHTML(habit.name) + streakHtml;
                };
                
                input.addEventListener('blur', saveName);
                input.addEventListener('keydown', (e) => {
                    if(e.key === 'Enter') input.blur();
                    if(e.key === 'Escape') {
                        input.value = currentName;
                        input.blur();
                    }
                });
            });
            
            // Days Columns (Checkboxes)
            for(let day = 1; day <= daysInMonth; day++) {
                const dayStr = String(day).padStart(2, '0');
                const dateStr = `${year}-${monthStr}-${dayStr}`;
                
                const td = document.createElement('td');
                td.className = 'checkbox-cell';
                if(dateStr === todayStr) {
                    td.style.backgroundColor = 'rgba(0, 210, 255, 0.05)';
                }
                
                // Find log
                const log = logs.find(l => l.habit_id === habit.id && l.date === dateStr);
                const isCompleted = log ? log.completed : false;
                
                const checkDiv = document.createElement('div');
                checkDiv.className = `check-container ${isCompleted ? 'checked' : ''}`;
                checkDiv.innerHTML = '<i class="ph-bold ph-check"></i>';
                
                td.appendChild(checkDiv);
                
                // Toggle log
                td.addEventListener('click', async () => {
                    if (habit.name.toLowerCase() === 'journal') {
                        currentJournalHabitId = habit.id;
                        currentJournalDate = dateStr;
                        
                        if (journalContent) journalContent.value = '';
                        try {
                            const res = await fetch(`/api/journal?date=${currentJournalDate}`);
                            if (res.ok) {
                                const data = await res.json();
                                if (journalContent) journalContent.value = data.content || '';
                            }
                        } catch(e) { console.error("Error fetching journal", e); }
                        
                        if (journalModal) {
                            journalModal.classList.add('active');
                            setTimeout(() => { if(journalContent) journalContent.focus(); }, 100);
                        }
                    } else {
                        const currentlyCompleted = checkDiv.classList.contains('checked');
                        toggleLog(habit.id, dateStr, !currentlyCompleted, checkDiv);
                    }
                });
                
                tr.appendChild(td);
            }
            
            gridBody.appendChild(tr);
        });
        
        // Bind Delete Buttons
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if(!confirm("Are you sure you want to delete this habit? All history will be lost.")) return;
                
                const id = btn.getAttribute('data-id');
                try {
                    const res = await fetch(`/api/habits/${id}`, { method: 'DELETE' });
                    if(res.ok) fetchData();
                } catch(e) { console.error(e); }
            });
        });
    }
    
    async function reorderHabits(fromIndex, toIndex) {
        fromIndex = parseInt(fromIndex);
        toIndex = parseInt(toIndex);
        
        // Update local array
        const [movedItem] = habits.splice(fromIndex, 1);
        habits.splice(toIndex, 0, movedItem);
        
        // Update positions
        habits.forEach((h, i) => h.position = i);
        
        // Re-render UI
        renderGrid();
        
        // Send to backend
        const payload = habits.map(h => ({ id: h.id, position: h.position }));
        try {
            await fetch('/api/habits/reorder', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch(e) {
            console.error("Error reordering", e);
        }
    }
    
    async function toggleLog(habit_id, date, completed, element) {
        // Optimistic UI update
        if(completed) {
            element.classList.add('checked');
        } else {
            element.classList.remove('checked');
        }
        
        // Update local logs array
        let logIndex = logs.findIndex(l => l.habit_id === habit_id && l.date === date);
        if(logIndex >= 0) {
            logs[logIndex].completed = completed;
        } else {
            logs.push({habit_id, date, completed});
        }
        
        calculateScores();
        
        try {
            await fetch('/api/logs', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({habit_id, date, completed})
            });
        } catch(e) {
            console.error("Error toggling log", e);
            // Revert on error
            fetchData();
        }
    }
    
    function calculateScores() {
        const todayStr = getTodayString();
        
        let todayScore = 0;
        let monthScore = 0;
        
        logs.forEach(log => {
            if(log.completed) {
                monthScore++;
                if(log.date === todayStr) {
                    todayScore++;
                }
            }
        });
        
        // Animate counter if changed
        animateValue(todayScoreEl, parseInt(todayScoreEl.textContent), todayScore, 500);
        animateValue(monthScoreEl, parseInt(monthScoreEl.textContent), monthScore, 500);
    }
    
    function animateValue(obj, start, end, duration) {
        if(start === end) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.innerHTML = end;
            }
        };
        window.requestAnimationFrame(step);
    }
    
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
});
