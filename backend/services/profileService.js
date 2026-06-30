const User = require("../models/User");

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_FULL_NAME_LENGTH = 100;
const MAX_BIO_LENGTH = 500;

const formatProfileResponse = (user) => ({
    fullName: user.fullName || user.name || "",
    email: user.email,
    profilePicture: user.profilePicture || user.profilePic || "",
    bio: user.bio || "",
    createdAt: user.createdAt
});

const findUserByFirebaseToken = async (decodedToken) => {
    const user = await User.findOne({
        $or: [
            { email: decodedToken.email },
            { firebaseUid: decodedToken.uid }
        ]
    });

    return user;
};

const validateProfilePicture = (profilePicture) => {
    if (profilePicture === undefined || profilePicture === null || profilePicture === "") {
        return { valid: true, value: "" };
    }

    if (typeof profilePicture !== "string") {
        return { valid: false, message: "Profile picture must be a valid image URL or file." };
    }

    // Allow standard HTTP(S) URLs
    if (/^https?:\/\//i.test(profilePicture)) {
        return { valid: true, value: profilePicture.trim() };
    }

    // Allow base64 data URLs from the upload component
    const dataUrlMatch = profilePicture.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!dataUrlMatch) {
        return { valid: false, message: "Profile picture must be a JPEG, PNG, WEBP, or GIF image." };
    }

    const mimeType = dataUrlMatch[1].toLowerCase();
    const base64Data = dataUrlMatch[2];

    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
        return { valid: false, message: "Only JPEG, PNG, WEBP, and GIF images are allowed." };
    }

    const sizeInBytes = Buffer.byteLength(base64Data, "base64");
    if (sizeInBytes > MAX_IMAGE_SIZE_BYTES) {
        return { valid: false, message: "Profile picture must be smaller than 2MB." };
    }

    return { valid: true, value: profilePicture };
};

const validateProfileUpdate = ({ fullName, bio, profilePicture }) => {
    const errors = [];

    if (fullName !== undefined) {
        const trimmedName = fullName.trim();
        if (!trimmedName) {
            errors.push("Full name is required.");
        } else if (trimmedName.length > MAX_FULL_NAME_LENGTH) {
            errors.push(`Full name must be ${MAX_FULL_NAME_LENGTH} characters or fewer.`);
        }
    }

    if (bio !== undefined && bio.length > MAX_BIO_LENGTH) {
        errors.push(`Bio must be ${MAX_BIO_LENGTH} characters or fewer.`);
    }

    let validatedPicture = undefined;
    if (profilePicture !== undefined) {
        const pictureValidation = validateProfilePicture(profilePicture);
        if (!pictureValidation.valid) {
            errors.push(pictureValidation.message);
        } else {
            validatedPicture = pictureValidation.value;
        }
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return {
        valid: true,
        data: {
            ...(fullName !== undefined && { fullName: fullName.trim() }),
            ...(bio !== undefined && { bio: bio.trim() }),
            ...(validatedPicture !== undefined && { profilePicture: validatedPicture })
        }
    };
};

const getProfile = async (decodedToken) => {
    const user = await findUserByFirebaseToken(decodedToken);

    if (!user) {
        return { found: false };
    }

    return {
        found: true,
        profile: formatProfileResponse(user)
    };
};

const updateProfile = async (decodedToken, updateData) => {
    const validation = validateProfileUpdate(updateData);

    if (!validation.valid) {
        return {
            success: false,
            statusCode: 400,
            message: validation.errors.join(" ")
        };
    }

    const user = await findUserByFirebaseToken(decodedToken);

    if (!user) {
        return {
            success: false,
            statusCode: 404,
            message: "User profile not found."
        };
    }

    Object.assign(user, validation.data);
    await user.save();

    return {
        success: true,
        profile: formatProfileResponse(user)
    };
};

module.exports = {
    getProfile,
    updateProfile,
    formatProfileResponse
};
