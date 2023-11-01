

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();
const app = express();
const port = 8005;


// for parsing application/json
app.use(express.json());
//connecting with mongodb
console.log("process env", process.env.DB_URL);

mongoose
  .connect(process.env.DB_URL || "mongodb://localhost:27017/signUp")
  .then(() => {
    console.log({ msg: "database connected successfully", status: true });
  })
  .catch((error) => {
    console.log({ msg: "failed to connect db", status: false });
  });
const auth= require("./src/routes/auth");
app.use("/user", auth);
app.get('/', (req, res) => {
  console.log("server is ok..!!!");
})
//connecting with server 
app.listen(port, () => {
    console.log(`server runs at ${port}`);
})
