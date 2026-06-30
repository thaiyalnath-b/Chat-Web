const express = require("express");

const router = express.Router();

const { getUsers } = require("../controllers/userController");
const profileRoutes = require("./profileRoutes");
const protect = require("../middleware/authMiddleware");

router.use("/", profileRoutes);
router.get("/", protect, getUsers);

module.exports = router;