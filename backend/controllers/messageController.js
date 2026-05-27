const Message = require("../models/Message");

const getMessages = async (req, res) => {

    try {

        const { senderEmail, receiverEmail } = req.query;

        const messages = await Message.find({

            $or: [

                {
                    senderEmail,
                    receiverEmail
                },

                {
                    senderEmail: receiverEmail,
                    receiverEmail: senderEmail
                }

            ]

        }).sort({ createdAt: 1 });

        res.status(200).json(messages);

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }
};

module.exports = { getMessages };