(function () {
  "use strict";

  const STORAGE_KEY = "gcrmv5";
  const CONFIG_ID = "main_config";
  const SUPABASE_URL = "https://eioindyucvbkvybbevmc.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_VPBm_1F6jl7dBMHJi1jokA_UOdcW6jZ";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const REPORT_FIELDS = [
    { key: "huntingMessagesSent", label: "Hunting Messages Sent" },
    { key: "huntingRequestsSent", label: "Hunting Requests Sent" },
    { key: "postingOnIds", label: "Posting on IDs" },
    { key: "totalIds", label: "Total IDs" },
    { key: "deposit", label: "Deposit" },
    { key: "newPlayers", label: "New Players" }
  ];
  const PERMISSIONS = [
    "View Entries", "Add Paid Recharge", "Add Freeplay", "Add Redeem", "Edit Entries",
    "Delete Entries", "View Dashboard", "View Games", "View Vendors",
    "Export / Backup", "Manage Agents", "Manage Settings", "Close Shift"
  ];
  const AGENT_PANEL_PERMISSIONS = ["View Entries", "Add Paid Recharge", "Add Freeplay", "Add Redeem"];
  const ROLE_DEFAULTS = {
    owner: PERMISSIONS.slice(),
    admin: PERMISSIONS.slice(),
    manager: PERMISSIONS.filter((item) => !["Delete Entries", "Manage Agents", "Manage Settings"].includes(item)),
    supervisor: [...AGENT_PANEL_PERMISSIONS, "View Dashboard", "View Games", "Close Shift"],
    agent: AGENT_PANEL_PERMISSIONS.slice()
  };
  const SQL_SCRIPT = `drop policy if exists "Allow all" on crm_config;
drop policy if exists "Allow all" on entries;
drop policy if exists "Allow all" on closed_shifts;
drop policy if exists "Allow all" on attendance;

create table if not exists crm_config (
  id text primary key,
  payload text,
  updated_at timestamptz default now()
);

create table if not exists entries (
  id text primary key,
  type text, date text, shift text,
  shift_session text default 'Current',
  agent text, player_name text, player_url text,
  game_id text, game_name text,
  deposit numeric default 0, recharge numeric default 0,
  promo numeric default 0, fp_amount numeric default 0,
  rd_credits numeric default 0, cashout_paid numeric default 0,
  is_new_player boolean default false,
  cust_tag text, pay_method_id text,
  legal_name text, contact text, email text,
  created_at timestamptz default now()
);

create table if not exists closed_shifts (
  id text primary key,
  label text, date text, closed_at text, summary text,
  created_at timestamptz default now()
);

create table if not exists attendance (
  id text primary key,
  agent_id text, agent_name text, date text,
  check_in text, check_out text,
  duration_mins int, status text default 'present',
  leave_reason text,
  created_at timestamptz default now()
);

alter table crm_config enable row level security;
alter table entries enable row level security;
alter table closed_shifts enable row level security;
alter table attendance enable row level security;

create policy "Allow all" on crm_config for all using (true) with check (true);
create policy "Allow all" on entries for all using (true) with check (true);
create policy "Allow all" on closed_shifts for all using (true) with check (true);
create policy "Allow all" on attendance for all using (true) with check (true);`;

  const IDS = {
    shiftMorning: "shift-morning",
    shiftAfternoon: "shift-afternoon",
    shiftNight: "shift-night",
    agentAli: "agent-ali-hassan",
    agentSara: "agent-sara-ahmed",
    agentUsman: "agent-usman-malik",
    cashApp: "pay-cash-app",
    zelle: "pay-zelle",
    venmo: "pay-venmo",
    gameFish: "game-fish-table",
    gameJuwa: "game-juwa",
    gameOrion: "game-orion-stars",
    vendorFastPay: "vendor-fastpay",
    gameVendorJuwa: "game-vendor-juwa",
    gameVendorOrion: "game-vendor-orion"
  };

  let DB = null;
  let S = null;
  let IS_ONLINE = navigator.onLine;
  let syncQueue = [];
  let syncBusy = false;
  let autoPullTimer = null;
  let clockTimer = null;
  let restoreFileText = "";
  let lastSavedStatus = "";

  const app = document.getElementById("app");
  const boot = document.getElementById("boot");
  const bootStatus = document.getElementById("bootStatus");

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    return `${prefix || "id"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function today() {
    const d = new Date();
    return `${pad(d.getDate())}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
  }

  function isoToLabel(value) {
    if (!value) return "";
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return `${pad(d.getDate())}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
  }

  function parseDateInput(value) {
    const raw = String(value || "").trim();
    if (!raw) return todayISO();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\d{1,2})[-\s/]([A-Za-z]+)[-\s/](\d{4})$/);
    if (match) {
      const day = Math.max(1, Math.min(31, Number(match[1])));
      const monthText = match[2].toLowerCase();
      const month = MONTHS_FULL.findIndex((item) => item.toLowerCase() === monthText || item.toLowerCase().slice(0, 3) === monthText.slice(0, 3));
      if (month >= 0) return `${match[3]}-${pad(month + 1)}-${pad(day)}`;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
    return todayISO();
  }

  function monthKey(date) {
    const d = date ? new Date(`${date}T00:00:00`) : new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }

  function monthDays(key) {
    const [year, month] = String(key || monthKey()).split("-").map(Number);
    const days = [];
    const d = new Date(year, month - 1, 1);
    while (d.getMonth() === month - 1) {
      days.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      d.setDate(d.getDate() + 1);
    }
    return days;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[ch]));
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function fmt$(value) {
    return `$${num(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function fmtPKR(value) {
    return `PKR ${num(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  function fmtPlain(value) {
    return num(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function uniqueList(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function staffDefaultAdminAccess(role) {
    return ["owner", "admin"].includes(role);
  }

  function staffPermsForRole(role, adminAccess) {
    const base = AGENT_PANEL_PERMISSIONS.slice();
    if (role === "agent" || !adminAccess) return base;
    return uniqueList([...base, ...(ROLE_DEFAULTS[role] || [])]);
  }

  function cleanPerms(perms) {
    return uniqueList(perms || []).filter((perm) => PERMISSIONS.includes(perm));
  }

  function cleanReason(value, key) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        return String(parsed?.[key || "leaveReason"] || parsed?.leaveReason || parsed?.offReason || "").trim();
      } catch {
        return "";
      }
    }
    return raw;
  }

  function fmtDateTime(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return `${isoToLabel(date)} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  function fmtTime(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function minutesBetween(a, b) {
    if (!a || !b) return 0;
    const start = new Date(a).getTime();
    const end = new Date(b).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
    return Math.round((end - start) / 60000);
  }

  function formatDuration(mins) {
    const m = Math.max(0, Math.round(num(mins)));
    const h = Math.floor(m / 60);
    const r = m % 60;
    return `${h}h ${pad(r)}m`;
  }

  function isUrl(value) {
    if (!value) return false;
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol);
    } catch {
      return false;
    }
  }

  function downloadTextFile(filename, text, type) {
    const blob = new Blob([text], { type: type || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function copyText(value) {
    const text = String(value || "");
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  function createDefaultDB() {
    const payMethods = [
      { id: IDS.cashApp, name: "Cash App", tags: [{ id: "tag-cash-main", tag: "$TeamMarkhor" }, { id: "tag-cash-backup", tag: "$MarkhorPay" }] },
      { id: IDS.zelle, name: "Zelle", tags: [{ id: "tag-zelle-main", tag: "payments@teammarkhor.com" }] },
      { id: IDS.venmo, name: "Venmo", tags: [{ id: "tag-venmo-main", tag: "@TeamMarkhor" }] }
    ];
    return {
      shifts: [
        { id: IDS.shiftMorning, name: "Morning", start: "06:00", end: "14:00" },
        { id: IDS.shiftAfternoon, name: "Afternoon", start: "14:00", end: "22:00" },
        { id: IDS.shiftNight, name: "Night", start: "22:00", end: "06:00" }
      ],
      agents: [
        { id: IDS.agentAli, name: "Ali Hassan", role: "agent", shiftId: IDS.shiftMorning, color: "#24d8ff", attendanceRequired: true, showInDeposits: true, targets: { newPlayers: 0, deposit: 0 } },
        { id: IDS.agentSara, name: "Sara Ahmed", role: "agent", shiftId: IDS.shiftAfternoon, color: "#a673ff", attendanceRequired: true, showInDeposits: true, targets: { newPlayers: 0, deposit: 0 } },
        { id: IDS.agentUsman, name: "Usman Malik", role: "agent", shiftId: IDS.shiftNight, color: "#32d583", attendanceRequired: true, showInDeposits: true, targets: { newPlayers: 0, deposit: 0 } }
      ],
      staff: [],
      payMethods,
      pageNames: [{ id: "page-main", name: "Team Markhor Main", link: "", accessTo: "" }],
      games: [
        { id: IDS.gameFish, name: "Fish Table", backendLoaded: 5000, pricePer1k: 0, backendLink: "", playerLink: "", username: "", password: "", gameVendorId: "", reloadHistory: [] },
        { id: IDS.gameJuwa, name: "Juwa", backendLoaded: 8000, pricePer1k: 0, backendLink: "", playerLink: "", username: "", password: "", gameVendorId: IDS.gameVendorJuwa, reloadHistory: [] },
        { id: IDS.gameOrion, name: "Orion Stars", backendLoaded: 6000, pricePer1k: 0, backendLink: "", playerLink: "", username: "", password: "", gameVendorId: IDS.gameVendorOrion, reloadHistory: [] }
      ],
      payVendors: [
        {
          id: IDS.vendorFastPay,
          name: "FastPay Co",
          notes: "",
          fees: [
            { id: "fee-cash-app", payMethodId: IDS.cashApp, fee: 20, payTag: "$TeamMarkhor" },
            { id: "fee-zelle", payMethodId: IDS.zelle, fee: 30, payTag: "payments@teammarkhor.com" }
          ]
        }
      ],
      gameVendors: [
        { id: IDS.gameVendorJuwa, name: "Juwa Vendor", notes: "" },
        { id: IDS.gameVendorOrion, name: "Orion Vendor", notes: "" }
      ],
      expCats: [
        { id: "exp-payroll", name: "Payroll" },
        { id: "exp-rent", name: "Rent" },
        { id: "exp-utilities", name: "Utilities" },
        { id: "exp-marketing", name: "Marketing" },
        { id: "exp-misc", name: "Misc" }
      ],
      expenses: [],
      entries: [],
      closedShifts: [],
      attendance: [],
      leaveRequests: [],
      scheduledOff: [],
      attendanceSettings: {
        leaveReasons: ["Sick Leave", "Urgent Work", "Personal Leave"],
        offReasons: ["Uninformed", "Sick Leave", "Custom"],
        lateGraceMinutes: 15
      },
      salesTargets: { monthlySales: 0, monthlyNewPlayers: 0 },
      shiftStart: new Date().toISOString(),
      shiftOpen: true,
      activeShiftName: shiftNameForNow([
        { name: "Morning", start: "06:00", end: "14:00" },
        { name: "Afternoon", start: "14:00", end: "22:00" },
        { name: "Night", start: "22:00", end: "06:00" }
      ]),
      supabase: { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, enabled: true },
      overrideCode: "1234"
    };
  }

  function normalizeDB(input) {
    const base = createDefaultDB();
    const db = { ...base, ...(input && typeof input === "object" ? input : {}) };
    [
      "shifts", "agents", "staff", "payMethods", "pageNames", "games", "payVendors",
      "gameVendors", "expCats", "expenses", "entries", "closedShifts", "attendance",
      "leaveRequests", "scheduledOff"
    ].forEach((key) => {
      if (!Array.isArray(db[key])) db[key] = clone(base[key]);
    });
    db.attendance = db.attendance.map((record) => ({
      ...record,
      leaveReason: cleanReason(record.leaveReason, "leaveReason"),
      offReason: cleanReason(record.offReason, "offReason")
    }));
    db.agents = db.agents.map((agent, index) => ({
      role: "agent",
      shiftId: base.shifts[index % base.shifts.length]?.id || IDS.shiftMorning,
      color: ["#24d8ff", "#a673ff", "#32d583", "#ffbf4d"][index % 4],
      attendanceRequired: true,
      showInDeposits: true,
      targets: { newPlayers: 0, deposit: 0 },
      ...agent
    })).map((agent) => {
      const copy = { ...agent };
      delete copy.pin;
      delete copy.password;
      copy.targets = { newPlayers: 0, deposit: 0, ...(agent.targets || {}) };
      return copy;
    });
    db.staff = db.staff.map((staff) => {
      const role = staff.role || "manager";
      const operational = ["manager", "supervisor", "agent"].includes(role);
      const legacyAdminAccess = (staff.perms || []).includes("View Dashboard") || ["owner", "admin"].includes(role);
      const adminAccess = role !== "agent" && (typeof staff.adminAccess === "boolean" ? staff.adminAccess : legacyAdminAccess);
      return {
        role,
        shiftId: "",
        color: "#8796a3",
        adminAccess,
        attendanceRequired: operational,
        showInDeposits: operational,
        targets: { newPlayers: 0, deposit: 0 },
        perms: staffPermsForRole(role, adminAccess),
        ...staff,
        adminAccess,
        perms: staff.perms ? cleanPerms([...AGENT_PANEL_PERMISSIONS, ...(adminAccess ? ["View Dashboard", ...staff.perms] : [])]) : staffPermsForRole(role, adminAccess),
        targets: { newPlayers: 0, deposit: 0, ...(staff.targets || {}) }
      };
    });
    db.games = db.games.map((game) => ({ reloadHistory: [], pricePer1k: 0, backendLoaded: 0, ...game }));
    db.pageNames = db.pageNames.map((page) => typeof page === "string" ? { id: uid("page"), name: page, link: "", accessTo: "" } : { link: "", accessTo: "", ...page });
    db.payMethods = db.payMethods.map((method) => ({ tags: [], ...method, tags: (method.tags || []).map((tag) => ({ active: true, archivedAt: "", ...tag })) }));
    db.payVendors = db.payVendors.map((vendor) => ({
      fees: [],
      notes: "",
      paid: 0,
      payments: [],
      deductions: [],
      ...vendor,
      payments: Array.isArray(vendor.payments) ? vendor.payments : [],
      deductions: Array.isArray(vendor.deductions) ? vendor.deductions : []
    }));
    db.gameVendors = db.gameVendors.map((vendor) => ({ notes: "", ...vendor }));
    db.supabase = { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, enabled: true, ...(db.supabase || {}) };
    db.attendanceSettings = {
      leaveReasons: ["Sick Leave", "Urgent Work", "Personal Leave"],
      offReasons: ["Uninformed", "Sick Leave", "Custom"],
      lateGraceMinutes: 15,
      ...(db.attendanceSettings || {})
    };
    db.salesTargets = { monthlySales: 0, monthlyNewPlayers: 0, ...(db.salesTargets || {}) };
    if (db.salesTargets.monthlySales === 0 && db.salesTargets.monthlyDeposit) db.salesTargets.monthlySales = num(db.salesTargets.monthlyDeposit);
    if (!db.shiftStart) db.shiftStart = new Date().toISOString();
    if (typeof db.shiftOpen !== "boolean") db.shiftOpen = true;
    if (!db.activeShiftName) db.activeShiftName = shiftNameForNow(db.shifts);
    if (!db.overrideCode) db.overrideCode = "1234";
    return db;
  }

  function loadDB() {
    try {
      return normalizeDB(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
    } catch {
      return createDefaultDB();
    }
  }

  function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
  }

  function createState() {
    return {
      page: "shift",
      shiftTab: "paid",
      eFilter: "all",
      adminSection: "dashboard",
      adminAttendanceTab: "daily",
      vendorSection: "payment",
      payMethodSection: "active",
      txPlayerLookup: "",
      editVendorFeeId: "",
      month: monthKey(),
      pnlMonth: monthKey(),
      modal: null,
      adminAuthed: false,
      adminUserId: "",
      editGameId: null,
      txSearch: "",
      txType: "all",
      txAgent: "",
      txGame: "",
      txShift: "",
      txDate: "",
      txStartDate: "",
      txEndDate: "",
      txSort: "newest",
      afAgent: "",
      afDate: "",
      afStatus: "all",
      pfDate: "",
      pfShift: "",
      attendancePerson: "",
      pf: newPF(),
      ff: newFF(),
      rf: newRF(),
      _pendingEntry: null
    };
  }

  function newPF() {
    return {
      date: todayISO(),
      shift: activeShiftName(),
      agent: "",
      playerName: "",
      playerUrl: "",
      deposit: "",
      recharge: "",
      promo: "0.00",
      promoP: "0.00",
      payMethodId: "",
      payTagId: "",
      custTag: "",
      gameId: "",
      gameName: "",
      depositOnPage: true,
      pageName: "",
      huntingProfile: "",
      salesName: "",
      legalName: "",
      contact: "",
      email: ""
    };
  }

  function newFF() {
    return {
      date: todayISO(),
      shift: activeShiftName(),
      agent: "",
      playerName: "",
      playerUrl: "",
      fpAmount: "",
      gameName: "",
      gameId: "",
      salesName: "",
      legalName: "",
      contact: "",
      email: ""
    };
  }

  function newRF() {
    return {
      date: todayISO(),
      shift: activeShiftName(),
      agent: "",
      gameId: "",
      gameName: "",
      rdCredits: "",
      cashoutPaid: ""
    };
  }

  function shiftNameForNow(shifts) {
    const list = Array.isArray(shifts) && shifts.length ? shifts : [
      { name: "Morning", start: "06:00", end: "14:00" },
      { name: "Afternoon", start: "14:00", end: "22:00" },
      { name: "Night", start: "22:00", end: "06:00" }
    ];
    const d = new Date();
    const current = d.getHours() * 60 + d.getMinutes();
    const match = list.find((shift) => {
      const [sh, sm] = shift.start.split(":").map(Number);
      const [eh, em] = shift.end.split(":").map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      return start <= end ? current >= start && current < end : current >= start || current < end;
    });
    return match?.name || list[0]?.name || "Morning";
  }

  function getCurrentShiftName() {
    return shiftNameForNow(DB?.shifts);
  }

  function activeShiftName() {
    return DB?.activeShiftName || getCurrentShiftName();
  }

  function isShiftOpen() {
    return DB?.shiftOpen !== false;
  }

  function shiftByName(name) {
    return DB.shifts.find((shift) => shift.name === name);
  }

  function shiftById(id) {
    return DB.shifts.find((shift) => shift.id === id);
  }

  function tagsFor(methodId, includeArchived = false) {
    const tags = DB.payMethods.find((method) => method.id === methodId)?.tags || [];
    return includeArchived ? tags : tags.filter((tag) => tag.active !== false);
  }

  function combinedPeople() {
    const seen = new Set();
    const people = [];
    DB.agents.forEach((agent) => {
      const key = agent.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        people.push({ id: agent.id, name: agent.name, role: agent.role || "agent", shiftId: agent.shiftId, color: agent.color || "#24d8ff", attendanceRequired: agent.attendanceRequired !== false, showInDeposits: agent.showInDeposits !== false, targets: agent.targets || { newPlayers: 0, deposit: 0 }, source: "agent" });
      }
    });
    DB.staff.forEach((staff) => {
      const key = staff.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        people.push({ id: staff.id, name: staff.name, role: staff.role || "staff", shiftId: staff.shiftId || "", color: staff.color || "#8796a3", attendanceRequired: !!staff.attendanceRequired, showInDeposits: !!staff.showInDeposits, targets: staff.targets || { newPlayers: 0, deposit: 0 }, source: "staff" });
      }
    });
    return people;
  }

  function allPeople() {
    return combinedPeople().filter((person) => person.attendanceRequired);
  }

  function salesPeople() {
    return combinedPeople().filter((person) => person.showInDeposits);
  }

  function personById(id) {
    return combinedPeople().find((person) => person.id === id);
  }

  function getAttendance(personId, date) {
    return DB.attendance.find((record) => record.agentId === personId && record.date === date);
  }

  function ensureAttendance(personId, date) {
    const person = personById(personId);
    let record = getAttendance(personId, date);
    if (!record) {
      record = {
        id: uid("attendance"),
        agentId: personId,
        agentName: person?.name || "",
        date,
        checkIn: "",
        checkInAt: "",
        checkOut: "",
        checkOutAt: "",
        duration: 0,
        status: "absent",
        leaveReason: "",
        late: false,
        report: null,
        missedCheckoutAcknowledged: false
      };
      DB.attendance.unshift(record);
    }
    return record;
  }

  function isLateForPerson(person, dateTimeValue) {
    if (!person || !dateTimeValue) return false;
    const shift = shiftById(person.shiftId) || DB.shifts[0];
    if (!shift) return false;
    const d = new Date(dateTimeValue);
    const [h, m] = shift.start.split(":").map(Number);
    const start = new Date(d);
    start.setHours(h, m + num(DB.attendanceSettings.lateGraceMinutes), 0, 0);
    return d.getTime() > start.getTime();
  }

  function activeEntries() {
    return DB.entries.slice();
  }

  function allEntries() {
    const closed = DB.closedShifts.flatMap((shift) => (shift.entries || []).map((entry) => ({
      ...entry,
      shiftSession: shift.label || entry.shiftSession || "Closed Shift"
    })));
    return [...DB.entries.map((entry) => ({ ...entry, shiftSession: entry.shiftSession || "Current" })), ...closed];
  }

  function entryRef(id) {
    const current = DB.entries.find((entry) => entry.id === id);
    if (current) return { entry: current, current: true, shift: null };
    for (const shift of DB.closedShifts) {
      const entry = (shift.entries || []).find((item) => item.id === id);
      if (entry) return { entry, current: false, shift };
    }
    return null;
  }

  function gameUsage(game) {
    const entries = allEntries().filter((entry) => entry.gameId === game.id || entry.gameName === game.name);
    const paid = entries.filter((entry) => entry.type === "paid").reduce((sum, entry) => sum + num(entry.recharge), 0);
    const freeplay = entries.filter((entry) => entry.type === "freeplay").reduce((sum, entry) => sum + num(entry.fpAmount), 0);
    const redeem = entries.filter((entry) => entry.type === "redeem").reduce((sum, entry) => sum + num(entry.rdCredits), 0);
    const used = paid + freeplay;
    return { paid, freeplay, used, redeem, current: num(game.backendLoaded) - used + redeem };
  }

  function gameBal(gameId) {
    const game = DB.games.find((item) => item.id === gameId || item.name === gameId);
    if (!game) return 0;
    return gameUsage(game).current;
  }

  function shiftKPIs() {
    return kpisForEntries(activeEntries());
  }

  function kpisForEntries(entries) {
    const paid = entries.filter((entry) => entry.type === "paid");
    const fp = entries.filter((entry) => entry.type === "freeplay");
    const rd = entries.filter((entry) => entry.type === "redeem");
    return {
      paidCount: paid.length,
      fpCount: fp.length,
      rdCount: rd.length,
      totalR: paid.reduce((sum, entry) => sum + num(entry.recharge), 0),
      totalFP: fp.reduce((sum, entry) => sum + num(entry.fpAmount), 0),
      totalCashout: rd.reduce((sum, entry) => sum + num(entry.cashoutPaid), 0),
      totalDeposit: paid.reduce((sum, entry) => sum + num(entry.deposit), 0),
      newPlayers: entries.filter((entry) => entry.isNewPlayer).length
    };
  }

  function dayEntriesFor(date, currentEntries = DB.entries) {
    const archived = DB.closedShifts
      .filter((shift) => shift.date === date)
      .flatMap((shift) => shift.entries || []);
    return [...archived, ...currentEntries];
  }

  function isDayClosingShift(name) {
    const lower = String(name || "").toLowerCase();
    const hour = new Date().getHours();
    return lower.includes("evening") || lower.includes("night") || (lower.includes("afternoon") && hour >= 18);
  }

  function metaEntry(value) {
    try {
      const parsed = JSON.parse(value || "{}");
      return parsed && typeof parsed === "object" ? parsed : { custTag: value || "" };
    } catch {
      return { custTag: value || "" };
    }
  }

  function entryToRow(entry, session) {
    const meta = {
      custTag: entry.custTag || "",
      payTagId: entry.payTagId || "",
      payTagLabel: entry.payTagLabel || "",
      depositOnPage: !!entry.depositOnPage,
      pageName: entry.pageName || "",
      huntingProfile: entry.huntingProfile || "",
      salesName: entry.salesName || "",
      dispute: !!entry.dispute,
      disputeNote: entry.disputeNote || "",
      promoP: num(entry.promoP)
    };
    return {
      id: entry.id,
      type: entry.type,
      date: entry.date,
      shift: entry.shift,
      shift_session: session || entry.shiftSession || "Current",
      agent: entry.agent,
      player_name: entry.playerName || "",
      player_url: entry.playerUrl || "",
      game_id: entry.gameId || "",
      game_name: entry.gameName || "",
      deposit: num(entry.deposit),
      recharge: num(entry.recharge),
      promo: num(entry.promo),
      fp_amount: num(entry.fpAmount),
      rd_credits: num(entry.rdCredits),
      cashout_paid: num(entry.cashoutPaid),
      is_new_player: !!entry.isNewPlayer,
      cust_tag: JSON.stringify(meta),
      pay_method_id: entry.payMethodId || "",
      legal_name: entry.legalName || "",
      contact: entry.contact || "",
      email: entry.email || "",
      created_at: entry.createdAt || new Date().toISOString()
    };
  }

  function rowToEntry(row) {
    const meta = metaEntry(row.cust_tag);
    return {
      id: row.id,
      type: row.type || "paid",
      date: row.date || todayISO(),
      shift: row.shift || "",
      shiftSession: row.shift_session || "Current",
      agent: row.agent || "",
      playerName: row.player_name || "",
      playerUrl: row.player_url || "",
      gameId: row.game_id || "",
      gameName: row.game_name || "",
      deposit: num(row.deposit),
      recharge: num(row.recharge),
      promo: num(row.promo),
      promoP: num(meta.promoP),
      fpAmount: num(row.fp_amount),
      rdCredits: num(row.rd_credits),
      cashoutPaid: num(row.cashout_paid),
      isNewPlayer: !!row.is_new_player,
      custTag: meta.custTag || row.cust_tag || "",
      payMethodId: row.pay_method_id || "",
      payTagId: meta.payTagId || "",
      payTagLabel: meta.payTagLabel || "",
      depositOnPage: !!meta.depositOnPage,
      pageName: meta.pageName || "",
      huntingProfile: meta.huntingProfile || "",
      salesName: meta.salesName || "",
      dispute: !!meta.dispute,
      disputeNote: meta.disputeNote || "",
      legalName: row.legal_name || "",
      contact: row.contact || "",
      email: row.email || "",
      createdAt: row.created_at || new Date().toISOString()
    };
  }

  function attendanceToRow(record) {
    const meta = {
      leaveReason: record.leaveReason || "",
      offReason: record.offReason || "",
      late: !!record.late,
      report: record.report || null,
      checkInAt: record.checkInAt || record.checkIn || "",
      checkOutAt: record.checkOutAt || record.checkOut || "",
      missedCheckoutAcknowledged: !!record.missedCheckoutAcknowledged
    };
    return {
      id: record.id,
      agent_id: record.agentId,
      agent_name: record.agentName,
      date: record.date,
      check_in: record.checkInAt || record.checkIn || "",
      check_out: record.checkOutAt || record.checkOut || "",
      duration_mins: num(record.duration),
      status: record.status || "present",
      leave_reason: JSON.stringify(meta),
      created_at: record.createdAt || new Date().toISOString()
    };
  }

  function rowToAttendance(row) {
    let meta = {};
    try { meta = JSON.parse(row.leave_reason || "{}"); } catch { meta = { leaveReason: row.leave_reason || "" }; }
    return {
      id: row.id,
      agentId: row.agent_id,
      agentName: row.agent_name || "",
      date: row.date || todayISO(),
      checkIn: row.check_in || "",
      checkInAt: meta.checkInAt || row.check_in || "",
      checkOut: row.check_out || "",
      checkOutAt: meta.checkOutAt || row.check_out || "",
      duration: num(row.duration_mins),
      status: row.status || "present",
      leaveReason: cleanReason(meta.leaveReason || "", "leaveReason"),
      offReason: cleanReason(meta.offReason || "", "offReason"),
      late: !!meta.late,
      report: meta.report || null,
      missedCheckoutAcknowledged: !!meta.missedCheckoutAcknowledged,
      createdAt: row.created_at || new Date().toISOString()
    };
  }

  function configPayload() {
    const copy = clone(DB);
    copy.entries = [];
    copy.closedShifts = [];
    copy.attendance = [];
    return copy;
  }

  function sbHeaders() {
    return {
      apikey: DB.supabase.anonKey,
      Authorization: `Bearer ${DB.supabase.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    };
  }

  function sbUrl(table) {
    return `${DB.supabase.url.replace(/\/$/, "")}/rest/v1/${table}`;
  }

  async function sbRequest(table, options, query) {
    if (!DB.supabase.enabled || !DB.supabase.url || !DB.supabase.anonKey || !IS_ONLINE) throw new Error("Supabase unavailable");
    const url = `${sbUrl(table)}${query || ""}`;
    const response = await fetch(url, { ...options, headers: { ...sbHeaders(), ...(options.headers || {}) } });
    if (!response.ok) throw new Error(`Supabase ${table} ${response.status}`);
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function pushConfig() {
    saveDB();
    queueSync({
      id: CONFIG_ID,
      payload: JSON.stringify(configPayload()),
      updated_at: new Date().toISOString()
    }, "crm_config");
  }

  function syncEntry(entry) {
    queueSync(entryToRow(entry, entry.shiftSession || "Current"), "entries");
  }

  function syncAttendance(record) {
    queueSync(attendanceToRow(record), "attendance");
  }

  function queueSync(row, table) {
    if (!DB.supabase.enabled || !IS_ONLINE) return;
    syncQueue.push({ row, table });
    void flushSync();
  }

  async function flushSync() {
    if (syncBusy || !syncQueue.length || !IS_ONLINE || !DB.supabase.enabled) return;
    syncBusy = true;
    while (syncQueue.length && IS_ONLINE) {
      const item = syncQueue.shift();
      try {
        await sbRequest(item.table, {
          method: "POST",
          body: JSON.stringify(item.row),
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" }
        }, "?on_conflict=id");
      } catch {
        syncQueue.unshift(item);
        break;
      }
    }
    syncBusy = false;
  }

  async function upsertRows(table, rows) {
    if (!rows.length) return;
    await sbRequest(table, { method: "POST", body: JSON.stringify(rows), headers: { Prefer: "resolution=merge-duplicates,return=minimal" } }, "?on_conflict=id");
  }

  async function deleteAllRows(table) {
    await sbRequest(table, { method: "DELETE" }, "?id=neq.__none__");
  }

  async function sbPush() {
    if (!DB.supabase.enabled || !IS_ONLINE) return false;
    try {
      await upsertRows("crm_config", [{ id: CONFIG_ID, payload: JSON.stringify(configPayload()), updated_at: new Date().toISOString() }]);
      await deleteAllRows("entries");
      await deleteAllRows("closed_shifts");
      await deleteAllRows("attendance");
      await upsertRows("entries", DB.entries.map((entry) => entryToRow(entry, entry.shiftSession || "Current")));
      await upsertRows("closed_shifts", DB.closedShifts.map((shift) => ({
        id: shift.id,
        label: shift.label,
        date: shift.date,
        closed_at: shift.closedAt,
        summary: JSON.stringify({ summary: shift.summary || {}, entries: shift.entries || [] }),
        created_at: shift.createdAt || new Date().toISOString()
      })));
      await upsertRows("attendance", DB.attendance.map(attendanceToRow));
      lastSavedStatus = `Synced at ${new Date().toLocaleTimeString()}`;
      return true;
    } catch {
      return false;
    }
  }

  async function sbPull(silent) {
    if (!DB.supabase.enabled || !IS_ONLINE) return false;
    try {
      const [configRows, entryRows, closedRows, attendanceRows] = await Promise.all([
        sbRequest("crm_config", { method: "GET", headers: { Prefer: "return=representation" } }, `?id=eq.${encodeURIComponent(CONFIG_ID)}&select=*`),
        sbRequest("entries", { method: "GET", headers: { Prefer: "return=representation" } }, "?select=*"),
        sbRequest("closed_shifts", { method: "GET", headers: { Prefer: "return=representation" } }, "?select=*"),
        sbRequest("attendance", { method: "GET", headers: { Prefer: "return=representation" } }, "?select=*")
      ]);
      if (!configRows || !configRows.length) return false;
      const config = JSON.parse(configRows[0].payload || "{}");
      const next = normalizeDB(config);
      next.entries = (entryRows || []).map(rowToEntry);
      next.closedShifts = (closedRows || []).map((row) => {
        let payload = {};
        try { payload = JSON.parse(row.summary || "{}"); } catch { payload = {}; }
        return {
          id: row.id,
          label: row.label,
          date: row.date,
          closedAt: row.closed_at,
          summary: payload.summary || payload || {},
          entries: payload.entries || [],
          createdAt: row.created_at
        };
      });
      next.attendance = (attendanceRows || []).map(rowToAttendance);
      DB = next;
      saveDB();
      if (!silent) lastSavedStatus = `Pulled at ${new Date().toLocaleTimeString()}`;
      return true;
    } catch {
      return false;
    }
  }

  function checkOnline() {
    if (IS_ONLINE) return true;
    alert("No internet connection. All changes are blocked until you reconnect.");
    return false;
  }

  function updateOnlineStatus() {
    IS_ONLINE = navigator.onLine;
    if (IS_ONLINE) {
      void flushSync();
      void sbPull(true).then((changed) => {
        if (changed) render();
      });
    }
    render();
  }

  function field(label, html, cls) {
    return `<label class="${cls || ""}">${esc(label)}${html}</label>`;
  }

  function textInput(id, value, oninput, attrs) {
    return `<input id="${id}" value="${esc(value)}" ${oninput ? `oninput="${oninput}"` : ""} ${attrs || ""}>`;
  }

  function numberInput(id, value, oninput, attrs) {
    return `<input id="${id}" type="number" step="0.01" value="${esc(value)}" ${oninput ? `oninput="${oninput}"` : ""} ${attrs || ""}>`;
  }

  function dateInput(id, value, onchange, attrs) {
    const display = value ? isoToLabel(value) : "";
    const blurChange = onchange ? onchange.replace(/this\.value/g, "iso") : "";
    return `<input id="${id}" type="text" value="${esc(display)}" onfocus="const raw=this.value; this.type='date'; this.value=raw ? TM.parseDateInput(raw) : ''; if (this.showPicker) this.showPicker()" ${onchange ? `onchange="${onchange}"` : ""} onblur="const iso=this.value ? TM.parseDateInput(this.value) : ''; ${blurChange}; this.type='text'; this.value=iso ? TM.dateLabel(iso) : ''" ${attrs || ""}>`;
  }

  function selectInput(id, options, value, onchange, attrs) {
    return `<select id="${id}" ${onchange ? `onchange="${onchange}"` : ""} ${attrs || ""}>${options.map((item) => {
      const val = Array.isArray(item) ? item[0] : item;
      const lab = Array.isArray(item) ? item[1] : item;
      return `<option value="${esc(val)}" ${String(val) === String(value) ? "selected" : ""}>${esc(lab)}</option>`;
    }).join("")}</select>`;
  }

  function moneyCell(value) {
    return `<span class="${num(value) < 0 ? "danger-text" : ""}">${fmt$(value)}</span>`;
  }

  function render() {
    if (!DB || !S) return;
    const scrollTop = document.querySelector(".content-scroll")?.scrollTop || 0;
    const adminScrollTop = document.querySelector(".admin-main")?.scrollTop || 0;
    app.innerHTML = `
      ${renderTopbar()}
      ${IS_ONLINE ? "" : `<div class="offline-banner">No internet connection - all changes are blocked until you reconnect</div>`}
      <main class="layout">${S.page === "admin" ? renderAdminApp() : S.page === "closed" ? renderClosedScreen() : renderShiftApp()}</main>
      ${renderModal()}
    `;
    updateClock();
    setTimeout(() => {
      const scroller = document.querySelector(".content-scroll");
      if (scroller) scroller.scrollTop = scrollTop;
      const adminMain = document.querySelector(".admin-main");
      if (adminMain) adminMain.scrollTop = adminScrollTop;
    }, 0);
  }

  function renderTopbar() {
    const k = activeShiftName();
    return `
      <header class="topbar">
        <div class="brand-wrap">
          <span class="online-pill"><i class="dot ${IS_ONLINE ? "on" : ""}"></i>${IS_ONLINE ? "Online" : "Offline"}</span>
          <div class="brand-mark"><span class="brand-icon">TM</span><span>TEAM</span><strong>MARKHOR</strong></div>
        </div>
        <nav class="nav">
          <button class="btn btn-ghost ${S.page === "shift" ? "active" : ""}" onclick="TM.setPage('shift')">Agent Panel</button>
          <button class="btn btn-ghost ${S.page === "admin" ? "active" : ""}" onclick="TM.openAdminGate()">Admin Dashboard</button>
        </nav>
        <div class="top-right">
          ${S.page === "admin" && S.adminAuthed ? `<span class="shift-clock">Admin: <b>${esc(currentAdminUser()?.name || "Authorized")}</b></span><button class="btn btn-ghost btn-sm" onclick="TM.lockAdmin()">Lock Admin Dashboard</button>` : ""}
          <span class="shift-clock">${esc(k)} <b id="clk"></b></span>
          ${S.page === "shift" && isShiftOpen() ? `<button class="btn btn-warn" onclick="TM.openCloseShift()" ${IS_ONLINE ? "" : "disabled"}>Close Shift</button>` : ""}
        </div>
      </header>
    `;
  }

  function updateClock() {
    const el = document.getElementById("clk");
    if (el) el.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function renderShiftApp() {
    if (!isShiftOpen()) return renderClosedScreen();
    return `<div class="content-scroll">
      <div class="content-inner">
        ${renderKpiBar()}
        <div class="tabs">
          ${[
            ["paid", "Paid Recharge"],
            ["fp", "Freeplay"],
            ["rd", "Redeem / Cashout"],
            ["bal", "Game Balance"],
            ["att", "Attendance"]
          ].map(([key, label]) => `<button class="tab ${S.shiftTab === key ? "active" : ""}" onclick="TM.setShiftTab('${key}')">${label}</button>`).join("")}
        </div>
        ${S.shiftTab === "paid" ? renderPaidTab() : S.shiftTab === "fp" ? renderFreeplayTab() : S.shiftTab === "rd" ? renderRedeemTab() : S.shiftTab === "bal" ? renderGameBalanceTab() : renderAttendanceTab()}
      </div>
    </div>`;
  }

  function renderKpiBar() {
    const k = shiftKPIs();
    return `<section class="kpi-row">
      <article class="kpi-card"><span>Paid Sales</span><strong>${k.paidCount}</strong><small>${fmt$(k.totalR)}</small></article>
      <article class="kpi-card"><span>Freeplay</span><strong>${k.fpCount}</strong><small>${fmt$(k.totalFP)}</small></article>
      <article class="kpi-card"><span>Cashouts</span><strong>${k.rdCount}</strong><small>${fmt$(k.totalCashout)}</small></article>
      <article class="kpi-card"><span>Sales Amount</span><strong>${fmt$(k.totalR)}</strong><small>Current Shift</small></article>
      <article class="kpi-card"><span>New Players</span><strong>${k.newPlayers}</strong><small>Current Shift</small></article>
    </section>`;
  }

  function agentOptions() {
    const names = salesPeople().map((person) => person.name);
    return [["", "Select"], ...names.map((name) => [name, name])];
  }

  function shiftOptions() {
    return DB.shifts.map((shift) => [shift.name, `${shift.name} (${shift.start}-${shift.end})`]);
  }

  function gameOptions(blank) {
    const opts = DB.games.map((game) => [game.name, game.name]);
    return blank ? [["", "Select Game"], ...opts] : opts;
  }

  function formSection(title, tone, columns, content) {
    return `<div class="form-block">
      <div class="form-block-head ${tone || ""}">${esc(title)}</div>
      <div class="form-grid cols-${columns || 3}">${content}</div>
    </div>`;
  }

  function monthlySalesSummary() {
    const key = monthKey();
    const rows = allEntries().filter((entry) => String(entry.date || "").startsWith(key));
    const paid = rows.filter((entry) => entry.type === "paid");
    const deposit = paid.reduce((sum, entry) => sum + num(entry.deposit), 0);
    const recharge = paid.reduce((sum, entry) => sum + num(entry.recharge), 0);
    const newPlayers = rows.filter((entry) => entry.isNewPlayer).length;
    const salesTarget = num(DB.salesTargets.monthlySales);
    const playersTarget = num(DB.salesTargets.monthlyNewPlayers);
    return {
      deposit,
      recharge,
      newPlayers,
      salesTarget,
      playersTarget,
      salesPct: salesTarget ? Math.min(100, Math.round((recharge / salesTarget) * 100)) : 0,
      playersPct: playersTarget ? Math.min(100, Math.round((newPlayers / playersTarget) * 100)) : 0
    };
  }

  function findGameForEntry(entry) {
    return DB.games.find((game) => game.id === entry.gameId || game.name === entry.gameName) || null;
  }

  function entryCoinCost(entry) {
    const game = findGameForEntry(entry);
    const price = num(game?.pricePer1k);
    if (!price) return 0;
    const credits = entry.type === "paid" ? num(entry.recharge) : entry.type === "freeplay" ? num(entry.fpAmount) : 0;
    return (credits / 1000) * price;
  }

  function entryRedeemValue(entry) {
    if (entry.type !== "redeem") return 0;
    const game = findGameForEntry(entry);
    const price = num(game?.pricePer1k);
    return price ? (num(entry.rdCredits) / 1000) * price : 0;
  }

  function entryGatewayFee(entry) {
    if (entry.type !== "paid") return 0;
    for (const vendor of DB.payVendors) {
      const fee = (vendor.fees || []).find((item) => item.payMethodId === entry.payMethodId && (!item.payTag || item.payTag === entry.payTagLabel));
      if (fee) return num(entry.deposit) * num(fee.fee) / 100;
    }
    return 0;
  }

  function pnlSummary(entries) {
    const paid = entries.filter((entry) => entry.type === "paid");
    const freeplay = entries.filter((entry) => entry.type === "freeplay");
    const redeem = entries.filter((entry) => entry.type === "redeem");
    const sales = paid.reduce((sum, entry) => sum + num(entry.recharge), 0);
    const deposit = paid.reduce((sum, entry) => sum + num(entry.deposit), 0);
    const coinCost = entries.reduce((sum, entry) => sum + entryCoinCost(entry), 0);
    const gatewayFees = entries.reduce((sum, entry) => sum + entryGatewayFee(entry), 0);
    const redeemedValue = entries.reduce((sum, entry) => sum + entryRedeemValue(entry), 0);
    const cashouts = redeem.reduce((sum, entry) => sum + num(entry.cashoutPaid), 0);
    const noCashoutRedeems = redeem.filter((entry) => num(entry.cashoutPaid) === 0 && num(entry.rdCredits) > 0);
    const margin = sales - coinCost - gatewayFees - cashouts - redeemedValue;
    return {
      count: entries.length,
      paidCount: paid.length,
      freeplayCount: freeplay.length,
      redeemCount: redeem.length,
      sales,
      deposit,
      coinCost,
      gatewayFees,
      redeemedValue,
      cashouts,
      noCashoutRedeemCount: noCashoutRedeems.length,
      noCashoutRedeemValue: noCashoutRedeems.reduce((sum, entry) => sum + entryRedeemValue(entry), 0),
      margin,
      marginPct: sales ? (margin / sales) * 100 : 0
    };
  }

  function personMonthStats(name, key) {
    const rows = allEntries().filter((entry) => entry.agent === name && String(entry.date || "").startsWith(key || monthKey()));
    const paid = rows.filter((entry) => entry.type === "paid");
    return {
      sales: paid.reduce((sum, entry) => sum + num(entry.recharge), 0),
      newPlayers: rows.filter((entry) => entry.isNewPlayer).length,
      paidCount: paid.length
    };
  }

  function renderSalesTargetBanner() {
    const s = monthlySalesSummary();
    return `<section class="target-kpi-row">
      <article class="kpi-card"><span>Monthly Team Sales Target</span><strong>${s.salesTarget ? fmt$(s.salesTarget) : "Not Set"}</strong><small>Achieved ${fmt$(s.recharge)}${s.salesTarget ? ` (${s.salesPct}%)` : ""}</small><div class="progress-bar"><i style="width:${s.salesPct}%"></i></div></article>
      <article class="kpi-card"><span>Monthly New Player Target</span><strong>${s.playersTarget ? fmtPlain(s.playersTarget) : "Not Set"}</strong><small>Achieved ${fmtPlain(s.newPlayers)}${s.playersTarget ? ` (${s.playersPct}%)` : ""}</small><div class="progress-bar"><i style="width:${s.playersPct}%"></i></div></article>
      <article class="kpi-card"><span>Sales Target Remaining</span><strong>${fmt$(Math.max(s.salesTarget - s.recharge, 0))}</strong><small>Monthly recharge counts as sales</small></article>
    </section>`;
  }

  function renderPaidTab() {
    const f = S.pf;
    const tags = tagsFor(f.payMethodId);
    return `<section class="stack">
      ${renderSalesTargetBanner()}
      <form class="fc sales-sheet" onsubmit="TM.submitPaid(event)" novalidate>
        <div class="fc-head">Paid Recharge Form</div>
        <div class="fg sales-form">
          ${formSection("Session Info", "tone-cyan", 3, `
            ${field("Date", dateInput("paid-date", f.date, "TM.setPF('date', this.value, false)", "required"))}
            ${field("Shift", selectInput("paid-shift", shiftOptions(), f.shift || activeShiftName(), "TM.setPF('shift', this.value, false)"))}
            ${field("Sales Person", selectInput("paid-agent", agentOptions(), f.agent, "TM.setPF('agent', this.value, false)"))}
          `)}
          ${formSection("Player Info", "tone-purple", 3, `
            ${field("Player Name", textInput("paid-player", f.playerName, "TM.setPF('playerName', this.value, false)", "required placeholder=\"Display name\""))}
            ${field("Player Facebook Link", `${textInput("paid-link", f.playerUrl, "TM.setPF('playerUrl', this.value, false)", "onblur=\"TM.validateLink(this, 'paid-link-hint')\" required placeholder=\"https://facebook.com/...\"")}<small id="paid-link-hint" class="subtle">Paste the full Facebook link.</small>`, "span2")}
          `)}
          ${formSection("Transaction", "tone-green", 4, `
            ${field("Deposit", numberInput("paid-deposit", f.deposit, "TM.updatePaidMoney()", "required min=\"0\" placeholder=\"0.00\""))}
            ${field("Recharge", numberInput("paid-recharge", f.recharge, "TM.updatePaidMoney()", "required min=\"0\" placeholder=\"0.00\""))}
            ${field("Promo Amount", `<input id="paid-promo" value="${esc(f.promo)}" readonly placeholder="Auto">`)}
            ${field("Promo Percentage", `<input id="paid-promop" value="${esc(f.promoP)}" readonly placeholder="Auto">`)}
          `)}
          ${formSection("Payment", "tone-warn", 3, `
            ${field("Payment Method", selectInput("paid-method", [["", "Select Payment Method"], ...DB.payMethods.map((method) => [method.id, method.name])], f.payMethodId, "TM.setPaidMethod(this.value)"))}
            ${field("Payment Tag", selectInput("paid-tag", [["", "Select Payment Tag"], ...tags.map((item) => [item.id, item.tag])], f.payTagId, "TM.setPaidTag(this.value)"))}
            ${field("Customer Tag or Email", textInput("paid-cust", f.custTag, "TM.setPF('custTag', this.value, false)", "placeholder=\"Tag or email\""))}
          `)}
          ${formSection("Game Info", "tone-purple", 2, `
            ${field("Game ID", textInput("paid-gameid", f.gameId, "TM.setPF('gameId', this.value, false)", "required placeholder=\"Unique player game ID\""))}
            ${field("Game Name", selectInput("paid-game", gameOptions(true), f.gameName, "TM.setPF('gameName', this.value, false)"))}
          `)}
          ${formSection("Channel", "tone-green", 3, `
            <label><span>Deposit on Page?</span><div class="tog compact">
              <button type="button" class="t-yes ${f.depositOnPage ? "active" : ""}" onclick="TM.toggleDepositOnPage(true)">Yes</button>
              <button type="button" class="t-no ${!f.depositOnPage ? "active" : ""}" onclick="TM.toggleDepositOnPage(false)">No</button>
            </div></label>
            ${field("Page Name", selectInput("paid-page", [["", "Select Page Name"], ...DB.pageNames.map((page) => [page.name, page.name])], f.depositOnPage ? f.pageName : "", "TM.setPF('pageName', this.value, false)", f.depositOnPage ? "" : "disabled"))}
            ${field("Hunting Profile Name", textInput("paid-hunting", f.huntingProfile, "TM.setPF('huntingProfile', this.value, false)", `${f.depositOnPage ? "disabled" : ""} placeholder=\"Profile name\"`))}
          `)}
          ${formSection("New Player", "tone-red", 4, `
            ${field("Sales Agent", selectInput("paid-sales", [["", "Select"], ...salesPeople().map((person) => [person.name, person.name])], f.salesName, "TM.setPF('salesName', this.value, false)"))}
            ${field("Player Legal Name", textInput("paid-legal", f.legalName, "TM.setPF('legalName', this.value, false)", "placeholder=\"Full legal name\""))}
            ${field("Contact Number", textInput("paid-contact", f.contact, "TM.setPF('contact', this.value, false)", "placeholder=\"Phone number\""))}
            ${field("Email", `<input type="email" value="${esc(f.email)}" oninput="TM.setPF('email', this.value, false)" placeholder="player@email.com">`)}
          `)}
          <div id="paid-warning" class="${num(f.promoP) > 100 ? "warn-box" : "hidden"} full">Manager approval required on submit.</div>
          <div class="row end full">
            <button type="button" class="btn btn-ghost" onclick="TM.clearPaid()">Clear</button>
            <button class="btn btn-primary" ${IS_ONLINE ? "" : "disabled"}>Add Paid Recharge</button>
          </div>
        </div>
      </form>
      ${renderEntriesTable()}
    </section>`;
  }

  function renderFreeplayTab() {
    const f = S.ff;
    return `<section class="stack">
      ${renderSalesTargetBanner()}
      <form class="fc sales-sheet" onsubmit="TM.submitFreeplay(event)" novalidate>
        <div class="fc-head">Freeplay Form</div>
        <div class="fg sales-form">
          ${formSection("Session Info", "tone-cyan", 3, `
            ${field("Date", dateInput("free-date", f.date, "TM.setFF('date', this.value, false)", "required"))}
            ${field("Shift", selectInput("free-shift", shiftOptions(), f.shift || activeShiftName(), "TM.setFF('shift', this.value, false)"))}
            ${field("Sales Person", selectInput("free-agent", agentOptions(), f.agent, "TM.setFF('agent', this.value, false)"))}
          `)}
          ${formSection("Player Info", "tone-purple", 3, `
            ${field("Player Name", textInput("free-player", f.playerName, "TM.setFF('playerName', this.value, false)", "required placeholder=\"Display name\""))}
            ${field("Player Facebook Link", `${textInput("free-link", f.playerUrl, "TM.setFF('playerUrl', this.value, false)", "onblur=\"TM.validateOptionalLink(this, 'free-link-hint')\" placeholder=\"https://facebook.com/...\"")}<small id="free-link-hint" class="subtle">Optional full Facebook link.</small>`, "span2")}
          `)}
          ${formSection("Freeplay Details", "tone-green", 3, `
            ${field("Freeplay Amount", numberInput("free-amount", f.fpAmount, "TM.setFF('fpAmount', this.value, false)", "required min=\"0\" placeholder=\"0.00\""))}
            ${field("Game Name", selectInput("free-game", gameOptions(true), f.gameName, "TM.setFF('gameName', this.value, false)"))}
            ${field("Game ID", textInput("free-gameid", f.gameId, "TM.setFF('gameId', this.value, false)", "required placeholder=\"Unique player game ID\""))}
          `)}
          ${formSection("New Player", "tone-red", 4, `
            ${field("Sales Agent", selectInput("free-sales", [["", "Select"], ...salesPeople().map((person) => [person.name, person.name])], f.salesName, "TM.setFF('salesName', this.value, false)"))}
            ${field("Player Legal Name", textInput("free-legal", f.legalName, "TM.setFF('legalName', this.value, false)", "placeholder=\"Full legal name\""))}
            ${field("Contact Number", textInput("free-contact", f.contact, "TM.setFF('contact', this.value, false)", "placeholder=\"Phone number\""))}
            ${field("Email", `<input type="email" value="${esc(f.email)}" oninput="TM.setFF('email', this.value, false)" placeholder="player@email.com">`)}
          `)}
          <div class="row end full">
            <button type="button" class="btn btn-ghost" onclick="TM.clearFreeplay()">Clear</button>
            <button class="btn btn-purple" ${IS_ONLINE ? "" : "disabled"}>Add Freeplay</button>
          </div>
        </div>
      </form>
      ${renderEntriesTable()}
    </section>`;
  }

  function redeemLookupInfo(gameId) {
    const id = String(gameId || "").trim();
    if (!id) return "";
    const rows = allEntries().filter((entry) => entry.gameId === id).sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));
    const paidRows = rows.filter((entry) => entry.type === "paid");
    const freeRows = rows.filter((entry) => entry.type === "freeplay");
    const redeemRows = rows.filter((entry) => entry.type === "redeem");
    const latest = paidRows[0] || rows[0];
    if (!latest) return `<div class="hint full">No previous player record found for this Game ID.</div>`;
    const totalRecharge = paidRows.reduce((sum, entry) => sum + num(entry.recharge), 0);
    const totalFreeplay = freeRows.reduce((sum, entry) => sum + num(entry.fpAmount), 0);
    const totalRedeemed = redeemRows.reduce((sum, entry) => sum + num(entry.rdCredits), 0);
    const totalCashout = redeemRows.reduce((sum, entry) => sum + num(entry.cashoutPaid), 0);
    const link = latest.playerUrl ? `<a href="${esc(latest.playerUrl)}" target="_blank" rel="noreferrer">Open Facebook Link</a>` : `<span class="muted">No Facebook Link</span>`;
    return `<div class="hint full lookup-grid">
      <span><b>Player Name</b>${esc(latest.playerName || "Not Provided")}</span>
      <span><b>Game Name</b>${esc(latest.gameName || "Not Provided")}</span>
      <span><b>Sales Person</b>${esc(latest.agent || "Not Provided")}</span>
      <span><b>Legal Name</b>${esc(latest.legalName || "Not Provided")}</span>
      <span><b>Contact Number</b>${esc(latest.contact || "Not Provided")}</span>
      <span><b>Email</b>${esc(latest.email || "Not Provided")}</span>
      <span><b>Player Facebook Link</b>${link}</span>
      <span><b>Total Recharge</b>${fmt$(totalRecharge)}</span>
      <span><b>Total Credits Given</b>${fmt$(totalRecharge + totalFreeplay)}</span>
      <span><b>Total Redeem Credits</b>${fmtPlain(totalRedeemed)}</span>
      <span><b>Total Cashout Paid</b>${fmt$(totalCashout)}</span>
    </div>`;
  }

  function renderRedeemTab() {
    const f = S.rf;
    return `<section class="stack">
      ${renderSalesTargetBanner()}
      <form class="fc sales-sheet" onsubmit="TM.submitRedeem(event)" novalidate>
        <div class="fc-head">Redeem / Cashout Form</div>
        <div class="fg sales-form">
          ${formSection("Session Info", "tone-cyan", 3, `
            ${field("Date", dateInput("redeem-date", f.date, "TM.setRF('date', this.value, false)", "required"))}
            ${field("Shift", selectInput("redeem-shift", shiftOptions(), f.shift || activeShiftName(), "TM.setRF('shift', this.value, false)"))}
            ${field("Sales Person", selectInput("redeem-agent", agentOptions(), f.agent, "TM.setRF('agent', this.value, false)"))}
          `)}
          ${formSection("Cashout Details", "tone-red", 4, `
            ${field("Game ID", textInput("redeem-gameid", f.gameId, "TM.setRF('gameId', this.value, false)", "onblur=\"TM.redeemLookup()\" required placeholder=\"Unique player game ID\""))}
            ${field("Game Name", selectInput("redeem-game", gameOptions(true), f.gameName, "TM.setRF('gameName', this.value, false)"))}
            ${field("Redeem Credits", numberInput("redeem-credits", f.rdCredits, "TM.setRF('rdCredits', this.value, false)", "required min=\"0\" placeholder=\"0\""))}
            ${field("Cashout Paid", numberInput("redeem-cashout", f.cashoutPaid, "TM.setRF('cashoutPaid', this.value, false)", "required min=\"0\" placeholder=\"0.00\""))}
          `)}
          ${redeemLookupInfo(f.gameId)}
          <div class="row end full">
            <button type="button" class="btn btn-ghost" onclick="TM.clearRedeem()">Clear</button>
            <button class="btn btn-danger" ${IS_ONLINE ? "" : "disabled"}>Add Redeem</button>
          </div>
        </div>
      </form>
      ${renderEntriesTable()}
    </section>`;
  }

  function renderGameBalanceTab() {
    return `<section class="game-balance-grid">
      ${DB.games.map((game) => {
        const usage = gameUsage(game);
        return `<article class="balance-card game-balance-card">
          <span class="badge bd-purple">${esc(game.name)}</span>
          <div class="row between"><span class="muted">Starting Balance</span><strong>${fmt$(game.backendLoaded)}</strong></div>
          <div class="row between"><span class="muted">Total Used</span><strong class="danger-text">-${fmt$(usage.used)}</strong></div>
          <div class="row between"><span class="muted">Total Redeem</span><strong class="success-text">${fmt$(usage.redeem)}</strong></div>
          <div class="row between"><span class="muted">Current Balance</span><strong class="${usage.current >= 0 ? "success-text" : "danger-text"}">${fmt$(usage.current)}</strong></div>
        </article>`;
      }).join("")}
    </section>`;
  }

  function attendanceStatus(record) {
    if (!record) return { label: "Not Arrived", cls: "", icon: "○" };
    if (record.status === "leave" || record.status === "off" || record.status === "leave-approved") return { label: record.status === "off" ? "Scheduled Off" : "On Leave", cls: "leave", icon: "●" };
    if (record.checkOutAt || record.checkOut) return { label: "Checked Out", cls: "done", icon: "●" };
    if (record.checkInAt || record.checkIn) return { label: record.late ? "Checked In Late" : "Checked In", cls: "in", icon: "●" };
    return { label: "Not Arrived", cls: "", icon: "○" };
  }

  function renderAttendanceTab() {
    const date = todayISO();
    const people = allPeople();
    const stats = { in: 0, out: 0, leave: 0, missing: 0 };
    const cards = people.map((person) => {
      const rec = getAttendance(person.id, date);
      const status = attendanceStatus(rec);
      if (status.cls === "in") stats.in += 1;
      else if (status.cls === "done") stats.out += 1;
      else if (status.cls === "leave") stats.leave += 1;
      else stats.missing += 1;
      const duration = rec?.checkInAt && !rec?.checkOutAt ? formatDuration(minutesBetween(rec.checkInAt, new Date().toISOString())) : formatDuration(rec?.duration || 0);
      return `<article class="person-card ${status.cls}">
        <h3><span>${esc(person.name)}</span><span class="avatar" style="background:${esc(person.color)}">${esc(initials(person.name))}</span></h3>
        <div class="status-line"><span class="status-icon">${status.icon}</span><strong>${esc(status.label)}</strong><span>${esc(person.role)}</span></div>
        <p class="muted">Duration on shift: ${duration}</p>
        <p class="subtle">Check In Time: ${rec?.checkInAt ? fmtTime(rec.checkInAt) : "Not Recorded"}</p>
        <p class="subtle">Check Out Time: ${rec?.checkOutAt ? fmtTime(rec.checkOutAt) : "Not Recorded"}</p>
        ${rec?.leaveReason || rec?.offReason ? `<p class="warn-text">Reason: ${esc(rec.leaveReason || rec.offReason)}</p>` : ""}
        <div class="row">
          ${!rec || (!rec.checkInAt && !rec.checkOutAt && !["leave", "off", "leave-approved"].includes(rec.status)) ? `<button class="btn btn-success btn-sm" onclick="TM.checkIn('${person.id}')" ${IS_ONLINE ? "" : "disabled"}>Check In</button><button class="btn btn-warn btn-sm" onclick="TM.markLeave('${person.id}')" ${IS_ONLINE ? "" : "disabled"}>Leave</button>` : ""}
          ${rec?.checkInAt && !rec?.checkOutAt ? `<button class="btn btn-primary btn-sm" onclick="TM.openCheckout('${person.id}')" ${IS_ONLINE ? "" : "disabled"}>Check Out</button>` : ""}
          ${rec && (rec.checkOutAt || ["leave", "off", "leave-approved"].includes(rec.status)) ? `<span class="badge bd-gray">Recorded</span>` : ""}
          <button class="btn btn-ghost btn-sm" onclick="TM.openLeaveRequest('${person.id}')">Leave Request</button>
        </div>
      </article>`;
    }).join("");
    return `<section class="stack">
      <div class="grid c4">
        <article class="kpi-card"><span>Currently In</span><strong>${stats.in}</strong><small>Working now</small></article>
        <article class="kpi-card"><span>Checked Out</span><strong>${stats.out}</strong><small>Done today</small></article>
        <article class="kpi-card"><span>On Leave</span><strong>${stats.leave}</strong><small>Leave or scheduled off</small></article>
        <article class="kpi-card"><span>Not Arrived</span><strong>${stats.missing}</strong><small>No record yet</small></article>
      </div>
      <div class="attendance-grid">${cards || `<div class="empty">No agents or staff are configured.</div>`}</div>
    </section>`;
  }

  function initials(name) {
    return String(name || "?").split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  }

  function renderEntriesTable() {
    const filters = [["all", "All"], ["paid", "Paid"], ["freeplay", "Freeplay"], ["redeem", "Redeem"]];
    const rows = activeEntries().filter((entry) => S.eFilter === "all" || entry.type === S.eFilter);
    return `<section class="fc" id="entries-host">
      <div class="fc-head">Entries</div>
      <div class="fg stack">
        <div class="row">${filters.map(([key, label]) => `<button class="btn btn-sm ${S.eFilter === key ? "btn-primary" : "btn-ghost"}" onclick="TM.setEntryFilter('${key}')">${label}</button>`).join("")}</div>
        <div class="tbl-wrap entries-table">
          <table>
            <thead><tr><th>#</th><th>Type</th><th>Date</th><th>Agent</th><th>Player Name</th><th>Game ID</th><th>Game Name</th><th>Deposit</th><th>Amount / Credits</th><th>Actions</th></tr></thead>
            <tbody>${rows.map((entry, index) => `<tr>
              <td>${index + 1}</td>
              <td>${entryBadges(entry)}</td>
              <td>${esc(isoToLabel(entry.date))}</td>
              <td>${esc(entry.agent)}</td>
              <td class="trunc">${esc(entry.playerName)}</td>
              <td class="mono">${esc(entry.gameId)}</td>
              <td>${esc(entry.gameName)}</td>
              <td>${moneyCell(entry.deposit)}</td>
              <td>${entry.type === "paid" ? fmt$(entry.recharge) : entry.type === "freeplay" ? fmt$(entry.fpAmount) : `${fmtPlain(entry.rdCredits)} credits / ${fmt$(entry.cashoutPaid)}`}</td>
              <td><div class="row"><button class="btn btn-xs btn-ghost" onclick="TM.editEntry('${entry.id}')">Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deleteEntry('${entry.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></div></td>
            </tr>`).join("") || `<tr><td colspan="10" class="empty">No entries yet.</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </section>`;
  }

  function entryBadges(entry) {
    const type = entry.type === "paid" ? `<span class="badge bd-cyan">Paid</span>` : entry.type === "freeplay" ? `<span class="badge bd-purple">Freeplay</span>` : `<span class="badge bd-red">Redeem</span>`;
    return `${type}${entry.isNewPlayer ? ` <span class="badge bd-green">New</span>` : ""}${entry.dispute ? ` <span class="badge bd-warn">Dispute</span>` : ""}`;
  }

  function entryStatus(entry) {
    return entry.dispute ? `<span class="badge bd-warn">Dispute</span>${entry.disputeNote ? `<small class="subtle">${esc(entry.disputeNote)}</small>` : ""}` : `<span class="badge bd-green">Clear</span>`;
  }

  function gatewayFee(methodId, payTag) {
    for (const vendor of DB.payVendors) {
      const row = vendor.fees.find((fee) => fee.payMethodId === methodId && (!fee.payTag || !payTag || fee.payTag === payTag));
      if (row) return num(row.fee);
    }
    return 0;
  }

  function renderClosedScreen() {
    const last = DB.closedShifts[0];
    const s = last?.summary || {};
    const day = s.daySummary || null;
    const isDay = s.closeType === "day";
    const title = isDay ? "Day Closed" : "Shift Closed";
    const agentNames = uniqueList((last?.entries || []).map((entry) => entry.agent));
    const agentRows = agentNames.map((agent) => {
      const k = kpisForEntries((last?.entries || []).filter((entry) => entry.agent === agent));
      return [esc(agent), fmtPlain(k.paidCount), fmt$(k.totalR), fmt$(k.totalDeposit), fmt$(k.totalFP), fmt$(k.totalCashout), fmtPlain(k.newPlayers)];
    });
    return `<div class="content-scroll">
      <section class="fc closed-panel">
        <div class="fc-head">${title}</div>
        <div class="fg stack">
          <h1 style="margin:0">${title}</h1>
          <p class="muted">${esc(s.shiftName || last?.label || "Current Shift")} is locked and archived. Start the next current shift before adding entries.</p>
          <h3>Closed Shift Summary</h3>
          <div class="grid c4">
            <article class="kpi-card"><span>Paid Recharges</span><strong>${s.paidCount || 0}</strong><small>${fmt$(s.totalR || 0)}</small></article>
            <article class="kpi-card"><span>Total Deposit</span><strong>${fmt$(s.totalDeposit || 0)}</strong><small>Archived Shift</small></article>
            <article class="kpi-card"><span>Freeplay</span><strong>${fmt$(s.totalFP || 0)}</strong><small>Freeplay amount</small></article>
            <article class="kpi-card"><span>Cashouts</span><strong>${fmt$(s.totalCashout || 0)}</strong><small>Cashout paid</small></article>
          </div>
          <p>New Players: <strong>${s.newPlayers || 0}</strong>. Duration: <strong>${formatDuration(s.durationMins || 0)}</strong>.</p>
          <h3>Sales Person Summary</h3>
          ${simpleTable(["Sales Person", "Paid Recharges", "Sales Amount", "Deposit", "Freeplay", "Cashouts", "New Players"], agentRows)}
          ${day ? `<h3>Total Day Summary</h3><div class="grid c4">
            <article class="kpi-card"><span>Day Sales</span><strong>${fmt$(day.totalR || 0)}</strong><small>${day.paidCount || 0} paid records</small></article>
            <article class="kpi-card"><span>Day Deposit</span><strong>${fmt$(day.totalDeposit || 0)}</strong><small>${day.closedShiftCount || 1} shifts</small></article>
            <article class="kpi-card"><span>Day Freeplay</span><strong>${fmt$(day.totalFP || 0)}</strong><small>Total day freeplay</small></article>
            <article class="kpi-card"><span>Day Cashouts</span><strong>${fmt$(day.totalCashout || 0)}</strong><small>Total day cashouts</small></article>
          </div>` : ""}
          <div><button class="btn btn-success" onclick="TM.startNewShift()">Start Current Shift</button></div>
        </div>
      </section>
    </div>`;
  }

  function renderAdminApp() {
    const sections = [
      ["dashboard", "Dashboard"],
      ["transactions", "Transactions"],
      ["performance", "Agent Performance"],
      ["targets", "Targets"],
      ["pnl", "P&L"],
      ["attendance", "Attendance"],
      ["shifts", "Shifts"],
      ["agents", "Agents"],
      ["staff", "Staff & Access"],
      ["games", "Games"],
      ["payMethods", "Payment Methods"],
      ["pages", "Page Names"],
      ["vendors", "Vendors"],
      ["supabase", "Supabase"],
      ["settings", "Settings"],
      ["backup", "Backup & Export"]
    ];
    return `<div class="admin-shell">
      <aside class="sidebar">${sections.map(([key, label]) => `<button class="btn btn-ghost ${S.adminSection === key ? "active" : ""}" onclick="TM.setAdmin('${key}')">${label}</button>`).join("")}</aside>
      <section class="admin-main">${renderAdminSection()}</section>
    </div>`;
  }

  function renderAdminSection() {
    switch (S.adminSection) {
      case "transactions": return renderAdminTransactions();
      case "performance": return renderAdminPerformance();
      case "targets": return renderAdminTargets();
      case "pnl": return renderAdminProfitLoss();
      case "attendance": return renderAdminAttendance();
      case "shifts": return renderAdminShifts();
      case "agents": return renderAdminAgents();
      case "staff": return renderAdminStaff();
      case "games": return renderAdminGames();
      case "payMethods": return renderAdminPayMethods();
      case "pages": return renderAdminPages();
      case "vendors": return renderAdminVendors();
      case "supabase": return renderAdminSupabase();
      case "settings": return renderAdminSettings();
      case "backup": return renderAdminBackup();
      default: return renderAdminDashboard();
    }
  }

  function renderAdminDashboard() {
    const entries = allEntries();
    const paid = entries.filter((entry) => entry.type === "paid");
    const freeplay = entries.filter((entry) => entry.type === "freeplay");
    const redeem = entries.filter((entry) => entry.type === "redeem");
    const shift = shiftKPIs();
    const target = monthlySalesSummary();
    const pnl = pnlSummary(entries.filter((entry) => String(entry.date || "").startsWith(monthKey())));
    return `<div class="stack">
      <section class="fc"><div class="fc-head">Current Shift Live Summary</div><div class="fg grid c5 dashboard-shift-grid">
        <article class="kpi-card"><span>Paid Count</span><strong>${shift.paidCount}</strong><small>Current Shift</small></article>
        <article class="kpi-card"><span>Sales Amount</span><strong>${fmt$(shift.totalR)}</strong><small>Current Shift</small></article>
        <article class="kpi-card"><span>Players Added</span><strong>${shift.newPlayers}</strong><small>Current Shift</small></article>
        <article class="kpi-card"><span>Cashout</span><strong>${fmt$(shift.totalCashout)}</strong><small>Current Shift</small></article>
        <article class="kpi-card"><span>Freeplay</span><strong>${fmt$(shift.totalFP)}</strong><small>Current Shift</small></article>
      </div></section>
      <section class="grid c4 admin-kpi-grid">
        <article class="kpi-card"><span>Current Month Sales</span><strong>${fmt$(target.recharge)}</strong><small>${paid.filter((entry) => String(entry.date || "").startsWith(monthKey())).length} records</small></article>
        <article class="kpi-card"><span>Current Month Cashouts</span><strong>${fmt$(redeem.filter((entry) => String(entry.date || "").startsWith(monthKey())).reduce((sum, entry) => sum + num(entry.cashoutPaid), 0))}</strong><small>This Month</small></article>
        <article class="kpi-card"><span>Total Freeplay</span><strong>${fmt$(freeplay.reduce((sum, entry) => sum + num(entry.fpAmount), 0))}</strong><small>${freeplay.length} records</small></article>
        <article class="kpi-card"><span>Cashouts Paid</span><strong>${fmt$(redeem.reduce((sum, entry) => sum + num(entry.cashoutPaid), 0))}</strong><small>${redeem.length} records</small></article>
        <article class="kpi-card"><span>Current Month New Players</span><strong>${target.newPlayers}</strong><small>This Month</small></article>
        <article class="kpi-card"><span>Current Month Margin</span><strong class="${pnl.margin >= 0 ? "success-text" : "danger-text"}">${fmt$(pnl.margin)}</strong><small>${fmtPlain(pnl.marginPct)}% margin</small></article>
        <article class="kpi-card"><span>Active Games</span><strong>${DB.games.length}</strong><small>Configured games</small></article>
        <article class="kpi-card"><span>Closed Shifts</span><strong>${DB.closedShifts.length}</strong><small>Archived shifts</small></article>
      </section>
      <section class="grid c2">
        <div class="fc dashboard-compact"><div class="fc-head">Game Balances</div><div class="fg">${simpleTable(["Game", "Loaded", "Current"], DB.games.map((game) => [esc(game.name), fmt$(game.backendLoaded), `<span class="${gameBal(game.id) >= 0 ? "success-text" : "danger-text"}">${fmt$(gameBal(game.id))}</span>`]))}</div></div>
        <div class="fc dashboard-compact"><div class="fc-head">Vendor Amount to Receive</div><div class="fg">${renderVendorNetTable()}</div></div>
      </section>
    </div>`;
  }

  function renderAdminTargets() {
    const s = monthlySalesSummary();
    const key = monthKey();
    const people = combinedPeople();
    const rows = people.map((person) => {
      const stats = personMonthStats(person.name, key);
      const salesTarget = num(person.targets?.deposit);
      const playerTarget = num(person.targets?.newPlayers);
      const salesLeft = Math.max(salesTarget - stats.sales, 0);
      const playersLeft = Math.max(playerTarget - stats.newPlayers, 0);
      const sourceLabel = person.source === "agent" ? "Agent" : "Staff";
      return `<tr>
        <td>${esc(person.name)}</td>
        <td>${esc(sourceLabel)}</td>
        <td>${roleBadge(person.role)}</td>
        <td><input id="target-${person.source}-${person.id}-sales" type="number" min="0" step="0.01" value="${esc(salesTarget)}"></td>
        <td>${fmt$(stats.sales)}</td>
        <td>${fmt$(salesLeft)}</td>
        <td><input id="target-${person.source}-${person.id}-players" type="number" min="0" step="1" value="${esc(playerTarget)}"></td>
        <td>${fmtPlain(stats.newPlayers)}</td>
        <td>${fmtPlain(playersLeft)}</td>
      </tr>`;
    }).join("");
    return `<section class="stack">
      <div class="fc"><div class="fc-head">Team Targets</div><div class="fg stack">
        <div class="grid c4 admin-kpi-grid">
          <article class="kpi-card"><span>Monthly Team Sales Target</span><strong>${s.salesTarget ? fmt$(s.salesTarget) : "Not Set"}</strong><small>Achieved ${fmt$(s.recharge)}${s.salesTarget ? ` (${s.salesPct}%)` : ""}</small><div class="progress-bar"><i style="width:${s.salesPct}%"></i></div></article>
          <article class="kpi-card"><span>Sales Target Remaining</span><strong>${fmt$(Math.max(s.salesTarget - s.recharge, 0))}</strong><small>Monthly recharge counts as sales</small></article>
          <article class="kpi-card"><span>Monthly New Player Target</span><strong>${s.playersTarget ? fmtPlain(s.playersTarget) : "Not Set"}</strong><small>Achieved ${fmtPlain(s.newPlayers)}${s.playersTarget ? ` (${s.playersPct}%)` : ""}</small><div class="progress-bar"><i style="width:${s.playersPct}%"></i></div></article>
          <article class="kpi-card"><span>New Player Target Remaining</span><strong>${fmtPlain(Math.max(s.playersTarget - s.newPlayers, 0))}</strong><small>Current month</small></article>
        </div>
        <div class="grid c2">
          ${field("Monthly Team Sales Target", `<input id="target-sales" type="number" step="0.01" min="0" value="${esc(DB.salesTargets.monthlySales)}">`)}
          ${field("Monthly New Player Target", `<input id="target-players" type="number" step="1" min="0" value="${esc(DB.salesTargets.monthlyNewPlayers)}">`)}
        </div>
        <div class="row"><button class="btn btn-primary" onclick="TM.saveTargets()" ${IS_ONLINE ? "" : "disabled"}>Save Targets</button><span id="sales-target-save-msg" class="success-text"></span></div>
      </div></div>
      <div class="fc"><div class="fc-head">Individual Monthly Targets</div><div class="fg stack">
        <div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Source</th><th>Role</th><th>Sales Target</th><th>Sales Achieved</th><th>Sales Remaining</th><th>New Player Target</th><th>New Players Achieved</th><th>New Players Remaining</th></tr></thead><tbody>
          ${rows || `<tr><td colspan="9" class="empty">No people found.</td></tr>`}
        </tbody></table></div>
      </div></div>
    </section>`;
  }

  function renderAdminProfitLoss() {
    const key = S.pnlMonth || monthKey();
    const rows = allEntries().filter((entry) => String(entry.date || "").startsWith(key));
    const summary = pnlSummary(rows);
    const gameRows = DB.games.map((game) => {
      const gameEntries = rows.filter((entry) => entry.gameId === game.id || entry.gameName === game.name);
      const p = pnlSummary(gameEntries);
      return [
        esc(game.name),
        fmtPlain(p.paidCount),
        fmt$(p.sales),
        fmt$(p.gatewayFees),
        fmt$(p.coinCost),
        fmt$(p.redeemedValue),
        fmt$(p.cashouts),
        `<span class="${p.margin >= 0 ? "success-text" : "danger-text"}">${fmt$(p.margin)}</span>`,
        `${fmtPlain(p.marginPct)}%`
      ];
    });
    return `<section class="stack">
      <div class="fc"><div class="fc-head">Profit and Loss</div><div class="fg stack">
        <div class="grid c3">
          ${field("Month", `<input id="pnl-month" type="month" value="${esc(key)}" onchange="TM.setS('pnlMonth', this.value)">`)}
          <div class="row end"><button class="btn btn-primary" onclick="TM.renderNow()">Apply Month</button></div>
        </div>
        <div class="grid c4 admin-kpi-grid">
          <article class="kpi-card"><span>Sales Amount</span><strong>${fmt$(summary.sales)}</strong><small>${summary.paidCount} paid transactions</small></article>
          <article class="kpi-card"><span>Gateway Fees</span><strong>${fmt$(summary.gatewayFees)}</strong><small>Payment vendor fee</small></article>
          <article class="kpi-card"><span>Coins Issued Cost</span><strong>${fmt$(summary.coinCost)}</strong><small>Paid and freeplay credits</small></article>
          <article class="kpi-card"><span>Redeemed Credits Value</span><strong>${fmt$(summary.redeemedValue)}</strong><small>${summary.noCashoutRedeemCount} without cashout</small></article>
          <article class="kpi-card"><span>Cashouts Paid</span><strong>${fmt$(summary.cashouts)}</strong><small>${summary.redeemCount} redeem records</small></article>
          <article class="kpi-card"><span>Estimated Margin</span><strong class="${summary.margin >= 0 ? "success-text" : "danger-text"}">${fmt$(summary.margin)}</strong><small>${fmtPlain(summary.marginPct)}% margin</small></article>
        </div>
      </div></div>
      <div class="fc"><div class="fc-head">Game Profit and Loss</div><div class="fg">${simpleTable(["Game", "Paid Transactions", "Sales Amount", "Gateway Fees", "Coins Issued Cost", "Redeemed Credits Value", "Cashouts Paid", "Estimated Margin", "Margin Percentage"], gameRows)}</div></div>
      <div class="fc"><div class="fc-head">Transaction Cost Detail</div><div class="fg">${simpleTable(["Date", "Type", "Sales Person", "Player Name", "Game Name", "Sales Amount", "Gateway Fee", "Coins Issued Cost", "Redeemed Credits Value", "Cashout Paid", "Margin"], rows.map((entry) => {
        const sales = entry.type === "paid" ? num(entry.recharge) : 0;
        const cost = entryCoinCost(entry);
        const gateway = entryGatewayFee(entry);
        const redeemed = entryRedeemValue(entry);
        const cashout = entry.type === "redeem" ? num(entry.cashoutPaid) : 0;
        const margin = sales - gateway - cost - redeemed - cashout;
        return [esc(isoToLabel(entry.date)), entryBadges(entry), esc(entry.agent), esc(entry.playerName), esc(entry.gameName), fmt$(sales), fmt$(gateway), fmt$(cost), fmt$(redeemed), fmt$(cashout), `<span class="${margin >= 0 ? "success-text" : "danger-text"}">${fmt$(margin)}</span>`];
      }))}</div></div>
    </section>`;
  }

  function simpleTable(heads, rows) {
    return `<div class="tbl-wrap"><table><thead><tr>${heads.map((head) => `<th>${esc(head)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${heads.length}" class="empty">No records.</td></tr>`}</tbody></table></div>`;
  }

  function filteredTransactions() {
    let rows = allEntries();
    const search = S.txSearch.trim().toLowerCase();
    if (search) {
      rows = rows.filter((entry) => [entry.playerName, entry.agent, entry.gameId, entry.gameName, entry.custTag, entry.legalName].some((value) => String(value || "").toLowerCase().includes(search)));
    }
    if (S.txType !== "all") rows = rows.filter((entry) => entry.type === S.txType);
    if (S.txAgent) rows = rows.filter((entry) => entry.agent === S.txAgent);
    if (S.txGame) rows = rows.filter((entry) => entry.gameName === S.txGame);
    if (S.txShift) rows = rows.filter((entry) => entry.shift === S.txShift || entry.shiftSession === S.txShift);
    if (S.txDate) rows = rows.filter((entry) => entry.date === S.txDate);
    if (S.txStartDate) rows = rows.filter((entry) => String(entry.date || "") >= S.txStartDate);
    if (S.txEndDate) rows = rows.filter((entry) => String(entry.date || "") <= S.txEndDate);
    rows.sort((a, b) => {
      if (S.txSort === "oldest") return String(a.createdAt || a.date).localeCompare(String(b.createdAt || b.date));
      if (S.txSort === "depositDown") return num(b.deposit) - num(a.deposit);
      if (S.txSort === "depositUp") return num(a.deposit) - num(b.deposit);
      if (S.txSort === "player") return String(a.playerName).localeCompare(String(b.playerName));
      if (S.txSort === "agent") return String(a.agent).localeCompare(String(b.agent));
      return String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date));
    });
    return rows;
  }

  function renderAdminTransactions() {
    const rows = filteredTransactions();
    const totalDeposit = rows.reduce((sum, entry) => sum + num(entry.deposit), 0);
    const totalRecharge = rows.reduce((sum, entry) => sum + num(entry.recharge), 0);
    const totalCashout = rows.reduce((sum, entry) => sum + num(entry.cashoutPaid), 0);
    return `<div class="fc"><div class="fc-head">Transactions</div><div class="fg stack">
      <div class="grid c4">
        ${field("Search", textInput("tx-search", S.txSearch, "TM.setS('txSearch', this.value, false)"))}
        ${field("Type", selectInput("tx-type", [["all", "All"], ["paid", "Paid"], ["freeplay", "Freeplay"], ["redeem", "Redeem"]], S.txType, "TM.setS('txType', this.value)"))}
        ${field("Sales Person", selectInput("tx-agent", [["", "All Sales People"], ...salesPeople().map((person) => [person.name, person.name])], S.txAgent, "TM.setS('txAgent', this.value)"))}
        ${field("Game", selectInput("tx-game", [["", "All Games"], ...DB.games.map((game) => [game.name, game.name])], S.txGame, "TM.setS('txGame', this.value)"))}
        ${field("Shift", selectInput("tx-shift", [["", "All Shifts"], ...DB.shifts.map((shift) => [shift.name, shift.name])], S.txShift, "TM.setS('txShift', this.value)"))}
        ${field("Start Date", dateInput("tx-start-date", S.txStartDate, "TM.setS('txStartDate', this.value)"))}
        ${field("End Date", dateInput("tx-end-date", S.txEndDate, "TM.setS('txEndDate', this.value)"))}
        ${field("Sort", selectInput("tx-sort", [["newest", "Newest First"], ["oldest", "Oldest First"], ["depositDown", "Deposit Down"], ["depositUp", "Deposit Up"], ["player", "Player A-Z"], ["agent", "Agent A-Z"]], S.txSort, "TM.setS('txSort', this.value)"))}
        <div class="row end"><button class="btn btn-primary" onclick="TM.renderNow()">Apply Filters</button><button class="btn btn-ghost" onclick="TM.clearTransactions()">Clear</button></div>
      </div>
      <p class="muted">${rows.length} records. Total deposit ${fmt$(totalDeposit)}. Total recharge ${fmt$(totalRecharge)}. Total cashout ${fmt$(totalCashout)}.</p>
      ${renderPlayerLookupPanel()}
      <div class="tbl-wrap"><table><thead><tr><th>#</th><th>Type</th><th>Session</th><th>Date</th><th>Sales Person</th><th>Player Name</th><th>Game ID</th><th>Game Name</th><th>Deposit</th><th>Amount / Credits</th><th>Cashout Paid</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${rows.map((entry, index) => `<tr class="${entry.dispute ? "dispute-row" : ""}"><td>${index + 1}</td><td>${entryBadges(entry)}</td><td>${esc(entry.shiftSession || "Current")}</td><td>${esc(isoToLabel(entry.date))}</td><td>${esc(entry.agent)}</td><td>${esc(entry.playerName)}</td><td class="mono">${esc(entry.gameId)}</td><td>${esc(entry.gameName)}</td><td>${fmt$(entry.deposit)}</td><td>${entry.type === "paid" ? fmt$(entry.recharge) : entry.type === "freeplay" ? fmt$(entry.fpAmount) : `${fmtPlain(entry.rdCredits)} credits`}</td><td>${fmt$(entry.cashoutPaid)}</td><td>${entryStatus(entry)}</td><td><div class="row"><button class="btn btn-xs btn-ghost" onclick="TM.editEntry('${entry.id}')">Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deleteEntry('${entry.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></div></td></tr>`).join("") || `<tr><td colspan="13" class="empty">No transactions match these filters.</td></tr>`}
      </tbody></table></div>
    </div></div>`;
  }

  function renderPlayerLookupPanel() {
    const query = S.txPlayerLookup.trim().toLowerCase();
    const rows = query ? allEntries().filter((entry) => [entry.playerName, entry.gameId, entry.legalName, entry.contact, entry.email].some((value) => String(value || "").toLowerCase().includes(query))) : [];
    const month = monthKey();
    const monthly = rows.filter((entry) => String(entry.date || "").startsWith(month));
    const stat = (list, type, key) => list.filter((entry) => !type || entry.type === type).reduce((sum, entry) => sum + num(entry[key]), 0);
    const creditsCost = rows.reduce((sum, entry) => {
      const game = DB.games.find((item) => item.name === entry.gameName || item.id === entry.gameId);
      return sum + (entry.type === "redeem" ? (num(entry.rdCredits) / 1000) * num(game?.pricePer1k) : 0);
    }, 0);
    return `<section class="fc player-lookup"><div class="fc-head">Player Lookup</div><div class="fg stack">
      <div class="grid c3">
        ${field("Search Player, Game ID, Legal Name, Contact, or Email", `<input value="${esc(S.txPlayerLookup)}" oninput="TM.setS('txPlayerLookup', this.value, false)" placeholder="Search one player">`)}
        <div class="row end"><button class="btn btn-primary" onclick="TM.renderNow()">Search Player</button><button class="btn btn-ghost" onclick="TM.clearPlayerLookup()">Clear</button></div>
      </div>
      ${query ? `<div class="grid c4">
        <article class="kpi-card"><span>All-Time Sales</span><strong>${fmt$(stat(rows, "paid", "recharge"))}</strong><small>${rows.filter((entry) => entry.type === "paid").length} paid records</small></article>
        <article class="kpi-card"><span>All-Time Deposit</span><strong>${fmt$(stat(rows, "paid", "deposit"))}</strong><small>Money received</small></article>
        <article class="kpi-card"><span>Monthly Sales</span><strong>${fmt$(stat(monthly, "paid", "recharge"))}</strong><small>Current month</small></article>
        <article class="kpi-card"><span>Monthly Deposit</span><strong>${fmt$(stat(monthly, "paid", "deposit"))}</strong><small>Current month</small></article>
        <article class="kpi-card"><span>Cashouts Paid</span><strong>${fmt$(stat(rows, "redeem", "cashoutPaid"))}</strong><small>All Time</small></article>
        <article class="kpi-card"><span>Redeem Credits</span><strong>${fmtPlain(stat(rows, "redeem", "rdCredits"))}</strong><small>Credits given</small></article>
        <article class="kpi-card"><span>Credits Given Cost</span><strong>${fmt$(creditsCost)}</strong><small>Based on game price per 1000 credits</small></article>
      </div>` : `<p class="muted">Search a player to see all-time and monthly sales, cashouts, redeem credits, and estimated credit cost.</p>`}
    </div></section>`;
  }

  function performanceRows() {
    let rows = allEntries();
    if (S.pfDate) rows = rows.filter((entry) => String(entry.date || "").includes(S.pfDate));
    if (S.pfShift) rows = rows.filter((entry) => entry.shift === S.pfShift || entry.shiftSession === S.pfShift);
    return rows;
  }

  function renderAdminPerformance() {
    const rows = performanceRows();
    const agents = salesPeople().map((agent) => {
      const mine = rows.filter((entry) => entry.agent === agent.name);
      const paid = mine.filter((entry) => entry.type === "paid");
      const deposit = paid.reduce((sum, entry) => sum + num(entry.deposit), 0);
      const recharge = paid.reduce((sum, entry) => sum + num(entry.recharge), 0);
      const freeplay = mine.filter((entry) => entry.type === "freeplay").reduce((sum, entry) => sum + num(entry.fpAmount), 0);
      const cashouts = mine.filter((entry) => entry.type === "redeem").reduce((sum, entry) => sum + num(entry.cashoutPaid), 0);
      const newPlayers = mine.filter((entry) => entry.isNewPlayer).length;
      const uniquePlayers = new Set(mine.map((entry) => entry.playerName).filter(Boolean)).size;
      return { agent: agent.name, paidCount: paid.length, deposit, recharge, freeplay, cashouts, newPlayers, uniquePlayers, average: paid.length ? deposit / paid.length : 0 };
    }).sort((a, b) => b.deposit - a.deposit);
    const totalDeposit = agents.reduce((sum, row) => sum + row.deposit, 0);
    const top = agents.slice(0, 4);
    return `<div class="stack">
      <section class="fc"><div class="fc-head">Agent Performance</div><div class="fg stack">
        <div class="grid c4">
          ${field("Date", dateInput("pf-date", S.pfDate, "TM.setS('pfDate', this.value, false)"))}
          ${field("Shift", selectInput("pf-shift", [["", "All Shifts"], ...DB.shifts.map((shift) => [shift.name, shift.name]), ...DB.closedShifts.map((shift) => [shift.label, shift.label])], S.pfShift, "TM.setS('pfShift', this.value)"))}
          <div class="row end"><button class="btn btn-primary" onclick="TM.renderNow()">Apply Filters</button><button class="btn btn-ghost" onclick="TM.clearPerformance()">Clear</button><button class="btn btn-success" onclick="TM.exportPerformance()">Export Comma Separated Values</button></div>
        </div>
      </div></section>
      <section class="grid c4">${top.map((row, index) => `<article class="kpi-card"><span>Rank ${index + 1}</span><strong>${esc(row.agent)}</strong><small>${fmt$(row.deposit)} deposit, ${row.paidCount} paid, ${row.newPlayers} new players</small></article>`).join("")}</section>
      <section class="grid c4">
        <article class="kpi-card"><span>Total Deposits</span><strong>${fmt$(totalDeposit)}</strong><small>All Agents</small></article>
        <article class="kpi-card"><span>Total Recharges</span><strong>${fmt$(agents.reduce((sum, row) => sum + row.recharge, 0))}</strong><small>All Agents</small></article>
        <article class="kpi-card"><span>New Players Brought</span><strong>${agents.reduce((sum, row) => sum + row.newPlayers, 0)}</strong><small>All Agents</small></article>
        <article class="kpi-card"><span>Agents Active</span><strong>${agents.filter((row) => row.paidCount || row.freeplay || row.cashouts).length}</strong><small>With activity</small></article>
      </section>
      <section class="fc"><div class="fc-head">Leaderboard</div><div class="fg">
      <div class="tbl-wrap"><table><thead><tr><th>Agent</th><th>Paid Transactions</th><th>Total Deposit</th><th>Total Recharge</th><th>Freeplay Given</th><th>Cashouts</th><th>New Players</th><th>Unique Players</th><th>Average Deposit per Transaction</th></tr></thead><tbody>
      ${agents.map((row) => `<tr><td>${esc(row.agent)}</td><td>${row.paidCount}</td><td><div class="progress-bar"><i style="width:${totalDeposit ? Math.round((row.deposit / totalDeposit) * 100) : 0}%"></i></div>${fmt$(row.deposit)}</td><td>${fmt$(row.recharge)}</td><td>${fmt$(row.freeplay)}</td><td>${fmt$(row.cashouts)}</td><td>${row.newPlayers}</td><td>${row.uniquePlayers}</td><td>${fmt$(row.average)}</td></tr>`).join("")}</tbody></table></div>
      </div></section>
      <section class="fc"><div class="fc-head">Per-Agent Game Breakdown</div><div class="fg card-grid">${agents.map((row) => renderAgentGameBreakdown(row.agent, rows)).join("")}</div></section>
    </div>`;
  }

  function renderAgentGameBreakdown(agent, rows) {
    const games = {};
    rows.filter((entry) => entry.agent === agent && entry.type === "paid").forEach((entry) => {
      games[entry.gameName] = games[entry.gameName] || { count: 0, deposit: 0 };
      games[entry.gameName].count += 1;
      games[entry.gameName].deposit += num(entry.deposit);
    });
    return `<article class="balance-card"><strong>${esc(agent)}</strong>${Object.entries(games).map(([name, data]) => `<div class="row between"><span>${esc(name)}</span><span>${data.count} records, ${fmt$(data.deposit)}</span></div>`).join("") || `<span class="muted">No paid transactions.</span>`}</article>`;
  }

  function renderAdminAttendance() {
    const tabs = [["daily", "Daily Records"], ["monthly", "Monthly Attendance"], ["progress", "Monthly Progress"], ["leave", "Leave Requests"], ["scheduled", "Schedule Off"], ["settings", "Attendance Settings"]];
    return `<div class="stack">
      <div class="subtabs">${tabs.map(([key, label]) => `<button class="tab ${S.adminAttendanceTab === key ? "active" : ""}" onclick="TM.setAttendanceAdmin('${key}')">${label}</button>`).join("")}</div>
      ${S.adminAttendanceTab === "monthly" ? renderMonthlyAttendance() : S.adminAttendanceTab === "progress" ? renderMonthlyProgress() : S.adminAttendanceTab === "leave" ? renderLeaveRequestsAdmin() : S.adminAttendanceTab === "scheduled" ? renderScheduledOffAdmin() : S.adminAttendanceTab === "settings" ? renderAttendanceSettings() : renderAttendanceDaily()}
    </div>`;
  }

  function renderAttendanceDaily() {
    const rows = DB.attendance.filter((record) => {
      if (S.afAgent && record.agentId !== S.afAgent) return false;
      if (S.afDate && !String(record.date).includes(S.afDate)) return false;
      if (S.afStatus !== "all" && record.status !== S.afStatus) return false;
      return true;
    });
    const people = allPeople();
    const cards = people.map((person) => {
      const records = DB.attendance.filter((record) => record.agentId === person.id);
      const present = records.filter((record) => ["present", "completed"].includes(record.status)).length;
      const leave = records.filter((record) => ["leave", "leave-approved", "off"].includes(record.status)).length;
      const hours = records.reduce((sum, record) => sum + num(record.duration), 0) / 60;
      return `<article class="kpi-card"><span>${esc(person.name)}</span><strong>${present} present</strong><small>${leave} leave, ${hours.toFixed(1)} hours</small></article>`;
    }).join("");
    return `<section class="stack">
      <div class="grid c4">${cards}</div>
      <div class="fc"><div class="fc-head">Attendance Log</div><div class="fg stack">
        <div class="grid c4">
          ${field("Employee", selectInput("af-agent", [["", "All Employees"], ...people.map((person) => [person.id, person.name])], S.afAgent, "TM.setS('afAgent', this.value)"))}
          ${field("Date", dateInput("af-date", S.afDate, "TM.setS('afDate', this.value, false)"))}
          ${field("Status", selectInput("af-status", [["all", "All"], ["present", "Present"], ["completed", "Completed"], ["leave", "Leave"], ["off", "Scheduled Off"], ["absent", "Absent"]], S.afStatus, "TM.setS('afStatus', this.value)"))}
          <div class="row end"><button class="btn btn-primary" onclick="TM.renderNow()">Apply Filters</button><button class="btn btn-ghost" onclick="TM.clearAttendanceFilters()">Clear</button><button class="btn btn-success" onclick="TM.exportAttendance()">Export Comma Separated Values</button></div>
        </div>
        <div class="tbl-wrap"><table><thead><tr><th>Employee</th><th>Date</th><th>Status</th><th>Check In Time</th><th>Check Out Time</th><th>Hours Worked</th><th>Leave Reason</th><th>Actions</th></tr></thead><tbody>
          ${rows.map((record) => `<tr><td>${esc(record.agentName)}</td><td>${esc(isoToLabel(record.date))}</td><td>${attendanceBadge(record)}</td><td>${record.checkInAt ? fmtTime(record.checkInAt) : ""}</td><td>${record.checkOutAt ? fmtTime(record.checkOutAt) : ""}</td><td>${formatDuration(record.duration)}</td><td>${esc(record.leaveReason || record.offReason || "")}</td><td><div class="row"><button class="btn btn-xs btn-ghost" onclick="TM.correctAttendance('${record.id}')">Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deleteAttendance('${record.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></div></td></tr>`).join("") || `<tr><td colspan="8" class="empty">No attendance records.</td></tr>`}
        </tbody></table></div>
      </div></div>
    </section>`;
  }

  function attendanceBadge(record) {
    if (record.status === "completed") return `<span class="badge bd-gray">Completed</span>`;
    if (record.status === "leave" || record.status === "leave-approved") return `<span class="badge bd-warn">Leave</span>`;
    if (record.status === "off") return `<span class="badge bd-purple">Scheduled Off</span>`;
    if (record.status === "absent") return `<span class="badge bd-red">Absent</span>`;
    return `<span class="badge ${record.late ? "bd-warn" : "bd-green"}">${record.late ? "Late" : "Present"}</span>`;
  }

  function renderMonthlyAttendance() {
    const days = monthDays(S.month);
    const people = allPeople();
    return `<section class="fc"><div class="fc-head">Monthly Attendance</div><div class="fg stack">
      <div class="row">${field("Month", `<input type="month" value="${esc(S.month)}" onchange="TM.setS('month', this.value)">`)}<button class="btn btn-success" onclick="TM.exportMonthlyAttendance()">Export Comma Separated Values</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>Date</th>${people.map((person) => `<th>${esc(person.name)}</th>`).join("")}</tr></thead><tbody>
        ${days.map((day) => `<tr><td>${esc(isoToLabel(day))}</td>${people.map((person) => `<td>${attendanceShort(getAttendance(person.id, day), day)}</td>`).join("")}</tr>`).join("")}
      </tbody></table></div>
    </div></section>`;
  }

  function attendanceShort(record, day) {
    if (day > todayISO()) return `<span class="badge bd-gray">Future</span>`;
    if (!record) return `<span class="badge bd-red">Absent</span>`;
    if (record.status === "off") return `<span class="badge bd-purple">Off</span>`;
    if (record.status === "leave" || record.status === "leave-approved") return `<span class="badge bd-warn">Leave</span>`;
    if (record.checkInAt) return `<span class="badge ${record.late ? "bd-warn" : "bd-green"}">${record.late ? "Late" : "Present"}</span><br><small>${fmtTime(record.checkInAt)}</small>`;
    return `<span class="badge bd-red">Absent</span>`;
  }

  function renderMonthlyProgress() {
    const people = allPeople();
    const personId = S.attendancePerson || people[0]?.id || "";
    const records = DB.attendance.filter((record) => record.agentId === personId && String(record.date).startsWith(S.month) && record.report);
    const totals = REPORT_FIELDS.reduce((acc, field) => {
      acc[field.key] = records.reduce((sum, record) => sum + num(record.report?.[field.key]), 0);
      return acc;
    }, {});
    const person = personById(personId);
    const pace = targetPace(person, totals);
    return `<section class="fc"><div class="fc-head">Monthly Progress</div><div class="fg stack">
      <div class="grid c3">
        ${field("Month", `<input type="month" value="${esc(S.month)}" onchange="TM.setS('month', this.value)">`)}
        ${field("Employee", selectInput("progress-person", people.map((person) => [person.id, person.name]), personId, "TM.setS('attendancePerson', this.value)"))}
        <div class="row end"><button class="btn btn-success" onclick="TM.exportMonthlyProgress()">Export Comma Separated Values</button></div>
      </div>
      <div class="grid c4">
        <article class="kpi-card"><span>New Players</span><strong>${fmtPlain(totals.newPlayers)}</strong><small>Target ${fmtPlain(person?.targets?.newPlayers || 0)}</small></article>
        <article class="kpi-card"><span>Deposit</span><strong>${fmt$(totals.deposit)}</strong><small>Target ${fmt$(person?.targets?.deposit || 0)}</small></article>
        <article class="kpi-card"><span>Expected Players</span><strong>${fmtPlain(pace.expectedPlayers)}</strong><small>Behind ${fmtPlain(pace.playersBehind)}</small></article>
        <article class="kpi-card"><span>Expected Deposit</span><strong>${fmt$(pace.expectedDeposit)}</strong><small>Behind ${fmt$(pace.depositBehind)}</small></article>
      </div>
      <div class="tbl-wrap"><table><thead><tr><th>Date</th>${REPORT_FIELDS.map((field) => `<th>${esc(field.label)}</th>`).join("")}<th>Total Players</th></tr></thead><tbody>
      ${records.map((record) => `<tr><td>${esc(isoToLabel(record.date))}</td>${REPORT_FIELDS.map((field) => `<td>${fmtPlain(record.report?.[field.key] || 0)}</td>`).join("")}<td>${fmtPlain(record.report?.totalPlayers || 0)}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">No progress reports yet.</td></tr>`}
      </tbody></table></div>
    </div></section>`;
  }

  function targetPace(person, totals) {
    const now = new Date();
    const days = monthDays(S.month);
    const elapsed = S.month === monthKey() ? Math.max(1, now.getDate()) : days.length;
    const totalDays = days.length || 1;
    const playersTarget = num(person?.targets?.newPlayers);
    const depositTarget = num(person?.targets?.deposit);
    const expectedPlayers = Math.round((playersTarget / totalDays) * elapsed);
    const expectedDeposit = Math.round((depositTarget / totalDays) * elapsed);
    return {
      expectedPlayers,
      expectedDeposit,
      playersBehind: Math.max(0, expectedPlayers - num(totals.newPlayers)),
      depositBehind: Math.max(0, expectedDeposit - num(totals.deposit))
    };
  }

  function renderLeaveRequestsAdmin() {
    return `<section class="fc"><div class="fc-head">Leave Requests</div><div class="fg">
      <div class="tbl-wrap"><table><thead><tr><th>Employee</th><th>Date</th><th>Reason</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${DB.leaveRequests.map((request) => `<tr><td>${esc(personById(request.employeeId)?.name || "Unknown")}</td><td>${esc(isoToLabel(request.date))}</td><td>${esc(request.reason)}</td><td>${esc(request.description)}</td><td>${leaveBadge(request.status)}</td><td><div class="row"><button class="btn btn-xs btn-success" onclick="TM.reviewLeave('${request.id}', true)" ${IS_ONLINE ? "" : "disabled"}>Approve</button><button class="btn btn-xs btn-warn" onclick="TM.reviewLeave('${request.id}', false)" ${IS_ONLINE ? "" : "disabled"}>Reject</button><button class="btn btn-xs btn-ghost" onclick="TM.editLeaveRequest('${request.id}')">Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deleteLeaveRequest('${request.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></div></td></tr>`).join("") || `<tr><td colspan="6" class="empty">No leave requests.</td></tr>`}
      </tbody></table></div>
    </div></section>`;
  }

  function leaveBadge(status) {
    const cls = status === "approved" ? "bd-green" : status === "rejected" ? "bd-red" : status === "cancel-requested" ? "bd-warn" : "bd-gray";
    return `<span class="badge ${cls}">${esc(String(status || "pending").replace(/-/g, " "))}</span>`;
  }

  function renderScheduledOffAdmin() {
    const people = allPeople();
    return `<section class="grid c2">
      <form class="fc" onsubmit="TM.addScheduledOff(event)"><div class="fc-head">Schedule Off</div><div class="fg stack">
        ${field("Employee", selectInput("off-person", people.map((person) => [person.id, person.name]), people[0]?.id || ""))}
        ${field("Date", dateInput("off-date", todayISO(), ""))}
        ${field("Reason", selectInput("off-reason", DB.attendanceSettings.offReasons.map((reason) => [reason, reason]), DB.attendanceSettings.offReasons[0] || ""))}
        ${field("Custom Reason", textInput("off-custom", "", ""))}
        <button class="btn btn-primary" ${IS_ONLINE ? "" : "disabled"}>Save Schedule Off</button>
      </div></form>
      <div class="fc"><div class="fc-head">Scheduled Off Records</div><div class="fg">${simpleTable(["Employee", "Date", "Reason", "Actions"], DB.scheduledOff.map((item) => [esc(personById(item.employeeId)?.name || "Unknown"), esc(isoToLabel(item.date)), esc(item.reason), `<button class="btn btn-xs btn-danger" onclick="TM.deleteScheduledOff('${item.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button>`]))}</div></div>
    </section>`;
  }

  function renderAttendanceSettings() {
    return `<section class="grid c2">
      <div class="fc"><div class="fc-head">Leave Reasons</div><div class="fg stack">
        <div class="pill-list">${DB.attendanceSettings.leaveReasons.map((reason) => `<span class="pill">${esc(reason)} <button class="btn btn-xs btn-danger" onclick="TM.removeAttendanceReason('leaveReasons','${escAttr(reason)}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></span>`).join("")}</div>
        <div class="row">${textInput("new-leave-reason", "", "", "placeholder=\"New leave reason\"")}<button class="btn btn-primary" onclick="TM.addAttendanceReason('leaveReasons','new-leave-reason')" ${IS_ONLINE ? "" : "disabled"}>Add Leave Reason</button></div>
      </div></div>
      <div class="fc"><div class="fc-head">Off Reasons</div><div class="fg stack">
        <div class="pill-list">${DB.attendanceSettings.offReasons.map((reason) => `<span class="pill">${esc(reason)} <button class="btn btn-xs btn-danger" onclick="TM.removeAttendanceReason('offReasons','${escAttr(reason)}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></span>`).join("")}</div>
        <div class="row">${textInput("new-off-reason", "", "", "placeholder=\"New off reason\"")}<button class="btn btn-primary" onclick="TM.addAttendanceReason('offReasons','new-off-reason')" ${IS_ONLINE ? "" : "disabled"}>Add Off Reason</button></div>
        ${field("Late Grace Minutes", numberInput("late-grace", DB.attendanceSettings.lateGraceMinutes, "TM.updateLateGrace(this.value)", "min=\"0\" step=\"1\""))}
      </div></div>
    </section>`;
  }

  function escAttr(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  function renderAdminShifts() {
    return `<section class="fc"><div class="fc-head">Shifts</div><div class="fg stack">
      <div class="row end"><button class="btn btn-primary" onclick="TM.openModal('addShift')" ${IS_ONLINE ? "" : "disabled"}>Add Shift</button></div>
      ${simpleTable(["Name", "Start", "End", "Actions"], DB.shifts.map((shift) => [esc(shift.name), esc(shift.start), esc(shift.end), `<button class="btn btn-xs btn-danger" onclick="TM.deleteShift('${shift.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button>`]))}
    </div></section>`;
  }

  function renderAdminAgents() {
    return `<section class="fc"><div class="fc-head">Agents</div><div class="fg stack">
      <div class="row end"><button class="btn btn-primary" onclick="TM.openModal('addAgent')" ${IS_ONLINE ? "" : "disabled"}>Add Agent</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Shift</th><th>Attendance Required</th><th>Show Name in Sales Forms</th><th>Monthly New Player Target</th><th>Monthly Sales Target</th><th>Color</th><th>Actions</th></tr></thead><tbody>
      ${DB.agents.map((agent) => `<tr><td>${esc(agent.name)}</td><td><span class="badge bd-gray">${esc(agent.role || "agent")}</span></td><td>${esc(shiftById(agent.shiftId)?.name || "")}</td><td>${yesNoBadge(agent.attendanceRequired !== false)}</td><td>${yesNoBadge(agent.showInDeposits !== false)}</td><td>${fmtPlain(agent.targets?.newPlayers || 0)}</td><td>${fmt$(agent.targets?.deposit || 0)}</td><td><span class="dot on" style="background:${esc(agent.color)}"></span></td><td><div class="row"><button class="btn btn-xs btn-ghost" onclick="TM.openAgentEdit('${agent.id}')" ${IS_ONLINE ? "" : "disabled"}>Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deleteAgent('${agent.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></div></td></tr>`).join("")}
      </tbody></table></div>
    </div></section>`;
  }

  function renderAdminStaff() {
    return `<section class="stack">
      <div class="fc"><div class="fc-head">Staff & Access</div><div class="fg stack">
        <div class="row end"><button class="btn btn-primary" onclick="TM.openModal('staff')" ${IS_ONLINE ? "" : "disabled"}>Add Staff</button></div>
        <div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Attendance Required</th><th>Show Name in Sales Forms</th><th>Permissions Count</th><th>Actions</th></tr></thead><tbody>
        ${DB.staff.map((staff) => `<tr><td>${esc(staff.name)}</td><td>${esc(staff.email)}</td><td>${roleBadge(staff.role)}</td><td>${yesNoBadge(!!staff.attendanceRequired)}</td><td>${yesNoBadge(!!staff.showInDeposits)}</td><td>${(staff.perms || []).length}</td><td><div class="row"><button class="btn btn-xs btn-ghost" onclick="TM.openStaffEdit('${staff.id}')" ${IS_ONLINE ? "" : "disabled"}>Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deleteStaff('${staff.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></div></td></tr>`).join("") || `<tr><td colspan="7" class="empty">No staff records.</td></tr>`}
        </tbody></table></div>
      </div></div>
      <div class="fc"><div class="fc-head">Role Defaults Reference</div><div class="fg grid c2">
        ${Object.entries(ROLE_DEFAULTS).map(([role, perms]) => `<article class="balance-card"><strong>${esc(roleName(role))}</strong><p class="muted">${perms.join(", ")}</p></article>`).join("")}
      </div></div>
    </section>`;
  }

  function roleName(role) {
    return String(role || "").replace(/^\w/, (ch) => ch.toUpperCase());
  }

  function roleBadge(role) {
    const cls = role === "owner" ? "bd-warn" : role === "admin" ? "bd-cyan" : role === "manager" ? "bd-purple" : role === "supervisor" ? "bd-green" : "bd-gray";
    return `<span class="badge ${cls}">${esc(roleName(role))}</span>`;
  }

  function yesNoBadge(value) {
    return `<span class="badge ${value ? "bd-green" : "bd-gray"}">${value ? "Yes" : "No"}</span>`;
  }

  function renderAdminGames() {
    return `<section class="fc"><div class="fc-head">Games</div><div class="fg stack">
      <div class="row end"><button class="btn btn-primary" onclick="TM.openModal('addGame')" ${IS_ONLINE ? "" : "disabled"}>Add Game</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>Game Name</th><th>Game Vendor</th><th>Backend Loaded</th><th>Current Balance</th><th>Price per 1000 Credits</th><th>Backend Link</th><th>Player Link</th><th>Username</th><th>Password</th><th>Actions</th></tr></thead><tbody>
      ${DB.games.map((game) => S.editGameId === game.id ? renderGameEditRow(game) : renderGameRow(game)).join("")}
      </tbody></table></div>
    </div></section>`;
  }

  function renderGameRow(game) {
    const vendor = DB.gameVendors.find((item) => item.id === game.gameVendorId);
    const current = gameBal(game.id);
    return `<tr><td>${esc(game.name)}</td><td><span class="badge bd-purple">${esc(vendor?.name || "Unassigned")}</span></td><td>${fmt$(game.backendLoaded)}</td><td><span class="${current >= 0 ? "success-text" : "danger-text"}">${fmt$(current)}</span></td><td>${fmt$(game.pricePer1k)}</td><td>${linkCell(game.backendLink)}</td><td>${linkCell(game.playerLink)}</td><td>${esc(game.username)}</td><td>${esc(game.password)}</td><td><div class="row"><button class="btn btn-xs btn-success" onclick="TM.topUpGame('${game.id}')" ${IS_ONLINE ? "" : "disabled"}>Top-up Backend</button><button class="btn btn-xs btn-warn" onclick="TM.setGameBalance('${game.id}')" ${IS_ONLINE ? "" : "disabled"}>Set Balance</button><button class="btn btn-xs btn-ghost" onclick="TM.editGame('${game.id}')">Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deleteGame('${game.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></div></td></tr>`;
  }

  function linkCell(link) {
    if (!link) return `<span class="muted">No Link</span>`;
    return `<span class="copy-row"><a href="${esc(link)}" target="_blank" rel="noreferrer">Open link</a><button class="btn btn-xs btn-ghost" onclick="TM.copy('${escAttr(link)}')">Copy</button></span>`;
  }

  function renderGameEditRow(game) {
    return `<tr><td><input id="eg-name" value="${esc(game.name)}"></td><td>${selectInput("eg-vendor", [["", "Unassigned"], ...DB.gameVendors.map((vendor) => [vendor.id, vendor.name])], game.gameVendorId || "")}</td><td>${fmt$(game.backendLoaded)}</td><td>${fmt$(gameBal(game.id))}</td><td><input id="eg-price" type="number" step="0.01" value="${esc(game.pricePer1k)}"></td><td><input id="eg-backend" value="${esc(game.backendLink)}"></td><td><input id="eg-player" value="${esc(game.playerLink)}"></td><td><input id="eg-user" value="${esc(game.username)}"></td><td><input id="eg-pass" value="${esc(game.password)}"></td><td><div class="row"><button class="btn btn-xs btn-success" onclick="TM.saveGameEdit('${game.id}')" ${IS_ONLINE ? "" : "disabled"}>Save</button><button class="btn btn-xs btn-ghost" onclick="TM.cancelGameEdit()">Cancel</button></div></td></tr>`;
  }

  function renderAdminPayMethods() {
    const archived = S.payMethodSection === "archived";
    return `<section class="stack">
      <div class="subtabs"><button class="tab ${!archived ? "active" : ""}" onclick="TM.setPayMethodSection('active')">Active Tags</button><button class="tab ${archived ? "active" : ""}" onclick="TM.setPayMethodSection('archived')">Archived Tags</button></div>
      <div class="grid c3">${DB.payMethods.map((method) => {
        const tags = method.tags.filter((tag) => archived ? tag.active === false : tag.active !== false);
        return `<article class="fc"><div class="fc-head">${esc(method.name)}</div><div class="fg stack">
        <p class="muted">Payment tags are created from Payment Vendors when you add a vendor fee row.</p>
        <div class="pill-list">${tags.map((tag) => `<span class="pill ${tag.active === false ? "archived" : ""}">${esc(tag.tag)} ${tag.active === false ? `<span class="badge bd-gray">Archived</span><button class="btn btn-xs btn-success" onclick="TM.togglePayTag('${method.id}','${tag.id}',true)" ${IS_ONLINE ? "" : "disabled"}>Restore</button>` : `<button class="btn btn-xs btn-warn" onclick="TM.togglePayTag('${method.id}','${tag.id}',false)" ${IS_ONLINE ? "" : "disabled"}>Archive</button>`}</span>`).join("") || `<span class="muted">No ${archived ? "archived" : "active"} tags.</span>`}</div>
        <button class="btn btn-danger btn-sm" onclick="TM.deletePayMethod('${method.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete Payment Method</button>
      </div></article>`;
      }).join("")}
      <article class="fc"><div class="fc-head">Add Payment Method</div><div class="fg stack"><p class="muted">Create the method here, then add tags from Payment Vendors.</p><button class="btn btn-primary" onclick="TM.openModal('payMethod')" ${IS_ONLINE ? "" : "disabled"}>Add Payment Method</button></div></article>
      </div>
    </section>`;
  }

  function renderAdminPages() {
    return `<section class="fc"><div class="fc-head">Page Names</div><div class="fg stack">
      <div class="row end"><button class="btn btn-primary" onclick="TM.openModal('pageName')" ${IS_ONLINE ? "" : "disabled"}>Add Page Name</button></div>
      ${simpleTable(["Page Name", "Link", "Access Given To", "Actions"], DB.pageNames.map((page) => [esc(page.name), page.link ? `<a href="${esc(page.link)}" target="_blank" rel="noreferrer">Open Link</a>` : `<span class="muted">No Link</span>`, esc(page.accessTo || ""), `<div class="row"><button class="btn btn-xs btn-ghost" onclick="TM.editPage('${page.id}')" ${IS_ONLINE ? "" : "disabled"}>Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deletePage('${page.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></div>`]))}
    </div></section>`;
  }

  function renderVendorNetTable() {
    const rows = DB.payVendors.map((vendor) => {
      const totals = vendorTotals(vendor);
      return [esc(vendor.name), fmt$(totals.deposits), fmt$(totals.fees), fmt$(totals.paid), fmt$(totals.deductions), `<strong class="${totals.pending >= 0 ? "success-text" : "danger-text"}">${fmt$(totals.pending)}</strong>`];
    });
    return simpleTable(["Vendor", "Deposits", "Fee Deducted", "Paid Received", "Disputes / Deductions", "Pending Amount"], rows);
  }

  function vendorTotals(vendor) {
    let deposits = 0;
    let fees = 0;
    vendor.fees.forEach((fee) => {
      const sum = allEntries().filter((entry) => entry.type === "paid" && entry.payMethodId === fee.payMethodId && (!fee.payTag || entry.payTagLabel === fee.payTag)).reduce((acc, entry) => acc + num(entry.deposit), 0);
      deposits += sum;
      fees += sum * num(fee.fee) / 100;
    });
    const net = deposits - fees;
    const paid = vendorPaid(vendor);
    const deductions = vendorDeductions(vendor);
    const pending = net - paid - deductions;
    return { deposits, fees, net, paid, deductions, pending };
  }

  function vendorDeductions(vendor) {
    return (vendor.deductions || []).reduce((sum, item) => sum + num(item.amount), 0);
  }

  function vendorPaid(vendor) {
    const payments = Array.isArray(vendor.payments) ? vendor.payments : [];
    return payments.length ? payments.reduce((sum, item) => sum + num(item.amount), 0) : num(vendor.paid);
  }

  function syncVendorPaid(vendor) {
    vendor.payments = Array.isArray(vendor.payments) ? vendor.payments : [];
    vendor.paid = vendor.payments.reduce((sum, item) => sum + num(item.amount), 0);
  }

  function renderVendorPaymentsDashboard() {
    const rows = DB.payVendors.map((vendor) => {
      const totals = vendorTotals(vendor);
      return [
        esc(vendor.name),
        fmt$(totals.deposits),
        fmt$(totals.fees),
        fmt$(totals.deductions),
        fmt$(totals.paid),
        `<strong class="${totals.pending >= 0 ? "success-text" : "danger-text"}">${fmt$(totals.pending)}</strong>`,
        `<div class="row"><button class="btn btn-xs btn-success" onclick="TM.recordVendorPayment('${vendor.id}')" ${IS_ONLINE ? "" : "disabled"}>Record Payment</button><button class="btn btn-xs btn-warn" onclick="TM.addVendorDeduction('${vendor.id}')" ${IS_ONLINE ? "" : "disabled"}>Add Deduction</button><button class="btn btn-xs btn-ghost" onclick="TM.viewVendorPaymentHistory('${vendor.id}')">View History</button></div>`
      ];
    });
    return `<div class="fc dashboard-compact"><div class="fc-head">Vendor Payments Dashboard</div><div class="fg stack">
      <p class="muted">Track amount to receive from each payment vendor after gateway fees, payments received, and disputes or deductions.</p>
      ${simpleTable(["Vendor", "Deposits", "Fee Deducted", "Disputes / Deductions", "Paid Received", "Pending Amount", "Actions"], rows)}
    </div></div>`;
  }

  function renderVendorPaymentHistoryModal() {
    const vendor = DB.payVendors.find((item) => item.id === S.modal.vendorId);
    if (!vendor) return modalWrap("Vendor Payment History", `<div class="empty">Vendor not found.</div>`, `<button class="btn btn-ghost" onclick="TM.closeModal()">Close</button>`, true);
    const payments = (vendor.payments || []).map((payment) => [
      "Payment Received",
      fmt$(payment.amount),
      payment.at ? fmtDateTime(payment.at) : "No Date",
      esc([payment.reference, payment.note].filter(Boolean).join(" - ")),
      `<div class="row"><button class="btn btn-xs btn-ghost" onclick="TM.editVendorPayment('${vendor.id}','${payment.id}')" ${IS_ONLINE ? "" : "disabled"}>Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deleteVendorPayment('${vendor.id}','${payment.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></div>`
    ]);
    const deductions = (vendor.deductions || []).map((deduction) => [
      "Dispute / Deduction",
      fmt$(deduction.amount),
      deduction.at ? fmtDateTime(deduction.at) : "No Date",
      esc(deduction.note || ""),
      `<div class="row"><button class="btn btn-xs btn-ghost" onclick="TM.editVendorDeduction('${vendor.id}','${deduction.id}')" ${IS_ONLINE ? "" : "disabled"}>Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deleteVendorDeduction('${vendor.id}','${deduction.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></div>`
    ]);
    const rows = [...payments, ...deductions];
    return modalWrap(`${vendor.name} Payment History`, simpleTable(["Entry Type", "Amount", "Date and Time", "Note", "Actions"], rows), `<button class="btn btn-ghost" onclick="TM.closeModal()">Close</button>`, true);
  }

  function renderVendorPaymentModal() {
    const vendor = DB.payVendors.find((item) => item.id === S.modal.vendorId);
    if (!vendor) return modalWrap("Record Vendor Payment", `<div class="empty">Vendor not found.</div>`, `<button class="btn btn-ghost" onclick="TM.closeModal()">Close</button>`);
    const totals = vendorTotals(vendor);
    const now = new Date();
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    return modalWrap("Record Vendor Payment", `<form id="vendor-payment-form" class="stack">
      <p class="muted">${esc(vendor.name)} pending amount is ${fmt$(totals.pending)}.</p>
      <div class="grid c2">
        ${field("Amount Received", `<input id="vendor-payment-amount" type="number" step="0.01" min="0.01" value="${esc(Math.max(totals.pending, 0).toFixed(2))}" required>`)}
        ${field("Received Date", dateInput("vendor-payment-date", todayISO(), "", "required"))}
        ${field("Received Time", `<input id="vendor-payment-time" type="time" value="${time}" required>`)}
        ${field("Reference", `<input id="vendor-payment-ref" placeholder="Transaction reference">`)}
      </div>
      ${field("Notes", `<textarea id="vendor-payment-note" placeholder="Notes"></textarea>`)}
    </form>`, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-success" onclick="TM.saveVendorPayment()" ${IS_ONLINE ? "" : "disabled"}>Save Payment</button>`);
  }

  function renderAdminVendors() {
    const section = S.vendorSection || "payment";
    const paymentSection = `<div class="stack">
      ${renderVendorPaymentsDashboard()}
      <div class="fc"><div class="fc-head">Payment Vendors</div><div class="fg stack">
        <div class="row end"><button class="btn btn-primary" onclick="TM.openModal('payVendor')" ${IS_ONLINE ? "" : "disabled"}>Add Payment Vendor</button></div>
        ${DB.payVendors.map((vendor) => {
          const totals = vendorTotals(vendor);
          return `<article class="balance-card"><div class="row between"><strong>${esc(vendor.name)}</strong><button class="btn btn-xs btn-danger" onclick="TM.deletePayVendor('${vendor.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete Vendor</button></div>
            <div class="tbl-wrap"><table><thead><tr><th>Method</th><th>Pay Tag</th><th>Fee Percentage</th><th>Deposits Received</th><th>Fee Amount</th><th>Gross Amount to Receive</th><th>Actions</th></tr></thead><tbody>
            ${vendor.fees.map((fee) => {
              const deposits = allEntries().filter((entry) => entry.type === "paid" && entry.payMethodId === fee.payMethodId && (!fee.payTag || entry.payTagLabel === fee.payTag)).reduce((sum, entry) => sum + num(entry.deposit), 0);
              const feeAmount = deposits * num(fee.fee) / 100;
              const editing = S.editVendorFeeId === fee.id;
              return `<tr><td>${esc(DB.payMethods.find((method) => method.id === fee.payMethodId)?.name || "")}</td><td>${esc(fee.payTag)}</td><td>${editing ? `<input id="edit-fee-${fee.id}" type="number" value="${esc(fee.fee)}">` : `${fmtPlain(fee.fee)}%`}</td><td>${fmt$(deposits)}</td><td>${fmt$(feeAmount)}</td><td><strong>${fmt$(deposits - feeAmount)}</strong></td><td><div class="row">${editing ? `<button class="btn btn-xs btn-success" onclick="TM.saveVendorFeeEdit('${vendor.id}','${fee.id}')" ${IS_ONLINE ? "" : "disabled"}>Save</button><button class="btn btn-xs btn-ghost" onclick="TM.cancelVendorFeeEdit()">Cancel</button>` : `<button class="btn btn-xs btn-ghost" onclick="TM.editVendorFee('${fee.id}')">Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deleteVendorFee('${vendor.id}','${fee.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button>`}</div></td></tr>`;
            }).join("") || `<tr><td colspan="7" class="empty">No fee rows.</td></tr>`}
            </tbody></table></div>
            <div class="vendor-total-row"><span>Total Deposits ${fmt$(totals.deposits)}</span><span>Total Fees ${fmt$(totals.fees)}</span><span>Paid Received ${fmt$(totals.paid)}</span><span>Deductions ${fmt$(totals.deductions)}</span><strong>Pending Amount ${fmt$(totals.pending)}</strong></div>
            <div class="grid c4">${selectInput(`vendor-method-${vendor.id}`, DB.payMethods.map((method) => [method.id, method.name]), DB.payMethods[0]?.id || "")}<input id="vendor-fee-${vendor.id}" type="number" placeholder="Fee percentage"><input id="vendor-tag-${vendor.id}" placeholder="Payment tag"><button class="btn btn-primary" onclick="TM.addVendorFee('${vendor.id}')" ${IS_ONLINE ? "" : "disabled"}>Add Fee Row</button></div>
          </article>`;
        }).join("")}
      </div></div>
    </div>`;
    const gameSection = `<div class="fc"><div class="fc-head">Game Vendors</div><div class="fg stack">
        <div class="pill-list">${DB.gameVendors.map((vendor) => `<span class="pill">${esc(vendor.name)} - ${DB.games.filter((game) => game.gameVendorId === vendor.id).map((game) => game.name).join(", ") || "No games"} <button class="btn btn-xs btn-danger" onclick="TM.deleteGameVendor('${vendor.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></span>`).join("")}</div>
        <div class="row"><input id="new-game-vendor" placeholder="Game vendor name"><button class="btn btn-primary" onclick="TM.addGameVendor()" ${IS_ONLINE ? "" : "disabled"}>Add Game Vendor</button></div>
      </div></div>`;
    return `<section class="stack">
      <div class="subtabs"><button class="tab ${section === "payment" ? "active" : ""}" onclick="TM.setVendorSection('payment')">Payment Vendors</button><button class="tab ${section === "game" ? "active" : ""}" onclick="TM.setVendorSection('game')">Game Vendors</button></div>
      ${section === "payment" ? paymentSection : gameSection}
    </section>`;
  }

  function renderAdminExpenses() {
    const byCat = {};
    DB.expenses.forEach((expense) => { byCat[expense.category] = (byCat[expense.category] || 0) + num(expense.amount); });
    return `<section class="grid c2">
      <form class="fc" onsubmit="TM.addExpense(event)"><div class="fc-head">Add Expense</div><div class="fg stack">
        ${field("Date", dateInput("expense-date", todayISO(), "", "required"))}
        ${field("Category", selectInput("expense-category", DB.expCats.map((cat) => [cat.name, cat.name]), DB.expCats[0]?.name || ""))}
        ${field("Description", textInput("expense-description", "", "", "required"))}
        ${field("Amount in Pakistani Rupees", numberInput("expense-amount", "", "", "required min=\"0\""))}
        <button class="btn btn-primary" ${IS_ONLINE ? "" : "disabled"}>Add Expense</button>
      </div></form>
      <div class="fc"><div class="fc-head">By Category</div><div class="fg stack">
        <div class="pill-list">${Object.entries(byCat).map(([cat, total]) => `<span class="pill">${esc(cat)} ${fmtPKR(total)}</span>`).join("") || `<span class="muted">No expenses.</span>`}</div>
        <strong>Grand Total ${fmtPKR(Object.values(byCat).reduce((sum, value) => sum + value, 0))}</strong>
        <div class="pill-list">${DB.expCats.map((cat) => `<span class="pill">${esc(cat.name)} <button class="btn btn-xs btn-danger" onclick="TM.deleteExpenseCategory('${cat.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></span>`).join("")}</div>
        <div class="row"><input id="new-exp-cat" placeholder="New category"><button class="btn btn-primary" onclick="TM.addExpenseCategory()" ${IS_ONLINE ? "" : "disabled"}>Add Category</button></div>
      </div></div>
      <div class="fc full"><div class="fc-head">All Expenses</div><div class="fg">${simpleTable(["Date", "Category", "Description", "Amount in Pakistani Rupees", "Actions"], DB.expenses.slice().sort((a,b) => String(b.date).localeCompare(String(a.date))).map((expense) => [esc(isoToLabel(expense.date)), esc(expense.category), esc(expense.description), `<span class="danger-text">${fmtPKR(expense.amount)}</span>`, `<button class="btn btn-xs btn-danger" onclick="TM.deleteExpense('${expense.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button>`]))}</div></div>
    </section>`;
  }

  function renderAdminSupabase() {
    return `<section class="grid c2">
      <div class="fc"><div class="fc-head">Connection Settings</div><div class="fg stack">
        <p><span class="online-pill"><i class="dot ${IS_ONLINE && DB.supabase.enabled ? "on" : ""}"></i>${DB.supabase.enabled ? (IS_ONLINE ? "Connected or ready" : "Offline") : "Disabled"}</span></p>
        ${field("Project Link", `<input id="sb-url" value="${esc(DB.supabase.url)}">`)}
        ${field("Anon / Publishable Key", `<input id="sb-key" class="mono" value="${esc(DB.supabase.anonKey)}">`)}
        <div class="row"><button class="btn btn-primary" onclick="TM.testSupabase()">Test Connection</button><button class="btn btn-success" onclick="TM.saveSupabase(true)">Save & Enable</button><button class="btn btn-danger" onclick="TM.saveSupabase(false)">Disable</button></div>
        <p class="muted">${esc(lastSavedStatus)}</p>
      </div></div>
      <div class="fc"><div class="fc-head">Sync Data</div><div class="fg stack">
        <button class="btn btn-primary" onclick="TM.pushAll()" ${IS_ONLINE ? "" : "disabled"}>Push All Data to Supabase</button>
        <button class="btn btn-purple" onclick="TM.pullAll()" ${IS_ONLINE ? "" : "disabled"}>Pull from Supabase</button>
        <button class="btn btn-success" onclick="TM.autoSyncNow()" ${IS_ONLINE ? "" : "disabled"}>Auto-Sync Now</button>
        <p class="muted">${esc(lastSavedStatus)}</p>
      </div></div>
      <div class="fc full"><div class="fc-head">SQL Setup Script</div><div class="fg stack"><pre class="report-preview">${esc(SQL_SCRIPT)}</pre><button class="btn btn-ghost" onclick="TM.copySql()">Copy SQL</button></div></div>
    </section>`;
  }

  function renderAdminSettings() {
    return `<section class="grid c2">
      <div class="fc"><div class="fc-head">Authorization Code</div><div class="fg stack">
        <p class="muted">This code is required when a recharge promo exceeds 100%. Only share with managers and admins.</p>
        ${field("Authorization Code", `<input id="override-code" type="password" autocomplete="new-password" value="${esc(DB.overrideCode)}">`)}
        <div class="row"><button class="btn btn-primary" onclick="TM.saveOverrideCode()" ${IS_ONLINE ? "" : "disabled"}>Save Code</button><span id="code-save-msg" class="success-text"></span></div>
      </div></div>
    </section>`;
  }

  function renderAdminBackup() {
    return `<section class="grid c2">
      <div class="fc"><div class="fc-head">Export</div><div class="fg stack">
        <p class="muted">Total entries: ${allEntries().length}. Closed shifts: ${DB.closedShifts.length}.</p>
        <button class="btn btn-primary" onclick="TM.exportJson()">Export JSON Backup</button>
        <button class="btn btn-success" onclick="TM.exportEntries()">Export Entries Comma Separated Values</button>
      </div></div>
      <div class="fc"><div class="fc-head">Restore</div><div class="fg stack">
        <input type="file" accept="application/json" onchange="TM.loadRestoreFile(this.files[0])">
        <button class="btn btn-danger" onclick="TM.restoreBackup()" ${restoreFileText ? "" : "disabled"}>Restore Backup</button>
        <p class="muted">Restore overwrites all local and synced CRM data after confirmation.</p>
      </div></div>
    </section>`;
  }

  function renderModal() {
    if (!S.modal) return "";
    const type = S.modal.type;
    if (type === "adminLogin") return renderAdminLoginModal();
    if (type === "adminSetup") return renderFirstAdminSetupModal();
    if (type === "vendorPayment") return renderVendorPaymentModal();
    if (type === "vendorPaymentHistory") return renderVendorPaymentHistoryModal();
    if (type === "override") return renderOverrideModal();
    if (type === "closeShift") return renderCloseShiftModal();
    if (type === "checkout") return renderCheckoutModal();
    if (type === "leaveRequest") return renderLeaveRequestModal();
    if (type === "editEntry") return renderEditEntryModal();
    if (type === "correctAttendance") return renderCorrectAttendanceModal();
    if (type === "staff") return renderStaffModal();
    if (type === "addAgent" || type === "editAgent") return renderAgentModal();
    if (type === "addGame") return renderAddGameModal();
    return renderSimpleModal(type);
  }

  function modalWrap(title, body, foot, wide) {
    return `<div class="moverlay" onclick="TM.backdrop(event)"><section class="modal ${wide ? "wide" : ""}">
      <div class="modal-head"><div><h2>${esc(title)}</h2></div><button class="btn btn-xs btn-ghost" onclick="TM.closeModal()">Close</button></div>
      <div class="modal-body">${body}</div>
      ${foot ? `<div class="modal-foot">${foot}</div>` : ""}
    </section></div>`;
  }

  function renderAdminLoginModal() {
    return modalWrap("Admin Dashboard Login", `<form id="admin-login-form" class="stack" onsubmit="TM.loginAdmin(event)">
      <p class="muted">Enter the admin name or email and the password or PIN saved in Staff & Access.</p>
      ${field("Admin Name or Email", `<input id="admin-login-id" autocomplete="username" required autofocus>`)}
      ${field("Password / PIN", `<input id="admin-login-pin" type="password" autocomplete="current-password" required>`)}
      <div id="admin-login-error" class="danger-text" style="min-height:22px"></div>
    </form>`, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-primary" onclick="TM.loginAdmin()">Unlock Admin Dashboard</button>`);
  }

  function renderFirstAdminSetupModal() {
    return modalWrap("Create First Admin", `<form id="first-admin-form" class="stack" onsubmit="TM.createFirstAdmin(event)">
      <p class="muted">No admin user exists yet. Create the first Admin account, then use these credentials whenever you open Admin Dashboard.</p>
      <div class="grid c2">
        ${field("Full Name", `<input id="first-admin-name" required autofocus>`)}
        ${field("Email", `<input id="first-admin-email" type="email" required autocomplete="username">`)}
        ${field("Password / PIN", `<input id="first-admin-pin" type="password" autocomplete="new-password" required>`)}
        ${field("Confirm Password / PIN", `<input id="first-admin-confirm" type="password" autocomplete="new-password" required>`)}
      </div>
      <div id="first-admin-error" class="danger-text" style="min-height:22px"></div>
    </form>`, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-primary" onclick="TM.createFirstAdmin()" ${IS_ONLINE ? "" : "disabled"}>Create Admin</button>`);
  }

  function renderOverrideModal() {
    return modalWrap("Manager Approval Required", `<p class="muted">Promo exceeds 100% - enter the authorization code to proceed.</p><div class="stack" style="max-width:360px;margin:auto">${field("", `<input id="override-input" type="password" style="text-align:center;font-size:24px;font-family:var(--mono)" autocomplete="off">`)}<div id="override-error" class="danger-text" style="min-height:22px"></div></div>`, `<button class="btn btn-ghost" onclick="TM.cancelOverride()">Cancel</button><button class="btn btn-primary" onclick="TM.approveOverride()">Approve</button>`);
  }

  function renderCloseShiftModal() {
    const balances = S.modal.balances || {};
    const closeType = isDayClosingShift(activeShiftName()) ? "Day" : "Shift";
    const body = `<div class="close-shift-compact">${DB.games.map((game) => {
      const sys = gameBal(game.id);
      const val = balances[game.id] ?? "";
      const diff = val === "" ? "" : num(val) - sys;
      return `<div class="close-row">
        <strong>${esc(game.name)}</strong>
        <span>${fmt$(sys)}</span>
        <input id="close-${game.id}" type="number" step="0.01" value="${esc(val)}" oninput="TM.closeBalanceInput('${game.id}', this)" placeholder="Actual balance">
        <small id="diff-${game.id}" class="${Math.abs(diff) < .01 && val !== "" ? "success-text" : val === "" ? "subtle" : "danger-text"}">${val === "" ? "Waiting" : `Difference ${fmt$(diff)}`}</small>
      </div>`;
    }).join("")}</div>`;
    return modalWrap(`Close ${closeType}`, body, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-warn" onclick="TM.confirmCloseShift()" ${IS_ONLINE ? "" : "disabled"}>Confirm & Close ${closeType}</button>`);
  }

  function renderCheckoutModal() {
    const person = personById(S.modal.personId);
    const todayKey = todayISO();
    const record = ensureAttendance(S.modal.personId, todayKey);
    const basePlayers = getBaseTotalPlayers(person?.name || "", todayKey);
    const report = record.report || {};
    const preview = buildWhatsAppReport(person, { ...report, totalPlayers: basePlayers + num(report.newPlayers) }, todayKey);
    return modalWrap("Check Out", `<form id="checkout-form" class="stack" onsubmit="TM.submitCheckout(event)">
      <p class="muted">${esc(person?.name || "")} is checking out for ${esc(isoToLabel(todayKey))}.</p>
      <div class="grid c3">${REPORT_FIELDS.map((fieldItem) => field(fieldItem.label, `<input id="report-${fieldItem.key}" type="number" min="0" value="${esc(report[fieldItem.key] || "")}" oninput="TM.updateCheckoutPreview()">`)).join("")}${field("Total Players", `<input id="report-totalPlayers" value="${basePlayers + num(report.newPlayers)}" readonly>`)}</div>
      <div class="fc"><div class="fc-head">WhatsApp Message Preview</div><div class="fg"><pre id="checkout-preview" class="report-preview">${esc(preview)}</pre><button type="button" class="btn btn-ghost btn-sm" onclick="TM.copyCheckoutPreview()">Copy Message</button></div></div>
    </form>`, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-primary" onclick="TM.submitCheckout()">Confirm Check Out</button>`, true);
  }

  function renderLeaveRequestModal() {
    const request = S.modal.requestId ? DB.leaveRequests.find((item) => item.id === S.modal.requestId) : null;
    const person = personById(S.modal.personId || request?.employeeId);
    return modalWrap(request ? "Edit Leave Request" : "Leave Request", `<form id="leave-form" class="stack" onsubmit="TM.saveLeaveRequest(event)">
      ${field("Employee", `<input value="${esc(person?.name || "")}" readonly>`)}
      ${field("Request Date", dateInput("leave-date", request?.date || todayISO(), "", "required"))}
      ${field("Reason", selectInput("leave-reason", DB.attendanceSettings.leaveReasons.map((reason) => [reason, reason]), request?.reason || DB.attendanceSettings.leaveReasons[0] || ""))}
      ${field("Description", `<textarea id="leave-description" required>${esc(request?.description || "")}</textarea>`)}
      ${request ? field("Status", selectInput("leave-status", [["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["cancel-requested", "Cancel Requested"], ["cancelled", "Cancelled"]], request.status || "pending")) : ""}
    </form>`, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-primary" onclick="TM.saveLeaveRequest()" ${IS_ONLINE ? "" : "disabled"}>Save Leave Request</button>`);
  }

  function renderEditEntryModal() {
    const ref = entryRef(S.modal.entryId);
    const entry = ref?.entry;
    if (!entry) return "";
    return modalWrap("Edit Entry", `<form id="entry-edit-form" class="grid c3">
      ${field("Type", selectInput("edit-type", [["paid", "Paid"], ["freeplay", "Freeplay"], ["redeem", "Redeem"]], entry.type))}
      ${field("Date", dateInput("edit-date", entry.date, ""))}
      ${field("Shift", selectInput("edit-shift", shiftOptions(), entry.shift))}
      ${field("Agent", selectInput("edit-agent", agentOptions(), entry.agent))}
      ${field("Player Name", `<input id="edit-player" value="${esc(entry.playerName)}">`)}
      ${field("Player Facebook Link", `<input id="edit-link" value="${esc(entry.playerUrl)}">`)}
      ${field("Game ID", `<input id="edit-gameid" value="${esc(entry.gameId)}">`)}
      ${field("Game Name", selectInput("edit-game", gameOptions(true), entry.gameName))}
      ${field("Deposit", `<input id="edit-deposit" type="number" step="0.01" value="${esc(entry.deposit || "")}">`)}
      ${field("Recharge", `<input id="edit-recharge" type="number" step="0.01" value="${esc(entry.recharge || "")}">`)}
      ${field("Freeplay Amount", `<input id="edit-fp" type="number" step="0.01" value="${esc(entry.fpAmount || "")}">`)}
      ${field("Redeem Credits", `<input id="edit-rd" type="number" step="0.01" value="${esc(entry.rdCredits || "")}">`)}
      ${field("Cashout Paid", `<input id="edit-cashout" type="number" step="0.01" value="${esc(entry.cashoutPaid || "")}">`)}
      ${field("Customer Tag or Email", `<input id="edit-cust" value="${esc(entry.custTag || "")}">`)}
      ${field("Player Legal Name", `<input id="edit-legal" value="${esc(entry.legalName || "")}">`)}
      ${field("Contact Number", `<input id="edit-contact" value="${esc(entry.contact || "")}">`)}
      ${field("Email", `<input id="edit-email" type="email" value="${esc(entry.email || "")}">`)}
      <label class="pill"><input id="edit-dispute" type="checkbox" ${entry.dispute ? "checked" : ""}> Mark as Dispute</label>
      ${field("Dispute Note", `<input id="edit-dispute-note" value="${esc(entry.disputeNote || "")}" placeholder="Reason or note">`, "span2")}
    </form>`, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-primary" onclick="TM.saveEntryEdit()" ${IS_ONLINE ? "" : "disabled"}>Save Entry</button>`, true);
  }

  function renderCorrectAttendanceModal() {
    const rec = DB.attendance.find((item) => item.id === S.modal.recordId);
    if (!rec) return "";
    return modalWrap("Attendance Correction", `<form id="correct-att-form" class="grid c3">
      ${field("Employee", `<input value="${esc(rec.agentName)}" readonly>`)}
      ${field("Date", dateInput("correct-date", rec.date, ""))}
      ${field("Status", selectInput("correct-status", [["present", "Present"], ["completed", "Completed"], ["absent", "Absent"], ["leave", "Leave"], ["off", "Scheduled Off"]], rec.status))}
      ${field("Check In Time", `<input id="correct-in" type="time" value="${timeValue(rec.checkInAt)}">`)}
      ${field("Check Out Time", `<input id="correct-out" type="time" value="${timeValue(rec.checkOutAt)}">`)}
      ${field("Leave Reason", `<input id="correct-reason" value="${esc(rec.leaveReason || rec.offReason || "")}">`)}
      <div class="full grid c3">${REPORT_FIELDS.map((fieldItem) => field(fieldItem.label, `<input id="correct-${fieldItem.key}" type="number" min="0" value="${esc(rec.report?.[fieldItem.key] || "")}">`)).join("")}</div>
    </form>`, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-primary" onclick="TM.saveAttendanceCorrection()" ${IS_ONLINE ? "" : "disabled"}>Save Correction</button>`, true);
  }

  function timeValue(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function buildDateTime(date, time) {
    if (!date || !time) return "";
    return new Date(`${date}T${time}:00`).toISOString();
  }

  function renderStaffModal() {
    const staff = S.modal.staffId ? DB.staff.find((item) => item.id === S.modal.staffId) : null;
    const role = staff?.role || "manager";
    const adminAccess = role !== "agent" && (staff ? !!staff.adminAccess : staffDefaultAdminAccess(role));
    const perms = staff?.perms || staffPermsForRole(role, adminAccess);
    const attendanceRequired = staff ? !!staff.attendanceRequired : ["manager", "supervisor", "agent"].includes(role);
    const showInDeposits = staff ? !!staff.showInDeposits : ["manager", "supervisor", "agent"].includes(role);
    return modalWrap(staff ? "Edit Staff" : "Add Staff", `<form id="staff-form" class="stack">
      <div class="grid c2">
        ${field("Full Name", `<input id="staff-name" value="${esc(staff?.name || "")}" required>`)}
        ${field("Email", `<input id="staff-email" type="email" value="${esc(staff?.email || "")}" required>`)}
        ${field("Role", selectInput("staff-role", [["admin", "Admin"], ["manager", "Manager"], ["supervisor", "Supervisor"], ["agent", "Agent"]], role, "TM.staffRoleChanged(this.value)"))}
        <label id="staff-pin-wrap" style="${adminAccess ? "" : "display:none"}">PIN / Password<input id="staff-pin" type="password" autocomplete="new-password" value="${esc(staff?.pin || "")}" ${adminAccess ? "required" : ""}></label>
        ${field("Shift", selectInput("staff-shift", [["", "No Shift"], ...DB.shifts.map((shift) => [shift.id, `${shift.name} (${shift.start}-${shift.end})`])], staff?.shiftId || ""))}
        ${field("Staff Color", `<input id="staff-color" type="color" value="${esc(staff?.color || "#8796a3")}">`)}
        ${field("Monthly New Player Target", `<input id="staff-target-players" type="number" min="0" value="${esc(staff?.targets?.newPlayers || 0)}">`)}
        ${field("Monthly Sales Target", `<input id="staff-target-deposit" type="number" min="0" value="${esc(staff?.targets?.deposit || 0)}">`)}
      </div>
      <div class="grid c2">
        <label class="pill"><input id="staff-attendance-required" type="checkbox" ${attendanceRequired ? "checked" : ""}> Attendance Required</label>
        <label class="pill"><input id="staff-show-deposits" type="checkbox" ${showInDeposits ? "checked" : ""}> Show Name in Sales Forms</label>
        <label id="staff-admin-row" class="pill" style="${role === "agent" ? "display:none" : ""}"><input id="staff-admin-access" type="checkbox" ${adminAccess ? "checked" : ""} onchange="TM.staffAdminAccessChanged()"> Admin Dashboard Access</label>
      </div>
      <p class="muted">Agent Panel access is included by default. Use Admin Dashboard Access only for people who should open the admin area.</p>
      <div id="staff-admin-permissions" class="stack" style="${adminAccess ? "" : "display:none"}">
        <div class="row"><button type="button" class="btn btn-sm btn-ghost" onclick="TM.staffSelectAll()">Select All</button><button type="button" class="btn btn-sm btn-ghost" onclick="TM.staffClearAll()">Clear All</button><button type="button" class="btn btn-sm btn-ghost" onclick="TM.staffResetRole()">Reset to Role</button></div>
        <div class="grid c3" id="perm-grid">${PERMISSIONS.map((perm) => `<label class="pill"><input type="checkbox" class="perm-check" value="${esc(perm)}" ${perms.includes(perm) ? "checked" : ""}> ${esc(perm)}</label>`).join("")}</div>
      </div>
    </form>`, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-primary" onclick="TM.saveStaff()" ${IS_ONLINE ? "" : "disabled"}>Save Staff</button>`, true);
  }

  function renderAgentModal() {
    const agent = S.modal.agentId ? DB.agents.find((item) => item.id === S.modal.agentId) : null;
    return modalWrap(agent ? "Edit Agent" : "Add Agent", `<form id="agent-form" class="grid c2">
      ${field("Full Name", `<input id="agent-name" value="${esc(agent?.name || "")}" required>`)}
      ${field("Role", `<input id="agent-role" value="${esc(agent?.role || "agent")}">`)}
      ${field("Shift", selectInput("agent-shift", DB.shifts.map((shift) => [shift.id, `${shift.name} (${shift.start}-${shift.end})`]), agent?.shiftId || DB.shifts[0]?.id || ""))}
      ${field("Agent Color", `<input id="agent-color" type="color" value="${esc(agent?.color || "#24d8ff")}">`)}
      ${field("Monthly New Player Target", `<input id="agent-target-players" type="number" min="0" value="${esc(agent?.targets?.newPlayers || 0)}">`)}
      ${field("Monthly Sales Target", `<input id="agent-target-deposit" type="number" min="0" value="${esc(agent?.targets?.deposit || 0)}">`)}
      <label class="pill"><input id="agent-attendance-required" type="checkbox" ${agent?.attendanceRequired === false ? "" : "checked"}> Attendance Required</label>
      <label class="pill"><input id="agent-show-deposits" type="checkbox" ${agent?.showInDeposits === false ? "" : "checked"}> Show Name in Sales Forms</label>
    </form>`, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-primary" onclick="TM.saveAgent()" ${IS_ONLINE ? "" : "disabled"}>Save Agent</button>`);
  }

  function renderAddGameModal() {
    return modalWrap("Add Game", `<form id="game-form" class="grid c2">
      ${field("Game Name", `<input id="game-name" required>`)}
      ${field("Game Vendor", selectInput("game-vendor", [["", "Unassigned"], ...DB.gameVendors.map((vendor) => [vendor.id, vendor.name])], ""))}
      ${field("Price per 1000 Credits", `<input id="game-price" type="number" step="0.01">`)}
      ${field("Backend Link", `<input id="game-backend">`)}
      ${field("Player Link", `<input id="game-player">`)}
      ${field("Username", `<input id="game-user">`)}
      ${field("Password", `<input id="game-pass">`)}
    </form>`, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-primary" onclick="TM.saveNewGame()" ${IS_ONLINE ? "" : "disabled"}>Add Game</button>`);
  }

  function renderSimpleModal(type) {
    const titles = { addShift: "Add Shift", payMethod: "Add Payment Method", payVendor: "Add Payment Vendor" };
    let body = "";
    let action = "";
    if (type === "addShift") {
      body = `<form id="simple-form" class="grid c3">${field("Name", `<input id="shift-name" required>`)}${field("Start Time", `<input id="shift-start" type="time" required>`)}${field("End Time", `<input id="shift-end" type="time" required>`)}</form>`;
      action = "TM.saveShift()";
    } else if (type === "payMethod") {
      body = `<form id="simple-form">${field("Payment Method Name", `<input id="pay-method-name" required>`)}</form>`;
      action = "TM.savePayMethod()";
    } else if (type === "payVendor") {
      body = `<form id="simple-form">${field("Vendor Name", `<input id="pay-vendor-name" required>`)}</form>`;
      action = "TM.savePayVendor()";
    } else if (type === "pageName") {
      const page = S.modal.pageId ? DB.pageNames.find((item) => item.id === S.modal.pageId) : null;
      body = `<form id="simple-form" class="grid c3">${field("Page Name", `<input id="page-name" value="${esc(page?.name || "")}" required>`)}${field("Page Link", `<input id="page-link" value="${esc(page?.link || "")}" placeholder="https://facebook.com/...">`)}${field("Access Given To", `<input id="page-access" value="${esc(page?.accessTo || "")}" placeholder="Names or team">`)}</form>`;
      action = "TM.savePageName()";
    }
    const title = type === "pageName" ? (S.modal.pageId ? "Edit Page Name" : "Add Page Name") : (titles[type] || "Modal");
    return modalWrap(title, body, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-primary" onclick="${action}" ${IS_ONLINE ? "" : "disabled"}>Save</button>`);
  }

  function adminCandidates() {
    return DB.staff.filter((staff) => {
      const perms = staff.perms || [];
      return staff.role !== "agent" && !!staff.adminAccess && !!staff.pin && perms.includes("View Dashboard");
    });
  }

  function currentAdminUser() {
    return DB.staff.find((staff) => staff.id === S.adminUserId);
  }

  function openAdminGate() {
    if (S.adminAuthed && currentAdminUser()) {
      S.page = "admin";
      render();
      return;
    }
    S.adminAuthed = false;
    S.adminUserId = "";
    S.modal = { type: adminCandidates().length ? "adminLogin" : "adminSetup" };
    render();
    setTimeout(() => document.getElementById(adminCandidates().length ? "admin-login-id" : "first-admin-name")?.focus(), 0);
  }

  function loginAdmin(event) {
    event?.preventDefault();
    const identity = document.getElementById("admin-login-id")?.value.trim().toLowerCase();
    const password = document.getElementById("admin-login-pin")?.value || "";
    const error = document.getElementById("admin-login-error");
    const staff = adminCandidates().find((item) => [item.name, item.email].some((value) => String(value || "").trim().toLowerCase() === identity));
    if (!staff || String(staff.pin || "") !== password) {
      if (error) error.textContent = "Incorrect admin name, email, or password.";
      const pin = document.getElementById("admin-login-pin");
      if (pin) {
        pin.value = "";
        pin.focus();
      }
      return;
    }
    S.adminAuthed = true;
    S.adminUserId = staff.id;
    S.modal = null;
    S.page = "admin";
    render();
  }

  function createFirstAdmin(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    const name = document.getElementById("first-admin-name")?.value.trim();
    const email = document.getElementById("first-admin-email")?.value.trim();
    const pin = document.getElementById("first-admin-pin")?.value || "";
    const confirmPin = document.getElementById("first-admin-confirm")?.value || "";
    const error = document.getElementById("first-admin-error");
    if (!name || !email || !pin) {
      if (error) error.textContent = "Complete all first admin fields.";
      return;
    }
    if (pin !== confirmPin) {
      if (error) error.textContent = "Password confirmation does not match.";
      return;
    }
    const staff = { id: uid("staff"), name, email, role: "admin", pin, shiftId: "", color: "#8796a3", adminAccess: true, attendanceRequired: false, showInDeposits: false, targets: { newPlayers: 0, deposit: 0 }, perms: staffPermsForRole("admin", true) };
    DB.staff.unshift(staff);
    saveDB();
    pushConfig();
    S.adminAuthed = true;
    S.adminUserId = staff.id;
    S.modal = null;
    S.page = "admin";
    render();
  }

  function lockAdmin() {
    S.adminAuthed = false;
    S.adminUserId = "";
    S.page = "shift";
    render();
  }

  function setPage(page) {
    if (page === "admin" && (!S.adminAuthed || !currentAdminUser())) {
      openAdminGate();
      return;
    }
    if (page === "shift" && !isShiftOpen()) {
      S.page = "closed";
      render();
      return;
    }
    S.page = page;
    render();
  }

  function setShiftTab(tab) {
    S.shiftTab = tab;
    render();
  }

  function setAdmin(section) {
    S.adminSection = section;
    render();
  }

  function setS(key, value, rerender = true) {
    S[key] = value;
    if (rerender) render();
  }

  function setPF(key, value, rerender = true) {
    S.pf[key] = value;
    if (rerender) render();
  }

  function setFF(key, value, rerender = true) {
    S.ff[key] = value;
    if (rerender) render();
  }

  function setRF(key, value, rerender = true) {
    S.rf[key] = value;
    if (rerender) render();
  }

  function setPaidMethod(value) {
    S.pf.payMethodId = value;
    S.pf.payTagId = "";
    S.pf.payTagLabel = "";
    render();
  }

  function setPaidTag(value) {
    S.pf.payTagId = value;
    S.pf.payTagLabel = tagsFor(S.pf.payMethodId).find((tag) => tag.id === value)?.tag || "";
    render();
  }

  function updatePaidMoney() {
    const deposit = num(document.getElementById("paid-deposit")?.value);
    const recharge = num(document.getElementById("paid-recharge")?.value);
    const promo = recharge - deposit;
    const promoP = deposit ? (promo / deposit) * 100 : 0;
    S.pf.deposit = document.getElementById("paid-deposit")?.value || "";
    S.pf.recharge = document.getElementById("paid-recharge")?.value || "";
    S.pf.promo = promo.toFixed(2);
    S.pf.promoP = promoP.toFixed(2);
    const promoEl = document.getElementById("paid-promo");
    const promoPEl = document.getElementById("paid-promop");
    if (promoEl) promoEl.value = S.pf.promo;
    if (promoPEl) promoPEl.value = S.pf.promoP;
    const warn = document.getElementById("paid-warning");
    if (warn) warn.classList.toggle("hidden", promoP <= 100);
  }

  function toggleDepositOnPage(value) {
    S.pf.depositOnPage = value;
    const yes = document.querySelector(".tog .t-yes");
    const no = document.querySelector(".tog .t-no");
    const page = document.getElementById("paid-page");
    const hunting = document.getElementById("paid-hunting");
    if (yes) yes.classList.toggle("active", value);
    if (no) no.classList.toggle("active", !value);
    if (page) {
      page.disabled = !value;
      if (!value) page.value = "";
      else page.value = S.pf.pageName || "";
      S.pf.pageName = page.value;
    }
    if (hunting) {
      hunting.disabled = value;
      if (value) {
        hunting.value = "";
        S.pf.huntingProfile = "";
      }
    }
  }

  function validateLink(input, hintId) {
    const ok = isUrl(input.value.trim());
    input.classList.toggle("valid", ok);
    input.classList.toggle("invalid", !ok);
    const hint = document.getElementById(hintId);
    if (hint) hint.textContent = ok ? "Valid link." : "Enter a valid full link.";
    return ok;
  }

  function validateOptionalLink(input, hintId) {
    if (!input.value.trim()) {
      input.classList.remove("valid", "invalid");
      const hint = document.getElementById(hintId);
      if (hint) hint.textContent = "Optional full Facebook link.";
      return true;
    }
    return validateLink(input, hintId);
  }

  function buildPaidEntry() {
    const f = S.pf;
    updatePaidMoney();
    const tag = tagsFor(f.payMethodId).find((item) => item.id === f.payTagId);
    return {
      id: uid("entry"),
      type: "paid",
      date: f.date,
      shift: f.shift || activeShiftName(),
      shiftSession: "Current",
      agent: f.agent,
      playerName: f.playerName.trim(),
      playerUrl: f.playerUrl.trim(),
      gameId: f.gameId.trim(),
      gameName: f.gameName,
      deposit: num(f.deposit),
      recharge: num(f.recharge),
      promo: num(f.promo),
      promoP: num(f.promoP),
      fpAmount: 0,
      rdCredits: 0,
      cashoutPaid: 0,
      isNewPlayer: [f.salesName, f.legalName, f.contact, f.email].some((value) => String(value || "").trim()),
      custTag: f.custTag.trim(),
      payMethodId: f.payMethodId,
      payTagId: f.payTagId,
      payTagLabel: tag?.tag || "",
      depositOnPage: !!f.depositOnPage,
      pageName: f.pageName,
      huntingProfile: f.huntingProfile.trim(),
      salesName: f.salesName,
      legalName: f.legalName.trim(),
      contact: f.contact.trim(),
      email: f.email.trim(),
      createdAt: new Date().toISOString()
    };
  }

  function showFieldErrors(ids, message) {
    document.querySelectorAll(".field-error").forEach((element) => element.classList.remove("field-error"));
    const unique = [...new Set(ids.filter(Boolean))];
    unique.forEach((id) => document.getElementById(id)?.classList.add("field-error"));
    document.getElementById(unique[0])?.focus();
    alert(message);
  }

  function clearFieldError(target) {
    if (target?.classList) target.classList.remove("field-error");
  }

  function checkShiftOpen() {
    if (isShiftOpen()) return true;
    alert("Start the current shift before adding entries.");
    S.page = "closed";
    render();
    return false;
  }

  function validatePaid(entry) {
    const missing = [];
    if (!entry.date) missing.push("paid-date");
    if (!entry.shift) missing.push("paid-shift");
    if (!entry.agent) missing.push("paid-agent");
    if (!entry.playerName) missing.push("paid-player");
    if (!entry.playerUrl) missing.push("paid-link");
    if (!entry.payMethodId) missing.push("paid-method");
    if (!entry.payTagId) missing.push("paid-tag");
    if (!entry.custTag) missing.push("paid-cust");
    if (!entry.gameId) missing.push("paid-gameid");
    if (!entry.gameName) missing.push("paid-game");
    if (entry.depositOnPage && !entry.pageName) missing.push("paid-page");
    if (!entry.depositOnPage && !entry.huntingProfile) missing.push("paid-hunting");
    if (missing.length) return { message: "Please complete the highlighted paid recharge fields.", ids: missing };
    if (!isUrl(entry.playerUrl)) return { message: "Player Facebook Link must be a valid full link.", ids: ["paid-link"] };
    const money = [];
    if (entry.deposit <= 0) money.push("paid-deposit");
    if (entry.recharge <= 0) money.push("paid-recharge");
    if (money.length) return { message: "Deposit and Recharge must be greater than zero.", ids: money };
    return null;
  }

  function submitPaid(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!checkShiftOpen()) return;
    const entry = buildPaidEntry();
    const err = validatePaid(entry);
    if (err) return showFieldErrors(err.ids, err.message);
    if (entry.promoP > 100) {
      S._pendingEntry = entry;
      S.modal = { type: "override" };
      render();
      setTimeout(() => document.getElementById("override-input")?.focus(), 0);
      return;
    }
    saveEntry(entry);
    clearPaid();
  }

  function saveEntry(entry) {
    if (!isShiftOpen()) return alert("Start the current shift before adding entries.");
    entry.shift = entry.shift || activeShiftName();
    entry.shiftSession = `${entry.shift} - ${isoToLabel(entry.date)}`;
    DB.entries.unshift(entry);
    saveDB();
    syncEntry(entry);
    render();
  }

  function clearPaid() {
    S.pf = newPF();
    render();
  }

  function submitFreeplay(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!checkShiftOpen()) return;
    const f = S.ff;
    const missing = [];
    if (!f.date) missing.push("free-date");
    if (!f.shift) missing.push("free-shift");
    if (!f.agent) missing.push("free-agent");
    if (!f.playerName.trim()) missing.push("free-player");
    if (!f.fpAmount || num(f.fpAmount) <= 0) missing.push("free-amount");
    if (!f.gameName) missing.push("free-game");
    if (!f.gameId.trim()) missing.push("free-gameid");
    if (missing.length) return showFieldErrors(missing, "Please complete the highlighted freeplay fields.");
    if (f.playerUrl && !isUrl(f.playerUrl)) return showFieldErrors(["free-link"], "Player Facebook Link must be a valid full link.");
    const entry = {
      id: uid("entry"),
      type: "freeplay",
      date: f.date,
      shift: f.shift || activeShiftName(),
      shiftSession: "Current",
      agent: f.agent,
      playerName: f.playerName.trim(),
      playerUrl: f.playerUrl.trim(),
      gameId: f.gameId.trim(),
      gameName: f.gameName,
      deposit: 0,
      recharge: 0,
      promo: 0,
      promoP: 0,
      fpAmount: num(f.fpAmount),
      rdCredits: 0,
      cashoutPaid: 0,
      isNewPlayer: [f.salesName, f.legalName, f.contact, f.email].some((value) => String(value || "").trim()),
      custTag: "",
      payMethodId: "",
      legalName: f.legalName.trim(),
      contact: f.contact.trim(),
      email: f.email.trim(),
      salesName: f.salesName,
      createdAt: new Date().toISOString()
    };
    saveEntry(entry);
    clearFreeplay();
  }

  function clearFreeplay() {
    S.ff = newFF();
    render();
  }

  function submitRedeem(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!checkShiftOpen()) return;
    const f = S.rf;
    const missing = [];
    if (!f.date) missing.push("redeem-date");
    if (!f.shift) missing.push("redeem-shift");
    if (!f.agent) missing.push("redeem-agent");
    if (!f.gameId.trim()) missing.push("redeem-gameid");
    if (!f.gameName) missing.push("redeem-game");
    if (!f.rdCredits || num(f.rdCredits) <= 0) missing.push("redeem-credits");
    if (f.cashoutPaid === "" || num(f.cashoutPaid) < 0) missing.push("redeem-cashout");
    if (missing.length) return showFieldErrors(missing, "Please complete the highlighted redeem fields.");
    const paid = allEntries().filter((entry) => entry.type === "paid" && entry.gameId === f.gameId.trim()).sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)))[0];
    const entry = {
      id: uid("entry"),
      type: "redeem",
      date: f.date,
      shift: f.shift || activeShiftName(),
      shiftSession: "Current",
      agent: f.agent,
      playerName: paid?.playerName || "",
      playerUrl: paid?.playerUrl || "",
      gameId: f.gameId.trim(),
      gameName: f.gameName,
      deposit: 0,
      recharge: 0,
      promo: 0,
      promoP: 0,
      fpAmount: 0,
      rdCredits: num(f.rdCredits),
      cashoutPaid: num(f.cashoutPaid),
      isNewPlayer: false,
      custTag: paid?.custTag || "",
      payMethodId: "",
      legalName: paid?.legalName || "",
      contact: paid?.contact || "",
      email: paid?.email || "",
      createdAt: new Date().toISOString()
    };
    saveEntry(entry);
    clearRedeem();
  }

  function clearRedeem() {
    S.rf = newRF();
    render();
  }

  function approveOverride() {
    const input = document.getElementById("override-input");
    const err = document.getElementById("override-error");
    if ((input?.value || "") !== DB.overrideCode) {
      if (err) err.textContent = "Incorrect code. Try again.";
      if (input) {
        input.value = "";
        input.focus();
      }
      return;
    }
    const entry = S._pendingEntry;
    S._pendingEntry = null;
    S.modal = null;
    if (entry) {
      entry.shift = entry.shift || activeShiftName();
      entry.shiftSession = `${entry.shift} - ${isoToLabel(entry.date)}`;
      DB.entries.unshift(entry);
      saveDB();
      syncEntry(entry);
      S.pf = newPF();
    }
    render();
  }

  function cancelOverride() {
    S._pendingEntry = null;
    S.modal = null;
    render();
  }

  function checkIn(personId) {
    if (!checkOnline()) return;
    const person = personById(personId);
    const record = ensureAttendance(personId, todayISO());
    if (record.checkInAt || record.checkOutAt) return;
    record.agentName = person?.name || "";
    record.checkInAt = new Date().toISOString();
    record.checkIn = record.checkInAt;
    record.status = "present";
    record.leaveReason = "";
    record.offReason = "";
    record.late = isLateForPerson(person, record.checkInAt);
    saveDB();
    syncAttendance(record);
    render();
  }

  function markLeave(personId) {
    if (!checkOnline()) return;
    const person = personById(personId);
    const reason = prompt("Leave reason");
    if (!reason) return;
    const record = ensureAttendance(personId, todayISO());
    record.agentName = person?.name || "";
    record.status = "leave";
    record.leaveReason = reason;
    record.checkInAt = "";
    record.checkOutAt = "";
    record.duration = 0;
    saveDB();
    syncAttendance(record);
    render();
  }

  function openCheckout(personId) {
    S.modal = { type: "checkout", personId };
    render();
  }

  function getBaseTotalPlayers(agentName, dateKey) {
    return allEntries().filter((entry) => entry.agent === agentName && entry.isNewPlayer && entry.date < dateKey).length;
  }

  function updateCheckoutPreview() {
    const totalPlayers = getBaseTotalPlayers(personById(S.modal.personId)?.name || "", todayISO()) + num(document.getElementById("report-newPlayers")?.value);
    const totalEl = document.getElementById("report-totalPlayers");
    if (totalEl) totalEl.value = totalPlayers;
    const report = {};
    REPORT_FIELDS.forEach((fieldItem) => {
      report[fieldItem.key] = num(document.getElementById(`report-${fieldItem.key}`)?.value);
    });
    report.totalPlayers = totalPlayers;
    const preview = document.getElementById("checkout-preview");
    if (preview) preview.textContent = buildWhatsAppReport(personById(S.modal.personId), report, todayISO());
  }

  function buildWhatsAppReport(person, report, dateKey) {
    return [
      `Team Markhor Daily Report`,
      `Date: ${isoToLabel(dateKey)}`,
      `Employee: ${person?.name || ""}`,
      `Hunting Messages Sent: ${fmtPlain(report.huntingMessagesSent || 0)}`,
      `Hunting Requests Sent: ${fmtPlain(report.huntingRequestsSent || 0)}`,
      `Posting on IDs: ${fmtPlain(report.postingOnIds || 0)}`,
      `Total IDs: ${fmtPlain(report.totalIds || 0)}`,
      `Deposit: ${fmt$(report.deposit || 0)}`,
      `New Players: ${fmtPlain(report.newPlayers || 0)}`,
      `Total Players: ${fmtPlain(report.totalPlayers || 0)}`
    ].join("\n");
  }

  function submitCheckout(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    const person = personById(S.modal.personId);
    const record = ensureAttendance(S.modal.personId, todayISO());
    const report = {};
    REPORT_FIELDS.forEach((fieldItem) => {
      report[fieldItem.key] = num(document.getElementById(`report-${fieldItem.key}`)?.value);
    });
    report.totalPlayers = getBaseTotalPlayers(person?.name || "", todayISO()) + num(report.newPlayers);
    record.checkOutAt = new Date().toISOString();
    record.checkOut = record.checkOutAt;
    record.duration = minutesBetween(record.checkInAt, record.checkOutAt);
    record.status = "completed";
    record.report = report;
    saveDB();
    syncAttendance(record);
    S.modal = null;
    render();
  }

  function copyCheckoutPreview() {
    updateCheckoutPreview();
    copyText(document.getElementById("checkout-preview")?.textContent || "");
  }

  function openLeaveRequest(personId) {
    S.modal = { type: "leaveRequest", personId };
    render();
  }

  function saveLeaveRequest(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    const requestId = S.modal.requestId;
    const personId = S.modal.personId || DB.leaveRequests.find((item) => item.id === requestId)?.employeeId;
    const date = parseDateInput(document.getElementById("leave-date")?.value);
    const reason = document.getElementById("leave-reason")?.value;
    const description = document.getElementById("leave-description")?.value.trim();
    const status = document.getElementById("leave-status")?.value || "pending";
    if (!personId || !date || !reason || !description) return alert("Please complete the leave request.");
    let request = DB.leaveRequests.find((item) => item.id === requestId);
    if (!request) {
      request = { id: uid("leave"), employeeId: personId, date, reason, description, status: "pending", reviewedNote: "" };
      DB.leaveRequests.unshift(request);
    } else {
      Object.assign(request, { date, reason, description, status });
    }
    syncLeaveToAttendance(request);
    saveDB();
    pushConfig();
    S.modal = null;
    render();
  }

  function syncLeaveToAttendance(request) {
    const person = personById(request.employeeId);
    const rec = ensureAttendance(request.employeeId, request.date);
    rec.agentName = person?.name || rec.agentName;
    rec.leaveRequestId = request.id;
    rec.leaveReason = request.reason;
    if (request.status === "approved") {
      rec.status = "leave-approved";
      rec.checkInAt = "";
      rec.checkOutAt = "";
      rec.duration = 0;
      syncAttendance(rec);
    }
  }

  function reviewLeave(id, approved) {
    if (!checkOnline()) return;
    const request = DB.leaveRequests.find((item) => item.id === id);
    if (!request) return;
    request.status = approved ? "approved" : "rejected";
    syncLeaveToAttendance(request);
    saveDB();
    pushConfig();
    render();
  }

  function editLeaveRequest(id) {
    const request = DB.leaveRequests.find((item) => item.id === id);
    if (!request) return;
    S.modal = { type: "leaveRequest", requestId: id, personId: request.employeeId };
    render();
  }

  function deleteLeaveRequest(id) {
    if (!checkOnline()) return;
    if (!confirm("Delete this leave request permanently?")) return;
    DB.leaveRequests = DB.leaveRequests.filter((item) => item.id !== id);
    DB.attendance.forEach((record) => {
      if (record.leaveRequestId === id && record.status === "leave-approved") {
        record.status = "absent";
        record.leaveReason = "";
      }
    });
    saveDB();
    pushConfig();
    render();
  }

  function openCloseShift() {
    if (!isShiftOpen()) {
      S.page = "closed";
      render();
      return;
    }
    S.modal = { type: "closeShift", balances: {} };
    render();
  }

  function closeBalanceInput(gameId, input) {
    S.modal.balances[gameId] = input.value;
    const diff = num(input.value) - gameBal(gameId);
    const diffEl = document.getElementById(`diff-${gameId}`);
    if (input.value === "") {
      input.style.borderColor = "";
      if (diffEl) {
        diffEl.textContent = "Enter the actual closing balance.";
        diffEl.className = "subtle";
      }
      return;
    }
    const ok = Math.abs(diff) < .01;
    input.style.borderColor = ok ? "var(--green)" : "var(--red)";
    if (diffEl) {
      diffEl.textContent = `Difference ${fmt$(diff)}`;
      diffEl.className = ok ? "success-text" : "danger-text";
    }
  }

  async function confirmCloseShift() {
    if (!checkOnline()) return;
    const bad = [];
    DB.games.forEach((game) => {
      const raw = S.modal.balances[game.id];
      if (raw === undefined || raw === "") bad.push(`${game.name}: missing balance`);
      else {
        const diff = num(raw) - gameBal(game.id);
        if (Math.abs(diff) >= .01) bad.push(`${game.name}: difference ${fmt$(diff)}`);
      }
    });
    if (bad.length) return alert(`Cannot close shift until balances match:\n${bad.join("\n")}`);
    const closingDate = todayISO();
    const shiftName = activeShiftName();
    const closeType = isDayClosingShift(shiftName) ? "day" : "shift";
    const summary = { ...shiftKPIs(), durationMins: minutesBetween(DB.shiftStart, new Date().toISOString()) };
    const daySummary = { ...kpisForEntries(dayEntriesFor(closingDate)), closedShiftCount: DB.closedShifts.filter((shift) => shift.date === closingDate).length + 1 };
    const closed = {
      id: uid("closed"),
      label: `${shiftName} - ${today()} - ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      date: closingDate,
      closedAt: new Date().toISOString(),
      entries: clone(DB.entries),
      summary: { ...summary, shiftName, closeType, daySummary },
      createdAt: new Date().toISOString()
    };
    DB.closedShifts.unshift(closed);
    DB.entries = [];
    DB.shiftOpen = false;
    saveDB();
    await sbPush();
    S.modal = null;
    S.page = "closed";
    render();
  }

  function startNewShift() {
    DB.shiftOpen = true;
    DB.activeShiftName = getCurrentShiftName();
    DB.shiftStart = new Date().toISOString();
    S.pf = newPF();
    S.ff = newFF();
    S.rf = newRF();
    saveDB();
    pushConfig();
    S.page = "shift";
    render();
  }

  function openModal(type) {
    S.modal = { type };
    render();
  }

  function closeModal() {
    S.modal = null;
    render();
  }

  function backdrop(event) {
    if (event.target.classList.contains("moverlay")) closeModal();
  }

  function setEntryFilter(value) {
    S.eFilter = value;
    const host = document.getElementById("entries-host");
    if (host) host.outerHTML = renderEntriesTable();
    else render();
  }

  function editEntry(id) {
    S.modal = { type: "editEntry", entryId: id };
    render();
  }

  function saveEntryEdit() {
    if (!checkOnline()) return;
    const ref = entryRef(S.modal.entryId);
    const entry = ref?.entry;
    if (!entry) return;
    entry.type = document.getElementById("edit-type").value;
    entry.date = parseDateInput(document.getElementById("edit-date").value);
    entry.shift = document.getElementById("edit-shift").value;
    entry.shiftSession = `${entry.shift} - ${isoToLabel(entry.date)}`;
    entry.agent = document.getElementById("edit-agent").value;
    entry.playerName = document.getElementById("edit-player").value.trim();
    entry.playerUrl = document.getElementById("edit-link").value.trim();
    entry.gameId = document.getElementById("edit-gameid").value.trim();
    entry.gameName = document.getElementById("edit-game").value;
    entry.deposit = num(document.getElementById("edit-deposit").value);
    entry.recharge = num(document.getElementById("edit-recharge").value);
    entry.promo = entry.recharge - entry.deposit;
    entry.promoP = entry.deposit ? (entry.promo / entry.deposit) * 100 : 0;
    entry.fpAmount = num(document.getElementById("edit-fp").value);
    entry.rdCredits = num(document.getElementById("edit-rd").value);
    entry.cashoutPaid = num(document.getElementById("edit-cashout").value);
    entry.custTag = document.getElementById("edit-cust").value.trim();
    entry.legalName = document.getElementById("edit-legal").value.trim();
    entry.contact = document.getElementById("edit-contact").value.trim();
    entry.email = document.getElementById("edit-email").value.trim();
    entry.dispute = !!document.getElementById("edit-dispute")?.checked;
    entry.disputeNote = document.getElementById("edit-dispute-note")?.value.trim() || "";
    entry.isNewPlayer = [entry.salesName, entry.legalName, entry.contact, entry.email].some((value) => String(value || "").trim());
    saveDB();
    if (ref.current) syncEntry(entry);
    else void sbPush();
    S.modal = null;
    render();
  }

  function deleteEntry(id) {
    if (!checkOnline()) return;
    if (!confirm("Delete this entry?")) return;
    const ref = entryRef(id);
    if (ref?.current) DB.entries = DB.entries.filter((entry) => entry.id !== id);
    else if (ref?.shift) ref.shift.entries = (ref.shift.entries || []).filter((entry) => entry.id !== id);
    saveDB();
    void sbPush();
    render();
  }

  function saveShift() {
    if (!checkOnline()) return;
    const name = document.getElementById("shift-name").value.trim();
    const start = document.getElementById("shift-start").value;
    const end = document.getElementById("shift-end").value;
    if (!name || !start || !end) return;
    DB.shifts.push({ id: uid("shift"), name, start, end });
    saveDB();
    pushConfig();
    closeModal();
  }

  function deleteShift(id) {
    if (!checkOnline()) return;
    if (!confirm("Delete this shift?")) return;
    DB.shifts = DB.shifts.filter((shift) => shift.id !== id);
    saveDB();
    pushConfig();
    render();
  }

  function saveAgent() {
    if (!checkOnline()) return;
    const data = {
      name: document.getElementById("agent-name").value.trim(),
      role: document.getElementById("agent-role").value.trim() || "agent",
      shiftId: document.getElementById("agent-shift").value,
      color: document.getElementById("agent-color").value,
      attendanceRequired: document.getElementById("agent-attendance-required").checked,
      showInDeposits: document.getElementById("agent-show-deposits").checked,
      targets: {
        newPlayers: num(document.getElementById("agent-target-players").value),
        deposit: num(document.getElementById("agent-target-deposit").value)
      }
    };
    if (!data.name) return;
    const existing = DB.agents.find((agent) => agent.id === S.modal.agentId);
    if (existing) Object.assign(existing, data);
    else DB.agents.push({ id: uid("agent"), ...data });
    saveDB();
    pushConfig();
    closeModal();
  }

  function openAgentEdit(id) {
    S.modal = { type: "editAgent", agentId: id };
    render();
  }

  function deleteAgent(id) {
    if (!checkOnline()) return;
    if (!confirm("Delete this agent and related attendance records?")) return;
    DB.agents = DB.agents.filter((agent) => agent.id !== id);
    DB.attendance = DB.attendance.filter((record) => record.agentId !== id);
    DB.leaveRequests = DB.leaveRequests.filter((request) => request.employeeId !== id);
    saveDB();
    pushConfig();
    render();
  }

  function saveStaff() {
    if (!checkOnline()) return;
    const role = document.getElementById("staff-role").value;
    const adminAccess = role !== "agent" && !!document.getElementById("staff-admin-access")?.checked;
    const selectedPerms = [...document.querySelectorAll(".perm-check:checked")].map((input) => input.value);
    const perms = adminAccess ? cleanPerms([...AGENT_PANEL_PERMISSIONS, "View Dashboard", ...selectedPerms]) : staffPermsForRole(role, false);
    const data = {
      name: document.getElementById("staff-name").value.trim(),
      email: document.getElementById("staff-email").value.trim(),
      role,
      adminAccess,
      pin: adminAccess ? document.getElementById("staff-pin").value : "",
      shiftId: document.getElementById("staff-shift").value,
      color: document.getElementById("staff-color").value,
      attendanceRequired: document.getElementById("staff-attendance-required").checked,
      showInDeposits: document.getElementById("staff-show-deposits").checked,
      targets: {
        newPlayers: num(document.getElementById("staff-target-players").value),
        deposit: num(document.getElementById("staff-target-deposit").value)
      },
      perms
    };
    if (!data.name || !data.email || (adminAccess && !data.pin)) return;
    const existing = DB.staff.find((staff) => staff.id === S.modal.staffId);
    if (existing) Object.assign(existing, data);
    else DB.staff.push({ id: uid("staff"), ...data });
    saveDB();
    pushConfig();
    closeModal();
  }

  function openStaffEdit(id) {
    S.modal = { type: "staff", staffId: id };
    render();
  }

  function deleteStaff(id) {
    if (!checkOnline()) return;
    if (!confirm("Delete this staff member?")) return;
    DB.staff = DB.staff.filter((staff) => staff.id !== id);
    if (S.adminUserId === id) {
      S.adminAuthed = false;
      S.adminUserId = "";
      S.page = "shift";
    }
    saveDB();
    pushConfig();
    render();
  }

  function staffRoleChanged(role) {
    const adminBox = document.getElementById("staff-admin-access");
    const adminRow = document.getElementById("staff-admin-row");
    const adminPanel = document.getElementById("staff-admin-permissions");
    const pinWrap = document.getElementById("staff-pin-wrap");
    const adminAccess = role !== "agent" && (staffDefaultAdminAccess(role) || !!adminBox?.checked);
    if (adminRow) adminRow.style.display = role === "agent" ? "none" : "";
    if (adminBox) adminBox.checked = role !== "agent" && adminAccess;
    if (adminPanel) adminPanel.style.display = adminAccess ? "" : "none";
    if (pinWrap) pinWrap.style.display = adminAccess ? "" : "none";
    const pin = document.getElementById("staff-pin");
    if (pin) pin.required = adminAccess;
    document.querySelectorAll(".perm-check").forEach((input) => { input.checked = staffPermsForRole(role, adminAccess).includes(input.value); });
    const operational = ["manager", "supervisor", "agent"].includes(role);
    const attendance = document.getElementById("staff-attendance-required");
    const deposits = document.getElementById("staff-show-deposits");
    if (attendance) attendance.checked = operational;
    if (deposits) deposits.checked = operational;
  }

  function staffAdminAccessChanged() {
    const role = document.getElementById("staff-role")?.value || "manager";
    const adminAccess = role !== "agent" && !!document.getElementById("staff-admin-access")?.checked;
    const adminPanel = document.getElementById("staff-admin-permissions");
    const pinWrap = document.getElementById("staff-pin-wrap");
    if (adminPanel) adminPanel.style.display = adminAccess ? "" : "none";
    if (pinWrap) pinWrap.style.display = adminAccess ? "" : "none";
    const pin = document.getElementById("staff-pin");
    if (pin) pin.required = adminAccess;
    document.querySelectorAll(".perm-check").forEach((input) => { input.checked = staffPermsForRole(role, adminAccess).includes(input.value); });
  }

  function staffSelectAll() {
    document.querySelectorAll(".perm-check").forEach((input) => { input.checked = true; });
  }

  function staffClearAll() {
    document.querySelectorAll(".perm-check").forEach((input) => { input.checked = false; });
  }

  function staffResetRole() {
    const role = document.getElementById("staff-role").value;
    const adminAccess = role !== "agent" && !!document.getElementById("staff-admin-access")?.checked;
    document.querySelectorAll(".perm-check").forEach((input) => { input.checked = staffPermsForRole(role, adminAccess).includes(input.value); });
  }

  function saveNewGame() {
    if (!checkOnline()) return;
    const name = document.getElementById("game-name").value.trim();
    if (!name) return;
    DB.games.push({
      id: uid("game"),
      name,
      backendLoaded: 0,
      pricePer1k: num(document.getElementById("game-price").value),
      backendLink: document.getElementById("game-backend").value.trim(),
      playerLink: document.getElementById("game-player").value.trim(),
      username: document.getElementById("game-user").value.trim(),
      password: document.getElementById("game-pass").value.trim(),
      gameVendorId: document.getElementById("game-vendor").value,
      reloadHistory: []
    });
    saveDB();
    pushConfig();
    closeModal();
  }

  function editGame(id) {
    S.editGameId = id;
    render();
  }

  function cancelGameEdit() {
    S.editGameId = null;
    render();
  }

  function saveGameEdit(id) {
    if (!checkOnline()) return;
    const game = DB.games.find((item) => item.id === id);
    if (!game) return;
    game.name = document.getElementById("eg-name").value.trim() || game.name;
    game.gameVendorId = document.getElementById("eg-vendor").value;
    game.pricePer1k = num(document.getElementById("eg-price").value);
    game.backendLink = document.getElementById("eg-backend").value.trim();
    game.playerLink = document.getElementById("eg-player").value.trim();
    game.username = document.getElementById("eg-user").value.trim();
    game.password = document.getElementById("eg-pass").value.trim();
    S.editGameId = null;
    saveDB();
    pushConfig();
    render();
  }

  function topUpGame(id) {
    if (!checkOnline()) return;
    const game = DB.games.find((item) => item.id === id);
    if (!game) return;
    const amount = num(prompt("Amount being ADDED to backend"));
    if (!amount) return;
    game.backendLoaded = num(game.backendLoaded) + amount;
    game.reloadHistory = game.reloadHistory || [];
    game.reloadHistory.unshift({ date: todayISO(), amount, at: new Date().toISOString() });
    saveDB();
    pushConfig();
    render();
  }

  function setGameBalance(id) {
    if (!checkOnline()) return;
    const game = DB.games.find((item) => item.id === id);
    if (!game) return;
    const amount = prompt("Set exact starting balance");
    if (amount === null || amount === "") return;
    game.backendLoaded = num(amount);
    saveDB();
    pushConfig();
    render();
  }

  function deleteGame(id) {
    if (!checkOnline()) return;
    if (!confirm("Delete this game?")) return;
    DB.games = DB.games.filter((game) => game.id !== id);
    saveDB();
    pushConfig();
    render();
  }

  function savePayMethod() {
    if (!checkOnline()) return;
    const name = document.getElementById("pay-method-name").value.trim();
    if (!name) return;
    DB.payMethods.push({ id: uid("pay"), name, tags: [] });
    saveDB();
    pushConfig();
    closeModal();
  }

  function addPayTag(methodId) {
    if (!checkOnline()) return;
    const input = document.getElementById(`tag-${methodId}`);
    const method = DB.payMethods.find((item) => item.id === methodId);
    if (!method || !input.value.trim()) return;
    method.tags.push({ id: uid("tag"), tag: input.value.trim() });
    saveDB();
    pushConfig();
    render();
  }

  function ensurePayMethodTag(methodId, tagText) {
    const method = DB.payMethods.find((item) => item.id === methodId);
    const tag = String(tagText || "").trim();
    if (!method || !tag) return null;
    let existing = method.tags.find((item) => item.tag.toLowerCase() === tag.toLowerCase());
    if (!existing) {
      existing = { id: uid("tag"), tag, active: true, archivedAt: "" };
      method.tags.push(existing);
    } else {
      existing.active = true;
      existing.archivedAt = "";
    }
    return existing;
  }

  function togglePayTag(methodId, tagId, active) {
    if (!checkOnline()) return;
    const tag = DB.payMethods.find((method) => method.id === methodId)?.tags.find((item) => item.id === tagId);
    if (!tag) return;
    tag.active = !!active;
    tag.archivedAt = active ? "" : new Date().toISOString();
    saveDB();
    pushConfig();
    render();
  }

  function deletePayTag(methodId, tagId) {
    if (!checkOnline()) return;
    const method = DB.payMethods.find((item) => item.id === methodId);
    if (!method) return;
    method.tags = method.tags.filter((tag) => tag.id !== tagId);
    saveDB();
    pushConfig();
    render();
  }

  function deletePayMethod(id) {
    if (!checkOnline()) return;
    if (!confirm("Delete this payment method?")) return;
    DB.payMethods = DB.payMethods.filter((method) => method.id !== id);
    saveDB();
    pushConfig();
    render();
  }

  function addPage() {
    if (!checkOnline()) return;
    const input = document.getElementById("new-page-name");
    const name = input.value.trim();
    if (!name) return;
    DB.pageNames.push({ id: uid("page"), name, link: "", accessTo: "" });
    saveDB();
    pushConfig();
    render();
  }

  function savePageName() {
    if (!checkOnline()) return;
    const name = document.getElementById("page-name")?.value.trim();
    if (!name) return;
    const payload = {
      name,
      link: document.getElementById("page-link")?.value.trim() || "",
      accessTo: document.getElementById("page-access")?.value.trim() || ""
    };
    const existing = S.modal?.pageId ? DB.pageNames.find((page) => page.id === S.modal.pageId) : null;
    if (existing) Object.assign(existing, payload);
    else DB.pageNames.push({ id: uid("page"), ...payload });
    saveDB();
    pushConfig();
    closeModal();
  }

  function editPage(id) {
    S.modal = { type: "pageName", pageId: id };
    render();
  }

  function deletePage(id) {
    if (!checkOnline()) return;
    DB.pageNames = DB.pageNames.filter((page) => page.id !== id);
    saveDB();
    pushConfig();
    render();
  }

  function savePayVendor() {
    if (!checkOnline()) return;
    const name = document.getElementById("pay-vendor-name").value.trim();
    if (!name) return;
    DB.payVendors.push({ id: uid("vendor"), name, notes: "", fees: [], paid: 0, payments: [], deductions: [] });
    saveDB();
    pushConfig();
    closeModal();
  }

  function recordVendorPayment(id) {
    if (!checkOnline()) return;
    const vendor = DB.payVendors.find((item) => item.id === id);
    if (!vendor) return;
    S.modal = { type: "vendorPayment", vendorId: id };
    render();
  }

  function saveVendorPayment() {
    if (!checkOnline()) return;
    const vendor = DB.payVendors.find((item) => item.id === S.modal?.vendorId);
    if (!vendor) return;
    const amount = num(document.getElementById("vendor-payment-amount")?.value);
    if (amount <= 0) return;
    const date = parseDateInput(document.getElementById("vendor-payment-date")?.value);
    const time = document.getElementById("vendor-payment-time")?.value || "00:00";
    const reference = document.getElementById("vendor-payment-ref")?.value.trim() || "";
    const note = document.getElementById("vendor-payment-note")?.value.trim() || "";
    vendor.payments = Array.isArray(vendor.payments) ? vendor.payments : [];
    vendor.payments.push({ id: uid("vendor-payment"), amount, at: buildDateTime(date, time) || new Date().toISOString(), reference, note });
    syncVendorPaid(vendor);
    saveDB();
    pushConfig();
    S.modal = null;
    render();
  }

  function viewVendorPaymentHistory(id) {
    S.modal = { type: "vendorPaymentHistory", vendorId: id };
    render();
  }

  function editVendorPayment(vendorId, paymentId) {
    if (!checkOnline()) return;
    const vendor = DB.payVendors.find((item) => item.id === vendorId);
    const payment = vendor?.payments?.find((item) => item.id === paymentId);
    if (!vendor || !payment) return;
    const amount = num(prompt("Payment amount", payment.amount));
    if (amount <= 0) return;
    const at = prompt("Date and time", payment.at || new Date().toISOString()) || payment.at || new Date().toISOString();
    payment.amount = amount;
    payment.at = at;
    syncVendorPaid(vendor);
    saveDB();
    pushConfig();
    render();
  }

  function deleteVendorPayment(vendorId, paymentId) {
    if (!checkOnline()) return;
    if (!confirm("Delete this vendor payment entry?")) return;
    const vendor = DB.payVendors.find((item) => item.id === vendorId);
    if (!vendor) return;
    vendor.payments = (vendor.payments || []).filter((item) => item.id !== paymentId);
    syncVendorPaid(vendor);
    saveDB();
    pushConfig();
    render();
  }

  function addVendorDeduction(id) {
    if (!checkOnline()) return;
    const vendor = DB.payVendors.find((item) => item.id === id);
    if (!vendor) return;
    const amount = num(prompt("Dispute or deduction amount"));
    if (amount <= 0) return;
    const note = prompt("Reason for deduction") || "";
    vendor.deductions = Array.isArray(vendor.deductions) ? vendor.deductions : [];
    vendor.deductions.push({ id: uid("deduction"), amount, note, at: new Date().toISOString() });
    saveDB();
    pushConfig();
    render();
  }

  function editVendorDeduction(vendorId, deductionId) {
    if (!checkOnline()) return;
    const vendor = DB.payVendors.find((item) => item.id === vendorId);
    const deduction = vendor?.deductions?.find((item) => item.id === deductionId);
    if (!vendor || !deduction) return;
    const amount = num(prompt("Dispute or deduction amount", deduction.amount));
    if (amount <= 0) return;
    deduction.amount = amount;
    deduction.note = prompt("Reason for deduction", deduction.note || "") || "";
    deduction.at = prompt("Date and time", deduction.at || new Date().toISOString()) || deduction.at || new Date().toISOString();
    saveDB();
    pushConfig();
    render();
  }

  function deleteVendorDeduction(vendorId, deductionId) {
    if (!checkOnline()) return;
    if (!confirm("Delete this dispute or deduction entry?")) return;
    const vendor = DB.payVendors.find((item) => item.id === vendorId);
    if (!vendor) return;
    vendor.deductions = (vendor.deductions || []).filter((item) => item.id !== deductionId);
    saveDB();
    pushConfig();
    render();
  }

  function deletePayVendor(id) {
    if (!checkOnline()) return;
    if (!confirm("Delete this payment vendor?")) return;
    DB.payVendors = DB.payVendors.filter((vendor) => vendor.id !== id);
    saveDB();
    pushConfig();
    render();
  }

  function addVendorFee(vendorId) {
    if (!checkOnline()) return;
    const vendor = DB.payVendors.find((item) => item.id === vendorId);
    if (!vendor) return;
    const methodId = document.getElementById(`vendor-method-${vendorId}`).value;
    const payTag = document.getElementById(`vendor-tag-${vendorId}`).value.trim();
    if (!payTag) return alert("Enter the payment tag for this vendor row.");
    ensurePayMethodTag(methodId, payTag);
    vendor.fees.push({
      id: uid("fee"),
      payMethodId: methodId,
      fee: num(document.getElementById(`vendor-fee-${vendorId}`).value),
      payTag
    });
    saveDB();
    pushConfig();
    render();
  }

  function updPVFee(vendorId, feeId, value) {
    if (!checkOnline()) return;
    const fee = DB.payVendors.find((vendor) => vendor.id === vendorId)?.fees.find((item) => item.id === feeId);
    if (!fee) return;
    fee.fee = num(value);
    saveDB();
    pushConfig();
  }

  function editVendorFee(feeId) {
    S.editVendorFeeId = feeId;
    render();
  }

  function cancelVendorFeeEdit() {
    S.editVendorFeeId = "";
    render();
  }

  function saveVendorFeeEdit(vendorId, feeId) {
    if (!checkOnline()) return;
    const fee = DB.payVendors.find((vendor) => vendor.id === vendorId)?.fees.find((item) => item.id === feeId);
    if (!fee) return;
    fee.fee = num(document.getElementById(`edit-fee-${feeId}`)?.value);
    S.editVendorFeeId = "";
    saveDB();
    pushConfig();
    render();
  }

  function deleteVendorFee(vendorId, feeId) {
    if (!checkOnline()) return;
    const vendor = DB.payVendors.find((item) => item.id === vendorId);
    if (!vendor) return;
    vendor.fees = vendor.fees.filter((fee) => fee.id !== feeId);
    saveDB();
    pushConfig();
    render();
  }

  function addGameVendor() {
    if (!checkOnline()) return;
    const input = document.getElementById("new-game-vendor");
    const name = input.value.trim();
    if (!name) return;
    DB.gameVendors.push({ id: uid("game-vendor"), name, notes: "" });
    saveDB();
    pushConfig();
    render();
  }

  function deleteGameVendor(id) {
    if (!checkOnline()) return;
    DB.gameVendors = DB.gameVendors.filter((vendor) => vendor.id !== id);
    DB.games.forEach((game) => { if (game.gameVendorId === id) game.gameVendorId = ""; });
    saveDB();
    pushConfig();
    render();
  }

  function addExpense(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    DB.expenses.unshift({
      id: uid("expense"),
      date: parseDateInput(document.getElementById("expense-date").value),
      category: document.getElementById("expense-category").value,
      description: document.getElementById("expense-description").value.trim(),
      amount: num(document.getElementById("expense-amount").value)
    });
    saveDB();
    pushConfig();
    render();
  }

  function deleteExpense(id) {
    if (!checkOnline()) return;
    DB.expenses = DB.expenses.filter((expense) => expense.id !== id);
    saveDB();
    pushConfig();
    render();
  }

  function addExpenseCategory() {
    if (!checkOnline()) return;
    const input = document.getElementById("new-exp-cat");
    const name = input.value.trim();
    if (!name) return;
    DB.expCats.push({ id: uid("exp"), name });
    saveDB();
    pushConfig();
    render();
  }

  function deleteExpenseCategory(id) {
    if (!checkOnline()) return;
    DB.expCats = DB.expCats.filter((cat) => cat.id !== id);
    saveDB();
    pushConfig();
    render();
  }

  function addScheduledOff(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    const employeeId = document.getElementById("off-person").value;
    const date = parseDateInput(document.getElementById("off-date").value);
    const reasonSel = document.getElementById("off-reason").value;
    const custom = document.getElementById("off-custom").value.trim();
    const reason = reasonSel === "Custom" ? custom || "Custom" : reasonSel;
    const person = personById(employeeId);
    DB.scheduledOff.unshift({ id: uid("off"), employeeId, date, reason });
    const rec = ensureAttendance(employeeId, date);
    rec.agentName = person?.name || "";
    rec.status = "off";
    rec.offReason = reason;
    rec.checkInAt = "";
    rec.checkOutAt = "";
    rec.duration = 0;
    saveDB();
    syncAttendance(rec);
    pushConfig();
    render();
  }

  function deleteScheduledOff(id) {
    if (!checkOnline()) return;
    const item = DB.scheduledOff.find((entry) => entry.id === id);
    DB.scheduledOff = DB.scheduledOff.filter((entry) => entry.id !== id);
    if (item) {
      const rec = getAttendance(item.employeeId, item.date);
      if (rec && rec.status === "off") rec.status = "absent";
    }
    saveDB();
    pushConfig();
    render();
  }

  function correctAttendance(id) {
    S.modal = { type: "correctAttendance", recordId: id };
    render();
  }

  function saveAttendanceCorrection() {
    if (!checkOnline()) return;
    const rec = DB.attendance.find((item) => item.id === S.modal.recordId);
    if (!rec) return;
    const date = parseDateInput(document.getElementById("correct-date").value);
    const checkInTime = document.getElementById("correct-in").value;
    const checkOutTime = document.getElementById("correct-out").value;
    rec.date = date;
    rec.status = document.getElementById("correct-status").value;
    rec.checkInAt = checkInTime ? buildDateTime(date, checkInTime) : "";
    rec.checkOutAt = checkOutTime ? buildDateTime(date, checkOutTime) : "";
    rec.checkIn = rec.checkInAt;
    rec.checkOut = rec.checkOutAt;
    rec.duration = minutesBetween(rec.checkInAt, rec.checkOutAt);
    rec.leaveReason = document.getElementById("correct-reason").value.trim();
    const person = personById(rec.agentId);
    rec.late = isLateForPerson(person, rec.checkInAt);
    const report = {};
    REPORT_FIELDS.forEach((fieldItem) => { report[fieldItem.key] = num(document.getElementById(`correct-${fieldItem.key}`).value); });
    const hasReport = REPORT_FIELDS.some((fieldItem) => report[fieldItem.key] > 0);
    report.totalPlayers = getBaseTotalPlayers(rec.agentName, rec.date) + num(report.newPlayers);
    rec.report = hasReport ? report : null;
    saveDB();
    syncAttendance(rec);
    S.modal = null;
    render();
  }

  function deleteAttendance(id) {
    if (!checkOnline()) return;
    if (!confirm("Delete this attendance record?")) return;
    DB.attendance = DB.attendance.filter((record) => record.id !== id);
    saveDB();
    void sbPush();
    render();
  }

  function setAttendanceAdmin(tab) {
    S.adminAttendanceTab = tab;
    render();
  }

  function setVendorSection(section) {
    S.vendorSection = section;
    render();
  }

  function setPayMethodSection(section) {
    S.payMethodSection = section;
    render();
  }

  function addAttendanceReason(key, inputId) {
    if (!checkOnline()) return;
    const input = document.getElementById(inputId);
    const value = input.value.trim();
    if (!value) return;
    DB.attendanceSettings[key].push(value);
    saveDB();
    pushConfig();
    render();
  }

  function removeAttendanceReason(key, value) {
    if (!checkOnline()) return;
    DB.attendanceSettings[key] = DB.attendanceSettings[key].filter((item) => item !== value);
    saveDB();
    pushConfig();
    render();
  }

  function updateLateGrace(value) {
    DB.attendanceSettings.lateGraceMinutes = num(value);
    saveDB();
    pushConfig();
  }

  function clearTransactions() {
    Object.assign(S, { txSearch: "", txType: "all", txAgent: "", txGame: "", txShift: "", txDate: "", txStartDate: "", txEndDate: "", txSort: "newest" });
    render();
  }

  function clearPlayerLookup() {
    S.txPlayerLookup = "";
    render();
  }

  function clearPerformance() {
    S.pfDate = "";
    S.pfShift = "";
    render();
  }

  function clearAttendanceFilters() {
    S.afAgent = "";
    S.afDate = "";
    S.afStatus = "all";
    render();
  }

  function exportRows(filename, rows) {
    downloadTextFile(filename, rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv;charset=utf-8");
  }

  function exportEntries() {
    exportRows(`team-markhor-entries-${todayISO()}.csv`, [
      ["Type", "Session", "Date", "Shift", "Agent", "Player Name", "Game ID", "Game Name", "Deposit", "Recharge", "Freeplay", "Redeem Credits", "Cashout Paid", "New Player"],
      ...allEntries().map((entry) => [entry.type, entry.shiftSession || "Current", isoToLabel(entry.date), entry.shift, entry.agent, entry.playerName, entry.gameId, entry.gameName, entry.deposit, entry.recharge, entry.fpAmount, entry.rdCredits, entry.cashoutPaid, entry.isNewPlayer ? "Yes" : "No"])
    ]);
  }

  function exportExpenses() {
    exportRows(`team-markhor-expenses-${todayISO()}.csv`, [["Date", "Category", "Description", "Amount in Pakistani Rupees"], ...DB.expenses.map((expense) => [isoToLabel(expense.date), expense.category, expense.description, expense.amount])]);
  }

  function exportPerformance() {
    const rows = performanceRows();
    exportRows(`team-markhor-agent-performance-${todayISO()}.csv`, [["Date", "Agent", "Type", "Player", "Game", "Deposit", "Recharge", "New Player"], ...rows.map((entry) => [isoToLabel(entry.date), entry.agent, entry.type, entry.playerName, entry.gameName, entry.deposit, entry.recharge, entry.isNewPlayer ? "Yes" : "No"])]);
  }

  function exportAttendance() {
    exportRows(`team-markhor-attendance-${todayISO()}.csv`, [["Employee", "Date", "Status", "Check In", "Check Out", "Duration Minutes", "Leave Reason"], ...DB.attendance.map((record) => [record.agentName, isoToLabel(record.date), record.status, record.checkInAt, record.checkOutAt, record.duration, record.leaveReason || record.offReason || ""])]);
  }

  function exportMonthlyAttendance() {
    const people = allPeople();
    exportRows(`team-markhor-monthly-attendance-${S.month}.csv`, [["Date", ...people.map((person) => person.name)], ...monthDays(S.month).map((day) => [isoToLabel(day), ...people.map((person) => attendanceText(getAttendance(person.id, day), day))])]);
  }

  function attendanceText(record, day) {
    if (day > todayISO()) return "Future";
    if (!record) return "Absent";
    if (record.status === "off") return "Scheduled Off";
    if (record.status === "leave" || record.status === "leave-approved") return "Leave";
    if (record.checkInAt) return record.late ? "Late" : "Present";
    return "Absent";
  }

  function exportMonthlyProgress() {
    const people = allPeople();
    const personId = S.attendancePerson || people[0]?.id || "";
    const records = DB.attendance.filter((record) => record.agentId === personId && String(record.date).startsWith(S.month) && record.report);
    exportRows(`team-markhor-monthly-progress-${S.month}.csv`, [["Date", ...REPORT_FIELDS.map((fieldItem) => fieldItem.label), "Total Players"], ...records.map((record) => [isoToLabel(record.date), ...REPORT_FIELDS.map((fieldItem) => record.report?.[fieldItem.key] || 0), record.report?.totalPlayers || 0])]);
  }

  function exportJson() {
    downloadTextFile(`team-markhor-backup-${todayISO()}.json`, JSON.stringify(DB, null, 2), "application/json");
  }

  function loadRestoreFile(file) {
    restoreFileText = "";
    if (!file) return render();
    const reader = new FileReader();
    reader.onload = () => {
      restoreFileText = String(reader.result || "");
      render();
    };
    reader.readAsText(file);
  }

  function restoreBackup() {
    if (!restoreFileText) return;
    let parsed;
    try { parsed = JSON.parse(restoreFileText); } catch { return alert("Invalid JSON backup."); }
    if (!confirm("Restore this backup and overwrite all current data?")) return;
    DB = normalizeDB(parsed);
    saveDB();
    restoreFileText = "";
    void sbPush();
    render();
  }

  async function testSupabase() {
    DB.supabase.url = document.getElementById("sb-url").value.trim();
    DB.supabase.anonKey = document.getElementById("sb-key").value.trim();
    const wasEnabled = DB.supabase.enabled;
    DB.supabase.enabled = true;
    try {
      await sbRequest("crm_config", { method: "GET" }, "?select=id&limit=1");
      lastSavedStatus = "Connection test succeeded.";
    } catch (error) {
      lastSavedStatus = "Connection test failed. Check setup and network.";
    } finally {
      DB.supabase.enabled = wasEnabled;
    }
    render();
  }

  function saveSupabase(enabled) {
    DB.supabase.url = document.getElementById("sb-url").value.trim();
    DB.supabase.anonKey = document.getElementById("sb-key").value.trim();
    DB.supabase.enabled = enabled;
    saveDB();
    pushConfig();
    lastSavedStatus = enabled ? "Supabase settings saved." : "Supabase disabled.";
    render();
  }

  async function pushAll() {
    lastSavedStatus = "Pushing all data...";
    render();
    const ok = await sbPush();
    lastSavedStatus = ok ? "All data pushed." : "Push failed silently. Confirm SQL setup and network.";
    render();
  }

  async function pullAll() {
    lastSavedStatus = "Pulling from Supabase...";
    render();
    const ok = await sbPull(false);
    lastSavedStatus = ok ? "Data pulled." : "Pull failed silently. Local data remains available.";
    render();
  }

  async function autoSyncNow() {
    await flushSync();
    await sbPull(false);
    lastSavedStatus = "Auto-sync complete.";
    render();
  }

  function copySql() {
    copyText(SQL_SCRIPT);
    lastSavedStatus = "SQL copied.";
    render();
  }

  function saveOverrideCode() {
    if (!checkOnline()) return;
    DB.overrideCode = document.getElementById("override-code").value || DB.overrideCode;
    saveDB();
    pushConfig();
    const msg = document.getElementById("code-save-msg");
    if (msg) {
      msg.textContent = "Code saved.";
      setTimeout(() => { const node = document.getElementById("code-save-msg"); if (node) node.textContent = ""; }, 2000);
    }
  }

  function saveSalesTargets() {
    saveTargets();
  }

  function saveTargets() {
    if (!checkOnline()) return;
    DB.salesTargets.monthlySales = num(document.getElementById("target-sales")?.value);
    DB.salesTargets.monthlyNewPlayers = num(document.getElementById("target-players")?.value);
    combinedPeople().forEach((person) => {
      const collection = person.source === "agent" ? DB.agents : DB.staff;
      const record = collection.find((item) => item.id === person.id);
      if (!record) return;
      record.targets = {
        ...(record.targets || {}),
        deposit: num(document.getElementById(`target-${person.source}-${person.id}-sales`)?.value),
        newPlayers: num(document.getElementById(`target-${person.source}-${person.id}-players`)?.value)
      };
    });
    saveDB();
    pushConfig();
    const msg = document.getElementById("sales-target-save-msg");
    if (msg) {
      msg.textContent = "Targets saved.";
      setTimeout(() => { const node = document.getElementById("sales-target-save-msg"); if (node) node.textContent = ""; }, 2000);
    }
  }

  function copy(value) {
    copyText(value);
  }

  function renderNow() {
    render();
  }

  function redeemLookup() {
    const id = String(S.rf.gameId || "").trim();
    const match = id ? allEntries().filter((entry) => entry.gameId === id).sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)))[0] : null;
    if (match?.gameName && !S.rf.gameName) S.rf.gameName = match.gameName;
    render();
  }

  async function bootApp() {
    DB = loadDB();
    S = createState();
    S.pf.agent = salesPeople()[0]?.name || "";
    S.ff.agent = salesPeople()[0]?.name || "";
    S.rf.agent = salesPeople()[0]?.name || "";
    S.pf.gameName = DB.games[0]?.name || "";
    S.ff.gameName = DB.games[0]?.name || "";
    S.rf.gameName = DB.games[0]?.name || "";
    bootStatus.textContent = "Connecting to Supabase...";
    await sbPull(true);
    S.pf.agent = salesPeople()[0]?.name || S.pf.agent;
    S.ff.agent = salesPeople()[0]?.name || S.ff.agent;
    S.rf.agent = salesPeople()[0]?.name || S.rf.agent;
    S.pf.gameName = DB.games[0]?.name || S.pf.gameName;
    S.ff.gameName = DB.games[0]?.name || S.ff.gameName;
    S.rf.gameName = DB.games[0]?.name || S.rf.gameName;
    saveDB();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    document.addEventListener("input", (event) => clearFieldError(event.target));
    document.addEventListener("change", (event) => clearFieldError(event.target));
    autoPullTimer = setInterval(async () => {
      if (!IS_ONLINE || syncBusy || syncQueue.length) return;
      const before = JSON.stringify(DB);
      const ok = await sbPull(true);
      if (ok && JSON.stringify(DB) !== before) render();
    }, 30000);
    clockTimer = setInterval(updateClock, 1000);
    render();
    app.classList.remove("hidden");
    boot.classList.add("hidden");
  }

  window.TM = {
    setPage, openAdminGate, loginAdmin, createFirstAdmin, lockAdmin,
    parseDateInput, dateLabel: isoToLabel,
    setShiftTab, setAdmin, setS, setPF, setFF, setRF, setPaidMethod, setPaidTag,
    updatePaidMoney, toggleDepositOnPage, validateLink, validateOptionalLink, submitPaid,
    clearPaid, submitFreeplay, clearFreeplay, submitRedeem, clearRedeem, redeemLookup,
    approveOverride, cancelOverride, checkIn, markLeave, openCheckout, submitCheckout,
    updateCheckoutPreview, copyCheckoutPreview, openLeaveRequest, saveLeaveRequest,
    reviewLeave, editLeaveRequest, deleteLeaveRequest, openCloseShift, closeBalanceInput,
    confirmCloseShift, startNewShift, openModal, closeModal, backdrop, setEntryFilter,
    editEntry, saveEntryEdit, deleteEntry, saveShift, deleteShift, saveAgent, openAgentEdit,
    deleteAgent, saveStaff, openStaffEdit, deleteStaff, staffRoleChanged, staffAdminAccessChanged, staffSelectAll,
    staffClearAll, staffResetRole, saveNewGame, editGame, cancelGameEdit, saveGameEdit,
    topUpGame, setGameBalance, deleteGame, savePayMethod, addPayTag, deletePayTag,
    deletePayMethod, addPage, savePageName, editPage, deletePage, savePayVendor, recordVendorPayment, saveVendorPayment, viewVendorPaymentHistory,
    editVendorPayment, deleteVendorPayment, addVendorDeduction, editVendorDeduction, deleteVendorDeduction, deletePayVendor, addVendorFee,
    updPVFee, editVendorFee, cancelVendorFeeEdit, saveVendorFeeEdit, deleteVendorFee, togglePayTag, addGameVendor, deleteGameVendor, addExpense, deleteExpense,
    addExpenseCategory, deleteExpenseCategory, addScheduledOff, deleteScheduledOff,
    correctAttendance, saveAttendanceCorrection, deleteAttendance, setAttendanceAdmin, setVendorSection, setPayMethodSection,
    addAttendanceReason, removeAttendanceReason, updateLateGrace, clearTransactions,
    clearPlayerLookup, clearPerformance, clearAttendanceFilters, exportEntries, exportExpenses,
    exportPerformance, exportAttendance, exportMonthlyAttendance, exportMonthlyProgress,
    exportJson, loadRestoreFile, restoreBackup, testSupabase, saveSupabase, pushAll,
    pullAll, autoSyncNow, copySql, saveOverrideCode, saveSalesTargets, saveTargets, copy, renderNow
  };

  document.addEventListener("DOMContentLoaded", bootApp);
})();
