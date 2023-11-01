const express = require("express");
const controllers = require("../controllers/user");
const app = express();
const router = express.Router();

router.post('/register', controllers.register);
router.post('/verify', controllers.verify);
router.post("/login", controllers.login);
router.post("/delete", controllers.delete);
router.post("/forgetPassword", controllers.forgetPassword);
router.post("/resetPassword", controllers.resetPassword);
router.post("/update", controllers.update);
module.exports = router;
