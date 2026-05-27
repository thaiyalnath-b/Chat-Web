import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import socket from "../socket/socket";
import API from "../services/api";
import "../styles/chat.css";
import { useNavigate } from "react-router-dom";

function Home() {
    const [currentUser, setCurrentUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [onlineUsers, setOnlineUsers] = useState([]);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    const handleLogout = async () => {

        try {

            socket.disconnect();

            await signOut(auth);

            navigate("/");

        } catch (error) {

            console.log(error);

        }
    };

    // Firebase auth
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                // If socket already connected
                if (socket.connected) {
                    socket.emit("register_user", user.email);
                }
                // If socket reconnects later
                socket.on("connect", () => {
                    socket.emit("register_user", user.email);
                });
            }
        });
        return () => unsubscribe();
    }, []);

    // Fetch users
    useEffect(() => {

        // Wait until Firebase auth restores user
        if (!currentUser) return;

        const fetchUsers = async () => {

            try {

                const res = await API.get("/users");

                setUsers(res.data);

            } catch (error) {

                console.log(error);

            }
        };

        fetchUsers();

    }, [currentUser]);

    // Fetch messages
    useEffect(() => {
        if (!selectedUser || !currentUser) return;
        const fetchMessages = async () => {
            try {
                const res = await API.get("/messages", {
                    params: {
                        senderEmail: currentUser.email,
                        receiverEmail: selectedUser.email
                    }
                });
                setMessages(res.data);
            } catch (error) {
                console.log(error);
            }
        };
        fetchMessages();
    }, [selectedUser, currentUser]);

    // Receive messages
    useEffect(() => {
        socket.on("receive_message", (data) => {
            if (
                selectedUser &&
                (
                    data.senderEmail === selectedUser.email ||
                    data.receiverEmail === selectedUser.email
                )
            ) {
                setMessages((prev) => [...prev, data]);
            }
        });
        return () => {
            socket.off("receive_message");
        };
    }, [selectedUser]);

    // Online users
    useEffect(() => {
        socket.on("online_users", (users) => {
            console.log("Online Users:", users);
            setOnlineUsers(users);
        });
        return () => {
            socket.off("online_users");
        };
    }, []);

    // Auto scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });
    }, [messages]);

    if (!currentUser) {
        return (
            <div className="chat-loading-screen">
                <div className="spinner"></div>
                <h1>Loading application...</h1>
            </div>
        );
    }

    // Send message
    const sendMessage = () => {
        if (!message || !selectedUser) return;

        const messageData = {
            senderEmail: currentUser.email,
            receiverEmail: selectedUser.email,
            message,
            createdAt: new Date()
        };

        socket.emit("send_message", messageData);
        setMessages((prev) => [...prev, messageData]);
        setMessage("");
    };

    return (
        <div className="chat-app">
            {/* SIDEBAR */}
            <div className="sidebar">
                {/* Sidebar Header */}
                <div className="sidebar-header">
                    <div className="d-flex align-items-center justify-content-between w-100">
                        <div className="d-flex align-items-center">
                            <img
                                src={currentUser.photoURL}
                                alt="profile"
                                className="profile-image"
                                referrerPolicy="no-referrer"
                            />
                            <div className="user-metadata">
                                <h6 className="mb-0">{currentUser.displayName}</h6>
                                <small>{currentUser.email}</small>
                            </div>
                        </div>
                        <button className="logout-btn" onClick={handleLogout} title="Logout">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Users List */}
                <div className="sidebar-users">
                    {users
                        .filter((user) => user.email !== currentUser.email)
                        .map((user) => {
                            const isOnline = onlineUsers.includes(user.email);
                            return (
                                <div
                                    key={user._id}
                                    className={`user-item ${selectedUser?.email === user.email ? "active-user" : ""}`}
                                    onClick={() => setSelectedUser(user)}
                                >
                                    <div className="profile-image-container">
                                        <img
                                            src={user.profilePic}
                                            alt="profile"
                                            className="profile-image"
                                            referrerPolicy="no-referrer"
                                        />
                                        <span className={`status-badge ${isOnline ? "online" : "offline"}`}></span>
                                    </div>

                                    <div className="flex-grow-1 user-info-block">
                                        <div className="user-row-header">
                                            <h6 className="mb-0 user-name-text">{user.name}</h6>
                                        </div>
                                        <div className="user-row-sub">
                                            <small className="user-email-text">{user.email}</small>
                                            <small className={`status-text ${isOnline ? "text-success" : "text-secondary"}`}>
                                                {isOnline ? "Online" : "Offline"}
                                            </small>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>

            {/* CHAT AREA */}
            <div className="chat-section">
                {selectedUser ? (
                    <>
                        {/* Chat Header */}
                        <div className="chat-header">
                            <div className="d-flex align-items-center">
                                <div className="profile-image-container">
                                    <img
                                        src={selectedUser.profilePic}
                                        alt="profile"
                                        className="profile-image"
                                        referrerPolicy="no-referrer"
                                    />
                                    <span className={`status-badge ${onlineUsers.includes(selectedUser.email) ? "online" : "offline"}`}></span>
                                </div>
                                <div className="user-metadata">
                                    <h6 className="mb-0">{selectedUser.name}</h6>
                                    <small className={onlineUsers.includes(selectedUser.email) ? "text-success" : "text-secondary"}>
                                        {onlineUsers.includes(selectedUser.email) ? "Active Now" : "Offline"}
                                    </small>
                                </div>
                            </div>
                        </div>

                        {/* Messages Grid */}
                        <div className="chat-messages">
                            {messages.map((msg, index) => {
                                const isMyMessage = msg.senderEmail === currentUser.email;
                                return (
                                    <div
                                        key={index}
                                        className={`message-wrapper ${isMyMessage ? "my-message" : "other-message"}`}
                                    >
                                        <div className={`message-bubble ${isMyMessage ? "my-bubble" : "other-bubble"}`}>
                                            <div className="message-text-content">
                                                {msg.message}
                                            </div>
                                            <div className="message-time">
                                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit"
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef}></div>
                        </div>

                        {/* Message Input Box */}
                        <div className="chat-input-area">
                            <input
                                type="text"
                                className="form-control chat-input-field"
                                placeholder="Type a message..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        sendMessage();
                                    }
                                }}
                            />
                            <button className="btn btn-primary chat-send-btn" onClick={sendMessage}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>

                            </button>
                        </div>
                    </>
                ) : (
                    <div className="no-chat-selected">
                        <div className="no-chat-icon-wrapper">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#221C35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </div>
                        <h3>Select a user to start chatting</h3>
                        <p>Secure connection initialized. Pick a thread from the side panel.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Home;