var EC_SCHEDULE = [
    { day: "Sun", open: false, shifts: [] },
    { day: "Mon", open: true,  shifts: [{from:"08:00", to:"17:00"}] },
    { day: "Tue", open: true,  shifts: [{from:"08:00", to:"17:00"}] },
    { day: "Wed", open: true,  shifts: [{from:"08:00", to:"17:00"}] },
    { day: "Thu", open: true,  shifts: [{from:"08:00", to:"17:00"}] },
    { day: "Fri", open: true,  shifts: [{from:"08:00", to:"17:00"}] },
    { day: "Sat", open: true,  shifts: [{from:"09:00", to:"15:00"}] }
];
var _ecYear, _ecMonth;
(function(){
    var now = new Date();
    _ecYear  = now.getFullYear();
    _ecMonth = now.getMonth();
})();
var EC_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function fmt12(t) {
    if (!t) return "";
    var pts = t.split(":");
    var h = parseInt(pts[0], 10), m = pts[1];
    var ampm = h >= 12 ? "pm" : "am";
    h = h % 12;
    if (h === 0) h = 12;
    return h + ":" + m + " " + ampm;
}
function renderEcSchedule() {
    var pillsEl = document.getElementById("ecDayPills");
    if(pillsEl) {
        pillsEl.innerHTML = "";
        EC_SCHEDULE.forEach(function(s) {
            var pill = document.createElement("div");
            pill.className = "ec-day-pill " + (s.open ? "open" : "closed");
            pill.innerHTML = "<span class=\"ec-day-pill-dot\"></span>" + s.day;
            pillsEl.appendChild(pill);
        });
    }
    renderEcCalendar();
    var listEl = document.getElementById("ecHoursList");
    if(listEl) {
        listEl.innerHTML = "<h4>Opening Hours</h4>";
        EC_SCHEDULE.forEach(function(s) {
            var row = document.createElement("div");
            row.className = "ec-hour-row";
            var shiftsHtml = s.open && s.shifts && s.shifts.length 
                ? s.shifts.map(function(sh) { return fmt12(sh.from) + " &ndash; " + fmt12(sh.to); }).join("<br>")
                : "<span class=\"ec-hour-closed\">Closed</span>";
            row.innerHTML = "<span class=\"ec-hour-day\">" + s.day + "</span><span class=\"ec-hour-time\" style=\"line-height:1.4;\">" + shiftsHtml + "</span>";
            listEl.appendChild(row);
        });
    }
}
function renderEcCalendar() {
    var lbl = document.getElementById("ecCalLabel");
    if(lbl) lbl.textContent = EC_MONTHS[_ecMonth] + " " + _ecYear;
    var openDows = EC_SCHEDULE.map(function(s, i){ return s.open ? i : -1; }).filter(function(i){ return i !== -1; });
    var firstDow = new Date(_ecYear, _ecMonth, 1).getDay();
    var daysInMonth = new Date(_ecYear, _ecMonth + 1, 0).getDate();
    var today = new Date();
    var grid = document.getElementById("ecCalGrid");
    if(!grid) return;
    grid.innerHTML = "";
    for (var e = 0; e < firstDow; e++) {
        var blank = document.createElement("div");
        blank.className = "ec-cal-cell";
        grid.appendChild(blank);
    }
    for (var d = 1; d <= daysInMonth; d++) {
        var cell = document.createElement("div");
        var dow = new Date(_ecYear, _ecMonth, d).getDay();
        var isOpen = openDows.indexOf(dow) !== -1;
        var isToday = today.getFullYear() === _ecYear && today.getMonth() === _ecMonth && today.getDate() === d;
        var cls = "ec-cal-cell";
        if (isOpen) cls += " ec-open";
        if (isToday) cls += " ec-today";
        cell.className = cls;
        cell.innerHTML = "<span>" + d + "</span>";
        grid.appendChild(cell);
    }
}
function ecCalPrev() { _ecMonth--; if (_ecMonth < 0) { _ecMonth = 11; _ecYear--; } renderEcCalendar(); }
function ecCalNext() { _ecMonth++; if (_ecMonth > 11) { _ecMonth = 0; _ecYear++; } renderEcCalendar(); }

var _origOpenModal = openModal;
openModal = function(id) {
    if (id === "scheduleModal") {
        renderScheduleModalInputs();
        document.getElementById("scheduleModal").classList.add("active");
        return;
    }
    _origOpenModal(id);
};

var _workingSchedule = [];
function renderScheduleModalInputs() {
    var rows = document.getElementById("scheduleInputRows");
    rows.innerHTML = "";
    _workingSchedule = JSON.parse(JSON.stringify(EC_SCHEDULE));
    _workingSchedule.forEach(function(s, d) {
        if(!s.shifts) s.shifts = [];
        var row = document.createElement("div");
        row.style.cssText = "border: 1px solid #dde3f0; border-radius: 8px; padding: 12px; margin-bottom: 15px; background: #fff;";
        var header = document.createElement("div");
        header.style.cssText = "display: flex; justify-content: space-between; align-items: center;";
        var dsbl = s.open ? "" : "disabled";
        header.innerHTML = "<label style=\"font-weight:600; font-size:14px; margin:0; display:flex; align-items:center; gap:8px;\"><input type=\"checkbox\" " + (s.open ? "checked" : "") + " onchange=\"wSchedToggle(" + d + ", this)\"> " + s.day + "</label><button type=\"button\" class=\"btn-outline-small\" style=\"font-size:12px; padding:4px 8px;\" onclick=\"wSchedAddShift(" + d + ")\" id=\"addShiftBtn" + d + "\" " + dsbl + ">+ Add Shift</button>";
        var shiftCont = document.createElement("div");
        shiftCont.id = "wSchedShifts_" + d;
        shiftCont.style.cssText = "margin-top: 10px; display:flex; flex-direction:column; gap:8px;";
        row.appendChild(header);
        row.appendChild(shiftCont);
        rows.appendChild(row);
        setTimeout(function(){ window.renderWorkingShifts(d); }, 1);
    });
}
window.wSchedToggle = function(d, cb) {
    _workingSchedule[d].open = cb.checked;
    document.getElementById("addShiftBtn" + d).disabled = !cb.checked;
    window.renderWorkingShifts(d);
};
window.wSchedAddShift = function(d) {
    _workingSchedule[d].shifts.push({ from: "08:00", to: "17:00" });
    window.renderWorkingShifts(d);
};
window.wSchedRemoveShift = function(d, shIdx) {
    _workingSchedule[d].shifts.splice(shIdx, 1);
    window.renderWorkingShifts(d);
};
window.wSchedUpdate = function(d, shIdx, field, val) {
    _workingSchedule[d].shifts[shIdx][field] = val;
};
window.renderWorkingShifts = function(d) {
    var cont = document.getElementById("wSchedShifts_" + d);
    if (!cont) return;
    cont.innerHTML = "";
    var s = _workingSchedule[d];
    if (!s.open) {
        cont.innerHTML = "<p style=\"font-size:12px; color:#bbb; margin:0; font-style:italic;\">Closed on this day.</p>";
        return;
    }
    if (s.shifts.length === 0) {
        cont.innerHTML = "<p style=\"font-size:12px; color:#bbb; margin:0; font-style:italic;\">No shifts added.</p>";
        return;
    }
    s.shifts.forEach(function(sh, shIdx) {
        var shiftDiv = document.createElement("div");
        shiftDiv.style.cssText = "display:flex; gap:8px; align-items:center;";
        shiftDiv.innerHTML = 
            "<input type=\"time\" style=\"flex:1; border:1px solid #dde3f0; border-radius:6px; padding:5px 8px; font-size:12px;\" value=\"" + sh.from + "\" onchange=\"wSchedUpdate(" + d + ", " + shIdx + ", 'from', this.value)\">" +
            "<span style=\"color:#666; font-size:12px;\">to</span>" +
            "<input type=\"time\" style=\"flex:1; border:1px solid #dde3f0; border-radius:6px; padding:5px 8px; font-size:12px;\" value=\"" + sh.to + "\" onchange=\"wSchedUpdate(" + d + ", " + shIdx + ", 'to', this.value)\">" +
            "<button type=\"button\" style=\"background:#ffe8e8; color:#d32f2f; border:none; border-radius:6px; width:28px; height:28px; cursor:pointer; font-weight:bold;\" onclick=\"wSchedRemoveShift(" + d + ", " + shIdx + ")\">&times;</button>";
        cont.appendChild(shiftDiv);
    });
};
window.saveSchedule = async function() {
    var btn = document.querySelector(".modal-save-btn");
    var oldText = "";
    if (btn) { oldText = btn.textContent; btn.textContent = "Saving..."; }
    try {
        EC_SCHEDULE = JSON.parse(JSON.stringify(_workingSchedule));
        await CentersAPI.updateMyProfile({ schedule: EC_SCHEDULE });
        renderEcSchedule();
        closeModal("scheduleModal");
    } catch(err) {
        alert("Failed to save schedule.");
    } finally {
        if (btn) btn.textContent = oldText;
    }
};
(async function() {
    try {
        var center = await CentersAPI.getMyProfile();
        if (center && center.schedule) {
            var parsed = typeof center.schedule === "string" ? JSON.parse(center.schedule) : center.schedule;
            if (Array.isArray(parsed) && parsed.length > 0) {
                EC_SCHEDULE = parsed.map(function(s) {
                    if (!s.shifts) {
                        s.shifts = [];
                        if (s.from && s.to) s.shifts.push({ from: s.from, to: s.to });
                    }
                    return s;
                });
            }
        }
    } catch(e) {}
    renderEcSchedule();
})();