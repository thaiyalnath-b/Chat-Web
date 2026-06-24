import { io } from "socket.io-client";

// Create socket with autoConnect disabled so only authorized app code connects.
const socket = io(import.meta.env.VITE_SOCKET_URL, { autoConnect: false });

export default socket;