const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const crypto = require("crypto");

dotenv.config();
const app = express();
const port = process.env.PORT || 8005;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.DB_URL || "mongodb://localhost:27017/signUp")
  .then(() => console.log("✅ DB Connected"))
  .catch(err => console.log("❌ DB Error", err));

const SOWSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  payload: { type: Object, required: true },
  createdAt: { type: Date, default: Date.now, expires: 900 }
});
const SOW = mongoose.model("SOW", SOWSchema);

app.post("/create-sow/", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload) return res.status(400).json({ success: false, error: "Payload required." });

    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.get("host");
    const baseUrl = `${protocol}://${host}`;
    const token = crypto.randomBytes(16).toString("hex");

    await SOW.create({ token, payload });

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

app.get("/go/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const record = await SOW.findOne({ token });

    if (!record) return res.status(404).send("Link expired.");

    // --- MAPPING LOGIC FOR NESTED PAYLOAD ---
    const { parent_input, lines_input } = record.payload;
    const firstLine = lines_input && lines_input.length > 0 ? lines_input[0] : {};

    // Standardize Date for React (YYYY-MM-DD)
    let formattedDate = "";
    if (parent_input?.date) {
      const d = new Date(parent_input.date);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toISOString().split('T')[0];
      }
    }

    const queryParams = new URLSearchParams({
      poNumber: parent_input?.poNumber || "",
      orderDate: formattedDate,
      invoiceAmount: parent_input?.invoiceAmount || "",
      currency: parent_input?.currency || "USD",
      clientManager: parent_input?.clientManager || "",
      clientManagerEmail: parent_input?.clientManagerEmail || "",
      customerAccountNumber: parent_input?.customerAccNumber || "",
      // Line Item mapping
      lineItemNumber: firstLine.lineItemNumber || "",
      lineItemDescription: firstLine.description || "",
      price: firstLine.price || "55",
      quantity: firstLine.quantity || "0",
      amount: firstLine.amount || "0",
      billing: firstLine.billing || "PER_HOUR",
      sow_token: token
    }).toString();

    const redirectUrl = `https://vithiit-careers-dev.mercuryx.cloud/dashboard/page/create-csod-sow?${queryParams}`;
    return res.redirect(redirectUrl);

  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => console.log(`🚀 Server running on port ${port}`));