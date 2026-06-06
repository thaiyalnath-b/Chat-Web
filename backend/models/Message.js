const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({

    senderEmail: {
        type: String,
        required: true
    },

    receiverEmail: {
        type: String,
        required: true
    },

    message: {
        type: String,
        required: true
    },

    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation"
    },

    isRead: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Message", messageSchema);