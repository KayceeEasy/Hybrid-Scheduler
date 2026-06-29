// --- 1. CONFIGURATION ---
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzGTVCXWxFSC9ztoOR1hljQ5moSFvVOg6DiB2bMbRsKb3W6r1-nPQM113UKqxxcLQnnWg/exec"; 

const urlParams = new URLSearchParams(window.location.search);
const IS_ADMIN = urlParams.get('mode') === 'admin';

const STAFF = [
    { name: "Juliana", dept: "Investment" }
    { name: "Blessingjoy", dept: "University" },
    { name: "Ikechukwu", dept: "Investment" },
    { name: "Ayo", dept: "Investment" },
    { name: "Esther", dept: "University" },
    { name: "Paschaline", dept: "University" },
    { name: "Deborah", dept: "Investment" },
    { name: "Lizzy", dept: "Investment" },
];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

let currentWeekKey = "";
let currentData = {};
let draggedItem = null;

// Initialize
if (IS_ADMIN) {
    document.getElementById('admin-controls').style.display = 'flex';
    document.getElementById('main-body').classList.add('admin-mode');
}

// --- 2. DATE LOGIC (Month Rollover Corrected) ---
function getWeekRange(offsetWeeks = 0) {
    const d = new Date();
    const day = d.getDay(); 
    const diffToSun = d.getDate() - day + (offsetWeeks * 7);
    const mon = new Date(new Date().setDate(diffToSun + 1));
    const fri = new Date(new Date().setDate(diffToSun + 5));
    
    const optionsFull = { month: 'long', day: 'numeric' };
    const optionsDay = { day: 'numeric' };
    const year = fri.getFullYear();

    if (mon.getMonth() !== fri.getMonth()) {
        // Different months: June 29 - July 3, 2026
        return `${mon.toLocaleDateString('en-US', optionsFull)} - ${fri.toLocaleDateString('en-US', optionsFull)}, ${year}`;
    }
    // Same month: June 8 - 12, 2026
    return `${mon.toLocaleDateString('en-US', optionsFull)} - ${fri.getDate()}, ${year}`;
}

function getDayNumbers() {
    const d = new Date();
    const day = d.getDay();
    const diffToSun = d.getDate() - day;
    return DAYS.map((_, i) => new Date(new Date().setDate(diffToSun + i + 1)).getDate());
}

// --- 3. CORE ENGINE ---
function generateNew() {
    if (!IS_ADMIN) return;
    currentWeekKey = getWeekRange(0);
    currentData = {};
    
    STAFF.forEach(s => {
        currentData[s.name] = { Monday: "Office", Tuesday: "Home", Wednesday: "Home", Thursday: "Home", Friday: "Office" };
    });

    // Univ coverage: exactly 1 per mid-day
    const univ = STAFF.filter(s => s.dept === "University");
    const mid = ["Tuesday", "Wednesday", "Thursday"].sort(() => Math.random() - 0.5);
    univ.forEach((s, i) => currentData[s.name][mid[i]] = "Office");

    // Invest coverage
    const invest = STAFF.filter(s => s.dept === "Investment");
    const pool = ["Tuesday", "Wednesday", "Thursday", "Tuesday", "Wednesday"].sort(() => Math.random() - 0.5);
    invest.forEach((s, i) => currentData[s.name][pool[i]] = "Office");

    renderTable();
    autoSync();
}

function renderTable() {
    document.getElementById('display-date-range').innerText = currentWeekKey;
    const dayNums = getDayNumbers();
    const thead = document.getElementById('table-head-days');
    thead.innerHTML = `<th class="name-cell">Staff Name</th>` + 
                     DAYS.map((d, i) => `<th>${d} ${dayNums[i]}</th>`).join("") + 
                     `<th class="counter-header" data-html2canvas-ignore>Home Days</th>`;

    const tbody = document.getElementById('schedule-body');
    tbody.innerHTML = "";
    
    STAFF.forEach(person => {
        const row = document.createElement('tr');
        row.innerHTML = `<td class="name-cell">${person.name}<span class="dept-label">${person.dept}</span></td>`;
        
        let homeCount = 0;
        DAYS.forEach(day => {
            const status = currentData[person.name][day];
            if (status === 'Home') homeCount++;
            
            const td = document.createElement('td');
            td.dataset.staff = person.name;
            td.dataset.day = day;

            const badge = document.createElement('div');
            badge.className = `badge ${status === 'Office' ? 'status-office' : 'status-home'}`;
            badge.innerText = status;

            if (IS_ADMIN) {
                badge.draggable = true;
                badge.addEventListener('dragstart', () => draggedItem = { staff: person.name, day: day });
                td.addEventListener('dragover', (e) => e.preventDefault());
                td.addEventListener('drop', () => {
                    if (draggedItem && draggedItem.staff === td.dataset.staff) {
                        const temp = currentData[person.name][td.dataset.day];
                        currentData[person.name][td.dataset.day] = currentData[person.name][draggedItem.day];
                        currentData[person.name][draggedItem.day] = temp;
                        renderTable(); autoSync();
                    }
                });
                badge.onclick = () => {
                    currentData[person.name][day] = (status === 'Office' ? 'Home' : 'Office');
                    renderTable(); autoSync();
                };
            }
            td.appendChild(badge);
            row.appendChild(td);
        });

        const countTd = document.createElement('td');
        countTd.className = "counter-cell";
        countTd.setAttribute('data-html2canvas-ignore', 'true');
        const countClass = (homeCount === 2) ? 'count-ok' : 'count-bad';
        countTd.innerHTML = `<span class="counter-val ${countClass}">${homeCount}</span><span class="counter-label">Home Days</span>`;
        row.appendChild(countTd);
        tbody.appendChild(row);
    });
    lucide.createIcons();
}

// --- 4. CLOUD & EXPORT ---
async function autoSync() {
    if (!IS_ADMIN) return;
    const statusEl = document.getElementById('sync-status');
    statusEl.innerHTML = `<i data-lucide="refresh-cw" class="spin" size="12"></i> Saving to cloud...`;
    lucide.createIcons();
    try {
        await fetch(SCRIPT_URL, { 
            method: "POST", 
            body: JSON.stringify({ weekKey: currentWeekKey, timestamp: new Date().toISOString(), data: currentData })
        });
        statusEl.innerHTML = `<i data-lucide="cloud-check" size="12"></i> Synced with Google Sheets`;
        loadHistory(false);
    } catch (e) { statusEl.innerHTML = `Sync Error`; }
    lucide.createIcons();
}

async function loadHistory(updateTable = true) {
    const container = document.getElementById('history-container');
    try {
        const resp = await fetch(SCRIPT_URL);
        const history = await resp.json();
        if (history.length === 0 && updateTable) { if(IS_ADMIN) generateNew(); return; }
        
        container.innerHTML = "";
        const currentRange = getWeekRange(0);
        let foundCurrent = false;

        history.forEach(item => {
            if (item.weekKey === currentRange) foundCurrent = true;
            const card = document.createElement('div');
            card.className = `history-card ${item.weekKey === currentWeekKey ? 'active' : ''}`;
            card.onclick = () => { currentWeekKey = item.weekKey; currentData = item.data; renderTable(); };
            card.innerHTML = `<i data-lucide="calendar"></i><div class="history-info">${item.weekKey}</div>`;
            container.appendChild(card);
        });

        if (updateTable) {
            if (foundCurrent) {
                const latest = history.find(h => h.weekKey === currentRange);
                currentWeekKey = latest.weekKey; currentData = latest.data; renderTable();
            } else if (IS_ADMIN) { generateNew(); }
        }
        lucide.createIcons();
    } catch (e) { container.innerHTML = "<p>Cloud history currently unavailable.</p>"; }
}

async function downloadImage() {
    const zone = document.getElementById('capture-zone');
    const canvas = await html2canvas(zone, { scale: 2, backgroundColor: '#ffffff' });
    const a = document.createElement('a');
    a.download = `Schedule_${currentWeekKey.replace(/ /g, '_')}.jpg`;
    a.href = canvas.toDataURL("image/jpeg", 0.9);
    a.click();
}

async function shareWhatsApp() {
    const zone = document.getElementById('capture-zone');
    const canvas = await html2canvas(zone, { scale: 2, backgroundColor: '#ffffff' });
    canvas.toBlob(async blob => {
        const file = new File([blob], `Schedule.jpg`, { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Lifecard Schedule', text: `Hybrid Schedule for ${currentWeekKey}` });
        } else { downloadImage(); }
    }, 'image/jpeg', 0.9);
}

function shareGmail() {
    const subject = encodeURIComponent(`Hybrid Schedule: ${currentWeekKey}`);
    let body = `Hello Team,\n\nHere is the schedule for ${currentWeekKey}:\n\n`;
    STAFF.forEach(s => {
        const office = DAYS.filter(d => currentData[s.name][d] === 'Office');
        body += `${s.name}: ${office.join(", ")}\n`;
    });
    downloadImage();
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(urlParams.get('to') || '')}&su=${subject}&body=${encodeURIComponent(body)}`, '_blank');
}

window.onload = () => {
    loadHistory(true);
    lucide.createIcons();
};