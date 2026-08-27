(function () {
  "use strict";

  var STORAGE_KEY = "logbook.entries.v1";

  var TIME_LABELS = {
    morning: "Morning",
    noon: "Noon",
    evening: "Evening",
    night: "Night",
  };

  var todayEl = document.getElementById("today");
  var form = document.getElementById("log-form");
  var textarea = document.getElementById("entry-text");
  var formStatus = document.getElementById("form-status");
  var listEl = document.getElementById("entries-list");
  var emptyMessage = document.getElementById("empty-message");
  var exportBtn = document.getElementById("export-btn");
  var importInput = document.getElementById("import-input");
  var clearBtn = document.getElementById("clear-btn");
  var toolsStatus = document.getElementById("tools-status");
  var timeOfDayGroup = document.getElementById("time-of-day-group");
  var timeOfDayHint = document.getElementById("time-of-day-hint");
  var filterBar = document.getElementById("filter-bar");
  var rangesForm = document.getElementById("ranges-form");
  var rangesStatus = document.getElementById("ranges-status");
  var rangesResetBtn = document.getElementById("ranges-reset-btn");
  var rangeInputs = {
    morning: document.getElementById("range-morning"),
    noon: document.getElementById("range-noon"),
    evening: document.getElementById("range-evening"),
    night: document.getElementById("range-night"),
  };

  var RANGES_KEY = "logbook.timeRanges.v1";

  // Default start times, in minutes since midnight. Each period runs until
  // the next one starts (night wraps past midnight back to morning).
  var DEFAULT_RANGES = {
    morning: 5 * 60,   // 5:00am
    noon: 12 * 60,     // 12:00pm
    evening: 17 * 60,  // 5:00pm
    night: 21 * 60,    // 9:00pm
  };

  function loadTimeRanges() {
    try {
      var raw = localStorage.getItem(RANGES_KEY);
      if (!raw) return clone(DEFAULT_RANGES);
      var parsed = JSON.parse(raw);
      var ranges = {};
      var ok = true;
      Object.keys(DEFAULT_RANGES).forEach(function (key) {
        var val = parsed[key];
        if (typeof val === "number" && val >= 0 && val < 24 * 60) {
          ranges[key] = val;
        } else {
          ok = false;
        }
      });
      return ok ? ranges : clone(DEFAULT_RANGES);
    } catch (err) {
      console.error("Failed to load time ranges", err);
      return clone(DEFAULT_RANGES);
    }
  }

  function saveTimeRanges(ranges) {
    localStorage.setItem(RANGES_KEY, JSON.stringify(ranges));
  }

  function clone(obj) {
    var copy = {};
    Object.keys(obj).forEach(function (k) { copy[k] = obj[k]; });
    return copy;
  }

  function minutesToTimeInput(minutes) {
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function timeInputToMinutes(value) {
    var parts = (value || "").split(":");
    if (parts.length !== 2) return null;
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  var currentRanges = loadTimeRanges();

  var selectedTimeOfDay = null; // for the add-entry form; null = unspecified
  var timeOfDayOverridden = false; // true once the user manually picks/clears a tag
  var activeFilter = "all";
  var editingId = null;

  function autoTimeOfDay(date) {
    var t = date.getHours() * 60 + date.getMinutes();
    var entries = Object.keys(currentRanges)
      .map(function (key) { return { key: key, start: currentRanges[key] }; })
      .sort(function (a, b) { return a.start - b.start; });
    // Default to the last (latest) period, in case t falls before the
    // earliest start — that means we're still in the period that wraps
    // around from the previous day (e.g. night, before morning starts).
    var result = entries[entries.length - 1].key;
    entries.forEach(function (entry) {
      if (t >= entry.start) result = entry.key;
    });
    return result;
  }

  function formatHeaderDate(date) {
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatEntryDate(iso) {
    var date = new Date(iso);
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }) + " at " + date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function loadEntries() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(function (e) {
          return e && typeof e.id === "string" && typeof e.text === "string" && typeof e.createdAt === "string";
        })
        .map(function (e) {
          return {
            id: e.id,
            text: e.text,
            createdAt: e.createdAt,
            timeOfDay: TIME_LABELS.hasOwnProperty(e.timeOfDay) ? e.timeOfDay : null,
          };
        });
    } catch (err) {
      console.error("Failed to load entries", err);
      return [];
    }
  }

  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function announce(el, message) {
    el.textContent = message;
  }

  function makeId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  // --- Time-of-day picker (add-entry form) ---

  timeOfDayGroup.addEventListener("click", function (event) {
    var btn = event.target.closest(".segment");
    if (!btn) return;
    var time = btn.getAttribute("data-time");
    // toggle: clicking the already-selected option clears it
    selectedTimeOfDay = selectedTimeOfDay === time ? null : time;
    timeOfDayOverridden = true; // user has taken control; stop auto-refreshing
    timeOfDayHint.style.display = "none";
    updateTimeOfDayButtons();
  });

  function refreshAutoTimeOfDay() {
    if (timeOfDayOverridden) return;
    selectedTimeOfDay = autoTimeOfDay(new Date());
    updateTimeOfDayButtons();
  }

  function updateTimeOfDayButtons() {
    var buttons = timeOfDayGroup.querySelectorAll(".segment");
    buttons.forEach(function (btn) {
      var isSelected = btn.getAttribute("data-time") === selectedTimeOfDay;
      btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
  }

  // --- Time-of-day range settings ---

  function populateRangeInputs() {
    Object.keys(rangeInputs).forEach(function (key) {
      rangeInputs[key].value = minutesToTimeInput(currentRanges[key]);
    });
  }

  rangesForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var next = {};
    var invalid = false;

    Object.keys(rangeInputs).forEach(function (key) {
      var minutes = timeInputToMinutes(rangeInputs[key].value);
      if (minutes === null) invalid = true;
      next[key] = minutes;
    });

    if (invalid) {
      announce(rangesStatus, "Please set a time for each period.");
      return;
    }

    // require four distinct start times so every period is reachable
    var uniqueValues = Object.keys(next).map(function (k) { return next[k]; });
    var uniqueCount = new Set(uniqueValues).size;
    if (uniqueCount !== uniqueValues.length) {
      announce(rangesStatus, "Each period needs its own start time.");
      return;
    }

    currentRanges = next;
    saveTimeRanges(currentRanges);
    timeOfDayOverridden = false;
    timeOfDayHint.style.display = "";
    refreshAutoTimeOfDay();
    announce(rangesStatus, "Time ranges saved.");
  });

  rangesResetBtn.addEventListener("click", function () {
    currentRanges = clone(DEFAULT_RANGES);
    saveTimeRanges(currentRanges);
    populateRangeInputs();
    timeOfDayOverridden = false;
    timeOfDayHint.style.display = "";
    refreshAutoTimeOfDay();
    announce(rangesStatus, "Time ranges reset to defaults.");
  });

  populateRangeInputs();

  // --- Filter chips (entries section) ---

  filterBar.addEventListener("click", function (event) {
    var btn = event.target.closest(".filter-chip");
    if (!btn) return;
    activeFilter = btn.getAttribute("data-filter");
    updateFilterButtons();
    render();
  });

  function updateFilterButtons() {
    var chips = filterBar.querySelectorAll(".filter-chip");
    chips.forEach(function (chip) {
      var isActive = chip.getAttribute("data-filter") === activeFilter;
      chip.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  // --- Rendering ---

  function render() {
    var entries = loadEntries();
    entries.sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    var visibleEntries = activeFilter === "all"
      ? entries
      : entries.filter(function (e) { return e.timeOfDay === activeFilter; });

    listEl.innerHTML = "";

    if (entries.length === 0) {
      emptyMessage.textContent = "No entries yet. Add your first one above.";
      emptyMessage.style.display = "";
      return;
    }

    if (visibleEntries.length === 0) {
      emptyMessage.textContent = "No entries for " + (TIME_LABELS[activeFilter] || activeFilter) + ".";
      emptyMessage.style.display = "";
      return;
    }

    emptyMessage.style.display = "none";

    visibleEntries.forEach(function (entry) {
      listEl.appendChild(entry.id === editingId ? buildEditRow(entry) : buildEntryRow(entry));
    });
  }

  function buildEntryRow(entry) {
    var li = document.createElement("li");
    li.className = "entry";

    var meta = document.createElement("div");
    meta.className = "entry-meta";

    var metaLeft = document.createElement("div");
    metaLeft.className = "entry-meta-left";

    var dateSpan = document.createElement("span");
    dateSpan.className = "entry-date";
    dateSpan.textContent = formatEntryDate(entry.createdAt);
    metaLeft.appendChild(dateSpan);

    if (entry.timeOfDay) {
      var badge = document.createElement("span");
      badge.className = "entry-time-badge";
      badge.textContent = TIME_LABELS[entry.timeOfDay];
      metaLeft.appendChild(badge);
    }

    meta.appendChild(metaLeft);
    li.appendChild(meta);

    var textP = document.createElement("p");
    textP.className = "entry-text";
    textP.textContent = entry.text;
    li.appendChild(textP);

    var actions = document.createElement("div");
    actions.className = "entry-actions";

    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "entry-edit";
    editBtn.textContent = "Edit";
    editBtn.setAttribute("aria-label", "Edit entry from " + formatEntryDate(entry.createdAt));
    editBtn.addEventListener("click", function () {
      editingId = entry.id;
      render();
    });
    actions.appendChild(editBtn);

    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "entry-delete";
    delBtn.textContent = "Delete";
    delBtn.setAttribute("aria-label", "Delete entry from " + formatEntryDate(entry.createdAt));
    delBtn.addEventListener("click", function () {
      deleteEntry(entry.id);
    });
    actions.appendChild(delBtn);

    li.appendChild(actions);

    return li;
  }

  function buildEditRow(entry) {
    var li = document.createElement("li");
    li.className = "entry";

    var meta = document.createElement("div");
    meta.className = "entry-meta";
    var dateSpan = document.createElement("span");
    dateSpan.className = "entry-date";
    dateSpan.textContent = formatEntryDate(entry.createdAt);
    meta.appendChild(dateSpan);
    li.appendChild(meta);

    var editLabel = document.createElement("label");
    var editId = "edit-text-" + entry.id;
    editLabel.setAttribute("for", editId);
    editLabel.className = "visually-hidden";
    editLabel.textContent = "Edit entry text";
    li.appendChild(editLabel);

    var editTextarea = document.createElement("textarea");
    editTextarea.id = editId;
    editTextarea.className = "entry-edit-textarea";
    editTextarea.rows = 4;
    editTextarea.value = entry.text;
    li.appendChild(editTextarea);

    var fieldset = document.createElement("fieldset");
    fieldset.className = "time-of-day-field";
    var legend = document.createElement("legend");
    legend.className = "visually-hidden";
    legend.textContent = "Time of day";
    fieldset.appendChild(legend);

    var segGroup = document.createElement("div");
    segGroup.className = "segmented";
    var editTimeOfDay = entry.timeOfDay;

    Object.keys(TIME_LABELS).forEach(function (key) {
      var segBtn = document.createElement("button");
      segBtn.type = "button";
      segBtn.className = "segment";
      segBtn.setAttribute("data-time", key);
      segBtn.setAttribute("aria-pressed", key === editTimeOfDay ? "true" : "false");
      segBtn.textContent = TIME_LABELS[key];
      segBtn.addEventListener("click", function () {
        editTimeOfDay = editTimeOfDay === key ? null : key;
        segGroup.querySelectorAll(".segment").forEach(function (b) {
          b.setAttribute("aria-pressed", b.getAttribute("data-time") === editTimeOfDay ? "true" : "false");
        });
      });
      segGroup.appendChild(segBtn);
    });
    fieldset.appendChild(segGroup);
    li.appendChild(fieldset);

    var actions = document.createElement("div");
    actions.className = "entry-actions";

    var saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", function () {
      var newText = editTextarea.value.trim();
      if (!newText) {
        editTextarea.focus();
        return;
      }
      updateEntry(entry.id, newText, editTimeOfDay);
    });
    actions.appendChild(saveBtn);

    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", function () {
      editingId = null;
      render();
    });
    actions.appendChild(cancelBtn);

    li.appendChild(actions);

    return li;
  }

  // --- CRUD ---

  function deleteEntry(id) {
    var entries = loadEntries().filter(function (e) {
      return e.id !== id;
    });
    saveEntries(entries);
    if (editingId === id) editingId = null;
    render();
    announce(toolsStatus, "Entry deleted.");
  }

  function addEntry(text, timeOfDay) {
    var entries = loadEntries();
    entries.push({
      id: makeId(),
      text: text,
      createdAt: new Date().toISOString(),
      timeOfDay: timeOfDay || null,
    });
    saveEntries(entries);
    render();
  }

  function updateEntry(id, text, timeOfDay) {
    var entries = loadEntries();
    var idx = entries.findIndex(function (e) { return e.id === id; });
    if (idx === -1) return;
    entries[idx].text = text;
    entries[idx].timeOfDay = timeOfDay || null;
    saveEntries(entries);
    editingId = null;
    render();
    announce(toolsStatus, "Entry updated.");
  }

  // --- Form submit ---

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var text = textarea.value.trim();
    if (!text) {
      announce(formStatus, "Please write something before adding an entry.");
      return;
    }
    addEntry(text, selectedTimeOfDay);
    textarea.value = "";
    timeOfDayOverridden = false;
    timeOfDayHint.style.display = "";
    refreshAutoTimeOfDay();
    textarea.focus();
    announce(formStatus, "Entry added.");
  });

  // --- Backup: export / import / clear ---

  exportBtn.addEventListener("click", function () {
    var entries = loadEntries();
    var blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = "logbook-export-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    announce(toolsStatus, "Logs exported as a JSON file.");
  });

  importInput.addEventListener("change", function () {
    var file = importInput.files && importInput.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      try {
        var imported = JSON.parse(reader.result);
        if (!Array.isArray(imported)) {
          throw new Error("File does not contain a list of entries.");
        }
        var valid = imported.filter(function (e) {
          return e && typeof e.text === "string";
        }).map(function (e) {
          return {
            id: typeof e.id === "string" ? e.id : makeId(),
            text: e.text,
            createdAt: typeof e.createdAt === "string" ? e.createdAt : new Date().toISOString(),
            timeOfDay: TIME_LABELS.hasOwnProperty(e.timeOfDay) ? e.timeOfDay : null,
          };
        });

        var existing = loadEntries();
        var existingIds = new Set(existing.map(function (e) { return e.id; }));
        var merged = existing.slice();
        var addedCount = 0;
        valid.forEach(function (e) {
          if (!existingIds.has(e.id)) {
            merged.push(e);
            existingIds.add(e.id);
            addedCount++;
          }
        });

        saveEntries(merged);
        render();
        announce(toolsStatus, "Imported " + addedCount + " new entr" + (addedCount === 1 ? "y" : "ies") + ".");
      } catch (err) {
        console.error("Import failed", err);
        announce(toolsStatus, "Import failed: the file was not a valid logbook export.");
      } finally {
        importInput.value = "";
      }
    };
    reader.onerror = function () {
      announce(toolsStatus, "Could not read the selected file.");
      importInput.value = "";
    };
    reader.readAsText(file);
  });

  clearBtn.addEventListener("click", function () {
    var entries = loadEntries();
    if (entries.length === 0) {
      announce(toolsStatus, "There are no entries to clear.");
      return;
    }
    var confirmed = window.confirm(
      "Delete all " + entries.length + " log entr" + (entries.length === 1 ? "y" : "ies") + "? This cannot be undone. Consider exporting a backup first."
    );
    if (!confirmed) return;
    saveEntries([]);
    editingId = null;
    render();
    announce(toolsStatus, "All entries cleared.");
  });

  function updateHeaderDate() {
    todayEl.textContent = formatHeaderDate(new Date());
  }

  updateHeaderDate();
  refreshAutoTimeOfDay();
  render();

  // Keep the suggestion current if the tab stays open across a boundary
  // (e.g. past 5am or noon), as long as the user hasn't overridden it.
  setInterval(refreshAutoTimeOfDay, 60 * 1000);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function (err) {
        console.warn("Service worker registration failed", err);
      });
    });
  }
})();
