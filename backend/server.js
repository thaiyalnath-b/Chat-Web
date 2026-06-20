const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");

const { Server } = require("socket.io");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");
const conversationRoutes = require("./routes/Conversationroutes");

const Message = require("./models/Message");
const User = require("./models/User");
const Conversation = require("./models/Conversation");

dotenv.config();

connectDB();

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [
            process.env.FRONTEND_URL,
            process.env.FRONTEND_NETWORK_URL
        ],
        methods: ["GET", "POST", "PATCH"]
    }
});

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/conversations", conversationRoutes);

app.get("/", (req, res) => {
    res.send("Backend Running");
});

// socket.id → email map
const users = {};

io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);

    socket.on("register_user", async (email) => {
        console.log("Registered:", email);
        users[email] = socket.id;

        await User.findOneAndUpdate({ email }, { isOnline: true });

        io.emit("online_users", Object.keys(users));
    });

    socket.on("send_message", async (data) => {
        const { senderEmail, receiverEmail, message, conversationId } = data;

        // Save message to DB
        const savedMessage = await Message.create({
            senderEmail,
            receiverEmail,
            message,
            conversationId,
            isRead: false
        });

        // Update conversation: last message + increment unread for receiver
        const conversation = await Conversation.findById(conversationId);
        if (conversation) {
            conversation.lastMessage = {
                text: message,
                senderEmail,
                createdAt: new Date()
            };

            // Increment unread count for receiver (only if receiver hasn't opened chat)
            const safeReceiverEmail = receiverEmail.replace(/\./g, "_");

            const currentUnread =
                conversation.unreadCounts.get(safeReceiverEmail) || 0;

            conversation.unreadCounts.set(
                safeReceiverEmail,
                currentUnread + 1
            );

            await conversation.save();
        }

        // Fetch enriched conversation data to broadcast
        const updatedConv = await buildConversationPayload(conversationId, senderEmail, receiverEmail);

        // Emit message to receiver
        const receiverSocketId = users[receiverEmail];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("receive_message", {
                ...savedMessage.toObject(),
                conversationId
            });

            // Send conversation update to receiver
            io.to(receiverSocketId).emit("conversation_updated", {
                conversation: updatedConv.forReceiver,
                receiverEmail
            });
        }

        // Send conversation update to sender too (for re-sorting, last message preview)
        const senderSocketId = users[senderEmail];
        if (senderSocketId) {
            io.to(senderSocketId).emit("conversation_updated", {
                conversation: updatedConv.forSender,
                receiverEmail: senderEmail
            });
        }
    });

    socket.on("mark_read", async ({ conversationId, email }) => {
        const conversation = await Conversation.findById(conversationId);
        if (conversation) {
            const safeEmail = email.replace(/\./g, "_");

            conversation.unreadCounts.set(
                safeEmail,
                0
            );
            await conversation.save();

            await Message.updateMany(
                { conversationId, receiverEmail: email, isRead: false },
                { isRead: true }
            );

            // Notify this user their read status updated
            const socketId = users[email];
            if (socketId) {
                io.to(socketId).emit("messages_read", { conversationId });
            }
        }
    });

    socket.on("user_offline", async (email) => {
        console.log("User Offline:", email);

        await User.findOneAndUpdate(
            { email },
            { isOnline: false }
        );

        delete users[email];

        io.emit(
            "online_users",
            Object.keys(users)
        );
    });

    socket.on("disconnect", async () => {
        console.log("User Disconnected:", socket.id);

        for (const email in users) {
            if (users[email] === socket.id) {
                await User.findOneAndUpdate({ email }, { isOnline: false });
                delete users[email];
            }
        }

        io.emit("online_users", Object.keys(users));
    });


});

// Helper: build conversation payload for both sender and receiver
async function buildConversationPayload(conversationId, senderEmail, receiverEmail) {
    const conversation = await Conversation.findById(conversationId);

    const senderUser = await User.findOne({ email: senderEmail });
    const receiverUser = await User.findOne({ email: receiverEmail });

    const base = {
        _id: conversation._id,
        participants: conversation.participants,
        lastMessage: conversation.lastMessage,
        updatedAt: conversation.updatedAt
    };

    return {
        forSender: {
            ...base,
            unreadCount: 0,
            otherUser: receiverUser
                ? { name: receiverUser.name, email: receiverUser.email, profilePic: receiverUser.profilePic, isOnline: receiverUser.isOnline }
                : null
        },
        forReceiver: {
            ...base,
            unreadCount:
                conversation.unreadCounts.get(
                    receiverEmail.replace(/\./g, "_")
                ) || 0,
            otherUser: senderUser
                ? { name: senderUser.name, email: senderUser.email, profilePic: senderUser.profilePic, isOnline: senderUser.isOnline }
                : null
        }
    };
}

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});