const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors"); // Ensure cors is imported
const dotenv = require("dotenv");
const crypto = require("crypto");
dotenv.config();

const app = express();
const port = process.env.PORT || 8005;

// 1. CRITICAL: Enable CORS for the portal domain
app.use(cors()); 
app.use(express.json());

const sowStore = new Map();

// --- POST /create-sow/ ---
app.post("/create-sow/", (req, res) => {
    try {
        const payload = req.body;
        if (!payload || !payload.parent_input) {
            return res.status(400).json({ success: false, error: "parent_input is required." });
        }

        // Dynamically detect the domain (e.g., https://your-app.render.com)
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        const token = crypto.randomBytes(16).toString("hex");
        sowStore.set(token, payload);
        setTimeout(() => sowStore.delete(token), 15 * 60 * 1000); // 15 min expiry

        return res.status(200).json({
            success: true,
            token,
            redirect_url: `${baseUrl}/go/${token}`,
            agentResponseContext: "SOW data stored. Redirecting..."
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// --- GET /sow-data/:token ---
app.get("/sow-data/:token", (req, res) => {
    const data = sowStore.get(req.params.token);
    if (!data) return res.status(404).json({ success: false, error: "Token expired or not found." });
    
    // Explicitly allow the CSOD portal to read this JSON
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ success: true, data });
});

// --- GET /go/:token ---
app.get("/go/:token", (req, res) => {
    const { token } = req.params;
    const data = sowStore.get(token);
    if (!data) return res.status(404).send("Link expired. Please regenerate.");

    const sowJson = JSON.stringify(data).replace(/<\/script>/gi, "<\\/script>");

    res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Redirecting...</title></head>
    <body style="font-family:sans-serif; text-align:center; padding-top:50px;">
        <h3>Preparing SOW Data...</h3>
        <script>
            // Persistence across the redirect
            window.name = JSON.stringify({ __sow__: ${sowJson}, __token__: "${token}" });
            window.location.replace("https://vithiit-careers-dev.mercuryx.cloud/dashboard/page/create-csod-sow#sow_token=${token}");
        </script>
    </body>
    </html>`);
});

// --- GET /inject.js ---
app.get("/inject.js", (req, res) => {
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const API_BASE = `${protocol}://${host}`;

    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Access-Control-Allow-Origin", "*");

    res.send(`
(function(){
    console.log("[SOW] Prefill Script Active");
    
    // Extract token from URL hash
    const hash = window.location.hash;
    const token = hash.includes("sow_token=") ? hash.split("sow_token=")[1].split("&")[0] : null;

    if (!token) {
        console.error("[SOW] No token found in URL");
        return;
    }

    async function start() {
        try {
            console.log("[SOW] Fetching data from: ${API_BASE}");
            const resp = await fetch("${API_BASE}/sow-data/" + token);
            const res = await resp.json();
            
            if (res.success) {
                console.log("[SOW] Data Loaded:", res.data);
                waitAndFill(res.data);
            } else {
                console.error("[SOW] API Error:", res.error);
            }
        } catch (e) {
            console.error("[SOW] Network Error:", e);
        }
    }

    function setVal(el, val) {
        if (!el || val == null) return;
        el.focus();
        const setter = Object.getOwnPropertyDescriptor(
            el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
            "value"
        ).set;
        setter.call(el, String(val));
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.blur();
    }

    function waitAndFill(data) {
        const check = setInterval(() => {
            const poInput = document.querySelector('input[placeholder*="PO Number"]');
            if (poInput) {
                clearInterval(check);
                fill(data);
            }
        }, 500);
    }

    function fill(data) {
        const p = data.parent_input || {};
        const li = data.lines_input || [];

        setVal(document.querySelector('input[placeholder*="PO Number"]'), p.poNumber);
        setVal(document.querySelector('input[type="date"]'), p.date || p.order_date);
        setVal(document.querySelector('input[placeholder*="Client Manager Email"]'), p.clientManagerEmail);
        setVal(document.querySelector('select'), p.currency || "USD");

        // Rows
        const rows = document.querySelectorAll('input[placeholder*="Line Item Number"]');
        li.forEach((item, i) => {
            if (rows[i]) {
                const container = rows[i].closest('div').parentElement;
                const ins = container.querySelectorAll('input');
                setVal(ins[0], item.lineItemNumber);
                setVal(ins[1], item.description);
                setVal(ins[2], item.price);
                setVal(ins[3], item.quantity);
            }
        });
        console.log("[SOW] Prefill Finished");
    }

    start();
})();
    `);
});

mongoose.connect(process.env.DB_URL || "mongodb://localhost:27017/signUp")
    .then(() => console.log("DB Connected"))
    .catch(err => console.log("DB Error", err));

app.listen(port, () => console.log(`Server running on port \${port}`));