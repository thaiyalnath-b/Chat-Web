const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

    firebaseUid: {
        type: String,
        required: true
    },

    name: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    profilePic: {
        type: String
    },

    isOnline: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("User", userSchema);