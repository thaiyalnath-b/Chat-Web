const User = require("../models/User");

const googleLogin = async (req, res) => {

    try {

        const { firebaseUid, name, fullName, email, profilePic, profilePicture } = req.body;

        const resolvedName = fullName || name;
        const resolvedPicture = profilePicture || profilePic || "";

        let user = await User.findOne({ email });

        if (!user) {

            user = await User.create({
                firebaseUid,
                fullName: resolvedName,
                name: resolvedName,
                email,
                profilePicture: resolvedPicture,
                profilePic: resolvedPicture
            });
        }

        res.status(200).json(user);

    } catch (error) {

        res.status(500).json({
            message: error.message
        });
    }
};

module.exports = { googleLogin };