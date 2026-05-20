document.addEventListener('DOMContentLoaded', () => {
    // Current State
    let currentDate = new Date();
    let habits = [];
    let logs = []; // {habit_id, date, completed}
    
    // DOM Elements
    const monthDisplay = document.getElementById('current-month-display');
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
    
    // Initialize
    updateMonthDisplay();
    fetchData();
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
    
    function updateMonthDisplay() {
        const options = { month: 'long', year: 'numeric' };
        monthDisplay.textContent = currentDate.toLocaleDateString('en-US', options);
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
                td.addEventListener('click', () => {
                    const currentlyCompleted = checkDiv.classList.contains('checked');
                    toggleLog(habit.id, dateStr, !currentlyCompleted, checkDiv);
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
