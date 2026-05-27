const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");

const { Server } = require("socket.io");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");

const Message = require("./models/Message");

const userRoutes = require("./routes/userRoutes");

const messageRoutes = require("./routes/messageRoutes");

const User = require("./models/User");

dotenv.config();

connectDB();

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

app.use(cors());

app.use(express.json());

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

app.use("/api/messages", messageRoutes);

app.get("/", (req, res) => {
    res.send("Backend Running");
});

const users = {};

io.on("connection", (socket) => {

    console.log("User Connected:", socket.id);

    socket.on("register_user", async (email) => {

        console.log("Registered:", email);

        users[email] = socket.id;

        // Update MongoDB
        await User.findOneAndUpdate(

            { email },

            { isOnline: true }

        );

        io.emit("online_users", Object.keys(users));

        console.log(users);

    });

    socket.on("send_message", async (data) => {

        const {
            senderEmail,
            receiverEmail,
            message
        } = data;

        // Save message in MongoDB
        await Message.create({
            senderEmail,
            receiverEmail,
            message
        });

        // Find receiver socket
        const receiverSocketId = users[receiverEmail];

        // Send only to receiver
        io.to(receiverSocketId).emit("receive_message", data);

    });

    socket.on("disconnect", async () => {

        console.log("User Disconnected:", socket.id);

        for (const email in users) {

            if (users[email] === socket.id) {

                // Update MongoDB
                await User.findOneAndUpdate(

                    { email },

                    { isOnline: false }

                );

                delete users[email];

            }
        }

        io.emit("online_users", Object.keys(users));

    });
});

const PORT = 5000;

server.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);

});