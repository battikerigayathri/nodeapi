const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const crypto = require("crypto");

dotenv.config();

const app = express();
const port = process.env.PORT || 8005;

// --------------------
// Middleware
// --------------------
app.use(cors());
app.use(express.json());

// --------------------
// MongoDB Connection
// --------------------
mongoose.connect(process.env.DB_URL || "mongodb://localhost:27017/signUp")
  .then(() => console.log("✅ DB Connected"))
  .catch(err => console.log("❌ DB Error", err));

// --------------------
// SOW Token Schema (TTL 15 Minutes)
// --------------------
const SOWSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  payload: { type: Object, required: true },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 900 // Auto delete after 15 minutes
  }
});

const SOW = mongoose.model("SOW", SOWSchema);

// --------------------
// POST /create-sow/
// --------------------
app.post("/create-sow/", async (req, res) => {
  try {
    const payload = req.body;

    if (!payload || !payload.parent_input) {
      return res.status(400).json({
        success: false,
        error: "parent_input is required."
      });
    }

    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.get("host");
    const baseUrl = `${protocol}://${host}`;

    const token = crypto.randomBytes(16).toString("hex");

    await SOW.create({
      token,
      payload
    });

    return res.status(200).json({
      success: true,
      token,
      redirect_url: `${baseUrl}/go/${token}`,
      agentResponseContext: "SOW data stored. Redirecting to form..."
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// --------------------
// GET /go/:token
// --------------------
app.get("/go/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const record = await SOW.findOne({ token });

    if (!record) {
      return res.status(404).send("Link expired or invalid. Please regenerate.");
    }

    const payload = record.payload;

    // --- CHANGE: Format Date for React Input ---
    // React's <input type="date" /> requires YYYY-MM-DD
    let formattedDate = "";
    if (payload.orderDate) {
      try {
        const d = new Date(payload.orderDate);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toISOString().split('T')[0];
        }
      } catch (e) {
        console.error("Date formatting error:", e);
      }
    }

    // Convert payload to URL query params
    const queryParams = new URLSearchParams({
      poNumber: payload.poNumber || "",
      orderDate: formattedDate, // Use sanitized date
      invoiceAmount: payload.invoiceAmount || "",
      currency: payload.currency || "USD",
      clientManager: payload.clientManager || "",
      clientManagerEmail: payload.clientManagerEmail || "",
      customerAccountNumber: payload.customerAccountNumber || "",
      // Line item fields (first row)
      lineItemNumber: payload.lineItemNumber || "",
      lineItemDescription: payload.lineItemDescription || "",
      price: payload.price || "55",
      quantity: payload.quantity || "0",
      amount: payload.amount || "0",
      billing: payload.billing || "PER_HOUR",
      sow_token: token
    }).toString();

    const redirectUrl = `https://vithiit-careers-dev.mercuryx.cloud/dashboard/page/create-csod-sow?${queryParams}`;

    return res.redirect(redirectUrl);

  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/", (req, res) => {
  res.send("🚀 SOW Bridge Server Running");
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});