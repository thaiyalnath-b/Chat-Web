import "../styles/loading.css";

function Loading() {
    return (
        <div className="loading-page">
            <div className="loading-card">

                {/* Logo with dual spinning rings */}
                <div className="loading-logo-wrap">
                    <div className="loading-ring-outer"></div>
                    <div className="loading-ring"></div>
                    <img
                        src="../public/h4.png"
                        alt="Homies"
                        className="loading-logo"
                    />
                </div>

                <h1 className="loading-title">Homies</h1>
                <p className="loading-subtitle">Loading your conversations…</p>

                {/* Animated dot trail */}
                <div className="loading-dots">
                    <span className="loading-dot"></span>
                    <span className="loading-dot"></span>
                    <span className="loading-dot"></span>
                </div>

            </div>
        </div>
    );
}

export default Loading;