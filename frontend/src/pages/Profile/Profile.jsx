import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Spin, message, Typography } from "antd";
import { auth } from "../../firebase/firebase";
import { getProfile, updateProfile } from "../../services/profileService";
import ProfileForm from "../../components/Profile/ProfileForm";
import Loading from "../Loading";
import "../../styles/profile.css";

const { Text } = Typography;

function Profile() {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                navigate("/login");
                return;
            }
            setCurrentUser(user);
        });

        return () => unsubscribe();
    }, [navigate]);

    const fetchProfile = useCallback(async ({ showLoading = true, quiet = false } = {}) => {
        if (!currentUser) return null;

        if (showLoading) {
            setLoading(true);
        }

        if (!quiet) {
            setError("");
        }

        try {
            const response = await getProfile();

            if (!response.success) {
                throw new Error(response.message || "Unable to load profile.");
            }

            setProfile(response.data);
            return response.data;
        } catch (err) {
            const errorMessage =
                err.response?.data?.message || err.message || "Failed to load profile.";

            if (!quiet) {
                setError(errorMessage);
                message.error(errorMessage);
            }

            return null;
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    }, [currentUser]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const handleSubmit = async (values) => {
        if (saving) return;

        setSaving(true);
        setError("");

        try {
            const response = await updateProfile(values);

            if (!response.success) {
                throw new Error(response.message || "Unable to update profile.");
            }

            await fetchProfile({ showLoading: false, quiet: true });
            message.success(response.message || "Profile updated successfully.");

            await new Promise((resolve) => window.setTimeout(resolve, 1000));

            window.dispatchEvent(
                new CustomEvent("profileUpdated", { detail: response.data })
            );

            if (window.history.length > 1) {
                navigate(-1);
            } else {
                navigate("/home");
            }
        } catch (err) {
            const errorMessage =
                err.response?.data?.message || err.message || "Failed to update profile.";
            setError(errorMessage);
            message.error(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate("/home");
        }
    };

    if (!currentUser) {
        return <Loading />;
    }

    return (
        <div className="profile-page">
            <div className="profile-page-inner">
                {loading ? (
                    <div className="profile-loading">
                        <Spin size="large" />
                        <Text type="secondary">Loading profile...</Text>
                    </div>
                ) : error && !profile ? (
                    <div className="profile-error-state">
                        <Text type="danger">{error}</Text>
                    </div>
                ) : (
                    <ProfileForm
                        initialProfile={profile}
                        saving={saving}
                        onSubmit={handleSubmit}
                        onBack={handleBack}
                    />
                )}
            </div>
        </div>
    );
}

export default Profile;
