const Message = require("../models/Message");

const getMessages = async (req, res) => {
    try {
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

        const messages = await Message.find(query).sort({ createdAt: 1 });

        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getMessages };