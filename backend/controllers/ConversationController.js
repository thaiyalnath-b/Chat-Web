const Conversation = require("../models/Conversation");
const User = require("../models/User");
const Message = require("../models/Message");

// GET /api/conversations - get all conversations for the current user
const getUserConversations = async (req, res) => {
    try {
        const { email } = req.query;

        const conversations = await Conversation.find({
            participants: email
        }).sort({ "lastMessage.createdAt": -1 });

        // Enrich each conversation with the other participant's user info
        const enriched = await Promise.all(
            conversations.map(async (conv) => {
                const otherEmail = conv.participants.find(p => p !== email);
                const otherUser = await User.findOne({ email: otherEmail });

                return {
                    _id: conv._id,
                    participants: conv.participants,
                    lastMessage: conv.lastMessage,
                    unreadCount: conv.unreadCounts?.get(email) || 0,
                    updatedAt: conv.updatedAt,
                    otherUser: otherUser
                        ? {
                            name: otherUser.name,
                            email: otherUser.email,
                            profilePic: otherUser.profilePic,
                            isOnline: otherUser.isOnline
                        }
                        : null
                };
            })
        );

        res.status(200).json(enriched);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/conversations - create or get existing conversation
const createOrGetConversation = async (req, res) => {
    try {
        const { currentUserEmail, otherUserEmail } = req.body;

        // Check if other user exists
        const otherUser = await User.findOne({ email: otherUserEmail });
        if (!otherUser) {
            return res.status(404).json({ message: "This user is not registered on this platform." });
        }

        // Check if conversation already exists (either order of participants)
        let conversation = await Conversation.findOne({
            participants: { $all: [currentUserEmail, otherUserEmail] }
        });

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [currentUserEmail, otherUserEmail],
                lastMessage: { text: "", senderEmail: "", createdAt: new Date() },
                unreadCounts: {}
            });
        }

        res.status(200).json({
            _id: conversation._id,
            participants: conversation.participants,
            lastMessage: conversation.lastMessage,
            unreadCount: 0,
            updatedAt: conversation.updatedAt,
            otherUser: {
                name: otherUser.name,
                email: otherUser.email,
                profilePic: otherUser.profilePic,
                isOnline: otherUser.isOnline
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PATCH /api/conversations/:id/read - mark conversation as read for a user
const markConversationRead = async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body;

        const conversation = await Conversation.findById(id);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        // Reset unread count for this user
        conversation.unreadCounts.set(email, 0);
        await conversation.save();

        // Mark all messages in this conversation as read for this user
        await Message.updateMany(
            {
                conversationId: id,
                receiverEmail: email,
                isRead: false
            },
            { isRead: true }
        );

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/users/search - search users by email or name
const searchUsers = async (req, res) => {
    try {
        const { query, currentEmail } = req.query;

        if (!query || query.trim().length < 2) {
            return res.status(200).json([]);
        }

        const users = await User.find({
            email: { $ne: currentEmail },
            $or: [
                { email: { $regex: query, $options: "i" } },
                { name: { $regex: query, $options: "i" } }
            ]
        }).limit(5);

        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getUserConversations,
    createOrGetConversation,
    markConversationRead,
    searchUsers
};