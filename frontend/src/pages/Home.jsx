import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import socket from "../socket/socket";
import API from "../services/api";
import { getProfile } from "../services/profileService";
import { Dropdown } from "antd";
import { UserOutlined, LogoutOutlined } from "@ant-design/icons";
import "../styles/chat.css";
import Loading from "./Loading";
import { useNavigate } from "react-router-dom";

function Home() {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [activeFilter, setActiveFilter] = useState("all");
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true); // ← ADD HERE

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMode, setSearchMode] = useState(false);
    const [searchError, setSearchError] = useState("");

    const messagesEndRef = useRef(null);
    const searchTimeoutRef = useRef(null);
    const navigate = useNavigate();

    // ─── Helpers ─────────────────────────────────────────────────────────────

    const formatTime = (date) => {
        if (!date) return "";
        const d = new Date(date);
        const now = new Date();
        const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } else if (diffDays === 1) {
            return "Yesterday";
        } else if (diffDays < 7) {
            return d.toLocaleDateString([], { weekday: "short" });
        } else {
            return d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" });
        }
    };

    const truncate = (text, len = 38) =>
        text && text.length > len ? text.slice(0, len) + "…" : text || "";

    const displayName = userProfile?.fullName || currentUser?.displayName || "User";
    const displayEmail = userProfile?.email || currentUser?.email || "";
    const displayAvatar =
        userProfile?.profilePicture ||
        currentUser?.photoURL ||
        "";

    const getInitials = (name = "") => {
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return "U";
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    };

    const userMenuItems = useMemo(() => ([
        {
            key: "profile",
            label: "Profile",
            icon: <UserOutlined />
        },
        {
            key: "logout",
            label: "Logout",
            icon: <LogoutOutlined />,
            danger: true
        }
    ]), []);

    const handleUserMenuClick = ({ key }) => {
        if (key === "profile") {
            navigate("/profile");
            return;
        }

        if (key === "logout") {
            setShowLogoutModal(true);
        }
    };

    const upsertConversation = useCallback((updatedConv) => {
        setConversations((prev) => {
            const exists = prev.find((c) => c._id === updatedConv._id);
            if (exists) {
                const updated = prev.map((c) =>
                    c._id === updatedConv._id ? { ...c, ...updatedConv } : c
                );
                return updated.sort(
                    (a, b) =>
                        new Date(b.lastMessage?.createdAt || b.updatedAt) -
                        new Date(a.lastMessage?.createdAt || a.updatedAt)
                );
            } else {
                return [updatedConv, ...prev];
            }
        });
    }, []);

    // ─── Auth ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                if (!socket.connected) socket.connect();
                socket.emit("register_user", user.email);
            }
        });
        return () => unsubscribe();
    }, []);

    // ─── Load user profile ────────────────────────────────────────────────────
    const fetchUserProfile = useCallback(async () => {
        if (!currentUser) return;

        try {
            const response = await getProfile();
            if (response.success) {
                setUserProfile(response.data);
            }
        } catch (err) {
            console.log(err);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchUserProfile();
    }, [fetchUserProfile]);

    useEffect(() => {
        const handleProfileUpdated = (event) => {
            setUserProfile(event.detail);
        };

        window.addEventListener("profileUpdated", handleProfileUpdated);
        return () => window.removeEventListener("profileUpdated", handleProfileUpdated);
    }, []);

    // ─── Load conversations ───────────────────────────────────────────────────
    useEffect(() => {
        if (!currentUser) return;
        const fetch = async () => {
            try {
                const res = await API.get("/conversations", {
                    params: { email: currentUser.email }
                });
                setConversations(res.data);
            } catch (err) {
                console.log(err);
            }
        };
        fetch();
    }, [currentUser]);

    // ─── Fetch messages when conversation selected ───────────────────────────
    useEffect(() => {
        if (!selectedConversation || !currentUser) return;
        const fetch = async () => {
            try {
                const res = await API.get("/messages", {
                    params: { conversationId: selectedConversation._id }
                });
                setMessages(res.data);
            } catch (err) {
                console.log(err);
            }
        };
        fetch();

        socket.emit("mark_read", {
            conversationId: selectedConversation._id,
            email: currentUser.email
        });

        setConversations((prev) =>
            prev.map((c) =>
                c._id === selectedConversation._id ? { ...c, unreadCount: 0 } : c
            )
        );
    }, [selectedConversation, currentUser]);

    // ─── Socket events ────────────────────────────────────────────────────────
    useEffect(() => {
        socket.on("receive_message", (data) => {
            if (selectedConversation && data.conversationId === selectedConversation._id) {
                setMessages((prev) => [...prev, data]);
                socket.emit("mark_read", {
                    conversationId: selectedConversation._id,
                    email: currentUser?.email
                });
            }
        });
        return () => socket.off("receive_message");
    }, [selectedConversation, currentUser]);

    useEffect(() => {
        socket.on("conversation_updated", ({ conversation }) => {
            upsertConversation(conversation);
        });
        return () => socket.off("conversation_updated");
    }, [upsertConversation]);

    useEffect(() => {
        if (!conversations.length) return;

        const lastConversationId = localStorage.getItem("lastConversationId");
        if (!lastConversationId) return;

        const conversation = conversations.find((c) => c._id === lastConversationId);
        if (conversation && selectedConversation?._id !== conversation._id) {
            setSelectedConversation(conversation);
        }
    }, [conversations, selectedConversation]);

    useEffect(() => {
        socket.on("messages_read", ({ conversationId }) => {
            setConversations((prev) =>
                prev.map((c) =>
                    c._id === conversationId ? { ...c, unreadCount: 0 } : c
                )
            );
        });
        return () => socket.off("messages_read");
    }, []);

    useEffect(() => {
        socket.on("online_users", (users) => {
            setOnlineUsers(users);
            setConversations((prev) =>
                prev.map((c) => ({
                    ...c,
                    otherUser: c.otherUser
                        ? { ...c.otherUser, isOnline: users.includes(c.otherUser.email) }
                        : c.otherUser
                }))
            );
        });
        return () => socket.off("online_users");
    }, []);

    // ─── Auto scroll ──────────────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // ─── Search ───────────────────────────────────────────────────────────────
    const handleSearchChange = (e) => {
        const q = e.target.value;
        setSearchQuery(q);
        setSearchError("");

        if (!q.trim()) {
            setSearchMode(false);
            setSearchResults([]);
            clearTimeout(searchTimeoutRef.current);
            return;
        }

        setSearchMode(true);
        setIsSearching(true);

        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const res = await API.get("/conversations/search", {
                    params: { query: q, currentEmail: currentUser.email }
                });
                setSearchResults(res.data);
                if (res.data.length === 0) {
                    setSearchError("This user is not registered on this platform.");
                }
            } catch (err) {
                console.log(err);
            } finally {
                setIsSearching(false);
            }
        }, 350);
    };

    const clearSearch = () => {
        setSearchQuery("");
        setSearchMode(false);
        setSearchResults([]);
        setSearchError("");
    };

    const startConversation = async (otherUser) => {
        try {
            const res = await API.post("/conversations", {
                currentUserEmail: currentUser.email,
                otherUserEmail: otherUser.email
            });
            clearSearch();
            upsertConversation(res.data);
            setSelectedConversation(res.data);
            setMobileSidebarOpen(false); // ← ADD HERE (after startConversation)
        } catch (err) {
            if (err.response?.status === 404) {
                setSearchError("This user is not registered on this platform.");
            }
        }
    };

    // ─── Send message ─────────────────────────────────────────────────────────
    const sendMessage = () => {
        if (!message.trim() || !selectedConversation) return;

        const messageData = {
            senderEmail: currentUser.email,
            receiverEmail: selectedConversation.otherUser.email,
            message: message.trim(),
            conversationId: selectedConversation._id,
            createdAt: new Date()
        };

        socket.emit("send_message", messageData);
        setMessages((prev) => [...prev, messageData]);

        upsertConversation({
            ...selectedConversation,
            lastMessage: {
                text: message.trim(),
                senderEmail: currentUser.email,
                createdAt: new Date()
            }
        });

        setMessage("");
    };

    // ─── Logout ───────────────────────────────────────────────────────────────
    const handleLogout = async () => {

        try {

            localStorage.removeItem(
                "lastConversationId"
            );

            socket.emit(
                "user_offline",
                currentUser.email
            );

            await signOut(auth);

            navigate("/login");

        } catch (error) {
            console.log(error);
        }
    };

    // ─── Filter conversations ─────────────────────────────────────────────────
    const filteredConversations = conversations.filter((c) => {
        if (activeFilter === "unread") return c.unreadCount > 0;
        if (activeFilter === "read") return !c.unreadCount || c.unreadCount === 0;
        return true;
    });

    // ─── Loading ──────────────────────────────────────────────────────────────
    if (!currentUser) {
        return <Loading />;
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="chat-app">

            {/* ── SIDEBAR ── */}
            {/* ↓ ADD sidebar--hidden class toggle for mobile */}
            <div className={`sidebar${!mobileSidebarOpen ? " sidebar--hidden" : ""}`}>

                {/* Sidebar Header */}
                <div className="sidebar-header">
                    <div className="d-flex align-items-center justify-content-between w-100">
                        <Dropdown
                            menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
                            trigger={["click"]}
                            placement="bottomRight"
                        >
                            <button type="button" className="user-menu-trigger">
                                {displayAvatar ? (
                                    <img
                                        src={displayAvatar}
                                        alt="profile"
                                        className="profile-image"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <div className="profile-image profile-image-fallback">
                                        {getInitials(displayName)}
                                    </div>
                                )}
                                <div className="user-metadata">
                                    <h6 className="mb-0">{displayName}</h6>
                                    <small>{displayEmail}</small>
                                </div>
                            </button>
                        </Dropdown>
                        <button
                            className="logout-btn"
                            onClick={() => setShowLogoutModal(true)}
                            title="Logout"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="search-container">
                    <div className="search-input-wrapper">
                        <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search by name or email…"
                            value={searchQuery}
                            onChange={handleSearchChange}
                        />
                        {searchQuery && (
                            <button className="search-clear-btn" onClick={clearSearch}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Tabs */}
                {!searchMode && (
                    <div className="filter-tabs">
                        {["all", "unread", "read"].map((tab) => {
                            const unreadTotal = conversations.filter(c => c.unreadCount > 0).length;
                            return (
                                <button
                                    key={tab}
                                    className={`filter-tab ${activeFilter === tab ? "active" : ""}`}
                                    onClick={() => setActiveFilter(tab)}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                    {tab === "unread" && unreadTotal > 0 && (
                                        <span className="filter-badge">{unreadTotal}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Conversation / Search List */}
                <div className="sidebar-users">

                    {/* ── SEARCH MODE ── */}
                    {searchMode && (
                        <>
                            {isSearching && (
                                <div className="search-state-msg">
                                    <div className="mini-spinner"></div>
                                    <span>Searching…</span>
                                </div>
                            )}

                            {!isSearching && searchResults.length > 0 && (
                                <>
                                    <p className="search-results-label">Search results</p>
                                    {searchResults.map((user) => (
                                        <div
                                            key={user._id}
                                            className="user-item search-result-item"
                                            onClick={() => startConversation(user)}
                                        >
                                            <div className="profile-image-container">
                                                <img
                                                    src={user.profilePic}
                                                    alt="profile"
                                                    className="profile-image"
                                                    referrerPolicy="no-referrer"
                                                />
                                                <span className={`status-badge ${onlineUsers.includes(user.email) ? "online" : "offline"}`}></span>
                                            </div>
                                            <div className="flex-grow-1 user-info-block">
                                                <div className="user-row-header">
                                                    <h6 className="mb-0 user-name-text">{user.name}</h6>
                                                </div>
                                                <small className="user-email-text">{user.email}</small>
                                            </div>
                                            <div className="start-chat-chip">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                                </svg>
                                                Chat
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}

                            {!isSearching && searchResults.length === 0 && searchError && (
                                <div className="search-empty-state">
                                    <div className="search-empty-icon">
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="11" cy="11" r="8"></circle>
                                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                            <line x1="8" y1="11" x2="14" y2="11"></line>
                                        </svg>
                                    </div>
                                    <p>{searchError}</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── CONVERSATION MODE ── */}
                    {!searchMode && (
                        <>
                            {filteredConversations.length === 0 ? (
                                <div className="empty-conversations">
                                    {activeFilter === "all" ? (
                                        <>
                                            <div className="empty-icon-wrap">
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="11" cy="11" r="8"></circle>
                                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                                </svg>
                                            </div>
                                            <h5>No conversations yet</h5>
                                            <p>Search for a user to start a conversation.</p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="empty-icon-wrap">
                                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                                </svg>
                                            </div>
                                            <p>No {activeFilter} conversations.</p>
                                        </>
                                    )}
                                </div>
                            ) : (
                                filteredConversations.map((conv) => {
                                    const isActive = selectedConversation?._id === conv._id;
                                    const isOnline = onlineUsers.includes(conv.otherUser?.email);
                                    const hasUnread = conv.unreadCount > 0;

                                    return (
                                        <div
                                            key={conv._id}
                                            className={`user-item conversation-item ${isActive ? "active-user" : ""} ${hasUnread ? "has-unread" : ""}`}
                                            // ↓ ADD setMobileSidebarOpen(false) here
                                            onClick={() => {

                                                localStorage.setItem(
                                                    "lastConversationId",
                                                    conv._id
                                                );

                                                setSelectedConversation(conv);

                                                setMobileSidebarOpen(false);
                                            }}
                                        >
                                            <div className="profile-image-container">
                                                <img
                                                    src={conv.otherUser?.profilePic}
                                                    alt="profile"
                                                    className="profile-image"
                                                    referrerPolicy="no-referrer"
                                                />
                                                <span className={`status-badge ${isOnline ? "online" : "offline"}`}></span>
                                            </div>

                                            <div className="flex-grow-1 user-info-block">
                                                <div className="user-row-header">
                                                    <h6 className={`mb-0 user-name-text ${hasUnread ? "unread-name" : ""}`}>
                                                        {conv.otherUser?.name}
                                                    </h6>
                                                    <span className="conv-time">
                                                        {formatTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                                                    </span>
                                                </div>
                                                <div className="user-row-sub">
                                                    <small className={`last-message-preview ${hasUnread ? "unread-preview" : ""}`}>
                                                        {conv.lastMessage?.senderEmail === currentUser.email && conv.lastMessage?.text
                                                            ? `You: ${truncate(conv.lastMessage.text, 28)}`
                                                            : truncate(conv.lastMessage?.text) || "Start a conversation"}
                                                    </small>
                                                    {hasUnread && (
                                                        <span className="unread-badge">
                                                            {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── CHAT AREA ── */}
            <div className="chat-section">
                {selectedConversation ? (
                    <>
                        {/* Chat Header */}
                        <div className="chat-header">
                            <div className="d-flex align-items-center">

                                {/* ↓ BACK BUTTON — only visible on mobile via CSS */}
                                <button
                                    className="chat-back-btn"
                                    onClick={() => setMobileSidebarOpen(true)}
                                    title="Back"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="15 18 9 12 15 6"></polyline>
                                    </svg>
                                </button>

                                <div className="profile-image-container">
                                    <img
                                        src={selectedConversation.otherUser?.profilePic}
                                        alt="profile"
                                        className="profile-image"
                                        referrerPolicy="no-referrer"
                                    />
                                    <span className={`status-badge ${onlineUsers.includes(selectedConversation.otherUser?.email) ? "online" : "offline"}`}></span>
                                </div>
                                <div className="user-metadata">
                                    <h6 className="mb-0">{selectedConversation.otherUser?.name}</h6>
                                    <small className={onlineUsers.includes(selectedConversation.otherUser?.email) ? "text-success" : "text-secondary"}>
                                        {onlineUsers.includes(selectedConversation.otherUser?.email) ? "Active Now" : "Offline"}
                                    </small>
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="chat-messages">
                            {messages.map((msg, index) => {
                                const isMyMessage = msg.senderEmail === currentUser.email;
                                return (
                                    <div
                                        key={index}
                                        className={`message-wrapper ${isMyMessage ? "my-message" : "other-message"}`}
                                    >
                                        <div className={`message-bubble ${isMyMessage ? "my-bubble" : "other-bubble"}`}>
                                            <div className="message-text-content">{msg.message}</div>
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

                        {/* Input */}
                        <div className="chat-input-area">
                            <input
                                type="text"
                                className="form-control chat-input-field"
                                placeholder="Type a message..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
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
                        <h3>Select a conversation</h3>
                        <p>Search for a user or pick a conversation from the sidebar to get started.</p>
                    </div>
                )}
            </div>

            {/* ── LOGOUT MODAL ── */}
            {showLogoutModal && (
                <div className="logout-modal-overlay">
                    <div className="logout-modal">
                        <div className="logout-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </div>
                        <h4>Logout Session</h4>
                        <p>Are you sure you want to sign out of your account? You can sign back in anytime.</p>
                        <div className="logout-modal-actions">
                            <button className="cancel-btn" onClick={() => setShowLogoutModal(false)}>Cancel</button>
                            <button className="confirm-btn" onClick={handleLogout}>Continue Logout</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Home;