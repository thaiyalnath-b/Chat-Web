const Message = require("../models/Message");

const getMessages = async (req, res) => {
    try {

        console.log("===== GET MESSAGES API HIT =====");
        console.log("QUERY:", req.query);

        const { senderEmail, receiverEmail, conversationId } = req.query;

        let query;

        if (conversationId) {
            query = { conversationId };
        } else {
            query = {
                $or: [
                    { senderEmail, receiverEmail },
                    { senderEmail: receiverEmail, receiverEmail: senderEmail }
                ]
            };
        }

        console.log("Mongo Query:", query);

        const messages = await Message.find(query)
            .sort({ createdAt: 1 });

        console.log("Messages Found:", messages.length);

        res.status(200).json(messages);

    } catch (error) {

        console.log("GET MESSAGE ERROR:", error);

        res.status(500).json({
            message: error.message
        });
    }
};

module.exports = { getMessages };