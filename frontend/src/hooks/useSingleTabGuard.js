import { useEffect, useRef, useState, useCallback } from "react";

// Hook to coordinate a single active tab using localStorage + BroadcastChannel.
// - Uses `sessionStorage` to keep a stable `sessionId` across reloads in the same tab.
// - Stores a shared lock in `localStorage` under LOCK_KEY with an expiresAt timestamp.
// - Heartbeats update the lock so other tabs know the owner is still alive.
// - BroadcastChannel messages speed up coordination between tabs.

const LOCK_KEY = "chat_active_tab_v1";
const CHANNEL_NAME = "single-tab-guard";
const HEARTBEAT_INTERVAL = 2000; // ms
const LOCK_TTL = 7000; // ms (must be > heartbeat interval)

function now() {
  return Date.now();
}

function readLock() {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeLock(lock) {
  localStorage.setItem(LOCK_KEY, JSON.stringify(lock));
}

export default function useSingleTabGuard() {
  const [isActive, setIsActive] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const channelRef = useRef(null);
  const heartbeatRef = useRef(null);
  const sessionIdRef = useRef(null);

  // Ensure a stable sessionId across reloads in this tab
  if (!sessionIdRef.current) {
    let sid = sessionStorage.getItem("singleTabGuard.sessionId");
    if (!sid) {
      sid = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem("singleTabGuard.sessionId", sid);
    }
    sessionIdRef.current = sid;
  }

  const sessionId = sessionIdRef.current;

  const evaluateLock = useCallback(() => {
    const lock = readLock();
    const timestamp = now();
    if (!lock) {
      // try to acquire
      const newLock = { sessionId, ts: timestamp, expiresAt: timestamp + LOCK_TTL };
      try {
        writeLock(newLock);
        setIsActive(true);
        setIsBlocked(false);
      } catch (e) {
        setIsActive(false);
        setIsBlocked(true);
      }
      return;
    }

    // If lock belongs to this session (e.g., reload), keep it.
    if (lock.sessionId === sessionId) {
      // refresh expiry
      lock.expiresAt = timestamp + LOCK_TTL;
      lock.ts = timestamp;
      writeLock(lock);
      setIsActive(true);
      setIsBlocked(false);
      return;
    }

    // If lock expired, try to steal it.
    if (lock.expiresAt < timestamp) {
      const newLock = { sessionId, ts: timestamp, expiresAt: timestamp + LOCK_TTL };
      writeLock(newLock);
      channelRef.current?.postMessage({ type: "lock-acquired", sessionId });
      setIsActive(true);
      setIsBlocked(false);
      return;
    }

    // Otherwise someone else owns it
    setIsActive(false);
    setIsBlocked(true);
  }, [sessionId]);

  useEffect(() => {
    channelRef.current = new BroadcastChannel(CHANNEL_NAME);

    const channel = channelRef.current;

    const onMessage = (ev) => {
      const msg = ev.data || {};
      if (!msg || !msg.type) return;
      // react to other tab's lock changes
      if (msg.type === "lock-acquired" || msg.type === "lock-released" || msg.type === "heartbeat") {
        evaluateLock();
      }
      // if another tab asks who is active, respond
      if (msg.type === "who-is-active" && isActive) {
        channel.postMessage({ type: "lock-acquired", sessionId });
      }
    };

    channel.addEventListener("message", onMessage);

    // initial evaluation
    evaluateLock();

    // heartbeat to keep lock alive when we are owner
    heartbeatRef.current = setInterval(() => {
      const lock = readLock();
      if (lock && lock.sessionId === sessionId) {
        lock.expiresAt = now() + LOCK_TTL;
        lock.ts = now();
        try {
          writeLock(lock);
          channel.postMessage({ type: "heartbeat", sessionId });
          if (!isActive) {
            setIsActive(true);
            setIsBlocked(false);
          }
        } catch (e) {
          // ignore write errors
        }
      } else {
        // re-evaluate if we lost the lock
        evaluateLock();
      }
    }, HEARTBEAT_INTERVAL);

    // If tab becomes visible, ask who is active (helps reduce false-blocks after sleeps)
    const onVisibility = () => {
      if (!document.hidden) channel.postMessage({ type: "who-is-active" });
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      // cleanup
      channel.removeEventListener("message", onMessage);
      channel.close();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [evaluateLock, isActive, sessionId]);

  // Provide a manual release (useful for logout flows)
  const releaseLock = useCallback(() => {
    const lock = readLock();
    if (lock && lock.sessionId === sessionId) {
      try {
        localStorage.removeItem(LOCK_KEY);
      } catch (e) {
        // ignore
      }
      channelRef.current?.postMessage({ type: "lock-released", sessionId });
      setIsActive(false);
      setIsBlocked(true);
    }
  }, [sessionId]);

  return { isActive, isBlocked, releaseLock, sessionId };
}
