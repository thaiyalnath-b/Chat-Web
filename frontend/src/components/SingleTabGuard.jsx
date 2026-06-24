import React from "react";
import useSingleTabGuard from "../hooks/useSingleTabGuard";
import { Result, Button } from "antd";
import "antd/dist/reset.css";
import './SingleTabGuard.css';

// SingleTabGuard wraps the application and ensures only one tab can be active.
// If this tab is not the owner, it renders a full-screen Ant Design message and
// blocks access to the app (no children are mounted).

export default function SingleTabGuard({ children }) {
  const { isActive, isBlocked, sessionId } = useSingleTabGuard();

  if (isActive) {
    return <>{children}</>;
  }

  // Render professional full-screen page when blocked
  return (
    <div className="single-tab-guard-root">
      <Result
        status="warning"
        title="Session Already Active"
        subTitle="This chat application is already open in another tab. Please use the existing tab."
        extra={<Button type="primary" onClick={() => window.location.reload()}>Retry</Button>}
      />
      <div className="single-tab-guard-footer">Session ID: {sessionId}</div>
    </div>
  );
}
