document.addEventListener("DOMContentLoaded", () => {
  const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
  const API = isLocal && location.port !== "5000" ? "http://localhost:5000" : "";
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  let stream = null;
  let reminders = JSON.parse(localStorage.getItem("mf_reminders") || "[]");

  // ---------- file choose / camera ----------
  const fileInput = $("recordFile"), camInput = $("cameraFile");
  let chosen = null;
  const setFile = f => { chosen = f; $("fileName").textContent = f ? f.name : "No file selected"; };
  $("chooseBtn").onclick = () => fileInput.click();
  fileInput.onchange = () => setFile(fileInput.files[0]);
  camInput.onchange = () => setFile(camInput.files[0]);
  $("photoBtn").onclick = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return camInput.click(); // phones: opens camera app
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      $("cam").srcObject = stream; $("cam").hidden = false; $("snapBtn").hidden = false;
    } catch { camInput.click(); }
  };
  $("snapBtn").onclick = () => {
    const v = $("cam"), c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob(b => setFile(new File([b], "photo-" + Date.now() + ".jpg", { type: "image/jpeg" })), "image/jpeg", 0.92);
    stream.getTracks().forEach(t => t.stop()); v.hidden = true; $("snapBtn").hidden = true;
  };

  // ---------- upload -> direct AI document reading ----------
  $("uploadButton").onclick = async () => {
    const st = $("uploadStatus");
    if (!$("patientName").value.trim()) return st.textContent = "Please enter the patient name.";
    if (!$("patientAge").value) return st.textContent = "Please enter the patient age.";
    if (!chosen) return st.textContent = "Please choose a file or take a photo.";
    const supportedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!supportedTypes.includes(chosen.type)) return st.textContent = "Choose a PDF, JPEG, PNG, WebP, HEIC, or HEIF file.";
    if (chosen.size > 15 * 1024 * 1024) return st.textContent = "The file is too large. Choose a file smaller than 15 MB.";
    const fd = new FormData();
    fd.append("patientName", $("patientName").value.trim());
    fd.append("patientAge", $("patientAge").value);
    fd.append("sourceLanguage", $("sourceLanguage").value);
    fd.append("recordDate", new Date().toISOString().split("T")[0]);
    fd.append("medicalRecord", chosen);
    try {
      st.textContent = "Uploading...";
      const r = await fetch(API + "/api/records/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) return st.textContent = d.message || "Upload failed.";
      st.textContent = "AI is reading the prescription...";
      const aiFile = new FormData();
      aiFile.append("prescription", chosen);
      const p = await fetch(API + "/api/ai/parse-file", { method: "POST", body: aiFile });
      const pd = await p.json();
      if (!p.ok) return st.textContent = pd.message || "Could not read the prescription with AI.";
      renderMeds(pd.medicines || []);
      $("srcTag").textContent = "(read directly from document by AI)";
      st.textContent = pd.medicines?.length
        ? "Done! See the medicines section below and verify the details."
        : "AI could not identify any medicines. Try a clearer, well-lit image or PDF.";
      $("results").scrollIntoView();
      loadRecords();
    } catch (e) { console.error(e); st.textContent = "Could not connect to the backend. Is the server running?"; }
  };

  // ---------- medicines table ----------
  function renderMeds(meds) {
    const body = $("medBody");
    if (!meds.length) return body.innerHTML = '<tr><td colspan="6" class="muted">No medicines identified in the document.</td></tr>';
    body.innerHTML = meds.map((m, i) => `<tr><td>${i + 1}</td>
      <td contenteditable>${esc(m.name)}</td><td contenteditable>${esc(m.dosage)}</td>
      <td contenteditable>${esc(m.frequency)}</td><td contenteditable>${esc(m.duration)}</td>
      <td><button class="rbtn">⏰ Remind</button></td></tr>`).join("");
    body.querySelectorAll(".rbtn").forEach(b => b.onclick = () => {
      const name = b.closest("tr").children[1].textContent.trim();
      const time = prompt("Reminder time for " + name + " (24h HH:MM, e.g. 08:30):", "08:00");
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")) return time !== null && alert("Please use HH:MM format.");
      reminders.push({ name, time, last: "" }); saveRem();
    });
  }

  // ---------- reminders ----------
  function saveRem() { localStorage.setItem("mf_reminders", JSON.stringify(reminders)); drawRem(); }
  function drawRem() {
    $("remList").innerHTML = reminders.length
      ? reminders.map((r, i) => `<li><span>💊 ${esc(r.name)} at <b>${r.time}</b></span><button data-i="${i}">Delete</button></li>`).join("")
      : '<li class="muted">No reminders set.</li>';
    $("remList").querySelectorAll("button").forEach(b => b.onclick = () => { reminders.splice(b.dataset.i, 1); saveRem(); });
  }
  $("notifBtn").onclick = () => "Notification" in window ? Notification.requestPermission() : alert("Notifications not supported.");
  setInterval(() => {
    const now = new Date(), hm = now.toTimeString().slice(0, 5), day = now.toDateString();
    reminders.forEach(r => {
      if (r.time === hm && r.last !== day) {
        r.last = day; saveRem();
        if (window.Notification && Notification.permission === "granted") new Notification("MediFlow", { body: "Time to take " + r.name });
        alert("💊 Time to take " + r.name);
      }
    });
  }, 15000);

  // ---------- records ----------
  async function loadRecords() {
    try {
      const recs = await (await fetch(API + "/api/records")).json();
      $("healthTimeline").innerHTML = recs.length ? recs.map(r =>
        `<div class="item"><b>${esc(r.originalFileName)}</b><br>${esc(r.patientName)}, age ${esc(r.patientAge)} · ${esc(r.sourceLanguage)} · ${esc(r.recordDate)}</div>`).join("")
        : '<p class="muted">No records yet.</p>';
    } catch { $("healthTimeline").innerHTML = '<p class="muted">Backend not reachable.</p>'; }
  }
  drawRem(); loadRecords();
});
