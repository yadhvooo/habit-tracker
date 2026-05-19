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
    
    // Functions
    function updateMonthDisplay() {
        const options = { month: 'long', year: 'numeric' };
        monthDisplay.textContent = currentDate.toLocaleDateString('en-US', options);
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
        gridHeader.innerHTML = '<th class="date-col">Date</th>';
        gridBody.innerHTML = '';
        
        if(habits.length === 0) {
            gridBody.innerHTML = '<tr><td colspan="100%" class="text-muted p-4">No habits yet. Add one to get started!</td></tr>';
            return;
        }
        
        // Render Headers (Habits)
        habits.forEach(habit => {
            const th = document.createElement('th');
            th.innerHTML = `
                <div class="habit-header-content">
                    <span class="habit-name">${escapeHTML(habit.name)}</span>
                    <button class="btn-delete" data-id="${habit.id}" title="Delete Habit">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            `;
            gridHeader.appendChild(th);
        });
        
        // Render Rows (Days)
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const monthStr = String(month + 1).padStart(2, '0');
        
        const todayStr = getTodayString();
        
        for(let day = 1; day <= daysInMonth; day++) {
            const dayStr = String(day).padStart(2, '0');
            const dateStr = `${year}-${monthStr}-${dayStr}`;
            
            const tr = document.createElement('tr');
            
            // Highlight today
            if(dateStr === todayStr) {
                tr.style.backgroundColor = 'rgba(0, 210, 255, 0.05)';
            }
            
            // Date Column
            const dateObj = new Date(year, month, day);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            
            const tdDate = document.createElement('td');
            tdDate.className = 'date-col';
            tdDate.innerHTML = `<div><strong>${dayStr}</strong> <span style="font-size: 0.8rem; color: var(--text-muted)">${dayName}</span></div>`;
            tr.appendChild(tdDate);
            
            // Habit Checkboxes
            habits.forEach(habit => {
                const td = document.createElement('td');
                td.className = 'checkbox-cell';
                
                // Find log
                const log = logs.find(l => l.habit_id === habit.id && l.date === dateStr);
                const isCompleted = log ? log.completed : false;
                
                const checkDiv = document.createElement('div');
                checkDiv.className = `check-container ${isCompleted ? 'checked' : ''}`;
                checkDiv.innerHTML = '<i class="ph-bold ph-check"></i>';
                
                td.appendChild(checkDiv);
                
                // Toggle log
                td.addEventListener('click', () => toggleLog(habit.id, dateStr, !isCompleted, checkDiv));
                
                tr.appendChild(td);
            });
            
            gridBody.appendChild(tr);
        }
        
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
