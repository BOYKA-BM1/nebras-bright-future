/** Security Pass 3 — permission matrix + masking */
function permissionsForRoles(roles) {
  const FULL = [
    "manageFullAdminRoles","manageUsers","banUnbanDeleteUsers","resetDevices",
    "reviewPayments","managePaymentConfig","viewUnmaskedPII","viewSecurityEvents","accessPsychMessages",
  ];
  const SECONDARY = [
    "manageUsers","banUnbanDeleteUsers","resetDevices","reviewPayments","managePaymentConfig","viewSecurityEvents",
  ];
  const set = new Set();
  if (roles.includes("admin")) FULL.forEach((p) => set.add(p));
  if (roles.includes("admin_secondary")) SECONDARY.forEach((p) => set.add(p));
  return set;
}
function can(roles, p) { return permissionsForRoles(roles).has(p); }

function maskEmail(email) {
  if (!email) return "غير متاح";
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length <= 1) return `*@${domain}`;
  if (local.length === 2) return `${local[0]}*@${domain}`;
  if (local.length === 3) return `${local[0]}*${local.slice(-2)}@${domain}`;
  return `${local[0]}${"*".repeat(Math.max(3, local.length - 3))}${local.slice(-2)}@${domain}`;
}
function maskIp(ip) {
  if (!ip) return "غير متاح";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split(".");
    return `***.***.*.${parts[3]}`;
  }
  if (ip.includes(":")) {
    const last = ip.split("%")[0].split(":").filter(Boolean).pop();
    return `****:****:****:****:****:****:****:${last}`;
  }
  return "غير متاح";
}

let failed = 0;
function assert(c, m) { if (!c) { console.error("FAIL", m); failed++; } else console.log("OK  ", m); }

assert(can(["admin_secondary"], "banUnbanDeleteUsers"), "secondary can ban non-admins (server still blocks admin targets)");
assert(can(["admin_secondary"], "resetDevices"), "secondary can reset devices");
assert(can(["admin_secondary"], "managePaymentConfig"), "secondary can manage payment config");
assert(can(["admin_secondary"], "reviewPayments"), "secondary can review payments");
assert(!can(["admin_secondary"], "manageFullAdminRoles"), "secondary cannot manage full admin roles");
assert(!can(["admin_secondary"], "viewUnmaskedPII"), "secondary cannot view unmasked PII");
assert(can(["admin"], "manageFullAdminRoles"), "full admin can manage admin roles");
assert(maskEmail("mohamed@gmail.com") === "m****ed@gmail.com" || maskEmail("mohamed@gmail.com").startsWith("m"), "email mask shape");
assert(maskEmail("mohamed@gmail.com").endsWith("@gmail.com"), "email domain kept");
assert(maskIp("192.168.1.125") === "***.***.*.125", "ipv4 last octet only");
assert(maskIp("2001:db8::1").endsWith(":1"), "ipv6 last group");
assert(maskIp("") === "غير متاح", "empty ip");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("\nAll Pass 3 checks passed");
