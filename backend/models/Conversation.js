const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({

    participants: [{
        type: String, // email addresses
        required: true
    }],

    lastMessage: {
        text: { type: String, default: "" },
        senderEmail: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now }
    },

    // Track unread counts per participant: { "user@email.com": 3 }
    unreadCounts: {
        type: Map,
        of: Number,
        default: {}
    }

}, {
    timestamps: true
});

// Index for fast lookups by participant
conversationSchema.index({ participants: 1 });

module.exports = mongoose.model("Conversation", conversationSchema);