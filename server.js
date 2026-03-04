const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
const crypto = require("crypto");
dotenv.config();
const cors = require("cors");
const app = express();
const port = 8005;

app.use(express.json());
app.use(cors()); // Add this near your other app.use calls

const sowStore = new Map();

// --- POST /create-sow/ ---
app.post("/create-sow/", (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.parent_input) {
      return res
        .status(400)
        .json({ success: false, error: "parent_input is required." });
    }

    // Get the actual domain (e.g., your-app.onrender.com)
    const protocol = req.protocol;
    const host = req.get("host");
    const baseUrl =   `https://nodeapi-vriz.onrender.com`;

    const token = crypto.randomBytes(16).toString("hex");
    sowStore.set(token, payload);
    setTimeout(() => sowStore.delete(token), 10 * 60 * 1000);

    return res.status(200).json({
      success: true,
      token,
      // Dynamically create the URL instead of hardcoding localhost
      redirect_url: `${baseUrl}/go/${token}`,
      agentResponseContext: "SOW data stored. Redirecting to form...",
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- GET /sow-data/:token ---
app.get("/sow-data/:token", (req, res) => {
  const data = sowStore.get(req.params.token);
  if (!data)
    return res.status(404).json({ success: false, error: "Token expired." });
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(200).json({ success: true, data });
});

// --- GET /go/:token (The Bridge) ---
app.get("/go/:token", (req, res) => {
  const { token } = req.params;
  const data = sowStore.get(token);
  if (!data) return res.status(404).send("Link expired");

  const sowJson = JSON.stringify(data).replace(/<\/script>/gi, "<\\/script>");

  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Redirecting to SOW Form...</title></head>
    <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
        <h2>Redirecting to SOW Portal...</h2>
        <script>
            // window.name persistence for cross-origin data transfer
            window.name = JSON.stringify({ __sow__: ${sowJson}, __token__: "${token}" });
            window.location.replace("https://vithiit-careers-dev.mercuryx.cloud/dashboard/page/create-csod-sow#sow_token=${token}");
        </script>
    </body>
    </html>`);
});

// --- GET /inject.js ---
// --- GET /inject.js ---
app.get("/inject.js", (req, res) => {
    const { token } = req.query;
    const data = sowStore.get(token);
    if (!data) return res.status(404).send("// Token expired");

    // Get the current domain dynamically
    const host = req.get('host');
    const protocol = req.protocol;
    const currentDomain = `${protocol}://${host}`;

    const sowJson = JSON.stringify(data).replace(/<\/script>/gi, "<\\/script>");

    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Access-Control-Allow-Origin", "*");

    res.send(`
(function(){
    console.log("[SOW] Prefill Script Active");
    var data = ${sowJson};
    var p = data.parent_input || {};
    var li = data.lines_input || [];

    // Use the dynamic domain for any secondary fetches
    var API_BASE = "${currentDomain}"; 

    function setReactValue(el, val) {
        if (!el || val === undefined || val === null) return;
        el.focus();
        var setter = Object.getOwnPropertyDescriptor(
            el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
            "value"
        ).set;
        setter.call(el, String(val));
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.blur();
    }

    function runPrefill() {
        console.log("[SOW] Starting Prefill on: ", window.location.href);
        
        // Parent Fields
        var phMap = {
            "PO Number": p.poNumber || p.po_number,
            "Client Manager Email": p.clientManagerEmail,
            "Client Manager": p.clientManager,
            "Customer Account Number": p.customerAccNumber
        };

        Object.keys(phMap).forEach(function(ph) {
            var el = document.querySelector('input[placeholder*="' + ph + '"]');
            if (el) setReactValue(el, phMap[ph]);
        });
        
        var dateEl = document.querySelector('input[type="date"]');
        if (dateEl) setReactValue(dateEl, p.date || p.order_date);

        var selects = document.querySelectorAll('select');
        if (selects[0]) setReactValue(selects[0], p.currency || "USD");

        // Trigger line items fill
        fillLines();
    }

    function fillLines() {
        var rows = document.querySelectorAll('input[placeholder*="Line Item Number"]');
        li.forEach(function(item, i) {
            if (rows[i]) {
                var parentRow = rows[i].closest('div').parentElement;
                var rowInputs = parentRow.querySelectorAll('input');
                setReactValue(rowInputs[0], item.lineItemNumber);
                setReactValue(rowInputs[1], item.description);
                setReactValue(rowInputs[2], item.price);
                setReactValue(rowInputs[3], item.quantity);
            }
        });
    }

    // Increased interval and timeout for deployed environments
    var check = setInterval(function() {
        if (document.querySelector('input[placeholder*="PO Number"]')) {
            clearInterval(check);
            setTimeout(runPrefill, 1000); // 1s delay for React hydration
        }
    }, 1000);
})();
    `);
});

mongoose
  .connect(process.env.DB_URL || "mongodb://localhost:27017/signUp")
  .then(() => console.log("DB Connected"))
  .catch((err) => console.log("DB Failed", err));

app.listen(port, () => console.log(`Server running on ${port}`));
