const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");

const {
    getUserConversations,
    createOrGetConversation,
    markConversationRead,
    searchUsers
} = require("../controllers/ConversationController");

// GET /api/conversations?email=xxx
router.get("/", protect, getUserConversations);

// POST /api/conversations
router.post("/", protect, createOrGetConversation);

// PATCH /api/conversations/:id/read
router.patch("/:id/read", protect, markConversationRead);

// GET /api/conversations/search?query=xxx&currentEmail=xxx
router.get("/search", protect, searchUsers);

module.exports = router;