const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

    firebaseUid: {
        type: String,
        required: true
    },

    fullName: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    profilePicture: {
        type: String,
        default: ""
    },

    bio: {
        type: String,
        default: "",
        maxlength: 500
    },

    // Legacy fields kept in sync for existing chat payloads
    name: {
        type: String
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

// Keep legacy fields aligned with profile fields
userSchema.pre("save", async function () {
    if (this.fullName) {
        this.name = this.fullName;
    }
    if (this.profilePicture !== undefined) {
        this.profilePic = this.profilePicture;
    }
});

module.exports = mongoose.model("User", userSchema);
