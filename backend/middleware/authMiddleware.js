const admin = require("../config/firebaseAdmin");

const protect = async (req, res, next) => {

    try {

        const authHeader = req.headers.authorization;

        if (!authHeader) {

            return res.status(401).json({
                message: "No token"
            });
        }

        // Remove "Bearer "
        const token = authHeader.split(" ")[1];

        // Verify token
        const decodedToken = await admin
            .auth()
            .verifyIdToken(token);

        req.user = decodedToken;

        next();

    } catch (error) {

        console.log("FIREBASE VERIFY ERROR:", error.message);

        res.status(401).json({
            message: "Unauthorized"
        });

    }
};

module.exports = protect;