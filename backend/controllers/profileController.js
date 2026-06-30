const profileService = require("../services/profileService");

const getProfile = async (req, res) => {
    try {
        const result = await profileService.getProfile(req.user);

        if (!result.found) {
            return res.status(404).json({
                success: false,
                message: "User profile not found."
            });
        }

        return res.status(200).json({
            success: true,
            data: result.profile
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { fullName, bio, profilePicture } = req.body;

        const result = await profileService.updateProfile(req.user, {
            fullName,
            bio,
            profilePicture
        });

        if (!result.success) {
            return res.status(result.statusCode).json({
                success: false,
                message: result.message
            });
        }

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: result.profile
        });
    } catch (error) {
        console.error("UPDATE PROFILE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getProfile,
    updateProfile
};
