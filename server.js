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
      agentResponseContext: "SOW data stored. Redirecting..."
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// --------------------
// GET /sow-data/:token
// --------------------
app.get("/sow-data/:token", async (req, res) => {
  try {
    const record = await SOW.findOne({ token: req.params.token });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "Token expired or not found."
      });
    }

    return res.status(200).json({
      success: true,
      data: record.payload
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
      return res.status(404).send("Link expired. Please regenerate.");
    }

    const sowJson = JSON.stringify(record.payload)
      .replace(/<\/script>/gi, "<\\/script>");

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Redirecting...</title>
    </head>
    <body style="font-family:sans-serif;text-align:center;padding-top:50px;">
        <h3>Preparing SOW Data...</h3>
        <script>
            window.name = JSON.stringify({
                __sow__: ${sowJson},
                __token__: "${token}"
            });

            window.location.replace(
              "https://vithiit-careers-dev.mercuryx.cloud/dashboard/page/create-csod-sow#sow_token=${token}"
            );
        </script>
    </body>
    </html>
    `);

  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
});

// --------------------
// Health Check Route
// --------------------
app.get("/", (req, res) => {
  res.send("🚀 SOW Bridge Server Running");
});

// --------------------
// Start Server
// --------------------
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});