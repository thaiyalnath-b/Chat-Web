const User = require("../models/User");

const googleLogin = async (req, res) => {

    try {

        const { firebaseUid, name, email, profilePic } = req.body;

        let user = await User.findOne({ email });

        if (!user) {

            user = await User.create({
                firebaseUid,
                name,
                email,
                profilePic
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