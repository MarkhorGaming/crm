(function () {
  "use strict";

  const STORAGE_KEY = "gcrmv5";
  const ADMIN_SESSION_KEY = "gcrmv5-admin-session";
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
  const ADMIN_SECTION_PERMS = {
    dashboard: "View Dashboard",
    transactions: "View Entries",
    performance: "View Dashboard",
    targets: "Manage Settings",
    pnl: "View Dashboard",
    attendance: "Manage Agents",
    team: "Manage Agents",
    staff: "Manage Settings",
    games: "View Games",
    payMethods: "Manage Settings",
    pages: "Manage Settings",
    vendors: "View Vendors",
    audit: "Manage Settings",
    supabase: "Manage Settings",
    settings: "Manage Settings",
    backup: "Export / Backup"
  };
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
    shiftEvening: "shift-evening",
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

  const THEME_PRESETS = {
    white: {
      bg: "#f6f8fc",
      bg2: "#ffffff",
      panel: "#ffffff",
      panel2: "#f1f5f9",
      panel3: "#e2e8f0",
      input: "#ffffff",
      soft: "#f8fafc",
      topbar: "rgba(255, 255, 255, .92)",
      tableHead: "#f8fafc",
      activeBg: "#eff6ff",
      successBg: "#ecfdf5",
      dangerBg: "#fff1f2",
      warnBg: "#fff7ed",
      line: "#d9e2ee",
      lineSoft: "rgba(23, 32, 51, .08)",
      text: "#172033",
      muted: "#64748b",
      muted2: "#94a3b8",
      primary: "#2563eb",
      primaryDark: "#1d4ed8",
      purple: "#7c3aed",
      green: "#059669",
      red: "#e11d48",
      amber: "#d97706",
      gray: "#64748b",
      gold: "#f59e0b",
      brandA: "#0b0f18",
      brandB: "#166534",
      brandInk: "#f8fafc",
      brandAccent: "#22c55e",
      gameCard1: "#eff6ff",
      gameCard2: "#f5f3ff",
      gameCard3: "#ecfdf5",
      gameCard4: "#fff7ed",
      shadow: "0 18px 44px rgba(15, 23, 42, .08)"
    },
    dark: {
      bg: "#0b1020",
      bg2: "#101827",
      panel: "#111827",
      panel2: "#172033",
      panel3: "#1f2a44",
      input: "#0f172a",
      soft: "#151f33",
      topbar: "rgba(17, 24, 39, .92)",
      tableHead: "#151f33",
      activeBg: "rgba(56, 189, 248, .12)",
      successBg: "rgba(16, 185, 129, .13)",
      dangerBg: "rgba(244, 63, 94, .13)",
      warnBg: "rgba(245, 158, 11, .14)",
      line: "#26344f",
      lineSoft: "rgba(226, 232, 240, .08)",
      text: "#e5edf7",
      muted: "#9aa8bd",
      muted2: "#718096",
      primary: "#38bdf8",
      primaryDark: "#0ea5e9",
      purple: "#a78bfa",
      green: "#34d399",
      red: "#fb7185",
      amber: "#fbbf24",
      gray: "#94a3b8",
      gold: "#f59e0b",
      brandA: "#050816",
      brandB: "#14532d",
      brandInk: "#e0f2fe",
      brandAccent: "#86efac",
      gameCard1: "#122033",
      gameCard2: "#201a35",
      gameCard3: "#112a24",
      gameCard4: "#2a2111",
      shadow: "0 18px 44px rgba(0, 0, 0, .35)"
    },
    black: {
      bg: "#050505",
      bg2: "#0b0b0b",
      panel: "#101010",
      panel2: "#181818",
      panel3: "#242424",
      input: "#0b0b0b",
      soft: "#141414",
      topbar: "rgba(16, 16, 16, .94)",
      tableHead: "#181818",
      activeBg: "rgba(250, 204, 21, .14)",
      successBg: "rgba(34, 197, 94, .13)",
      dangerBg: "rgba(248, 113, 113, .14)",
      warnBg: "rgba(250, 204, 21, .15)",
      line: "#2f2f2f",
      lineSoft: "rgba(245, 245, 245, .08)",
      text: "#f5f5f5",
      muted: "#a3a3a3",
      muted2: "#737373",
      primary: "#facc15",
      primaryDark: "#eab308",
      purple: "#c084fc",
      green: "#22c55e",
      red: "#f87171",
      amber: "#f59e0b",
      gray: "#a3a3a3",
      gold: "#facc15",
      brandA: "#000000",
      brandB: "#166534",
      brandInk: "#f8fafc",
      brandAccent: "#facc15",
      gameCard1: "#1f1b0a",
      gameCard2: "#20142d",
      gameCard3: "#102017",
      gameCard4: "#241a08",
      shadow: "0 18px 44px rgba(0, 0, 0, .48)"
    },
    mint: {
      bg: "#eef7f3",
      bg2: "#ffffff",
      panel: "#ffffff",
      panel2: "#e0f2ea",
      panel3: "#c8e6d8",
      input: "#ffffff",
      soft: "#f8fafc",
      topbar: "rgba(255, 255, 255, .92)",
      tableHead: "#ecfdf5",
      activeBg: "#dcfce7",
      successBg: "#ecfdf5",
      dangerBg: "#fff1f2",
      warnBg: "#fff7ed",
      line: "#cbded5",
      lineSoft: "rgba(20, 83, 45, .08)",
      text: "#172033",
      muted: "#64748b",
      muted2: "#94a3b8",
      primary: "#047857",
      primaryDark: "#065f46",
      purple: "#4f46e5",
      green: "#059669",
      red: "#e11d48",
      amber: "#d97706",
      gray: "#64748b",
      gold: "#ca8a04",
      brandA: "#052e2b",
      brandB: "#15803d",
      brandInk: "#f8fafc",
      brandAccent: "#22c55e",
      gameCard1: "#e0f2fe",
      gameCard2: "#eef2ff",
      gameCard3: "#dcfce7",
      gameCard4: "#fef9c3",
      shadow: "0 18px 44px rgba(15, 23, 42, .08)"
    },
    ocean: {
      bg: "#eef6fb",
      bg2: "#ffffff",
      panel: "#ffffff",
      panel2: "#e0f2fe",
      panel3: "#bae6fd",
      input: "#ffffff",
      soft: "#f8fafc",
      topbar: "rgba(255, 255, 255, .92)",
      tableHead: "#eff6ff",
      activeBg: "#dbeafe",
      successBg: "#ecfdf5",
      dangerBg: "#fff1f2",
      warnBg: "#fff7ed",
      line: "#c9ddec",
      lineSoft: "rgba(8, 47, 73, .08)",
      text: "#172033",
      muted: "#64748b",
      muted2: "#94a3b8",
      primary: "#0284c7",
      primaryDark: "#0369a1",
      purple: "#7c3aed",
      green: "#0f766e",
      red: "#e11d48",
      amber: "#d97706",
      gray: "#64748b",
      gold: "#d97706",
      brandA: "#082f49",
      brandB: "#0f766e",
      brandInk: "#f8fafc",
      brandAccent: "#22c55e",
      gameCard1: "#dff7ff",
      gameCard2: "#f3e8ff",
      gameCard3: "#ccfbf1",
      gameCard4: "#ffedd5",
      shadow: "0 18px 44px rgba(15, 23, 42, .08)"
    },
    graphite: {
      bg: "#111111",
      bg2: "#171717",
      panel: "#1c1c1c",
      panel2: "#252525",
      panel3: "#333333",
      input: "#141414",
      soft: "#202020",
      topbar: "rgba(28, 28, 28, .92)",
      tableHead: "#202020",
      activeBg: "rgba(96, 165, 250, .13)",
      successBg: "rgba(52, 211, 153, .13)",
      dangerBg: "rgba(251, 113, 133, .13)",
      warnBg: "rgba(251, 191, 36, .14)",
      line: "#3a3a3a",
      lineSoft: "rgba(229, 237, 247, .08)",
      text: "#e5edf7",
      muted: "#a3a3a3",
      muted2: "#737373",
      primary: "#60a5fa",
      primaryDark: "#3b82f6",
      purple: "#f472b6",
      green: "#34d399",
      red: "#fb7185",
      amber: "#fbbf24",
      gray: "#94a3b8",
      gold: "#fbbf24",
      brandA: "#0a0a0a",
      brandB: "#1d4ed8",
      brandInk: "#e0f2fe",
      brandAccent: "#86efac",
      gameCard1: "#172133",
      gameCard2: "#2b1b2b",
      gameCard3: "#122a22",
      gameCard4: "#2a2211",
      shadow: "0 18px 44px rgba(0, 0, 0, .35)"
    },
    rose: {
      bg: "#fbf5f8",
      bg2: "#ffffff",
      panel: "#ffffff",
      panel2: "#fce7f3",
      panel3: "#fbcfe8",
      input: "#ffffff",
      soft: "#fff7fb",
      topbar: "rgba(255, 255, 255, .92)",
      tableHead: "#fff1f2",
      activeBg: "#fdf2f8",
      successBg: "#ecfdf5",
      dangerBg: "#fff1f2",
      warnBg: "#fff7ed",
      line: "#e9cdd8",
      lineSoft: "rgba(76, 5, 25, .08)",
      text: "#172033",
      muted: "#64748b",
      muted2: "#94a3b8",
      primary: "#be123c",
      primaryDark: "#9f1239",
      purple: "#6d28d9",
      green: "#047857",
      red: "#e11d48",
      amber: "#d97706",
      gray: "#64748b",
      gold: "#b45309",
      brandA: "#4c0519",
      brandB: "#166534",
      brandInk: "#f8fafc",
      brandAccent: "#22c55e",
      gameCard1: "#ffe4e6",
      gameCard2: "#ede9fe",
      gameCard3: "#dcfce7",
      gameCard4: "#fef3c7",
      shadow: "0 18px 44px rgba(15, 23, 42, .08)"
    },
    royal: {
      bg: "#100f1f",
      bg2: "#16142a",
      panel: "#1b1833",
      panel2: "#242044",
      panel3: "#312b5f",
      input: "#121225",
      soft: "#201c3a",
      topbar: "rgba(27, 24, 51, .92)",
      tableHead: "#201c3a",
      activeBg: "rgba(129, 140, 248, .14)",
      successBg: "rgba(45, 212, 191, .13)",
      dangerBg: "rgba(251, 113, 133, .13)",
      warnBg: "rgba(251, 191, 36, .14)",
      line: "#3a3564",
      lineSoft: "rgba(226, 232, 240, .08)",
      text: "#e5edf7",
      muted: "#b3aec9",
      muted2: "#837c9f",
      primary: "#818cf8",
      primaryDark: "#6366f1",
      purple: "#e879f9",
      green: "#2dd4bf",
      red: "#fb7185",
      amber: "#fbbf24",
      gray: "#94a3b8",
      gold: "#fbbf24",
      brandA: "#0f1028",
      brandB: "#155e75",
      brandInk: "#e0f2fe",
      brandAccent: "#86efac",
      gameCard1: "#1d2750",
      gameCard2: "#371f4b",
      gameCard3: "#123833",
      gameCard4: "#342812",
      shadow: "0 18px 44px rgba(0, 0, 0, .35)"
    }
  };
  const THEME_CUSTOM_DEFAULTS = {
    ...THEME_PRESETS.white,
    bg: "#eef2f7",
    panel: "#ffffff",
    panel2: "#e8eef6",
    input: "#ffffff",
    soft: "#f8fafc",
    primary: "#15803d",
    primaryDark: "#166534",
    purple: "#6d28d9",
    gold: "#d97706",
    brandA: "#0b0f18",
    brandB: "#166534",
    brandAccent: "#22c55e",
    gameCard1: "#ecfeff",
    gameCard2: "#f5f3ff",
    gameCard3: "#ecfdf5",
    gameCard4: "#fff7ed"
  };
  const THEME_VAR_MAP = {
    bg: "--bg",
    bg2: "--bg-2",
    panel: "--panel",
    panel2: "--panel-2",
    panel3: "--panel-3",
    input: "--input",
    soft: "--soft",
    topbar: "--topbar",
    tableHead: "--table-head",
    activeBg: "--active-bg",
    successBg: "--success-bg",
    dangerBg: "--danger-bg",
    warnBg: "--warn-bg",
    line: "--line",
    lineSoft: "--line-soft",
    text: "--text",
    muted: "--muted",
    muted2: "--muted-2",
    primary: "--cyan",
    primaryDark: "--cyan-2",
    purple: "--purple",
    green: "--green",
    red: "--red",
    amber: "--amber",
    gray: "--gray",
    gold: "--gold",
    brandA: "--brand-a",
    brandB: "--brand-b",
    brandInk: "--brand-ink",
    brandAccent: "--brand-accent",
    gameCard1: "--game-card-1",
    gameCard2: "--game-card-2",
    gameCard3: "--game-card-3",
    gameCard4: "--game-card-4",
    shadow: "--shadow"
  };

  let DB = null;
  let S = null;
  let IS_ONLINE = navigator.onLine;
  let SUPABASE_READY = false;
  let syncQueue = [];
  let syncBusy = false;
  let sheetSyncBusy = false;
  let autoPullTimer = null;
  let clockTimer = null;
  let restoreFileText = "";
  let lastSavedStatus = "";
  let lastSheetStatus = "";

  const app = document.getElementById("app");
  const boot = document.getElementById("boot");
  const bootStatus = document.getElementById("bootStatus");
  const PORTAL_MODE = document.body?.dataset?.portal || "all";

  function isAgentPortal() {
    return PORTAL_MODE === "agent";
  }

  function isAdminPortal() {
    return PORTAL_MODE === "admin";
  }

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

  function minutesForTime(value) {
    const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
    if (!match) return 0;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function shiftDurationLabel(shift) {
    const start = minutesForTime(shift?.start);
    const end = minutesForTime(shift?.end);
    let mins = end - start;
    if (mins <= 0) mins += 24 * 60;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem ? `${hours}h ${rem}m` : `${hours}h`;
  }

  function timeOptions() {
    const options = [];
    for (let mins = 0; mins < 24 * 60; mins += 30) {
      const value = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
      options.push([value, value]);
    }
    return options;
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

  function isWholeNumber(value) {
    return Number.isInteger(num(value));
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

  function fmtTimer(totalSeconds) {
    const seconds = Math.max(0, Math.floor(num(totalSeconds)));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
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

  function agentRoleOptions() {
    const roles = uniqueList([...(DB?.agentRoles || []), ...(DB?.agents?.map((agent) => agent.role) || [])]);
    return (roles.length ? roles : ["agent"]).map((role) => [role, roleName(role)]);
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

  function excelCell(value) {
    return `<td>${esc(value)}</td>`;
  }

  function downloadExcelTable(filename, headings, rows) {
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>
      <table>
        <thead><tr>${headings.map((heading) => `<th>${esc(heading)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map(excelCell).join("")}</tr>`).join("")}</tbody>
      </table>
    </body></html>`;
    downloadTextFile(filename, html, "application/vnd.ms-excel;charset=utf-8");
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

  function defaultTheme() {
    return { mode: "white", custom: clone(THEME_CUSTOM_DEFAULTS) };
  }

  function normalizeTheme(theme) {
    const input = theme && typeof theme === "object" ? theme : {};
    const allowed = new Set([...Object.keys(THEME_PRESETS), "custom"]);
    const savedMode = String(input.mode || "").startsWith("saved:") ? String(input.mode) : "";
    const mode = savedMode || (allowed.has(input.mode) ? input.mode : input.mode === "light" ? "white" : "white");
    return { mode, custom: { ...THEME_CUSTOM_DEFAULTS, ...(input.custom || {}) } };
  }

  function hexToRgbParts(value, fallback) {
    let hex = String(value || "").trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return fallback || "37, 99, 235";
    hex = hex.slice(1);
    if (hex.length === 3) hex = hex.split("").map((ch) => ch + ch).join("");
    const int = parseInt(hex, 16);
    return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`;
  }

  function hexToRgba(value, alpha, fallback) {
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || "").trim())) return fallback;
    return `rgba(${hexToRgbParts(value)}, ${alpha})`;
  }

  function isDarkColor(value) {
    const parts = hexToRgbParts(value, "255, 255, 255").split(",").map((part) => Number(part.trim()));
    const luminance = (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) / 255;
    return luminance < 0.45;
  }

  function currentThemeValues() {
    const theme = normalizeTheme(DB?.theme);
    if (theme.mode.startsWith("saved:")) {
      const saved = DB?.savedThemes?.find((item) => `saved:${item.id}` === theme.mode);
      if (saved?.values) return { ...THEME_CUSTOM_DEFAULTS, ...saved.values };
    }
    if (THEME_PRESETS[theme.mode]) return { ...THEME_PRESETS[theme.mode] };
    if (theme.mode === "custom") return { ...THEME_CUSTOM_DEFAULTS, ...theme.custom };
    return { ...THEME_PRESETS.white };
  }

  function applyTheme() {
    if (!DB) return;
    DB.theme = normalizeTheme(DB.theme);
    const values = currentThemeValues();
    const root = document.documentElement;
    root.dataset.theme = DB.theme.mode;
    root.style.colorScheme = isDarkColor(values.bg) ? "dark" : "light";
    Object.entries(THEME_VAR_MAP).forEach(([key, cssVar]) => {
      if (values[key]) root.style.setProperty(cssVar, values[key]);
    });
    root.style.setProperty("--primary-rgb", hexToRgbParts(values.primary));
    root.style.setProperty("--text-rgb", hexToRgbParts(values.text, "23, 32, 51"));
    root.style.setProperty("--green-rgb", hexToRgbParts(values.green, "5, 150, 105"));
    root.style.setProperty("--red-rgb", hexToRgbParts(values.red, "225, 29, 72"));
    root.style.setProperty("--amber-rgb", hexToRgbParts(values.amber, "217, 119, 6"));
  }

  function themeOptions() {
    const presets = [
      ["white", "White"],
      ["dark", "Dark"],
      ["black", "Black"],
      ["mint", "Mint"],
      ["ocean", "Ocean"],
      ["graphite", "Graphite"],
      ["rose", "Rose"],
      ["royal", "Royal"]
    ];
    const saved = (DB?.savedThemes || []).map((theme) => [`saved:${theme.id}`, theme.name]);
    return [...presets, ...saved, ["custom", "Custom"]];
  }

  function themeQuickSelect() {
    const mode = normalizeTheme(DB?.theme).mode;
    return selectInput("theme-quick", themeOptions(), mode, "TM.setThemeMode(this.value)", `class="theme-quick" title="Theme Style"`);
  }

  function themeColorField(label, id, value) {
    return field(label, `<input id="${id}" type="color" value="${esc(value)}" oninput="TM.previewCustomTheme()">`);
  }

  function readCustomThemeInputs() {
    const existing = normalizeTheme(DB.theme).custom;
    const get = (id, fallback) => document.getElementById(id)?.value || fallback;
    const custom = {
      ...existing,
      bg: get("theme-bg", existing.bg),
      panel: get("theme-panel", existing.panel),
      panel2: get("theme-panel-2", existing.panel2),
      input: get("theme-input", existing.input),
      text: get("theme-text", existing.text),
      muted: get("theme-muted", existing.muted),
      primary: get("theme-primary", existing.primary),
      purple: get("theme-purple", existing.purple),
      green: get("theme-green", existing.green),
      red: get("theme-red", existing.red),
      gold: get("theme-gold", existing.gold),
      line: get("theme-line", existing.line),
      brandA: get("theme-brand-a", existing.brandA),
      brandB: get("theme-brand-b", existing.brandB)
    };
    custom.bg2 = custom.panel;
    custom.panel3 = get("theme-panel-3", custom.panel2);
    custom.soft = custom.panel2;
    custom.tableHead = custom.panel2;
    custom.primaryDark = custom.primary;
    custom.amber = custom.gold;
    custom.gray = custom.muted;
    custom.muted2 = custom.muted;
    custom.lineSoft = hexToRgba(custom.text, ".08", existing.lineSoft);
    custom.topbar = hexToRgba(custom.panel, ".92", existing.topbar);
    custom.activeBg = hexToRgba(custom.primary, ".10", existing.activeBg);
    custom.successBg = hexToRgba(custom.green, ".12", existing.successBg);
    custom.dangerBg = hexToRgba(custom.red, ".12", existing.dangerBg);
    custom.warnBg = hexToRgba(custom.gold, ".13", existing.warnBg);
    custom.brandInk = isDarkColor(custom.brandA) ? "#f8fafc" : "#111827";
    custom.brandAccent = custom.gold;
    custom.gameCard1 = hexToRgba(custom.primary, ".10", existing.gameCard1);
    custom.gameCard2 = hexToRgba(custom.purple, ".10", existing.gameCard2);
    custom.gameCard3 = hexToRgba(custom.green, ".10", existing.gameCard3);
    custom.gameCard4 = hexToRgba(custom.gold, ".12", existing.gameCard4);
    custom.shadow = isDarkColor(custom.bg) ? "0 18px 44px rgba(0, 0, 0, .35)" : "0 18px 44px rgba(15, 23, 42, .08)";
    return custom;
  }

  function setThemeMode(mode) {
    DB.theme = normalizeTheme(DB.theme);
    const validModes = themeOptions().map((item) => item[0]);
    DB.theme.mode = validModes.includes(mode) ? mode : "white";
    saveDB();
    applyTheme();
    pushConfig();
    render();
  }

  function previewCustomTheme() {
    DB.theme = normalizeTheme(DB.theme);
    DB.theme.mode = "custom";
    DB.theme.custom = readCustomThemeInputs();
    applyTheme();
    const select = document.getElementById("theme-mode");
    if (select) select.value = "custom";
  }

  function saveTheme() {
    DB.theme = normalizeTheme(DB.theme);
    const mode = document.getElementById("theme-mode")?.value || DB.theme.mode;
    const validModes = themeOptions().map((item) => item[0]);
    DB.theme.mode = validModes.includes(mode) ? mode : "white";
    if (DB.theme.mode === "custom") {
      DB.theme.custom = readCustomThemeInputs();
      const name = document.getElementById("theme-name")?.value.trim();
      if (name) {
        DB.savedThemes = Array.isArray(DB.savedThemes) ? DB.savedThemes : [];
        const existing = DB.savedThemes.find((item) => item.name.toLowerCase() === name.toLowerCase());
        if (existing) existing.values = clone(DB.theme.custom);
        else DB.savedThemes.push({ id: uid("theme"), name, values: clone(DB.theme.custom) });
        const saved = DB.savedThemes.find((item) => item.name.toLowerCase() === name.toLowerCase());
        if (saved) DB.theme.mode = `saved:${saved.id}`;
      }
    }
    saveDB();
    applyTheme();
    pushConfig();
    const msg = document.getElementById("theme-save-msg");
    if (msg) {
      msg.textContent = "Theme saved.";
      setTimeout(() => { const node = document.getElementById("theme-save-msg"); if (node) node.textContent = ""; }, 2000);
    }
  }

  function resetCustomTheme() {
    DB.theme = { mode: "custom", custom: clone(THEME_CUSTOM_DEFAULTS) };
    saveDB();
    applyTheme();
    pushConfig();
    render();
  }

  function createDefaultDB() {
    const payMethods = [
      { id: IDS.cashApp, name: "Cash App", tags: [{ id: "tag-cash-main", tag: "$PandaSquad" }, { id: "tag-cash-backup", tag: "$PandaPay" }] },
      { id: IDS.zelle, name: "Zelle", tags: [{ id: "tag-zelle-main", tag: "payments@pandasquad.com" }] },
      { id: IDS.venmo, name: "Venmo", tags: [{ id: "tag-venmo-main", tag: "@PandaSquad" }] }
    ];
    return {
      shifts: [
        { id: IDS.shiftNight, name: "Night", start: "00:00", end: "08:00" },
        { id: IDS.shiftMorning, name: "Morning", start: "08:00", end: "16:00" },
        { id: IDS.shiftEvening, name: "Evening", start: "16:00", end: "00:00" }
      ],
      agents: [
        { id: IDS.agentAli, name: "Ali Hassan", role: "agent", shiftId: IDS.shiftMorning, color: "#24d8ff", attendanceRequired: true, showInDeposits: true, targets: { newPlayers: 0, deposit: 0 } },
        { id: IDS.agentSara, name: "Sara Ahmed", role: "agent", shiftId: IDS.shiftEvening, color: "#a673ff", attendanceRequired: true, showInDeposits: true, targets: { newPlayers: 0, deposit: 0 } },
        { id: IDS.agentUsman, name: "Usman Malik", role: "agent", shiftId: IDS.shiftNight, color: "#32d583", attendanceRequired: true, showInDeposits: true, targets: { newPlayers: 0, deposit: 0 } }
      ],
      agentRoles: ["agent", "manager", "supervisor"],
      staff: [],
      payMethods,
      pageNames: [{ id: "page-main", name: "Panda Squad Main", link: "", accessTo: "" }],
      games: [
        { id: IDS.gameFish, name: "Fish Table", backendLoaded: 5000, pricePer1k: 0, backendLink: "", playerLink: "", username: "", password: "", gameVendorId: "", reloadHistory: [] },
        { id: IDS.gameJuwa, name: "Juwa", backendLoaded: 8000, pricePer1k: 0, backendLink: "", playerLink: "", username: "", password: "", gameVendorId: IDS.gameVendorJuwa, reloadHistory: [] },
        { id: IDS.gameOrion, name: "Orion Stars", backendLoaded: 6000, pricePer1k: 0, backendLink: "", playerLink: "", username: "", password: "", gameVendorId: IDS.gameVendorOrion, reloadHistory: [] }
      ],
      payVendors: [
        {
          id: IDS.vendorFastPay,
          name: "FastPay Co",
          contactPerson: "",
          phone: "",
          email: "",
          hasWhatsappGroup: false,
          groupName: "",
          notes: "",
          fees: [
            { id: "fee-cash-app", payMethodId: IDS.cashApp, fee: 20, payTag: "$PandaSquad" },
            { id: "fee-zelle", payMethodId: IDS.zelle, fee: 30, payTag: "payments@pandasquad.com" }
          ]
        }
      ],
      gameVendors: [
        { id: IDS.gameVendorJuwa, name: "Juwa Vendor", contactPerson: "", phone: "", email: "", hasWhatsappGroup: false, groupName: "", notes: "" },
        { id: IDS.gameVendorOrion, name: "Orion Vendor", contactPerson: "", phone: "", email: "", hasWhatsappGroup: false, groupName: "", notes: "" }
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
      auditLogs: [],
      attendance: [],
      leaveRequests: [],
      scheduledOff: [],
      attendanceSettings: {
        leaveReasons: ["Sick Leave", "Urgent Work", "Personal Leave"],
        offReasons: ["Uninformed", "Sick Leave", "Custom"],
        lateGraceMinutes: 15
      },
      salesTargets: { monthlySales: 0, monthlyNewPlayers: 0 },
      savedThemes: [],
      theme: defaultTheme(),
      shiftStart: new Date().toISOString(),
      shiftOpen: true,
      activeShiftName: shiftNameForNow([
        { name: "Night", start: "00:00", end: "08:00" },
        { name: "Morning", start: "08:00", end: "16:00" },
        { name: "Evening", start: "16:00", end: "00:00" }
      ]),
      supabase: { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, enabled: true },
      googleSheets: {
        enabled: false,
        webAppUrl: "",
        token: "",
        pending: []
      },
      overrideCode: "1234"
    };
  }

  function normalizeDB(input) {
    const base = createDefaultDB();
    const db = { ...base, ...(input && typeof input === "object" ? input : {}) };
    [
      "shifts", "agents", "staff", "payMethods", "pageNames", "games", "payVendors",
      "gameVendors", "expCats", "expenses", "entries", "closedShifts", "attendance",
      "leaveRequests", "scheduledOff", "agentRoles", "savedThemes", "auditLogs"
    ].forEach((key) => {
      if (!Array.isArray(db[key])) db[key] = clone(base[key]);
    });
    db.agentRoles = uniqueList(db.agentRoles.map((role) => String(role || "").trim().toLowerCase()).filter(Boolean));
    if (!db.agentRoles.length) db.agentRoles = clone(base.agentRoles);
    const legacyDefaultShifts = db.shifts.length === 3
      && db.shifts.some((shift) => shift.id === "shift-afternoon" && shift.name === "Afternoon" && shift.start === "14:00" && shift.end === "22:00")
      && db.shifts.some((shift) => shift.name === "Morning" && shift.start === "06:00" && shift.end === "14:00")
      && db.shifts.some((shift) => shift.name === "Night" && shift.start === "22:00" && shift.end === "06:00");
    if (legacyDefaultShifts) {
      db.shifts = clone(base.shifts);
      db.activeShiftName = shiftNameForNow(db.shifts);
      db.agents = db.agents.map((agent) => ({
        ...agent,
        shiftId: agent.shiftId === "shift-afternoon" ? IDS.shiftEvening : agent.shiftId,
        shiftHistory: (agent.shiftHistory || []).map((item) => ({ ...item, shiftId: item.shiftId === "shift-afternoon" ? IDS.shiftEvening : item.shiftId }))
      }));
      db.staff = db.staff.map((staff) => ({
        ...staff,
        shiftId: staff.shiftId === "shift-afternoon" ? IDS.shiftEvening : staff.shiftId,
        shiftHistory: (staff.shiftHistory || []).map((item) => ({ ...item, shiftId: item.shiftId === "shift-afternoon" ? IDS.shiftEvening : item.shiftId }))
      }));
    }
    db.savedThemes = db.savedThemes.map((theme) => ({ id: theme.id || uid("theme"), name: String(theme.name || "Custom Theme").trim(), values: { ...THEME_CUSTOM_DEFAULTS, ...(theme.values || {}) } }));
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
      breakAllowedMins: 30,
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
        breakAllowedMins: 30,
        targets: { newPlayers: 0, deposit: 0 },
        perms: staffPermsForRole(role, adminAccess),
        ...staff,
        adminAccess,
        perms: staff.perms ? cleanPerms(staff.perms) : staffPermsForRole(role, adminAccess),
        targets: { newPlayers: 0, deposit: 0, ...(staff.targets || {}) }
      };
    });
    db.games = db.games.map((game) => ({ reloadHistory: [], pricePer1k: 0, backendLoaded: 0, ...game }));
    db.pageNames = db.pageNames.map((page) => typeof page === "string" ? { id: uid("page"), name: page, link: "", accessTo: "" } : { link: "", accessTo: "", ...page });
    db.payMethods = db.payMethods.map((method) => ({ tags: [], ...method, tags: (method.tags || []).map((tag) => ({ active: true, archivedAt: "", ...tag })) }));
    db.payVendors = db.payVendors.map((vendor) => ({
      fees: [],
      contactPerson: "",
      phone: "",
      email: "",
      hasWhatsappGroup: false,
      groupName: "",
      notes: "",
      archived: false,
      archivedAt: "",
      paid: 0,
      payments: [],
      deductions: [],
      ...vendor,
      payments: Array.isArray(vendor.payments) ? vendor.payments : [],
      deductions: Array.isArray(vendor.deductions) ? vendor.deductions : []
    }));
    db.gameVendors = db.gameVendors.map((vendor) => ({ contactPerson: "", phone: "", email: "", hasWhatsappGroup: false, groupName: "", notes: "", ...vendor }));
    db.supabase = { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, enabled: true, ...(db.supabase || {}) };
    db.googleSheets = {
      enabled: false,
      webAppUrl: "",
      token: "",
      pending: [],
      ...(db.googleSheets || {})
    };
    if (!Array.isArray(db.googleSheets.pending)) db.googleSheets.pending = [];
    if (String(db.googleSheets.webAppUrl || "").includes("script.google.com/macros/s/") && String(db.googleSheets.token || "").startsWith("PS-GOOGLE-BACKUP-")) {
      db.googleSheets.enabled = false;
      db.googleSheets.webAppUrl = "";
      db.googleSheets.token = "";
      db.googleSheets.pending = [];
    }
    db.attendanceSettings = {
      leaveReasons: ["Sick Leave", "Urgent Work", "Personal Leave"],
      offReasons: ["Uninformed", "Sick Leave", "Custom"],
      lateGraceMinutes: 15,
      ...(db.attendanceSettings || {})
    };
    db.salesTargets = { monthlySales: 0, monthlyNewPlayers: 0, ...(db.salesTargets || {}) };
    db.auditLogs = db.auditLogs.map((log) => ({ id: log.id || uid("audit"), at: log.at || new Date().toISOString(), actor: log.actor || "", action: log.action || "", target: log.target || "", note: log.note || "", before: log.before || null, after: log.after || null }));
    if (db.salesTargets.monthlySales === 0 && db.salesTargets.monthlyDeposit) db.salesTargets.monthlySales = num(db.salesTargets.monthlyDeposit);
    db.theme = normalizeTheme(db.theme);
    if (!db.shiftStart) db.shiftStart = new Date().toISOString();
    if (typeof db.shiftOpen !== "boolean") db.shiftOpen = true;
    if (!db.activeShiftName) db.activeShiftName = shiftNameForNow(db.shifts);
    if (!db.overrideCode) db.overrideCode = "1234";
    return db;
  }

  function loadDB() {
    return createDefaultDB();
  }

  function saveDB() {
    // Supabase is the source of truth. Do not persist CRM data in browser storage.
  }

  function saveAdminSession() {
    try {
      if (S?.adminAuthed && S.adminUserId) localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ userId: S.adminUserId }));
      else localStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      // Admin session persistence is optional.
    }
  }

  function restoreAdminSession() {
    try {
      const saved = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || "{}");
      if (saved.userId && DB.staff.some((staff) => staff.id === saved.userId && staff.adminAccess)) {
        S.adminAuthed = true;
        S.adminUserId = saved.userId;
      }
    } catch {
      // Ignore broken browser session data.
    }
  }

  function clearBrowserDB() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Browser storage may be unavailable; the CRM no longer relies on it.
    }
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
      playerLookupCode: "",
      selectedPayVendorId: "",
      selectedGameVendorId: "",
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
      referral: newReferralForm(),
      _pendingEntry: null
    };
  }

  function newPF() {
    return {
      date: todayISO(),
      shift: activeShiftName(),
      agent: "",
      playerCode: "",
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
      email: "",
      referralForCode: "",
      referredByCode: "",
      referralNote: ""
    };
  }

  function newFF() {
    return {
      date: todayISO(),
      shift: activeShiftName(),
      agent: "",
      playerCode: "",
      playerName: "",
      playerUrl: "",
      fpAmount: "",
      gameName: "",
      gameId: "",
      depositOnPage: true,
      pageName: "",
      huntingProfile: "",
      salesName: "",
      legalName: "",
      contact: "",
      email: "",
      referralForCode: "",
      referredByCode: "",
      referralNote: ""
    };
  }

  function newRF() {
    return {
      date: todayISO(),
      shift: activeShiftName(),
      agent: "",
      playerCode: "",
      gameId: "",
      gameName: "",
      rdCredits: "",
      cashoutPaid: ""
    };
  }

  function newReferralForm() {
    return {
      date: todayISO(),
      shift: activeShiftName(),
      agent: "",
      referrerType: "customer",
      referredByCode: "",
      referredPlayerCode: "",
      referrerName: "",
      referrerUrl: "",
      referrerContact: "",
      gameId: "",
      gameName: "",
      coins: "",
      note: ""
    };
  }

  function shiftNameForNow(shifts) {
    const list = Array.isArray(shifts) && shifts.length ? shifts : [
      { name: "Night", start: "00:00", end: "08:00" },
      { name: "Morning", start: "08:00", end: "16:00" },
      { name: "Evening", start: "16:00", end: "00:00" }
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

  function shiftContainsNow(name) {
    const shift = DB?.shifts?.find((item) => item.name === name);
    if (!shift) return name === getCurrentShiftName();
    const current = new Date().getHours() * 60 + new Date().getMinutes();
    const start = minutesForTime(shift.start);
    const end = minutesForTime(shift.end);
    return start <= end ? current >= start && current < end : current >= start || current < end;
  }

  function nextShiftNameAfter(name) {
    const shifts = Array.isArray(DB?.shifts) && DB.shifts.length ? DB.shifts : [];
    if (!shifts.length) return getCurrentShiftName();
    const index = shifts.findIndex((shift) => shift.name === name);
    if (index < 0) return getCurrentShiftName();
    return shifts[(index + 1) % shifts.length]?.name || getCurrentShiftName();
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
        people.push({ id: agent.id, name: agent.name, role: agent.role || "agent", shiftId: agent.shiftId, shiftHistory: agent.shiftHistory || [], color: agent.color || "#24d8ff", attendanceRequired: agent.attendanceRequired !== false, showInDeposits: agent.showInDeposits !== false, targets: agent.targets || { newPlayers: 0, deposit: 0 }, source: "agent" });
      }
    });
    DB.staff.forEach((staff) => {
      const key = staff.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        people.push({ id: staff.id, name: staff.name, role: staff.role || "staff", shiftId: staff.shiftId || "", shiftHistory: staff.shiftHistory || [], color: staff.color || "#8796a3", attendanceRequired: !!staff.attendanceRequired, showInDeposits: !!staff.showInDeposits, targets: staff.targets || { newPlayers: 0, deposit: 0 }, source: "staff" });
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

  function shiftForPersonOnDate(person, date) {
    if (!person) return DB.shifts[0];
    const history = (person.shiftHistory || [])
      .filter((item) => item.date && item.shiftId && item.date <= date)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return shiftById(history[0]?.shiftId || person.shiftId) || DB.shifts[0];
  }

  function addDaysISO(date, days) {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function attendanceDateForPerson(person, value = new Date()) {
    const d = value instanceof Date ? value : new Date(value);
    const todayKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const prevKey = addDaysISO(todayKey, -1);
    const prevShift = shiftForPersonOnDate(person, prevKey);
    if (prevShift) {
      const [sh, sm] = prevShift.start.split(":").map(Number);
      const [eh, em] = prevShift.end.split(":").map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      const current = d.getHours() * 60 + d.getMinutes();
      if (start > end && current < end) return prevKey;
    }
    return todayKey;
  }

  function shiftEffectivePrompt(name) {
    const value = prompt(`When should this shift change take effect for ${name}?\n\nUse YYYY-MM-DD. Leave as today for immediate effect.`, todayISO());
    if (value === null) return null;
    return parseDateInput(value || todayISO());
  }

  function getAttendance(personId, date) {
    return DB.attendance.find((record) => record.agentId === personId && record.date === date);
  }

  function ensureAttendance(personId, date) {
    const person = personById(personId);
    let record = getAttendance(personId, date);
    if (!record) {
      const shift = shiftForPersonOnDate(person, date);
      record = {
        id: uid("attendance"),
        agentId: personId,
        agentName: person?.name || "",
        date,
        shiftId: shift?.id || "",
        shiftName: shift?.name || "",
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
    const d = new Date(dateTimeValue);
    const dateKey = attendanceDateForPerson(person, d);
    const shift = shiftForPersonOnDate(person, dateKey);
    if (!shift) return false;
    const [h, m] = shift.start.split(":").map(Number);
    const start = new Date(`${dateKey}T00:00:00`);
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
    const referral = entries.filter((entry) => entry.type === "referral").reduce((sum, entry) => sum + num(entry.fpAmount), 0);
    const redeem = entries.filter((entry) => entry.type === "redeem").reduce((sum, entry) => sum + num(entry.rdCredits), 0);
    const used = paid + freeplay + referral;
    return { paid, freeplay, referral, used, redeem, current: num(game.backendLoaded) - used + redeem };
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

  function normalizePlayerCode(value) {
    const raw = String(value || "").trim().toUpperCase();
    if (!raw) return "";
    const digits = raw.match(/\d+/)?.[0];
    if (digits && (/^\d+$/.test(raw) || /^P?S?-?\d+$/i.test(raw))) return `PS-${String(Number(digits)).padStart(6, "0")}`;
    return raw;
  }

  function nextPlayerCode() {
    const existing = new Set(allEntries().map((entry) => normalizePlayerCode(entry.playerCode)).filter(Boolean));
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    do {
      code = `PS-${Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`;
    } while (existing.has(code));
    return code;
  }

  function playerIdentity(entry) {
    const values = [entry.playerCode, entry.gameId, entry.playerUrl, entry.contact, entry.email, entry.legalName, entry.playerName];
    return values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  }

  function relatedPlayerEntries(seed) {
    const keys = new Set(playerIdentity(seed));
    if (!keys.size) return [];
    return allEntries().filter((entry) => playerIdentity(entry).some((key) => keys.has(key)));
  }

  function lastEntryForPlayerCode(code) {
    const normalized = normalizePlayerCode(code);
    if (!normalized) return null;
    return allEntries()
      .filter((entry) => normalizePlayerCode(entry.playerCode) === normalized)
      .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)))[0] || null;
  }

  function ensurePlayerCode(entry) {
    entry.playerCode = normalizePlayerCode(entry.playerCode);
    if (entry.playerCode) return entry.playerCode;
    if (entry.type === "referral") return "";
    const existing = relatedPlayerEntries(entry).find((item) => item.playerCode);
    entry.playerCode = existing?.playerCode || nextPlayerCode();
    return entry.playerCode;
  }

  function assignMissingPlayerCodes(db) {
    const entries = [
      ...(db.entries || []),
      ...(db.closedShifts || []).flatMap((shift) => shift.entries || [])
    ];
    const usedCodes = new Set(entries.map((entry) => normalizePlayerCode(entry.playerCode)).filter(Boolean));
    const randomCode = () => {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      do {
        code = `PS-${Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`;
      } while (usedCodes.has(code));
      usedCodes.add(code);
      return code;
    };
    const codeByKey = new Map();
    let changed = false;

    entries.forEach((entry) => {
      const code = normalizePlayerCode(entry.playerCode);
      if (!code) return;
      entry.playerCode = code;
      playerIdentity(entry).forEach((key) => codeByKey.set(key, code));
    });

    entries.forEach((entry) => {
      let code = normalizePlayerCode(entry.playerCode);
      if (!code) {
        code = playerIdentity(entry).map((key) => codeByKey.get(key)).find(Boolean) || randomCode();
        entry.playerCode = code;
        changed = true;
      }
      playerIdentity(entry).forEach((key) => codeByKey.set(key, code));
    });

    return changed;
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
      return parsed && typeof parsed === "object" ? { __meta: true, ...parsed } : { __meta: false, custTag: value || "" };
    } catch {
      return { __meta: false, custTag: value || "" };
    }
  }

  function cleanLegacyText(value) {
    const text = String(value || "").trim();
    if (!text || /^[\[{]/.test(text)) return "";
    return text;
  }

  function cleanLoadedEmail(value) {
    const text = cleanLegacyText(value);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : "";
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
      playerCode: normalizePlayerCode(entry.playerCode),
      promoP: num(entry.promoP),
      referralForCode: normalizePlayerCode(entry.referralForCode),
      referredByCode: normalizePlayerCode(entry.referredByCode),
      referralNote: entry.referralNote || "",
      referralBonusType: entry.referralBonusType || "",
      referralBonusAmount: num(entry.referralBonusAmount),
      referralBonusPercent: num(entry.referralBonusPercent)
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
      custTag: meta.__meta ? cleanLegacyText(meta.custTag) : cleanLegacyText(meta.custTag || row.cust_tag),
      payMethodId: row.pay_method_id || "",
      payTagId: meta.payTagId || "",
      payTagLabel: meta.payTagLabel || "",
      depositOnPage: !!meta.depositOnPage,
      pageName: meta.pageName || "",
      huntingProfile: meta.huntingProfile || "",
      salesName: meta.salesName || "",
      dispute: !!meta.dispute,
      disputeNote: meta.disputeNote || "",
      playerCode: normalizePlayerCode(meta.playerCode),
      referralForCode: normalizePlayerCode(meta.referralForCode),
      referredByCode: normalizePlayerCode(meta.referredByCode),
      referralNote: meta.referralNote || "",
      referralBonusType: meta.referralBonusType || "",
      referralBonusAmount: num(meta.referralBonusAmount),
      referralBonusPercent: num(meta.referralBonusPercent),
      legalName: cleanLegacyText(row.legal_name),
      contact: cleanLegacyText(row.contact),
      email: cleanLoadedEmail(row.email),
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
      shiftId: record.shiftId || "",
      shiftName: record.shiftName || "",
      breakMins: num(record.breakMins),
      breakStartAt: record.breakStartAt || "",
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
      shiftId: meta.shiftId || "",
      shiftName: meta.shiftName || "",
      breakMins: num(meta.breakMins),
      breakStartAt: meta.breakStartAt || "",
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
    SUPABASE_READY = true;
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  function sheetEnabled() {
    return !!(DB?.googleSheets?.enabled && DB.googleSheets.webAppUrl && DB.googleSheets.token && IS_ONLINE);
  }

  function queueSheetBatch(sheet, headers, rows, reason) {
    if (!DB.googleSheets) return;
    const cleanRows = (rows || []).filter((row) => Array.isArray(row));
    if (!cleanRows.length) return;
    DB.googleSheets.pending = Array.isArray(DB.googleSheets.pending) ? DB.googleSheets.pending : [];
    DB.googleSheets.pending.push({
      id: uid("sheet"),
      at: new Date().toISOString(),
      sheet,
      headers,
      rows: cleanRows,
      reason: reason || ""
    });
    DB.googleSheets.pending = DB.googleSheets.pending.slice(-500);
    saveDB();
    void flushSheetBackup();
  }

  async function flushSheetBackup() {
    if (sheetSyncBusy || !sheetEnabled() || !DB.googleSheets.pending?.length) return false;
    sheetSyncBusy = true;
    const batch = DB.googleSheets.pending[0];
    lastSheetStatus = `Sending ${batch.sheet} backup to Google Sheets...`;
    try {
      await fetch(DB.googleSheets.webAppUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          token: DB.googleSheets.token,
          source: "Panda Squad CRM",
          sentAt: new Date().toISOString(),
          batches: [batch]
        })
      });
      DB.googleSheets.pending.shift();
      lastSheetStatus = `Google Sheets backup request sent at ${new Date().toLocaleTimeString()}. Check the Sheet tabs.`;
      saveDB();
      pushConfig();
    } catch {
      lastSheetStatus = "Google Sheets backup is queued. Check internet or Apps Script settings.";
    }
    sheetSyncBusy = false;
    render();
    if (DB.googleSheets.pending?.length) void flushSheetBackup();
    return !DB.googleSheets.pending?.length;
  }

  function gameBalanceColumns() {
    return ["Snapshot At", "Reason", "Related ID", "Shift", "Game ID", "Game Name", "Backend Loaded", "Paid Issued", "Freeplay Issued", "Referral Issued", "Redeem Returned", "Expected Balance"];
  }

  function gameBalanceRow(game, reason, relatedId) {
    const usage = gameUsage(game);
    return [
      new Date().toISOString(),
      reason || "",
      relatedId || "",
      DB.activeShiftName || getCurrentShiftName(),
      game.id,
      game.name,
      num(game.backendLoaded),
      usage.paid,
      usage.freeplay,
      usage.referral,
      usage.redeem,
      usage.current
    ];
  }

  function queueGameBalanceBackup(reason, relatedId, gameId) {
    const games = gameId ? DB.games.filter((game) => game.id === gameId || game.name === gameId) : DB.games;
    queueSheetBatch("GameBalances", gameBalanceColumns(), games.map((game) => gameBalanceRow(game, reason, relatedId)), reason);
  }

  function attendanceSheetColumns() {
    return ["Updated At", "Record ID", "Employee ID", "Employee Name", "Date", "Shift", "Status", "Check In", "Check Out", "Break Minutes", "Duration Minutes", "Reason"];
  }

  function attendanceSheetRow(record, reason) {
    return [
      new Date().toISOString(),
      record.id,
      record.agentId,
      record.agentName,
      isoToLabel(record.date),
      record.shiftName || "",
      record.status || "present",
      record.checkInAt || record.checkIn || "",
      record.checkOutAt || record.checkOut || "",
      num(record.breakMins),
      num(record.duration),
      reason || record.leaveReason || record.offReason || ""
    ];
  }

  function closedShiftColumns() {
    return ["Closed At", "Closed ID", "Date", "Shift", "Close Type", "Close Reason", "Forced", "Paid Count", "Freeplay Count", "Redeem Count", "Sales Amount", "Coins Issued", "Cashout Paid", "New Players"];
  }

  function closedShiftRow(shift) {
    const summary = shift.summary || {};
    return [
      shift.closedAt || shift.createdAt || "",
      shift.id,
      isoToLabel(shift.date),
      summary.shiftName || "",
      summary.closeType || "",
      summary.closeReason || "",
      summary.forced ? "Yes" : "No",
      num(summary.paidCount),
      num(summary.fpCount),
      num(summary.rdCount),
      num(summary.totalDeposit),
      num(summary.totalR) + num(summary.totalFP),
      num(summary.totalCashout),
      num(summary.newPlayers)
    ];
  }

  function vendorLedgerColumns() {
    return ["Created At", "Vendor ID", "Vendor Name", "Entry Type", "Amount", "Reference", "Note"];
  }

  function vendorLedgerRow(vendor, type, item) {
    return [
      item?.at || new Date().toISOString(),
      vendor?.id || "",
      vendor?.name || "",
      type,
      num(item?.amount),
      item?.reference || "",
      item?.note || ""
    ];
  }

  function expenseSheetColumns() {
    return ["Created At", "Expense ID", "Date", "Category", "Description", "Amount"];
  }

  function expenseSheetRow(expense) {
    return [new Date().toISOString(), expense.id, isoToLabel(expense.date), expense.category, expense.description, num(expense.amount)];
  }

  function auditSheetColumns() {
    return ["Time", "Audit ID", "User", "Action", "Target", "Note"];
  }

  function auditSheetRow(log) {
    return [log.at, log.id, log.actor, log.action, log.target, log.note || ""];
  }

  function backupEntryToSheets(entry, reason) {
    queueSheetBatch("Transactions", transactionExportColumns(), [transactionExportRow(entry)], reason || "Transaction");
    if (entry.gameId || entry.gameName) queueGameBalanceBackup(reason || "Transaction", entry.id, entry.gameId || entry.gameName);
  }

  function saveGoogleSheets(enabled) {
    if (!requirePerm("Manage Settings")) return;
    const before = clone(DB.googleSheets || {});
    DB.googleSheets = {
      ...(DB.googleSheets || {}),
      enabled,
      webAppUrl: document.getElementById("gs-url")?.value.trim() || "",
      token: document.getElementById("gs-token")?.value.trim() || "",
      pending: Array.isArray(DB.googleSheets?.pending) ? DB.googleSheets.pending : []
    };
    audit("Save Google Sheets Backup Settings", "Google Sheets", before, DB.googleSheets);
    saveDB();
    pushConfig();
    lastSheetStatus = enabled ? "Google Sheets backup settings saved." : "Google Sheets backup disabled.";
    render();
    if (enabled) void flushSheetBackup();
  }

  function testGoogleSheets() {
    if (!requirePerm("Manage Settings")) return;
    DB.googleSheets = {
      ...(DB.googleSheets || {}),
      enabled: true,
      webAppUrl: document.getElementById("gs-url")?.value.trim() || DB.googleSheets?.webAppUrl || "",
      token: document.getElementById("gs-token")?.value.trim() || DB.googleSheets?.token || "",
      pending: Array.isArray(DB.googleSheets?.pending) ? DB.googleSheets.pending : []
    };
    queueSheetBatch("BackupStatus", ["Sent At", "Source", "Status", "Pending Before Send"], [[new Date().toISOString(), "Panda Squad CRM", "Test backup row", DB.googleSheets.pending.length]], "Test");
    lastSheetStatus = "Google Sheets test row queued.";
    render();
  }

  function syncCurrentToGoogleSheets() {
    if (!requirePerm("Export / Backup")) return;
    if (!DB.googleSheets?.enabled) return alert("Enable Google Sheets backup first.");
    if (!confirm("Append the current CRM data to Google Sheets now?\n\nThis is append-only, so existing sheet rows will not be edited or removed.")) return;
    const entries = allEntries();
    if (entries.length) queueSheetBatch("Transactions", transactionExportColumns(), entries.map(transactionExportRow), "Manual full sync");
    queueGameBalanceBackup("Manual full sync", "all");
    if (DB.closedShifts.length) queueSheetBatch("ClosedShifts", closedShiftColumns(), DB.closedShifts.map(closedShiftRow), "Manual full sync");
    if (DB.attendance.length) queueSheetBatch("Attendance", attendanceSheetColumns(), DB.attendance.map((record) => attendanceSheetRow(record, "Manual full sync")), "Manual full sync");
    const ledgerRows = [];
    DB.payVendors.forEach((vendor) => {
      (vendor.payments || []).forEach((payment) => ledgerRows.push(vendorLedgerRow(vendor, "Payment", payment)));
      (vendor.deductions || []).forEach((deduction) => ledgerRows.push(vendorLedgerRow(vendor, "Deduction", deduction)));
    });
    if (ledgerRows.length) queueSheetBatch("VendorLedger", vendorLedgerColumns(), ledgerRows, "Manual full sync");
    if (DB.expenses.length) queueSheetBatch("Expenses", expenseSheetColumns(), DB.expenses.map(expenseSheetRow), "Manual full sync");
    if (DB.auditLogs.length) queueSheetBatch("AuditLog", auditSheetColumns(), DB.auditLogs.map(auditSheetRow), "Manual full sync");
    lastSheetStatus = "Current CRM data queued for Google Sheets.";
    render();
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
    backupEntryToSheets(entry, "Transaction");
  }

  function syncAttendance(record) {
    queueSync(attendanceToRow(record), "attendance");
    queueSheetBatch("Attendance", attendanceSheetColumns(), [attendanceSheetRow(record, "Attendance update")], "Attendance update");
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
        SUPABASE_READY = false;
        lastSavedStatus = "Supabase sync failed. Changes are blocked until the connection is fixed.";
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

  async function deleteRowsNotIn(table, ids) {
    if (!ids.length) return deleteAllRows(table);
    const list = ids.map((id) => encodeURIComponent(String(id))).join(",");
    await sbRequest(table, { method: "DELETE" }, `?id=not.in.(${list})`);
  }

  async function sbPush() {
    if (!DB.supabase.enabled || !IS_ONLINE) return false;
    try {
      await upsertRows("crm_config", [{ id: CONFIG_ID, payload: JSON.stringify(configPayload()), updated_at: new Date().toISOString() }]);
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
      await deleteRowsNotIn("entries", DB.entries.map((entry) => entry.id));
      await deleteRowsNotIn("closed_shifts", DB.closedShifts.map((shift) => shift.id));
      await deleteRowsNotIn("attendance", DB.attendance.map((record) => record.id));
      lastSavedStatus = `Synced at ${new Date().toLocaleTimeString()}`;
      SUPABASE_READY = true;
      return true;
    } catch {
      SUPABASE_READY = false;
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
      const hasConfig = !!(configRows && configRows.length);
      const hasRemoteRows = [entryRows, closedRows, attendanceRows].some((rows) => Array.isArray(rows) && rows.length);
      if (!hasConfig && !hasRemoteRows) return false;
      const config = hasConfig ? JSON.parse(configRows[0].payload || "{}") : {};
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
      const assignedCodes = assignMissingPlayerCodes(next);
      DB = next;
      saveDB();
      if (assignedCodes) await sbPush();
      if (!silent) lastSavedStatus = `Pulled at ${new Date().toLocaleTimeString()}`;
      SUPABASE_READY = true;
      return true;
    } catch {
      SUPABASE_READY = false;
      return false;
    }
  }

  function checkOnline() {
    if (!IS_ONLINE) {
      alert("No internet connection. All changes are blocked until you reconnect.");
      return false;
    }
    if (!SUPABASE_READY) {
      alert("Supabase is not connected. Changes are blocked so data is not stored only in this browser.");
      return false;
    }
    return true;
  }

  function confirmDelete(message) {
    return confirm(`${message}\n\nThis cannot be undone. Click OK to confirm.`);
  }

  function actorName() {
    return currentAdminUser()?.name || S?.pf?.agent || S?.ff?.agent || S?.rf?.agent || "System";
  }

  function audit(action, target, before, after, note) {
    if (!DB?.auditLogs) DB.auditLogs = [];
    const log = {
      id: uid("audit"),
      at: new Date().toISOString(),
      actor: actorName(),
      action,
      target,
      note: note || "",
      before: before ? clone(before) : null,
      after: after ? clone(after) : null
    };
    DB.auditLogs.unshift(log);
    DB.auditLogs = DB.auditLogs.slice(0, 1000);
    queueSheetBatch("AuditLog", auditSheetColumns(), [auditSheetRow(log)], "Audit");
    pushConfig();
  }

  function hasPerm(perm) {
    if (!perm) return true;
    const user = currentAdminUser();
    if (S?.page === "admin" && S?.adminAuthed && !user) return false;
    if (!user) return true;
    if (["owner", "admin"].includes(user.role)) return true;
    return !!user.adminAccess && (user.perms || []).includes(perm);
  }

  function requirePerm(perm) {
    if (hasPerm(perm)) return true;
    alert("You do not have permission for this action.");
    return false;
  }

  function canAdminSection(section) {
    if (section === "shifts" || section === "agents") section = "team";
    if (section === "staff" && !canManageStaffAccess()) return false;
    if (S?.page === "admin" && S?.adminAuthed && !currentAdminUser()) return false;
    return hasPerm(ADMIN_SECTION_PERMS[section]);
  }

  function updateOnlineStatus() {
    IS_ONLINE = navigator.onLine;
    if (IS_ONLINE) {
      void flushSync();
      void flushSheetBackup();
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
    applyTheme();
    const scrollTop = document.querySelector(".content-scroll")?.scrollTop || 0;
    const adminScrollTop = document.querySelector(".admin-main")?.scrollTop || 0;
    app.innerHTML = `
      ${renderTopbar()}
      ${IS_ONLINE ? "" : `<div class="offline-banner">No internet connection - all changes are blocked until you reconnect</div>`}
      <main class="layout">${S.page === "admin" ? (S.adminAuthed && currentAdminUser() ? renderAdminApp() : renderAdminLocked()) : S.page === "closed" ? renderClosedScreen() : renderShiftApp()}</main>
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
          <div class="brand-mark"><span class="brand-icon">PS</span><span>PANDA</span><strong>SQUAD</strong></div>
        </div>
        <nav class="nav">
          ${isAdminPortal() ? "" : `<button class="btn btn-ghost ${S.page === "shift" ? "active" : ""}" onclick="TM.setPage('shift')">Agent Panel</button>`}
          ${isAgentPortal() ? "" : `<button class="btn btn-ghost ${S.page === "admin" ? "active" : ""}" onclick="TM.openAdminGate()">Admin Dashboard</button>`}
        </nav>
        <div class="top-right">
          ${themeQuickSelect()}
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
    document.querySelectorAll("[data-break-start]").forEach((node) => {
      const start = node.getAttribute("data-break-start");
      const base = num(node.getAttribute("data-break-base"));
      const elapsedSeconds = Math.floor((Date.now() - new Date(start).getTime()) / 1000);
      node.textContent = fmtTimer((base * 60) + elapsedSeconds);
    });
    document.querySelectorAll("[data-break-left-start]").forEach((node) => {
      const start = node.getAttribute("data-break-left-start");
      const base = num(node.getAttribute("data-break-base"));
      const allowed = num(node.getAttribute("data-break-allowed"));
      const elapsedSeconds = Math.floor((Date.now() - new Date(start).getTime()) / 1000);
      node.textContent = fmtTimer((allowed * 60) - ((base * 60) + elapsedSeconds));
    });
  }

  function isShiftStale() {
    const active = activeShiftName();
    const current = getCurrentShiftName();
    return isShiftOpen() && active !== current && DB.entries.length > 0 && !shiftContainsNow(active);
  }

  function renderShiftApp() {
    if (!isShiftOpen()) return renderClosedScreen();
    if (isShiftStale()) return renderShiftNeedsClose();
    return `<div class="content-scroll">
      <div class="content-inner">
        ${renderKpiBar()}
        <div class="tabs">
          ${[
            ["paid", "Paid Recharge"],
            ["fp", "Freeplay"],
            ["rd", "Redeem / Cashout"],
            ["referral", "Referral Bonus"],
            ["player", "Search Player"],
            ["bal", "Game Balance"],
            ["att", "Attendance"]
          ].map(([key, label]) => `<button class="tab ${S.shiftTab === key ? "active" : ""}" onclick="TM.setShiftTab('${key}')">${label}</button>`).join("")}
        </div>
        ${S.shiftTab === "paid" ? renderPaidTab() : S.shiftTab === "fp" ? renderFreeplayTab() : S.shiftTab === "rd" ? renderRedeemTab() : S.shiftTab === "referral" ? renderReferralTab() : S.shiftTab === "player" ? renderPlayerSearchTab() : S.shiftTab === "bal" ? renderGameBalanceTab() : renderAttendanceTab()}
      </div>
    </div>`;
  }

  function renderKpiBar() {
    const k = shiftKPIs();
    return `<section class="kpi-row">
      <article class="kpi-card"><span>Paid Sales</span><strong>${k.paidCount}</strong><small>${fmt$(k.totalDeposit)}</small></article>
      <article class="kpi-card"><span>Freeplay</span><strong>${k.fpCount}</strong><small>${fmt$(k.totalFP)}</small></article>
      <article class="kpi-card"><span>Cashouts</span><strong>${k.rdCount}</strong><small>${fmt$(k.totalCashout)}</small></article>
      <article class="kpi-card"><span>Sales Amount</span><strong>${fmt$(k.totalDeposit)}</strong><small>Current Shift deposits</small></article>
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
      salesPct: salesTarget ? Math.min(100, Math.round((deposit / salesTarget) * 100)) : 0,
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
    const credits = entry.type === "paid" ? num(entry.recharge) : ["freeplay", "referral"].includes(entry.type) ? num(entry.fpAmount) : 0;
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
    const sales = paid.reduce((sum, entry) => sum + num(entry.deposit), 0);
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
      sales: paid.reduce((sum, entry) => sum + num(entry.deposit), 0),
      newPlayers: rows.filter((entry) => entry.isNewPlayer).length,
      paidCount: paid.length
    };
  }

  function renderSalesTargetBanner() {
    const s = monthlySalesSummary();
    return `<section class="target-kpi-row">
      <article class="kpi-card"><span>Monthly Team Sales Target</span><strong>${s.salesTarget ? fmt$(s.salesTarget) : "Not Set"}</strong><small>Achieved ${fmt$(s.deposit)}${s.salesTarget ? ` (${s.salesPct}%)` : ""}</small><div class="progress-bar"><i style="width:${s.salesPct}%"></i></div></article>
      <article class="kpi-card"><span>Monthly New Player Target</span><strong>${s.playersTarget ? fmtPlain(s.playersTarget) : "Not Set"}</strong><small>Achieved ${fmtPlain(s.newPlayers)}${s.playersTarget ? ` (${s.playersPct}%)` : ""}</small><div class="progress-bar"><i style="width:${s.playersPct}%"></i></div></article>
      <article class="kpi-card"><span>Sales Target Remaining</span><strong>${fmt$(Math.max(s.salesTarget - s.deposit, 0))}</strong><small>Monthly deposits count as sales</small></article>
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
            ${field("Player ID", `${textInput("paid-player-code", f.playerCode, "TM.setPF('playerCode', this.value, false)", "placeholder=\"PS-K7F2QA\"")}<button type="button" class="btn btn-ghost btn-sm" onclick="TM.fillPaidFromCode()">Load Player</button>`)}
            ${field("Player Name", textInput("paid-player", f.playerName, "TM.setPF('playerName', this.value, false)", "required placeholder=\"Display name\""))}
            ${field("Player Facebook Link", textInput("paid-link", f.playerUrl, "TM.setPF('playerUrl', this.value, false)", "onblur=\"TM.validateLink(this, 'paid-link-hint')\" required placeholder=\"https://facebook.com/...\""))}
          `)}
          ${formSection("Transaction", "tone-green", 4, `
            ${field("Deposit", numberInput("paid-deposit", f.deposit, "TM.updatePaidMoney()", "required min=\"0\" placeholder=\"0.00\""))}
            ${field("Recharge", `<input id="paid-recharge" type="number" step="1" value="${esc(f.recharge)}" oninput="TM.updatePaidMoney()" required min="0" placeholder="0">`)}
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
            ${field("Email", `<input id="paid-email" type="email" value="${esc(f.email)}" oninput="TM.setPF('email', this.value, false)" placeholder="Email address">`)}
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
            ${field("Player ID", `${textInput("free-player-code", f.playerCode, "TM.setFF('playerCode', this.value, false)", "placeholder=\"PS-K7F2QA\"")}<button type="button" class="btn btn-ghost btn-sm" onclick="TM.fillFreeplayFromCode()">Load Player</button>`)}
            ${field("Player Name", textInput("free-player", f.playerName, "TM.setFF('playerName', this.value, false)", "required placeholder=\"Display name\""))}
            ${field("Player Facebook Link", textInput("free-link", f.playerUrl, "TM.setFF('playerUrl', this.value, false)", "onblur=\"TM.validateLink(this, 'free-link-hint')\" required placeholder=\"https://facebook.com/...\""))}
          `)}
          ${formSection("Freeplay Details", "tone-green", 3, `
            ${field("Freeplay Amount", `<input id="free-amount" type="number" step="1" value="${esc(f.fpAmount)}" oninput="TM.setFF('fpAmount', this.value, false)" required min="0" placeholder="0">`)}
            ${field("Game Name", selectInput("free-game", gameOptions(true), f.gameName, "TM.setFF('gameName', this.value, false)"))}
            ${field("Game ID", textInput("free-gameid", f.gameId, "TM.setFF('gameId', this.value, false)", "required placeholder=\"Unique player game ID\""))}
          `)}
          ${formSection("Channel", "tone-green", 3, `
            <label><span>Deposit on Page?</span><div class="tog compact">
              <button type="button" class="t-yes ${f.depositOnPage ? "active" : ""}" onclick="TM.toggleFreeplayDepositOnPage(true)">Yes</button>
              <button type="button" class="t-no ${!f.depositOnPage ? "active" : ""}" onclick="TM.toggleFreeplayDepositOnPage(false)">No</button>
            </div></label>
            ${field("Page Name", selectInput("free-page", [["", "Select Page Name"], ...DB.pageNames.map((page) => [page.name, page.name])], f.depositOnPage ? f.pageName : "", "TM.setFF('pageName', this.value, false)", f.depositOnPage ? "" : "disabled"))}
            ${field("Hunting Profile Name", textInput("free-hunting", f.huntingProfile, "TM.setFF('huntingProfile', this.value, false)", `${f.depositOnPage ? "disabled" : ""} placeholder=\"Profile name\"`))}
          `)}
          ${formSection("New Player", "tone-red", 4, `
            ${field("Sales Agent", selectInput("free-sales", [["", "Select"], ...salesPeople().map((person) => [person.name, person.name])], f.salesName, "TM.setFF('salesName', this.value, false)"))}
            ${field("Player Legal Name", textInput("free-legal", f.legalName, "TM.setFF('legalName', this.value, false)", "placeholder=\"Full legal name\""))}
            ${field("Contact Number", textInput("free-contact", f.contact, "TM.setFF('contact', this.value, false)", "placeholder=\"Phone number\""))}
            ${field("Email", `<input id="free-email" type="email" value="${esc(f.email)}" oninput="TM.setFF('email', this.value, false)" placeholder="Email address">`)}
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

  function redeemLookupInfo(gameId, playerCode) {
    const code = normalizePlayerCode(playerCode);
    const id = String(gameId || "").trim();
    if (!id && !code) return "";
    const rows = allEntries().filter((entry) => code ? normalizePlayerCode(entry.playerCode) === code : entry.gameId === id).sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));
    const paidRows = rows.filter((entry) => entry.type === "paid");
    const freeRows = rows.filter((entry) => entry.type === "freeplay");
    const referralRows = rows.filter((entry) => entry.type === "referral");
    const redeemRows = rows.filter((entry) => entry.type === "redeem");
    if (!rows.length) return `<div class="hint full">No previous player record found for this ${code ? "Player ID" : "Game ID"}.</div>`;
    const totalRecharge = paidRows.reduce((sum, entry) => sum + num(entry.recharge), 0);
    const totalFreeplay = freeRows.reduce((sum, entry) => sum + num(entry.fpAmount), 0);
    const totalReferral = referralRows.reduce((sum, entry) => sum + num(entry.fpAmount), 0);
    const totalRedeemed = redeemRows.reduce((sum, entry) => sum + num(entry.rdCredits), 0);
    const totalCashout = redeemRows.reduce((sum, entry) => sum + num(entry.cashoutPaid), 0);
    return `<div class="hint full lookup-grid">
      <span><b>Paid Records</b>${fmtPlain(paidRows.length)}</span>
      <span><b>Freeplay Records</b>${fmtPlain(freeRows.length)}</span>
      <span><b>Redeem Records</b>${fmtPlain(redeemRows.length)}</span>
      <span><b>Total Paid Recharge</b>${fmt$(totalRecharge)}</span>
      <span><b>Total Freeplay</b>${fmtPlain(totalFreeplay)}</span>
      <span><b>Total Referral</b>${fmtPlain(totalReferral)}</span>
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
            ${field("Player ID", `${textInput("redeem-player-code", f.playerCode, "TM.setRF('playerCode', this.value, false)", "placeholder=\"PS-K7F2QA\"")}<button type="button" class="btn btn-ghost btn-sm" onclick="TM.fillRedeemFromCode()">Load Player</button>`)}
            ${field("Game ID", textInput("redeem-gameid", f.gameId, "TM.setRF('gameId', this.value, false)", "onblur=\"TM.redeemLookup()\" required placeholder=\"Unique player game ID\""))}
            ${field("Game Name", selectInput("redeem-game", gameOptions(true), f.gameName, "TM.setRF('gameName', this.value, false)"))}
            ${field("Redeem Credits", `<input id="redeem-credits" type="number" step="1" value="${esc(f.rdCredits)}" oninput="TM.setRF('rdCredits', this.value, false)" required min="0" placeholder="0">`)}
            ${field("Cashout Paid", numberInput("redeem-cashout", f.cashoutPaid, "TM.setRF('cashoutPaid', this.value, false)", "required min=\"0\" placeholder=\"0.00\""))}
          `)}
          ${redeemLookupInfo(f.gameId, f.playerCode)}
          <div class="row end full">
            <button type="button" class="btn btn-ghost" onclick="TM.clearRedeem()">Clear</button>
            <button class="btn btn-danger" ${IS_ONLINE ? "" : "disabled"}>Add Redeem</button>
          </div>
        </div>
      </form>
      ${renderEntriesTable()}
    </section>`;
  }

  function setReferral(key, value, rerender = true) {
    S.referral[key] = value;
    if (key === "referrerType") updateReferralTypeFields();
    if (rerender) render();
  }

  function updateReferralTypeFields() {
    const isCustomer = S.referral.referrerType === "customer";
    const byCode = document.getElementById("ref-by-code");
    const name = document.getElementById("ref-name");
    if (byCode) byCode.required = isCustomer;
    if (name) name.required = !isCustomer;
  }

  function renderReferralTab() {
    const f = S.referral;
    return `<section class="stack">
      ${renderSalesTargetBanner()}
      <form class="fc sales-sheet" onsubmit="TM.submitReferralBonus(event)" novalidate>
        <div class="fc-head">Referral Bonus Form</div>
        <div class="fg sales-form">
          ${formSection("Session Info", "tone-cyan", 3, `
            ${field("Date", dateInput("ref-date", f.date, "TM.setReferral('date', this.value, false)", "required"))}
            ${field("Shift", selectInput("ref-shift", shiftOptions(), f.shift || activeShiftName(), "TM.setReferral('shift', this.value, false)"))}
            ${field("Sales Person", selectInput("ref-agent", agentOptions(), f.agent, "TM.setReferral('agent', this.value, false)"))}
          `)}
          ${formSection("Referrer", "tone-warn", 4, `
            ${field("Referrer Type", selectInput("ref-type", [["customer", "Existing Customer"], ["external", "Not Customer"]], f.referrerType, "TM.setReferral('referrerType', this.value, false)"))}
            ${field("Referring Player ID", textInput("ref-by-code", f.referredByCode, "TM.setReferral('referredByCode', this.value, false)", `${f.referrerType === "customer" ? "required" : ""} placeholder=\"PS-K7F2QA\"`))}
            ${field("Referrer Name", textInput("ref-name", f.referrerName, "TM.setReferral('referrerName', this.value, false)", `${f.referrerType === "external" ? "required" : ""} placeholder=\"Name\"`))}
            ${field("Referrer Link / Contact", textInput("ref-contact", f.referrerContact, "TM.setReferral('referrerContact', this.value, false)", "placeholder=\"Facebook, phone, or note\""))}
          `)}
          ${formSection("Bonus Credits", "tone-green", 4, `
            ${field("Referred New Player ID", textInput("ref-player-code", f.referredPlayerCode, "TM.setReferral('referredPlayerCode', this.value, false)", "required placeholder=\"PS-K7F2QA\""))}
            ${field("Game ID", textInput("ref-gameid", f.gameId, "TM.setReferral('gameId', this.value, false)", "required placeholder=\"Referrer's game ID\""))}
            ${field("Game Name", selectInput("ref-game", gameOptions(true), f.gameName, "TM.setReferral('gameName', this.value, false)"))}
            ${field("Coins Issued", `<input id="ref-coins" type="number" step="1" value="${esc(f.coins)}" oninput="TM.setReferral('coins', this.value, false)" required min="0" placeholder="0">`)}
          `)}
          ${formSection("Notes", "tone-purple", 1, `
            ${field("Note", textInput("ref-note", f.note, "TM.setReferral('note', this.value, false)", "placeholder=\"Bonus details\""))}
          `)}
          <div class="row end full">
            <button type="button" class="btn btn-ghost" onclick="TM.clearReferralBonus()">Clear</button>
            <button class="btn btn-warn" ${IS_ONLINE ? "" : "disabled"}>Add Referral Bonus</button>
          </div>
        </div>
      </form>
      ${renderEntriesTable()}
    </section>`;
  }

  function playerSummaryRows(code) {
    const normalized = normalizePlayerCode(code);
    if (!normalized) return [];
    return allEntries()
      .filter((entry) => normalizePlayerCode(entry.playerCode) === normalized)
      .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));
  }

  function renderPlayerSearchTab() {
    const code = normalizePlayerCode(S.playerLookupCode);
    const rows = playerSummaryRows(code);
    const latest = rows[0];
    const paid = rows.filter((entry) => entry.type === "paid");
    const freeplay = rows.filter((entry) => entry.type === "freeplay");
    const referralRows = rows.filter((entry) => entry.type === "referral");
    const redeem = rows.filter((entry) => entry.type === "redeem");
    const totalDeposit = paid.reduce((sum, entry) => sum + num(entry.deposit), 0);
    const totalRecharge = paid.reduce((sum, entry) => sum + num(entry.recharge), 0);
    const totalFreeplay = freeplay.reduce((sum, entry) => sum + num(entry.fpAmount), 0);
    const totalReferral = referralRows.reduce((sum, entry) => sum + num(entry.fpAmount), 0);
    const totalRedeemCredits = redeem.reduce((sum, entry) => sum + num(entry.rdCredits), 0);
    const totalCashout = redeem.reduce((sum, entry) => sum + num(entry.cashoutPaid), 0);
    const referralEntries = allEntries().filter((entry) => entry.type === "referral");
    const referredPeople = referralEntries.filter((entry) => normalizePlayerCode(entry.referredByCode || entry.playerCode) === code);
    const referredByRows = referralEntries.filter((entry) => normalizePlayerCode(entry.referralForCode) === code);
    return `<section class="stack">
      <div class="fc"><div class="fc-head">Search Player</div><div class="fg stack">
        <div class="grid c3">
          ${field("Player ID", textInput("player-search-code", S.playerLookupCode, "TM.setS('playerLookupCode', this.value, false)", "placeholder=\"PS-K7F2QA\""))}
          <div class="row end"><button class="btn btn-primary" onclick="TM.renderNow()">Search</button><button class="btn btn-ghost" onclick="TM.clearPlayerCodeSearch()">Clear</button></div>
        </div>
        ${!code ? `<div class="empty">Enter a player ID to view player history.</div>` : !rows.length ? `<div class="empty">No player found for ${esc(code)}.</div>` : `
          <div class="grid c4">
            <article class="kpi-card"><span>Total Deposit</span><strong>${fmt$(totalDeposit)}</strong><small>${paid.length} paid records</small></article>
            <article class="kpi-card"><span>Total Recharge</span><strong>${fmt$(totalRecharge)}</strong><small>Coins given</small></article>
            <article class="kpi-card"><span>Freeplay</span><strong>${fmt$(totalFreeplay)}</strong><small>${freeplay.length} records</small></article>
            <article class="kpi-card"><span>Referral Credits</span><strong>${fmtPlain(totalReferral)}</strong><small>${referralRows.length} records</small></article>
            <article class="kpi-card"><span>Cashout Paid</span><strong>${fmt$(totalCashout)}</strong><small>${redeem.length} redeem records</small></article>
          </div>
          <div class="grid c4">
            <article class="kpi-card"><span>Redeem Credits</span><strong>${fmtPlain(totalRedeemCredits)}</strong><small>Total credits redeemed</small></article>
            <article class="kpi-card"><span>Transactions</span><strong>${rows.length}</strong><small>All records</small></article>
            <article class="kpi-card"><span>First Seen</span><strong>${esc(isoToLabel(rows[rows.length - 1]?.date))}</strong><small>${esc(rows[rows.length - 1]?.shift || "")}</small></article>
            <article class="kpi-card"><span>Last Seen</span><strong>${esc(isoToLabel(latest?.date))}</strong><small>${esc(latest?.shift || "")}</small></article>
          </div>
          <div class="hint lookup-grid">
            <span><b>Player ID</b>${esc(code)}</span>
            <span><b>Player Name</b>${esc(latest.playerName || "Not Provided")}</span>
            <span><b>Game ID</b>${esc(latest.gameId || "Not Provided")}</span>
            <span><b>Game Name</b>${esc(latest.gameName || "Not Provided")}</span>
            <span><b>Legal Name</b>${esc(latest.legalName || "Not Provided")}</span>
            <span><b>Sales Person</b>${esc(latest.agent || "Not Provided")}</span>
          </div>
          <div class="grid c2">
            <article class="balance-card stack"><strong>People Referred</strong>${simpleTable(["Date", "Player ID", "Bonus", "Note"], referredPeople.map((entry) => [esc(isoToLabel(entry.date)), esc(normalizePlayerCode(entry.referralForCode)), referralBonusText(entry), esc(entry.referralNote || "")]))}</article>
            <article class="balance-card stack"><strong>Referred By</strong>${simpleTable(["Date", "Referred By ID", "Bonus", "Note"], referredByRows.map((entry) => [esc(isoToLabel(entry.date)), esc(normalizePlayerCode(entry.referredByCode || entry.playerCode)), referralBonusText(entry), esc(entry.referralNote || "")]))}</article>
          </div>
          ${simpleTable(["Date", "Type", "Shift", "Agent", "Deposit", "Recharge / Amount", "Cashout"], rows.map((entry) => [
            esc(isoToLabel(entry.date)),
            entryBadges(entry),
            esc(entry.shift),
            esc(entry.agent),
            fmt$(entry.deposit),
            entryAmountText(entry),
            fmt$(entry.cashoutPaid)
          ]))}
        `}
      </div></div>
    </section>`;
  }

  function renderGameBalanceTab() {
    const rows = DB.games.map((game) => {
      const usage = gameUsage(game);
      const status = usage.current < 0 ? `<span class="badge bd-red">Negative</span>` : usage.current < 100 ? `<span class="badge bd-warn">Low</span>` : `<span class="badge bd-green">OK</span>`;
      return [esc(game.name), fmtPlain(game.backendLoaded), fmtPlain(usage.paid), fmtPlain(usage.freeplay), fmtPlain(usage.referral), fmtPlain(usage.redeem), `<strong class="${usage.current >= 0 ? "success-text" : "danger-text"}">${fmtPlain(usage.current)}</strong>`, status];
    });
    return `<section class="stack">
      <div class="game-balance-grid">
        ${DB.games.map((game) => {
          const usage = gameUsage(game);
          return `<article class="balance-card game-balance-card">
            <span class="badge bd-purple">${esc(game.name)}</span>
            <div class="row between"><span class="muted">Backend Loaded</span><strong>${fmtPlain(game.backendLoaded)}</strong></div>
            <div class="row between"><span class="muted">Paid Issued</span><strong class="danger-text">-${fmtPlain(usage.paid)}</strong></div>
            <div class="row between"><span class="muted">Freeplay Issued</span><strong class="danger-text">-${fmtPlain(usage.freeplay)}</strong></div>
            <div class="row between"><span class="muted">Referral Issued</span><strong class="danger-text">-${fmtPlain(usage.referral)}</strong></div>
            <div class="row between"><span class="muted">Redeem Returned</span><strong class="success-text">${fmtPlain(usage.redeem)}</strong></div>
            <div class="row between"><span class="muted">Expected Balance</span><strong class="${usage.current >= 0 ? "success-text" : "danger-text"}">${fmtPlain(usage.current)}</strong></div>
          </article>`;
        }).join("")}
      </div>
      <div class="fc"><div class="fc-head">Game Reconciliation</div><div class="fg">${simpleTable(["Game", "Loaded", "Paid Issued", "Freeplay", "Referral", "Redeem Returned", "Expected Balance", "Status"], rows)}</div></div>
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
    const people = allPeople();
    const stats = { in: 0, out: 0, leave: 0, missing: 0 };
    const cards = people.map((person) => {
      const date = attendanceDateForPerson(person);
      const rec = getAttendance(person.id, date);
      const status = attendanceStatus(rec);
      if (status.cls === "in") stats.in += 1;
      else if (status.cls === "done") stats.out += 1;
      else if (status.cls === "leave") stats.leave += 1;
      else stats.missing += 1;
      const rawMins = rec?.checkInAt ? minutesBetween(rec.checkInAt, rec.checkOutAt || new Date().toISOString()) : 0;
      const netMins = rec?.checkOutAt ? num(rec.duration) : Math.max(0, rawMins - currentBreakMinutes(rec));
      const breakLeft = breakTimeLeft(person, rec);
      const breakUsed = currentBreakMinutes(rec);
      const breakAllowed = num(person?.breakAllowedMins ?? 30);
      const breakUsedText = rec?.breakStartAt ? `<span data-break-start="${esc(rec.breakStartAt)}" data-break-base="${esc(rec.breakMins || 0)}">${fmtTimer(breakUsed * 60)}</span>` : fmtTimer(breakUsed * 60);
      const breakLeftText = rec?.breakStartAt ? `<span data-break-left-start="${esc(rec.breakStartAt)}" data-break-base="${esc(rec.breakMins || 0)}" data-break-allowed="${esc(breakAllowed)}">${fmtTimer(breakLeft * 60)}</span>` : fmtTimer(breakLeft * 60);
      return `<article class="person-card time-card ${status.cls}">
        <h3><span>${esc(person.name)}</span><span class="avatar" style="background:${esc(person.color)}">${esc(initials(person.name))}</span></h3>
        <div class="time-meta"><span>${rec?.checkInAt ? `Started at <b>${fmtTime(rec.checkInAt)}</b>` : esc(status.label)}</span><span>${esc(isoToLabel(date))}</span></div>
        <div class="time-clock">${formatDuration(netMins)}</div>
        <div class="time-actions">
          ${!rec || (!rec.checkInAt && !rec.checkOutAt && !["leave", "off", "leave-approved"].includes(rec.status)) ? `<button class="btn btn-success" onclick="TM.checkIn('${person.id}')" ${IS_ONLINE ? "" : "disabled"}>Clock In</button><button class="btn btn-warn" onclick="TM.markLeave('${person.id}')" ${IS_ONLINE ? "" : "disabled"}>Leave</button>` : ""}
          ${rec?.checkInAt && !rec?.checkOutAt ? `<button class="btn btn-primary" onclick="TM.openCheckout('${person.id}')" ${IS_ONLINE ? "" : "disabled"}>Clock Out</button><button class="btn btn-ghost" onclick="TM.toggleBreak('${person.id}')" ${IS_ONLINE ? "" : "disabled"}>${rec.breakStartAt ? "End Break" : "Take Break"}</button><span class="break-left">Break used<br><b>${breakUsedText}</b></span><span class="break-left">Break time left<br><b>${breakLeftText}</b></span>` : ""}
          ${rec && (rec.checkOutAt || ["leave", "off", "leave-approved"].includes(rec.status)) ? `<span class="badge bd-gray">Recorded</span>` : ""}
        </div>
        <div class="time-day">
          <div class="row between"><strong>Today</strong><em>Total time ${formatDuration(netMins)}</em></div>
          <div class="time-row"><span>Clock in<br><b>${rec?.checkInAt ? fmtTime(rec.checkInAt) : "--"}</b></span><span>Clock out<br><b>${rec?.checkOutAt ? fmtTime(rec.checkOutAt) : "--"}</b></span><strong>${formatDuration(netMins)}</strong></div>
        </div>
        ${rec?.leaveReason || rec?.offReason ? `<p class="warn-text">Reason: ${esc(rec.leaveReason || rec.offReason)}</p>` : ""}
        <button class="btn btn-ghost btn-sm" onclick="TM.openLeaveRequest('${person.id}')">Leave Request</button>
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
    const filters = [["all", "All"], ["paid", "Paid"], ["freeplay", "Freeplay"], ["redeem", "Redeem"], ["referral", "Referral"]];
    const rows = activeEntries().filter((entry) => S.eFilter === "all" || entry.type === S.eFilter);
    return `<section class="fc" id="entries-host">
      <div class="fc-head">Entries</div>
      <div class="fg stack">
        <div class="row">${filters.map(([key, label]) => `<button class="btn btn-sm ${S.eFilter === key ? "btn-primary" : "btn-ghost"}" onclick="TM.setEntryFilter('${key}')">${label}</button>`).join("")}</div>
        <div class="tbl-wrap entries-table">
          <table>
            <thead><tr><th>#</th><th>Type</th><th>Date</th><th>Entry Time</th><th>Agent</th><th>Player ID</th><th>Player Name</th><th>Game ID</th><th>Game Name</th><th>Deposit</th><th>Amount / Credits</th><th>Actions</th></tr></thead>
            <tbody>${rows.map((entry, index) => `<tr>
              <td>${index + 1}</td>
              <td>${entryBadges(entry)}</td>
              <td>${esc(isoToLabel(entry.date))}</td>
              <td>${esc(fmtDateTime(entry.createdAt))}</td>
              <td>${esc(entry.agent)}</td>
              <td class="mono">${esc(normalizePlayerCode(entry.playerCode))}</td>
              <td class="trunc">${esc(entry.playerName)}</td>
              <td class="mono">${esc(entry.gameId)}</td>
              <td>${esc(entry.gameName)}</td>
              <td>${moneyCell(entry.deposit)}</td>
              <td>${entryAmountText(entry)}</td>
              <td><div class="row"><button class="btn btn-xs btn-ghost" onclick="TM.editEntry('${entry.id}')">Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deleteEntry('${entry.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></div></td>
            </tr>`).join("") || `<tr><td colspan="12" class="empty">No entries yet.</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </section>`;
  }

  function entryBadges(entry) {
    const type = entry.type === "paid" ? `<span class="badge bd-cyan">Paid</span>` : entry.type === "freeplay" ? `<span class="badge bd-purple">Freeplay</span>` : entry.type === "referral" ? `<span class="badge bd-warn">Referral</span>` : `<span class="badge bd-red">Redeem</span>`;
    return `${type}${entry.isNewPlayer ? ` <span class="badge bd-green">New</span>` : ""}${entry.dispute ? ` <span class="badge bd-warn">Dispute</span>` : ""}`;
  }

  function referralBonusText(entry) {
    return `${fmtPlain(entry.fpAmount || entry.referralBonusAmount)} credits`;
  }

  function entryAmountText(entry) {
    if (entry.type === "paid") return fmt$(entry.recharge);
    if (entry.type === "freeplay") return fmt$(entry.fpAmount);
    if (entry.type === "referral") return referralBonusText(entry);
    return `${fmtPlain(entry.rdCredits)} credits / ${fmt$(entry.cashoutPaid)}`;
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
      return [esc(agent), fmtPlain(k.paidCount), fmt$(k.totalDeposit), fmt$(k.totalR), fmt$(k.totalFP), fmt$(k.totalCashout), fmtPlain(k.newPlayers)];
    });
    return `<div class="content-scroll">
      <section class="fc closed-panel">
        <div class="fc-head">${title}</div>
        <div class="fg stack">
          <h1 style="margin:0">${title}</h1>
          <p class="muted">${esc(s.shiftName || last?.label || "Current Shift")} is locked and archived. Start the next current shift before adding entries.</p>
          <h3>Closed Shift Summary</h3>
          <div class="grid c4">
            <article class="kpi-card"><span>Paid Sales</span><strong>${s.paidCount || 0}</strong><small>${fmt$(s.totalDeposit || 0)}</small></article>
            <article class="kpi-card"><span>Total Deposit</span><strong>${fmt$(s.totalDeposit || 0)}</strong><small>Archived Shift</small></article>
            <article class="kpi-card"><span>Freeplay</span><strong>${fmt$(s.totalFP || 0)}</strong><small>Freeplay amount</small></article>
            <article class="kpi-card"><span>Cashouts</span><strong>${fmt$(s.totalCashout || 0)}</strong><small>Cashout paid</small></article>
          </div>
          <p>New Players: <strong>${s.newPlayers || 0}</strong>. Duration: <strong>${formatDuration(s.durationMins || 0)}</strong>.</p>
          <h3>Sales Person Summary</h3>
          ${simpleTable(["Sales Person", "Paid Recharges", "Sales Amount", "Coins Given", "Freeplay", "Cashouts", "New Players"], agentRows)}
          ${day ? `<h3>Total Day Summary</h3><div class="grid c4">
            <article class="kpi-card"><span>Day Sales</span><strong>${fmt$(day.totalDeposit || 0)}</strong><small>${day.paidCount || 0} paid records</small></article>
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
      ["team", "People & Roles"],
      ["staff", "Staff & Access"],
      ["games", "Games & Game Vendors"],
      ["pages", "Page Names"],
      ["vendors", "Payment Vendors"],
      ["audit", "Audit Log"],
      ["supabase", "Supabase"],
      ["settings", "Theme & Appearance"],
      ["backup", "Backup & Export"]
    ].filter(([key]) => canAdminSection(key));
    if (!sections.some(([key]) => key === S.adminSection)) S.adminSection = "dashboard";
    return `<div class="admin-shell">
      <aside class="sidebar">${sections.map(([key, label]) => `<button class="btn btn-ghost ${S.adminSection === key ? "active" : ""}" onclick="TM.setAdmin('${key}')">${label}</button>`).join("")}</aside>
      <section class="admin-main">${renderAdminSection()}</section>
    </div>`;
  }

  function renderAdminLocked() {
    return `<section class="fc" style="margin:24px"><div class="fc-head">Admin Dashboard</div><div class="fg stack"><h2>Admin access required</h2><p class="muted">Sign in with an authorized admin account to continue.</p><button class="btn btn-primary" onclick="TM.openAdminGate()">Admin Login</button></div></section>`;
  }

  function renderAdminSection() {
    if (!canAdminSection(S.adminSection)) return `<div class="empty">You do not have permission to open this admin section.</div>`;
    switch (S.adminSection) {
      case "transactions": return renderAdminTransactions();
      case "performance": return renderAdminPerformance();
      case "targets": return renderAdminTargets();
      case "pnl": return renderAdminProfitLoss();
      case "attendance": return renderAdminAttendance();
      case "team": return renderAdminTeam();
      case "shifts": return renderAdminTeam();
      case "agents": return renderAdminTeam();
      case "staff": return renderAdminStaff();
      case "games": return renderAdminGames();
      case "payMethods": return renderAdminVendors();
      case "pages": return renderAdminPages();
      case "vendors": return renderAdminVendors();
      case "audit": return renderAdminAudit();
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
        <article class="kpi-card"><span>Sales Amount</span><strong>${fmt$(shift.totalDeposit)}</strong><small>Current shift deposits</small></article>
        <article class="kpi-card"><span>Players Added</span><strong>${shift.newPlayers}</strong><small>Current Shift</small></article>
        <article class="kpi-card"><span>Cashout</span><strong>${fmt$(shift.totalCashout)}</strong><small>Current Shift</small></article>
        <article class="kpi-card"><span>Freeplay</span><strong>${fmt$(shift.totalFP)}</strong><small>Current Shift</small></article>
      </div></section>
      <section class="grid c4 admin-kpi-grid">
        <article class="kpi-card"><span>Current Month Sales</span><strong>${fmt$(target.deposit)}</strong><small>${paid.filter((entry) => String(entry.date || "").startsWith(monthKey())).length} records</small></article>
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

  function renderShiftNeedsClose() {
    return `<div class="content-scroll">
      <section class="fc closed-panel">
        <div class="fc-head">Previous Shift Still Open</div>
        <div class="fg stack">
          <h1 style="margin:0">${esc(activeShiftName())} must be closed</h1>
          <p class="muted">Current time belongs to ${esc(getCurrentShiftName())}. Close ${esc(activeShiftName())} before adding new entries.</p>
          <div class="grid c4">
            <article class="kpi-card"><span>Open Entries</span><strong>${activeEntries().length}</strong><small>Need review before close</small></article>
            <article class="kpi-card"><span>Sales Amount</span><strong>${fmt$(shiftKPIs().totalDeposit)}</strong><small>Current open shift</small></article>
        <article class="kpi-card"><span>Coins Given</span><strong>${fmt$(shiftKPIs().totalR + shiftKPIs().totalFP)}</strong><small>Paid and freeplay only</small></article>
            <article class="kpi-card"><span>Cashout</span><strong>${fmt$(shiftKPIs().totalCashout)}</strong><small>Current open shift</small></article>
          </div>
          <div><button class="btn btn-warn" onclick="TM.openCloseShift()" ${IS_ONLINE ? "" : "disabled"}>Close ${esc(activeShiftName())}</button></div>
        </div>
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
          <article class="kpi-card"><span>Monthly Team Sales Target</span><strong>${s.salesTarget ? fmt$(s.salesTarget) : "Not Set"}</strong><small>Achieved ${fmt$(s.deposit)}${s.salesTarget ? ` (${s.salesPct}%)` : ""}</small><div class="progress-bar"><i style="width:${s.salesPct}%"></i></div></article>
          <article class="kpi-card"><span>Sales Target Remaining</span><strong>${fmt$(Math.max(s.salesTarget - s.deposit, 0))}</strong><small>Monthly deposits count as sales</small></article>
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
          <article class="kpi-card"><span>Coins Issued Cost</span><strong>${fmt$(summary.coinCost)}</strong><small>Paid, freeplay, and referral credits separated in details</small></article>
          <article class="kpi-card"><span>Redeemed Credits Value</span><strong>${fmt$(summary.redeemedValue)}</strong><small>${summary.noCashoutRedeemCount} without cashout</small></article>
          <article class="kpi-card"><span>Cashouts Paid</span><strong>${fmt$(summary.cashouts)}</strong><small>${summary.redeemCount} redeem records</small></article>
          <article class="kpi-card"><span>Estimated Margin</span><strong class="${summary.margin >= 0 ? "success-text" : "danger-text"}">${fmt$(summary.margin)}</strong><small>${fmtPlain(summary.marginPct)}% margin</small></article>
        </div>
      </div></div>
      <div class="fc"><div class="fc-head">Game Profit and Loss</div><div class="fg">${simpleTable(["Game", "Paid Transactions", "Sales Amount", "Gateway Fees", "Coins Issued Cost", "Redeemed Credits Value", "Cashouts Paid", "Estimated Margin", "Margin Percentage"], gameRows)}</div></div>
      <div class="fc"><div class="fc-head">Transaction Cost Detail</div><div class="fg">${simpleTable(["Date", "Type", "Sales Person", "Player ID", "Player Name", "Game Name", "Sales Amount", "Gateway Fee", "Coins Issued Cost", "Redeemed Credits Value", "Cashout Paid", "Margin"], rows.map((entry) => {
        const sales = entry.type === "paid" ? num(entry.deposit) : 0;
        const cost = entryCoinCost(entry);
        const gateway = entryGatewayFee(entry);
        const redeemed = entryRedeemValue(entry);
        const cashout = entry.type === "redeem" ? num(entry.cashoutPaid) : 0;
        const margin = sales - gateway - cost - redeemed - cashout;
        return [esc(isoToLabel(entry.date)), entryBadges(entry), esc(entry.agent), esc(normalizePlayerCode(entry.playerCode)), esc(entry.playerName), esc(entry.gameName), fmt$(sales), fmt$(gateway), fmt$(cost), fmt$(redeemed), fmt$(cashout), `<span class="${margin >= 0 ? "success-text" : "danger-text"}">${fmt$(margin)}</span>`];
      }))}</div></div>
    </section>`;
  }

  function simpleTable(heads, rows) {
    const compact = heads.length <= 5 ? " compact-table" : "";
    return `<div class="tbl-wrap${compact}"><table><thead><tr>${heads.map((head) => `<th>${esc(head)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${heads.length}" class="empty">No records.</td></tr>`}</tbody></table></div>`;
  }

  function filteredTransactions() {
    let rows = allEntries();
    const search = S.txSearch.trim().toLowerCase();
    if (search) {
      rows = rows.filter((entry) => [entry.playerCode, entry.playerName, entry.agent, entry.gameId, entry.gameName, entry.custTag, entry.legalName].some((value) => String(value || "").toLowerCase().includes(search)));
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
          ${field("Type", selectInput("tx-type", [["all", "All"], ["paid", "Paid"], ["freeplay", "Freeplay"], ["redeem", "Redeem"], ["referral", "Referral"]], S.txType, "TM.setS('txType', this.value)"))}
        ${field("Sales Person", selectInput("tx-agent", [["", "All Sales People"], ...salesPeople().map((person) => [person.name, person.name])], S.txAgent, "TM.setS('txAgent', this.value)"))}
        ${field("Game", selectInput("tx-game", [["", "All Games"], ...DB.games.map((game) => [game.name, game.name])], S.txGame, "TM.setS('txGame', this.value)"))}
        ${field("Shift", selectInput("tx-shift", [["", "All Shifts"], ...DB.shifts.map((shift) => [shift.name, shift.name])], S.txShift, "TM.setS('txShift', this.value)"))}
        ${field("Start Date", dateInput("tx-start-date", S.txStartDate, "TM.setS('txStartDate', this.value)"))}
        ${field("End Date", dateInput("tx-end-date", S.txEndDate, "TM.setS('txEndDate', this.value)"))}
        ${field("Sort", selectInput("tx-sort", [["newest", "Newest First"], ["oldest", "Oldest First"], ["depositDown", "Deposit Down"], ["depositUp", "Deposit Up"], ["player", "Player A-Z"], ["agent", "Agent A-Z"]], S.txSort, "TM.setS('txSort', this.value)"))}
        <div class="row end"><button class="btn btn-primary" onclick="TM.renderNow()">Apply Filters</button><button class="btn btn-ghost" onclick="TM.clearTransactions()">Clear</button><button class="btn btn-success" onclick="TM.exportTransactionsExcel()">Export Excel</button></div>
      </div>
      <p class="muted">${rows.length} records. Total deposit ${fmt$(totalDeposit)}. Total recharge ${fmt$(totalRecharge)}. Total cashout ${fmt$(totalCashout)}.</p>
      ${renderPlayerLookupPanel()}
      <div class="tbl-wrap"><table><thead><tr><th>#</th><th>Type</th><th>Session</th><th>Date</th><th>Entry Time</th><th>Sales Person</th><th>Player ID</th><th>Player Name</th><th>Game ID</th><th>Game Name</th><th>Deposit</th><th>Amount / Credits</th><th>Cashout Paid</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${rows.map((entry, index) => `<tr class="${entry.dispute ? "dispute-row" : ""}"><td>${index + 1}</td><td>${entryBadges(entry)}</td><td>${esc(entry.shiftSession || "Current")}</td><td>${esc(isoToLabel(entry.date))}</td><td>${esc(fmtDateTime(entry.createdAt))}</td><td>${esc(entry.agent)}</td><td class="mono">${esc(normalizePlayerCode(entry.playerCode))}</td><td>${esc(entry.playerName)}</td><td class="mono">${esc(entry.gameId)}</td><td>${esc(entry.gameName)}</td><td>${fmt$(entry.deposit)}</td><td>${entryAmountText(entry)}</td><td>${fmt$(entry.cashoutPaid)}</td><td>${entryStatus(entry)}</td><td><div class="row"><button class="btn btn-xs btn-ghost" onclick="TM.editEntry('${entry.id}')">Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deleteEntry('${entry.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></div></td></tr>`).join("") || `<tr><td colspan="15" class="empty">No transactions match these filters.</td></tr>`}
      </tbody></table></div>
    </div></div>`;
  }

  function renderPlayerLookupPanel() {
    const query = S.txPlayerLookup.trim().toLowerCase();
    const rows = query ? allEntries().filter((entry) => [entry.playerCode, entry.playerName, entry.gameId, entry.legalName].some((value) => String(value || "").toLowerCase().includes(query))) : [];
    const month = monthKey();
    const monthly = rows.filter((entry) => String(entry.date || "").startsWith(month));
    const stat = (list, type, key) => list.filter((entry) => !type || entry.type === type).reduce((sum, entry) => sum + num(entry[key]), 0);
    const creditsCost = rows.reduce((sum, entry) => {
      const game = DB.games.find((item) => item.name === entry.gameName || item.id === entry.gameId);
      return sum + (entry.type === "redeem" ? (num(entry.rdCredits) / 1000) * num(game?.pricePer1k) : 0);
    }, 0);
    return `<section class="fc player-lookup"><div class="fc-head">Player Lookup</div><div class="fg stack">
      <div class="grid c3">
        ${field("Search Player ID, Game ID, or Legal Name", `<input value="${esc(S.txPlayerLookup)}" oninput="TM.setS('txPlayerLookup', this.value, false)" placeholder="Search one player">`)}
        <div class="row end"><button class="btn btn-primary" onclick="TM.renderNow()">Search Player</button><button class="btn btn-ghost" onclick="TM.clearPlayerLookup()">Clear</button></div>
      </div>
      ${query ? `<div class="grid c4">
        <article class="kpi-card"><span>All-Time Sales</span><strong>${fmt$(stat(rows, "paid", "deposit"))}</strong><small>Money received</small></article>
        <article class="kpi-card"><span>All-Time Coins Given</span><strong>${fmt$(stat(rows, "paid", "recharge"))}</strong><small>${rows.filter((entry) => entry.type === "paid").length} paid records</small></article>
        <article class="kpi-card"><span>Monthly Sales</span><strong>${fmt$(stat(monthly, "paid", "deposit"))}</strong><small>Current month deposits</small></article>
        <article class="kpi-card"><span>Monthly Coins Given</span><strong>${fmt$(stat(monthly, "paid", "recharge"))}</strong><small>Current month</small></article>
        <article class="kpi-card"><span>Cashouts Paid</span><strong>${fmt$(stat(rows, "redeem", "cashoutPaid"))}</strong><small>All Time</small></article>
        <article class="kpi-card"><span>Redeem Credits</span><strong>${fmtPlain(stat(rows, "redeem", "rdCredits"))}</strong><small>Credits given</small></article>
        <article class="kpi-card"><span>Credits Given Cost</span><strong>${fmt$(creditsCost)}</strong><small>Based on game price per 1000 credits</small></article>
      </div>` : `<p class="muted">Search a player to see all-time and monthly sales, coins given, cashouts, redeem credits, and estimated credit cost.</p>`}
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
        <div class="tbl-wrap"><table><thead><tr><th>Employee</th><th>Date</th><th>Status</th><th>Check In Time</th><th>Check Out Time</th><th>Break</th><th>Hours Worked</th><th>Leave Reason</th><th>Actions</th></tr></thead><tbody>
          ${rows.map((record) => `<tr><td>${esc(record.agentName)}</td><td>${esc(isoToLabel(record.date))}</td><td>${attendanceBadge(record)}</td><td>${record.checkInAt ? fmtTime(record.checkInAt) : ""}</td><td>${record.checkOutAt ? fmtTime(record.checkOutAt) : ""}</td><td>${fmtPlain(record.breakMins || 0)} min</td><td>${formatDuration(record.duration)}</td><td>${esc(record.leaveReason || record.offReason || "")}</td><td><div class="row"><button class="btn btn-xs btn-ghost" onclick="TM.correctAttendance('${record.id}')">Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deleteAttendance('${record.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></div></td></tr>`).join("") || `<tr><td colspan="9" class="empty">No attendance records.</td></tr>`}
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
      ${simpleTable(["Name", "Start", "End", "Duration", "Actions"], DB.shifts.map((shift) => [esc(shift.name), esc(shift.start), esc(shift.end), esc(shiftDurationLabel(shift)), `<button class="btn btn-xs btn-danger" onclick="TM.deleteShift('${shift.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button>`]))}
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

  function renderAdminTeam() {
    const roleRows = DB.agentRoles.map((role) => [
      esc(roleName(role)),
      DB.agents.filter((agent) => agent.role === role).length,
      `<button class="btn btn-xs btn-danger" onclick="TM.deleteAgentRole('${esc(role)}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button>`
    ]);
    return `<section class="stack">
      <div class="grid c2">
        <div class="fc"><div class="fc-head">Schedules</div><div class="fg stack">
          <div class="row end"><button class="btn btn-primary" onclick="TM.openModal('addShift')" ${IS_ONLINE ? "" : "disabled"}>Add Schedule</button></div>
          ${simpleTable(["Name", "Start", "End", "Duration", "Actions"], DB.shifts.map((shift) => [esc(shift.name), esc(shift.start), esc(shift.end), esc(shiftDurationLabel(shift)), `<button class="btn btn-xs btn-danger" onclick="TM.deleteShift('${shift.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button>`]))}
        </div></div>
        <div class="fc"><div class="fc-head">Roles</div><div class="fg stack">
          ${simpleTable(["Role", "Agents", "Actions"], roleRows)}
          <div class="row"><input id="new-agent-role" placeholder="Role name"><button class="btn btn-primary" onclick="TM.addAgentRole()" ${IS_ONLINE ? "" : "disabled"}>Add Role</button></div>
        </div></div>
      </div>
      <div class="fc"><div class="fc-head">Agents</div><div class="fg stack">
        <div class="row end"><button class="btn btn-primary" onclick="TM.openModal('addAgent')" ${IS_ONLINE ? "" : "disabled"}>Add Agent</button></div>
        <div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Schedule</th><th>Attendance Required</th><th>Show Name in Sales Forms</th><th>Monthly New Player Target</th><th>Monthly Sales Target</th><th>Color</th><th>Actions</th></tr></thead><tbody>
        ${DB.agents.map((agent) => `<tr><td>${esc(agent.name)}</td><td><span class="badge bd-gray">${esc(roleName(agent.role || "agent"))}</span></td><td>${esc(shiftById(agent.shiftId)?.name || "")}</td><td>${yesNoBadge(agent.attendanceRequired !== false)}</td><td>${yesNoBadge(agent.showInDeposits !== false)}</td><td>${fmtPlain(agent.targets?.newPlayers || 0)}</td><td>${fmt$(agent.targets?.deposit || 0)}</td><td><span class="dot on" style="background:${esc(agent.color)}"></span></td><td><div class="row"><button class="btn btn-xs btn-ghost" onclick="TM.openAgentEdit('${agent.id}')" ${IS_ONLINE ? "" : "disabled"}>Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deleteAgent('${agent.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></div></td></tr>`).join("") || `<tr><td colspan="9" class="empty">No agents.</td></tr>`}
        </tbody></table></div>
      </div></div>
    </section>`;
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
      <div class="fc"><div class="fc-head">Authorization Code</div><div class="fg stack">
        ${field("Authorization Code", `<input id="override-code" type="password" autocomplete="new-password" value="${esc(DB.overrideCode)}">`)}
        <div class="row"><button class="btn btn-primary" onclick="TM.saveOverrideCode()" ${IS_ONLINE ? "" : "disabled"}>Save Code</button><span id="code-save-msg" class="success-text"></span></div>
      </div></div>
      <div class="fc"><div class="fc-head">Shift Repair Override</div><div class="fg stack">
        <div class="notice warn">Use only when shift timing or duplicate-close protection leaves the CRM stuck. These actions are audited.</div>
        <div class="grid c3">
          ${field("Active Shift Now", selectInput("repair-active-shift", shiftOptions(), DB.activeShiftName || getCurrentShiftName()))}
          ${field("Repair Date", dateInput("repair-date", todayISO(), ""))}
          ${field("Force Close Shift", selectInput("repair-close-shift", shiftOptions(), DB.activeShiftName || getCurrentShiftName()))}
        </div>
        <div class="row"><button class="btn btn-primary" onclick="TM.adminSetActiveShift()" ${IS_ONLINE ? "" : "disabled"}>Set Active Shift</button><button class="btn btn-warn" onclick="TM.adminForceCloseShift()" ${IS_ONLINE ? "" : "disabled"}>Force Close Selected Shift</button></div>
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
    const selectedGameVendor = DB.gameVendors.find((vendor) => vendor.id === S.selectedGameVendorId) || DB.gameVendors[0];
    const vendorRows = DB.gameVendors.map((vendor) => {
      const games = DB.games.filter((game) => game.gameVendorId === vendor.id);
      const active = selectedGameVendor?.id === vendor.id;
      return [
        `<button class="link-btn ${active ? "active-link" : ""}" onclick="TM.selectGameVendor('${vendor.id}')">${esc(vendor.name)}</button>`,
        esc(vendor.contactPerson || "Not Set"),
        esc(vendor.phone || "Not Set"),
        fmtPlain(games.length),
        games.length ? games.map((game) => esc(game.name)).join(", ") : `<span class="muted">No games assigned</span>`
      ];
    });
    const unassignedGames = DB.games.filter((game) => !game.gameVendorId);
    return `<section class="stack">
      <div class="fc"><div class="fc-head">Games</div><div class="fg stack">
        <div class="row end"><button class="btn btn-primary" onclick="TM.openModal('addGame')" ${IS_ONLINE ? "" : "disabled"}>Add Game</button></div>
        <div class="tbl-wrap"><table><thead><tr><th>Game Name</th><th>Game Vendor</th><th>Backend Loaded</th><th>Current Balance</th><th>Price per 1000 Credits</th><th>Backend Link</th><th>Player Link</th><th>Username</th><th>Password</th><th>Actions</th></tr></thead><tbody>
        ${DB.games.map((game) => S.editGameId === game.id ? renderGameEditRow(game) : renderGameRow(game)).join("")}
        </tbody></table></div>
      </div></div>
      <div class="fc"><div class="fc-head">Game Vendors</div><div class="fg stack">
        <div class="row end"><button class="btn btn-primary" onclick="TM.openModal('gameVendor')" ${IS_ONLINE ? "" : "disabled"}>Add Game Vendor</button></div>
        ${simpleTable(["Vendor", "Contact Person", "Phone", "Games", "Assigned Game Names"], vendorRows)}
        ${selectedGameVendor ? renderGameVendorDetail(selectedGameVendor) : `<div class="empty">No game vendors yet.</div>`}
        ${unassignedGames.length ? `<article class="vendor-detail stack"><strong>Unassigned Games</strong>${simpleTable(["Game", "Backend Loaded", "Current Balance", "Price / 1000"], unassignedGames.map((game) => [esc(game.name), fmt$(game.backendLoaded), fmt$(gameBal(game.id)), fmt$(game.pricePer1k)]))}</article>` : ""}
      </div></div>
    </section>`;
  }

  function renderGameRow(game) {
    const vendor = DB.gameVendors.find((item) => item.id === game.gameVendorId);
    const current = gameBal(game.id);
    return `<tr><td>${esc(game.name)}</td><td><span class="badge bd-purple">${esc(vendor?.name || "Unassigned")}</span></td><td>${fmt$(game.backendLoaded)}</td><td><span class="${current >= 0 ? "success-text" : "danger-text"}">${fmt$(current)}</span></td><td>${fmt$(game.pricePer1k)}</td><td>${linkCell(game.backendLink)}</td><td>${linkCell(game.playerLink)}</td><td>${esc(game.username)}</td><td>${esc(game.password)}</td><td><div class="row"><button class="btn btn-xs btn-success" onclick="TM.topUpGame('${game.id}')" ${IS_ONLINE ? "" : "disabled"}>Top-up Backend</button><button class="btn btn-xs btn-ghost" onclick="TM.editGame('${game.id}')">Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deleteGame('${game.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button></div></td></tr>`;
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
    const rows = DB.payVendors.filter((vendor) => !vendor.archived).map((vendor) => {
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

  function vendorFeeDeposits(fee) {
    return allEntries()
      .filter((entry) => entry.type === "paid" && entry.payMethodId === fee.payMethodId && (!fee.payTag || entry.payTagLabel === fee.payTag))
      .reduce((sum, entry) => sum + num(entry.deposit), 0);
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
    const rows = DB.payVendors.filter((vendor) => !vendor.archived).map((vendor) => {
      const totals = vendorTotals(vendor);
      return [
        esc(vendor.name),
        fmt$(totals.deposits),
        fmt$(totals.fees),
        fmt$(totals.deductions),
        fmt$(totals.paid),
        `<strong class="${totals.pending >= 0 ? "success-text" : "danger-text"}">${fmt$(totals.pending)}</strong>`
      ];
    });
    return `<div class="fc dashboard-compact"><div class="fc-head">Vendor Payments Dashboard</div><div class="fg stack">
      <p class="muted">Track amount to receive from each payment vendor after gateway fees, payments received, and disputes or deductions.</p>
      ${simpleTable(["Vendor", "Deposits", "Fee Deducted", "Disputes / Deductions", "Paid Received", "Pending Amount"], rows)}
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
    const archived = S.payMethodSection === "archived";
    const visibleVendors = DB.payVendors.filter((vendor) => archived ? vendor.archived : !vendor.archived);
    const selectedPayVendor = visibleVendors.find((vendor) => vendor.id === S.selectedPayVendorId) || visibleVendors[0];
    const paymentRows = visibleVendors.map((vendor) => {
      const totals = vendorTotals(vendor);
      const active = selectedPayVendor?.id === vendor.id;
      return [
        `<button class="link-btn ${active ? "active-link" : ""}" onclick="TM.selectPayVendor('${vendor.id}')">${esc(vendor.name)}</button>`,
        vendor.archived ? `<span class="badge bd-gray">Archived</span>` : `<span class="badge bd-green">Active</span>`,
        esc(vendor.contactPerson || "Not Set"),
        esc(vendor.phone || "Not Set"),
        fmtPlain((vendor.fees || []).length),
        fmt$(totals.deposits),
        `<strong class="${totals.pending >= 0 ? "success-text" : "danger-text"}">${fmt$(totals.pending)}</strong>`
      ];
    });
    const paymentSection = `<div class="stack">
      ${renderVendorPaymentsDashboard()}
      <div class="fc"><div class="fc-head">Payment Vendors</div><div class="fg stack">
        <div class="row between"><div class="subtabs"><button class="tab ${!archived ? "active" : ""}" onclick="TM.setPayMethodSection('active')">Active Vendors</button><button class="tab ${archived ? "active" : ""}" onclick="TM.setPayMethodSection('archived')">Archived Vendors</button></div><button class="btn btn-primary" onclick="TM.openModal('payVendor')" ${IS_ONLINE ? "" : "disabled"}>Add Payment Vendor</button></div>
        ${simpleTable(["Vendor", "Status", "Contact Person", "Phone", "Fee Rows", "Deposits", "Pending"], paymentRows)}
        ${selectedPayVendor ? renderPaymentVendorDetail(selectedPayVendor) : `<div class="empty">No payment vendors yet.</div>`}
      </div></div>
      ${renderAdminPayMethods()}
    </div>`;
    return `<section class="stack">${paymentSection}</section>`;
  }

  function renderPaymentVendorDetail(vendor) {
    const totals = vendorTotals(vendor);
    const actions = vendor.archived
      ? `<button class="btn btn-xs btn-success" onclick="TM.restorePayVendor('${vendor.id}')" ${IS_ONLINE ? "" : "disabled"}>Restore Vendor</button>`
      : `<button class="btn btn-xs btn-success" onclick="TM.recordVendorPayment('${vendor.id}')" ${IS_ONLINE ? "" : "disabled"}>Record Payment</button><button class="btn btn-xs btn-warn" onclick="TM.addVendorDeduction('${vendor.id}')" ${IS_ONLINE ? "" : "disabled"}>Add Deduction</button><button class="btn btn-xs btn-ghost" onclick="TM.viewVendorPaymentHistory('${vendor.id}')">View History</button><button class="btn btn-xs btn-ghost" onclick="TM.editPayVendor('${vendor.id}')">Edit Vendor</button><button class="btn btn-xs btn-warn" onclick="TM.archivePayVendor('${vendor.id}')" ${IS_ONLINE ? "" : "disabled"}>Archive Vendor</button><button class="btn btn-xs btn-danger" onclick="TM.deletePayVendor('${vendor.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete Vendor</button>`;
    return `<article class="vendor-detail stack">
      <div class="row between"><strong>${esc(vendor.name)} Details ${vendor.archived ? `<span class="badge bd-gray">Archived</span>` : ""}</strong><div class="row">${actions}</div></div>
      <div class="hint lookup-grid"><span><b>Contact Person</b>${esc(vendor.contactPerson || "Not Set")}</span><span><b>Phone</b>${esc(vendor.phone || "Not Set")}</span><span><b>Email</b>${esc(vendor.email || "Not Set")}</span><span><b>WhatsApp Group</b>${vendor.hasWhatsappGroup ? esc(vendor.groupName || "Yes") : "No"}</span></div>
      <div class="vendor-total-row"><span>Total Deposits ${fmt$(totals.deposits)}</span><span>Total Fees ${fmt$(totals.fees)}</span><span>Paid Received ${fmt$(totals.paid)}</span><span>Deductions ${fmt$(totals.deductions)}</span><strong>Pending Amount ${fmt$(totals.pending)}</strong></div>
      <div class="tbl-wrap"><table><thead><tr><th>Method</th><th>Pay Tag</th><th>Fee Percentage</th><th>Deposits Received</th><th>Fee Amount</th><th>Gross Amount to Receive</th><th>Actions</th></tr></thead><tbody>
      ${(vendor.fees || []).map((fee) => {
        const deposits = vendorFeeDeposits(fee);
        const feeAmount = deposits * num(fee.fee) / 100;
        const editing = S.editVendorFeeId === fee.id;
        const actions = vendor.archived ? `<span class="badge bd-gray">Archived</span>` : editing ? `<button class="btn btn-xs btn-success" onclick="TM.saveVendorFeeEdit('${vendor.id}','${fee.id}')" ${IS_ONLINE ? "" : "disabled"}>Save</button><button class="btn btn-xs btn-ghost" onclick="TM.cancelVendorFeeEdit()">Cancel</button>` : `<button class="btn btn-xs btn-ghost" onclick="TM.editVendorFee('${fee.id}')">Edit</button><button class="btn btn-xs btn-danger" onclick="TM.deleteVendorFee('${vendor.id}','${fee.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete</button>`;
        return `<tr><td>${esc(DB.payMethods.find((method) => method.id === fee.payMethodId)?.name || "")}</td><td>${esc(fee.payTag)}</td><td>${editing && !vendor.archived ? `<input id="edit-fee-${fee.id}" type="number" value="${esc(fee.fee)}">` : `${fmtPlain(fee.fee)}%`}</td><td>${fmt$(deposits)}</td><td>${fmt$(feeAmount)}</td><td><strong>${fmt$(deposits - feeAmount)}</strong></td><td><div class="row">${actions}</div></td></tr>`;
      }).join("") || `<tr><td colspan="7" class="empty">No fee rows.</td></tr>`}
      </tbody></table></div>
      ${vendor.archived ? `<div class="notice warn">This vendor is archived. Restore it before adding or changing fee rows.</div>` : `<div class="grid c4">${selectInput(`vendor-method-${vendor.id}`, DB.payMethods.map((method) => [method.id, method.name]), DB.payMethods[0]?.id || "")}<input id="vendor-fee-${vendor.id}" type="number" placeholder="Fee percentage"><input id="vendor-tag-${vendor.id}" placeholder="Payment tag"><button class="btn btn-primary" onclick="TM.addVendorFee('${vendor.id}')" ${IS_ONLINE ? "" : "disabled"}>Add Fee Row</button></div>`}
    </article>`;
  }

  function renderGameVendorDetail(vendor) {
    const games = DB.games.filter((game) => game.gameVendorId === vendor.id);
    return `<article class="vendor-detail stack">
      <div class="row between"><strong>${esc(vendor.name)} Games</strong><div class="row"><button class="btn btn-xs btn-ghost" onclick="TM.editGameVendor('${vendor.id}')">Edit Vendor</button><button class="btn btn-xs btn-danger" onclick="TM.deleteGameVendor('${vendor.id}')" ${IS_ONLINE ? "" : "disabled"}>Delete Vendor</button></div></div>
      <div class="hint lookup-grid"><span><b>Contact Person</b>${esc(vendor.contactPerson || "Not Set")}</span><span><b>Phone</b>${esc(vendor.phone || "Not Set")}</span><span><b>Email</b>${esc(vendor.email || "Not Set")}</span><span><b>WhatsApp Group</b>${vendor.hasWhatsappGroup ? esc(vendor.groupName || "Yes") : "No"}</span></div>
      ${simpleTable(["Game", "Backend Loaded", "Current Balance", "Price / 1000"], games.map((game) => [esc(game.name), fmt$(game.backendLoaded), fmt$(gameBal(game.id)), fmt$(game.pricePer1k)]))}
    </article>`;
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
      <div class="fc full"><div class="fc-head">Sync Safety Status</div><div class="fg grid c4">
        <article class="kpi-card"><span>Connection</span><strong>${SUPABASE_READY ? "Ready" : "Needs Check"}</strong><small>${IS_ONLINE ? "Internet online" : "Internet offline"}</small></article>
        <article class="kpi-card"><span>Pending Queue</span><strong>${syncQueue.length}</strong><small>${syncBusy ? "Sync running" : "Waiting changes"}</small></article>
        <article class="kpi-card"><span>Current Entries</span><strong>${DB.entries.length}</strong><small>Open shift only</small></article>
        <article class="kpi-card"><span>Archived Shifts</span><strong>${DB.closedShifts.length}</strong><small>Closed history</small></article>
        <p class="muted full">${esc(lastSavedStatus || "No sync status yet.")}</p>
      </div></div>
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
    const theme = normalizeTheme(DB.theme);
    const custom = currentThemeValues();
    const savedName = theme.mode.startsWith("saved:") ? DB.savedThemes.find((item) => `saved:${item.id}` === theme.mode)?.name || "" : "";
    return `<section class="grid c2">
      <div class="fc full"><div class="fc-head">Theme and Appearance</div><div class="fg stack">
        <div class="grid c3">
          ${field("Theme Style", selectInput("theme-mode", themeOptions(), theme.mode, "TM.setThemeMode(this.value)"))}
          ${field("Custom Theme Name", `<input id="theme-name" value="${esc(savedName)}">`)}
          ${field("Primary Action Color", `<input type="color" value="${esc(custom.primary)}" id="theme-primary" oninput="TM.previewCustomTheme()">`)}
          ${field("Brand Accent Color", `<input type="color" value="${esc(custom.gold)}" id="theme-gold" oninput="TM.previewCustomTheme()">`)}
        </div>
        <div class="theme-custom-grid">
          ${themeColorField("Page Background", "theme-bg", custom.bg)}
          ${themeColorField("Card Background", "theme-panel", custom.panel)}
          ${themeColorField("Soft Background", "theme-panel-2", custom.panel2)}
          ${themeColorField("Input Background", "theme-input", custom.input)}
          ${themeColorField("Main Text", "theme-text", custom.text)}
          ${themeColorField("Muted Text", "theme-muted", custom.muted)}
          ${themeColorField("Secondary Accent", "theme-purple", custom.purple)}
          ${themeColorField("Success Color", "theme-green", custom.green)}
          ${themeColorField("Danger Color", "theme-red", custom.red)}
          ${themeColorField("Border Color", "theme-line", custom.line)}
          ${themeColorField("Logo Base Color", "theme-brand-a", custom.brandA)}
          ${themeColorField("Logo End Color", "theme-brand-b", custom.brandB)}
        </div>
        <div class="row end"><button class="btn btn-ghost" onclick="TM.resetCustomTheme()">Reset Custom Theme</button><button class="btn btn-primary" onclick="TM.saveTheme()">Save Theme</button><span id="theme-save-msg" class="success-text"></span></div>
      </div></div>
    </section>`;
  }

  function renderAdminBackup() {
    const gs = DB.googleSheets || {};
    return `<section class="grid c2">
      <div class="fc"><div class="fc-head">Export</div><div class="fg stack">
        <p class="muted">Total entries: ${allEntries().length}. Closed shifts: ${DB.closedShifts.length}.</p>
        <button class="btn btn-primary" onclick="TM.exportJson()">Export JSON Backup</button>
        <button class="btn btn-success" onclick="TM.exportTransactionsExcel()">Export Transactions Excel</button>
        <button class="btn btn-success" onclick="TM.exportEntries()">Export Entries Comma Separated Values</button>
      </div></div>
      <div class="fc"><div class="fc-head">Google Sheets Backup</div><div class="fg stack">
        <p><span class="online-pill"><i class="dot ${gs.enabled && IS_ONLINE ? "on" : ""}"></i>${gs.enabled ? "Append-only backup enabled" : "Backup disabled"}</span></p>
        ${field("Apps Script Web App URL", `<input id="gs-url" class="mono" value="${esc(gs.webAppUrl || "")}" placeholder="https://script.google.com/macros/s/.../exec">`)}
        ${field("Backup Token", `<input id="gs-token" class="mono" value="${esc(gs.token || "")}">`)}
        <div class="row"><button class="btn btn-primary" onclick="TM.testGoogleSheets()" ${IS_ONLINE ? "" : "disabled"}>Send Test Row</button><button class="btn btn-success" onclick="TM.saveGoogleSheets(true)">Save & Enable</button><button class="btn btn-danger" onclick="TM.saveGoogleSheets(false)">Disable</button></div>
        <button class="btn btn-purple" onclick="TM.syncCurrentToGoogleSheets()" ${IS_ONLINE && gs.enabled ? "" : "disabled"}>Sync Current Data to Google Sheets</button>
        <p class="muted">Pending sheet rows: ${(gs.pending || []).length}. ${esc(lastSheetStatus || "No Google Sheets backup status yet.")}</p>
      </div></div>
      <div class="fc"><div class="fc-head">Restore</div><div class="fg stack">
        <input type="file" accept="application/json" onchange="TM.loadRestoreFile(this.files[0])">
        <button class="btn btn-danger" onclick="TM.restoreBackup()" ${restoreFileText ? "" : "disabled"}>Restore Backup</button>
        <p class="muted">Restore overwrites all local and synced CRM data after confirmation.</p>
      </div></div>
    </section>`;
  }

  function renderAdminAudit() {
    const rows = (DB.auditLogs || []).slice(0, 300).map((log) => [
      esc(fmtDateTime(log.at)),
      esc(log.actor || "System"),
      esc(log.action),
      esc(log.target),
      esc(log.note || ""),
      `<details><summary>View</summary><pre class="audit-json">${esc(JSON.stringify({ before: log.before, after: log.after }, null, 2))}</pre></details>`
    ]);
    return `<section class="fc"><div class="fc-head">Audit Log</div><div class="fg stack">
      <p class="muted">Tracks sensitive edits, deletions, shift closes, top-ups, and corrections.</p>
      ${simpleTable(["Time", "User", "Action", "Target", "Note", "Details"], rows)}
    </div></section>`;
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
      ${field("Admin Name or Email", `<input id="admin-login-id" name="username" autocomplete="username" required autofocus>`)}
      ${field("Password / PIN", `<input id="admin-login-pin" name="current-password" type="password" autocomplete="current-password" required>`)}
      <div id="admin-login-error" class="danger-text" style="min-height:22px"></div>
    </form>`, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-primary" onclick="TM.loginAdmin()">Unlock Admin Dashboard</button>`);
  }

  function renderFirstAdminSetupModal() {
    return modalWrap("Create First Admin", `<form id="first-admin-form" class="stack" onsubmit="TM.createFirstAdmin(event)">
      <p class="muted">No admin user exists yet. Create the first Admin account, then use these credentials whenever you open Admin Dashboard.</p>
      <div class="grid c2">
        ${field("Full Name", `<input id="first-admin-name" required autofocus>`)}
        ${field("Email", `<input id="first-admin-email" name="username" type="email" required autocomplete="username">`)}
        ${field("Password / PIN", `<input id="first-admin-pin" name="new-password" type="password" autocomplete="new-password" required>`)}
        ${field("Confirm Password / PIN", `<input id="first-admin-confirm" name="confirm-password" type="password" autocomplete="new-password" required>`)}
      </div>
      <div id="first-admin-error" class="danger-text" style="min-height:22px"></div>
    </form>`, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-primary" onclick="TM.createFirstAdmin()" ${IS_ONLINE ? "" : "disabled"}>Create Admin</button>`);
  }

  function renderOverrideModal() {
    return modalWrap("Manager Approval Required", `<p class="muted">Promo exceeds 100% - enter the authorization code to proceed.</p><div class="stack" style="max-width:360px;margin:auto">${field("", `<input id="override-input" type="password" style="text-align:center;font-size:24px;font-family:var(--mono)" autocomplete="off">`)}<div id="override-error" class="danger-text" style="min-height:22px"></div></div>`, `<button class="btn btn-ghost" onclick="TM.cancelOverride()">Cancel</button><button class="btn btn-primary" onclick="TM.approveOverride()">Approve</button>`);
  }

  function renderCloseShiftModal() {
    const balances = S.modal.balances || {};
    const shiftName = S.modal.shiftName || DB.activeShiftName || getCurrentShiftName();
    const shift = shiftByName(shiftName);
    const closeType = isDayClosingShift(shiftName) ? "Day" : "Shift";
    const body = `<div class="notice warn"><strong>You are closing: ${esc(shiftName)} ${closeType}</strong><br><span>Date: ${esc(isoToLabel(S.modal.date || todayISO()))}${shift ? ` · Time: ${esc(shift.start)}-${esc(shift.end)}` : ""} · Current clock shift: ${esc(getCurrentShiftName())}</span></div><div class="close-shift-compact">${DB.games.map((game) => {
      const sys = gameBal(game.id);
      const val = balances[game.id] ?? "";
      const diff = val === "" ? "" : num(val) - sys;
      return `<div class="close-row">
        <strong>${esc(game.name)}</strong>
        <span>${fmt$(sys)}</span>
        <input id="close-${game.id}" type="number" step="1" value="${esc(val)}" oninput="TM.closeBalanceInput('${game.id}', this)" placeholder="Actual balance">
        <small id="diff-${game.id}" class="${Math.abs(diff) < .01 && val !== "" ? "success-text" : val === "" ? "subtle" : "danger-text"}">${val === "" ? "Waiting" : `Difference ${fmt$(diff)}`}</small>
      </div>`;
    }).join("")}</div>`;
    return modalWrap(`Close ${shiftName} ${closeType}`, body, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-warn" onclick="TM.confirmCloseShift()" ${IS_ONLINE ? "" : "disabled"}>Confirm & Close ${esc(shiftName)}</button>`);
  }

  function renderCheckoutModal() {
    const person = personById(S.modal.personId);
    const todayKey = S.modal.date || attendanceDateForPerson(person);
    const record = ensureAttendance(S.modal.personId, todayKey);
    const basePlayers = getBaseTotalPlayers(person?.name || "", todayKey);
    const auto = checkoutAutoReport(person, todayKey);
    const report = { ...auto, ...(record.report || {}) };
    const breakAllowed = num(person?.breakAllowedMins ?? 30);
    const breakMins = Math.min(currentBreakMinutes(record), breakAllowed);
    const totalPlayers = basePlayers + num(auto.newPlayers);
    const preview = buildWhatsAppReport(person, { ...report, ...auto, breakMins, totalPlayers }, todayKey);
    return modalWrap("Check Out", `<form id="checkout-form" class="stack" onsubmit="TM.submitCheckout(event)">
      <p class="muted">${esc(person?.name || "")} is checking out for ${esc(isoToLabel(todayKey))}.</p>
      <div class="grid c3">${REPORT_FIELDS.filter((fieldItem) => !["deposit", "newPlayers"].includes(fieldItem.key)).map((fieldItem) => field(fieldItem.label, `<input id="report-${fieldItem.key}" type="number" min="0" value="${esc(report[fieldItem.key] || "")}" oninput="TM.updateCheckoutPreview()">`)).join("")}${field("Break Minutes", `<input id="report-breakMins" type="number" min="0" max="${esc(breakAllowed)}" value="${esc(breakMins)}" readonly>`)}</div>
      <div class="grid c4">
        ${field("Deposit", `<input id="report-deposit" value="${esc(fmt$(auto.deposit))}" readonly>`)}
        ${field("New Players", `<input id="report-newPlayers" value="${esc(auto.newPlayers)}" readonly>`)}
        ${field("Total Deposit", `<input id="report-totalDeposit" value="${esc(fmt$(auto.totalDeposit))}" readonly>`)}
        ${field("Total Players", `<input id="report-totalPlayers" value="${esc(totalPlayers)}" readonly>`)}
      </div>
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
      ${field("Player ID", `<input id="edit-player-code" value="${esc(normalizePlayerCode(entry.playerCode))}" placeholder="PS-K7F2QA">`)}
      ${field("Player Name", `<input id="edit-player" value="${esc(entry.playerName)}">`)}
      ${field("Player Facebook Link", `<input id="edit-link" value="${esc(entry.playerUrl)}">`)}
      ${field("Game ID", `<input id="edit-gameid" value="${esc(entry.gameId)}">`)}
      ${field("Game Name", selectInput("edit-game", gameOptions(true), entry.gameName))}
      ${field("Deposit", `<input id="edit-deposit" type="number" step="0.01" value="${esc(entry.deposit || "")}">`)}
      ${field("Recharge", `<input id="edit-recharge" type="number" step="1" value="${esc(entry.recharge || "")}">`)}
      ${field("Freeplay Amount", `<input id="edit-fp" type="number" step="1" value="${esc(entry.fpAmount || "")}">`)}
      ${field("Redeem Credits", `<input id="edit-rd" type="number" step="1" value="${esc(entry.rdCredits || "")}">`)}
      ${field("Cashout Paid", `<input id="edit-cashout" type="number" step="0.01" value="${esc(entry.cashoutPaid || "")}">`)}
      ${field("Customer Tag or Email", `<input id="edit-cust" value="${esc(entry.custTag || "")}">`)}
      ${field("Player Legal Name", `<input id="edit-legal" value="${esc(entry.legalName || "")}">`)}
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
      ${field("Break Minutes", `<input id="correct-break" type="number" min="0" value="${esc(rec.breakMins || 0)}">`)}
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
    return modalWrap(staff ? "Edit Staff" : "Add Staff", `<form id="staff-form" class="stack" onsubmit="TM.saveStaff(event)">
      <div class="grid c2">
        ${field("Full Name", `<input id="staff-name" value="${esc(staff?.name || "")}" required>`)}
        ${field("Email", `<input id="staff-email" type="email" value="${esc(staff?.email || "")}" required>`)}
        ${field("Role", selectInput("staff-role", [["admin", "Admin"], ["manager", "Manager"], ["supervisor", "Supervisor"], ["agent", "Agent"]], role, "TM.staffRoleChanged(this.value)"))}
        <label id="staff-pin-wrap" style="${adminAccess ? "" : "display:none"}">PIN / Password<input id="staff-pin" type="password" autocomplete="new-password" value="${esc(staff?.pin || "")}" ${adminAccess ? "required" : ""}></label>
      ${field("Schedule", selectInput("staff-shift", [["", "No Schedule"], ...DB.shifts.map((shift) => [shift.id, `${shift.name} (${shift.start}-${shift.end})`])], staff?.shiftId || ""))}
        ${field("Staff Color", `<input id="staff-color" type="color" value="${esc(staff?.color || "#8796a3")}">`)}
        ${field("Monthly New Player Target", `<input id="staff-target-players" type="number" min="0" value="${esc(staff?.targets?.newPlayers || 0)}">`)}
        ${field("Monthly Sales Target", `<input id="staff-target-deposit" type="number" min="0" value="${esc(staff?.targets?.deposit || 0)}">`)}
        ${field("Break Allowed Minutes", `<input id="staff-break-allowed" type="number" min="0" value="${esc(staff?.breakAllowedMins ?? 30)}">`)}
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
    return modalWrap(agent ? "Edit Agent" : "Add Agent", `<form id="agent-form" class="grid c2" onsubmit="TM.saveAgent(event)">
      ${field("Full Name", `<input id="agent-name" value="${esc(agent?.name || "")}" required>`)}
      ${field("Role", selectInput("agent-role", agentRoleOptions(), agent?.role || DB.agentRoles[0] || "agent"))}
      ${field("Schedule", selectInput("agent-shift", DB.shifts.map((shift) => [shift.id, `${shift.name} (${shift.start}-${shift.end})`]), agent?.shiftId || DB.shifts[0]?.id || ""))}
      ${field("Agent Color", `<input id="agent-color" type="color" value="${esc(agent?.color || "#24d8ff")}">`)}
      ${field("Monthly New Player Target", `<input id="agent-target-players" type="number" min="0" value="${esc(agent?.targets?.newPlayers || 0)}">`)}
      ${field("Monthly Sales Target", `<input id="agent-target-deposit" type="number" min="0" value="${esc(agent?.targets?.deposit || 0)}">`)}
      ${field("Break Allowed Minutes", `<input id="agent-break-allowed" type="number" min="0" value="${esc(agent?.breakAllowedMins ?? 30)}">`)}
      <label class="pill"><input id="agent-attendance-required" type="checkbox" ${agent?.attendanceRequired === false ? "" : "checked"}> Attendance Required</label>
      <label class="pill"><input id="agent-show-deposits" type="checkbox" ${agent?.showInDeposits === false ? "" : "checked"}> Show Name in Sales Forms</label>
    </form>`, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-primary" onclick="TM.saveAgent()" ${IS_ONLINE ? "" : "disabled"}>Save Agent</button>`);
  }

  function renderAddGameModal() {
    return modalWrap("Add Game", `<form id="game-form" class="grid c2" onsubmit="TM.saveNewGame(event)">
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
    const titles = { addShift: "Add Shift", payMethod: "Add Payment Method", payVendor: "Add Payment Vendor", gameVendor: "Add Game Vendor", editPayVendor: "Edit Payment Vendor", editGameVendor: "Edit Game Vendor" };
    let body = "";
    let action = "";
    if (type === "addShift") {
      body = `<form id="simple-form" class="grid c3" onsubmit="TM.saveShift(event)">${field("Name", `<input id="shift-name" required>`)}${field("Start Time", selectInput("shift-start", timeOptions(), "08:00", "", "required"))}${field("End Time", selectInput("shift-end", timeOptions(), "20:00", "", "required"))}</form>`;
      action = "TM.saveShift()";
    } else if (type === "payMethod") {
      body = `<form id="simple-form" onsubmit="TM.savePayMethod(event)">${field("Payment Method Name", `<input id="pay-method-name" required>`)}</form>`;
      action = "TM.savePayMethod()";
    } else if (type === "payVendor") {
      body = `<form id="simple-form" class="grid c2" onsubmit="TM.savePayVendor(event)">${field("Vendor Name", `<input id="pay-vendor-name" required>`)}${field("Contact Person", `<input id="pay-vendor-contact" placeholder="Person you contact">`)}${field("Contact Number", `<input id="pay-vendor-phone" placeholder="Phone number">`)}${field("Email", `<input id="pay-vendor-email" type="email" placeholder="Email address">`)}${field("WhatsApp Group", selectInput("pay-vendor-whatsapp", [["no", "No"], ["yes", "Yes"]], "no", "TM.vendorGroupToggle('pay')"))}${field("Group Name", `<input id="pay-vendor-group" placeholder="Group name" disabled>`)}</form>`;
      action = "TM.savePayVendor()";
    } else if (type === "editPayVendor") {
      const vendor = DB.payVendors.find((item) => item.id === S.modal.vendorId);
      body = vendor ? `<form id="simple-form" class="grid c2" onsubmit="TM.savePayVendorEdit(event)">${field("Vendor Name", `<input id="pay-vendor-name" value="${esc(vendor.name)}" required>`)}${field("Contact Person", `<input id="pay-vendor-contact" value="${esc(vendor.contactPerson || "")}" placeholder="Person you contact">`)}${field("Contact Number", `<input id="pay-vendor-phone" value="${esc(vendor.phone || "")}" placeholder="Phone number">`)}${field("Email", `<input id="pay-vendor-email" type="email" value="${esc(vendor.email || "")}" placeholder="Email address">`)}${field("WhatsApp Group", selectInput("pay-vendor-whatsapp", [["no", "No"], ["yes", "Yes"]], vendor.hasWhatsappGroup ? "yes" : "no", "TM.vendorGroupToggle('pay')"))}${field("Group Name", `<input id="pay-vendor-group" value="${esc(vendor.groupName || "")}" placeholder="Group name" ${vendor.hasWhatsappGroup ? "" : "disabled"}>`)}</form>` : `<div class="empty">Vendor not found.</div>`;
      action = "TM.savePayVendorEdit()";
    } else if (type === "gameVendor") {
      body = `<form id="simple-form" class="grid c2" onsubmit="TM.addGameVendor(event)">${field("Vendor Name", `<input id="game-vendor-name" required>`)}${field("Contact Person", `<input id="game-vendor-contact" placeholder="Person you contact">`)}${field("Contact Number", `<input id="game-vendor-phone" placeholder="Phone number">`)}${field("Email", `<input id="game-vendor-email" type="email" placeholder="Email address">`)}${field("WhatsApp Group", selectInput("game-vendor-whatsapp", [["no", "No"], ["yes", "Yes"]], "no", "TM.vendorGroupToggle('game')"))}${field("Group Name", `<input id="game-vendor-group" placeholder="Group name" disabled>`)}</form>`;
      action = "TM.addGameVendor()";
    } else if (type === "editGameVendor") {
      const vendor = DB.gameVendors.find((item) => item.id === S.modal.vendorId);
      body = vendor ? `<form id="simple-form" class="grid c2" onsubmit="TM.saveGameVendorEdit(event)">${field("Vendor Name", `<input id="game-vendor-name" value="${esc(vendor.name)}" required>`)}${field("Contact Person", `<input id="game-vendor-contact" value="${esc(vendor.contactPerson || "")}" placeholder="Person you contact">`)}${field("Contact Number", `<input id="game-vendor-phone" value="${esc(vendor.phone || "")}" placeholder="Phone number">`)}${field("Email", `<input id="game-vendor-email" type="email" value="${esc(vendor.email || "")}" placeholder="Email address">`)}${field("WhatsApp Group", selectInput("game-vendor-whatsapp", [["no", "No"], ["yes", "Yes"]], vendor.hasWhatsappGroup ? "yes" : "no", "TM.vendorGroupToggle('game')"))}${field("Group Name", `<input id="game-vendor-group" value="${esc(vendor.groupName || "")}" placeholder="Group name" ${vendor.hasWhatsappGroup ? "" : "disabled"}>`)}</form>` : `<div class="empty">Vendor not found.</div>`;
      action = "TM.saveGameVendorEdit()";
    } else if (type === "pageName") {
      const page = S.modal.pageId ? DB.pageNames.find((item) => item.id === S.modal.pageId) : null;
      body = `<form id="simple-form" class="grid c3" onsubmit="TM.savePageName(event)">${field("Page Name", `<input id="page-name" value="${esc(page?.name || "")}" required>`)}${field("Page Link", `<input id="page-link" value="${esc(page?.link || "")}" placeholder="https://facebook.com/...">`)}${field("Access Given To", `<input id="page-access" value="${esc(page?.accessTo || "")}" placeholder="Names or team">`)}</form>`;
      action = "TM.savePageName()";
    }
    const title = type === "pageName" ? (S.modal.pageId ? "Edit Page Name" : "Add Page Name") : (titles[type] || "Modal");
    return modalWrap(title, body, `<button class="btn btn-ghost" onclick="TM.closeModal()">Cancel</button><button class="btn btn-primary" onclick="${action}" ${IS_ONLINE ? "" : "disabled"}>Save</button>`);
  }

  function adminCandidates() {
    return DB.staff.filter((staff) => {
      const perms = staff.perms || [];
      const hasAdminPerm = Object.values(ADMIN_SECTION_PERMS).some((perm) => perms.includes(perm));
      return staff.role !== "agent" && !!staff.adminAccess && !!staff.pin && hasAdminPerm;
    });
  }

  function currentAdminUser() {
    return DB.staff.find((staff) => staff.id === S.adminUserId);
  }

  function canManageStaffAccess() {
    const user = currentAdminUser();
    return !user || ["owner", "admin"].includes(user.role);
  }

  function openAdminGate() {
    if (isAgentPortal()) {
      S.page = isShiftOpen() ? "shift" : "closed";
      render();
      return;
    }
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
    saveAdminSession();
    render();
  }

  async function createFirstAdmin(event) {
    event?.preventDefault();
    if (!IS_ONLINE) return alert("No internet connection. Admin setup must be saved to Supabase.");
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
    const saved = await sbPush();
    if (!saved) {
      DB.staff = DB.staff.filter((item) => item.id !== staff.id);
      if (error) error.textContent = "Could not save admin to Supabase. Check the Supabase URL, API key, internet connection, and SQL setup.";
      return;
    }
    S.adminAuthed = true;
    S.adminUserId = staff.id;
    S.modal = null;
    S.page = "admin";
    saveAdminSession();
    render();
  }

  function lockAdmin() {
    S.adminAuthed = false;
    S.adminUserId = "";
    saveAdminSession();
    S.page = isAdminPortal() ? "admin" : "shift";
    if (isAdminPortal()) S.modal = { type: adminCandidates().length ? "adminLogin" : "adminSetup" };
    render();
  }

  function setPage(page) {
    if (isAgentPortal() && page === "admin") return;
    if (isAdminPortal() && page !== "admin") page = "admin";
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
    if (section === "shifts" || section === "agents") section = "team";
    if (section === "payMethods") section = "vendors";
    if (!canAdminSection(section)) section = "dashboard";
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

  function fillCommonFromPlayer(form, entry) {
    form.playerCode = normalizePlayerCode(entry.playerCode);
    form.playerName = cleanLegacyText(entry.playerName);
    form.playerUrl = cleanLegacyText(entry.playerUrl);
    form.gameId = cleanLegacyText(entry.gameId);
    form.gameName = cleanLegacyText(entry.gameName);
    form.salesName = "";
    form.legalName = "";
    form.contact = "";
    form.email = "";
  }

  function playerLookupError(code) {
    alert(`No player found for ${normalizePlayerCode(code) || "that code"}.`);
  }

  function fillPaidFromCode() {
    const entry = lastEntryForPlayerCode(S.pf.playerCode);
    if (!entry) return playerLookupError(S.pf.playerCode);
    fillCommonFromPlayer(S.pf, entry);
    S.pf.deposit = "";
    S.pf.recharge = "";
    S.pf.promo = "0.00";
    S.pf.promoP = "0.00";
    S.pf.custTag = entry.type === "paid" ? cleanLegacyText(entry.custTag) : "";
    S.pf.payMethodId = entry.payMethodId || "";
    S.pf.payTagId = entry.payTagId || "";
    S.pf.payTagLabel = entry.payTagLabel || "";
    S.pf.depositOnPage = !!entry.depositOnPage;
    S.pf.pageName = entry.pageName || "";
    S.pf.huntingProfile = entry.huntingProfile || "";
    render();
  }

  function fillFreeplayFromCode() {
    const entry = lastEntryForPlayerCode(S.ff.playerCode);
    if (!entry) return playerLookupError(S.ff.playerCode);
    fillCommonFromPlayer(S.ff, entry);
    S.ff.fpAmount = "";
    render();
  }

  function fillRedeemFromCode() {
    const entry = lastEntryForPlayerCode(S.rf.playerCode);
    if (!entry) return playerLookupError(S.rf.playerCode);
    S.rf.playerCode = normalizePlayerCode(entry.playerCode);
    S.rf.gameId = entry.gameId || "";
    S.rf.gameName = entry.gameName || "";
    S.rf.rdCredits = "";
    S.rf.cashoutPaid = "";
    render();
  }

  function setPaidMethod(value) {
    S.pf.payMethodId = value;
    S.pf.payTagId = "";
    S.pf.payTagLabel = "";
    refreshPaidTagSelect();
  }

  function setPaidTag(value) {
    S.pf.payTagId = value;
    S.pf.payTagLabel = tagsFor(S.pf.payMethodId).find((tag) => tag.id === value)?.tag || "";
  }

  function refreshPaidTagSelect() {
    const select = document.getElementById("paid-tag");
    if (!select) return;
    const options = [["", "Select Payment Tag"], ...tagsFor(S.pf.payMethodId).map((item) => [item.id, item.tag])];
    select.innerHTML = options.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join("");
    select.value = S.pf.payTagId || "";
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

  function toggleFreeplayDepositOnPage(value) {
    S.ff.depositOnPage = value;
    const page = document.getElementById("free-page");
    const hunting = document.getElementById("free-hunting");
    const yes = page?.closest(".form-grid")?.querySelector(".t-yes");
    const no = page?.closest(".form-grid")?.querySelector(".t-no");
    if (yes) yes.classList.toggle("active", value);
    if (no) no.classList.toggle("active", !value);
    if (page) {
      page.disabled = !value;
      if (!value) page.value = "";
      else page.value = S.ff.pageName || "";
      S.ff.pageName = page.value;
    }
    if (hunting) {
      hunting.disabled = value;
      if (value) {
        hunting.value = "";
        S.ff.huntingProfile = "";
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
      playerCode: normalizePlayerCode(f.playerCode),
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
    if (!isWholeNumber(entry.recharge)) return { message: "Recharge credits must be a whole number. Deposit can be decimal, but backend credits cannot.", ids: ["paid-recharge"] };
    return null;
  }

  function creditDebitAmount(entry) {
    if (entry.type === "paid") return num(entry.recharge);
    if (entry.type === "freeplay" || entry.type === "referral") return num(entry.fpAmount);
    return 0;
  }

  function projectedGameBalanceForEdit(entry, before) {
    const game = findGameForEntry(entry);
    if (!game) return { game: null, balance: 0 };
    const beforeSameGame = before && (before.gameId === game.id || before.gameName === game.name);
    const restored = beforeSameGame ? creditDebitAmount(before) : 0;
    return { game, balance: gameBal(game.id) + restored - creditDebitAmount(entry) };
  }

  function validateEntryEditBalance(entry, before) {
    const wholeErr = validateGameCreditEntry({ ...entry, gameId: "", gameName: "", recharge: 0, fpAmount: 0 });
    if (wholeErr && entry.type === "redeem") return wholeErr;
    if (!["paid", "freeplay", "referral"].includes(entry.type)) return null;
    if (!isWholeNumber(creditDebitAmount(entry))) return { message: "Game credits must be a whole number.", ids: [] };
    const { game, balance } = projectedGameBalanceForEdit(entry, before);
    if (!game) return { message: "Select a valid configured game before saving credits.", ids: [] };
    if (balance < 0) return { message: `${game.name} would become negative after this edit. Current/edit balance would be ${fmtPlain(balance)} credits.`, ids: [] };
    return null;
  }

  function validateGameCreditEntry(entry) {
    const ids = {
      paid: "paid-recharge",
      freeplay: "free-amount",
      referral: "ref-coins",
      redeem: "redeem-credits"
    };
    if (["paid", "freeplay", "referral"].includes(entry.type) && !isWholeNumber(creditDebitAmount(entry))) {
      return { message: "Game credits must be a whole number. Backend balances cannot use decimals.", ids: [ids[entry.type]] };
    }
    if (entry.type === "redeem" && !isWholeNumber(entry.rdCredits)) {
      return { message: "Redeem credits must be a whole number.", ids: ["redeem-credits"] };
    }
    const debit = creditDebitAmount(entry);
    if (debit <= 0) return null;
    const game = findGameForEntry(entry);
    const balance = game ? gameBal(game.id) : 0;
    if (!game) return { message: "Select a valid configured game before issuing credits.", ids: [ids[entry.type] || ""] };
    if (balance < debit) return { message: `${game.name} has ${fmtPlain(balance)} credits available. You cannot issue ${fmtPlain(debit)} credits because game balance cannot go negative.`, ids: [ids[entry.type]] };
    return null;
  }

  function submitPaid(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!requirePerm("Add Paid Recharge")) return;
    if (!checkShiftOpen()) return;
    const entry = buildPaidEntry();
    const err = validatePaid(entry);
    if (err) return showFieldErrors(err.ids, err.message);
    const creditErr = validateGameCreditEntry(entry);
    if (creditErr) return showFieldErrors(creditErr.ids, creditErr.message);
    if (entry.promoP > 100) {
      S._pendingEntry = entry;
      S.modal = { type: "override" };
      render();
      setTimeout(() => document.getElementById("override-input")?.focus(), 0);
      return;
    }
    if (saveEntry(entry)) clearPaid();
  }

  function saveEntry(entry) {
    if (!isShiftOpen()) {
      alert("Start the current shift before adding entries.");
      return false;
    }
    const creditErr = validateGameCreditEntry(entry);
    if (creditErr) {
      showFieldErrors(creditErr.ids, creditErr.message);
      return false;
    }
    ensurePlayerCode(entry);
    if (entry.referredByCode && !entry.referralForCode) entry.referralForCode = entry.playerCode;
    entry.shift = entry.shift || activeShiftName();
    entry.shiftSession = `${entry.shift} - ${isoToLabel(entry.date)}`;
    DB.entries.unshift(entry);
    saveDB();
    syncEntry(entry);
    render();
    return true;
  }

  function clearPaid() {
    S.pf = newPF();
    render();
  }

  function submitFreeplay(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!requirePerm("Add Freeplay")) return;
    if (!checkShiftOpen()) return;
    const f = S.ff;
    const missing = [];
    if (!f.date) missing.push("free-date");
    if (!f.shift) missing.push("free-shift");
    if (!f.agent) missing.push("free-agent");
    if (!f.playerName.trim()) missing.push("free-player");
    if (!f.fpAmount || num(f.fpAmount) <= 0) missing.push("free-amount");
    if (!f.playerUrl.trim()) missing.push("free-link");
    if (!f.gameName) missing.push("free-game");
    if (!f.gameId.trim()) missing.push("free-gameid");
    if (f.depositOnPage && !f.pageName) missing.push("free-page");
    if (!f.depositOnPage && !f.huntingProfile) missing.push("free-hunting");
    if (missing.length) return showFieldErrors(missing, "Please complete the highlighted freeplay fields.");
    if (!isUrl(f.playerUrl)) return showFieldErrors(["free-link"], "Player Facebook Link must be a valid full link.");
    const entry = {
      id: uid("entry"),
      type: "freeplay",
      date: f.date,
      shift: f.shift || activeShiftName(),
      shiftSession: "Current",
      agent: f.agent,
      playerName: f.playerName.trim(),
      playerUrl: f.playerUrl.trim(),
      playerCode: normalizePlayerCode(f.playerCode),
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
      depositOnPage: !!f.depositOnPage,
      pageName: f.pageName,
      huntingProfile: f.huntingProfile.trim(),
      legalName: f.legalName.trim(),
      contact: f.contact.trim(),
      email: f.email.trim(),
      salesName: f.salesName,
      createdAt: new Date().toISOString()
    };
    if (saveEntry(entry)) clearFreeplay();
  }

  function clearFreeplay() {
    S.ff = newFF();
    render();
  }

  function submitRedeem(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!requirePerm("Add Redeem")) return;
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
    const paid = f.playerCode ? lastEntryForPlayerCode(f.playerCode) : allEntries().filter((entry) => entry.type === "paid" && entry.gameId === f.gameId.trim()).sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)))[0];
    const entry = {
      id: uid("entry"),
      type: "redeem",
      date: f.date,
      shift: f.shift || activeShiftName(),
      shiftSession: "Current",
      agent: f.agent,
      playerName: paid?.playerName || "",
      playerUrl: paid?.playerUrl || "",
      playerCode: normalizePlayerCode(f.playerCode || paid?.playerCode),
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
    if (saveEntry(entry)) clearRedeem();
  }

  function clearRedeem() {
    S.rf = newRF();
    render();
  }

  function submitReferralBonus(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!requirePerm("Add Freeplay")) return;
    if (!checkShiftOpen()) return;
    const f = S.referral;
    const missing = [];
    if (!f.date) missing.push("ref-date");
    if (!f.shift) missing.push("ref-shift");
    if (!f.agent) missing.push("ref-agent");
    if (f.referrerType === "customer" && !normalizePlayerCode(f.referredByCode)) missing.push("ref-by-code");
    if (f.referrerType === "external" && !f.referrerName.trim()) missing.push("ref-name");
    if (!normalizePlayerCode(f.referredPlayerCode)) missing.push("ref-player-code");
    if (!f.gameId.trim()) missing.push("ref-gameid");
    if (!f.gameName) missing.push("ref-game");
    if (num(f.coins) <= 0) missing.push("ref-coins");
    if (missing.length) return showFieldErrors(missing, "Please complete the highlighted referral bonus fields.");
    const referringPlayer = lastEntryForPlayerCode(f.referredByCode);
    const isCustomer = f.referrerType === "customer";
    const entry = {
      id: uid("entry"),
      type: "referral",
      date: f.date,
      shift: f.shift || activeShiftName(),
      shiftSession: "Current",
      agent: f.agent,
      playerName: isCustomer ? referringPlayer?.playerName || "" : f.referrerName.trim(),
      playerUrl: isCustomer ? referringPlayer?.playerUrl || "" : f.referrerContact.trim(),
      playerCode: isCustomer ? normalizePlayerCode(f.referredByCode) : "",
      gameId: f.gameId.trim(),
      gameName: f.gameName,
      deposit: 0,
      recharge: 0,
      promo: 0,
      promoP: 0,
      fpAmount: num(f.coins),
      rdCredits: 0,
      cashoutPaid: 0,
      isNewPlayer: false,
      custTag: "",
      payMethodId: "",
      legalName: isCustomer ? referringPlayer?.legalName || "" : "",
      contact: isCustomer ? referringPlayer?.contact || "" : f.referrerContact.trim(),
      email: referringPlayer?.email || "",
      referralForCode: normalizePlayerCode(f.referredPlayerCode),
      referredByCode: isCustomer ? normalizePlayerCode(f.referredByCode) : "",
      referralBonusType: "credits",
      referralBonusAmount: num(f.coins),
      referralBonusPercent: 0,
      referralNote: f.note.trim(),
      createdAt: new Date().toISOString()
    };
    if (saveEntry(entry)) clearReferralBonus();
  }

  function clearReferralBonus() {
    S.referral = newReferralForm();
    S.referral.agent = salesPeople()[0]?.name || "";
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
      if (saveEntry(entry)) S.pf = newPF();
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
    const dateKey = attendanceDateForPerson(person);
    const record = ensureAttendance(personId, dateKey);
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

  function currentBreakMinutes(record) {
    return num(record?.breakMins) + (record?.breakStartAt ? minutesBetween(record.breakStartAt, new Date().toISOString()) : 0);
  }

  function breakTimeLeft(person, record) {
    return Math.max(0, num(person?.breakAllowedMins ?? 30) - currentBreakMinutes(record));
  }

  function toggleBreak(personId) {
    if (!checkOnline()) return;
    const person = personById(personId);
    const dateKey = attendanceDateForPerson(person);
    const record = ensureAttendance(personId, dateKey);
    if (!record.checkInAt || record.checkOutAt) return;
    if (record.breakStartAt) {
      record.breakMins = Math.min(num(person?.breakAllowedMins ?? 30), currentBreakMinutes(record));
      record.breakStartAt = "";
    } else {
      if (breakTimeLeft(person, record) <= 0) return alert("No break time left for this shift.");
      if (!confirm(`Start break for ${person?.name || "this employee"}?`)) return;
      record.breakStartAt = new Date().toISOString();
    }
    saveDB();
    syncAttendance(record);
    render();
  }

  function markLeave(personId) {
    if (!checkOnline()) return;
    const person = personById(personId);
    const reason = prompt("Leave reason");
    if (!reason) return;
    const dateKey = attendanceDateForPerson(person);
    const record = ensureAttendance(personId, dateKey);
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
    S.modal = { type: "checkout", personId, date: attendanceDateForPerson(personById(personId)) };
    render();
  }

  function getBaseTotalPlayers(agentName, dateKey) {
    return allEntries().filter((entry) => entry.agent === agentName && entry.isNewPlayer && entry.date < dateKey).length;
  }

  function checkoutAutoReport(person, dateKey) {
    const rows = allEntries().filter((entry) => entry.agent === person?.name && entry.date === dateKey);
    const deposit = rows.filter((entry) => entry.type === "paid").reduce((sum, entry) => sum + num(entry.deposit), 0);
    const newPlayers = rows.filter((entry) => entry.isNewPlayer).length;
    return {
      deposit,
      totalDeposit: deposit,
      newPlayers
    };
  }

  function updateCheckoutPreview() {
    const dateKey = S.modal.date || attendanceDateForPerson(personById(S.modal.personId));
    const person = personById(S.modal.personId);
    const auto = checkoutAutoReport(person, dateKey);
    const totalPlayers = getBaseTotalPlayers(person?.name || "", dateKey) + num(auto.newPlayers);
    const totalEl = document.getElementById("report-totalPlayers");
    if (totalEl) totalEl.value = totalPlayers;
    const report = {};
    REPORT_FIELDS.filter((fieldItem) => !["deposit", "newPlayers"].includes(fieldItem.key)).forEach((fieldItem) => {
      report[fieldItem.key] = num(document.getElementById(`report-${fieldItem.key}`)?.value);
    });
    report.deposit = auto.deposit;
    report.totalDeposit = auto.totalDeposit;
    report.newPlayers = auto.newPlayers;
    report.totalPlayers = totalPlayers;
    report.breakMins = num(document.getElementById("report-breakMins")?.value);
    const preview = document.getElementById("checkout-preview");
    if (preview) preview.textContent = buildWhatsAppReport(person, report, dateKey);
  }

  function buildWhatsAppReport(person, report, dateKey) {
    return [
      `Panda Squad Daily Report`,
      `Date: ${isoToLabel(dateKey)}`,
      `Employee: ${person?.name || ""}`,
      `Hunting Messages Sent: ${fmtPlain(report.huntingMessagesSent || 0)}`,
      `Hunting Requests Sent: ${fmtPlain(report.huntingRequestsSent || 0)}`,
      `Posting on IDs: ${fmtPlain(report.postingOnIds || 0)}`,
      `Total IDs: ${fmtPlain(report.totalIds || 0)}`,
      `Deposit: ${fmt$(report.deposit || 0)}`,
      `New Players: ${fmtPlain(report.newPlayers || 0)}`,
      `Total Deposit: ${fmt$(report.totalDeposit || report.deposit || 0)}`,
      `Break Minutes: ${fmtPlain(report.breakMins || 0)}`,
      `Total Players: ${fmtPlain(report.totalPlayers || 0)}`
    ].join("\n");
  }

  function submitCheckout(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    const person = personById(S.modal.personId);
    const dateKey = S.modal.date || attendanceDateForPerson(person);
    const record = ensureAttendance(S.modal.personId, dateKey);
    const auto = checkoutAutoReport(person, dateKey);
    const report = {};
    REPORT_FIELDS.filter((fieldItem) => !["deposit", "newPlayers"].includes(fieldItem.key)).forEach((fieldItem) => {
      report[fieldItem.key] = num(document.getElementById(`report-${fieldItem.key}`)?.value);
    });
    report.deposit = auto.deposit;
    report.totalDeposit = auto.totalDeposit;
    report.newPlayers = auto.newPlayers;
    report.totalPlayers = getBaseTotalPlayers(person?.name || "", dateKey) + num(report.newPlayers);
    const breakAllowed = num(person?.breakAllowedMins ?? 30);
    const breakMins = Math.min(currentBreakMinutes(record), breakAllowed);
    report.breakMins = breakMins;
    record.checkOutAt = new Date().toISOString();
    record.checkOut = record.checkOutAt;
    record.breakMins = breakMins;
    record.breakStartAt = "";
    record.duration = Math.max(0, minutesBetween(record.checkInAt, record.checkOutAt) - breakMins);
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
    if (!confirmDelete("Delete this leave request permanently?")) return;
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
    if (!requirePerm("Close Shift")) return;
    if (!isShiftOpen()) {
      S.page = "closed";
      render();
      return;
    }
    S.modal = { type: "closeShift", balances: {}, shiftName: DB.activeShiftName || getCurrentShiftName(), date: todayISO() };
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
    const ok = isWholeNumber(input.value) && Math.abs(diff) < .01;
    input.style.borderColor = ok ? "var(--green)" : "var(--red)";
    if (diffEl) {
      diffEl.textContent = isWholeNumber(input.value) ? `Difference ${fmt$(diff)}` : "Closing balance must be a whole number.";
      diffEl.className = ok ? "success-text" : "danger-text";
    }
  }

  async function confirmCloseShift() {
    if (!checkOnline()) return;
    if (!requirePerm("Close Shift")) return;
    const bad = [];
    DB.games.forEach((game) => {
      const raw = S.modal.balances[game.id];
      if (raw === undefined || raw === "") bad.push(`${game.name}: missing balance`);
      else {
        if (!isWholeNumber(raw)) {
          bad.push(`${game.name}: balance must be a whole number`);
          return;
        }
        const diff = num(raw) - gameBal(game.id);
        if (Math.abs(diff) >= .01) bad.push(`${game.name}: difference ${fmt$(diff)}`);
      }
    });
    if (bad.length) return alert(`Cannot close shift until balances match:\n${bad.join("\n")}`);
    await closeCurrentShift("manual", { shiftName: S.modal.shiftName, date: S.modal.date });
  }

  async function closeCurrentShift(reason, options = {}) {
    if (!checkOnline()) return false;
    const closingDate = options.date || todayISO();
    const shiftName = options.shiftName || DB.activeShiftName || activeShiftName();
    const alreadyClosed = DB.closedShifts.some((shift) => shift.date === closingDate && shift.summary?.shiftName === shiftName);
    if (alreadyClosed && !options.force) {
      alert(`${shiftName} is already closed for ${isoToLabel(closingDate)}.`);
      S.modal = null;
      render();
      return false;
    }
    const closeType = isDayClosingShift(shiftName) ? "day" : "shift";
    const summary = { ...shiftKPIs(), durationMins: minutesBetween(DB.shiftStart, new Date().toISOString()) };
    const daySummary = { ...kpisForEntries(dayEntriesFor(closingDate)), closedShiftCount: DB.closedShifts.filter((shift) => shift.date === closingDate).length + 1 };
    const closed = {
      id: uid("closed"),
      label: `${shiftName} - ${isoToLabel(closingDate)} - ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      date: closingDate,
      closedAt: new Date().toISOString(),
      entries: clone(DB.entries),
      summary: { ...summary, shiftName, closeType, closeReason: reason || "manual", forced: !!options.force, daySummary },
      createdAt: new Date().toISOString()
    };
    DB.closedShifts.unshift(closed);
    audit("Close Shift", `${shiftName} ${closingDate}`, { entries: DB.entries, shiftStart: DB.shiftStart }, closed, reason || "manual");
    DB.entries = [];
    DB.shiftOpen = true;
    const clockShift = getCurrentShiftName();
    DB.activeShiftName = clockShift === shiftName ? nextShiftNameAfter(shiftName) : clockShift;
    DB.shiftStart = new Date().toISOString();
    S.pf = newPF();
    S.ff = newFF();
    S.rf = newRF();
    S.referral = newReferralForm();
    S.pf.agent = salesPeople()[0]?.name || "";
    S.ff.agent = salesPeople()[0]?.name || "";
    S.rf.agent = salesPeople()[0]?.name || "";
    S.referral.agent = salesPeople()[0]?.name || "";
    saveDB();
    await sbPush();
    queueSheetBatch("ClosedShifts", closedShiftColumns(), [closedShiftRow(closed)], "Close shift");
    queueGameBalanceBackup("Close shift", closed.id);
    S.modal = null;
    S.page = "shift";
    render();
    return true;
  }

  function startNewShift() {
    if (!requirePerm("Close Shift")) return;
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

  function adminSetActiveShift() {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const shiftName = document.getElementById("repair-active-shift")?.value || getCurrentShiftName();
    if (!shiftByName(shiftName)) return alert("Select a valid shift.");
    const before = { activeShiftName: DB.activeShiftName, shiftStart: DB.shiftStart, shiftOpen: DB.shiftOpen };
    DB.shiftOpen = true;
    DB.activeShiftName = shiftName;
    DB.shiftStart = new Date().toISOString();
    audit("Admin Set Active Shift", shiftName, before, { activeShiftName: DB.activeShiftName, shiftStart: DB.shiftStart, shiftOpen: DB.shiftOpen });
    saveDB();
    pushConfig();
    S.page = "shift";
    render();
  }

  async function adminForceCloseShift() {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const shiftName = document.getElementById("repair-close-shift")?.value || DB.activeShiftName || getCurrentShiftName();
    const date = parseDateInput(document.getElementById("repair-date")?.value);
    if (!shiftByName(shiftName)) return alert("Select a valid shift to force close.");
    if (!confirm(`Force close ${shiftName} for ${isoToLabel(date)}?\n\nThis bypasses duplicate-close protection and balance matching. Use only to repair a stuck shift.`)) return;
    await closeCurrentShift("admin force close", { shiftName, date, force: true });
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
    if (!requirePerm("Edit Entries")) return;
    const ref = entryRef(id);
    if (ref && !ref.current) return alert("Closed shift entries are locked. Add a correction entry instead of editing archived history.");
    S.modal = { type: "editEntry", entryId: id };
    render();
  }

  function saveEntryEdit() {
    if (!checkOnline()) return;
    if (!requirePerm("Edit Entries")) return;
    const ref = entryRef(S.modal.entryId);
    const entry = ref?.entry;
    if (!entry) return;
    if (!ref.current) return alert("Closed shift entries are locked. Add a correction entry instead of editing archived history.");
    const before = clone(entry);
    entry.type = document.getElementById("edit-type").value;
    entry.date = parseDateInput(document.getElementById("edit-date").value);
    entry.shift = document.getElementById("edit-shift").value;
    entry.shiftSession = `${entry.shift} - ${isoToLabel(entry.date)}`;
    entry.agent = document.getElementById("edit-agent").value;
    entry.playerName = document.getElementById("edit-player").value.trim();
    entry.playerUrl = document.getElementById("edit-link").value.trim();
    entry.playerCode = normalizePlayerCode(document.getElementById("edit-player-code").value);
    entry.gameId = document.getElementById("edit-gameid").value.trim();
    entry.gameName = document.getElementById("edit-game").value;
    entry.deposit = num(document.getElementById("edit-deposit").value);
    entry.recharge = num(document.getElementById("edit-recharge").value);
    entry.promo = entry.recharge - entry.deposit;
    entry.promoP = entry.deposit ? (entry.promo / entry.deposit) * 100 : 0;
    entry.fpAmount = num(document.getElementById("edit-fp").value);
    entry.rdCredits = num(document.getElementById("edit-rd").value);
    entry.cashoutPaid = num(document.getElementById("edit-cashout").value);
    if (!isWholeNumber(entry.recharge) || !isWholeNumber(entry.fpAmount) || !isWholeNumber(entry.rdCredits)) {
      return alert("Recharge, freeplay, and redeem credits must be whole numbers.");
    }
    const balanceErr = validateEntryEditBalance(entry, before);
    if (balanceErr) {
      Object.assign(entry, before);
      return alert(balanceErr.message);
    }
    entry.custTag = document.getElementById("edit-cust").value.trim();
    entry.legalName = document.getElementById("edit-legal").value.trim();
    entry.dispute = !!document.getElementById("edit-dispute")?.checked;
    entry.disputeNote = document.getElementById("edit-dispute-note")?.value.trim() || "";
    entry.isNewPlayer = [entry.salesName, entry.legalName, entry.contact, entry.email].some((value) => String(value || "").trim());
    ensurePlayerCode(entry);
    audit("Edit Entry", `${entry.type} ${entry.id}`, before, entry);
    saveDB();
    if (ref.current) syncEntry(entry);
    else void sbPush();
    S.modal = null;
    render();
  }

  function deleteEntry(id) {
    if (!checkOnline()) return;
    if (!requirePerm("Delete Entries")) return;
    if (!confirmDelete("Delete this entry?")) return;
    const ref = entryRef(id);
    if (ref && !ref.current) return alert("Closed shift entries are locked. Add a correction entry instead of deleting archived history.");
    const before = ref?.entry ? clone(ref.entry) : null;
    if (ref?.current) DB.entries = DB.entries.filter((entry) => entry.id !== id);
    else if (ref?.shift) ref.shift.entries = (ref.shift.entries || []).filter((entry) => entry.id !== id);
    audit("Delete Entry", id, before, null);
    saveDB();
    void sbPush();
    render();
  }

  function saveShift(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!requirePerm("Manage Agents")) return;
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
    if (!requirePerm("Manage Agents")) return;
    const isAssigned = combinedPeople().some((person) => person.shiftId === id || (person.shiftHistory || []).some((item) => item.shiftId === id));
    const hasAttendance = DB.attendance.some((record) => record.shiftId === id);
    if (isAssigned || hasAttendance) return alert("This shift is used by people or attendance history and cannot be deleted.");
    if (!confirmDelete("Delete this shift?")) return;
    DB.shifts = DB.shifts.filter((shift) => shift.id !== id);
    saveDB();
    pushConfig();
    render();
  }

  function normalizeAgentRole(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9 _-]/g, "").replace(/\s+/g, " ");
  }

  function addAgentRole() {
    if (!checkOnline()) return;
    const role = normalizeAgentRole(document.getElementById("new-agent-role")?.value);
    if (!role) return;
    DB.agentRoles = uniqueList([...(DB.agentRoles || []), role]);
    saveDB();
    pushConfig();
    render();
  }

  function deleteAgentRole(role) {
    if (!checkOnline()) return;
    role = normalizeAgentRole(role);
    if (DB.agents.some((agent) => normalizeAgentRole(agent.role) === role)) return alert("This role is assigned to agents and cannot be deleted.");
    if (!confirmDelete("Delete this role?")) return;
    DB.agentRoles = (DB.agentRoles || []).filter((item) => normalizeAgentRole(item) !== role);
    saveDB();
    pushConfig();
    render();
  }

  function saveAgent(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!requirePerm("Manage Agents")) return;
    const data = {
      name: document.getElementById("agent-name").value.trim(),
      role: normalizeAgentRole(document.getElementById("agent-role").value) || "agent",
      shiftId: document.getElementById("agent-shift").value,
      color: document.getElementById("agent-color").value,
      attendanceRequired: document.getElementById("agent-attendance-required").checked,
      showInDeposits: document.getElementById("agent-show-deposits").checked,
      breakAllowedMins: num(document.getElementById("agent-break-allowed").value),
      targets: {
        newPlayers: num(document.getElementById("agent-target-players").value),
        deposit: num(document.getElementById("agent-target-deposit").value)
      }
    };
    if (!data.name) return;
    const existing = DB.agents.find((agent) => agent.id === S.modal.agentId);
    if (existing) {
      if (existing.shiftId !== data.shiftId) {
        const effectiveDate = shiftEffectivePrompt(existing.name);
        if (!effectiveDate) return;
        existing.shiftHistory = existing.shiftHistory || [];
        if (!existing.shiftHistory.length && existing.shiftId) existing.shiftHistory.push({ date: "0000-01-01", shiftId: existing.shiftId, at: new Date().toISOString() });
        existing.shiftHistory.push({ date: effectiveDate, shiftId: data.shiftId, at: new Date().toISOString() });
      }
      Object.assign(existing, data);
    } else {
      DB.agents.push({ id: uid("agent"), ...data, shiftHistory: data.shiftId ? [{ date: todayISO(), shiftId: data.shiftId, at: new Date().toISOString() }] : [] });
    }
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
    if (!requirePerm("Manage Agents")) return;
    const hasEntries = allEntries().some((entry) => DB.agents.find((agent) => agent.id === id)?.name === entry.agent);
    if (hasEntries) return alert("This agent has transaction history and cannot be deleted.");
    if (!confirmDelete("Delete this agent and related attendance records?")) return;
    DB.agents = DB.agents.filter((agent) => agent.id !== id);
    DB.attendance = DB.attendance.filter((record) => record.agentId !== id);
    DB.leaveRequests = DB.leaveRequests.filter((request) => request.employeeId !== id);
    saveDB();
    pushConfig();
    render();
  }

  function saveStaff(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const role = document.getElementById("staff-role").value;
    const adminAccess = role !== "agent" && !!document.getElementById("staff-admin-access")?.checked;
    const selectedPerms = [...document.querySelectorAll(".perm-check:checked")].map((input) => input.value);
    const perms = adminAccess ? cleanPerms(selectedPerms) : staffPermsForRole(role, false);
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
      breakAllowedMins: num(document.getElementById("staff-break-allowed").value),
      targets: {
        newPlayers: num(document.getElementById("staff-target-players").value),
        deposit: num(document.getElementById("staff-target-deposit").value)
      },
      perms
    };
    if (!data.name || !data.email || (adminAccess && !data.pin)) return;
    const existing = DB.staff.find((staff) => staff.id === S.modal.staffId);
    if (existing) {
      if (existing.shiftId !== data.shiftId) {
        const effectiveDate = shiftEffectivePrompt(existing.name);
        if (!effectiveDate) return;
        existing.shiftHistory = existing.shiftHistory || [];
        if (!existing.shiftHistory.length && existing.shiftId) existing.shiftHistory.push({ date: "0000-01-01", shiftId: existing.shiftId, at: new Date().toISOString() });
        existing.shiftHistory.push({ date: effectiveDate, shiftId: data.shiftId, at: new Date().toISOString() });
      }
      Object.assign(existing, data);
    } else {
      DB.staff.push({ id: uid("staff"), ...data, shiftHistory: data.shiftId ? [{ date: todayISO(), shiftId: data.shiftId, at: new Date().toISOString() }] : [] });
    }
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
    const staff = DB.staff.find((item) => item.id === id);
    if (staff && allEntries().some((entry) => entry.agent === staff.name)) return alert("This staff member has transaction history and cannot be deleted.");
    if (!confirmDelete("Delete this staff member?")) return;
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
    const adminAccess = role !== "agent" && staffDefaultAdminAccess(role);
    if (adminRow) adminRow.style.display = role === "agent" ? "none" : "";
    if (adminBox) adminBox.checked = role !== "agent" && adminAccess;
    if (adminPanel) adminPanel.style.display = adminAccess ? "" : "none";
    if (pinWrap) pinWrap.style.display = adminAccess ? "" : "none";
    const pin = document.getElementById("staff-pin");
    if (pin) pin.required = adminAccess;
    document.querySelectorAll(".perm-check").forEach((input) => { input.checked = adminAccess && staffPermsForRole(role, adminAccess).includes(input.value); });
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
    if (!adminAccess) {
      document.querySelectorAll(".perm-check").forEach((input) => { input.checked = false; });
    }
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

  function saveNewGame(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const name = document.getElementById("game-name").value.trim();
    if (!name) return;
    const game = {
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
    };
    DB.games.push(game);
    audit("Add Game", game.name, null, game);
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
    if (!requirePerm("Manage Settings")) return;
    const game = DB.games.find((item) => item.id === id);
    if (!game) return;
    const before = clone(game);
    game.name = document.getElementById("eg-name").value.trim() || game.name;
    game.gameVendorId = document.getElementById("eg-vendor").value;
    game.pricePer1k = num(document.getElementById("eg-price").value);
    game.backendLink = document.getElementById("eg-backend").value.trim();
    game.playerLink = document.getElementById("eg-player").value.trim();
    game.username = document.getElementById("eg-user").value.trim();
    game.password = document.getElementById("eg-pass").value.trim();
    audit("Edit Game", game.name, before, game);
    S.editGameId = null;
    saveDB();
    pushConfig();
    render();
  }

  function topUpGame(id) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const game = DB.games.find((item) => item.id === id);
    if (!game) return;
    const before = clone(game);
    const amountInput = prompt("Amount being ADDED to backend");
    const amount = num(amountInput);
    if (!amount) return;
    if (!isWholeNumber(amount)) return alert("Backend top-up credits must be a whole number.");
    game.backendLoaded = num(game.backendLoaded) + amount;
    game.reloadHistory = game.reloadHistory || [];
    game.reloadHistory.unshift({ date: todayISO(), amount, at: new Date().toISOString() });
    audit("Top-up Game", game.name, before, game, `Added ${fmtPlain(amount)} credits`);
    saveDB();
    pushConfig();
    queueGameBalanceBackup("Game top-up", game.id, game.id);
    render();
  }

  function deleteGame(id) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const game = DB.games.find((item) => item.id === id);
    if (game && allEntries().some((entry) => entry.gameId === id || entry.gameName === game.name)) return alert("This game has transaction history and cannot be deleted.");
    if (!confirmDelete("Delete this game?")) return;
    audit("Delete Game", game?.name || id, game, null);
    DB.games = DB.games.filter((game) => game.id !== id);
    saveDB();
    pushConfig();
    render();
  }

  function savePayMethod(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
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

  function vendorHasLedger(vendor) {
    const totals = vendorTotals(vendor);
    return totals.deposits > 0 || (vendor.payments || []).length > 0 || (vendor.deductions || []).length > 0;
  }

  function linkedVendorTagIds(vendor) {
    return new Set((vendor?.fees || []).map((fee) => {
      if (fee.tagId) return fee.tagId;
      const method = DB.payMethods.find((item) => item.id === fee.payMethodId);
      return method?.tags.find((tag) => String(tag.tag || "").toLowerCase() === String(fee.payTag || "").toLowerCase())?.id || "";
    }).filter(Boolean));
  }

  function otherVendorUsesTag(vendorId, tagId) {
    return DB.payVendors.some((vendor) => vendor.id !== vendorId && (vendor.fees || []).some((fee) => {
      if (fee.tagId === tagId) return true;
      const method = DB.payMethods.find((item) => item.id === fee.payMethodId);
      const tag = method?.tags.find((item) => item.id === tagId);
      return tag && String(tag.tag || "").toLowerCase() === String(fee.payTag || "").toLowerCase();
    }));
  }

  function setVendorTagsArchived(vendor, archived) {
    const ids = linkedVendorTagIds(vendor);
    DB.payMethods.forEach((method) => {
      method.tags.forEach((tag) => {
        if (!ids.has(tag.id) || otherVendorUsesTag(vendor.id, tag.id)) return;
        tag.active = !archived;
        tag.archivedAt = archived ? new Date().toISOString() : "";
      });
    });
  }

  function deleteVendorTags(vendor) {
    const ids = linkedVendorTagIds(vendor);
    DB.payMethods.forEach((method) => {
      method.tags = method.tags.filter((tag) => !ids.has(tag.id) || otherVendorUsesTag(vendor.id, tag.id));
    });
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
    if (!confirmDelete("Delete this payment tag?")) return;
    const method = DB.payMethods.find((item) => item.id === methodId);
    if (!method) return;
    method.tags = method.tags.filter((tag) => tag.id !== tagId);
    saveDB();
    pushConfig();
    render();
  }

  function deletePayMethod(id) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const hasEntries = allEntries().some((entry) => entry.payMethodId === id);
    if (hasEntries) return alert("This payment method has transaction history and cannot be deleted.");
    if (!confirmDelete("Delete this payment method?")) return;
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

  function savePageName(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
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
    if (!requirePerm("Manage Settings")) return;
    if (!confirmDelete("Delete this page name?")) return;
    DB.pageNames = DB.pageNames.filter((page) => page.id !== id);
    saveDB();
    pushConfig();
    render();
  }

  function vendorGroupToggle(prefix) {
    const select = document.getElementById(`${prefix}-vendor-whatsapp`);
    const group = document.getElementById(`${prefix}-vendor-group`);
    if (group) group.disabled = select?.value !== "yes";
  }

  function readVendorFields(prefix) {
    const hasWhatsappGroup = document.getElementById(`${prefix}-vendor-whatsapp`)?.value === "yes";
    return {
      contactPerson: document.getElementById(`${prefix}-vendor-contact`)?.value.trim() || "",
      phone: document.getElementById(`${prefix}-vendor-phone`)?.value.trim() || "",
      email: document.getElementById(`${prefix}-vendor-email`)?.value.trim() || "",
      hasWhatsappGroup,
      groupName: hasWhatsappGroup ? document.getElementById(`${prefix}-vendor-group`)?.value.trim() || "" : ""
    };
  }

  function savePayVendor(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const name = document.getElementById("pay-vendor-name").value.trim();
    if (!name) return;
    const vendor = { id: uid("vendor"), name, ...readVendorFields("pay"), notes: "", fees: [], paid: 0, payments: [], deductions: [] };
    DB.payVendors.push(vendor);
    S.selectedPayVendorId = vendor.id;
    saveDB();
    pushConfig();
    closeModal();
  }

  function selectPayVendor(id) {
    S.selectedPayVendorId = id;
    render();
  }

  function editPayVendor(id) {
    S.selectedPayVendorId = id;
    S.modal = { type: "editPayVendor", vendorId: id };
    render();
  }

  function savePayVendorEdit(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const vendor = DB.payVendors.find((item) => item.id === S.modal?.vendorId);
    if (!vendor) return;
    const before = clone(vendor);
    const name = document.getElementById("pay-vendor-name")?.value.trim();
    if (!name) return;
    Object.assign(vendor, { name, ...readVendorFields("pay") });
    audit("Edit Payment Vendor", vendor.name, before, vendor);
    S.selectedPayVendorId = vendor.id;
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
    if (!requirePerm("Manage Settings")) return;
    const vendor = DB.payVendors.find((item) => item.id === S.modal?.vendorId);
    if (!vendor) return;
    const amount = num(document.getElementById("vendor-payment-amount")?.value);
    if (amount <= 0) return;
    const date = parseDateInput(document.getElementById("vendor-payment-date")?.value);
    const time = document.getElementById("vendor-payment-time")?.value || "00:00";
    const reference = document.getElementById("vendor-payment-ref")?.value.trim() || "";
    const note = document.getElementById("vendor-payment-note")?.value.trim() || "";
    vendor.payments = Array.isArray(vendor.payments) ? vendor.payments : [];
    const payment = { id: uid("vendor-payment"), amount, at: buildDateTime(date, time) || new Date().toISOString(), reference, note };
    vendor.payments.push(payment);
    syncVendorPaid(vendor);
    audit("Record Vendor Payment", vendor.name, null, payment);
    saveDB();
    pushConfig();
    queueSheetBatch("VendorLedger", vendorLedgerColumns(), [vendorLedgerRow(vendor, "Payment", payment)], "Vendor payment");
    S.modal = null;
    render();
  }

  function viewVendorPaymentHistory(id) {
    S.modal = { type: "vendorPaymentHistory", vendorId: id };
    render();
  }

  function editVendorPayment(vendorId, paymentId) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const vendor = DB.payVendors.find((item) => item.id === vendorId);
    const payment = vendor?.payments?.find((item) => item.id === paymentId);
    if (!vendor || !payment) return;
    const before = clone(payment);
    const amount = num(prompt("Payment amount", payment.amount));
    if (amount <= 0) return;
    const at = prompt("Date and time", payment.at || new Date().toISOString()) || payment.at || new Date().toISOString();
    payment.amount = amount;
    payment.at = at;
    audit("Edit Vendor Payment", vendor.name, before, payment);
    syncVendorPaid(vendor);
    saveDB();
    pushConfig();
    render();
  }

  function deleteVendorPayment(vendorId, paymentId) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const vendor = DB.payVendors.find((item) => item.id === vendorId);
    if (!vendor) return;
    const hasLedgerTransactions = vendorTotals(vendor).deposits > 0 || (vendor.deductions || []).length > 0;
    if (hasLedgerTransactions) return alert("This vendor has ledger transaction history. Payment records are locked and cannot be deleted.");
    if (!confirmDelete("Delete this vendor payment entry?")) return;
    const before = clone((vendor.payments || []).find((item) => item.id === paymentId));
    vendor.payments = (vendor.payments || []).filter((item) => item.id !== paymentId);
    audit("Delete Vendor Payment", vendor.name, before, null);
    syncVendorPaid(vendor);
    saveDB();
    pushConfig();
    render();
  }

  function addVendorDeduction(id) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const vendor = DB.payVendors.find((item) => item.id === id);
    if (!vendor) return;
    const amount = num(prompt("Dispute or deduction amount"));
    if (amount <= 0) return;
    const note = prompt("Reason for deduction") || "";
    vendor.deductions = Array.isArray(vendor.deductions) ? vendor.deductions : [];
    const deduction = { id: uid("deduction"), amount, note, at: new Date().toISOString() };
    vendor.deductions.push(deduction);
    audit("Add Vendor Deduction", vendor.name, null, deduction);
    saveDB();
    pushConfig();
    queueSheetBatch("VendorLedger", vendorLedgerColumns(), [vendorLedgerRow(vendor, "Deduction", deduction)], "Vendor deduction");
    render();
  }

  function editVendorDeduction(vendorId, deductionId) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const vendor = DB.payVendors.find((item) => item.id === vendorId);
    const deduction = vendor?.deductions?.find((item) => item.id === deductionId);
    if (!vendor || !deduction) return;
    const before = clone(deduction);
    const amount = num(prompt("Dispute or deduction amount", deduction.amount));
    if (amount <= 0) return;
    deduction.amount = amount;
    deduction.note = prompt("Reason for deduction", deduction.note || "") || "";
    deduction.at = prompt("Date and time", deduction.at || new Date().toISOString()) || deduction.at || new Date().toISOString();
    audit("Edit Vendor Deduction", vendor.name, before, deduction);
    saveDB();
    pushConfig();
    render();
  }

  function deleteVendorDeduction(vendorId, deductionId) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    if (!confirmDelete("Delete this dispute or deduction entry?")) return;
    const vendor = DB.payVendors.find((item) => item.id === vendorId);
    if (!vendor) return;
    const before = clone((vendor.deductions || []).find((item) => item.id === deductionId));
    vendor.deductions = (vendor.deductions || []).filter((item) => item.id !== deductionId);
    audit("Delete Vendor Deduction", vendor.name, before, null);
    saveDB();
    pushConfig();
    render();
  }

  function deletePayVendor(id) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const vendor = DB.payVendors.find((item) => item.id === id);
    if (!vendor) return;
    if (vendorHasLedger(vendor)) {
      if (!confirm(`${vendor.name} has transaction or ledger history, so it cannot be deleted.\n\nArchive it instead? This keeps history and hides its tags from new transactions.`)) return;
      return archivePayVendor(id);
    }
    if (!confirmDelete("Delete this payment vendor?")) return;
    audit("Delete Payment Vendor", vendor.name, vendor, null);
    deleteVendorTags(vendor);
    DB.payVendors = DB.payVendors.filter((vendor) => vendor.id !== id);
    if (S.selectedPayVendorId === id) S.selectedPayVendorId = DB.payVendors.find((item) => !item.archived)?.id || "";
    saveDB();
    pushConfig();
    render();
  }

  function archivePayVendor(id) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const vendor = DB.payVendors.find((item) => item.id === id);
    if (!vendor) return;
    const before = clone(vendor);
    vendor.archived = true;
    vendor.archivedAt = new Date().toISOString();
    setVendorTagsArchived(vendor, true);
    audit("Archive Payment Vendor", vendor.name, before, vendor, "Vendor retained because ledger history may exist.");
    saveDB();
    pushConfig();
    render();
  }

  function restorePayVendor(id) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const vendor = DB.payVendors.find((item) => item.id === id);
    if (!vendor) return;
    const before = clone(vendor);
    vendor.archived = false;
    vendor.archivedAt = "";
    setVendorTagsArchived(vendor, false);
    audit("Restore Payment Vendor", vendor.name, before, vendor);
    saveDB();
    pushConfig();
    render();
  }

  function addVendorFee(vendorId) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const vendor = DB.payVendors.find((item) => item.id === vendorId);
    if (!vendor) return;
    const methodId = document.getElementById(`vendor-method-${vendorId}`).value;
    const payTag = document.getElementById(`vendor-tag-${vendorId}`).value.trim();
    if (!payTag) return alert("Enter the payment tag for this vendor row.");
    const tag = ensurePayMethodTag(methodId, payTag);
    const fee = {
      id: uid("fee"),
      payMethodId: methodId,
      tagId: tag?.id || "",
      fee: num(document.getElementById(`vendor-fee-${vendorId}`).value),
      payTag
    };
    vendor.fees.push(fee);
    audit("Add Vendor Fee", vendor.name, null, fee);
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
    if (!requirePerm("Manage Settings")) return;
    const fee = DB.payVendors.find((vendor) => vendor.id === vendorId)?.fees.find((item) => item.id === feeId);
    if (!fee) return;
    const vendor = DB.payVendors.find((item) => item.id === vendorId);
    const before = clone(fee);
    fee.fee = num(document.getElementById(`edit-fee-${feeId}`)?.value);
    audit("Edit Vendor Fee", vendor?.name || vendorId, before, fee);
    S.editVendorFeeId = "";
    saveDB();
    pushConfig();
    render();
  }

  function deleteVendorFee(vendorId, feeId) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const vendor = DB.payVendors.find((item) => item.id === vendorId);
    if (!vendor) return;
    const fee = vendor.fees.find((item) => item.id === feeId);
    if (fee && vendorFeeDeposits(fee) > 0) return alert("This vendor fee row has transaction history and cannot be deleted.");
    if (!confirmDelete("Delete this vendor fee row?")) return;
    audit("Delete Vendor Fee", vendor.name, fee, null);
    vendor.fees = vendor.fees.filter((fee) => fee.id !== feeId);
    if (fee?.tagId && !otherVendorUsesTag(vendorId, fee.tagId)) {
      DB.payMethods.forEach((method) => { method.tags = method.tags.filter((tag) => tag.id !== fee.tagId); });
    }
    saveDB();
    pushConfig();
    render();
  }

  function addGameVendor(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const input = document.getElementById("game-vendor-name") || document.getElementById("new-game-vendor");
    const name = input?.value.trim();
    if (!name) return;
    const vendor = { id: uid("game-vendor"), name, ...readVendorFields("game"), notes: "" };
    DB.gameVendors.push(vendor);
    audit("Add Game Vendor", vendor.name, null, vendor);
    S.selectedGameVendorId = vendor.id;
    saveDB();
    pushConfig();
    closeModal();
  }

  function selectGameVendor(id) {
    S.selectedGameVendorId = id;
    render();
  }

  function editGameVendor(id) {
    S.selectedGameVendorId = id;
    S.modal = { type: "editGameVendor", vendorId: id };
    render();
  }

  function saveGameVendorEdit(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const vendor = DB.gameVendors.find((item) => item.id === S.modal?.vendorId);
    if (!vendor) return;
    const before = clone(vendor);
    const name = document.getElementById("game-vendor-name")?.value.trim();
    if (!name) return;
    Object.assign(vendor, { name, ...readVendorFields("game") });
    audit("Edit Game Vendor", vendor.name, before, vendor);
    S.selectedGameVendorId = vendor.id;
    saveDB();
    pushConfig();
    closeModal();
  }

  function deleteGameVendor(id) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const vendor = DB.gameVendors.find((item) => item.id === id);
    if (DB.games.some((game) => game.gameVendorId === id)) return alert("This game vendor is assigned to games. Reassign those games before deleting.");
    if (!confirmDelete("Delete this game vendor?")) return;
    audit("Delete Game Vendor", vendor?.name || id, vendor, null);
    DB.gameVendors = DB.gameVendors.filter((vendor) => vendor.id !== id);
    if (S.selectedGameVendorId === id) S.selectedGameVendorId = DB.gameVendors[0]?.id || "";
    saveDB();
    pushConfig();
    render();
  }

  function addExpense(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    const expense = {
      id: uid("expense"),
      date: parseDateInput(document.getElementById("expense-date").value),
      category: document.getElementById("expense-category").value,
      description: document.getElementById("expense-description").value.trim(),
      amount: num(document.getElementById("expense-amount").value)
    };
    DB.expenses.unshift(expense);
    audit("Add Expense", expense.category, null, expense);
    saveDB();
    pushConfig();
    queueSheetBatch("Expenses", expenseSheetColumns(), [expenseSheetRow(expense)], "Expense");
    render();
  }

  function deleteExpense(id) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Settings")) return;
    if (!confirmDelete("Delete this expense?")) return;
    const before = DB.expenses.find((expense) => expense.id === id);
    audit("Delete Expense", before?.category || id, before, null);
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
    const cat = DB.expCats.find((item) => item.id === id);
    if (cat && DB.expenses.some((expense) => expense.category === cat.name)) return alert("This expense category has expenses and cannot be deleted.");
    if (!confirmDelete("Delete this expense category?")) return;
    DB.expCats = DB.expCats.filter((cat) => cat.id !== id);
    saveDB();
    pushConfig();
    render();
  }

  function addScheduledOff(event) {
    event?.preventDefault();
    if (!checkOnline()) return;
    if (!requirePerm("Manage Agents")) return;
    const employeeId = document.getElementById("off-person").value;
    const date = parseDateInput(document.getElementById("off-date").value);
    const reasonSel = document.getElementById("off-reason").value;
    const custom = document.getElementById("off-custom").value.trim();
    const reason = reasonSel === "Custom" ? custom || "Custom" : reasonSel;
    const person = personById(employeeId);
    const scheduled = { id: uid("off"), employeeId, date, reason };
    DB.scheduledOff.unshift(scheduled);
    const rec = ensureAttendance(employeeId, date);
    rec.agentName = person?.name || "";
    rec.status = "off";
    rec.offReason = reason;
    rec.checkInAt = "";
    rec.checkOutAt = "";
    rec.duration = 0;
    audit("Add Scheduled Off", person?.name || employeeId, null, scheduled);
    saveDB();
    syncAttendance(rec);
    pushConfig();
    render();
  }

  function deleteScheduledOff(id) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Agents")) return;
    if (!confirmDelete("Delete this scheduled off record?")) return;
    const item = DB.scheduledOff.find((entry) => entry.id === id);
    DB.scheduledOff = DB.scheduledOff.filter((entry) => entry.id !== id);
    audit("Delete Scheduled Off", item?.employeeId || id, item, null);
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
    if (!requirePerm("Manage Agents")) return;
    const rec = DB.attendance.find((item) => item.id === S.modal.recordId);
    if (!rec) return;
    const before = clone(rec);
    const date = parseDateInput(document.getElementById("correct-date").value);
    const checkInTime = document.getElementById("correct-in").value;
    const checkOutTime = document.getElementById("correct-out").value;
    rec.date = date;
    rec.status = document.getElementById("correct-status").value;
    rec.checkInAt = checkInTime ? buildDateTime(date, checkInTime) : "";
    rec.checkOutAt = checkOutTime ? buildDateTime(date, checkOutTime) : "";
    rec.checkIn = rec.checkInAt;
    rec.checkOut = rec.checkOutAt;
    rec.breakMins = num(document.getElementById("correct-break")?.value);
    rec.duration = Math.max(0, minutesBetween(rec.checkInAt, rec.checkOutAt) - rec.breakMins);
    rec.leaveReason = document.getElementById("correct-reason").value.trim();
    const person = personById(rec.agentId);
    rec.late = isLateForPerson(person, rec.checkInAt);
    const report = {};
    REPORT_FIELDS.forEach((fieldItem) => { report[fieldItem.key] = num(document.getElementById(`correct-${fieldItem.key}`).value); });
    const hasReport = REPORT_FIELDS.some((fieldItem) => report[fieldItem.key] > 0);
    report.totalPlayers = getBaseTotalPlayers(rec.agentName, rec.date) + num(report.newPlayers);
    rec.report = hasReport ? report : null;
    audit("Correct Attendance", rec.agentName || rec.agentId, before, rec);
    saveDB();
    syncAttendance(rec);
    S.modal = null;
    render();
  }

  function deleteAttendance(id) {
    if (!checkOnline()) return;
    if (!requirePerm("Manage Agents")) return;
    if (!confirmDelete("Delete this attendance record?")) return;
    const before = DB.attendance.find((record) => record.id === id);
    audit("Delete Attendance", before?.agentName || id, before, null);
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
    if (!confirmDelete("Delete this attendance reason?")) return;
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

  function clearPlayerCodeSearch() {
    S.playerLookupCode = "";
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

  function transactionExportColumns() {
    return [
      "Entry ID", "Type", "Status", "Session", "Date", "Entry Time", "Shift", "Sales Person",
      "Player ID", "Player Name", "Legal Name", "Contact Number", "Email", "Facebook Link",
      "Game ID", "Game Name", "Deposit", "Recharge Credits", "Promo Amount", "Promo Percentage",
      "Freeplay Credits", "Referral Credits", "Redeem Credits", "Cashout Paid",
      "Payment Method", "Payment Tag", "Deposit On Page", "Page Name", "Hunting Profile",
      "New Player", "Customer Tag", "Referral For Player ID", "Referred By Player ID",
      "Referral Type", "Referral Note", "Dispute", "Dispute Note", "Created At"
    ];
  }

  function transactionExportRow(entry) {
    const method = DB.payMethods.find((item) => item.id === entry.payMethodId)?.name || "";
    return [
      entry.id,
      entry.type,
      entry.dispute ? "Dispute" : "Clear",
      entry.shiftSession || "Current",
      isoToLabel(entry.date),
      fmtDateTime(entry.createdAt),
      entry.shift,
      entry.agent,
      normalizePlayerCode(entry.playerCode),
      entry.playerName,
      entry.legalName,
      entry.contact,
      entry.email,
      entry.playerUrl,
      entry.gameId,
      entry.gameName,
      entry.deposit,
      entry.recharge,
      entry.promo,
      entry.promoP,
      entry.type === "freeplay" ? entry.fpAmount : 0,
      entry.type === "referral" ? entry.fpAmount || entry.referralBonusAmount : 0,
      entry.rdCredits,
      entry.cashoutPaid,
      method,
      entry.payTagLabel || entry.payTag || "",
      entry.depositOnPage ? "Yes" : "No",
      entry.pageName,
      entry.huntingProfile,
      entry.isNewPlayer ? "Yes" : "No",
      entry.custTag,
      normalizePlayerCode(entry.referralForCode),
      normalizePlayerCode(entry.referredByCode),
      entry.referrerType || "",
      entry.referralNote || "",
      entry.dispute ? "Yes" : "No",
      entry.disputeNote || "",
      entry.createdAt || ""
    ];
  }

  function exportTransactionsExcel() {
    if (!requirePerm("Export / Backup")) return;
    const rows = filteredTransactions().map(transactionExportRow);
    downloadExcelTable(`panda-squad-transactions-${todayISO()}.xls`, transactionExportColumns(), rows);
  }

  function exportEntries() {
    exportRows(`panda-squad-entries-${todayISO()}.csv`, [transactionExportColumns(), ...allEntries().map(transactionExportRow)]);
  }

  function exportExpenses() {
    exportRows(`panda-squad-expenses-${todayISO()}.csv`, [["Date", "Category", "Description", "Amount in Pakistani Rupees"], ...DB.expenses.map((expense) => [isoToLabel(expense.date), expense.category, expense.description, expense.amount])]);
  }

  function exportPerformance() {
    const rows = performanceRows();
    exportRows(`panda-squad-agent-performance-${todayISO()}.csv`, [["Date", "Agent", "Type", "Player ID", "Player", "Game", "Deposit", "Recharge", "New Player"], ...rows.map((entry) => [isoToLabel(entry.date), entry.agent, entry.type, normalizePlayerCode(entry.playerCode), entry.playerName, entry.gameName, entry.deposit, entry.recharge, entry.isNewPlayer ? "Yes" : "No"])]);
  }

  function exportAttendance() {
    exportRows(`panda-squad-attendance-${todayISO()}.csv`, [["Employee", "Date", "Status", "Check In", "Check Out", "Break Minutes", "Duration Minutes", "Leave Reason"], ...DB.attendance.map((record) => [record.agentName, isoToLabel(record.date), record.status, record.checkInAt, record.checkOutAt, record.breakMins || 0, record.duration, record.leaveReason || record.offReason || ""])]);
  }

  function exportMonthlyAttendance() {
    const people = allPeople();
    exportRows(`panda-squad-monthly-attendance-${S.month}.csv`, [["Date", ...people.map((person) => person.name)], ...monthDays(S.month).map((day) => [isoToLabel(day), ...people.map((person) => attendanceText(getAttendance(person.id, day), day))])]);
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
    exportRows(`panda-squad-monthly-progress-${S.month}.csv`, [["Date", ...REPORT_FIELDS.map((fieldItem) => fieldItem.label), "Total Players"], ...records.map((record) => [isoToLabel(record.date), ...REPORT_FIELDS.map((fieldItem) => record.report?.[fieldItem.key] || 0), record.report?.totalPlayers || 0])]);
  }

  function exportJson() {
    if (!requirePerm("Export / Backup")) return;
    downloadTextFile(`panda-squad-backup-${todayISO()}.json`, JSON.stringify(DB, null, 2), "application/json");
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
    if (!requirePerm("Export / Backup")) return;
    let parsed;
    try { parsed = JSON.parse(restoreFileText); } catch { return alert("Invalid JSON backup."); }
    if (!confirm("Restore this backup and overwrite all current data?")) return;
    const before = clone(DB);
    DB = normalizeDB(parsed);
    audit("Restore Backup", "CRM", before, DB);
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
    if (!requirePerm("Manage Settings")) return;
    const before = clone(DB.supabase);
    DB.supabase.url = document.getElementById("sb-url").value.trim();
    DB.supabase.anonKey = document.getElementById("sb-key").value.trim();
    DB.supabase.enabled = enabled;
    audit("Save Supabase Settings", "Supabase", before, DB.supabase);
    saveDB();
    pushConfig();
    lastSavedStatus = enabled ? "Supabase settings saved." : "Supabase disabled.";
    render();
  }

  async function pushAll() {
    if (!requirePerm("Export / Backup")) return;
    if (!confirm("Push this PC's current CRM data to Supabase?\n\nThis will overwrite remote rows that are no longer present on this PC. Pull first if another office PC may have newer data.")) return;
    lastSavedStatus = "Pushing all data...";
    render();
    const ok = await sbPush();
    lastSavedStatus = ok ? "All data pushed." : "Push failed silently. Confirm SQL setup and network.";
    render();
  }

  async function pullAll() {
    if (!requirePerm("Export / Backup")) return;
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
    const code = normalizePlayerCode(S.rf.playerCode);
    const id = String(S.rf.gameId || "").trim();
    const match = code ? lastEntryForPlayerCode(code) : id ? allEntries().filter((entry) => entry.gameId === id).sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)))[0] : null;
    if (match?.gameName && !S.rf.gameName) S.rf.gameName = match.gameName;
    if (match?.gameId && !S.rf.gameId) S.rf.gameId = match.gameId;
    render();
  }

  async function bootApp() {
    clearBrowserDB();
    DB = loadDB();
    applyTheme();
    S = createState();
    S.pf.agent = salesPeople()[0]?.name || "";
    S.ff.agent = salesPeople()[0]?.name || "";
    S.rf.agent = salesPeople()[0]?.name || "";
    S.referral.agent = salesPeople()[0]?.name || "";
    S.pf.gameName = DB.games[0]?.name || "";
    S.ff.gameName = DB.games[0]?.name || "";
    S.rf.gameName = DB.games[0]?.name || "";
    bootStatus.textContent = "Connecting to Supabase...";
    const pulled = await sbPull(true);
    if (!pulled) {
      bootStatus.textContent = IS_ONLINE ? "Supabase data was not found or could not be loaded." : "Internet is offline. Supabase data is required.";
      lastSavedStatus = bootStatus.textContent;
    }
    applyTheme();
    S.pf.agent = salesPeople()[0]?.name || S.pf.agent;
    S.ff.agent = salesPeople()[0]?.name || S.ff.agent;
    S.rf.agent = salesPeople()[0]?.name || S.rf.agent;
    S.referral.agent = salesPeople()[0]?.name || S.referral.agent;
    S.pf.gameName = DB.games[0]?.name || S.pf.gameName;
    S.ff.gameName = DB.games[0]?.name || S.ff.gameName;
    S.rf.gameName = DB.games[0]?.name || S.rf.gameName;
    restoreAdminSession();
    if (isAdminPortal()) {
      S.page = "admin";
      if (!S.adminAuthed || !currentAdminUser()) S.modal = { type: adminCandidates().length ? "adminLogin" : "adminSetup" };
    } else if (isAgentPortal()) {
      S.page = isShiftOpen() ? "shift" : "closed";
      S.adminAuthed = false;
      S.adminUserId = "";
    }
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
    void flushSheetBackup();
    app.classList.remove("hidden");
    boot.classList.add("hidden");
  }

  window.TM = {
    setPage, openAdminGate, loginAdmin, createFirstAdmin, lockAdmin,
    parseDateInput, dateLabel: isoToLabel,
    setShiftTab, setAdmin, setS, setPF, setFF, setRF, setReferral, fillPaidFromCode, fillFreeplayFromCode, fillRedeemFromCode, setPaidMethod, setPaidTag,
    updatePaidMoney, toggleDepositOnPage, toggleFreeplayDepositOnPage, validateLink, submitPaid,
    clearPaid, submitFreeplay, clearFreeplay, submitRedeem, clearRedeem, submitReferralBonus, clearReferralBonus, redeemLookup,
    approveOverride, cancelOverride, checkIn, toggleBreak, markLeave, openCheckout, submitCheckout,
    updateCheckoutPreview, copyCheckoutPreview, openLeaveRequest, saveLeaveRequest,
    reviewLeave, editLeaveRequest, deleteLeaveRequest, openCloseShift, closeBalanceInput,
    confirmCloseShift, startNewShift, adminSetActiveShift, adminForceCloseShift, openModal, closeModal, backdrop, setEntryFilter,
    editEntry, saveEntryEdit, deleteEntry, saveShift, deleteShift, addAgentRole, deleteAgentRole, saveAgent, openAgentEdit,
    deleteAgent, saveStaff, openStaffEdit, deleteStaff, staffRoleChanged, staffAdminAccessChanged, staffSelectAll,
    staffClearAll, staffResetRole, saveNewGame, editGame, cancelGameEdit, saveGameEdit,
    topUpGame, deleteGame, savePayMethod, addPayTag, deletePayTag,
    deletePayMethod, addPage, savePageName, editPage, deletePage, savePayVendor, selectPayVendor, editPayVendor, savePayVendorEdit, vendorGroupToggle, recordVendorPayment, saveVendorPayment, viewVendorPaymentHistory,
    editVendorPayment, deleteVendorPayment, addVendorDeduction, editVendorDeduction, deleteVendorDeduction, deletePayVendor, archivePayVendor, restorePayVendor, addVendorFee,
    updPVFee, editVendorFee, cancelVendorFeeEdit, saveVendorFeeEdit, deleteVendorFee, togglePayTag, addGameVendor, selectGameVendor, editGameVendor, saveGameVendorEdit, deleteGameVendor, addExpense, deleteExpense,
    addExpenseCategory, deleteExpenseCategory, addScheduledOff, deleteScheduledOff,
    correctAttendance, saveAttendanceCorrection, deleteAttendance, setAttendanceAdmin, setVendorSection, setPayMethodSection,
    addAttendanceReason, removeAttendanceReason, updateLateGrace, clearTransactions,
    clearPlayerLookup, clearPlayerCodeSearch, clearPerformance, clearAttendanceFilters, exportTransactionsExcel, exportEntries, exportExpenses,
    exportPerformance, exportAttendance, exportMonthlyAttendance, exportMonthlyProgress,
    exportJson, loadRestoreFile, restoreBackup, testSupabase, saveSupabase, pushAll,
    pullAll, autoSyncNow, copySql, saveGoogleSheets, testGoogleSheets, syncCurrentToGoogleSheets, saveOverrideCode, saveSalesTargets, saveTargets,
    setThemeMode, previewCustomTheme, saveTheme, resetCustomTheme,
    copy, renderNow
  };

  document.addEventListener("DOMContentLoaded", bootApp);
})();
